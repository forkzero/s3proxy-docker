# S3Proxy-Docker v3.0.0 Adaptation TODO

This TODO list outlines the steps needed to adapt the s3proxy-docker repository to work with the new TypeScript-based s3proxy v3.0.0 and shared testing infrastructure.

## Phase 1: Core Application Updates

### 1.1 Update Dependencies
- [ ] Update `package.json` to use s3proxy v3.0.0
- [ ] Update Node.js version requirement to 20+ for full ESM support
- [ ] Review and update other dependencies for compatibility
- [ ] Test dependency compatibility locally

### 1.2 Application Code Migration
- [ ] **CRITICAL**: Replace `express-s3proxy.js` with new ESM-compatible version
- [ ] Update import statements from `require()` to ES modules
- [ ] Adapt to new s3proxy v3.0.0 API changes
- [ ] Update error handling for new TypeScript interfaces
- [ ] Test credential management with new version
- [ ] Verify AWS X-Ray integration still works

### 1.3 Configuration Updates
- [ ] Update environment variable handling for new version
- [ ] Review and update default configurations
- [ ] Test health check endpoints with new API

## Phase 2: Docker Infrastructure

### 2.1 Dockerfile Modernization
- [ ] Update base image to Node.js 20-alpine
- [ ] Add build argument for S3PROXY_VERSION
- [ ] Update multi-stage build for TypeScript/ESM support
- [ ] Modify COPY commands for new file structure
- [ ] Update health check configuration
- [ ] Test Docker build locally

### 2.2 Docker Scripts and Commands
- [ ] Update npm scripts in package.json for new Docker workflow
- [ ] Modify `dockerize-for-prod-aws` script
- [ ] Modify `dockerize-for-prod-dockerhub` script
- [ ] Update `docker` test script
- [ ] Test all Docker-related npm scripts

## Phase 3: Testing Infrastructure

### 3.1 Shared Testing Integration
- [ ] Remove duplicate test configurations
- [ ] Create mechanism to download shared testing configs from s3proxy repo
- [ ] Update test scripts to use shared configurations
- [ ] Integrate Artillery load testing with shared scenarios
- [ ] Test shared testing workflow locally

### 3.2 Test Updates
- [ ] Update `test/test.js` for new s3proxy API
- [ ] Add tests for new TypeScript interfaces
- [ ] Update nock mocking for API changes
- [ ] Add integration tests with shared configs
- [ ] Verify all tests pass with new version

## Phase 4: CI/CD Pipeline

### 4.1 GitHub Actions Overhaul
- [ ] **MAJOR**: Replace `continuous-deployment.yml` with new workflow
- [ ] Add job for downloading shared testing configs
- [ ] Implement cross-repo integration testing
- [ ] Add performance comparison between npm and Docker
- [ ] Configure artifact sharing between jobs
- [ ] Add multi-platform build support

### 4.2 Repository Secrets
- [ ] Verify `DOCKERHUB_USERNAME` secret exists
- [ ] Verify `DOCKERHUB_TOKEN` secret exists
- [ ] Add `REPO_ACCESS_TOKEN` for cross-repo communication
- [ ] Test secret access in workflows

### 4.3 Integration Workflow
- [ ] Set up repository dispatch triggers
- [ ] Configure result reporting back to s3proxy repo
- [ ] Test end-to-end integration workflow
- [ ] Verify performance comparison functionality

## Phase 5: Documentation

### 5.1 README Updates
- [ ] Update README.md for v3.0.0 changes
- [ ] Document new environment variables
- [ ] Update usage examples
- [ ] Add shared testing documentation
- [ ] Update supported architectures info
- [ ] Add troubleshooting section for new version

### 5.2 Additional Documentation
- [ ] Review and update inline code comments
- [ ] Update JSDoc comments for new API
- [ ] Create migration guide for existing users
- [ ] Document breaking changes

## Phase 6: Quality Assurance

### 6.1 Local Testing
- [ ] Test Docker build with new s3proxy version
- [ ] Verify container starts and serves files correctly
- [ ] Test health endpoints
- [ ] Test range requests
- [ ] Test special character handling
- [ ] Test error scenarios

### 6.2 Load Testing
- [ ] Run basic load tests with shared configs
- [ ] Run sustained load tests
- [ ] Compare performance with previous version
- [ ] Verify memory usage and stability
- [ ] Test under various load patterns

### 6.3 Integration Testing
- [ ] Test with real S3 buckets
- [ ] Test AWS credential handling
- [ ] Test in different AWS regions
- [ ] Test with various file types and sizes
- [ ] Test cross-platform compatibility (AMD64/ARM64)

## Phase 7: Deployment Preparation

### 7.1 Version Management
- [ ] Update version in package.json to match s3proxy version
- [ ] Create version tags strategy
- [ ] Plan backward compatibility approach
- [ ] Document version migration path

### 7.2 Release Preparation
- [ ] Create release notes for v3.0.0
- [ ] Prepare Docker Hub description updates
- [ ] Plan rollout strategy
- [ ] Prepare rollback plan if needed

## Phase 8: Post-Migration

### 8.1 Monitoring and Validation
- [ ] Monitor container performance in production
- [ ] Validate shared testing integration works
- [ ] Monitor for any regression issues
- [ ] Collect user feedback

### 8.2 Cleanup
- [ ] Remove old/unused files
- [ ] Clean up deprecated npm scripts
- [ ] Archive old documentation
- [ ] Update project metadata

## Critical Dependencies

### External Requirements
- [ ] Ensure s3proxy v3.0.0 is published and stable
- [ ] Verify shared testing configs are available in s3proxy repo
- [ ] Confirm cross-repo integration approach with s3proxy maintainer

### Risk Mitigation
- [ ] Create backup of current working version
- [ ] Test migration in separate branch
- [ ] Plan for gradual rollout
- [ ] Prepare communication for breaking changes

## Priority Levels

**HIGH PRIORITY** (Must complete for basic functionality):
- Update dependencies and application code
- Update Dockerfile for Node.js 20+ and ESM
- Basic testing with new version

**MEDIUM PRIORITY** (Important for full integration):
- Shared testing infrastructure
- Updated CI/CD pipeline
- Documentation updates

**LOW PRIORITY** (Nice to have):
- Performance optimizations
- Advanced monitoring
- Additional test scenarios

## Estimated Timeline

- **Phase 1-2**: 2-3 days (Core updates and Docker)
- **Phase 3-4**: 3-4 days (Testing and CI/CD)
- **Phase 5-6**: 2-3 days (Documentation and QA)
- **Phase 7-8**: 1-2 days (Deployment and cleanup)

**Total Estimated Time**: 8-12 days

## Notes

- Keep the current version working until migration is complete
- Test each phase thoroughly before moving to the next
- Consider creating a migration branch for development
- Coordinate with s3proxy repo maintainer for integration testing
- Document any issues or deviations from the plan
