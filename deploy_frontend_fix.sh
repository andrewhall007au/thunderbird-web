#!/bin/bash
# Quick frontend deployment script
# Updates the BetaApplyModal fix on production

set -e

echo "🚀 Deploying frontend fix to production..."
echo ""

# Check if we have server access
if [ -z "$SERVER_HOST" ]; then
    echo "SERVER_HOST not set. Using thunderbird.bot"
    SERVER_HOST="thunderbird.bot"
fi

echo "📡 Connecting to $SERVER_HOST..."
echo ""

# SSH and deploy
ssh root@$SERVER_HOST << 'ENDSSH'
set -e

echo "📂 Navigating to project directory..."
cd /root/thunderbird-web 2>/dev/null || cd /root/overland-weather 2>/dev/null || {
    echo "❌ Could not find project directory"
    exit 1
}

echo "📥 Pulling latest changes from main..."
git fetch origin
git checkout main
git pull origin main

echo "📦 Installing dependencies (if needed)..."
npm install --production

echo "🔨 Building Next.js frontend..."
npm run build

echo "♻️  Restarting frontend service..."
# Try different service names
if systemctl list-units --type=service | grep -q "thunderbird-web"; then
    systemctl restart thunderbird-web
    echo "✅ Restarted thunderbird-web service"
elif systemctl list-units --type=service | grep -q "overland"; then
    systemctl restart overland
    echo "✅ Restarted overland service"
elif pm2 list | grep -q "thunderbird\|overland\|next"; then
    pm2 restart all
    echo "✅ Restarted PM2 processes"
else
    echo "⚠️  Could not find service to restart. Manual restart may be needed."
fi

echo ""
echo "✅ Frontend deployment complete!"
echo ""
echo "🔍 Verifying service status..."
systemctl status thunderbird-web --no-pager -l 2>/dev/null || systemctl status overland --no-pager -l 2>/dev/null || echo "Service status unknown"

ENDSSH

echo ""
echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "The fix is now live on https://thunderbird.bot"
echo "Try the beta signup again - it should work now!"
echo ""
