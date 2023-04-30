/* eslint-disable import/no-extraneous-dependencies, no-console, import/no-unresolved */

/*
  S3Proxy Express Framework Example

  Passes HTTP GET requests to s3proxy
  Start: PORT=3000 node express
  Test: mocha test.js

  Author: George Moon <george.moon@gmail.com>
*/
const fs = require('fs')
const helmet = require('helmet')
const express = require('express')
const AWSXRay = require('aws-xray-sdk')
const debug = require('debug')('s3proxy')
const bodyParser = require('body-parser')
const morgan = require('morgan')
const addRequestId = require('express-request-id')({ headerName: 'x-request-id' })
const S3Proxy = require('s3proxy')

class EnvironmentError extends Error {}

/*
  Check required environment variables: BUCKET and PORT
*/
if ('BUCKET' in process.env && 'PORT' in process.env) {
  debug(`starting with BUCKET=${process.env.BUCKET}, PORT=${process.env.PORT}`)
} else {
  throw new EnvironmentError(`required environment variable is undefined:\n\tBUCKET = ${process.env.BUCKET}\n\tPORT = ${process.env.PORT}`)
};

const port = process.env.PORT
const bucket = process.env.BUCKET
const app = express()
app.use(AWSXRay.express.openSegment('s3proxy'))
app.set('view engine', 'pug')
app.use(addRequestId)
app.use(bodyParser.json())
app.use(helmet())

function handleError (req, res, err) {
  // sending xml because the AWS SDK sets content-type: application/xml for non-200 responses
  res.end(`<?xml version="1.0"?>\n<error time="${err.time}" code="${err.code}" statusCode="${err.statusCode}" url="${req.url}" method="${req.method}">${err.message}</error>
  `)
}

// In non-production environments, if a credentials file exists, return the credentials
// To create a temporary credentials file:
//     aws sts get-session-token --duration 900 > credentials.json
//
function getCredentials () {
  const file = './credentials.json'
  var contents
  try {
    const credentials = JSON.parse(fs.readFileSync(file)).Credentials
    if (process.env.NODE_ENV.match(/^prod/i)) {
      throw new Error('will not use a credentials file in production')
    }
    contents = {
      accessKeyId: credentials.AccessKeyId,
      secretAccessKey: credentials.SecretAccessKey,
      sessionToken: credentials.SessionToken
    }
    debug(`using credentials from ${file}`)
  } catch (e) {
    debug('using sdk credential chain')
  }
  return contents
}

// Use morgan for request logging except during test execution
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(
    'request :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ' +
    '":referrer" ":user-agent" ":response-time ms" :res[x-request-id] :res[x-amz-request-id]'
  ))
}

// initialize the s3proxy
const credentials = getCredentials()
const proxy = new S3Proxy({ bucket, credentials })
proxy.init()

proxy.on('error', (err) => {
  throw new Error(`error initializing s3proxy for bucket ${bucket}: [${err.name}] ${err.message}`)
})

// basic health check
app.get('/health', (req, res) => {
  res.writeHead(200)
  res.end()
})

// health check s3
app.get('/health/s3', async (req, res) => {
  (await proxy.healthCheckStream(res)).on('error', () => {
    // just end the request and let the HTTP status code convey the error
    res.end()
  }).pipe(res)
})

// echo s3proxy version number. You probably want to protect this route as it can expose
// information that could be used for nefarious purposes
app.get('/version', (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.end(`{"version": "${S3Proxy.version()}"}\n`)
})

// route all get requests to s3proxy
app.get('/', (req, res) => {
  res.redirect('/index.html')
})

app.route('/*')
  .head(async (req, res) => {
    await proxy.head(req, res)
    res.end()
  })
  .get(async (req, res) => {
    (await proxy.get(req, res)).on('error', (err) => {
      handleError(req, res, err)
    }).pipe(res)
  })

app.use(AWSXRay.express.closeSegment())

proxy.on('init', () => {
  if (port > 0) {
    app.listen(port, () => {
      debug(`[version=${S3Proxy.version()}] listening on port ${port}`)
      app.emit('ready');
      if (process.send) { // test to determine if this is running in a child process
        process.send('ready') // for pm2-runtime wait_ready option
      }
    })
  }
})

module.exports = app
