#!/bin/bash
# Thunderbird Full Stack Deployment
# Run this on a fresh Ubuntu 24.04 droplet (or existing Thunderbird droplet)
# Deploys: Next.js frontend + FastAPI backend

set -e

echo "=========================================="
echo "Thunderbird Full Stack Setup"
echo "=========================================="

DOMAIN="${1:-thunderbird.bot}"

# Update system
echo "[1/9] Updating system..."
apt update && apt upgrade -y

# Install dependencies
echo "[2/9] Installing dependencies..."
apt install -y python3 python3-pip python3-venv git nginx certbot python3-certbot-nginx curl

# Install Node.js 20.x
echo "[3/9] Installing Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi
node --version
npm --version

# Create service user (non-root)
echo "[4/10] Creating service user..."
if ! id -u thunderbird &>/dev/null; then
    useradd --system --create-home --shell /usr/sbin/nologin thunderbird
fi

# Clone/update repo
echo "[5/10] Setting up application..."
APP_DIR="/opt/thunderbird-web"
if [ -d "$APP_DIR" ]; then
    cd "$APP_DIR"
    git pull
else
    git clone https://github.com/andrewhall007au/thunderbird-web.git "$APP_DIR"
    cd "$APP_DIR"
fi
chown -R thunderbird:thunderbird "$APP_DIR"

# Setup Python backend
echo "[6/10] Setting up Python backend..."
cd "$APP_DIR/backend"
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Create backend .env if needed
if [ ! -f .env ]; then
    echo "[!] Creating backend .env - YOU MUST EDIT THIS!"
    cat > .env << 'EOF'
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890

# App Configuration
APP_ENV=production
LOG_LEVEL=INFO
JWT_SECRET=change-this-to-a-secure-random-string

# Stripe (optional)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
EOF
fi

# Build Next.js frontend
echo "[7/10] Building Next.js frontend..."
cd "$APP_DIR"
npm ci
NEXT_PUBLIC_API_URL=https://${DOMAIN}/api npm run build

# Install systemd services
echo "[8/10] Installing systemd services..."

# Backend service (runs as unprivileged thunderbird user)
cat > /etc/systemd/system/thunderbird-api.service << EOF
[Unit]
Description=Thunderbird API (FastAPI)
After=network.target

[Service]
Type=simple
User=thunderbird
Group=thunderbird
WorkingDirectory=${APP_DIR}/backend
Environment="PATH=${APP_DIR}/backend/venv/bin"
Environment="THUNDERBIRD_DB_PATH=${APP_DIR}/backend/thunderbird.db"
Environment="TZ=Australia/Hobart"
EnvironmentFile=${APP_DIR}/backend/.env
ExecStart=${APP_DIR}/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Frontend service (runs as unprivileged thunderbird user)
cat > /etc/systemd/system/thunderbird-web.service << EOF
[Unit]
Description=Thunderbird Web (Next.js)
After=network.target

[Service]
Type=simple
User=thunderbird
Group=thunderbird
WorkingDirectory=${APP_DIR}
Environment="NODE_ENV=production"
Environment="PORT=3000"
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Set secure permissions on database and .env
chmod 600 "${APP_DIR}/backend/thunderbird.db" 2>/dev/null || true
chmod 600 "${APP_DIR}/backend/.env" 2>/dev/null || true
chown thunderbird:thunderbird "${APP_DIR}/backend/thunderbird.db" 2>/dev/null || true
chown thunderbird:thunderbird "${APP_DIR}/backend/.env" 2>/dev/null || true

systemctl daemon-reload
systemctl enable thunderbird-api thunderbird-web
systemctl restart thunderbird-api thunderbird-web

# Configure nginx
echo "[9/10] Configuring nginx..."
cat > /etc/nginx/sites-available/thunderbird << EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    # Frontend (Next.js)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Auth endpoints
    location /auth/ {
        proxy_pass http://127.0.0.1:8000/auth/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Webhook (Twilio)
    location /webhook {
        proxy_pass http://127.0.0.1:8000/webhook;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:8000/health;
    }
}
EOF

ln -sf /etc/nginx/sites-available/thunderbird /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# Firewall
echo "[10/10] Configuring firewall..."
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
echo "1. Edit /root/thunderbird-web/backend/.env with your credentials"
echo "2. Restart services: systemctl restart thunderbird-api thunderbird-web"
echo "3. Setup SSL: certbot --nginx -d ${DOMAIN}"
echo ""
echo "Check status:"
echo "  systemctl status thunderbird-api"
echo "  systemctl status thunderbird-web"
echo ""
echo "View logs:"
echo "  journalctl -u thunderbird-api -f"
echo "  journalctl -u thunderbird-web -f"
echo ""
echo "Your server: http://$(curl -s ifconfig.me)"
echo ""
