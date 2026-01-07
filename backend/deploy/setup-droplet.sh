#!/bin/bash
# Thunderbird Droplet Setup Script
# Run this on a fresh Ubuntu 24.04 droplet

set -e

echo "=========================================="
echo "Thunderbird Weather SMS - Droplet Setup"
echo "=========================================="

# Update system
echo "[1/7] Updating system..."
apt update && apt upgrade -y

# Install dependencies
echo "[2/7] Installing dependencies..."
apt install -y python3 python3-pip python3-venv git nginx certbot python3-certbot-nginx

# Clone repo (or pull if exists)
echo "[3/7] Setting up application..."
cd /root
if [ -d "thunderbird-web" ]; then
    cd thunderbird-web
    git pull
else
    git clone https://github.com/andrewhall007au/thunderbird-web.git
    cd thunderbird-web
fi

# Setup Python environment
echo "[4/7] Setting up Python environment..."
cd backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "[!] Creating .env file - YOU MUST EDIT THIS!"
    cat > .env << 'EOF'
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890

# App Configuration
APP_ENV=production
LOG_LEVEL=INFO
EOF
    echo "[!] IMPORTANT: Edit /root/thunderbird-web/backend/.env with your Twilio credentials!"
fi

# Install systemd service
echo "[5/7] Installing systemd service..."
cp deploy/thunderbird.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable thunderbird
systemctl start thunderbird

# Setup nginx reverse proxy
echo "[6/7] Configuring nginx..."
cat > /etc/nginx/sites-available/thunderbird << 'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

ln -sf /etc/nginx/sites-available/thunderbird /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# Setup firewall
echo "[7/7] Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "NEXT STEPS:"
echo "1. Edit /root/thunderbird-web/backend/.env with your Twilio credentials"
echo "2. Restart the service: systemctl restart thunderbird"
echo "3. Check status: systemctl status thunderbird"
echo "4. View logs: journalctl -u thunderbird -f"
echo ""
echo "Your server is running at: http://$(curl -s ifconfig.me)"
echo ""
echo "For HTTPS, run: certbot --nginx -d yourdomain.com"
echo ""
