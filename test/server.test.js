#!/usr/bin/env node

/*
  Modern test suite for s3proxy-docker using Node.js built-in test runner
  Run: npm test
*/

import assert from 'node:assert'
import { spawn } from 'node:child_process'
import { after, before, describe, test } from 'node:test'
import { setTimeout } from 'node:timers/promises'

const TEST_PORT = 8081
const TEST_BUCKET = 's3proxy-public'
const BASE_URL = `http://localhost:${TEST_PORT}`

let serverProcess

describe('S3Proxy Docker Server', () => {
  before(async () => {
    // Start server for testing
    serverProcess = spawn('node', ['server.js'], {
      env: {
        ...process.env,
        PORT: TEST_PORT,
        BUCKET: TEST_BUCKET,
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    // Wait for server to start
    await setTimeout(2000)

    // Check if server started successfully
    if (serverProcess.killed) {
      throw new Error('Server failed to start')
    }
  })

  after(async () => {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill('SIGTERM')
      await setTimeout(1000)
    }
  })

  test('health check endpoint responds', async () => {
    const response = await fetch(`${BASE_URL}/health`)
    const data = await response.json()

    assert.strictEqual(response.status, 200)
    assert.strictEqual(data.status, 'ok')
    assert.ok(data.timestamp)
  })

  test('version endpoint returns correct format', async () => {
    const response = await fetch(`${BASE_URL}/version`)
    const data = await response.json()

    assert.strictEqual(response.status, 200)
    assert.ok(data.s3proxy)
    assert.ok(data.hono)
    assert.ok(data.node)
    assert.ok(data.timestamp)
  })

  test('root redirects to index.html', async () => {
    const response = await fetch(`${BASE_URL}/`, { redirect: 'manual' })

    assert.strictEqual(response.status, 301)
    assert.strictEqual(response.headers.get('location'), '/index.html')
  })

  test('server handles 404 for non-existent files', async () => {
    const response = await fetch(`${BASE_URL}/non-existent-file.txt`)

    assert.strictEqual(response.status, 404)
    assert.strictEqual(response.headers.get('content-type'), 'application/xml')
  })
})
