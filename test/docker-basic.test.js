#!/usr/bin/env node

/*
  Basic Docker container test - tests that the container builds and starts properly
  This test doesn't require AWS credentials, just verifies the container structure
*/

import assert from 'node:assert'
import { spawn } from 'node:child_process'
import { describe, test } from 'node:test'
import { setTimeout } from 'node:timers/promises'

describe('Docker Container Basic Tests', () => {
  test('Docker image builds successfully', async () => {
    const buildProcess = spawn('docker', ['build', '-t', 's3proxy-docker:test', '.'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const buildResult = await new Promise((resolve) => {
      buildProcess.on('close', (code) => {
        resolve(code)
      })
    })

    assert.strictEqual(buildResult, 0, 'Docker build should succeed')
  })

  test('Container starts and fails gracefully without AWS credentials', async () => {
    // This test verifies the container starts and fails as expected without credentials
    const containerProcess = spawn(
      'docker',
      [
        'run',
        '--rm',
        '-e',
        'BUCKET=s3proxy-public',
        '-e',
        'NODE_ENV=production',
        '-e',
        'LOG_LEVEL=info',
        's3proxy-docker:test',
      ],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    )

    let output = ''
    containerProcess.stderr.on('data', (data) => {
      output += data.toString()
    })

    containerProcess.stdout.on('data', (data) => {
      output += data.toString()
    })

    // Wait for container to start and fail
    await setTimeout(3000)

    // Kill the container if it's still running
    if (!containerProcess.killed) {
      containerProcess.kill('SIGTERM')
    }

    await new Promise((resolve) => {
      containerProcess.on('close', resolve)
    })

    // Verify expected behavior - should fail to initialize S3Proxy
    assert.ok(
      output.includes('Failed to initialize S3Proxy'),
      'Should fail to initialize S3Proxy without credentials'
    )
    assert.ok(output.includes('s3proxy-public'), 'Should reference the correct bucket name')
  })

  test('Container has correct file structure', async () => {
    const inspectProcess = spawn(
      'docker',
      ['run', '--rm', '--entrypoint', 'ls', 's3proxy-docker:test', '-la', '/app'],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    )

    let output = ''
    inspectProcess.stdout.on('data', (data) => {
      output += data.toString()
    })

    await new Promise((resolve) => {
      inspectProcess.on('close', resolve)
    })

    // Verify expected files are present
    assert.ok(output.includes('server.js'), 'Should contain server.js')
    assert.ok(output.includes('package.json'), 'Should contain package.json')
    assert.ok(output.includes('node_modules'), 'Should contain node_modules')
  })

  test('Container runs as non-root user', async () => {
    const userProcess = spawn(
      'docker',
      ['run', '--rm', '--entrypoint', 'whoami', 's3proxy-docker:test'],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    )

    let output = ''
    userProcess.stdout.on('data', (data) => {
      output += data.toString()
    })

    await new Promise((resolve) => {
      userProcess.on('close', resolve)
    })

    assert.strictEqual(output.trim(), 's3proxy', 'Should run as s3proxy user')
  })
})
