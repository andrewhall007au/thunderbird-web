# Project State: Thunderbird Global

**Last updated:** 2026-02-07
**Current milestone:** v1.1 Trail Data & UX Polish

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-02-04)

**Core value:** Hikers anywhere in the world can create a custom route and receive accurate, location-specific weather forecasts via SMS — even in areas with no cell coverage.

## Current Position

Phase: 10 of 10+ (Real Trail Data from OpenStreetMap)
Plan: All 8 plans complete (Waves 1-4)
Status: Phase 10 complete — pending user verification
Last activity: 2026-02-07 - All trail data merged, build passing

Progress: ████████████ 100% (8/8 plans complete)

### Phase 10 Results
- **251 trails** in popularTrails.ts (up from 107)
- **189 new trails** via three-source pipeline (Overpass → Waymarked Trails → Government APIs)
- **62 old trails** kept as fallback where new pipeline failed
- **11 countries** all represented, no "Coming Soon"
- Data sources: OSM (86), Waymarked Trails (80), NPS (11), DOC (9), USFS (2), Parks Canada (1), old data (62)

### Roadmap Evolution
- Phase 10 added: Replace simplified trail data with real GPX-quality data from OpenStreetMap. Expand to ~350 trails. Add country codes to UI.
- Phase 10 complete: 251 trails (189 new + 62 old fallback) from OSM, Waymarked Trails, and government sources. Pipeline added Waymarked Trails API as second source (ef9153c).
- Phase 11 proposed: Delivery Channel Abstraction (SMS + Satellite Data). Decouple forecast from SMS delivery to support JSON over satellite data apps. Market research shows satellite data live in US/CA/NZ, all other launch markets launching 2026. See `.planning/phases/11-delivery-abstraction/PROPOSAL.md`.

---

## v1.0 Milestone Summary

**Delivered:** Complete global SMS weather platform with e-commerce, route builder, affiliate program, and production monitoring across 8 countries

**Phases completed:** 1-9 (44 plans, ~180 tasks, 28 days)

**Key accomplishments:**
- E-commerce platform with Stripe, dynamic pricing, discount codes, SMS top-ups
- Interactive route builder with GPX upload, map editor, route library
- Dual conversion paths with phone simulator and analytics
- Affiliate program with trailing commissions
- International weather coverage (8 countries)
- Production monitoring with health checks, alerting, synthetic tests, dashboard

**Archives:**
- Roadmap: `.planning/milestones/v1.0-ROADMAP.md`
- Requirements: `.planning/milestones/v1.0-REQUIREMENTS.md`
- Audit: `.planning/milestones/v1-MILESTONE-AUDIT.md`

---

## What's Next

### Immediate Actions

1. **Deploy monitoring to production** - Run systemd setup script, configure alert numbers
2. **Production testing** - Run E2E tests, verify monitoring alerts working
3. **Define v1.1 milestone** - Use `/gsd:new-milestone` for next phase of work

### Pending Items

**Pending Beta Application:**
- Application ID 2: Andrew Hall (andrew_hall_home@icloud.com) - needs approval via `/admin/beta`

**E2E SMS Testing:**
- Purchase Twilio test numbers: US ($1.15/mo) + CA ($1.30/mo)
- Run: `python -m tests.e2e_sms.runner --all`
- Optional field test for satellite SMS validation

**Balance Enforcement Decision:**
- Beta users: Light warning only (current behavior ✓)
- Paid users: Hard stop if zero balance (implement when launching paid)
- Future: Pay-by-SMS option for paid users

### Current Beta Status

| ID | Email | Status | Balance |
|----|-------|--------|---------|
| 2 | andrew_hall_home@icloud.com | pending | - |
| 3 | hello@getseen.bot | approved | $50.00 |

**Total SMS Credit Liability:** $100.00 (RRP) / $55.00 (Cost)

---

## Outstanding Technical Debt

