#!/usr/bin/env node

/*
  Shared Testing Integration for s3proxy-docker
  
  This script leverages the shared testing infrastructure from the main s3proxy repository
  to run comprehensive validation and performance tests against the Docker container.
  
  Run: npm run test:shared
*/

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { setTimeout } from 'node:timers/promises'

const DOCKER_PORT = 8082
const TEST_BUCKET = 's3proxy-public'
const SHARED_TESTING_DIR = './shared-testing'

// Create shared testing directory structure
async function setupSharedTesting() {
  console.log('📁 Setting up shared testing infrastructure...')

  if (!existsSync(SHARED_TESTING_DIR)) {
    await mkdir(SHARED_TESTING_DIR, { recursive: true })
    await mkdir(`${SHARED_TESTING_DIR}/configs`, { recursive: true })
    await mkdir(`${SHARED_TESTING_DIR}/scenarios`, { recursive: true })
  }

  // Create Artillery configuration for Docker container testing
  const dockerConfig = {
    config: {
      target: `http://localhost:${DOCKER_PORT}`,
      phases: [
        {
          duration: 30,
          arrivalRate: 10,
          name: 'Docker container load test',
        },
      ],
      processor: './test-processor.js',
    },
    scenarios: [
      {
        name: 'Health check',
        weight: 20,
        flow: [
          {
            get: {
              url: '/health',
            },
          },
        ],
      },
      {
        name: 'Version endpoint',
        weight: 10,
        flow: [
          {
            get: {
              url: '/version',
            },
          },
        ],
      },
      {
        name: 'S3 health check',
        weight: 10,
        flow: [
          {
            get: {
              url: '/health/s3',
            },
          },
        ],
      },
      {
        name: 'File requests (404 expected)',
        weight: 60,
        flow: [
          {
            get: {
              url: '/test-file-{{ $randomInt(1, 100) }}.txt',
            },
          },
        ],
      },
    ],
  }

  await writeFile(
    `${SHARED_TESTING_DIR}/configs/docker-container.yml`,
    `# Artillery configuration for Docker container testing
${JSON.stringify(dockerConfig, null, 2).replace(/"/g, '').replace(/,\n/g, '\n')}`
  )

  // Create test processor
  const testProcessor = `
// Test processor for Artillery
export function setupScenario(requestParams, context, ee, next) {
  // Add any setup logic here
  return next()
}

export function logResponse(requestParams, response, context, ee, next) {
  if (response.statusCode >= 400) {
    console.log(\`Response: \${response.statusCode} for \${requestParams.url}\`)
  }
  return next()
}
`

  await writeFile(`${SHARED_TESTING_DIR}/test-processor.js`, testProcessor)

  console.log('✅ Shared testing infrastructure ready')
}

// Start Docker container for testing
async function startDockerContainer() {
  console.log('🐳 Starting Docker container for testing...')

  const dockerProcess = spawn(
    'docker',
    [
      'run',
      '--rm',
      '-p',
      `${DOCKER_PORT}:8080`,
      '-e',
      `BUCKET=${TEST_BUCKET}`,
      '-e',
      'NODE_ENV=test',
      '-e',
      'LOG_LEVEL=warn',
      's3proxy-docker:latest',
    ],
    {
      stdio: ['pipe', 'pipe', 'pipe'],
    }
  )

  // Wait for container to start
  await setTimeout(5000)

  if (dockerProcess.killed) {
    throw new Error('Docker container failed to start')
  }

  console.log('✅ Docker container started')
  return dockerProcess
}

// Run Artillery load test
async function runLoadTest() {
  console.log('⚡ Running Artillery load test...')

  return new Promise((resolve, reject) => {
    const artilleryProcess = spawn(
      'npx',
      [
        'artillery',
        'run',
        `${SHARED_TESTING_DIR}/configs/docker-container.yml`,
        '--output',
        'load-test-results.json',
      ],
      {
        stdio: 'inherit',
      }
    )

    artilleryProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Artillery load test completed successfully')
        resolve()
      } else {
        reject(new Error(`Artillery test failed with code ${code}`))
      }
    })
  })
}

// Run validation tests
async function runValidationTests() {
  console.log('🧪 Running validation tests...')

  const testCases = [
    { path: '/health', expectedStatus: 200, description: 'Health check' },
    { path: '/version', expectedStatus: 200, description: 'Version endpoint' },
    { path: '/health/s3', expectedStatus: [200, 503], description: 'S3 health check' },
    { path: '/non-existent.txt', expectedStatus: 404, description: '404 handling' },
    { path: '/', expectedStatus: 301, description: 'Root redirect' },
  ]

  const results = []

  for (const testCase of testCases) {
    try {
      const response = await fetch(`http://localhost:${DOCKER_PORT}${testCase.path}`, {
        redirect: 'manual',
      })

      const expectedStatuses = Array.isArray(testCase.expectedStatus)
        ? testCase.expectedStatus
        : [testCase.expectedStatus]

      const passed = expectedStatuses.includes(response.status)

      results.push({
        ...testCase,
        actualStatus: response.status,
        passed,
      })

      console.log(`${passed ? '✅' : '❌'} ${testCase.description}: ${response.status}`)
    } catch (error) {
      results.push({
        ...testCase,
        error: error.message,
        passed: false,
      })
      console.log(`❌ ${testCase.description}: ${error.message}`)
    }
  }

  const passedTests = results.filter((r) => r.passed).length
  const totalTests = results.length

  console.log(`\n📊 Validation Results: ${passedTests}/${totalTests} tests passed`)

  if (passedTests !== totalTests) {
    throw new Error('Some validation tests failed')
  }
}

// Main test execution
async function main() {
  let dockerProcess

  try {
    console.log('🚀 Starting s3proxy-docker shared testing...\n')

    // Setup
    await setupSharedTesting()

    // Build Docker image first
    console.log('🔨 Building Docker image...')
    await new Promise((resolve, reject) => {
      const buildProcess = spawn('docker', ['build', '-t', 's3proxy-docker:latest', '.'], {
        stdio: 'inherit',
      })
      buildProcess.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`Docker build failed with code ${code}`))
      })
    })

    // Start container
    dockerProcess = await startDockerContainer()

    // Run tests
    await runValidationTests()
    await runLoadTest()

    console.log('\n🎉 All shared tests completed successfully!')
  } catch (error) {
    console.error(`\n❌ Shared testing failed: ${error.message}`)
    process.exit(1)
  } finally {
    // Cleanup
    if (dockerProcess && !dockerProcess.killed) {
      console.log('🧹 Cleaning up Docker container...')
      dockerProcess.kill('SIGTERM')
      await setTimeout(2000)
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { setupSharedTesting, runValidationTests, runLoadTest }
