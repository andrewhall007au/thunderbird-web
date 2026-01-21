# Project State: Thunderbird Global

**Last updated:** 2026-01-21
**Current phase:** Phase 6 (International Weather) - In Progress

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-01-19)

**Core value:** Hikers anywhere in the world can create a custom route and receive accurate, location-specific weather forecasts via SMS — even in areas with no cell coverage.

**Current focus:** Phase 6 (International Weather) in progress. Plan 05 complete - Open-Meteo country-specific models for Europe and Southern Hemisphere.

## Current Position

Phase: 6 of 6 (International Weather)
Plan: 5 of 7 in current phase
Status: In progress
Last activity: 2026-01-21 - Completed 06-05-PLAN.md

Progress: █████████████████░ 97%

## Phase Status

| Phase | Name | Status | Progress |
|-------|------|--------|----------|
| 1 | Foundation | Complete | 4/4 plans |
| 2 | Payments | Complete | 6/6 plans |
| 3 | Route Creation | Complete | 7/7 plans |
| 4 | User Flows | Complete | 5/5 plans |
| 5 | Affiliates | Complete | 6/6 plans |
| 6 | International Weather | In progress | 5/7 plans |

## Recent Decisions

| Date | Decision | Context |
|------|----------|---------|
| 2026-01-21 | Switzerland uses ICON_EU not MeteoSwiss | Open-Meteo has no /v1/meteoswiss endpoint; ICON_EU covers Alps well |
| 2026-01-21 | NWS grid caching by coordinates | 4 decimal precision (~11m) avoids redundant /points calls |
| 2026-01-21 | Weather DataHub API for Met Office | DataPoint deprecated; DataHub is current API |
| 2026-01-21 | Open-Meteo as universal fallback | Free API, no key required, global coverage |
| 2026-01-21 | 3-hour period aggregation | Matches existing BOM provider pattern |
| 2026-01-21 | In-memory cache for weather | Simple dict-based cache sufficient for single-server MVP |
| 2026-01-21 | Model selection via constructor | Allows regional optimization (meteofrance, meteoswiss, etc.) |
| 2026-01-21 | Test fixture resets both model and service singletons | Required for test isolation when module-level imports cache store references |
| 2026-01-21 | Cron script for commission availability | Daily job: pending -> available after 30-day hold period |
| 2026-01-21 | $50 minimum payout threshold | Enforced in request_payout() - request fails if available < $50 |
| 2026-01-21 | Payout method required before request | Affiliates must set PayPal or bank before requesting payout |
| 2026-01-21 | Milestone tracking via last_milestone_cents | Prevents duplicate milestone notifications |
| 2026-01-21 | Milestone emails on all commissions | Both initial and trailing commissions trigger milestone checks |
| 2026-01-21 | Cookie-based attribution with 7-day expiry | tb_affiliate cookie set on landing, read at checkout for 7-day attribution window |
| 2026-01-21 | Session-based click deduplication | tb_session cookie (24h) prevents duplicate click counting |

## Blockers

None currently.

## Planning Documents

- `.planning/PROJECT.md` — Project context and requirements
- `.planning/REQUIREMENTS.md` — 53 v1 requirements with traceability
- `.planning/ROADMAP.md` — 6 phases with dependencies
- `.planning/research/` — Stack, features, architecture, pitfalls research
- `.planning/codebase/` — Existing codebase documentation

## Session Continuity

Last session: 2026-01-21 09:11Z
Stopped at: Completed 06-05-PLAN.md (European Country Models)
Resume file: None

## Session Handoff

**What was done (06-05):**
- Added OpenMeteoModel enum (BEST_MATCH, METEOFRANCE, ICON_EU, GFS)
- Created country-to-model mapping for FR, CH, IT, NZ, ZA
- Added get_model_for_country() and create_provider_for_country() helpers
- Fixed MeteoSwiss issue (endpoint doesn't exist, using ICON_EU instead)

**Key files modified this plan:**
- `backend/app/services/weather/providers/openmeteo.py` (model enum and country mapping)

**Patterns established:**
- Country code mapping: ISO 3166-1 alpha-2 codes (FR, CH, IT, NZ, ZA)
- Enum with string values for backwards compatibility
- Factory function for country-based provider instantiation

**What's next:**
- 06-06: Provider Registry and Routing
- 06-07: Testing and Verification

---
*State initialized: 2026-01-19*
