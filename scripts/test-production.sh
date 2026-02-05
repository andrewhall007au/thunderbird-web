#!/bin/bash
#
# Test Production - Run Browser-Based Smoke Tests
#
# This script runs critical user flow tests against production using Playwright.
# Use this to manually verify production is working after deployment.
#
# Usage:
#   ./scripts/test-production.sh              # Test https://thunderbird.bot
#   ./scripts/test-production.sh <URL>        # Test custom URL
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

URL="${1:-https://thunderbird.bot}"

echo -e "${YELLOW}================================${NC}"
echo -e "${YELLOW}Production Smoke Tests${NC}"
echo -e "${YELLOW}Target: $URL${NC}"
echo -e "${YELLOW}================================${NC}"
echo ""

# Check if Playwright is installed
if ! command -v npx &> /dev/null; then
    echo -e "${RED}Error: npx not found. Please install Node.js${NC}"
    exit 1
fi

# Install Playwright browsers if needed
echo "Checking Playwright installation..."
npx playwright install chromium --with-deps > /dev/null 2>&1 || true

# Run the critical flows test
echo -e "\n${YELLOW}Running browser-based tests...${NC}\n"

if npx playwright test e2e/critical-flows.spec.ts \
    --config=e2e/production.config.ts \
    --project=chromium \
    --reporter=list; then

    echo -e "\n${GREEN}✅ All tests passed!${NC}"
    echo -e "${GREEN}Production is working correctly${NC}\n"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed!${NC}"
    echo -e "${RED}Production has issues${NC}\n"
    echo "Check test-results/ for details"
    exit 1
fi
