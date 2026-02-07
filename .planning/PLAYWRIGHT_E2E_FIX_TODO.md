# Playwright E2E Test Fixes - TODO

**Status:** In Progress
**Priority:** CRITICAL for Retail Launch
**Context:** These tests validate revenue-critical user flows and MUST work before retail.

## Current State (2026-02-07)

### ✅ Working Monitoring Checks:
- `weather_api` - Tests external APIs (BOM, NWS, Open-Meteo) ✅
- `external_api_latency` - Tests Stripe/Twilio with graceful skipping ✅
- `db_query_performance` - Correct database path ✅
- `synthetic_login` - Correct endpoint (/auth/token) ✅
- All basic health checks (backend, frontend, API response time) ✅

### ❌ Broken - Playwright Browser Tests:
- `synthetic_beta_signup_flow` - Timeout (button stays disabled)
- `synthetic_buy_now_flow` - Timeout
- `synthetic_create_first_flow` - Timeout

**Also:** Mobile (WebKit) tests fail - WebKit browser not installed.

## The Problem

**Tests fill form fields but submit button stays disabled forever.**

When manually testing in browser:
- ✅ Form works fine
- ✅ Submit button enables after filling all fields

In Playwright tests:
- ❌ Button stays disabled (`disabled` attribute never removed)
- ❌ React state (`formData`) not updating from Playwright actions

**Root Cause:** Playwright's `.fill()` method doesn't trigger React's `onChange` events properly, so form state never updates and validation never passes.

## What We Tried

1. **Added explicit waits** - Didn't work, button stays disabled
2. **Changed to `keyboard.type`** - Latest attempt (not yet fully tested)

## Critical User Flows Being Tested

These are NOT optional - they test core revenue and product flows:

1. **Beta Signup Flow** (`synthetic_beta_signup_flow`)
   - User onboarding path
   - Tests: /api/beta/apply endpoint
   - Critical: New users can't sign up if broken

2. **Buy Now/Checkout Flow** (`synthetic_buy_now_flow`)
   - **REVENUE CRITICAL** - Payment processing
   - Tests: Stripe integration, account creation
   - If broken: NO REVENUE

3. **Create First Route Flow** (`synthetic_create_first_flow`)
   - Core product functionality
   - Tests: Map interaction, route creation
   - If broken: Product doesn't work

## Next Steps to Fix

### 1. Test Latest Fix (keyboard.type)

Deploy and test on production:
```bash
cd /root/thunderbird-web
git pull origin main
systemctl restart thunderbird-monitoring

# Test single case
npx playwright test e2e/beta-signup-flow.spec.ts \
  --config=e2e/monitoring.config.ts \
  --grep="should complete beta signup successfully" \
  --project=chromium \
  --reporter=line
```

**If keyboard.type works:**
- Update ALL test files (buy-now-flow, create-first-flow) with same pattern
- Deploy and verify

**If keyboard.type doesn't work:**
- Check test screenshots (automatically saved to `test-results/`)
- Investigate what's different between manual and automated

### 2. Investigate React State Issue

**File to check:** `app/components/beta/BetaApplyModal.tsx`

Form validation logic (lines 61-65):
```typescript
const isFormValid =
  formData.name.trim().length > 0 &&
  formData.email.includes('@') &&
  formData.email.includes('.') &&
  formData.country.length > 0;
```

Submit button (line 183):
```typescript
disabled={!isFormValid || isSubmitting}
```

**Possible solutions:**
- Force React events: `await page.dispatchEvent('input', 'change')`
- Use data-testid attributes for more reliable selectors
- Add debug logging to see formData state in tests
- Use Playwright's `waitFor` to ensure React has time to update

### 3. Fix WebKit (Mobile) Tests

Mobile tests fail because WebKit browser not installed:
```bash
npx playwright install webkit --with-deps
```

### 4. Alternative: Component Testing

If browser tests remain flaky, consider:
- **Component tests** (faster, more reliable)
- **API integration tests** (test endpoints directly)
- Keep Playwright only for critical smoke tests

## Files Involved

**Test Files:**
- `e2e/beta-signup-flow.spec.ts` - Beta signup tests
- `e2e/buy-now-flow.spec.ts` - Checkout flow tests
- `e2e/create-first-flow.spec.ts` - Route creation tests
- `e2e/monitoring.config.ts` - Test configuration

**Component Files:**
- `app/components/beta/BetaApplyModal.tsx` - Beta signup form
- `app/_checkout/page.tsx` - Checkout flow
- `app/create/page.tsx` - Route creation

**Monitoring:**
- `backend/monitoring/checks_synthetic.py` - Runs Playwright tests
- `backend/monitoring/scheduler.py` - Schedules synthetic checks

## Success Criteria

All 3 Playwright checks passing in production monitoring:
```sql
SELECT check_name, status
FROM metrics
WHERE check_name LIKE 'synthetic_%'
  AND check_name NOT LIKE '%login%'
  AND check_name NOT LIKE '%sms%'
ORDER BY timestamp_ms DESC
LIMIT 10;
```

Should show:
- `synthetic_beta_signup_flow` - pass ✅
- `synthetic_buy_now_flow` - pass ✅
- `synthetic_create_first_flow` - pass ✅

## References

**Similar Issues:**
- Playwright + React: https://github.com/microsoft/playwright/issues/15993
- React onChange not firing: Common with `.fill()` method

**Production Server:**
- Host: `root@thunderbird.bot`
- Monitoring: https://thunderbird.bot/monitoring
- Logs: `/var/log/thunderbird-monitoring.log`

## Time Estimate

- If keyboard.type works: 2-4 hours (update all tests, verify)
- If needs deeper fix: 1-2 days (investigate, implement, test)

**MUST be fixed before retail launch** - these validate revenue and core product.
