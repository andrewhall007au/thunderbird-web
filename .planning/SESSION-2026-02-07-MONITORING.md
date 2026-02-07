# Session Handoff: Monitoring Error Investigation

**Date:** 2026-02-07
**Status:** In Progress - Verification Phase
**Priority:** High - Monitoring alerts still active

## What We Accomplished Today

### 1. ✅ Fixed Monitoring Configuration Issues

**Problems Fixed:**
- Weather API monitoring - Now tests actual external APIs (BOM, NWS, Open-Meteo) instead of internal endpoint
- Database path - Corrected from `/root/overland-weather` to `/root/thunderbird-web`
- Stripe/Twilio checks - Now skip gracefully when not configured
- Check intervals - Reduced to beta-appropriate frequencies (hourly for weather, 15-30 min for others)

**Files Changed:**
- `backend/monitoring/checks.py` - New weather API check logic
- `backend/monitoring/config.py` - Updated intervals and database path
- `backend/config/settings.py` - Added TWILIO_PHONE_NUMBER_AU and TWILIO_PHONE_NUMBER_US

### 2. ✅ Added US Toll-Free Number with Smart Routing

**Configuration:**
- Australian number: +61468092783 (for AU users)
- US toll-free: +18662801940 (for US + international users)
- Smart routing in `backend/app/services/sms.py` - selects number based on destination country

**Files Changed:**
- `backend/app/services/sms.py` - Added `_get_from_number()` method
- `backend/config/settings.py` - Added phone number settings
- Production `.env` - Both numbers configured

### 3. ✅ Fixed Git Branch Confusion

**Problem:** Production was on `v1.1` branch, we were pushing to `main`
**Solution:**
- Switched production to `main` branch
- Created comprehensive git workflow documentation

**Files Created:**
- `.planning/GIT_WORKFLOW.md` - Complete branching strategy
- `.planning/PRODUCTION_DEPLOYMENT.md` - Updated with branch info
- `.planning/PATHS_REFERENCE.md` - Added git branch verification

### 4. ✅ Updated All Documentation

**New Documentation:**
- `.planning/MONITORING_FIXES_2026-02-07.md` - Details of all monitoring fixes
- `.planning/MONITORING_STATUS.md` - Current monitoring configuration
- `.planning/PRODUCTION_DEPLOYMENT.md` - Complete deployment guide
- `.planning/PATHS_REFERENCE.md` - Quick reference for paths
- `.planning/GIT_WORKFLOW.md` - Branching strategy
- `.planning/TWILIO_CREDENTIALS.md` - Twilio setup (on production server only)

## Current State

### Production Server Status

**Location:** `root@thunderbird.bot:/root/thunderbird-web/`
**Branch:** `main` ✅ (was on v1.1, now fixed)
**Last Pull:** 2026-02-07 01:52 UTC (commit 7a95e18)

**Services:**
- `thunderbird-api.service` - ✅ Running (backend on port 8000)
- `thunderbird-web.service` - ✅ Running (frontend on port 3000)
- `thunderbird-monitoring.service` - ⏳ Testing (was manually started, needs verification as systemd service)

**Monitoring Service:**
- Runs successfully when started manually
- Was crashing when run as systemd service (before git pull)
- Now needs verification that systemd service works with new code

### Active Monitoring Issues (Before Fixes)

From database query at 01:44:49 UTC:

1. **weather_api** - HTTP 401 (249 failures) - Should be FIXED with new code
2. **db_query_performance** - Wrong database path (304 failures) - Should be FIXED
3. **external_api_latency** - Stripe check failing (247 failures) - Should be FIXED (now skips)
4. **synthetic_login** - Missing test credentials (248 failures) - Expected, can ignore
5. **synthetic_beta_signup_flow** - Missing @playwright/test (44 failures) - Can disable
6. **synthetic_sms_webhook** - HTTP 404 (280 failures) - Can disable or fix endpoint

## NEXT STEPS (Resume Here)

