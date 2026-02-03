# Deployment Troubleshooting Guide

## Issue: Auth Endpoints Returning 404 in Production

### Root Cause
The auth endpoints return 404 in production when the backend code is outdated or the service hasn't been restarted after updates.

### Quick Fix

SSH into your production server and run:

```bash
ssh root@thunderbird.bot
cd /root/thunderbird-web/backend
./deploy/update-and-verify.sh
```

This will:
1. Pull latest code
2. Update dependencies
3. Restart services
4. Verify all endpoints are working

### Manual Steps

If you prefer to do it manually:

```bash
# 1. Update code
cd /root/thunderbird-web
git pull origin main

# 2. Update Python dependencies
cd backend
source venv/bin/activate
pip install -r requirements.txt

# 3. Restart backend service
sudo systemctl restart thunderbird-api

# 4. Check service status
sudo systemctl status thunderbird-api

# 5. Verify endpoints
./deploy/verify-deployment.sh http://localhost:8000
```

### Verify Nginx Configuration

Check that nginx is properly proxying auth requests:

```bash
# Check nginx config
cat /etc/nginx/sites-available/thunderbird | grep -A 10 "/auth/"

# Should show:
#   location /auth/ {
#       proxy_pass http://127.0.0.1:8000/auth/;
#       ...
#   }

# Test nginx config
sudo nginx -t

# Reload nginx if needed
sudo systemctl reload nginx
```

### Common Issues

#### 1. Service Not Running
```bash
sudo systemctl status thunderbird-api
# If not running:
sudo systemctl start thunderbird-api
sudo journalctl -u thunderbird-api -n 50
```

#### 2. Wrong Port
Backend should be on port 8000:
```bash
netstat -tulpn | grep 8000
# Should show Python/uvicorn listening on 127.0.0.1:8000
```

#### 3. Auth Router Not Imported
Check that `app/main.py` includes the auth router:
```python
from app.routers import auth
app.include_router(auth.router)
```

#### 4. Missing Environment Variables
Check backend .env file:
```bash
cat /root/thunderbird-web/backend/.env
# Must include:
# JWT_SECRET=<random-string>
```

### Testing Individual Endpoints

```bash
# Health check (should return 200)
curl -v http://localhost:8000/health

# Auth endpoints (should return 405 for GET, not 404)
curl -v http://localhost:8000/auth/token
curl -v http://localhost:8000/auth/register

# Through nginx (replace with your domain)
curl -v https://thunderbird.bot/auth/token
```

### Checking Logs

```bash
# Real-time backend logs
sudo journalctl -u thunderbird-api -f

# Last 100 lines
sudo journalctl -u thunderbird-api -n 100

# Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Nginx access logs
sudo tail -f /var/log/nginx/access.log
```

### Pre-Deployment Checklist

Before deploying to production:

- [ ] All changes committed and pushed to GitHub
- [ ] Local tests pass (`./deploy/verify-deployment.sh`)
- [ ] Backend tests pass (`pytest backend/tests/`)
- [ ] Environment variables configured in production `.env`
- [ ] Database migrations applied (if any)

### Post-Deployment Verification

After deploying:

- [ ] Service is running (`systemctl status thunderbird-api`)
- [ ] Endpoints respond correctly (`./deploy/verify-deployment.sh`)
- [ ] No errors in logs (`journalctl -u thunderbird-api -n 50`)
- [ ] Frontend can authenticate users
- [ ] SSL certificate valid (`curl -v https://thunderbird.bot`)

## Automated Monitoring

Consider setting up monitoring for these endpoints:

```bash
# Create a cron job to verify deployment every hour
cat > /etc/cron.hourly/thunderbird-health << 'EOF'
#!/bin/bash
if ! /root/thunderbird-web/backend/deploy/verify-deployment.sh http://localhost:8000 > /dev/null 2>&1; then
    echo "Thunderbird health check failed!" | mail -s "Thunderbird Alert" admin@example.com
fi
EOF

chmod +x /etc/cron.hourly/thunderbird-health
```

## Emergency Rollback

If deployment breaks production:

```bash
# Stop services
sudo systemctl stop thunderbird-api thunderbird-web

# Rollback code
cd /root/thunderbird-web
git log --oneline -10  # Find previous working commit
git reset --hard <commit-hash>

# Restore database if needed
cp /root/thunderbird-backups/LATEST/thunderbird.db backend/

# Restart services
sudo systemctl start thunderbird-api thunderbird-web

# Verify
./backend/deploy/verify-deployment.sh
```
