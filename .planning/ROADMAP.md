# Milestone v1.1: Trail Data & UX Polish

**Status:** In Progress
**Started:** 2026-02-07
**Phases:** 10+

## Overview

Post-launch improvements focused on trail data quality, UX polish, and launch market readiness. US and Canada are primary launch markets.

## Phases

### Phase 10: Real Trail Data from OpenStreetMap

**Goal:** Replace simplified trail coordinate data with real GPX-quality trail data from non-proprietary sources. Expand trail library to ~350+ unique deduplicated trails covering launch markets (US, Canada, Australia, New Zealand) and top global trails. Trails grouped by country in the UI.

**Depends on:** v1.0 complete
**Plans:** 8 plans

**Key context:** Trail geometry is a planning aid only — users place weather forecast waypoints along the route. We do NOT offer GPX downloads or redistribute trail data. The trail line is a visual reference on the map for the route planning workflow.

**Trail counts (all deduplicated — no trail appears twice):**
- Top 100 trails in the US (launch market)
- Top 50 trails in Canada (launch market)
- Top 50 trails in Australia (launch market, includes Tasmania coverage below)
- Top 25 trails in Tasmania (subset of Australia — ensure 25 Tasmanian trails are included in the AU 50)
- Top 50 trails in New Zealand (launch market)
- Top 100 trails globally (deduplicated against US/Canada/Australia/New Zealand)
- Expected total: ~350+ unique trails

**UI requirements:**
- Trails grouped by country in the dropdown (e.g. optgroup "Australia", "Canada", "United States")
- Format: `Trail Name` under country group header — country is implicit from the group
- All weather API countries shown in dropdown — countries without trail data yet show "Coming Soon" as a disabled option under the country header
- Weather API countries: Australia, USA, Canada, UK, France, Switzerland, Italy, Japan, New Zealand, South Africa, Germany
- All duplicates removed — each trail appears exactly once under its country
- TrailData interface updated with country field
- Update popularTrails.ts data file

**Data requirements:**
- Each trail: accurate coordinates with ~50-200 points (Douglas-Peucker simplified for performance)
- Each trail: automatically identify and mark the lowest and highest elevation points as waypoints (trailLow, trailHigh) — these become points of interest on the trail

**Data sourcing strategy:**
GSD research phase should determine the best source per trail/region. Multiple non-proprietary sources expected:
- **OpenStreetMap** — Overpass API, CC-BY-SA. Good global coverage.
- **Government/public domain** — US (USFS, NPS, BLM trail shapefiles), Canada (Parks Canada, provincial parks), NZ (DOC), Australia (state park authorities), UK (Ordnance Survey open data). Often the most accurate source.
- **Web search** — Publicly shared GPX files from hiking blogs, community forums, personal trip reports. Use as reference for route geometry (planning overlay only, no redistribution).
- **Manual trace** — Last resort. Trace from satellite/topo imagery.

**Excluded sources (proprietary):** AllTrails, Gaia GPS, Strava, Komoot, Wikiloc premium, or any platform with restrictive ToS on data use. These may be used for VALIDATION ONLY (visual reference to check accuracy), never as a data source.

GSD should research and select the best available source per trail during planning, not default to a single source.

**Accuracy validation (mandatory for every trail):**
Community/open-source trail data often contains shortcuts or incomplete sections. Every trail must be validated before inclusion:
1. **Distance check** — Record the known official trail distance (from park websites, Wikipedia, etc. — public facts). Calculate distance from our coordinates via haversine. Flag if our version is >2% shorter than official distance.
2. **Visual spot-check against proprietary map** — For flagged trails (or as a general QA pass), visually compare our trail overlay against a proprietary source (AllTrails map view, etc.) to identify where gaps/shortcuts exist. This is verification, not copying — same as a cartographer checking their work against a reference.
3. **Known waypoint proximity check** — For trails with well-known landmarks (huts, peaks, junctions), verify these points fall within ~200m of our trail line. If major waypoints are off-trail, the data is wrong.
4. **Fix flagged trails** — Source a better non-proprietary version, or manually trace the missing section from satellite/topo imagery.

