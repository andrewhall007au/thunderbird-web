# TODO: Deploy Browser Monitoring to Production

**Priority:** CRITICAL
**Status:** BLOCKED (memory constraints on server)
**Created:** 2026-02-05
**Context:** CI/CD pipeline operational, but browser-based E2E monitoring not yet active

## Problem

Browser monitoring code is deployed but not activated due to server memory constraints during `npm install`. Server was killed during installation (likely 1GB RAM droplet).

## What Needs to Happen

Browser-based E2E tests running every 10 minutes in production to catch:
- CSP violations
- Broken UI flows
- API connectivity issues
- JavaScript errors

## Current State

✅ Code deployed:
- `backend/monitoring/checks_browser.py` - Browser check module
- `backend/monitoring/scheduler.py` - Scheduler integration (runs every 10 min)
- `e2e/critical-flows.spec.ts` - E2E test suite

❌ Not yet activated:
- Node.js packages (`npm install` killed by OOM)
- Playwright browsers not installed
- Python playwright library not installed

## Solution Options

### Option 1: Increase Server Resources (Recommended)
- Upgrade to 2GB RAM droplet temporarily for installation
- Install dependencies
- Downgrade back to 1GB if needed

### Option 2: Add Swap Space
```bash
ssh root@thunderbird.bot

# Create 2GB swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Try installation again
cd /root/thunderbird-web
npm install --legacy-peer-deps
npx playwright install chromium --with-deps

# Backend Playwright
cd backend
source venv/bin/activate
pip install playwright
playwright install chromium

# Restart monitoring
sudo systemctl restart thunderbird-monitoring

# Verify working
journalctl -u thunderbird-monitoring -f | grep -i browser

# Remove swap after if needed
sudo swapoff /swapfile
sudo rm /swapfile
```

### Option 3: Install on Different Server
- Install on a dev machine with more resources
- Copy `node_modules` and `.cache` to production
- Not recommended (fragile)

## Installation Steps (Once Resources Available)

```bash
# 1. SSH to server
ssh root@thunderbird.bot

# 2. Pull latest code
cd /root/thunderbird-web
git pull origin main

# 3. Install Node.js dependencies
npm install --legacy-peer-deps

# 4. Install Playwright browsers
npx playwright install chromium --with-deps

# 5. Install Python Playwright
cd backend
source venv/bin/activate
pip install playwright
playwright install chromium

# 6. Test browser checks work
python -m monitoring.checks_browser

# 7. Restart monitoring service
sudo systemctl restart thunderbird-monitoring

# 8. Verify checks are running
journalctl -u thunderbird-monitoring --since "5 minutes ago" | grep -i browser

# Should see every 10 minutes:
# "Starting browser checks..."
# "beta_signup_flow: PASS"
# "homepage_load: PASS"
```

## Success Criteria

- [ ] Browser checks run every 10 minutes
- [ ] Alert sent if beta signup flow fails
- [ ] Alert sent if homepage won't load
- [ ] Can see browser check results in monitoring logs
- [ ] No memory issues on production server

## Why This Is Critical

Today's production bug (localhost:8000 in JS bundle) wasn't caught by 658 passing backend tests. Browser-based E2E tests would have caught it immediately. Without this:

1. **CSP violations** go undetected until users report issues
2. **Broken UI flows** only found by manual testing
3. **API connectivity issues** not caught in production
4. **Deployment confidence** remains lower than it should be

## Estimated Time

- With swap space: 20-30 minutes
- With server upgrade: 10 minutes

## Files Involved

- `backend/monitoring/checks_browser.py` (already deployed)
- `backend/monitoring/scheduler.py` (already deployed)
- `e2e/critical-flows.spec.ts` (already in repo)
- `package.json` (already in repo)

## Related Documents

- `.planning/todos/browser-monitoring-setup.md` - Original setup guide
- `README-TESTING.md` - Testing strategy documentation
- `.github/workflows/deploy.yml` - CI/CD workflow (browser tests run here)

## Next Action

**Decision needed:** Upgrade server RAM temporarily or add swap space?
