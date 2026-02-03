#!/bin/bash
# Deployment Verification Script
# Tests all critical endpoints to ensure they're accessible

set -e

HOST="${1:-http://localhost:8000}"
ERRORS=0

echo "=========================================="
echo "Thunderbird Deployment Verification"
echo "=========================================="
echo "Testing: $HOST"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
test_endpoint() {
    local method="$1"
    local path="$2"
    local expected_status="$3"
    local description="$4"
    local data="$5"

    printf "%-50s" "$description"

    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$HOST$path" 2>&1)
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$HOST$path" \
            -H "Content-Type: application/json" \
            -d "$data" 2>&1)
    fi

    status_code=$(echo "$response" | tail -n 1)

    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} ($status_code)"
    else
        echo -e "${RED}✗ FAIL${NC} (expected $expected_status, got $status_code)"
        ERRORS=$((ERRORS + 1))
    fi
}

echo "=== Critical Backend Endpoints ==="
echo ""

# Health check
test_endpoint "GET" "/health" "200" "Health check"

# Auth endpoints (should exist but may return 405/422 for GET without proper data)
test_endpoint "GET" "/auth/token" "405" "Auth token endpoint exists (405=method not allowed)"
test_endpoint "GET" "/auth/register" "405" "Auth register endpoint exists (405=method not allowed)"
test_endpoint "GET" "/auth/me" "401" "Auth me endpoint exists (401=unauthorized)"
test_endpoint "POST" "/auth/forgot-password" "422" "Forgot password endpoint exists (422=validation)"
test_endpoint "POST" "/auth/reset-password" "422" "Reset password endpoint exists (422=validation)"

# API endpoints
test_endpoint "GET" "/api/health" "200" "API health check"
test_endpoint "GET" "/api/library" "200" "Library endpoint"

# Beta endpoint
test_endpoint "POST" "/api/beta/apply" "422" "Beta apply endpoint exists (422=validation)"

# Test beta apply with valid data (country code)
echo ""
echo "=== Functional Tests ==="
echo ""

test_endpoint "POST" "/api/beta/apply" "200" "Beta apply with country code (AU)" \
    '{"name":"Test User","email":"test-'$(date +%s)'@example.com","country":"AU"}'

test_endpoint "POST" "/api/beta/apply" "200" "Beta apply with full name" \
    '{"name":"Test User","email":"test-'$(date +%s)'@example.com","country":"Australia"}'

# Test auth registration
test_endpoint "POST" "/auth/register" "201" "Auth registration (new user)" \
    '{"email":"test-'$(date +%s)'@example.com","password":"testpass123"}'

echo ""
echo "=========================================="
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    echo "Deployment verification: SUCCESS"
    exit 0
else
    echo -e "${RED}$ERRORS test(s) failed!${NC}"
    echo "Deployment verification: FAILED"
    exit 1
fi
