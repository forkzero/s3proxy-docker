# s3proxy-docker

A small, production-ready Docker image that fronts an AWS S3 bucket with a web
server you control. It streams objects straight from S3 to the client — no
local buffering — using [s3proxy](https://github.com/gmoon/s3proxy) v4 and
[Hono](https://hono.dev) on `@hono/node-server`.

Published image: **[`forkzero/s3proxy`](https://hub.docker.com/r/forkzero/s3proxy)**

## Quick start

```bash
docker run --rm -p 8080:8080 -e BUCKET=my-bucket forkzero/s3proxy
```

Then request any object by its key:

```bash
curl http://localhost:8080/index.html
```

In production, credentials come from the standard AWS SDK credential chain
(IAM instance/task role, `AWS_*` environment variables, etc.) — nothing to
configure beyond the bucket.

## Configuration

| Variable                             | Default      | Description                                             |
| ------------------------------------ | ------------ | ------------------------------------------------------ |
| `BUCKET`                             | *(required)* | S3 bucket to serve.                                    |
| `PORT`                               | `8080`       | Port the server listens on.                            |
| `AWS_REGION`                         | –            | AWS region (per the AWS SDK).                          |
| `NODE_ENV`                           | `production` | `development` enables the dev credentials file (below). |
| `AWS_NODEJS_CONNECTION_REUSE_ENABLED`| `1`          | Reuse HTTPS connections to S3 (set in the image).      |

## Endpoints

| Route             | Description                                                            |
| ----------------- | --------------------------------------------------------------------- |
| `GET \| HEAD /*`  | Stream the object at that key from S3.                                |
| `GET /health`     | Liveness + S3 connectivity check (drives the container `HEALTHCHECK`).|
| `GET /version`    | Reports the s3proxy and Node versions.                                |
| `GET /`           | Redirects to `/index.html`.                                           |

Missing or forbidden keys return an honest `404` / `403` with an XML error body
(no v3-style empty-`200`).

## Local development

To run against a bucket that requires credentials, mint a short-lived session
token and bind-mount it. The file is only read when `NODE_ENV` is **not**
`production`:

```bash
npm run credentials        # writes ./credentials.json via `aws sts get-session-token`
docker run --rm -p 8080:8080 \
  -e BUCKET=my-bucket -e NODE_ENV=development \
  -v "$PWD/credentials.json:/src/credentials.json:ro" \
  forkzero/s3proxy
```

Run the server directly (no Docker) the same way:

```bash
BUCKET=my-bucket npm start        # or: npm run dev   (watch mode)
```

## Testing & build

```bash
npm test                   # unit + container tests (needs AWS access to the bucket)
npm run lint               # Biome
npm run docker:build       # build the image locally
npm run docker:test        # build the `test` stage and run the suite in-container
```

Or via the `Makefile`: `make build`, `make lint`, `make test`, `make docker-test`.

## Image layout

The [`Dockerfile`](./Dockerfile) is a multi-stage build:

- **`base`** – Alpine + Node 22, production dependencies, and `server.js`.
  Runs as the non-root `node` user with `tini` as PID 1 for clean signal
  handling. This is the runnable image.
- **`test`** – adds dev dependencies and the full source, runs `npm test`.
- **`production`** – the default build target (inherits `base`).

Build a specific stage with `--target`, e.g. `docker build --target test .`.

## Releasing

CI (`.github/workflows/ci.yml`) lints, runs the tests, and smoke-tests the
built image on every push/PR. Publishing `forkzero/s3proxy` to Docker Hub is
handled by `.github/workflows/publish.yml` when a GitHub Release is published;
the release tag drives the image tags (e.g. `4.1.0`, `4.1`, `latest`), and the
image is built for `linux/amd64` and `linux/arm64`.

## License

Apache-2.0 — see [LICENSE](./LICENSE).
