# Production Bug Postmortem: BetaApplyModal Network Error

**Date:** 2026-02-04
**Severity:** High (Critical user flow broken in production)
**Status:** Resolved

---

## Executive Summary

A production bug prevented users from signing up for beta access on thunderbird.bot. The bug was caused by hardcoded localhost URLs in frontend components that worked in development but failed in production when environment variables were not set.

**Impact:**
- All beta signup attempts failed with "Network error"
- Affected 100% of users attempting to sign up
- Unknown duration (caught quickly during testing)

**Root Cause:**
```typescript
// BetaApplyModal.tsx and 7 other files
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
```

When `NEXT_PUBLIC_API_URL` was not set in production, browsers tried to call `http://localhost:8000/api/beta/apply`, which failed because localhost is not reachable from client browsers on production.

---

## Timeline

1. **Initial Report:** User attempted beta signup on thunderbird.bot, got "Network error"
2. **Investigation:** Identified API_BASE defaulting to localhost in BetaApplyModal.tsx
3. **Fix Applied:** Changed default from localhost to empty string (relative URLs)
4. **Attempted Deployment:** Created deploy script, blocked by SSH permissions
5. **Root Cause Analysis:** Discovered this same pattern in 7 other components
6. **Comprehensive Fix:** Fixed all 8 components, added tests, updated deployment process

---

## Root Cause Analysis

### The Five Whys

1. **Why did beta signup fail in production?**
   - Because API calls went to `http://localhost:8000` which browsers couldn't reach

2. **Why did it call localhost?**
   - Because `NEXT_PUBLIC_API_URL` wasn't set and code defaulted to localhost

3. **Why wasn't this caught in testing?**
   - No unit tests for BetaApplyModal component
   - No E2E tests for beta signup flow
   - Smoke tests only tested localhost, not production URL

4. **Why wasn't there test coverage?**
   - Testing was focused on backend, not frontend API integration
   - Spec alignment only validated backend endpoints

5. **Why did we use localhost as fallback?**
   - Dev-centric thinking: made local development easy but was unsafe for production

### Contributing Factors

1. **Implicit assumptions:** Assumed env var would always be set in production
2. **Dev-friendly defaults:** Localhost fallback optimized for dev, not production safety
3. **Incomplete test coverage:** Critical user flow untested
4. **Missing validation:** No build-time or runtime checks for required env vars
5. **Spec gap:** Frontend API integration not in specification
6. **Smoke test gap:** Only tested localhost, not actual production deployment

---

## Impact Assessment

### User Impact
- **Severity:** Complete blocker for beta signups
- **Scope:** All users on production site
- **Duration:** Unknown (caught during internal testing)
- **Workaround:** None available to users

### Business Impact
- No users could sign up for beta during affected period
- Could have caused significant user frustration if live longer
- Potential reputation damage if users perceived service as broken

### Technical Impact
- 8 components had the same vulnerability
- All frontend API calls were at risk of similar issues
- Deployment process gaps exposed

---

## Resolution

### Immediate Fix
Fixed BetaApplyModal.tsx to use empty string (relative URLs):
```typescript
// Before
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// After
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
```

### Comprehensive Fix
1. **Fixed 7 additional components** with same pattern:
   - app/account/page.tsx
   - app/reset-password/page.tsx
   - app/lib/auth.tsx
   - app/_checkout/page.tsx
   - app/login/page.tsx
   - app/_checkout/success/page.tsx
   - app/components/paywall/PaywallModal.tsx

2. **Added comprehensive unit tests:**
   - Created `BetaApplyModal.test.tsx` with 14 test cases
   - Tests cover API calls with/without env var
   - Tests verify relative URLs when env var not set

3. **Added E2E tests:**
   - Created `beta-signup-flow.spec.ts` with 8 test scenarios
   - Tests full user flow from click to success
   - Tests against production-like URLs

4. **Added production smoke tests:**
   - Created `smoke_test_production.py`
   - Tests actual production URL (not localhost)
   - Covers critical paths: beta signup, checkout, weather API

5. **Updated deployment workflow:**
   - GitHub Actions now runs production smoke tests post-deploy
   - Tests verify actual deployment, not just localhost

6. **Added environment validation:**
   - next.config.js warns if NEXT_PUBLIC_API_URL not set in production
   - Ensures developers are aware of configuration

