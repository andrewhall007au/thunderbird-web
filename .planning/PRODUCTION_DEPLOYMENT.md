# Production Deployment Info

**CRITICAL:** Read this first to avoid confusion between old and new projects!

## Project Identity

**Active Project:** Thunderbird Web (Global)
**Repository:** thunderbird-web
**Status:** ✅ Deployed and running in production
**Old Project:** overland-weather (Tasmania only - DEAD, do not use)

## Deployment Locations

### Local Development
```
/Users/andrewhall/thunderbird-web/
├── backend/          # FastAPI backend
│   ├── .env          # Local development config
│   └── venv/         # Python virtual environment
├── frontend/         # Next.js frontend
└── .planning/        # Project documentation
```

### Production Server (thunderbird.bot)
```
root@thunderbird.bot:/root/thunderbird-web/
├── backend/
│   ├── .env          # ⚠️ PRODUCTION CONFIG - Edit this one!
│   ├── venv/
│   └── app/
├── frontend/
└── monitoring/
```

**DO NOT EDIT:** `/root/overland-weather/` - This is OLD CODE, not running!

## Production Services

| Service | Path | Port | Status |
|---------|------|------|--------|
| Backend API | `/root/thunderbird-web/backend` | 8000 | ✅ Running |
| Frontend | `/root/thunderbird-web` | 3000 | ✅ Running |
| Monitoring | `/root/thunderbird-web/backend/monitoring` | 8001 | ✅ Running |

**Systemd Services:**
```bash
systemctl status thunderbird-api        # Backend
systemctl status thunderbird-web        # Frontend
systemctl status thunderbird-monitoring # Monitoring
```

## Configuration Files

### Production Environment Variables
**File:** `/root/thunderbird-web/backend/.env`

**Current Config (2026-02-07):**
- Twilio US Toll-Free: +1 (866) 280-1940
- Twilio AU Number: +614xxxxxxxx (configured)
- Account SID: AC******************************** (configured in .env)
- Database: `/root/thunderbird-web/backend/thunderbird.db`
- Monitoring: Configured for beta phase (hourly checks)

### Monitoring Configuration
**File:** `/root/thunderbird-web/backend/monitoring/config.py`

**Database Path:** `/root/thunderbird-web/backend/thunderbird.db` (NOT the old overland-weather path!)

## Common Operations

### Update Production Config
```bash
# SSH to server
ssh root@thunderbird.bot

# Edit the CORRECT .env file
nano /root/thunderbird-web/backend/.env

# Restart services after changes
systemctl restart thunderbird-api
systemctl restart thunderbird-monitoring
```

### Deploy Code Updates

**⚠️ IMPORTANT: Production ALWAYS uses `main` branch**

```bash
# On local machine - commit and push to main
git add .
git commit -m "your changes"
git push origin main

# On production server - pull from main
cd /root/thunderbird-web
git checkout main  # Ensure on main branch
git pull origin main

# Restart services
systemctl restart thunderbird-api
systemctl restart thunderbird-web
systemctl restart thunderbird-monitoring
```

**Git Branch Strategy:**
- `main` = Production-ready code (deploy from here)
- `feature/*` = Development branches (merge to main when ready)
- **Never deploy from version branches (v1.1, v1.2, etc.) - those are tags/archives**

### View Logs
```bash
# Backend logs
journalctl -u thunderbird-api -f

# Frontend logs
journalctl -u thunderbird-web -f

# Monitoring logs
journalctl -u thunderbird-monitoring -f
```

### Check Database
```bash
# Production database location
sqlite3 /root/thunderbird-web/backend/thunderbird.db

# NOT this one (old project):
# /root/overland-weather/backend/thunderbird.db
```

## Old Project (DO NOT USE)

**Path:** `/root/overland-weather/`
**Status:** ❌ Deprecated, not running
**Last Updated:** ~December 2025
**Purpose:** Tasmania-only version (replaced by global version)

**This directory exists on the server but is NOT active. Ignore it completely.**

## Access Info

**Production Server:**
- Hostname: `thunderbird.bot`
- SSH: `ssh root@thunderbird.bot`
- Web: `https://thunderbird.bot`
- Monitoring: `https://thunderbird.bot/monitoring`

**Digital Ocean:**
- Region: SFO3
- Droplet: ThunderbirdWeather
- IP: 170.64.229.224

## Quick Reference

**To add/update credentials on production:**
1. SSH: `ssh root@thunderbird.bot`
2. Edit: `nano /root/thunderbird-web/backend/.env`
3. Restart: `systemctl restart thunderbird-api thunderbird-monitoring`

**To check what's running:**
```bash
ps aux | grep python | grep thunderbird-web
```

**To verify you're editing the right project:**
```bash
# Should show thunderbird-web processes, NOT overland-weather
ps aux | grep python | grep -v grep
```

---

**Last Updated:** 2026-02-07
**Updated By:** Deployment configuration clarification
