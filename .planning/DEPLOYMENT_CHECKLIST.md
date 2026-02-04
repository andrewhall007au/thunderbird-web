# Deployment Checklist

Use this checklist before every production deployment to prevent issues like the BetaApplyModal bug.

## Pre-Deployment Checks

### 1. Environment Variables
- [ ] Verify all required environment variables are set in production
- [ ] Check NEXT_PUBLIC_API_URL is configured correctly (or intentionally empty for relative URLs)
- [ ] Confirm database connection strings are production-ready
- [ ] Validate API keys and secrets are production values (not dev/test)
- [ ] Ensure Stripe keys are production keys (not test mode)

### 2. Code Quality
- [ ] All tests pass locally: `npm test` and `npm run test:e2e`
- [ ] No localhost URLs hardcoded in production code
- [ ] No debug console.logs in production code
- [ ] No commented-out code blocks
- [ ] TypeScript builds without errors: `npm run build`

### 3. Test Coverage
- [ ] Unit tests exist for all new components with API calls
- [ ] E2E tests exist for all new user flows
- [ ] Critical paths have test coverage (signup, checkout, main features)
- [ ] Tests run against production-like environment, not just localhost

### 4. Security
- [ ] CORS whitelist includes production domain
- [ ] Rate limiting is configured and tested
- [ ] XSS protection is active
- [ ] No sensitive data in client-side code
- [ ] No API keys or secrets in frontend code

### 5. API Integration
- [ ] All API endpoints tested with production-like URLs
- [ ] Error handling covers network failures
- [ ] Timeout configurations are production-appropriate
- [ ] API responses are validated and typed

## Deployment Steps

### 1. Pre-Deploy
- [ ] Run full test suite: `npm test`
- [ ] Run E2E tests: `npm run test:e2e`
- [ ] Build succeeds: `npm run build`
- [ ] Check git status - no uncommitted changes
- [ ] Review CHANGELOG for this release

### 2. Deploy
- [ ] Merge to main (triggers GitHub Actions)
- [ ] Monitor GitHub Actions workflow
- [ ] Watch for deployment completion
- [ ] Check systemd service restart succeeds

### 3. Post-Deploy Smoke Tests
- [ ] Backend health check: `curl https://thunderbird.bot/health`
- [ ] Frontend loads: Visit https://thunderbird.bot in browser
- [ ] Critical user flows work:
  - [ ] Beta signup form submits successfully
  - [ ] Login/logout works
  - [ ] Checkout flow initiates
  - [ ] API calls succeed (check browser network tab)

### 4. Monitoring
- [ ] Check server logs for errors: `journalctl -u overland -n 100 --no-pager`
- [ ] Monitor error rates in production
- [ ] Check database connections are healthy
- [ ] Verify external services (Stripe, Twilio, etc.) are responding

## Rollback Plan

If something goes wrong:

### Quick Rollback
```bash
ssh root@thunderbird.bot
cd /root/overland-weather
git checkout [previous-commit-hash]
npm run build
systemctl restart overland
```

### GitHub Actions Rollback
- Revert the merge commit on main
- Push to trigger redeployment of previous version

## Common Issues & Solutions

### Issue: "Network error" in browser
**Cause:** API_BASE pointing to unreachable URL (like localhost in production)
**Fix:** Ensure NEXT_PUBLIC_API_URL is empty string for relative URLs, or set to production API URL

### Issue: CORS errors
**Cause:** Production domain not in CORS whitelist
**Fix:** Add domain to backend CORS configuration

### Issue: 500 errors after deployment
**Cause:** Environment variables not set, database migration needed
**Fix:** Check env vars, run migrations if needed

### Issue: Service won't restart
**Cause:** Port conflict, syntax error in code
**Fix:** Check logs, verify port 8000 available, check syntax errors

## Test Automation Improvements

After each deployment issue, add tests to prevent recurrence:

1. **Add unit test** for the component/function that failed
2. **Add E2E test** for the user flow that failed
3. **Update smoke tests** to catch the failure mode
4. **Document the issue** in this checklist

## Success Criteria

Deployment is successful when:
- ✅ All automated tests pass
- ✅ Production smoke tests pass
- ✅ No errors in server logs for 10 minutes post-deploy
- ✅ Critical user flows manually verified
- ✅ Monitoring shows normal metrics

---

**Last Updated:** 2026-02-04
**Maintained By:** Development Team
