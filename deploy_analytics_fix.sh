#!/bin/bash
# Manual deployment script for analytics fix

echo "Deploying analytics.py fix to production..."

# Copy the file
scp -i ~/.ssh/id_rsa backend/app/routers/analytics.py root@thunderbird.bot:/root/thunderbird-web/app/routers/analytics.py

# Restart backend and clear Python cache
ssh root@thunderbird.bot << 'REMOTE'
cd /root/thunderbird-web
echo "Clearing Python cache..."
find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
find . -name "*.pyc" -delete 2>/dev/null || true
echo "Restarting backend service..."
systemctl restart thunderbird-api
sleep 5
echo "Checking service status..."
systemctl status thunderbird-api --no-pager | head -15
echo "Testing endpoint..."
curl -i -X POST http://localhost:8000/api/analytics \
  -H "Content-Type: application/json" \
  -d '{"event":"test","variant":"A","entry_path":"organic"}' 2>&1 | grep -E "HTTP|content-type"
REMOTE

echo "Deployment complete!"
