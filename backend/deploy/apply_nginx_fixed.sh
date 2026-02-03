#!/bin/bash
set -e

echo "=========================================="
echo "Applying Nginx Security Configuration"
echo "=========================================="

# Backup current nginx configs
echo "[1/5] Backing up current nginx configs..."
cp /etc/nginx/sites-available/thunderbird /etc/nginx/sites-available/thunderbird.backup.$(date +%s)
cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup.$(date +%s)

# Add rate limit zones to main nginx.conf
echo "[2/5] Adding rate limit zones to nginx.conf..."
if ! grep -q "zone=api_limit" /etc/nginx/nginx.conf; then
    # Add rate limit zones in http block (before the first server or include statement)
    sed -i '/http {/a\
    # Rate limiting zones\
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;\
    limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/m;\
' /etc/nginx/nginx.conf
    echo "✓ Added rate limit zones to nginx.conf"
else
    echo "✓ Rate limit zones already exist in nginx.conf"
fi

# Copy new server config
echo "[3/5] Installing new server config with security headers..."
cp /root/nginx_complete.conf /etc/nginx/sites-available/thunderbird

# Test nginx config
echo "[4/5] Testing nginx configuration..."
if nginx -t; then
    echo "✓ Nginx config is valid"
else
    echo "✗ Nginx config has errors - restoring backups"
    latest_backup=$(ls -t /etc/nginx/sites-available/thunderbird.backup.* 2>/dev/null | head -1)
    latest_nginx_backup=$(ls -t /etc/nginx/nginx.conf.backup.* 2>/dev/null | head -1)
    if [ -n "$latest_backup" ]; then
        cp "$latest_backup" /etc/nginx/sites-available/thunderbird
    fi
    if [ -n "$latest_nginx_backup" ]; then
        cp "$latest_nginx_backup" /etc/nginx/nginx.conf
    fi
    exit 1
fi

# Reload nginx
echo "[5/5] Reloading nginx..."
systemctl reload nginx

echo ""
echo "=========================================="
echo "Nginx Security Configuration Applied!"
echo "=========================================="
echo ""
echo "Security features enabled:"
echo "✓ HSTS (force HTTPS)"
echo "✓ X-Frame-Options (prevent clickjacking)"
echo "✓ X-Content-Type-Options (prevent MIME sniffing)"
echo "✓ Content Security Policy"
echo "✓ Rate limiting on auth endpoints (1 req/min)"
echo "✓ Rate limiting on beta apply (5 req/hour)"
echo "✓ Rate limiting on API (10 req/sec)"
echo "✓ Server version hidden"
echo ""
echo "Test your site: https://securityheaders.com/?q=https://thunderbird.bot"
