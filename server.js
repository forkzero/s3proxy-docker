#!/usr/bin/env node

/*
  S3Proxy Fastify Production Server - v3.0.0

  High-performance production server using Fastify and s3proxy
  Start: PORT=8080 node server.js
  
  Author: George Moon <george.moon@gmail.com>
*/

import fs from 'node:fs'
import process from 'node:process'
import Fastify from 'fastify'
import { S3Proxy } from 's3proxy'

// Environment validation
const requiredEnvVars = ['BUCKET', 'PORT']
const missingVars = requiredEnvVars.filter((varName) => !process.env[varName])

if (missingVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`)
  process.exit(1)
}

const { BUCKET, PORT, NODE_ENV = 'production', LOG_LEVEL = 'info' } = process.env

// Fastify instance with optimized configuration
const fastify = Fastify({
  logger: {
    level: LOG_LEVEL,
    ...(NODE_ENV === 'production'
      ? {
          // Structured JSON logging for production
          serializers: {
            req: (req) => ({
              method: req.method,
              url: req.url,
              hostname: req.hostname,
              remoteAddress: req.ip,
              userAgent: req.headers['user-agent'],
            }),
            res: (res) => ({
              statusCode: res.statusCode,
              responseTime: res.responseTime,
            }),
          },
        }
      : {
          // Pretty printing for development
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
            },
          },
        }),
  },
  trustProxy: true,
  disableRequestLogging: false,
  requestIdHeader: 'x-request-id',
  requestIdLogLabel: 'reqId',
})

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  fastify.log.info(`Received ${signal}, shutting down gracefully...`)
  try {
    await fastify.close()
    fastify.log.info('Server closed successfully')
    process.exit(0)
  } catch (err) {
    fastify.log.error('Error during shutdown:', err)
    process.exit(1)
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Credential management (dev vs production)
function getCredentials() {
  const credentialsFile = './credentials.json'

  try {
    if (NODE_ENV?.match(/^prod/i)) {
      fastify.log.info('Production mode: using AWS SDK credential chain')
      return undefined
    }

    const credentialsData = JSON.parse(fs.readFileSync(credentialsFile, 'utf8'))
    const credentials = credentialsData.Credentials

    fastify.log.info(`Development mode: using credentials from ${credentialsFile}`)
    return {
      accessKeyId: credentials.AccessKeyId,
      secretAccessKey: credentials.SecretAccessKey,
      sessionToken: credentials.SessionToken,
    }
  } catch (_error) {
    fastify.log.info('Using AWS SDK credential chain')
    return undefined
  }
}

// Initialize S3Proxy
const credentials = getCredentials()
const proxy = new S3Proxy({ bucket: BUCKET, credentials })

try {
  await proxy.init()
  fastify.log.info(`S3Proxy initialized successfully for bucket: ${BUCKET}`)
} catch (error) {
  fastify.log.error(`Failed to initialize S3Proxy for bucket ${BUCKET}:`, error)
  process.exit(1)
}

// Proxy error handling
proxy.on('error', (error) => {
  fastify.log.error('S3Proxy error:', error)
})

// Security headers plugin
await fastify.register(import('@fastify/helmet'), {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
})

// Request/Response time tracking
await fastify.register(import('@fastify/sensible'))

// Health check endpoints
fastify.get('/health', async (_request, _reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() }
})

fastify.get('/health/s3', async (_request, reply) => {
  try {
    const _stream = await proxy.healthCheckStream(reply.raw)
    return reply.hijack()
  } catch (error) {
    fastify.log.error('S3 health check failed:', error)
    return reply.code(503).send({
      status: 'error',
      message: 'S3 connectivity check failed',
      timestamp: new Date().toISOString(),
    })
  }
})

// Version endpoint
fastify.get('/version', async (_request, _reply) => {
  return {
    s3proxy: S3Proxy.version(),
    fastify: fastify.version,
    node: process.version,
    timestamp: new Date().toISOString(),
  }
})

// Root redirect
fastify.get('/', async (_request, reply) => {
  return reply.redirect(301, '/index.html')
})

// S3 proxy routes
fastify.head('/*', async (request, reply) => {
  try {
    const _stream = await proxy.head(request.raw, reply.raw)
    return reply.hijack()
  } catch (error) {
    fastify.log.error('HEAD request failed:', error)
    return reply
      .code(error.statusCode || 500)
      .type('application/xml')
      .send(
        `<?xml version="1.0"?>\n<error code="${error.code || 'InternalError'}" statusCode="${error.statusCode || 500}">${error.message}</error>`
      )
  }
})

fastify.get('/*', async (request, reply) => {
  try {
    const stream = await proxy.get(request.raw, reply.raw)

    stream.on('error', (error) => {
      fastify.log.error('Stream error:', error)
      if (!reply.sent) {
        reply
          .code(error.statusCode || 500)
          .type('application/xml')
          .send(
            `<?xml version="1.0"?>\n<error code="${error.code || 'InternalError'}" statusCode="${error.statusCode || 500}">${error.message}</error>`
          )
      }
    })

    return reply.hijack()
  } catch (error) {
    fastify.log.error('GET request failed:', error)
    return reply
      .code(error.statusCode || 500)
      .type('application/xml')
      .send(
        `<?xml version="1.0"?>\n<error code="${error.code || 'InternalError'}" statusCode="${error.statusCode || 500}">${error.message}</error>`
      )
  }
})

// Start server
try {
  const address = await fastify.listen({
    port: Number.parseInt(PORT, 10),
    host: '0.0.0.0',
  })

  fastify.log.info(`🚀 S3Proxy server listening on ${address}`)
  fastify.log.info(`📦 S3Proxy version: ${S3Proxy.version()}`)
  fastify.log.info(`⚡ Fastify version: ${fastify.version}`)
  fastify.log.info(`🪣 S3 Bucket: ${BUCKET}`)

  // Signal readiness for process managers (PM2, Docker, etc.)
  if (process.send) {
    process.send('ready')
  }
} catch (error) {
  fastify.log.error('Failed to start server:', error)
  process.exit(1)
}

export default fastify
