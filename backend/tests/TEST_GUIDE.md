# Testing Guide

## Overview

This guide covers the testing strategy for Thunderbird to catch common deployment and configuration issues.

## Test Categories

### 1. Unit Tests
Tests for individual functions and components in isolation.

**Location**: `tests/test_*.py`

**Key Test Files**:
- `test_beta_country_codes.py` - Country code normalization (catches country code bug)
- `test_auth.py` - Authentication functions (password hashing, JWT)
- `test_services.py` - Service layer functions
- `test_validation.py` - Input validation

**Run**:
```bash
pytest tests/test_beta_country_codes.py -v
pytest tests/test_auth.py -v
```

### 2. Integration Tests
Tests that verify multiple components work together correctly.

**Location**: `test_integration.py`, `tests/test_api_integration.py`

**Key Tests**:
- Route loading and weather API integration
- Forecast formatting pipeline
- Command parsing
- SafeCheck notification flow

**Run**:
```bash
python test_integration.py
pytest tests/test_api_integration.py -v
```

### 3. Deployment Verification Tests
Tests that verify all endpoints are accessible and return correct status codes.
These catch deployment issues like missing routers or incorrect nginx configuration.

**Location**: `tests/test_deployment_endpoints.py`

**What It Catches**:
- Auth endpoints returning 404 (router not included)
- Missing API endpoints
- Incorrect health check responses
- Broken nginx proxy configuration

**Run**:
```bash
pytest tests/test_deployment_endpoints.py -v
```

**Key Tests**:
- `test_auth_*_endpoint_exists` - Verify auth endpoints return 405/401, NOT 404
- `test_health_*` - Verify health endpoints match spec
- `test_all_critical_endpoints_accessible` - Overall deployment check

### 4. Deployment Verification Script
Standalone script for production verification.

**Location**: `deploy/verify-deployment.sh`

**Usage**:
```bash
# Test locally
./deploy/verify-deployment.sh http://localhost:8000

# Test production
./deploy/verify-deployment.sh https://thunderbird.bot

# Use in CI/CD
if ! ./deploy/verify-deployment.sh $DEPLOY_URL; then
    echo "Deployment verification failed!"
    exit 1
fi
```

**What It Tests**:
- All critical endpoints return expected status codes
- Auth endpoints exist (not 404)
- Beta apply accepts both country codes and full names
- Health check returns proper structure

## Running Tests

### Run All Tests
```bash
pytest tests/ -v
```

### Run Specific Test Categories
```bash
# Country code tests
pytest tests/test_beta_country_codes.py -v

# Deployment verification tests
pytest tests/test_deployment_endpoints.py -v

# Auth tests
pytest tests/test_auth.py -v

# Integration tests
pytest tests/test_api_integration.py -v
```

### Run Tests with Coverage
```bash
pytest tests/ --cov=app --cov-report=html
open htmlcov/index.html
```

### Run Tests in Parallel
```bash
pytest tests/ -n auto
```

## Test Database Setup

Tests use a separate test database to avoid affecting production data.

**Configuration**: Tests automatically create a test database in `conftest.py`

**Reset Test Database**:
```bash
rm -f test_thunderbird.db
pytest tests/
```

## CI/CD Integration

### Pre-Deployment Checklist

Before deploying to production, run:

```bash
# 1. Run all tests
pytest tests/ -v

# 2. Verify local deployment
./deploy/verify-deployment.sh http://localhost:8000

# 3. Check code quality (if using)
black app/ tests/
flake8 app/ tests/
```

### GitHub Actions Example

```yaml
name: Test and Deploy

on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.9'

      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
          pip install pytest pytest-cov

      - name: Run unit tests
        run: |
          cd backend
          pytest tests/ -v --cov=app

      - name: Start server
        run: |
          cd backend
          uvicorn app.main:app --host 0.0.0.0 --port 8000 &
          sleep 5

      - name: Verify deployment
        run: |
          cd backend
          ./deploy/verify-deployment.sh http://localhost:8000

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to production
        run: |
          ssh user@server './deploy/update-and-verify.sh'
```

## Test Coverage Goals

| Component | Target Coverage | Priority |
|-----------|----------------|----------|
| Auth endpoints | 100% | Critical |
| Beta apply | 100% | Critical |
| Health checks | 100% | Critical |
| Route library | 90% | High |
| Weather API | 80% | High |
| Formatting | 90% | High |
| SMS commands | 85% | Medium |

## Common Test Failures

### 1. Auth Endpoints Return 404

**Symptom**: `test_auth_*_endpoint_exists` fails

**Cause**: Auth router not included in `app/main.py`

**Fix**:
```python
# In app/main.py
from app.routers import auth
app.include_router(auth.router)
```

### 2. Country Code Validation Fails

**Symptom**: `test_beta_apply_with_country_code_*` fails

**Cause**: Country normalization not applied

**Fix**: Ensure `normalize_country()` is called before validation in `app/routers/beta.py`

### 3. Health Check Service Mismatch

**Symptom**: `test_health_services_structure` fails

**Cause**: Health endpoint returns different services than spec

**Fix**: Update `app/routers/api.py` to return: database, redis, bom_api, twilio

### 4. Missing Database Tables

**Symptom**: `sqlite3.OperationalError: no such table`

**Cause**: Test database not initialized

**Fix**:
```bash
# Initialize test database
python scripts/init_db.py --db test_thunderbird.db

# Or let pytest auto-create it via conftest.py
pytest tests/ --tb=short
```

## Test Maintenance

### Adding New Tests

1. **Create test file**: `tests/test_feature.py`
2. **Follow naming convention**: `test_*` for files, `Test*` for classes, `test_*` for methods
3. **Use fixtures**: Define in `conftest.py` for reusability
4. **Document**: Add docstrings explaining what bug/issue the test prevents

Example:
```python
def test_new_endpoint_exists(client):
    """
    Verify new endpoint is accessible.

    This test catches deployment issues where the endpoint
    exists in code but returns 404 in production due to
    missing router inclusion.
    """
    response = client.get("/api/new-endpoint")
    assert response.status_code != 404
```

### Updating Tests After Spec Changes

When the spec changes:

1. Update relevant test files
2. Update deployment verification script
3. Run full test suite
4. Update this guide if needed

## Test Data

### Test Accounts

Tests create unique accounts using timestamps to avoid conflicts:
```python
email = f"test-{int(time.time())}@example.com"
```

### Test Routes

Tests use predefined routes like `western_arthurs_full` that exist in route data.

### Cleanup

Tests automatically clean up after themselves using fixtures and teardown methods.

## Troubleshooting Tests

### Tests Hang

Check for:
- Infinite loops
- Deadlocks
- External API timeouts (use mocks)

### Flaky Tests

Common causes:
- Race conditions
- Timing dependencies
- External service availability
- Database state not reset

Fix:
- Use fixtures for clean state
- Mock external services
- Add retries for network tests
- Use deterministic test data

### Can't Import Modules

Ensure PYTHONPATH includes backend:
```bash
export PYTHONPATH=/path/to/thunderbird-web/backend:$PYTHONPATH
pytest tests/
```

## Monitoring in Production

Set up automated testing in production:

```bash
# Add to crontab
*/30 * * * * /root/thunderbird-web/backend/deploy/verify-deployment.sh https://thunderbird.bot > /dev/null || mail -s "Thunderbird Health Check Failed" admin@example.com
```

## Resources

- pytest documentation: https://docs.pytest.org/
- FastAPI testing: https://fastapi.tiangolo.com/tutorial/testing/
- SQLite testing: https://www.sqlite.org/testing.html
