# Multi-stage Dockerfile for s3proxy-docker with Fastify
# Optimized for security, performance, and minimal attack surface

# Build arguments
ARG NODE_VERSION=22.13.0
ARG ALPINE_VERSION=3.20

# Base stage with Node.js
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS base

# Install security updates and required packages
RUN apk update && \
    apk upgrade && \
    apk add --no-cache \
        tini \
        curl \
        ca-certificates && \
    rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S s3proxy -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Dependencies stage
FROM base AS deps

# Install production dependencies
RUN npm ci --only=production --no-audit --no-fund && \
    npm cache clean --force

# Development dependencies stage  
FROM base AS dev-deps

# Install all dependencies for development/testing
RUN npm ci --no-audit --no-fund

# Test stage
FROM dev-deps AS test

# Copy source code
COPY --chown=s3proxy:nodejs . .

# Run tests
RUN npm run test && \
    npm run lint

# Production build stage
FROM base AS production

# Copy production dependencies
COPY --from=deps --chown=s3proxy:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=s3proxy:nodejs server.js ./
COPY --chown=s3proxy:nodejs package.json ./

# Set environment variables
ENV NODE_ENV=production \
    PORT=8080 \
    LOG_LEVEL=info \
    NODE_OPTIONS="--enable-source-maps --max-old-space-size=512" \
    AWS_NODEJS_CONNECTION_REUSE_ENABLED=1

# Expose port
EXPOSE ${PORT}

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Switch to non-root user
USER s3proxy

# Use tini as init system for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start application
CMD ["node", "server.js"]

# Development stage
FROM dev-deps AS development

# Copy source code
COPY --chown=s3proxy:nodejs . .

# Set development environment
ENV NODE_ENV=development \
    LOG_LEVEL=debug \
    PORT=8080

# Expose port
EXPOSE ${PORT}

# Switch to non-root user
USER s3proxy

# Use tini for signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start with hot reload
CMD ["npm", "run", "dev"]
