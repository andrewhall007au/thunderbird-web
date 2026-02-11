# Project State: Thunderbird Global

**Last updated:** 2026-02-11
**Current milestone:** v1.1 Trail Data & UX Polish

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-02-04)

**Core value:** Hikers anywhere in the world can create a custom route and receive accurate, location-specific weather forecasts via SMS — even in areas with no cell coverage.

## Current Position

Phase: 12 of 12 (Companion App — Web POC)
Plan: 1 of 3 — Coordinate Picker & SMS Export complete
Status: Phase 12A in progress (Wave 1 complete)
Last activity: 2026-02-11 - Completed 12-01-PLAN.md

Progress: ███░░░░░░░ 33% (1/3 plans complete)

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

## Phase 12 Accumulated Decisions

### Companion App POC Decisions
| Decision | Rationale | Phase-Plan | Date |
|----------|-----------|------------|------|
| Use /prototype route in main app, not separate project | Reuses existing MapLibre, trail data, and infrastructure. POC validates UX before building native app. Low risk - isolated route, no auth required. | 12-01 | 2026-02-11 |
| SMS mode first (coordinate copy), weather mode later | Delivers immediate value for satellite SMS users (Telstra, T-Mobile). Step 1 of 3-step POC. | 12-01 | 2026-02-11 |
| Max 8 pins, SMS 160 character limit | ~4 pins fit in single SMS. 8 allows split across 2 messages. Character counter warns user to prevent frustration. | 12-01 | 2026-02-11 |

### Technical Patterns
- **Mobile-first layout:** `h-screen flex flex-col` with map taking `flex-1` (12-01)
- **Dynamic MapLibre import:** `dynamic(() => import(), { ssr: false })` to avoid SSR issues (12-01)
- **WX command format:** `WX lat1 lng1 lat2 lng2 ...` with 3 decimal places (~100m precision) (12-01)
- **Pin labeling:** Sequential A-H, re-label on removal to maintain sequence (12-01)

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

Last session: 2026-02-11
Stopped at: Completed 12-01-PLAN.md (Coordinate Picker & SMS Export)
Resume file: None

### Key artifacts from 2026-02-11 session:
- `.planning/phases/12-companion-app/PROPOSAL.md` — Full companion app spec (dual-mode, multi-pin, 4 delivery phases)
- `.planning/phases/12-companion-app/RESEARCH.md` — Synthesis of 5 research streams (codebase, maps, weather, satellite, distribution)
- `.planning/phases/12-companion-app/12-01-PLAN.md` — Coordinate Picker & SMS Export (Wave 1) ✅ COMPLETE
- `.planning/phases/12-companion-app/12-01-SUMMARY.md` — Execution summary (4 tasks, 4 commits, 753 lines)
- `.planning/phases/12-companion-app/12-02-PLAN.md` — Multi-Pin Weather + Grid + Time Scrubber (Wave 2) — NEXT
- `.planning/phases/12-companion-app/12-03-PLAN.md` — Severity + Satellite Sim + Polish (Wave 3)
- ROADMAP.md updated with Phase 12 entry

### Completed in this session:
- ✅ `/prototype` route created with mobile-first layout
- ✅ PrototypeMap: MapLibre with OpenTopoMap, trail display, pin drop
- ✅ TrailPicker: search + lazy loading for 252 trails
- ✅ PinPanel: SMS WX command copy with character counter
- ✅ Build passes, route loads, all verification criteria met
- ✅ 4 atomic commits (dd3d4c1, 8e8c5d9, f395a59, 4f7e3a5)

### Key decisions from 2026-02-11:
- POC is a new Next.js route (`/prototype`), not a separate project — reuses existing MapLibre, trail data, and infrastructure
- Open-Meteo called directly from frontend for POC (no backend proxy needed)
- SMS mode (coordinate copy) is Step 1 — delivers value on day one for Telstra/T-Mobile SMS users
- Data mode (JSON weather) is Step 2 — adds forecast cards, time scrubber
- Severity coloring (green/amber/red) is Step 3 — the decision-making layer
- Satellite simulation validates UX under real constraints (2-10s latency)
- PMTiles for offline tiles deferred to production app (Phase 12C) — POC uses online OpenTopoMap tiles

### Key decisions from 2026-02-08:
- System is pull-based (CAST commands), NOT push. Docs may say otherwise — trust the code.
- Phase 11 is small (2 plans): refactor forecast functions to return structured data + JSON API endpoint
- PWA rejected: iOS evicts service worker caches after ~7 days non-use, unacceptable for satellite safety tool
- Native app (Phase 12): installed permanently, only 5KB API calls over satellite, never re-downloads shell
- AccuWeather + Plan My Walk already whitelisted on satellite services — direct competitors

---

*State updated: 2026-02-11*
