# Project State: Thunderbird Global

**Last updated:** 2026-01-19
**Current phase:** Phase 2 (Payments) - In Progress

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-01-19)

**Core value:** Hikers anywhere in the world can create a custom route and receive accurate, location-specific weather forecasts via SMS — even in areas with no cell coverage.

**Current focus:** Payment foundation complete (models, pricing, tables), ready for Stripe integration

## Current Position

Phase: 2 of 6 (Payments)
Plan: 1 of 6 in current phase
Status: In progress
Last activity: 2026-01-19 - Completed 02-01-PLAN.md

Progress: █████░░░░░ 20%

## Phase Status

| Phase | Name | Status | Progress |
|-------|------|--------|----------|
| 1 | Foundation | Complete | 4/4 plans |
| 2 | Payments | In progress | 1/6 plans |
| 3 | Route Creation | Not started | 0/? plans |
| 4 | User Flows | Not started | 0/? plans |
| 5 | Affiliates | Not started | 0/? plans |
| 6 | International Weather | Not started | 0/? plans |

## Recent Decisions

| Date | Decision | Context |
|------|----------|---------|
| 2026-01-19 | Hundredths of cent for SMS pricing | Sub-cent precision without floating point |
| 2026-01-19 | Ceiling rounding on SMS costs | Protects 80% margin on every transaction |
| 2026-01-19 | Canadian area code detection | Distinguishes +1 CA from +1 US for pricing |
| 2026-01-19 | Reuse PhoneUtils for normalization | Phone linking uses existing sms.py utility |
| 2026-01-19 | Phone lookup requires auth | Prevents enumeration attacks |
| 2026-01-19 | Argon2 via pwdlib (not bcrypt) | Modern password hashing, faster and more secure |
| 2026-01-19 | Account model separate from User | Web login (email/pwd) vs SMS hikers (phone) |
| 2026-01-19 | Fork model (not multi-tenant) | Simpler architecture, evolves independently |
| 2026-01-19 | $29.99 launch, $49.99 RRP | Dynamic pricing with admin configuration |

## Blockers

None currently.

## Planning Documents

- `.planning/PROJECT.md` — Project context and requirements
- `.planning/REQUIREMENTS.md` — 53 v1 requirements with traceability
- `.planning/ROADMAP.md` — 6 phases with dependencies
- `.planning/research/` — Stack, features, architecture, pitfalls research
- `.planning/codebase/` — Existing codebase documentation

## Session Continuity

Last session: 2026-01-19 10:17Z
Stopped at: Completed 02-01-PLAN.md (Payment models and SMS pricing)
Resume file: None

## Session Handoff

**What was done (02-01):**
- Payment model dataclasses: Order, AccountBalance, DiscountCode, Transaction, CountrySMSCost
- Store classes: OrderStore, BalanceStore, DiscountCodeStore
- SMS pricing config for 8 countries (80% margin maintained)
- Phone-to-country detection for E.164 numbers
- Alembic migration for payment tables
- stripe_customer_id added to accounts table

**What's next:**
1. 02-02-PLAN.md: Dynamic pricing service, balance tracking, Stripe checkout
2. 02-03-PLAN.md: Payment API router and Stripe webhook handler
3. Continue through Wave 2-4 of Phase 2

**Key files created:**
- `backend/app/models/payments.py` - Payment dataclasses and stores
- `backend/config/sms_pricing.py` - Country SMS costs
- `alembic/versions/842752b6b27d_add_payment_tables.py` - Migration

**Key risks to monitor:**
- SMS margin erosion across countries (verify Twilio rates before launch)
- Stripe webhook reliability (implement idempotency)
- Off-session payment failures (handle 3DS requirements)

---
*State initialized: 2026-01-19*