1. **International weather activation** - Infrastructure built, not yet activated for SMS users (intentional)
2. **Monitoring dashboard auth** - Currently internal tool only, accessible via direct URL
3. **Backend spec alignment** - User noted backend may have "old onboarding system" that doesn't match spec (investigate)

---

## Phase 10 Accumulated Decisions

### Data Curation Decisions
| Decision | Rationale | Phase-Plan | Date |
|----------|-----------|------------|------|
| Use OSM Overpass API as primary data source | Industry-standard for bulk trail data extraction, supports hiking route queries | 10-01 | 2026-02-07 |
| Automatic fallback to per-country government sources | When OSM validation fails (>2% distance error), automatically try government sources before flagging for manual work (reduces manual intervention from ~35 trails to <5) | 10-01 | 2026-02-07 |
| Binary search for simplification tolerance | Instead of fixed tolerance values, find tolerance that achieves target point count (more predictable than trial-and-error) | 10-01 | 2026-02-07 |
| Elevation data is best-effort | OSM elevation data often missing/inaccurate, accept zeros and document as approximate (not critical for planning use case) | 10-01 | 2026-02-07 |

### Technical Patterns
- **Overpass QL query format:** `[out:json][timeout:60]; rel[route=hiking][name~trail,i](bbox); out body; >; out skel qt;` (10-01)
- **Bbox format:** `[south, west, north, east]` = `[minLat, minLng, maxLat, maxLng]` for Overpass API (10-01)
- **Coordinate format:** `[lng, lat, elevation]` - OSM returns lat/lon, must convert during extraction (10-01)
- **Fallback source types:** arcgis_featureserver, geojson_url, wfs, shapefile_url, gpx_download (10-01)
- **Validation thresholds:** >2% shorter = too_short flag, >20% longer = too_long flag (10-01)

---

## Key Files Reference

**Planning:**
- `.planning/PROJECT.md` - What this is, core value, requirements
- `.planning/MILESTONES.md` - Milestone history
- `.planning/milestones/v1.0-ROADMAP.md` - v1.0 archive
- `.planning/STATE.md` - This file

**Monitoring (Phase 9):**
- `backend/monitoring/` - Monitoring service package
- `backend/monitoring/main.py` - FastAPI monitoring app (port 8001)
- `backend/monitoring/deploy/setup_monitoring.sh` - Production deployment script
- `app/monitoring/page.tsx` - Status dashboard

**Deployment:**
- `backend/deploy/nginx_complete.conf` - Security headers configuration
- `backend/deploy/apply_nginx_security.sh` - Nginx security setup
- `backend/monitoring/deploy/monitoring.service` - Systemd service file

---

## Session Continuity

Last session: 2026-02-08
Stopped at: Phase 11 proposed (JSON Forecast API) + Phase 12 direction set (native companion app). Satellite market research complete. PWA rejected for satellite use case — iOS cache eviction makes it unreliable for safety-critical tool. Native app is the right answer for satellite-first users.
Resume file: None

### Key artifacts from 2026-02-08 session:
- `.planning/phases/11-delivery-abstraction/PROPOSAL.md` — Phase 11 proposal (JSON API, 2 plans) + Phase 12 native app direction
- `.planning/phases/11-delivery-abstraction/SATELLITE-RESEARCH-2026-02-08.md` — full satellite market research across all launch markets
- ROADMAP.md updated with Phase 11 entry

### Key decisions from 2026-02-08:
- System is pull-based (CAST commands), NOT push. Docs may say otherwise — trust the code.
- Phase 11 is small (2 plans): refactor forecast functions to return structured data + JSON API endpoint
- PWA rejected: iOS evicts service worker caches after ~7 days non-use, unacceptable for satellite safety tool
- Native app (Phase 12): installed permanently, only 5KB API calls over satellite, never re-downloads shell
- AccuWeather + Plan My Walk already whitelisted on satellite services — direct competitors

---

*State updated: 2026-02-07*
