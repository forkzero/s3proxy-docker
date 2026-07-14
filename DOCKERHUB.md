# s3proxy

Front a private **AWS S3** bucket with a web server you control. `s3proxy`
streams objects straight from S3 to the client — no local buffering — using
[s3proxy](https://github.com/gmoon/s3proxy) v4 and [Hono](https://hono.dev).

- **Source / issues**: <https://github.com/forkzero/s3proxy-docker>
- **Tags**: `latest`, plus every release as `X.Y` and `X.Y.Z` — see
  [Releases](https://github.com/forkzero/s3proxy-docker/releases).
- **Architectures**: `linux/amd64`, `linux/arm64`.

## Quick start

```console
$ docker run --rm -p 8080:8080 -e BUCKET=my-bucket forkzero/s3proxy
```

Then request any object by its key:

```console
$ curl http://localhost:8080/index.html
```

In production, credentials come from the standard AWS SDK credential chain
(IAM instance/task role, `AWS_*` env vars, etc.) — nothing to configure beyond
the bucket. Missing or forbidden keys return an honest `404` / `403` (no
v3-style empty `200`).

## Configuration

| Variable      | Default      | Description                                  |
| ------------- | ------------ | -------------------------------------------- |
| `BUCKET`      | *(required)* | S3 bucket to serve.                          |
| `PORT`        | `8080`       | Port the server listens on.                  |
| `AWS_REGION`  | –            | AWS region (per the AWS SDK).                |
| `NODE_ENV`    | `production` | `development` enables the dev credentials file. |

## Endpoints

| Route            | Description                                                     |
| ---------------- | -------------------------------------------------------------- |
| `GET \| HEAD /*` | Stream the object at that key from S3 (supports Range).        |
| `GET /health`    | Liveness + S3 connectivity (drives the container healthcheck). |
| `GET /version`   | Reports the s3proxy and Node versions.                         |
| `GET /`          | Redirects to `/index.html`.                                    |

## Local development against a private bucket

Mint a short-lived session token and bind-mount it (only read when
`NODE_ENV` is not `production`):

```console
$ aws sts get-session-token --duration 900 > credentials.json
$ docker run --rm -p 8080:8080 \
    -e BUCKET=my-bucket -e NODE_ENV=development \
    -v "$PWD/credentials.json:/src/credentials.json:ro" \
    forkzero/s3proxy
```

## About the image

Multi-stage Alpine build running as a non-root user with `tini` as PID 1 and a
built-in healthcheck. The base image is pinned by digest and kept current by
Dependabot. Conformance-tested against
[`@forkzero/s3-website-test-kit`](https://github.com/forkzero/s3-website-test-kit).

## License

Apache-2.0 — <https://github.com/forkzero/s3proxy-docker/blob/main/LICENSE>
