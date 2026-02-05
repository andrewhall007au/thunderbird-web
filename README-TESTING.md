# Testing Guide

## The Testing Problem We Solved

**Previous situation:** 633 tests passing, but beta signup was broken in production for real users.

**Why?** Tests only checked backend APIs, not actual browser behavior.

**Solution:** Browser-based E2E tests that actually click buttons like real users.

## Test Types

### 1. Unit Tests (Backend)
**Location:** `backend/tests/`

**What they test:** Business logic, database operations, API endpoints

**Run:**
```bash
cd backend
python -m pytest tests/ -v
```

**Value:** Catch logic bugs, but **don't catch frontend issues**.

### 2. E2E Tests (Browser-Based) ⭐ **MOST IMPORTANT**
**Location:** `e2e/critical-flows.spec.ts`

**What they test:** Real user experience in actual browsers

**Run locally:**
```bash
npm install
npx playwright install
npx playwright test e2e/critical-flows.spec.ts --config=e2e/production.config.ts --project=chromium
```

**Or use the script:**
```bash
./scripts/test-production.sh
./scripts/test-production.sh https://staging.thunderbird.bot  # Test staging
```

**Value:** **Catches real user issues** like:
- JavaScript errors
- CSP violations
- Network errors
- Frontend API connectivity
- Form submission bugs

### 3. Post-Deployment Smoke Tests (Automated)
**Location:** `.github/workflows/deploy.yml`

**What they do:** Run browser tests against production after every deployment

**When:** Automatically after `git push` triggers deployment

**Result:** If tests fail, you get notified immediately

## What the Browser Tests Check

From `e2e/critical-flows.spec.ts`:

1. ✅ **Homepage loads** without errors
2. ✅ **Beta signup works** - the exact flow that was broken
3. ✅ **API is reachable** from frontend
4. ✅ **No CSP violations** (especially no localhost URLs)
5. ✅ **No JavaScript errors** during form submission
6. ✅ **Page loads fast** (under 10 seconds)
7. ✅ **Critical resources load** (CSS, JS, API)

## Running Tests Before Deployment

**Always run before deploying:**
```bash
# 1. Run backend tests
cd backend && python -m pytest tests/ -v

# 2. Build frontend
cd ..
npm run build

# 3. Test production (against current production)
./scripts/test-production.sh

# 4. If all pass, deploy
git push origin main
```

## Monitoring (Continuous Testing)

Browser checks run every 5-10 minutes via monitoring system:

**Check status:**
```bash
ssh root@thunderbird.bot
journalctl -u thunderbird-monitoring -f
```

**What it monitors:**
- Beta signup flow (real browser test)
- Homepage load
- API connectivity
- JavaScript errors

**Alerts:** If any critical flow fails 2x in a row, you get email/SMS

## The "Would Have Caught It" Test

Ask yourself: **Would this test catch the bug if I ran it against broken production?**

| Test Type | Catches Localhost URL Bug? |
|-----------|----------------------------|
| Backend unit tests | ❌ No - tests backend only |
| API integration tests | ❌ No - direct HTTP, not browser |
| **Browser E2E tests** | ✅ **YES - browser sees the error** |

## Quick Commands

```bash
# Test production right now
./scripts/test-production.sh

# Test with screenshots on failure
npx playwright test e2e/critical-flows.spec.ts --config=e2e/production.config.ts --project=chromium --screenshot=only-on-failure

# Test all browsers
npx playwright test e2e/critical-flows.spec.ts --config=e2e/production.config.ts

# Debug a test (opens browser)
npx playwright test e2e/critical-flows.spec.ts --config=e2e/production.config.ts --project=chromium --debug

# View test results
npx playwright show-report test-results/production-html
```

## Adding New Tests

When you add a critical user flow, add a browser test:

```typescript
// e2e/critical-flows.spec.ts

test('New critical flow', async ({ page }) => {
  await page.goto('https://thunderbird.bot');

  // Simulate user actions
  await page.click('text=Some Button');
  await page.fill('input[name="field"]', 'value');
  await page.click('button[type="submit"]');

  // Verify expected outcome
  await expect(page.locator('text=Success')).toBeVisible();

  // CRITICAL: Check what should NOT appear
  await expect(page.locator('text=Error')).not.toBeVisible();
});
```

## Key Principle

**If a test doesn't use a real browser, it won't catch browser bugs.**

The 633 "passing" tests gave false confidence. The 7 browser tests catch real issues.
