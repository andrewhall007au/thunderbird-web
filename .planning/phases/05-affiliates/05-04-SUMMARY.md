---
phase: 05-affiliates
plan: 04
subsystem: api
tags: [fastapi, affiliates, analytics, cookies, attribution]

# Dependency graph
requires:
  - phase: 05-affiliates
    plan: 02
    provides: Commission tracking and attribution models
  - phase: 05-affiliates
    plan: 03
    provides: Admin console and checkout integration
provides:
  - Affiliate dashboard API endpoints with period filtering
  - Affiliate landing page with click tracking
  - Click deduplication using session cookies
  - Campaign tracking via sub_id parameter
affects: [05-05-reporting, 05-06-affiliate-portal]

# Tech tracking
tech-stack:
  added: []
  patterns: [cookie-based-attribution, session-deduplication, aggregate-analytics]

key-files:
  created:
    - backend/app/routers/affiliates.py
    - backend/app/routers/affiliate_landing.py
  modified:
    - backend/app/services/affiliates.py
    - backend/app/models/affiliates.py
    - backend/app/main.py

key-decisions:
  - "Cookie-based attribution with 7-day tb_affiliate cookie for checkout flow"
  - "Session-based click deduplication using 24-hour tb_session cookie"
  - "Aggregate-only conversion data exposed via API (no personal info)"
  - "Period filtering supports today, 7d, 30d, all for dashboard views"
  - "Sub_id parameter enables granular campaign tracking (e.g., FB vs IG)"

patterns-established:
  - "AffiliateStats dataclass provides comprehensive dashboard metrics"
  - "ClickStore.count_unique_by_affiliate() uses DISTINCT session_id for unique counts"
  - "CommissionStore query helpers: count_conversions(), sum_by_status()"
  - "Topup detection: compare attribution.order_id with commission.order_id"

# Metrics
duration: 3min
completed: 2026-01-21
---

# Phase 05 Plan 04: Click Tracking & Analytics Summary

**Affiliate dashboard API with period filtering, landing page click tracking with session deduplication, and campaign-level analytics via sub_id**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-21T07:50:25Z
- **Completed:** 2026-01-21T07:53:23Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Affiliate dashboard API with comprehensive stats (clicks, conversions, earnings by status)
- Public landing page that records clicks and sets attribution cookies
- Session-based click deduplication (24-hour window)
- Campaign tracking with sub_id for granular performance analysis
- Period filtering (today, 7d, 30d, all) for dashboard time ranges

## Task Commits

Each task was committed atomically:

1. **Task 1: Add affiliate stats methods to AffiliateService** - `1d0b717` (feat)
2. **Task 2: Create affiliate dashboard API router** - `1a39ecd` (feat)
3. **Task 3: Create affiliate landing page with click tracking** - `5e540a9` (feat)

## Files Created/Modified

- `backend/app/services/affiliates.py` - Added AffiliateStats dataclass, get_affiliate_stats(), get_recent_conversions()
- `backend/app/models/affiliates.py` - Added count_unique_by_affiliate(), count_conversions(), sum_by_status()
- `backend/app/routers/affiliates.py` - Dashboard API endpoints: /api/affiliates/stats/{code}, /api/affiliates/conversions/{code}, /api/affiliates/summary/{code}
- `backend/app/routers/affiliate_landing.py` - Landing page: /ref/{code}, /ref/{code}/{sub_id}, /api/affiliate/validate
- `backend/app/main.py` - Registered affiliates and affiliate_landing routers

## Decisions Made

**Cookie-based attribution with 7-day expiry**
- tb_affiliate cookie set on landing page visit
- Checkout flow reads cookie for attribution
- 7-day window balances conversion tracking with privacy

**Session-based click deduplication**
- tb_session cookie (24-hour expiry) prevents duplicate click counting
- Same session visiting multiple times only counts once per 24h
- Protects against inflated click metrics

**Aggregate-only conversion data**
- get_recent_conversions() returns amount, status, date, sub_id
- No account_id or order_id exposed to affiliates
- Privacy-preserving analytics

**Period filtering for dashboard**
- Supports: today, 7d, 30d, all
- Enables affiliates to track short-term campaign performance
- All-time view for lifetime earnings

**Campaign tracking via sub_id**
- /ref/{code}/{sub_id} enables granular tracking
- Example: /ref/PARTNER/FB vs /ref/PARTNER/IG
- Helps affiliates optimize channel performance

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**FastAPI deprecation warning**
- Issue: Query parameter used `regex=` which is deprecated in favor of `pattern=`
- Fix: Changed `regex="^(today|7d|30d|all)$"` to `pattern="^(today|7d|30d|all)$"`
- Impact: Eliminated deprecation warning, no functional change

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for 05-05 (Reporting & Payout Management):**
- Stats queries in place for export/reporting
- Commission status tracking ready for payout workflows
- Sub_id tracking enables campaign performance reports

**Ready for 05-06 (Affiliate Portal):**
- Dashboard API endpoints ready for frontend integration
- Cookie-based attribution enables self-service signup flow
- Validate endpoint supports code verification in UI

**No blockers or concerns.**

---
*Phase: 05-affiliates*
*Completed: 2026-01-21*
