# Makefile for s3proxy-docker
# Aligned with s3proxy main repository testing patterns

.PHONY: all build test lint clean docker-build docker-test shared-test performance-test

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

# Run shared testing (validation + performance)
shared-test:
	npm run test:shared

# Build Docker image
docker-build:
	docker build -t s3proxy-docker:latest .

# Test Docker image
docker-test: docker-build
	docker build --target test -t s3proxy-docker:test .
	docker run --rm s3proxy-docker:test

# Run performance tests with Artillery
performance-test: docker-build
	@echo "Starting performance test..."
	docker run -d --name s3proxy-test -p 8082:8080 -e BUCKET=s3proxy-public s3proxy-docker:latest
	@sleep 5
	npx artillery run shared-testing/configs/docker-container.yml --output performance-results.json || true
	docker stop s3proxy-test || true
	docker rm s3proxy-test || true

# Clean up
clean:
	rm -rf node_modules
	rm -rf shared-testing
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
ci: build lint test docker-test shared-test

# Help
help:
	@echo "Available targets:"
	@echo "  all           - Run build, lint, test, docker-test"
	@echo "  build         - Install production dependencies"
	@echo "  lint          - Run code linting"
	@echo "  test          - Run unit tests"
	@echo "  shared-test   - Run shared testing (validation + performance)"
	@echo "  docker-build  - Build Docker image"
	@echo "  docker-test   - Test Docker image"
	@echo "  performance-test - Run Artillery performance tests"
	@echo "  clean         - Clean up build artifacts"
	@echo "  dev-setup     - Setup development environment"
	@echo "  security-audit - Run security audit"
	@echo "  ci            - Full CI pipeline"
