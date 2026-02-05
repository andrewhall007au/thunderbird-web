# TODO: Complete Browser-Based Monitoring Setup

**Priority:** HIGH
**Status:** IN PROGRESS
**Created:** 2026-02-05
**Context:** After fixing localhost URL bug that broke beta signup

## Problem

Today's production bug (localhost:8000 in JS bundle) wasn't caught by 633 passing tests because they only test backend APIs, not real browser behavior.

## What's Been Done ✅

1. **E2E Test Suite Created** (`e2e/critical-flows.spec.ts`)
   - Tests critical user flows in real browsers
   - Beta signup, homepage load, API connectivity
   - Catches CSP violations, JS errors, network issues

2. **Post-Deployment Tests Added** (`.github/workflows/deploy.yml`)
   - Browser tests run after deployment
   - Currently non-blocking (continues on failure)

3. **Browser Check Module Created** (`backend/monitoring/checks_browser.py`)
   - Code ready to run browser checks
   - Not yet integrated with scheduler

## What Still Needs To Be Done ❌

### Part A: Make GitHub Actions Block Bad Deployments (5 min)

**Current:** Tests have `|| echo "warning"` - deployment continues even if tests fail

**Goal:** Make tests actually block deployment

**Changes needed:**
```yaml
# .github/workflows/deploy.yml

# Remove all `|| echo "warning"` fallbacks
# Change line 37 from:
python -m pytest tests/ ... || echo "Tests had failures but continuing..."
# To:
python -m pytest tests/ -v --tb=short

# Remove line 89 fallback:
python tests/smoke_test_server.py --url http://localhost:8000
# (no || echo)

# Remove line 100 fallback:
python tests/smoke_test_production.py --url https://thunderbird.bot -v
# (no || echo)
```

**Result:** If any test fails → deployment stops, email sent, production untouched

### Part B: Set Up Continuous Browser Monitoring (30 min)

**Goal:** Browser checks run every 10 minutes, alert if critical flows fail

**Steps:**

1. **Install Node.js and Playwright on production server**
```bash
ssh root@thunderbird.bot

# Install Node.js (if not already)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install Playwright
cd /root/thunderbird-web
npm install
npx playwright install chromium --with-deps
```

2. **Install Python Playwright library**
```bash
cd /root/thunderbird-web/backend
source venv/bin/activate
pip install playwright
playwright install chromium
```

3. **Test browser checks work**
```bash
cd /root/thunderbird-web/backend
source venv/bin/activate
python -m monitoring.checks_browser
```

4. **Integrate with monitoring scheduler**

Edit `backend/monitoring/scheduler.py`, add after line ~260:

```python
def run_browser_checks_job():
    """Run browser-based synthetic monitoring."""
    try:
        import asyncio
        from .checks_browser import run_all_browser_checks

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        results = loop.run_until_complete(
            run_all_browser_checks(settings.MONITOR_PRODUCTION_URL)
        )

        alert_mgr = get_or_create_alert_manager()

        # Check each result
        for check_result in results["checks"]:
            if not check_result["success"]:
                logger.error(f"Browser check failed: {check_result}")
                # Create CheckResult for alerting
                from .storage import CheckResult
                result = CheckResult(
                    check_name=check_result["check"],
                    status="fail",
                    duration_ms=check_result.get("duration_ms", 0),
                    error_message=check_result.get("error"),
                    details=check_result.get("details", {})
                )
                asyncio.create_task(alert_mgr.evaluate_and_alert(result))

        loop.close()
    except Exception as e:
        logger.error(f"Browser checks failed: {e}")
```

Then add to scheduler (around line 350):

```python
# Browser-based synthetic monitoring (every 10 minutes)
scheduler.add_job(
    run_browser_checks_job,
    IntervalTrigger(minutes=10),
    id="browser_checks",
    name="Browser-Based Synthetic Checks",
    max_instances=1,
    replace_existing=True,
)
```

5. **Restart monitoring service**
```bash
systemctl restart thunderbird-monitoring
journalctl -u thunderbird-monitoring -f | grep -i browser
```

6. **Verify it's working**
```bash
# Check logs show browser checks running
journalctl -u thunderbird-monitoring --since "5 minutes ago" | grep browser

# Should see:
# "Starting browser checks..."
# "beta_signup_flow: PASS"
# "homepage_load: PASS"
```

## Success Criteria

- [ ] GitHub Actions blocks deployment if browser tests fail
- [ ] Browser checks run every 10 minutes on production server
- [ ] Alert sent if beta signup flow fails
- [ ] Alert sent if homepage won't load
- [ ] Can see browser check results in monitoring dashboard

## Testing

**After setup, test by breaking production:**

1. Introduce a bug (e.g., add localhost URL back)
2. Deploy to staging first
3. Browser tests should fail in GitHub Actions
4. Deployment should be blocked
5. No broken code reaches production

## Files Involved

- `.github/workflows/deploy.yml` - Remove test fallbacks
- `backend/monitoring/scheduler.py` - Add browser check job
- `backend/monitoring/checks_browser.py` - Already created
- Server packages: Node.js, Playwright, chromium

## Estimated Time

- Part A: 5 minutes (remove `|| echo` fallbacks)
- Part B: 30 minutes (server setup + integration)
- Total: ~35 minutes

## Reference

See `README-TESTING.md` for full testing strategy documentation.
