# Project State: Thunderbird Global

**Last updated:** 2026-01-21
**Current phase:** Phase 5 (Affiliates) - IN PROGRESS

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-01-19)

**Core value:** Hikers anywhere in the world can create a custom route and receive accurate, location-specific weather forecasts via SMS — even in areas with no cell coverage.

**Current focus:** Phase 5 (Affiliates) in progress. Database foundation complete with affiliate models, commission tracking, and attribution system.

## Current Position

Phase: 5 of 6 (Affiliates)
Plan: 1 of 6 in current phase
Status: In progress
Last activity: 2026-01-21 - Completed 05-01-PLAN.md

Progress: ███████████████░░ 87%

## Phase Status

| Phase | Name | Status | Progress |
|-------|------|--------|----------|
| 1 | Foundation | Complete | 4/4 plans |
| 2 | Payments | Complete | 6/6 plans |
| 3 | Route Creation | Complete | 7/7 plans |
| 4 | User Flows | Complete | 5/5 plans |
| 5 | Affiliates | In progress | 1/6 plans |
| 6 | International Weather | Not started | 0/? plans |

## Recent Decisions

| Date | Decision | Context |
|------|----------|---------|
| 2026-01-21 | Commission hold period 30 days | Protects against chargebacks before payout |
| 2026-01-21 | One affiliate per account (unique constraint) | Attribution model prevents conflicts |
| 2026-01-21 | Trailing expiry NULL = forever | Flexible attribution windows for different affiliate arrangements |
| 2026-01-21 | Query functions return pre-calculated rates | Analytics queries include conversion_rate so consumers don't calculate |
| 2026-01-21 | CLI supports text and JSON output | Text for human review, JSON for programmatic use |
| 2026-01-21 | Daily events query is generic | Takes event_type param for any event charting |
| 2026-01-21 | Device sections structured by platform | iPhone, Watch, Android each get dedicated sections on /compatibility |
| 2026-01-21 | Carrier table shows partnership status | Active vs Coming status badges for satellite partnerships |
| 2026-01-21 | WhySMS positioned after Hero | Immediately reinforces value proposition after device previews |
| 2026-01-21 | Stripe Checkout redirect (not Elements) | Simpler, more trusted, handles PCI compliance |
| 2026-01-21 | Combined buy-now endpoint | Single call creates account + Stripe session |
| 2026-01-21 | entry_path in Stripe metadata | Enables attribution analysis in Stripe dashboard |

## Blockers

None currently.

## Planning Documents

- `.planning/PROJECT.md` — Project context and requirements
- `.planning/REQUIREMENTS.md` — 53 v1 requirements with traceability
- `.planning/ROADMAP.md` — 6 phases with dependencies
- `.planning/research/` — Stack, features, architecture, pitfalls research
- `.planning/codebase/` — Existing codebase documentation

## Session Continuity

Last session: 2026-01-21 15:39Z
Stopped at: Completed 05-01-PLAN.md (Affiliate Database Foundation)
Resume file: None

## Session Handoff

**What was done (05-01):**
- Created Affiliate, Commission, Attribution, AffiliateClick models with Store classes
- Built Alembic migration for affiliate tables with proper indexes
- Extended DiscountCode model with affiliate_id field for code linking
- Implemented 30-day commission hold period and status tracking

**Key files created this plan:**
- `backend/app/models/affiliates.py`
- `backend/alembic/versions/7af520d0f608_add_affiliate_tables.py`

**Key files modified:**
- `backend/app/models/payments.py` (added affiliate_id to DiscountCode)

**What's next:**
- 05-02: Backend endpoints for affiliate creation and management
- 05-03: Commission calculation and tracking endpoints
- 05-04: Click tracking and analytics endpoints
- 05-05: Admin interface for affiliate management
- 05-06: Testing and verification

---
*State initialized: 2026-01-19*
