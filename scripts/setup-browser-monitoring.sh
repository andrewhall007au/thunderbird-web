#!/bin/bash
# Setup script for browser-based continuous monitoring on production server
# Run this on the production server to enable browser checks every 10 minutes

set -e

echo "=== Browser Monitoring Setup for Thunderbird Web ==="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
   echo "Please run as root (or use sudo)"
   exit 1
fi

cd /root/thunderbird-web

# Step 1: Install Node.js if not present
echo "Step 1: Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    echo "Node.js already installed: $(node --version)"
fi

# Step 2: Install frontend dependencies and Playwright
echo ""
echo "Step 2: Installing Playwright for frontend..."
npm install
npx playwright install chromium --with-deps

# Step 3: Install Python Playwright library
echo ""
echo "Step 3: Installing Python Playwright library..."
cd backend
source venv/bin/activate
pip install playwright
playwright install chromium

# Step 4: Test browser checks work
echo ""
echo "Step 4: Testing browser checks..."
python -m monitoring.checks_browser || echo "Note: Browser checks test failed - will configure anyway"

# Step 5: Backup current scheduler
echo ""
echo "Step 5: Backing up scheduler.py..."
cp monitoring/scheduler.py monitoring/scheduler.py.backup

# Step 6: Add browser checks to scheduler
echo ""
echo "Step 6: Adding browser checks to scheduler..."

# Create the browser check job function
cat > /tmp/browser_check_job.py << 'PYTHON_CODE'

def run_browser_checks_job():
    """Run browser-based synthetic monitoring."""
    try:
        import asyncio
        from .checks_browser import run_all_browser_checks

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        results = loop.run_until_complete(
            run_all_browser_checks(settings.MONITOR_PRODUCTION_URL)
        )

        alert_mgr = get_or_create_alert_manager()

        # Check each result
        for check_result in results["checks"]:
            if not check_result["success"]:
                logger.error(f"Browser check failed: {check_result}")
                # Create CheckResult for alerting
                from .storage import CheckResult
                result = CheckResult(
                    check_name=check_result["check"],
                    status="fail",
                    duration_ms=check_result.get("duration_ms", 0),
                    error_message=check_result.get("error"),
                    details=check_result.get("details", {})
                )
                loop.run_until_complete(alert_mgr.evaluate_and_alert(result))

        loop.close()
    except Exception as e:
        logger.error(f"Browser checks failed: {e}")

PYTHON_CODE

# Add scheduler job
cat > /tmp/browser_scheduler_job.py << 'PYTHON_CODE'

    # Browser-based synthetic monitoring (every 10 minutes)
    scheduler.add_job(
        run_browser_checks_job,
        IntervalTrigger(minutes=10),
        id="browser_checks",
        name="Browser-Based Synthetic Checks",
        max_instances=1,
        replace_existing=True,
    )

PYTHON_CODE

echo "Please manually add the browser check job to monitoring/scheduler.py"
echo "1. Add the run_browser_checks_job() function after line 260"
echo "2. Add the scheduler.add_job() call around line 350"
echo ""
echo "Or run this to automatically append (review before using):"
echo "cat /tmp/browser_check_job.py >> monitoring/scheduler.py"
echo "cat /tmp/browser_scheduler_job.py >> monitoring/scheduler.py"

# Step 7: Restart monitoring service
echo ""
read -p "Do you want to restart the monitoring service now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Restarting thunderbird-monitoring..."
    systemctl restart thunderbird-monitoring
    sleep 5

    # Step 8: Verify
    echo ""
    echo "Step 8: Verifying browser checks are running..."
    journalctl -u thunderbird-monitoring --since "2 minutes ago" | grep -i browser || echo "No browser check logs yet (wait 10 minutes)"

    echo ""
    echo "✅ Setup complete!"
    echo ""
    echo "Monitor logs with:"
    echo "  journalctl -u thunderbird-monitoring -f | grep -i browser"
    echo ""
    echo "Check monitoring status:"
    echo "  curl http://localhost:8001/api/monitoring/status | jq"
else
    echo ""
    echo "Setup complete! Remember to restart monitoring service:"
    echo "  systemctl restart thunderbird-monitoring"
fi
