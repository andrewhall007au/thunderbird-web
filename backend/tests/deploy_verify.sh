#!/bin/bash
#
# V3.0 Deployment Verification Script
#
# This script runs ALL verification steps in order:
# 1. Local unit tests
# 2. Local integration tests
# 3. Format validation tests
# 4. Server staging tests (if staging URL provided)
# 5. Server smoke tests (after deployment)
#
# Usage:
#   ./deploy_verify.sh                    # Run local tests only
#   ./deploy_verify.sh --staging URL      # Run with staging server
#   ./deploy_verify.sh --production URL   # Run post-deployment tests
#
# Exit codes:
#   0 = All tests passed, safe to deploy
#   1 = Tests failed, DO NOT deploy

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
STAGING_URL=""
PRODUCTION_URL=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --staging)
            STAGING_URL="$2"
            shift 2
            ;;
        --production)
            PRODUCTION_URL="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Functions
print_header() {
    echo ""
    echo "================================================================"
    echo -e "${YELLOW}$1${NC}"
    echo "================================================================"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

run_tests() {
    local test_name="$1"
    local test_command="$2"
    
    echo ""
    echo "Running: $test_name"
    echo "Command: $test_command"
    echo ""
    
    if eval "$test_command"; then
        print_success "$test_name PASSED"
        return 0
    else
        print_error "$test_name FAILED"
        return 1
    fi
}

# ============================================================================
# PHASE 1: Local Unit Tests
# ============================================================================

print_header "PHASE 1: Local Unit Tests"

cd "$BACKEND_DIR"

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Install test dependencies
pip install -q pytest pytest-asyncio

# Run v3.0 specific tests
PHASE1_FAILED=0

run_tests "V3.0 CAST Commands" \
    "python -m pytest tests/test_v3_cast_commands.py -v --tb=short" || PHASE1_FAILED=1

run_tests "V3.0 Format Changes" \
    "python -m pytest tests/test_v3_format_changes.py -v --tb=short" || PHASE1_FAILED=1

run_tests "V3.0 CHECKIN & Onboarding" \
    "python -m pytest tests/test_v3_checkin_onboarding.py -v --tb=short" || PHASE1_FAILED=1

run_tests "V3.0 Pricing" \
    "python -m pytest tests/test_v3_pricing.py -v --tb=short" || PHASE1_FAILED=1

if [ $PHASE1_FAILED -eq 1 ]; then
    print_error "PHASE 1 FAILED - Fix unit tests before proceeding"
    exit 1
fi

print_success "PHASE 1 COMPLETE - All unit tests passed"

# ============================================================================
# PHASE 2: Local Integration Tests
# ============================================================================

print_header "PHASE 2: Local Integration Tests"

PHASE2_FAILED=0

run_tests "Integration Tests" \
    "python -m pytest tests/test_integration.py -v --tb=short" || PHASE2_FAILED=1

run_tests "Service Tests" \
    "python -m pytest tests/test_services.py -v --tb=short" || PHASE2_FAILED=1

run_tests "Validation Tests" \
    "python -m pytest tests/test_validation.py -v --tb=short" || PHASE2_FAILED=1

if [ $PHASE2_FAILED -eq 1 ]; then
    print_error "PHASE 2 FAILED - Fix integration tests before proceeding"
    exit 1
fi

print_success "PHASE 2 COMPLETE - All integration tests passed"

# ============================================================================
# PHASE 3: Spec Alignment Tests
# ============================================================================

print_header "PHASE 3: Spec Alignment Tests"

PHASE3_FAILED=0

run_tests "Spec Alignment" \
    "python -m pytest tests/test_spec_alignment.py -v --tb=short" || PHASE3_FAILED=1

if [ $PHASE3_FAILED -eq 1 ]; then
    print_error "PHASE 3 FAILED - Code doesn't match spec"
    exit 1
fi

print_success "PHASE 3 COMPLETE - Code matches spec"

# ============================================================================
# PHASE 4: Staging Server Tests (Optional)
# ============================================================================

if [ -n "$STAGING_URL" ]; then
    print_header "PHASE 4: Staging Server Tests"
    
    echo "Staging URL: $STAGING_URL"
    
    PHASE4_FAILED=0
    
    run_tests "Staging Smoke Tests" \
        "python tests/smoke_test_server.py --url $STAGING_URL" || PHASE4_FAILED=1
    
    if [ $PHASE4_FAILED -eq 1 ]; then
        print_error "PHASE 4 FAILED - Staging server tests failed"
        exit 1
    fi
    
    print_success "PHASE 4 COMPLETE - Staging server tests passed"
else
    echo ""
    echo "Skipping PHASE 4 - No staging URL provided"
    echo "To run staging tests: $0 --staging http://localhost:8001"
fi

# ============================================================================
# PHASE 5: Production Server Tests (Post-Deployment)
# ============================================================================

if [ -n "$PRODUCTION_URL" ]; then
    print_header "PHASE 5: Production Server Tests"
    
    echo "Production URL: $PRODUCTION_URL"
    
    PHASE5_FAILED=0
    
    run_tests "Production Smoke Tests" \
        "python tests/smoke_test_server.py --url $PRODUCTION_URL" || PHASE5_FAILED=1
    
    if [ $PHASE5_FAILED -eq 1 ]; then
        print_error "PHASE 5 FAILED - Production server tests failed"
        print_error "ROLLBACK MAY BE REQUIRED"
        exit 1
    fi
    
    print_success "PHASE 5 COMPLETE - Production server tests passed"
else
    echo ""
    echo "Skipping PHASE 5 - No production URL provided"
    echo "After deployment, run: $0 --production https://api.thunderbird.app"
fi

# ============================================================================
# SUMMARY
# ============================================================================

print_header "DEPLOYMENT VERIFICATION COMPLETE"

echo ""
echo "All local tests passed. Ready to deploy."
echo ""
echo "Recommended deployment sequence:"
echo "  1. Deploy to staging server"
echo "  2. Run: $0 --staging YOUR_STAGING_URL"
echo "  3. Deploy to production server"
echo "  4. Run: $0 --production YOUR_PRODUCTION_URL"
echo "  5. Run LIVETEST from phone: @ LIVETEST"
echo ""

print_success "VERIFICATION PASSED"
exit 0
