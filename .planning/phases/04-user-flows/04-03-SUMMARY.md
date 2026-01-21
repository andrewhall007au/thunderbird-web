---
phase: 04-user-flows
plan: 03
subsystem: payments, ui
tags: [stripe, checkout, conversion-flow, analytics, next.js]

# Dependency graph
requires:
  - phase: 04-01
    provides: Analytics tracking utilities (initPathTracking, trackEvent)
  - phase: 02-payments
    provides: Stripe integration, payment service, order model
provides:
  - "Buy Now" conversion path (FLOW-03)
  - Checkout page with Stripe redirect (not card collection)
  - Success page with payment verification
  - Entry path tracking through to Stripe metadata
affects: [04-create-first-flow, analytics-dashboard, user-onboarding]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stripe Checkout redirect flow (not embedded Elements)"
    - "entry_path tracking through conversion funnel"
    - "Combined account creation + checkout endpoint"

key-files:
  created:
    - app/checkout/success/page.tsx
  modified:
    - app/page.tsx
    - app/checkout/page.tsx
    - backend/app/routers/payments.py
    - backend/app/services/payments.py

key-decisions:
  - "Stripe Checkout redirect (not embedded Elements) for simplicity and trust"
  - "Combined /api/payments/buy-now endpoint creates account + checkout in one step"
  - "entry_path tracked in Stripe metadata for conversion attribution"
  - "Success page verifies payment via session endpoint before showing success"

patterns-established:
  - "Conversion flow pattern: track path -> collect account -> redirect to Stripe -> verify on return"
  - "useSearchParams wrapped in Suspense for Next.js static generation"

# Metrics
duration: 5min
completed: 2026-01-21
---

# Phase 4 Plan 03: Buy Now Conversion Path Summary

**Complete "Buy Now" conversion flow from landing to checkout success with entry path tracking through Stripe metadata**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-21T03:30:26Z
- **Completed:** 2026-01-21T03:35:49Z
- **Tasks:** 3
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- Landing page Buy Now buttons all track entry path (?path=buy)
- Added "Or Create Your Route First" secondary CTA
- Checkout page now redirects to Stripe Checkout (removed local card collection)
- New /api/payments/buy-now endpoint handles account creation + Stripe session in one call
- Success page verifies payment and shows appropriate messaging based on entry path
- entry_path tracked through entire funnel to Stripe metadata for analytics

## Task Commits

Each task was committed atomically:

1. **Task 1: Update landing page Buy Now links** - `7aa8a0d` (feat)
2. **Task 2: Connect checkout to Stripe flow** - `4a07012` (feat)
3. **Task 3: Create checkout success page** - `97966a0` (feat)

## Files Created/Modified

- `app/page.tsx` - Added path=buy to all Buy Now links, secondary create CTA, analytics init
- `app/checkout/page.tsx` - Rewrote to redirect to Stripe (no card inputs), handles logged-in users
- `app/checkout/success/page.tsx` - NEW: Verifies payment, shows success UI with next steps
- `backend/app/routers/payments.py` - Added /buy-now and /session/{id} endpoints
- `backend/app/services/payments.py` - Added create_checkout_session_with_metadata method

## Decisions Made

1. **Stripe Checkout redirect** - Using Stripe's hosted checkout page instead of Stripe Elements. Simpler, more trusted by users, handles all PCI compliance.

2. **Combined buy-now endpoint** - Single POST /api/payments/buy-now creates account AND Stripe session. Reduces round trips, ensures atomic operation.

3. **entry_path in Stripe metadata** - Pass through the conversion path (buy/create/organic) to Stripe so it's available in webhook and for attribution.

4. **Session verification on success** - Success page verifies session_id with backend before showing success UI. Prevents fake success displays.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Stripe credentials were already configured in Phase 2.

## Next Phase Readiness

- Buy Now path complete and ready for production
- Analytics tracking events in place (page_view, checkout_started, purchase_completed)
- Ready for Create-First flow (04-02) to implement the alternative conversion path
- Stripe metadata includes entry_path for future analytics dashboard

---
*Phase: 04-user-flows*
*Completed: 2026-01-21*
