FROM node:current-alpine@sha256:0738685cff8a6bbace6a8f308986729e9b31b07083de252d3b2a321473f99089 as base

ARG VERSION
WORKDIR /src
# Set default environment variables. Can be overridden via docker run -e
ENV PORT=8080 DEBUG=s3proxy AWS_NODEJS_CONNECTION_REUSE_ENABLED=1 NODE_ENV=production
EXPOSE $PORT
COPY package.json package-lock.json express-s3proxy.js ./
HEALTHCHECK --interval=60s CMD curl -f http://localhost:${PORT}/health || exit 1
RUN apk --update-cache upgrade \
    && npm ci --only=production \ 
    && apk add --no-cache curl~=7.83.1 tini~=0.19.0 \
    && npm cache clean --force \
    && rm -rf ~/.npm

FROM base as test
RUN apk add --no-cache jq~=1.6 bash~=5.1.16
USER node
ENV DEBUG=s3proxy,express NODE_ENV=development
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "express-s3proxy.js"]

FROM base as production
RUN rm -rf /var/cache/apk/
USER node
ENTRYPOINT ["/sbin/tini", "--"]
# CMD ["./checkenv.sh"]
CMD ["node", "express-s3proxy.js"]
