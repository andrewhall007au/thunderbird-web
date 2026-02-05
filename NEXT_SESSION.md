# Next Session: Fix Analytics Endpoint

## Current Status (2026-02-05)

**DEPLOYED TO PRODUCTION ✓**

- **6/7 E2E tests passing** (up from 2/7)
- **CSP fixes deployed** - worker-src and tiles.openfreemap.org working
- **Frontend builds on GitHub Actions** - memory issues resolved
- **658 backend tests passing**
- **Latest commit:** `662382b` - "fix(ci): copy nginx config to sites-enabled"

## Next Critical Item: Analytics Endpoint Failure

### The Problem

Test 3 "API endpoints are reachable from frontend" fails because:
```
POST https://thunderbird.bot/api/analytics
→ Network request fails (requestfailed event)
```

**Expected:** 0 failed requests
**Actual:** 1 failed request (analytics)

### Why It Matters

- E2E tests should all pass before considering deployment stable
- Analytics endpoint may have deeper issues affecting user tracking
- Other API endpoints work fine, so this is specific to analytics

### Context

**Analytics is designed to fail silently:**
- `app/lib/analytics.ts:152-154` has `.catch(() => {})`
- Fire-and-forget pattern - doesn't block UI
- But network failure suggests endpoint problem, not just silent error

**Similar issues fixed earlier:**
- Affiliate endpoints had missing table errors
- Added error handling in `backend/app/services/affiliates.py`
- Analytics may need same treatment

### Investigation Steps

1. **Check if analytics table exists in production:**
   ```bash
   ssh production
   cd /root/thunderbird-web/backend
   source venv/bin/activate
   python -c "from app.models.analytics import analytics_store; analytics_store.get_all()"
   ```

2. **Test endpoint directly:**
   ```bash
   curl -X POST https://thunderbird.bot/api/analytics \
     -H "Content-Type: application/json" \
     -d '{"event":"test","variant":"A","entry_path":"organic"}'
   ```

3. **Check backend logs:**
   ```bash
   journalctl -u thunderbird-api -n 100 | grep analytics
   ```

4. **Review endpoint code:**
   - `backend/app/routers/analytics.py:26-57` - POST /api/analytics
   - `backend/app/models/analytics.py:69-83` - Table creation
   - Check if table initialization happens at startup

### Files Involved

- `backend/app/routers/analytics.py` - Endpoint handler
- `backend/app/models/analytics.py` - Database store
- `backend/app/main.py` - Router registration (line 352)
- `app/lib/analytics.ts` - Frontend client
- `e2e/critical-flows.spec.ts:75-109` - Test that's failing

### Likely Fix Options

**Option A:** Add error handling (like affiliates fix)
```python
# In analytics.py POST handler
try:
    analytics_store.create(...)
except Exception as e:
    logger.error(f"Analytics error: {e}")
    # Return 201 anyway - analytics should never block
    return Response(status_code=201)
```

**Option B:** Ensure table initialization at startup
```python
# In main.py or analytics.py
analytics_store.ensure_table_exists()
```

**Option C:** Make test less strict (last resort)
```typescript
// Ignore analytics failures since it's fire-and-forget
const criticalFailedRequests = failedRequests.filter(
  url => !url.includes('/api/analytics')
);
expect(criticalFailedRequests).toHaveLength(0);
```

### Success Criteria

- [ ] `/api/analytics` endpoint returns 201 (not network error)
- [ ] Test 3 "API endpoints are reachable" passes
- [ ] 7/7 E2E tests passing
- [ ] No errors in production logs
- [ ] Analytics events successfully stored in database

---

## How to Continue

1. Run `/clear` to start fresh context
2. Read this file: `cat NEXT_SESSION.md`
3. Start investigation with step 1 above
4. Fix endpoint and add error handling
5. Deploy and verify all 7 tests pass

## Quick Reference

**Production URL:** https://thunderbird.bot
**GitHub Repo:** https://github.com/andrewhall007au/thunderbird-web
**Latest Deploy:** Run `gh run list --workflow=deploy.yml --limit 1` to check status
**View Tests:** Run `gh run view [ID] --log-failed` to see test failures
