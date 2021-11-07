const test = require('ava')
const nock = require('nock');
// nock.recorder.rec();
const http = require('http')
const request = require('supertest')

test.before(async t => {
  nock('https://s3proxy-public.s3.amazonaws.com:443', {"encodedQueryParams":true})
  .head('/')
  .reply(200)
  nock.disableNetConnect()
  // allow localhost and AWS metadata API (relevant when running on AWS EC2)
  nock.enableNetConnect(/127.0.0.1|169.254.169.254/);
  const app = require('../express-s3proxy.js')
  t.context.server = await http.createServer(app)
  var listening = new Promise( (resolve) => {
    app.on( 'ready', resolve )
  })
  return listening;
})

test.after.always(t => {
  t.context.server.close()
})

test('get /health', async t => {
  const response = await request(t.context.server).get('/health')
  t.is(response.statusCode, 200)
})
