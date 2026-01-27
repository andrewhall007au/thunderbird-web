# Project State: Thunderbird Global

**Last updated:** 2026-01-28
**Current phase:** Post-v1 Enhancement - Elevation Fix Complete

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-01-19)

**Core value:** Hikers anywhere in the world can create a custom route and receive accurate, location-specific weather forecasts via SMS — even in areas with no cell coverage.

## Current Position

Phase: Post-v1 (Elevation Fix Complete)
Status: Ready for next task
Last activity: 2026-01-28 - Elevation handling fixed and tested

## Completed Work (2026-01-28)

### Fixed: Elevation Handling for Temperature Adjustments

**Problem solved:** BOM temperatures are valid at 2m above MODEL OROGRAPHY (cell average elevation), not the user's GPS point. This caused 1-3°C errors in mountainous terrain.

**Solution implemented:**
1. Created `app/services/elevation.py` with Open Topo Data API integration
2. Samples 2.2km × 2.2km grid (49 points) to estimate BOM cell average elevation
3. Updated all providers to report `model_elevation`:
   - **BOM**: Calculates cell average via `get_cell_model_elevation()`
   - **NWS**: Fetches grid elevation from gridpoints API
   - **Open-Meteo**: Parses elevation from API response (90m DEM)
4. Converter sets `base_elevation = model_elevation` for formatters
5. Formatters apply lapse rate (6.5°C/1000m) from model → target elevation

**Test results:**
- kunanyi summit: Point 1258m, Grid avg 1019m → 1.6°C adjustment
- Hobart CBD: Point 21m, Grid avg 25m → negligible (flat terrain)
- Ben Lomond: Point 1476m, Grid avg 1396m → 0.5°C adjustment

**Tests:** 130 GPS/weather tests passing

### Previously Completed: GPS International Routing
- GPS forecasts route through country-specific providers (NWS for US, Met Office for UK, etc.)
- AU coordinates continue using BOM (backwards compatible)
- CAST7 now supports GPS coordinates

## What's Next?

The elevation fix is complete. Potential next steps:

1. **Production deployment** - Push elevation fix to production
2. **More international providers** - Add more country-specific weather APIs
3. **UI improvements** - Frontend enhancements
4. **Performance optimization** - Cache elevation data more aggressively
5. **Documentation** - Update user-facing docs about accuracy improvements

## Key Files (Elevation System)

```
backend/app/services/elevation.py       # NEW - Open Topo Data integration
backend/app/services/bom.py             # get_cell_model_elevation()
backend/app/services/weather/base.py    # model_elevation field
backend/app/services/weather/converter.py  # model_elevation → base_elevation
backend/app/services/weather/providers/nws.py      # Grid elevation fetch
backend/app/services/weather/providers/openmeteo.py # DEM elevation parse
backend/app/services/formatter.py       # Lapse rate adjustment
```

## Session Continuity

Last session: 2026-01-28
Completed: Elevation investigation and fix
Commit: feat: add accurate elevation handling for temperature adjustments

## Planning Documents

- `.planning/PROJECT.md` — Project context and requirements
- `.planning/REQUIREMENTS.md` — 53 v1 requirements with traceability
- `.planning/ROADMAP.md` — 6 phases with dependencies

---
*State updated: 2026-01-28*
