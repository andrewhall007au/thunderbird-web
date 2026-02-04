---
phase: 09-monitoring-alerting
plan: 03
subsystem: infra
tags: [playwright, synthetic-monitoring, e2e-tests, subprocess, monitoring]

# Dependency graph
requires:
  - phase: 09-01
    provides: Monitoring service with scheduler, metrics storage, and CheckResult pattern
  - phase: 09-02
    provides: Alert manager for evaluating and alerting on check failures
provides:
  - Playwright synthetic test runner for browser-based E2E testing in production
  - HTTP-based synthetic checks for login and SMS webhook endpoints
  - Scheduled synthetic monitoring for beta signup, checkout, create-first, login, and SMS webhook flows
  - Conditional Playwright test execution (only when npx is available)
affects: [09-04-dashboard, future-synthetic-tests]

# Tech tracking
tech-stack:
  added: [playwright, subprocess]
  patterns: [synthetic monitoring via Playwright JSON output, conditional check execution based on tool availability, HTTP-based synthetic checks for API endpoints]

key-files:
  created:
    - e2e/monitoring.config.ts
    - backend/monitoring/checks_synthetic.py
  modified:
    - backend/monitoring/scheduler.py (integrated by 09-02 alert manager plan)

key-decisions:
  - "Use separate Playwright config (monitoring.config.ts) for production monitoring instead of modifying development config"
  - "Parse Playwright JSON reporter output via /tmp file instead of stdout to handle large test results"
  - "Make Playwright browser tests conditional on npx availability, but always run HTTP-based checks"
  - "HTTP-based login check tests auth endpoint directly, SMS webhook check sends PING command"
  - "Login check every 10 minutes, SMS webhook check daily at startup then every 24 hours"

patterns-established:
  - "Synthetic test pattern: run_playwright_check() subprocess wrapper that parses JSON output into CheckResult"
  - "Conditional monitoring: Browser tests only if Playwright available, HTTP checks always run"
  - "HTTP synthetic checks: Direct API endpoint testing for non-browser flows (login, webhooks)"

# Metrics
duration: 9min
completed: 2026-02-04
---

# Phase 9 Plan 3: Synthetic Test Runner Summary

**Playwright E2E tests as synthetic monitors with login and SMS webhook checks running on schedule against production**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-04T08:16:20Z
- **Completed:** 2026-02-04T08:25:14Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Playwright synthetic test runner executes existing E2E tests against production via subprocess
- HTTP-based login synthetic check tests authentication endpoint every 10 minutes
- HTTP-based SMS webhook synthetic check tests inbound SMS pipeline daily
- Browser synthetic tests (beta signup, checkout, create-first) run every 5-15 minutes when Playwright available
- All synthetic checks integrated with alert manager for failure detection and escalation

## Task Commits

Each task was committed atomically:

1. **Task 1: Playwright monitoring config and synthetic test runner** - `14ccfed` (feat)
   - e2e/monitoring.config.ts: Playwright config targeting production with 120s timeouts, JSON reporter
   - backend/monitoring/checks_synthetic.py: Synthetic test runner with subprocess execution, login/SMS webhook HTTP checks

**Note:** Task 2 (scheduler integration) was completed in a subsequent commit `792fc35` as part of the 09-02 alert manager plan, which wired all synthetic checks into the alerting pipeline.

## Files Created/Modified

- `e2e/monitoring.config.ts` - Playwright configuration for production monitoring (120s timeout, JSON reporter, single worker)
- `backend/monitoring/checks_synthetic.py` - Synthetic test runner with run_playwright_check(), check_login_synthetic(), check_sms_webhook_synthetic()
- `backend/monitoring/scheduler.py` - Added 5 synthetic check jobs (beta signup, checkout, create-first, login, SMS webhook) with conditional Playwright execution

## Decisions Made

**1. Separate Playwright config for monitoring vs development**
- **Rationale:** Development config has different timeouts, reporters, and targets localhost. Monitoring needs production URL, JSON output, and generous timeouts.
- **Alternative considered:** Using environment variables to override main config - rejected because monitoring needs fundamentally different settings (no retries, single worker).

**2. Parse Playwright JSON output from /tmp file instead of stdout**
- **Rationale:** Playwright JSON reporter can produce large output (screenshots, traces). Capturing via file is more robust than stdout parsing.
- **Trade-off:** Requires file system access but avoids stdout buffer overflow issues.

**3. Conditional Playwright browser tests, always-on HTTP checks**
- **Rationale:** Playwright requires Node.js and npx. If not available (e.g., minimal Docker container), HTTP checks still work.
- **Implementation:** Check `shutil.which('npx')` at scheduler creation time, only add browser-based jobs if available.

**4. HTTP-based synthetic checks for login and SMS webhook**
- **Rationale:** Login and SMS webhook are API endpoints, not UI flows. Testing them via HTTP POST is faster and more reliable than spinning up a browser.
- **Implementation:** Login check POSTs to /api/auth/login with test credentials, SMS webhook check POSTs Twilio-formatted payload with PING body.

**5. SMS webhook synthetic runs daily, login every 10 minutes**
- **Rationale:** SMS webhook is the core product but less frequently used than login. Daily check with immediate first run ensures it works without excessive testing.
- **Login frequency:** 10 minutes per plan requirement MON-02, detects auth infrastructure issues quickly.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**Environment variables required for full functionality:**

The synthetic checks require test credentials that should be configured in production:

```bash
# .env (production environment)

# Login synthetic check
MONITOR_TEST_EMAIL=monitor@thunderbird.bot
MONITOR_TEST_PASSWORD=<secure test account password>

# SMS webhook synthetic check
MONITOR_TEST_PHONE=+1XXXXXXXXXX  # Clearly identifiable test number

# Already configured (from main app)
PRODUCTION_URL=https://thunderbird.bot
TWILIO_PHONE_NUMBER=+18662801940
TWILIO_ACCOUNT_SID=...
```

**Setup steps:**

1. Create a monitoring test account in production:
   ```bash
   # Via admin interface or direct DB insert
   INSERT INTO accounts (email, password_hash) VALUES ('monitor@thunderbird.bot', <bcrypt hash>);
   ```

2. Set environment variables in production .env

3. Restart monitoring service:
   ```bash
   systemctl restart thunderbird-monitoring
   ```

**Verification:**

```bash
# Check synthetic jobs are scheduled
curl http://localhost:8001/api/scheduler/jobs | grep synthetic

# View synthetic check results
curl http://localhost:8001/api/metrics/latest | grep synthetic

# Check for login/webhook check failures
curl http://localhost:8001/api/incidents/active | grep -E "(login|webhook)"
```

## Next Phase Readiness

**Ready for next plans:**

- **09-04 (Dashboard):** Synthetic check metrics are stored in the metrics database with check_name prefix "synthetic_*". Dashboard can query and display synthetic test results alongside other health checks.
- **Future synthetic tests:** Pattern established - new synthetic tests can be added by creating check functions in checks_synthetic.py and registering them in scheduler.py.

**Important notes:**

- Synthetic tests create real data in production (beta applications, etc.). Consider using test accounts or cleanup jobs if this becomes an issue.
- Playwright browser tests require significant resources (chromium browser). Monitor server CPU/memory usage.
- Login and SMS webhook checks require valid test credentials to be configured.

**No blockers.**

---
*Phase: 09-monitoring-alerting*
*Completed: 2026-02-04*
