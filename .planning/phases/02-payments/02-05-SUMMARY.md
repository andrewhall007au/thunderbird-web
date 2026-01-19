---
phase: 02-payments
plan: 05
subsystem: payments
tags: [stripe, sms, balance, off-session, top-up]

# Dependency graph
requires:
  - phase: 02-03
    provides: Payment API router, Stripe webhook, order store
provides:
  - Stored card charging for off-session top-ups
  - BUY SMS command for top-up
  - Low balance warning system at $2
affects: [02-06, user-flows]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Off-session Stripe PaymentIntent for stored card charging
    - SMS command parsing with amount validation
    - Cooldown-based warning system to prevent spam

key-files:
  created: []
  modified:
    - backend/app/services/payments.py
    - backend/app/services/commands.py
    - backend/app/services/balance.py
    - backend/app/models/payments.py
    - backend/app/models/account.py

key-decisions:
  - "$10 only for SMS top-ups (simplifies validation, consistent segments)"
  - "24-hour cooldown for low balance warnings (prevents spam)"
  - "200 cents ($2) low balance threshold (enough for 3-4 texts)"

patterns-established:
  - "Off-session payments: charge_stored_card() with PaymentIntent API"
  - "SMS command validation: return helpful error for invalid inputs"
  - "Warning cooldown: in-memory tracking with production Redis note"

# Metrics
duration: 3min
completed: 2026-01-19
---

# Phase 2 Plan 5: Stored Card Top-ups and SMS BUY Command Summary

**Off-session Stripe charging with BUY $10 SMS command and low balance warning at $2**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-19T10:29:34Z
- **Completed:** 2026-01-19T10:32:56Z
- **Tasks:** 3/3
- **Files modified:** 5

## Accomplishments

- Stored card charging via PaymentIntent API for off-session top-ups (PAY-07, PAY-08)
- BUY SMS command with $10 validation and amount_cents in args
- Low balance warning at $2 with 24h cooldown to prevent spam
- Account model updated with stripe_customer_id field
- OrderStore update_payment_intent method for tracking

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement stored card charging for top-ups** - `5cc806c` (feat)
2. **Task 2: Add BUY command to SMS command parser** - `12bb9a0` (feat)
3. **Task 3: Implement low balance warning** - `43f6669` (feat)

## Files Created/Modified

- `backend/app/services/payments.py` - Added charge_stored_card() and quick_topup_web() methods
- `backend/app/services/commands.py` - Added CommandType.BUY and parsing logic
- `backend/app/services/balance.py` - Added check_and_warn_low_balance() and is_low_balance()
- `backend/app/models/payments.py` - Added update_payment_intent() to OrderStore
- `backend/app/models/account.py` - Added stripe_customer_id field to Account dataclass

## Decisions Made

1. **$10 only for SMS top-ups** - Simplifies validation, provides consistent segment estimates
2. **24-hour cooldown for warnings** - Prevents spam while ensuring users get notified
3. **200 cents threshold** - $2 is enough for approximately 3-4 SMS texts

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all verifications passed. Note: Pre-existing test failure in test_validation.py (message_log table) unrelated to this plan.

## User Setup Required

None - no external service configuration required. Uses existing Stripe configuration from Phase 2 Plan 3.

## Next Phase Readiness

- Payment flow complete: checkout, webhooks, balance, top-ups, warnings
- Ready for 02-06-PLAN.md: SMS cost verification against Twilio
- BUY command handler needs to be wired in webhook.py inbound SMS processing (done in later plan)

---
*Phase: 02-payments*
*Completed: 2026-01-19*
