# Project State: Thunderbird Global

**Last updated:** 2026-01-21
**Current phase:** Phase 6 (International Weather) - In Progress

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-01-19)

**Core value:** Hikers anywhere in the world can create a custom route and receive accurate, location-specific weather forecasts via SMS — even in areas with no cell coverage.

**Current focus:** Phase 6 (International Weather) started. Plan 01 complete - weather provider foundation with Open-Meteo fallback and caching.

## Current Position

Phase: 6 of 6 (International Weather)
Plan: 1 of 7 in current phase
Status: In progress
Last activity: 2026-01-21 - Completed 06-01-PLAN.md

Progress: █████████████████░ 96%

## Phase Status

| Phase | Name | Status | Progress |
|-------|------|--------|----------|
| 1 | Foundation | Complete | 4/4 plans |
| 2 | Payments | Complete | 6/6 plans |
| 3 | Route Creation | Complete | 7/7 plans |
| 4 | User Flows | Complete | 5/5 plans |
| 5 | Affiliates | Complete | 6/6 plans |
| 6 | International Weather | In progress | 1/7 plans |

## Recent Decisions

| Date | Decision | Context |
|------|----------|---------|
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
| 2026-01-21 | Aggregate-only conversion data in API | get_recent_conversions() exposes amount/status/date but no account_id or order_id |
| 2026-01-21 | Period filtering for dashboards | Dashboard API supports today, 7d, 30d, all for time-range analysis |
| 2026-01-21 | Campaign tracking via sub_id | /ref/{code}/{sub_id} enables channel-level performance tracking |

## Blockers

None currently.

## Planning Documents

- `.planning/PROJECT.md` — Project context and requirements
- `.planning/REQUIREMENTS.md` — 53 v1 requirements with traceability
- `.planning/ROADMAP.md` — 6 phases with dependencies
- `.planning/research/` — Stack, features, architecture, pitfalls research
- `.planning/codebase/` — Existing codebase documentation

## Session Continuity

Last session: 2026-01-21 09:04Z
Stopped at: Completed 06-01-PLAN.md (Weather Provider Foundation)
Resume file: None

## Session Handoff

**What was done (06-01):**
- Created WeatherProvider ABC with get_forecast and get_alerts interface
- Created NormalizedForecast/NormalizedDailyForecast dataclasses for consistent format
- Implemented OpenMeteoProvider with 3-hour aggregation and model selection
- Implemented WeatherCache with 1-hour TTL and singleton accessor

**Key files created this plan:**
- `backend/app/services/weather/__init__.py` (package exports)
- `backend/app/services/weather/base.py` (ABC and dataclasses)
- `backend/app/services/weather/providers/openmeteo.py` (Open-Meteo integration)
- `backend/app/services/weather/cache.py` (1-hour TTL cache)

**Patterns established:**
- WeatherProvider ABC: `get_forecast(lat, lon, days)` returns `NormalizedDailyForecast`
- Cache key format: `provider:lat,lon:days` with 4 decimal precision
- All weather values in metric: Celsius, mm, cm, km/h, meters

**What's next:**
- 06-02: NWS Provider (USA)
- 06-03: Environment Canada Provider
- 06-04: Met Office Provider (UK)
- 06-05: European Providers (France, Italy, Switzerland)
- 06-06: Southern Hemisphere Providers (NZ, South Africa)
- 06-07: Provider Registry and Fallback

---
*State initialized: 2026-01-19*
