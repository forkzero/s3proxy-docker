# Makefile for s3proxy-docker
# Conformance + load tests come from @forkzero/s3-website-test-kit (a devDep),
# run against the running container.

.PHONY: all build test lint clean docker-build docker-test conformance performance-test dev-setup security-audit ci help

# Default target
all: build lint test docker-test

# Build the application
build:
	npm ci --only=production

# Run linting
lint:
	npm run lint

# Run unit tests
test:
	npm run test

# Build Docker image
docker-build:
	docker build -t s3proxy-docker:latest .

# Test Docker image
docker-test: docker-build
	docker build --target test -t s3proxy-docker:test .
	docker run --rm s3proxy-docker:test

# Conformance gate: run the kit's expect-based suite against the container.
# Fails (non-zero) if any S3-website-semantics assertion fails. Needs AWS creds
# in the environment so the container can reach the bucket.
conformance: docker-build
	@echo "Starting conformance gate..."
	docker run -d --name s3proxy-conformance -p 8082:8080 \
		-e BUCKET=s3proxy-public -e AWS_REGION \
		-e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_SESSION_TOKEN \
		s3proxy-docker:latest
	@sleep 5
	@TARGET=http://localhost:8082 npm run test:conformance; status=$$?; \
		docker stop s3proxy-conformance >/dev/null 2>&1 || true; \
		docker rm s3proxy-conformance >/dev/null 2>&1 || true; \
		exit $$status

# Load/performance tests with Artillery (kit scenarios)
performance-test: docker-build
	@echo "Starting performance test..."
	docker run -d --name s3proxy-test -p 8082:8080 \
		-e BUCKET=s3proxy-public -e AWS_REGION \
		-e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_SESSION_TOKEN \
		s3proxy-docker:latest
	@sleep 5
	TARGET=http://localhost:8082 npm run test:load -- --output performance-results.json || true
	docker stop s3proxy-test || true
	docker rm s3proxy-test || true

# Clean up
clean:
	rm -rf node_modules
	rm -f *.json
	docker rmi s3proxy-docker:latest || true
	docker rmi s3proxy-docker:test || true

# Development setup
dev-setup:
	npm install
	npm run lint:fix

# Security audit
security-audit:
	npm audit --audit-level moderate
	docker run --rm -v "$(PWD)":/app -w /app aquasec/trivy fs .

# Full CI pipeline
ci: build lint test docker-test conformance

# Help
help:
	@echo "Available targets:"
	@echo "  all              - Run build, lint, test, docker-test"
	@echo "  build            - Install production dependencies"
	@echo "  lint             - Run code linting"
	@echo "  test             - Run unit tests"
	@echo "  docker-build     - Build Docker image"
	@echo "  docker-test      - Test Docker image"
	@echo "  conformance      - Run the s3-website conformance gate against the container"
	@echo "  performance-test - Run Artillery load tests against the container"
	@echo "  clean            - Clean up build artifacts"
	@echo "  dev-setup        - Setup development environment"
	@echo "  security-audit   - Run security audit"
	@echo "  ci               - Full CI pipeline"
