# Project State: Thunderbird Global

**Last updated:** 2026-01-19
**Current phase:** Phase 1 (Foundation) - In progress

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-01-19)

**Core value:** Hikers anywhere in the world can create a custom route and receive accurate, location-specific weather forecasts via SMS — even in areas with no cell coverage.

**Current focus:** Foundation phase - authentication system complete

## Current Position

Phase: 1 of 6 (Foundation)
Plan: 3 of 4 in current phase
Status: In progress
Last activity: 2026-01-19 - Completed 01-03-PLAN.md

Progress: ███░░░░░░░ 12%

## Phase Status

| Phase | Name | Status | Progress |
|-------|------|--------|----------|
| 1 | Foundation | In progress | 3/4 plans |
| 2 | Payments | Not started | 0/12 requirements |
| 3 | Route Creation | Not started | 0/12 requirements |
| 4 | User Flows | Not started | 0/9 requirements |
| 5 | Affiliates | Not started | 0/7 requirements |
| 6 | International Weather | Not started | 0/11 requirements |

## Recent Decisions

| Date | Decision | Context |
|------|----------|---------|
| 2026-01-19 | Argon2 via pwdlib (not bcrypt) | Modern password hashing, faster and more secure |
| 2026-01-19 | Account model separate from User | Web login (email/pwd) vs SMS hikers (phone) |
| 2026-01-19 | Case-insensitive email | Normalized to lowercase on storage |
| 2026-01-19 | JWT_SECRET required in production | Fails startup if not set (non-DEBUG) |
| 2026-01-19 | OAuth2 password flow | Standard /auth/token endpoint |
| 2026-01-19 | Router-per-domain organization | webhook.py, admin.py, api.py, auth.py |
| 2026-01-19 | Fork model (not multi-tenant) | Simpler architecture, evolves independently |
| 2026-01-19 | $29.99 launch, $49.99 RRP | Dynamic pricing with admin configuration |
| 2026-01-19 | 8 countries at launch | USA, Canada, UK, France, Italy, Switzerland, NZ, South Africa |

## Blockers

None currently.

## Planning Documents

- `.planning/PROJECT.md` — Project context and requirements
- `.planning/REQUIREMENTS.md` — 53 v1 requirements with traceability
- `.planning/ROADMAP.md` — 6 phases with dependencies
- `.planning/research/` — Stack, features, architecture, pitfalls research
- `.planning/codebase/` — Existing codebase documentation

## Session Continuity

Last session: 2026-01-19 08:55Z
Stopped at: Completed 01-03-PLAN.md (Account authentication system)
Resume file: None

## Session Handoff

**What was done (01-03):**
- Created Account model and AccountStore for web authentication
- Alembic migration for accounts table with email unique index
- JWT token generation with Argon2 password hashing
- Auth router with /register, /token, /me endpoints
- get_current_account dependency for protected endpoints
- All 280 tests pass

**What's next:**
1. Execute 01-04-PLAN.md (likely phone linking or final foundation tasks)
2. Phase 2 (Payments) and Phase 3 (Route Creation) can run in parallel after Phase 1
3. Auth system ready for frontend integration

**Key files created:**
- `backend/app/models/account.py` - Account dataclass and AccountStore
- `backend/app/services/auth.py` - JWT and password handling
- `backend/app/routers/auth.py` - Registration and login endpoints
- `backend/alembic/versions/4fd3f14bce7e_accounts_table.py` - Accounts migration

**Key risks to monitor:**
- SMS margin erosion across countries (verify Twilio rates)
- Weather API availability (verify free tier limits)
- Affiliate code stacking exploitation (model economics before launch)

---
*State initialized: 2026-01-19*
