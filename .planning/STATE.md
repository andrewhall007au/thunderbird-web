# Project State: Thunderbird Global

**Last updated:** 2026-01-28
**Current phase:** Phase 7 - Multi-Trail SMS Selection

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-01-19)

**Core value:** Hikers anywhere in the world can create a custom route and receive accurate, location-specific weather forecasts via SMS — even in areas with no cell coverage.

## Current Position

Phase: 7 of 7 (Multi-Trail SMS Selection)
Plan: 1 of 3 - Foundation complete
Status: In progress
Last activity: 2026-01-28 - Completed 07-01-PLAN.md

Progress: Foundation complete, ready for SMS command implementation

## Completed Work (2026-01-28)

### Phase 7-01: Multi-Trail SMS Selection Foundation (LATEST)

**Database schema and models for multi-trail SMS selection:**

- Added `active_trail_id` column to accounts table (migration 8a0e5cff6950)
- Index on `active_trail_id` for efficient lookups
- Extended Account model with `set_active_trail()` and `get_active_trail_id()` methods
- Created TrailSelectionSession model with in-memory store
- SelectionState enum: MAIN_MENU, MY_TRAILS, LIBRARY
- 30-minute session expiry with automatic refresh on interaction

**Files created:**
- `backend/alembic/versions/8a0e5cff6950_add_active_trail_id.py`
- `backend/app/models/trail_selection.py`

**Files modified:**
- `backend/app/models/account.py`

**Duration:** 2min 42s
**Commits:** 2212b6f, c10888e, 3df54ee

---

### 1. Website Features & Value Proposition Update

**Updated homepage (`app/page.tsx`):**
- Expanded features section from 8 to 12 metrics
- Added: Snow, Wind direction, Light hours, Thunderstorm risk
- Updated descriptions for clarity (e.g., "Rain" vs "Precipitation")
- Added "What's in our weather forecast" value proposition section explaining:
  - Multiple national weather APIs (BOM, NWS, Met Office, etc.)
  - 49-point elevation sampling for temperature accuracy
  - LCL cloud base calculations
  - Intelligent danger rating algorithm
- Updated hero bullet points to highlight 12 metrics and elevation adjustment
- Updated FAQ answer for "What weather data is included?"

### 2. Fixed Website Resolutions (Accuracy Audit)

Corrected resolution values to match actual backend implementation:

| Country | Was | Now (Correct) |
|---------|-----|---------------|
| Australia | 3.0km | 2.2km (BOM ACCESS) |
| UK | Point | 1.5km (Met Office) |
| Switzerland | 1.0km | 2.0km (MeteoSwiss) |
| New Zealand | 4.0km | 9.0km (ECMWF) |
| South Africa | 11.0km | 9.0km (ECMWF) |

Updated both `app/page.tsx` and `app/how-it-works/page.tsx`.

### 3. Enabled Japan (JMA 5km)

Added Japan as 10th supported country via Open-Meteo JMA API:
- Resolution: 5km (JMA MSM model)
- Cost: Free via Open-Meteo (non-commercial) or $29/mo commercial
- Hourly updates, 4-day forecast

**Files updated:**
- `backend/app/services/weather/providers/openmeteo.py` - Added JMA enum, endpoint, model mapping
- `backend/app/services/weather/router.py` - Added JP to providers dict
- `app/page.tsx` - Added Japan to markets list
- `app/how-it-works/page.tsx` - Added Japan to coverage table

### 4. Provider Research Complete

Researched higher-resolution options for all markets:

| Country | Current | Best Available | Provider | Cost |
|---------|---------|----------------|----------|------|
| New Zealand | 9km ECMWF | **4km WRF** | MetService | $75/mo |
| Japan | 5km JMA | **1km mesh** | JWA | $210/mo |
| South Africa | 9km ECMWF | **4.4km UM** | AfriGIS/SAWS | TBD (60-day pilot available) |

## What's Next?

### Immediate (Ready to Execute)
1. **Phase 07-02: SMS START command** - Implement trail selection state machine
2. **Phase 07-03: Integration** - Wire START command into existing SMS handler

### Future Phases
3. **Apply for AfriGIS SA pilot** - Free 60-day trial, 4.4km resolution
4. **Evaluate MetService NZ** - $75/mo for 4km, massive hiking market
5. **JWA Japan 1km** - $210/mo, evaluate if market justifies cost
6. **Welcome emails** - Pending todo from before

## Provider Integration Notes

### Elevation Handling for New Providers

All new providers need elevation adjustment using our existing system:
1. Check if API returns model orography elevation
2. If not, use Open Topo Data 49-point sampling
3. Apply 6.5°C/1000m lapse rate from model → user elevation

**Existing elevation system works globally** - just need to wire up new providers.

### Current Provider Coverage (10 Countries)

```
AU: BOM (2.2km) - direct integration
US: NWS (2.5km) + HRRR supplement
CA: Environment Canada (2.5km) + GEM supplement
GB: Met Office (1.5km)
FR: Open-Meteo Météo-France (1.5km)
CH: Open-Meteo MeteoSwiss (2km)
IT: Open-Meteo ICON-EU (7km)
JP: Open-Meteo JMA (5km) - NEW
NZ: Open-Meteo ECMWF (9km) - upgrade available
ZA: Open-Meteo ECMWF (9km) - upgrade available
```

## Key Files (Today's Changes)

```
# Phase 07-01: Multi-Trail SMS Selection Foundation
backend/alembic/versions/8a0e5cff6950_add_active_trail_id.py  # Migration for active_trail_id
backend/app/models/account.py                                  # Added active trail methods
backend/app/models/trail_selection.py                          # Session store (NEW)

# Website (Earlier Today)
app/page.tsx                    # Features, value prop, markets, FAQ
app/how-it-works/page.tsx       # Coverage table with correct resolutions

# Backend - Japan Support (Earlier Today)
backend/app/services/weather/providers/openmeteo.py  # JMA enum + endpoint
backend/app/services/weather/router.py               # JP provider mapping
```

## Planning Documents

- `.planning/PROJECT.md` — Project context and requirements
- `.planning/REQUIREMENTS.md` — 53 v1 requirements with traceability
- `.planning/ROADMAP.md` — 6 phases with dependencies
- `.planning/todos/pending/weather-providers.md` — Provider upgrade research
- `.planning/specs/START-command-flow.md` — Multi-trail selection via SMS (NEW)

---
*State updated: 2026-01-28*
