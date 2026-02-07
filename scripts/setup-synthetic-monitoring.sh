#!/bin/bash
# Setup script for synthetic monitoring on production server
# Run this on: root@thunderbird.bot:/root/thunderbird-web/

set -e  # Exit on error

echo "=== Thunderbird Synthetic Monitoring Setup ==="
echo ""

# Check we're in the right directory
if [ ! -f "backend/monitoring/checks_synthetic.py" ]; then
    echo "ERROR: Must run from /root/thunderbird-web/ directory"
    exit 1
fi

echo "Step 1/4: Installing Playwright..."
npm install -D @playwright/test

echo ""
echo "Step 2/4: Installing Chromium browser with system dependencies..."
echo "This may take a few minutes and will install system packages..."
npx playwright install chromium --with-deps

echo ""
echo "Step 3/4: Verifying installation..."
if npx playwright --version > /dev/null 2>&1; then
    echo "✅ Playwright installed successfully: $(npx playwright --version)"
else
    echo "❌ Playwright installation failed"
    exit 1
fi

echo ""
echo "Step 4/4: Checking environment variables..."
if grep -q "MONITOR_TEST_EMAIL" backend/.env 2>/dev/null; then
    echo "✅ MONITOR_TEST_EMAIL found in .env"
else
    echo "⚠️  MONITOR_TEST_EMAIL not found in backend/.env"
    echo ""
    echo "Add the following to backend/.env:"
    echo ""
    echo "MONITOR_TEST_EMAIL=\"monitoring-test@thunderbird.app\""
    echo "MONITOR_TEST_PASSWORD=\"<your-secure-password>\""
    echo "MONITOR_TEST_PHONE=\"+15555551234\""
    echo ""
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. If credentials not set, add them to backend/.env (see above)"
echo "2. Restart monitoring: systemctl restart thunderbird-monitoring"
echo "3. Wait 5-10 minutes for checks to run"
echo "4. Verify: See .planning/MONITORING_SYNTHETIC_SETUP.md"
echo ""
