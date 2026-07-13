#!/usr/bin/env node

/*
  S3Proxy Hono Server

  Docker runtime for s3proxy (https://github.com/gmoon/s3proxy) v4.
  Streams objects from an S3 bucket over HTTP using the v4 `proxy.fetch()`
  API and Hono on top of @hono/node-server.

  Start: PORT=8080 BUCKET=my-bucket node server.js

  Author: George Moon <george.moon@gmail.com>
*/

import fs from 'node:fs'
import process from 'node:process'
import { Readable } from 'node:stream'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { S3Proxy, S3ProxyError } from 's3proxy'

const PORT = Number(process.env.PORT) || 8080
const BUCKET = process.env.BUCKET
const NODE_ENV = process.env.NODE_ENV || 'production'

if (!BUCKET) {
  console.error('❌ Missing required environment variable: BUCKET')
  process.exit(1)
}

// Development credential handling.
// In production the AWS SDK credential chain is used (instance role, env vars,
// etc.). For local development a temporary credentials file can be bind-mounted
// (see `npm run credentials`); it is never used when NODE_ENV starts with "prod".
function getCredentials() {
  const file = fs.existsSync('/src/credentials.json')
    ? '/src/credentials.json'
    : './credentials.json'
  try {
    if (/^prod/i.test(NODE_ENV)) {
      return undefined
    }
    const { Credentials } = JSON.parse(fs.readFileSync(file, 'utf8'))
    console.log(`using credentials from ${file}`)
    return {
      accessKeyId: Credentials.AccessKeyId,
      secretAccessKey: Credentials.SecretAccessKey,
      sessionToken: Credentials.SessionToken,
    }
  } catch {
    console.log('using AWS SDK credential chain')
    return undefined
  }
}

const credentials = getCredentials()
const proxy = new S3Proxy(credentials ? { bucket: BUCKET, credentials } : { bucket: BUCKET })

try {
  await proxy.init()
  console.log(`S3Proxy initialized for bucket: ${BUCKET}`)
} catch (error) {
  console.error(`Failed to initialize S3Proxy for bucket: ${BUCKET}`, error)
  process.exit(1)
}

proxy.on('error', (error) => {
  console.error('S3Proxy error:', error)
})

const app = new Hono()

// Liveness + S3 connectivity. healthCheck() throws if the bucket is unreachable.
app.get('/health', async (c) => {
  await proxy.healthCheck()
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/version', (c) =>
  c.json({
    s3proxy: S3Proxy.version(),
    hono: 'hono',
    node: process.version,
    timestamp: new Date().toISOString(),
  })
)

app.get('/', (c) => c.redirect('/index.html', 301))

// Stream every key straight from S3. proxy.fetch() throws a typed S3ProxyError
// on classified failures (404/403/416), which is handled by app.onError below.
app.on(['GET', 'HEAD'], '/*', async (c) => {
  const url = new URL(c.req.url)
  const { stream, status, headers } = await proxy.fetch({
    url: url.pathname + url.search,
    method: c.req.method,
    headers: Object.fromEntries(c.req.raw.headers),
  })
  // Node Readable → Web ReadableStream; backpressure propagates, no buffering.
  const body = Readable.toWeb(stream)
  return new Response(body, { status, headers })
})

// Render errors as XML, matching the s3proxy Express/Fastify examples.
app.onError((error, c) => {
  const status = error instanceof S3ProxyError ? error.statusCode : error.statusCode || 500
  const code = error.code || error.name || 'InternalError'
  if (status >= 500) {
    console.error(`${c.req.method} ${c.req.url} failed:`, error)
  } else {
    console.log(`${c.req.method} ${c.req.url} -> ${status} ${code}`)
  }
  const xml = `<?xml version="1.0"?>\n<error code="${code}" statusCode="${status}">${error.message}</error>`
  return new Response(xml, { status, headers: { 'content-type': 'application/xml' } })
})

const server = serve({ fetch: app.fetch, port: PORT, hostname: '0.0.0.0' }, ({ port }) => {
  console.log(`🚀 S3Proxy Hono server listening on port ${port}`)
  console.log(`📦 s3proxy version: ${S3Proxy.version()}`)
  console.log(`🪣 S3 bucket: ${BUCKET}`)
})

// Graceful shutdown for container stop / orchestrator signals.
const shutdown = (signal) => {
  console.log(`Received ${signal}, shutting down gracefully...`)
  server.close(() => process.exit(0))
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

export default app