### Immediate: Verify Monitoring Service

**Currently:** Monitoring service is running MANUALLY (user needs to Ctrl+C and start as systemd)

**Commands to run on production:**
```bash
# Stop manual run (Ctrl+C)

# Start as systemd service
systemctl start thunderbird-monitoring
systemctl status thunderbird-monitoring

# Wait 10 seconds for checks to run
sleep 10

# Verify new checks are working
sqlite3 /root/thunderbird-web/backend/backend/monitoring/monitoring.db "
SELECT
    check_name,
    status,
    error_message,
    datetime(timestamp_ms/1000, 'unixepoch') as timestamp
FROM metrics
WHERE timestamp_ms > strftime('%s', 'now', '-5 minutes') * 1000
ORDER BY timestamp_ms DESC
LIMIT 20;
"

# Check active incidents (should resolve the fixed ones)
sqlite3 /root/thunderbird-web/backend/backend/monitoring/monitoring.db "
SELECT
    check_name,
    status,
    failure_count,
    message,
    datetime(last_seen_ms/1000, 'unixepoch') as last_seen
FROM incidents
WHERE status = 'active'
ORDER BY last_seen_ms DESC;
"
```

**Expected Results:**
- ✅ `weather_api` - Should show "pass" status with metadata about providers tested
- ✅ `db_query_performance` - Should show "pass" status (database accessible)
- ✅ `external_api_latency` - Should show "pass" with Stripe/Twilio skipped
- ⚠️ `synthetic_*` checks - May still fail (Playwright issues, expected)

### Short-term: Disable or Fix Problematic Checks

**Option 1: Disable Playwright synthetic checks (recommended for beta)**
```bash
# Edit monitoring config
nano /root/thunderbird-web/backend/monitoring/config.py

# Comment out or remove synthetic check intervals
# Or set very long intervals (e.g., 1440 minutes = daily)
```

**Option 2: Fix Playwright installation**
```bash
cd /root/thunderbird-web
npm install @playwright/test
npx playwright install chromium --with-deps
```

### Medium-term: Monitor for 24 Hours

After verification:
1. Monitor email/SMS alerts for 24 hours
2. Check monitoring dashboard: https://thunderbird.bot/monitoring
3. Review incident resolution
4. Adjust alert thresholds if needed

## Files Modified (Need to Commit on Local)

**On local machine, need to commit:**
```bash
cd /Users/andrewhall/thunderbird-web
git status  # Will show .planning/ files modified

git add .planning/
git commit -m "docs: Add session handoff for monitoring investigation"
git push origin main
```

## Key Decisions Made

1. **Production uses `main` branch always** - No more version branches
2. **Beta monitoring intervals** - Hourly weather checks, reduced frequencies
3. **Smart Twilio routing** - Use local numbers for cheaper SMS costs
4. **Skip unconfigured services** - Stripe/Twilio checks skip when keys not set

## References

- **Main project doc:** `.planning/PROJECT.md`
- **Production deployment:** `.planning/PRODUCTION_DEPLOYMENT.md`
- **Git workflow:** `.planning/GIT_WORKFLOW.md`
- **Monitoring status:** `.planning/MONITORING_STATUS.md`
- **Quick paths:** `.planning/PATHS_REFERENCE.md`

## Questions to Resolve

1. Should we disable Playwright synthetic tests during beta? (Recommended: Yes)
2. Should we create test credentials for synthetic_login check? (Optional)
3. What's the correct endpoint for synthetic_sms_webhook? (Can investigate later)

## Contact/Credentials

**Production Server:**
- Host: thunderbird.bot
- SSH: `ssh root@thunderbird.bot`
- Monitoring: https://thunderbird.bot/monitoring

**Twilio:**
- AU Number: +61468092783
- US Number: +18662801940
- Account SID: AC******************************* (in .env)

---

**Resume Point:** User needs to Ctrl+C the manual monitoring run, start as systemd service, and verify checks are working.
