# syntax=docker/dockerfile:1
#
# Docker runtime for s3proxy v4 (https://github.com/gmoon/s3proxy).
# Streams objects from an S3 bucket via a Hono web server (server.js).
#
# Build:  docker build --build-arg VERSION=$npm_package_version -t forkzero/s3proxy .
# Test:   docker build --target test -t s3proxy:test . && docker run --rm s3proxy:test
# Run:    docker run -e BUCKET=my-bucket -p 8080:8080 forkzero/s3proxy

# s3proxy requires Node >= 22.13. Pin by digest in CI via Dependabot updates.
ARG NODE_VERSION=22-alpine

########################################################################
# base: OS packages, production dependencies, and the app. Shared by all
# stages and, on its own, the runnable production image.
########################################################################
FROM node:${NODE_VERSION} AS base

ARG VERSION
WORKDIR /src

# Runtime defaults. Override at `docker run` time with -e.
ENV PORT=8080 \
    NODE_ENV=production \
    DEBUG=s3proxy \
    AWS_NODEJS_CONNECTION_REUSE_ENABLED=1

EXPOSE ${PORT}

# tini as PID 1 for correct signal handling. The healthcheck uses BusyBox
# wget (already in Alpine), so no extra package is needed for it.
RUN apk --no-cache --update-cache upgrade \
    && apk add --no-cache tini

COPY package.json package-lock.json ./
# BuildKit cache mount keeps the npm cache across builds without baking it
# into the layer, so no `npm cache clean` step is needed.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --no-audit --no-fund

COPY server.js ./

# Use 127.0.0.1 (not localhost): the server binds IPv4 0.0.0.0, while Alpine
# resolves "localhost" to IPv6 ::1 first, which would refuse the connection.
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/health" || exit 1

USER node
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]

########################################################################
# test: adds dev dependencies and the full source, runs the unit tests.
########################################################################
FROM base AS test

USER root
ENV NODE_ENV=development
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund
COPY . .
USER node
CMD ["npm", "test"]

########################################################################
# production: default build target. Inherits everything from base.
########################################################################
FROM base AS production