Plans:
- [x] 10-01-PLAN.md — Trail curation pipeline (Overpass API scripts, simplification, validation, batch processing)
- [x] 10-02-PLAN.md — UI country grouping (TrailSelector with country headers and "Coming Soon")
- [x] 10-03-PLAN.md — US trails (63/100 fetched, 37 use old data)
- [x] 10-04-PLAN.md — Canada + Australia trails (25/50 CA, 22/50 AU fetched)
- [x] 10-04b-PLAN.md — New Zealand trails (40/50 fetched)
- [x] 10-05-PLAN.md — Global trails (39/100 fetched across JP, GB, FR, CH, IT, ZA, DE)
- [x] 10-06-PLAN.md — Final integration (251 trails merged into popularTrails.ts)
- [x] 10-07-PLAN.md — Validation report generated, build passes

### Phase 11: JSON Forecast API (Satellite Data Ready)

**Goal:** Add a JSON API that serves the same forecast data the CAST SMS commands already generate, formatted for app/satellite consumption. Both SMS and JSON are pull-based request/response — same backend, two interfaces. Zero changes to SMS behavior.

**Depends on:** Phase 10 (trail data complete, stable platform)
**Plans:** TBD (estimated 2 plans)

**Key context:** System is pull-based — users request forecasts via CAST commands, server responds. Satellite-to-phone data apps are live in US (T-Mobile), Canada (Rogers), NZ (One NZ) with AccuWeather already delivering structured weather data. Adding a JSON endpoint to the existing forecast engine lets any satellite app, PWA, or native app consume the same data. Thunderbird's forecast payload at <5KB is ideal for satellite constraints.

**Proposal:** `.planning/phases/11-delivery-abstraction/PROPOSAL.md` (includes full satellite market research)

**What this delivers:**
- Refactor generate_cast_forecast() to return structured data (ForecastResult)
- JSON serializer with compact satellite-optimized format (<5KB)
- New `/api/v1/forecast` endpoint covering all CAST variants
- API key auth + request logging
- All CAST types: 12hr, 24hr, 7-day, GPS coords, all-camps, all-peaks

Plans:
- [ ] 11-01: TBD
- [ ] 11-02: TBD

### Phase 12: Companion App — Web POC (Phase 12A)

**Goal:** Build a web-based proof of concept that validates the core UX: select a trail, drop pins, view multi-pin weather forecasts with time scrubber, and export coordinates for SMS. Validates satellite feasibility through latency simulation and payload measurement.

**Depends on:** Phase 10 (trail data), independent of Phase 11 (uses Open-Meteo directly for POC)
**Plans:** 3 plans across 3 waves

**Key context:** This is Phase 12A from the companion app proposal. The POC is a new Next.js route (`/prototype`) with no new infrastructure. Validates UX before committing to Flutter production build (Phase 12C). Dual-mode: data mode (JSON weather) + SMS mode (WX command copy) work in parallel. SMS mode delivers value today on any carrier with satellite SMS.

**What this delivers:**
- New `/prototype` page with trail picker + topo map
- Pin drop with lettered markers (A-H, max 8 pins)
- SMS coordinate export (copy WX command to clipboard, single + multi-pin)
- Open-Meteo batch weather for all pins (hourly, 72h)
- Forecast cards with temp, wind, gusts, rain %, precipitation, cloud cover
- Time scrubber (0 to +72h) — forecast cards + pin colors update on scrub
- Weather grid overlay (model resolution visualization, toggleable)
- Green/amber/red severity coloring on pins and cards (wind, wind chill, rain thresholds)
- Satellite latency simulation (configurable 2-10s delay)
- Payload size inspector (byte measurement + satellite feasibility assessment)
- Mobile-first responsive layout

Plans:
- [ ] 12-01: Coordinate Picker & SMS Export (Wave 1) — /prototype page, map, trail picker, pin drop, WX command copy
- [ ] 12-02: Multi-Pin Weather + Grid + Time Scrubber (Wave 2) — Open-Meteo integration, forecast cards, time scrubber, grid overlay
- [ ] 12-03: Severity + Satellite Simulation + Polish (Wave 3) — Green/amber/red severity, satellite latency sim, payload inspector, mobile polish
