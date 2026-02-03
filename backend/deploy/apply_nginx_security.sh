#!/bin/bash
set -e

echo "=========================================="
echo "Applying Nginx Security Configuration"
echo "=========================================="

# Backup current nginx config
echo "[1/4] Backing up current nginx config..."
cp /etc/nginx/sites-available/thunderbird /etc/nginx/sites-available/thunderbird.backup.$(date +%s)

# Copy new config
echo "[2/4] Installing new nginx config with security headers and rate limiting..."
cp /root/nginx_complete.conf /etc/nginx/sites-available/thunderbird

# Test nginx config
echo "[3/4] Testing nginx configuration..."
if nginx -t; then
    echo "✓ Nginx config is valid"
else
    echo "✗ Nginx config has errors - restoring backup"
    cp /etc/nginx/sites-available/thunderbird.backup.* /etc/nginx/sites-available/thunderbird
    exit 1
fi

# Reload nginx
echo "[4/4] Reloading nginx..."
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
