#!/bin/bash
# Setup Thunderbird Monitoring Service on production
# Run as root on the production server

set -e

echo "=== Thunderbird Monitoring Setup ==="

PROJECT_DIR="/root/overland-weather"
VENV_DIR="$PROJECT_DIR/venv"

# 1. Install Python dependencies
echo "Installing monitoring dependencies..."
$VENV_DIR/bin/pip install -r $PROJECT_DIR/backend/monitoring/requirements.txt

# 2. Install Playwright (for synthetic checks)
echo "Installing Playwright..."
cd $PROJECT_DIR
npx playwright install chromium --with-deps

# 3. Create environment file
echo "Creating environment config..."
if [ ! -f /etc/default/thunderbird-monitoring ]; then
    cat > /etc/default/thunderbird-monitoring << 'ENVEOF'
# Thunderbird Monitoring Configuration
# Edit phone numbers and email addresses for alerts

MONITOR_PRODUCTION_URL=https://thunderbird.bot
MONITOR_ALERT_PHONE_NUMBERS=+61XXXXXXXXX
MONITOR_ALERT_EMAIL_ADDRESSES=admin@thunderbird.bot

# These should match the main app's .env
# TWILIO_ACCOUNT_SID=xxx
# TWILIO_AUTH_TOKEN=xxx
# TWILIO_PHONE_NUMBER=xxx
# RESEND_API_KEY=xxx
ENVEOF
    echo "Created /etc/default/thunderbird-monitoring - EDIT THIS FILE with real values"
fi

# 4. Initialize monitoring database
echo "Initializing monitoring database..."
cd $PROJECT_DIR/backend
$VENV_DIR/bin/python -c "from monitoring.storage import init_db; init_db(); print('Database initialized')"

# 5. Install and enable systemd service
echo "Installing systemd service..."
cp $PROJECT_DIR/backend/monitoring/deploy/monitoring.service /etc/systemd/system/thunderbird-monitoring.service
systemctl daemon-reload
systemctl enable thunderbird-monitoring
systemctl start thunderbird-monitoring

# 6. Verify service is running
sleep 3
if systemctl is-active --quiet thunderbird-monitoring; then
    echo "Monitoring service started successfully!"
    echo "Check status: systemctl status thunderbird-monitoring"
    echo "View logs: journalctl -u thunderbird-monitoring -f"
    echo "Dashboard: https://thunderbird.bot/monitoring"
else
    echo "ERROR: Monitoring service failed to start"
    echo "Check logs: journalctl -u thunderbird-monitoring -n 50"
    exit 1
fi

# 7. Disable old cron-based quick_monitor if it exists
if crontab -l 2>/dev/null | grep -q "quick_monitor"; then
    echo "Note: Old quick_monitor cron job detected. Consider removing it:"
    echo "  crontab -e  # Remove the quick_monitor line"
fi

echo ""
echo "=== Setup Complete ==="
echo "Next steps:"
echo "  1. Edit /etc/default/thunderbird-monitoring with real phone/email"
echo "  2. Verify: curl http://localhost:8001/health"
echo "  3. Optional: Register http://thunderbird.bot:8001/health with healthchecks.io"
