#!/bin/bash
# Update and Verify Deployment
# Pulls latest code, restarts services, and verifies deployment

set -e

echo "=========================================="
echo "Thunderbird Update & Verification"
echo "=========================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run as root${NC}"
    exit 1
fi

# Navigate to repo
cd /root/thunderbird-web

# Backup current version
echo -e "${YELLOW}[1/5]${NC} Creating backup..."
BACKUP_DIR="/root/thunderbird-backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r backend/thunderbird.db "$BACKUP_DIR/" 2>/dev/null || echo "No database to backup"

# Pull latest code
echo -e "${YELLOW}[2/5]${NC} Pulling latest code..."
git fetch origin
CURRENT_COMMIT=$(git rev-parse HEAD)
git pull origin main

NEW_COMMIT=$(git rev-parse HEAD)
if [ "$CURRENT_COMMIT" = "$NEW_COMMIT" ]; then
    echo "No updates available (already at latest commit)"
else
    echo "Updated from $CURRENT_COMMIT to $NEW_COMMIT"
fi

# Update backend dependencies
echo -e "${YELLOW}[3/5]${NC} Updating backend dependencies..."
cd /root/thunderbird-web/backend
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Restart services
echo -e "${YELLOW}[4/5]${NC} Restarting services..."
systemctl restart thunderbird-api
sleep 3

# Check service status
if systemctl is-active --quiet thunderbird-api; then
    echo -e "${GREEN}✓${NC} thunderbird-api is running"
else
    echo -e "${RED}✗${NC} thunderbird-api failed to start!"
    echo "Checking logs:"
    journalctl -u thunderbird-api -n 20 --no-pager
    exit 1
fi

# Run verification
echo -e "${YELLOW}[5/5]${NC} Running deployment verification..."
echo ""

# Test locally first (direct to backend)
if /root/thunderbird-web/backend/deploy/verify-deployment.sh http://localhost:8000; then
    echo ""
    echo -e "${GREEN}✓${NC} Backend direct tests: PASSED"
else
    echo ""
    echo -e "${RED}✗${NC} Backend direct tests: FAILED"
    exit 1
fi

# Test through nginx if available
if command -v nginx &> /dev/null && systemctl is-active --quiet nginx; then
    echo ""
    echo "Testing through nginx proxy..."
    DOMAIN=$(grep -oP 'server_name \K[^ ;]+' /etc/nginx/sites-available/thunderbird 2>/dev/null | head -1)

    if [ -n "$DOMAIN" ]; then
        if /root/thunderbird-web/backend/deploy/verify-deployment.sh "https://$DOMAIN"; then
            echo -e "${GREEN}✓${NC} Nginx proxy tests: PASSED"
        else
            echo -e "${YELLOW}⚠${NC} Nginx proxy tests: FAILED (check SSL/DNS)"
        fi
    fi
fi

echo ""
echo "=========================================="
echo -e "${GREEN}Update Complete!${NC}"
echo "=========================================="
echo ""
echo "Commit: $NEW_COMMIT"
echo "Backup: $BACKUP_DIR"
echo ""
echo "View logs:"
echo "  journalctl -u thunderbird-api -f"
echo ""
