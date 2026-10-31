# Changelog

## [5.0.0](https://github.com/forkzero/s3proxy-docker/compare/v4.2.3...v5.0.0) (2026-10-31)


### ⚠ BREAKING CHANGES

* **deps:** error responses for previously-unclassified S3 failures now return <error code="S3ProxyError" statusCode="500"> instead of the raw AWS error code/status/message. The classified 404/403/416 responses are unchanged. Clients that parsed the old raw-error responses should pin

### Features

* **deps:** upgrade s3proxy to 5.0.0 ([#124](https://github.com/forkzero/s3proxy-docker/issues/124)) ([82be4f2](https://github.com/forkzero/s3proxy-docker/commit/82be4f2dbc67b7344a0835920405d653d1a7849e))

## [4.2.3](https://github.com/forkzero/s3proxy-docker/compare/v4.2.2...v4.2.3) (2026-10-31)


### Bug Fixes

* **deps:** bump hono to 4.13.14 to clear serveStatic advisory ([#121](https://github.com/forkzero/s3proxy-docker/issues/121)) ([cb86ca7](https://github.com/forkzero/s3proxy-docker/commit/cb86ca7254665f3865479d3b5975ac76304379fa))

## [4.2.2](https://github.com/forkzero/s3proxy-docker/compare/v4.2.1...v4.2.2) (2026-07-15)


### Bug Fixes

* upgrade base image and CI to Node 24 (Active LTS) ([#117](https://github.com/forkzero/s3proxy-docker/issues/117)) ([a5793d7](https://github.com/forkzero/s3proxy-docker/commit/a5793d7d22cc352b58c0dff03270c30d24015320))

## [4.2.1](https://github.com/forkzero/s3proxy-docker/compare/v4.2.0...v4.2.1) (2026-07-14)


### Bug Fixes

* **deps:** upgrade s3proxy to 4.2.1 ([#115](https://github.com/forkzero/s3proxy-docker/issues/115)) ([05be502](https://github.com/forkzero/s3proxy-docker/commit/05be502c1a71e90a4a6d74b020ba503352cff9f7))
