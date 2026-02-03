# AU→BOM Fix: Deployment Guide

## Overview

This guide covers deploying the critical AU→BOM provider mapping fix identified by OpenClaw's code review.

**What changed:**
- Added BOMProvider for Australian weather (2.2km resolution)
- Fixed router.py to map AU→BOM instead of falling back to Open-Meteo
- Added spec validation tests to prevent future drift

## Prerequisites

- [ ] All tests passing locally ✅ (already verified)
- [ ] Changes committed to git
- [ ] SSH access to production server
- [ ] GitHub credentials configured

---

## Option 1: Automated Deployment (Recommended)

### Step 1: Update Server Configuration

Edit `backend/deploy_au_bom_fix.sh` and set your server IP:

```bash
SERVER_HOST="your-server-ip-here"  # UPDATE THIS LINE
```

### Step 2: Run Deployment Script

```bash
cd /Users/andrewhall/thunderbird-web/backend
./deploy_au_bom_fix.sh
```

The script will:
1. SSH into your server
2. Pull latest code from GitHub
3. Run tests on server
4. Restart the API service
5. Verify deployment

---

## Option 2: Manual Deployment

### Step 1: Commit and Push to GitHub

```bash
cd /Users/andrewhall/thunderbird-web/backend

# Stage changes
git add app/services/weather/providers/bom.py \
        app/services/weather/providers/__init__.py \
        app/services/weather/router.py \
        tests/test_weather_router.py \
        tests/test_spec_alignment.py \
        ../AU_BOM_FIX_SUMMARY.md

# Commit
git commit -m "fix(weather): Add missing AU→BOM provider mapping

Critical fix identified by OpenClaw code review.
- Created BOMProvider wrapper
- Added AU→BOM mapping to router
- Added spec validation tests

Refs: AU_BOM_FIX_SUMMARY.md
"

# Push to GitHub
git push origin v1.1
```

### Step 2: Deploy to Production Server

```bash
# SSH into your server
ssh root@YOUR_SERVER_IP

# Navigate to project
cd /root/thunderbird-web

# Pull latest changes
git fetch origin
git pull origin v1.1

# Activate virtual environment
cd backend
source venv/bin/activate

# Run tests to verify
python3 -m pytest tests/test_weather_router.py::TestWeatherRouter::test_provider_mapping_australia -v
python3 -m pytest tests/test_spec_alignment.py::TestWeatherProviderSpecAlignment -v

# If tests pass, restart service
sudo systemctl restart thunderbird-api

# Verify service is running
sudo systemctl status thunderbird-api

# Check logs
sudo journalctl -u thunderbird-api -f
```

### Step 3: Verify Deployment

Test with Australian coordinates:

```bash
# From your server
curl -X POST http://localhost:8000/webhook/sms/inbound \
  -d "From=%2B61412345678&Body=CAST+-42.88,147.33"

# Should use BOM provider (check logs for "BOM" provider name)
```

---

## Option 3: Create Pull Request (If Using PR Workflow)

### Step 1: Create Feature Branch

```bash
cd /Users/andrewhall/thunderbird-web/backend

git checkout -b fix/au-bom-provider-mapping

# Stage and commit (same as above)
git add ...
git commit -m "..."

# Push to new branch
git push origin fix/au-bom-provider-mapping
```

### Step 2: Create Pull Request on GitHub

1. Go to: https://github.com/andrewhall007au/thunderbird-web
2. Click "Compare & pull request"
3. Review changes
4. Add description from AU_BOM_FIX_SUMMARY.md
5. Merge to v1.1 or main

### Step 3: Deploy Merged Changes

After merge, deploy using Option 2 (manual) steps 2-3.

---

## Verification Checklist

After deployment, verify:

- [ ] Service is running: `systemctl status thunderbird-api`
- [ ] No errors in logs: `journalctl -u thunderbird-api -n 50`
- [ ] Tests pass on server: See Step 2 above
- [ ] AU coordinates use BOM: Check logs for "BOM" when testing AU coordinates
- [ ] Existing routes still work: Test a known route like Western Arthurs

## Testing with Real Coordinates

Test Australian locations to verify BOM is being used:

```bash
# Tasmania coordinates
CAST -42.88,147.33  # Lake St Clair (should use BOM)

# Melbourne
CAST -37.81,144.96  # Should use BOM

# Non-AU for comparison
CAST -45.00,168.00  # New Zealand (should use ECMWF via Open-Meteo)
```

Check logs for provider names to confirm routing.

## Rollback Plan

If issues occur:

```bash
# SSH to server
ssh root@YOUR_SERVER_IP

cd /root/thunderbird-web
git log --oneline -5  # Find commit before fix

# Rollback
git checkout <previous-commit-hash>

# Restart service
systemctl restart thunderbird-api

# Verify
systemctl status thunderbird-api
```

---

## Monitoring After Deployment

### Watch Logs

```bash
# SSH to server
journalctl -u thunderbird-api -f
```

Look for:
- ✅ "Fetching BOM forecast for (-42.88, 147.33)" (Australian coords)
- ✅ "BOM forecast fetched: N periods"
- ❌ "Open-Meteo" for AU coordinates (indicates problem)

### Check Provider Usage

Monitor which providers are being used:

```bash
# Count provider usage in logs
journalctl -u thunderbird-api --since "10 minutes ago" | grep "provider" | sort | uniq -c
```

Should see BOM for AU coordinates.

---

## Support

If you encounter issues:

1. Check logs: `journalctl -u thunderbird-api -n 100`
2. Verify tests pass: `pytest tests/test_weather_router.py -v`
3. Review AU_BOM_FIX_SUMMARY.md for details
4. Contact: Use GitHub issues

---

**Created:** 2026-02-03
**Issue:** AU→BOM mapping missing (OpenClaw Review)
**Priority:** HIGH - Affects all Australian users
**Impact:** Users get 2.2km BOM data instead of 9km fallback
