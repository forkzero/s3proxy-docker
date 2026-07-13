#!/usr/bin/env node

/*
  Container tests — verify the built image is structured and hardened as
  expected. These don't need AWS credentials: they check the build, the
  runtime user, the file layout, and the missing-BUCKET guard.

  Run: npm test   (Docker must be available)
*/

import assert from 'node:assert'
import { spawn } from 'node:child_process'
import { after, before, describe, test } from 'node:test'

const IMAGE = 's3proxy-docker:test'

// Run a command to completion, collecting stdout+stderr and the exit code.
function run(cmd, args, { timeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.on('data', (d) => {
      output += d
    })
    child.stderr.on('data', (d) => {
      output += d
    })
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`command timed out: ${cmd} ${args.join(' ')}`))
    }, timeoutMs)
    child.on('error', reject)
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code, output })
    })
  })
}

describe('Docker container', () => {
  before(async () => {
    // Build the production image once for the whole suite.
    const { code, output } = await run('docker', [
      'build',
      '--target',
      'production',
      '-t',
      IMAGE,
      '.',
    ])
    assert.strictEqual(code, 0, `docker build should succeed:\n${output}`)
  })

  after(async () => {
    await run('docker', ['image', 'rm', '-f', IMAGE], { timeoutMs: 30000 }).catch(() => {})
  })

  test('runs as the non-root node user', async () => {
    const { code, output } = await run('docker', ['run', '--rm', '--entrypoint', 'whoami', IMAGE])
    assert.strictEqual(code, 0, output)
    assert.strictEqual(output.trim(), 'node', 'container should run as the node user')
  })

  test('has the app laid out under /src', async () => {
    const { output } = await run('docker', ['run', '--rm', '--entrypoint', 'ls', IMAGE, '/src'])
    for (const file of ['server.js', 'package.json', 'node_modules']) {
      assert.ok(output.includes(file), `/src should contain ${file}:\n${output}`)
    }
  })

  test('exits with a clear error when BUCKET is missing', async () => {
    const { code, output } = await run('docker', [
      'run',
      '--rm',
      '--entrypoint',
      'node',
      IMAGE,
      'server.js',
    ])
    assert.notStrictEqual(code, 0, 'should exit non-zero without BUCKET')
    assert.ok(
      output.includes('Missing required environment variable: BUCKET'),
      `should report the missing BUCKET:\n${output}`
    )
  })
})
