const test = require('ava')
const app = require('../express-s3proxy.js')
const http = require('http')
const request = require('supertest')

test.before(async t => {
  t.context.server = http.createServer(app)
})

test.after.always(t => {
  t.context.server.close()
})

test('get /health', async t => {
  const response = await request(t.context.server).get('/health')
  t.is(response.statusCode, 200)
})