7. **Created documentation:**
   - Deployment checklist for future deployments
   - Test coverage report to track gaps
   - This postmortem for learning

---

## Prevention Measures

### Process Improvements

1. **Test Coverage Requirements**
   - All components with API calls require unit tests
   - All user flows require E2E tests
   - Use deployment checklist before every deploy

2. **Code Review Standards**
   - Flag any `process.env` with fallback values
   - Require production-safe defaults (empty strings, not localhost)
   - Verify test coverage for changed components

3. **Deployment Validation**
   - Smoke tests must test production URL
   - E2E tests run against production-like environment
   - Manual verification of critical flows post-deploy

4. **Environment Configuration**
   - Document required env vars
   - Validate env vars at build time
   - Warn when production configs missing

### Technical Improvements

1. **Better Defaults**
   - Use empty strings for production-safe relative URLs
   - Never default to localhost in client-side code
   - Fail loudly if critical config missing

2. **Comprehensive Testing**
   - Unit tests for all API-calling components
   - E2E tests for all user flows
   - Production smoke tests on every deploy

3. **Monitoring & Alerting**
   - Monitor for network errors in production
   - Alert on elevated error rates
   - Track critical user flow completion rates

---

## Lessons Learned

### What Went Well
- Bug caught quickly during testing
- Root cause identified immediately
- Comprehensive fix applied (not just Band-Aid)
- Thorough postmortem conducted

### What Didn't Go Well
- Bug made it to production
- Same pattern existed in 7 other files
- Test coverage gaps allowed this to slip through
- No production smoke tests before this incident

### What We'll Do Differently
1. **Write tests first:** Especially for user-facing features
2. **Test production configs:** Don't just test localhost
3. **Use safe defaults:** Production-safe, not dev-convenient
4. **Validate environment:** Check env vars at build time
5. **Audit for patterns:** When fixing one bug, find similar issues

---

## Action Items

### Completed ✅
- [x] Fix BetaApplyModal.tsx API_BASE
- [x] Fix 7 other components with same pattern
- [x] Add BetaApplyModal unit tests
- [x] Add beta signup E2E tests
- [x] Add production smoke tests
- [x] Update deployment workflow
- [x] Add env var validation
- [x] Create deployment checklist
- [x] Create test coverage report
- [x] Write postmortem

### Follow-Up Tasks
- [ ] Deploy fixes to production (merge v1.1 to main)
- [ ] Run production smoke tests on live site
- [ ] Monitor error rates for 48 hours post-deploy
- [ ] Add unit tests for remaining untested components
- [ ] Configure multi-browser E2E testing
- [ ] Add Lighthouse CI for performance monitoring
- [ ] Quarterly review of test coverage

---

## References

- **Fixed Components:** 8 total (BetaApplyModal + 7 others)
- **Tests Added:** 14 unit tests, 8 E2E tests, 13 smoke tests
- **Documentation:** Deployment checklist, test coverage report
- **Related Issues:** None (first occurrence)

---

**Prepared By:** Development Team
**Reviewed By:** [To be filled]
**Approved By:** [To be filled]

**Distribution:** All engineering team members

---

## Appendix: Code Changes

### Files Modified
```
app/components/beta/BetaApplyModal.tsx (fixed)
app/account/page.tsx (fixed)
app/reset-password/page.tsx (fixed)
app/lib/auth.tsx (fixed)
app/_checkout/page.tsx (fixed)
app/login/page.tsx (fixed)
app/_checkout/success/page.tsx (fixed)
app/components/paywall/PaywallModal.tsx (fixed)
next.config.js (added validation)
.github/workflows/deploy.yml (added production smoke tests)
```

### Files Created
```
app/components/beta/BetaApplyModal.test.tsx (14 tests)
e2e/beta-signup-flow.spec.ts (8 tests)
backend/tests/smoke_test_production.py (13 tests)
.planning/DEPLOYMENT_CHECKLIST.md
.planning/TEST_COVERAGE_REPORT.md
PRODUCTION_BUG_POSTMORTEM.md (this document)
```

### Test Coverage Impact
- **Before:** 0 tests for beta signup flow
- **After:** 14 unit tests + 8 E2E tests + 13 smoke tests = 35 tests
- **Overall Coverage:** ~60% → targeting 85%
