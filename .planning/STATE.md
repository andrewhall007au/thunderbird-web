# Project State: Thunderbird Global

**Last updated:** 2026-01-21
**Current phase:** Phase 6 (International Weather) - In Progress

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-01-19)

**Core value:** Hikers anywhere in the world can create a custom route and receive accurate, location-specific weather forecasts via SMS — even in areas with no cell coverage.

**Current focus:** Phase 6 (International Weather) in progress. Plan 06 complete - 6 of 7 plans done. Weather router implemented with provider mapping and fallback.

## Current Position

Phase: 6 of 6 (International Weather)
Plan: 6 of 7 in current phase
Status: In progress
Last activity: 2026-01-21 - Completed 06-06-PLAN.md (Weather Router)

Progress: ██████████████████░ 98%

## Phase Status

| Phase | Name | Status | Progress |
|-------|------|--------|----------|
| 1 | Foundation | Complete | 4/4 plans |
| 2 | Payments | Complete | 6/6 plans |
| 3 | Route Creation | Complete | 7/7 plans |
| 4 | User Flows | Complete | 5/5 plans |
| 5 | Affiliates | Complete | 6/6 plans |
| 6 | International Weather | In progress | 6/7 plans |

## Recent Decisions

| Date | Decision | Context |
|------|----------|---------|
| 2026-01-21 | Open-Meteo countries have is_fallback=False | FR/IT/CH/NZ/ZA use Open-Meteo as primary, not fallback |
| 2026-01-21 | Fallback only for native API providers | Only NWS/EC/MetOffice can trigger fallback to Open-Meteo |
| 2026-01-21 | EC API graceful fallback | env-canada library broken due to EC API changes; raises RuntimeError for Open-Meteo fallback |
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

Last session: 2026-01-21 09:17Z
Stopped at: Completed 06-06-PLAN.md (Weather Router)
Resume file: None

## Session Handoff

**What was done (06-06):**
- Created WeatherRouter with country-to-provider mapping
- Implemented transparent Open-Meteo fallback on provider failure
- Added is_fallback tracking for data source display (WTHR-11)
- Wired InternationalWeatherService to use router
- Added get_data_source() method for UI display

**Key files created this plan:**
- `backend/app/services/weather/router.py` (provider routing with fallback)

**Key files modified:**
- `backend/app/services/weather_intl.py` (wired to router)
- `backend/app/services/weather/providers/__init__.py` (export all providers)

**Patterns established:**
- Router pattern: WeatherRouter.get_provider() for country selection
- Fallback tracking: is_fallback flag on NormalizedDailyForecast
- Data source display: get_data_source() returns provider name with "(fallback)" suffix

**What's next:**
- 06-07: Testing and Verification (final plan)

---
*State initialized: 2026-01-19*
