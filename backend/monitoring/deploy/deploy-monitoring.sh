#!/bin/bash
# Deploy Monitoring System to Production
# Run this script ON THE PRODUCTION SERVER as root
# Or run remotely: ssh root@thunderbird.bot 'bash -s' < deploy-monitoring.sh

set -e

echo "=========================================="
echo "Deploying Thunderbird Monitoring Service"
echo "=========================================="

PROJECT_DIR="/root/thunderbird-web"
VENV_DIR="$PROJECT_DIR/backend/venv"

# Check we're in the right place
if [ ! -d "$PROJECT_DIR" ]; then
    echo "ERROR: Project directory not found: $PROJECT_DIR"
    echo "Are you running this on the production server?"
    exit 1
fi

cd $PROJECT_DIR

# 1. Pull latest code
echo "[1/7] Pulling latest code..."
git pull origin main

# 2. Install monitoring Python dependencies
echo "[2/7] Installing monitoring dependencies..."
$VENV_DIR/bin/pip install -r $PROJECT_DIR/backend/monitoring/requirements.txt

# 3. Install Playwright for synthetic checks
echo "[3/7] Installing Playwright..."
if command -v npx &> /dev/null; then
    npx playwright install chromium --with-deps
    echo "Playwright installed successfully"
else
    echo "Warning: npx not found, skipping Playwright install"
    echo "Synthetic browser tests will be disabled"
fi

# 4. Initialize monitoring database
echo "[4/7] Initializing monitoring database..."
cd $PROJECT_DIR/backend
$VENV_DIR/bin/python -c "from monitoring.storage import init_db; init_db(); print('✓ Database initialized')"

# 5. Create/update environment file
echo "[5/7] Configuring environment..."
ENV_FILE="/etc/default/thunderbird-monitoring"

if [ ! -f "$ENV_FILE" ]; then
    cat > $ENV_FILE << 'ENVEOF'
# Thunderbird Monitoring Configuration
# EDIT THIS FILE with real phone numbers and email addresses

MONITOR_PRODUCTION_URL=https://thunderbird.bot
MONITOR_ALERT_PHONE_NUMBERS=+61468092783
MONITOR_ALERT_EMAIL_ADDRESSES=admin@thunderbird.bot

# Synthetic test credentials (created via setup-test-account.sh)
# MONITOR_TEST_EMAIL=monitor@thunderbird.bot
# MONITOR_TEST_PASSWORD=<generated-password>
# MONITOR_TEST_PHONE=+1234567890

# Copy these from the main app .env file
# TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
# TWILIO_AUTH_TOKEN=xxxxxxxxxxxxx
# TWILIO_PHONE_NUMBER=+18662801940
# RESEND_API_KEY=re_xxx
# STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx
ENVEOF
    echo "Created $ENV_FILE"
    echo "⚠️  IMPORTANT: Edit $ENV_FILE with real values before starting service"
    NEEDS_CONFIG=true
else
    echo "Using existing $ENV_FILE"
    NEEDS_CONFIG=false
fi

# 6. Install and enable systemd service
echo "[6/7] Installing systemd service..."

# Update service file to use correct paths
cat > /etc/systemd/system/thunderbird-monitoring.service << 'SERVICEEOF'
[Unit]
Description=Thunderbird Monitoring Service
After=network.target
Wants=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/thunderbird-web/backend
Environment=PYTHONPATH=/root/thunderbird-web/backend
ExecStart=/root/thunderbird-web/backend/venv/bin/python -m monitoring.main
Restart=always
RestartSec=10
StandardOutput=append:/var/log/thunderbird-monitoring.log
StandardError=append:/var/log/thunderbird-monitoring.log

# Environment variables
EnvironmentFile=-/etc/default/thunderbird-monitoring

[Install]
WantedBy=multi-user.target
SERVICEEOF

systemctl daemon-reload
systemctl enable thunderbird-monitoring

# 7. Start/restart service
echo "[7/7] Starting monitoring service..."
systemctl restart thunderbird-monitoring

# Wait a moment for service to start
sleep 3

# Verify service is running
echo ""
echo "=========================================="
if systemctl is-active --quiet thunderbird-monitoring; then
    echo "✓ Monitoring service deployed successfully!"
    echo "=========================================="
    echo ""

    # Show service status
    systemctl status thunderbird-monitoring --no-pager -l

    echo ""
    echo "Verify health:"
    echo "  curl http://localhost:8001/health"
    echo ""

    # Test health endpoint
    if curl -sf http://localhost:8001/health > /dev/null; then
        echo "✓ Health check passed"
    else
        echo "⚠️  Health check failed (service may still be starting)"
    fi

    echo ""
    echo "Next steps:"
    if [ "$NEEDS_CONFIG" = true ]; then
        echo "  1. Edit $ENV_FILE with real phone/email/credentials"
        echo "  2. systemctl restart thunderbird-monitoring"
        echo "  3. Test alerts (see DEPLOYMENT_MONITORING.md)"
    fi
    echo "  - View logs: journalctl -u thunderbird-monitoring -f"
    echo "  - Dashboard: https://thunderbird.bot/monitoring"
    echo "  - API: http://localhost:8001/api/monitoring/status"

else
    echo "❌ ERROR: Monitoring service failed to start"
    echo "=========================================="
    echo ""
    echo "Check logs:"
    echo "  journalctl -u thunderbird-monitoring -n 50"
    echo ""
    systemctl status thunderbird-monitoring --no-pager -l || true
    exit 1
fi

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
