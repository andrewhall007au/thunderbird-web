---
phase: 02-payments
plan: 02
subsystem: payments
tags: [stripe, pricing, balance, checkout, dynamic-pricing]

# Dependency graph
requires:
  - phase: 02-01
    provides: Payment models, OrderStore, BalanceStore, discount_code_store
provides:
  - DynamicPricingService with launch/RRP/sale modes
  - BalanceService for atomic balance tracking
  - PaymentService with Stripe checkout integration
affects: [02-03 webhooks, 02-04 API router, user-flows]

# Tech tracking
tech-stack:
  added: [stripe-python]
  patterns: [singleton services, async payment methods, graceful degradation]

key-files:
  created:
    - backend/app/services/pricing_dynamic.py
    - backend/app/services/balance.py
  modified:
    - backend/app/services/payments.py
    - backend/config/settings.py
    - backend/app/models/payments.py

key-decisions:
  - "PricingConfig as class constants for admin-configurable pricing"
  - "Graceful degradation when Stripe not configured"
  - "setup_future_usage: off_session for card saving"

patterns-established:
  - "Service singleton pattern with get_*_service() functions"
  - "Async payment methods for Stripe API calls"
  - "PaymentResult/BalanceResult dataclasses for operation results"

# Metrics
duration: 3min
completed: 2026-01-19
---

# Phase 2 Plan 02: Payment Services Summary

**Dynamic pricing service, balance tracking, and Stripe checkout integration with graceful degradation when unconfigured**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-19T10:19:26Z
- **Completed:** 2026-01-19T10:22:43Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- DynamicPricingService with launch ($29.99), RRP ($49.99), and sale modes (PAY-02)
- Discount code validation that stacks with launch pricing (PAY-03/04)
- BalanceService with atomic add_credits/deduct and transaction logging (PAY-06)
- PaymentService with Stripe Checkout session creation (PAY-01)
- Top-up checkout for $10 balance blocks (PAY-07)
- Card saving via setup_future_usage for future off-session payments

## Task Commits

Each task was committed atomically:

1. **Task 1: Create dynamic pricing service** - `d48d8ec` (feat)
2. **Task 2: Create balance tracking service** - `6d0da2d` (feat)
3. **Task 3: Update payment service with Stripe checkout** - `e4b1fe1` (feat)

## Files Created/Modified

- `backend/app/services/pricing_dynamic.py` - Dynamic pricing with launch/RRP/sale modes, discount validation
- `backend/app/services/balance.py` - Balance tracking service with atomic operations
- `backend/app/services/payments.py` - Stripe checkout session creation, top-up support
- `backend/config/settings.py` - PricingConfig class, Stripe configuration
- `backend/app/models/payments.py` - update_stripe_session method added to OrderStore

## Decisions Made

1. **PricingConfig as class constants** - Allows admin to adjust pricing modes without code changes
2. **Graceful degradation without Stripe** - Services return clear error when Stripe not configured, enabling tests to run without credentials
3. **setup_future_usage: off_session** - Saves card during checkout for future top-ups without re-authentication
4. **allow_promotion_codes: True** - Uses Stripe's built-in discount code UI instead of custom implementation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Stripe library not installed in environment - handled gracefully with try/except import and feature detection. Services work without Stripe for testing purposes.

## User Setup Required

**External services require manual configuration.** The following environment variables need to be set:

| Variable | Source |
|----------|--------|
| `STRIPE_SECRET_KEY` | Stripe Dashboard -> Developers -> API keys -> Secret key |
| `STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard -> Developers -> API keys -> Publishable key |

Stripe webhook secret will be configured in Plan 03.

## Next Phase Readiness

- Payment services ready for API router integration (Plan 03)
- Stripe webhook handler needed to complete payment flow
- All existing tests pass (301 passed)

---
*Phase: 02-payments*
*Completed: 2026-01-19*
