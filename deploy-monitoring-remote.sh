#!/bin/bash
# Deploy Monitoring from Local Machine
# This script runs the deployment on the remote server via SSH

set -e

SERVER="root@thunderbird.bot"

echo "=========================================="
echo "Remote Monitoring Deployment"
echo "Target: $SERVER"
echo "=========================================="
echo ""

# Check SSH access
echo "Testing SSH connection..."
if ! ssh -o ConnectTimeout=5 $SERVER "echo 'SSH connection successful'" 2>/dev/null; then
    echo "ERROR: Cannot connect to $SERVER"
    echo ""
    echo "Please ensure:"
    echo "  1. SSH key is configured"
    echo "  2. Server is accessible"
    echo "  3. You can run: ssh $SERVER"
    exit 1
fi

echo "✓ SSH connection successful"
echo ""

# Push latest code first
echo "Pushing latest code to git..."
git push origin main
echo "✓ Code pushed"
echo ""

# Run deployment on remote server
echo "Running deployment on $SERVER..."
echo ""

ssh $SERVER 'bash -s' << 'REMOTE_SCRIPT'
#!/bin/bash
set -e

PROJECT_DIR="/root/thunderbird-web"
VENV_DIR="$PROJECT_DIR/backend/venv"

echo "[Remote] Deploying monitoring service..."

cd $PROJECT_DIR

# Pull latest
echo "[1/7] Pulling latest code..."
git pull origin main

# Install deps
echo "[2/7] Installing Python dependencies..."
$VENV_DIR/bin/pip install -q -r backend/monitoring/requirements.txt

# Install Playwright
echo "[3/7] Installing Playwright..."
if command -v npx &> /dev/null; then
    npx playwright install chromium --with-deps 2>&1 | tail -5
fi

# Init DB
echo "[4/7] Initializing database..."
cd backend
$VENV_DIR/bin/python -c "from monitoring.storage import init_db; init_db()"

# Create env file
echo "[5/7] Checking environment config..."
if [ ! -f /etc/default/thunderbird-monitoring ]; then
    echo "Creating /etc/default/thunderbird-monitoring"
    cat > /etc/default/thunderbird-monitoring << 'EOF'
MONITOR_PRODUCTION_URL=https://thunderbird.bot
MONITOR_ALERT_PHONE_NUMBERS=+61468092783
MONITOR_ALERT_EMAIL_ADDRESSES=admin@thunderbird.bot
RESEND_API_KEY=re_JRfCGwt1_PxbunopDTYFrYTPdv967qjez
EOF
fi

# Install service
echo "[6/7] Installing systemd service..."
cat > /etc/systemd/system/thunderbird-monitoring.service << 'EOF'
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
EnvironmentFile=-/etc/default/thunderbird-monitoring

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable thunderbird-monitoring

# Start service
echo "[7/7] Starting service..."
systemctl restart thunderbird-monitoring
sleep 3

# Verify
if systemctl is-active --quiet thunderbird-monitoring; then
    echo ""
    echo "✓ Monitoring service deployed and running!"
    curl -sf http://localhost:8001/health && echo "✓ Health check passed"
else
    echo "❌ Service failed to start"
    journalctl -u thunderbird-monitoring -n 20 --no-pager
    exit 1
fi
REMOTE_SCRIPT

# Check deployment
echo ""
echo "=========================================="
echo "Verifying deployment..."
echo "=========================================="
echo ""

ssh $SERVER << 'VERIFY'
systemctl status thunderbird-monitoring --no-pager -l | head -15
echo ""
echo "Recent logs:"
journalctl -u thunderbird-monitoring -n 10 --no-pager
VERIFY

echo ""
echo "=========================================="
echo "✓ Deployment Complete!"
echo "=========================================="
echo ""
echo "Monitoring service is now running on thunderbird.bot"
echo ""
echo "Access points:"
echo "  - Dashboard: https://thunderbird.bot/monitoring"
echo "  - Health: https://thunderbird.bot:8001/health"
echo ""
echo "Next steps:"
echo "  1. Configure alert recipients: ssh $SERVER vim /etc/default/thunderbird-monitoring"
echo "  2. View logs: ssh $SERVER journalctl -u thunderbird-monitoring -f"
echo "  3. Test alerts (see .planning/DEPLOYMENT_MONITORING.md Step 6)"
echo ""
