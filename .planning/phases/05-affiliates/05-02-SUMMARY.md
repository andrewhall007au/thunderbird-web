---
phase: 05-affiliates
plan: 02
subsystem: payments
tags: [stripe, webhooks, commissions, affiliates]

# Dependency graph
requires:
  - phase: 05-01
    provides: Affiliate database models with commission tracking and attribution
provides:
  - AffiliateService with commission calculation on post-discount amounts
  - Stripe metadata integration for affiliate tracking through checkout flow
  - Webhook handlers for commission creation and clawback
  - Trailing attribution for recurring commissions on top-ups
affects: [05-03, 05-04, 05-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Commission calculation in webhook handlers (atomic with order fulfillment)"
    - "Post-discount commission calculation (AFFL-04 requirement)"
    - "30-day pending period before commission becomes available"
    - "Trailing attribution for recurring commissions"

key-files:
  created:
    - backend/app/services/affiliates.py
  modified:
    - backend/app/services/payments.py
    - backend/app/routers/webhook.py
    - backend/app/models/affiliates.py
    - backend/app/models/payments.py

key-decisions:
  - "Commission calculated atomically in webhook (not checkout creation) for accuracy"
  - "Trailing attribution created only for initial purchases"
  - "Clawback marks commissions as clawed_back (doesn't delete records)"

patterns-established:
  - "Commission calculation: AffiliateService.calculate_commission() in webhook handlers"
  - "Trailing check: get_active_attribution() checks expiry on top-up webhooks"
  - "Metadata flow: affiliate_id and sub_id passed through Stripe metadata"

# Metrics
duration: 10min
completed: 2026-01-21
---

# Phase 05 Plan 02: Affiliate Service & Webhook Integration Summary

**Commission tracking on Stripe webhooks with post-discount calculation, 30-day hold period, trailing attribution, and refund clawback**

## Performance

- **Duration:** 10 min
- **Started:** 2026-01-21T07:41:25Z
- **Completed:** 2026-01-21T07:43:48Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- AffiliateService implements commission calculation on post-discount amounts (AFFL-04)
- Commissions created atomically with order fulfillment in Stripe webhooks
- Trailing attribution enables recurring commissions on top-ups
- Refund handling claws back commissions automatically
- 30-day pending period protects against chargebacks

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement AffiliateService with commission calculation** - `1f0601c` (feat)
2. **Task 2: Add affiliate metadata to Stripe checkout** - `e2e055a` (feat)
3. **Task 3: Integrate commission calculation into Stripe webhooks** - `e189e7c` (feat)

## Files Created/Modified
- `backend/app/services/affiliates.py` - AffiliateService with calculate_commission(), create_attribution(), get_active_attribution(), clawback_commission(), record_click()
- `backend/app/services/payments.py` - Added affiliate_id and sub_id parameters to all checkout session methods
- `backend/app/routers/webhook.py` - Commission creation in handle_checkout_completed(), trailing commissions in handle_payment_succeeded(), clawback in handle_charge_refunded()
- `backend/app/models/affiliates.py` - Added CommissionStore.get_by_order_id(), update_status(), ClickStore.get_recent_by_session()
- `backend/app/models/payments.py` - Added OrderStore.get_by_payment_intent()

## Decisions Made

1. **Commission calculated in webhook, not checkout creation**
   - Rationale: Ensures accuracy (calculated on actual paid amount post-discount), prevents fraud (only creates commission when payment succeeds)

2. **Trailing attribution only for initial purchases**
   - Rationale: Initial purchase establishes relationship, top-ups check for existing attribution

3. **Clawback marks as clawed_back rather than deleting**
   - Rationale: Maintains audit trail, allows reporting on clawed_back commissions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for affiliate management endpoints (05-03). Core business logic complete:
- Commission calculation working on post-discount amounts
- 30-day pending period implemented
- Trailing attribution tracking active
- Refund clawback functional

**No blockers for next plan.**

---
*Phase: 05-affiliates*
*Completed: 2026-01-21*
