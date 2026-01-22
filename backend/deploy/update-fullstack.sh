#!/bin/bash
# Thunderbird Full Stack Update Script
# Run this to pull latest changes and restart both services

set -e

DOMAIN="${1:-thunderbird.bot}"

echo "=========================================="
echo "Updating Thunderbird Full Stack"
echo "=========================================="

cd /root/thunderbird-web

# Pull latest
echo "[1/4] Pulling latest code..."
git pull

# Update backend
echo "[2/4] Updating backend..."
cd backend
source venv/bin/activate
pip install -r requirements.txt

# Rebuild frontend
echo "[3/4] Rebuilding frontend..."
cd /root/thunderbird-web
npm ci
NEXT_PUBLIC_API_URL=https://${DOMAIN}/api npm run build

# Restart services
echo "[4/4] Restarting services..."
systemctl restart thunderbird-api thunderbird-web

echo ""
echo "=========================================="
echo "Update Complete!"
echo "=========================================="
echo ""
echo "Check status:"
echo "  systemctl status thunderbird-api"
echo "  systemctl status thunderbird-web"
echo ""
echo "View logs:"
echo "  journalctl -u thunderbird-api -f"
echo "  journalctl -u thunderbird-web -f"
echo ""
