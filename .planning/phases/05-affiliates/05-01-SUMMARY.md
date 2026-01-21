---
phase: 05-affiliates
plan: 01
subsystem: database
tags: [sqlite, alembic, affiliates, commissions, attribution, dataclass]

# Dependency graph
requires:
  - phase: 02-payments
    provides: "Payment models and Store pattern (DiscountCode, Order)"
provides:
  - "Affiliate, Commission, Attribution, AffiliateClick models with Store classes"
  - "Database migration for affiliate tables"
  - "DiscountCode extended with affiliate_id for code linking"
affects: [05-02, 05-03, 05-04, 05-05, 05-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "dataclass + Store pattern for affiliate models"
    - "30-day commission hold period"
    - "Trailing attribution with optional expiry"

key-files:
  created:
    - backend/app/models/affiliates.py
    - backend/alembic/versions/7af520d0f608_add_affiliate_tables.py
  modified:
    - backend/app/models/payments.py

key-decisions:
  - "Commission status flow: pending (30 days) -> available -> requested -> paid"
  - "Attribution uses unique constraint on account_id (one affiliate per account)"
  - "Trailing expiry NULL = forever, else expires after N months"
  - "Click deduplication via optional session_id"

patterns-established:
  - "Commission hold period: 30 days from order completion"
  - "SQLite datetime storage: ISO string format for compatibility"
  - "Store classes use contextmanager for connection handling"

# Metrics
duration: 3 min
completed: 2026-01-21
---

# Phase 05 Plan 01: Affiliate Database Foundation Summary

**Complete affiliate data models with 4 tables, commission hold logic, and discount code linking**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-21T15:36:25Z
- **Completed:** 2026-01-21T15:39:32Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Four affiliate model classes (Affiliate, Commission, Attribution, AffiliateClick) following payments.py pattern
- Complete Store classes with create, query, and update operations for each model
- Alembic migration creating all tables with proper indexes
- DiscountCode model extended with affiliate_id linking
- 30-day commission hold period with status tracking
- Trailing attribution support with optional expiry

## Task Commits

Each task was committed atomically:

1. **Task 1: Create affiliate models with dataclass + Store pattern** - `a2ff0b8` (feat)
2. **Task 2: Create Alembic migration for affiliate tables** - `2819ea8` (feat)
3. **Task 3: Update DiscountCode model with affiliate_id field** - `0ab2be2` (feat)

## Files Created/Modified
- `backend/app/models/affiliates.py` - Affiliate, Commission, Attribution, AffiliateClick models with Store classes
- `backend/alembic/versions/7af520d0f608_add_affiliate_tables.py` - Database migration for affiliate tables
- `backend/app/models/payments.py` - Added affiliate_id field to DiscountCode

## Decisions Made

**Commission hold period:** 30 days from creation before becoming available for payout. Protects against chargebacks.

**Attribution model:** Unique constraint on account_id ensures one affiliate per account. Prevents attribution conflicts.

**Trailing expiry:** NULL = forever, otherwise calculated as created_at + (trailing_months * 30 days). Flexible attribution windows.

**Status flow:** Commission lifecycle: pending -> available -> requested -> paid (with clawback option for refunds).

**Database indexes:** affiliate_id, status, account_id, created_at indexed for query performance on reporting and analytics.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all models and migrations created successfully.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 05-02: Backend endpoints for affiliate creation, commission tracking, and click analytics. All data layer foundation in place.

**Blockers:** None

**Notes:** Database migration tested with upgrade/downgrade cycle. All Store classes follow established patterns from payments.py.

---
*Phase: 05-affiliates*
*Completed: 2026-01-21*
