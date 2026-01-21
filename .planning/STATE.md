# Project State: Thunderbird Global

**Last updated:** 2026-01-21
**Current phase:** Phase 5 (Affiliates) - IN PROGRESS

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-01-19)

**Core value:** Hikers anywhere in the world can create a custom route and receive accurate, location-specific weather forecasts via SMS — even in areas with no cell coverage.

**Current focus:** Phase 5 (Affiliates) in progress. Payout system complete with $50 minimum threshold, admin management, and milestone emails.

## Current Position

Phase: 5 of 6 (Affiliates)
Plan: 5 of 6 in current phase
Status: In progress
Last activity: 2026-01-21 - Completed 05-05-PLAN.md

Progress: ████████████████░ 93%

## Phase Status

| Phase | Name | Status | Progress |
|-------|------|--------|----------|
| 1 | Foundation | Complete | 4/4 plans |
| 2 | Payments | Complete | 6/6 plans |
| 3 | Route Creation | Complete | 7/7 plans |
| 4 | User Flows | Complete | 5/5 plans |
| 5 | Affiliates | In progress | 5/6 plans |
| 6 | International Weather | Not started | 0/? plans |

## Recent Decisions

| Date | Decision | Context |
|------|----------|---------|
| 2026-01-21 | $50 minimum payout threshold | Enforced in request_payout() - request fails if available < $50 |
| 2026-01-21 | Payout method required before request | Affiliates must set PayPal or bank before requesting payout |
| 2026-01-21 | Milestone tracking via last_milestone_cents | Prevents duplicate milestone notifications |
| 2026-01-21 | Milestone emails on all commissions | Both initial and trailing commissions trigger milestone checks |
| 2026-01-21 | Cookie-based attribution with 7-day expiry | tb_affiliate cookie set on landing, read at checkout for 7-day attribution window |
| 2026-01-21 | Session-based click deduplication | tb_session cookie (24h) prevents duplicate click counting |
| 2026-01-21 | Aggregate-only conversion data in API | get_recent_conversions() exposes amount/status/date but no account_id or order_id |
| 2026-01-21 | Period filtering for dashboards | Dashboard API supports today, 7d, 30d, all for time-range analysis |
| 2026-01-21 | Campaign tracking via sub_id | /ref/{code}/{sub_id} enables channel-level performance tracking |
| 2026-01-21 | Discount code auto-creation for affiliates | Creating affiliate auto-creates matching discount code with affiliate_id link |
| 2026-01-21 | Affiliate lookup at checkout | Both /checkout and /buy-now endpoints look up affiliate_id from discount code before creating Stripe session |
| 2026-01-21 | Commission calculated in webhook, not checkout | Ensures accuracy on post-discount amounts, prevents fraud |
| 2026-01-21 | Trailing attribution only for initial purchases | Top-ups check for existing attribution |
| 2026-01-21 | Clawback marks commissions, doesn't delete | Maintains audit trail for reporting |
| 2026-01-21 | Commission hold period 30 days | Protects against chargebacks before payout |

## Blockers

None currently.

## Planning Documents

- `.planning/PROJECT.md` — Project context and requirements
- `.planning/REQUIREMENTS.md` — 53 v1 requirements with traceability
- `.planning/ROADMAP.md` — 6 phases with dependencies
- `.planning/research/` — Stack, features, architecture, pitfalls research
- `.planning/codebase/` — Existing codebase documentation

## Session Continuity

Last session: 2026-01-21 08:03Z
Stopped at: Completed 05-05-PLAN.md (Payout Tracking & Milestone Alerts)
Resume file: None

## Session Handoff

**What was done (05-05):**
- Added payout methods to AffiliateService: request_payout(), get_pending_payouts(), process_payout(), check_milestones(), send_milestone_email()
- Added payout API endpoints: /api/affiliates/payout/method/{code}, /payout/request/{code}, /payout/status/{code}
- Created admin payout management page at /admin/payouts with Mark Paid functionality
- Added send_affiliate_milestone_email() for $50/$100/$500/$1000 thresholds
- Integrated milestone check into webhook commission creation
- Added last_milestone_cents field and migration

**Key files modified this plan:**
- `backend/app/services/affiliates.py` (payout methods, milestone check)
- `backend/app/models/affiliates.py` (last_milestone_cents field)
- `backend/app/routers/affiliates.py` (payout API endpoints)
- `backend/app/routers/admin.py` (payout management routes)
- `backend/app/services/admin.py` (render_payout_admin)
- `backend/app/services/email.py` (milestone email)
- `backend/app/routers/webhook.py` (milestone integration)

**What's next:**
- 05-06: Affiliate portal (self-service stats view)

---
*State initialized: 2026-01-19*
