# Project State: Thunderbird Global

**Last updated:** 2026-01-21
**Current phase:** Phase 5 (Affiliates) - IN PROGRESS

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-01-19)

**Core value:** Hikers anywhere in the world can create a custom route and receive accurate, location-specific weather forecasts via SMS — even in areas with no cell coverage.

**Current focus:** Phase 5 (Affiliates) in progress. Database foundation complete with affiliate models, commission tracking, and attribution system.

## Current Position

Phase: 5 of 6 (Affiliates)
Plan: 3 of 6 in current phase
Status: In progress
Last activity: 2026-01-21 - Completed 05-03-PLAN.md

Progress: ███████████████░░ 89%

## Phase Status

| Phase | Name | Status | Progress |
|-------|------|--------|----------|
| 1 | Foundation | Complete | 4/4 plans |
| 2 | Payments | Complete | 6/6 plans |
| 3 | Route Creation | Complete | 7/7 plans |
| 4 | User Flows | Complete | 5/5 plans |
| 5 | Affiliates | In progress | 3/6 plans |
| 6 | International Weather | Not started | 0/? plans |

## Recent Decisions

| Date | Decision | Context |
|------|----------|---------|
| 2026-01-21 | Discount code auto-creation for affiliates | Creating affiliate auto-creates matching discount code with affiliate_id link |
| 2026-01-21 | Affiliate lookup at checkout | Both /checkout and /buy-now endpoints look up affiliate_id from discount code before creating Stripe session |
| 2026-01-21 | sub_id for campaign tracking | Added sub_id parameter for granular campaign tracking (e.g., PARTNER-FB vs PARTNER-IG) |
| 2026-01-21 | Commission calculated in webhook, not checkout | Ensures accuracy on post-discount amounts, prevents fraud |
| 2026-01-21 | Trailing attribution only for initial purchases | Top-ups check for existing attribution |
| 2026-01-21 | Clawback marks commissions, doesn't delete | Maintains audit trail for reporting |
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

Last session: 2026-01-21 07:48Z
Stopped at: Completed 05-03-PLAN.md (Admin Console & Checkout Integration)
Resume file: None

## Session Handoff

**What was done (05-03):**
- Added affiliate admin HTML templates (list, edit, stats pages) following existing admin.py pattern
- Added 6 affiliate admin routes (list, create, edit, toggle, stats) with require_admin checks
- Auto-creation of discount codes when affiliates are created
- Integrated affiliate lookup from discount codes at checkout
- Added sub_id parameter for campaign tracking

**Key files modified this plan:**
- `backend/app/services/admin.py` (render_affiliate_admin, render_affiliate_edit, render_affiliate_stats)
- `backend/app/routers/admin.py` (6 affiliate management routes)
- `backend/app/routers/payments.py` (affiliate_id lookup at checkout)

**What's next:**
- 05-04: Click tracking and analytics endpoints
- 05-05: Reporting and payout management
- 05-06: Affiliate portal (self-service stats)

---
*State initialized: 2026-01-19*
