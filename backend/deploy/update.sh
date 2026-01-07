#!/bin/bash
# Thunderbird Update Script
# Run this to pull latest changes and restart

set -e

echo "Updating Thunderbird..."

cd /root/thunderbird-web

# Pull latest
git pull

# Update dependencies
cd backend
source venv/bin/activate
pip install -r requirements.txt

# Restart service
systemctl restart thunderbird

echo "Update complete!"
echo "Check status: systemctl status thunderbird"
echo "View logs: journalctl -u thunderbird -f"
