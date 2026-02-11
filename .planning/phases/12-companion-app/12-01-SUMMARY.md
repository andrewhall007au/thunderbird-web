---
phase: 12-companion-app
plan: 01
subsystem: companion-app-web-poc
tags: [nextjs, maplibre, react, prototype, mobile-first, sms-export]

requires:
  - phase-10-trail-data
  - existing-map-infrastructure

provides:
  - /prototype route with trail-based coordinate picker
  - SMS WX command copy functionality
  - Foundation for multi-pin weather POC

affects:
  - 12-02 (will add weather data fetching to this prototype)
  - 12-03 (will add severity coloring and satellite simulation)

tech-stack:
  added:
    - react-map-gl/maplibre integration for prototype
    - OpenTopoMap basemap for prototype
  patterns:
    - Mobile-first responsive layout (h-screen flex-col)
    - Dynamic import for SSR avoidance (MapLibre client-only)
    - Bottom sheet expandable panel pattern
    - Lazy trail coordinate loading from /trail-data/*.json

key-files:
  created:
    - app/prototype/page.tsx
    - app/prototype/components/PrototypeMap.tsx
    - app/prototype/components/TrailPicker.tsx
    - app/prototype/components/PinPanel.tsx
  modified: []

decisions:
  - decision: "Use /prototype route in main app, not separate project"
    rationale: "Reuses existing MapLibre, trail data, and infrastructure. POC validates UX before building native app."
    impact: "Low risk - isolated route, no auth required, doesn't affect production features"
    date: 2026-02-11

  - decision: "SMS mode first (coordinate copy), weather mode later"
    rationale: "Delivers immediate value for satellite SMS users (Telstra, T-Mobile). Step 1 of 3-step POC."
    impact: "Plan 12-02 will add weather fetching, 12-03 adds severity coloring"
    date: 2026-02-11

  - decision: "Max 8 pins, SMS 160 character limit"
    rationale: "~4 pins fit in single SMS. 8 allows split across 2 messages. Character counter warns user."
    impact: "UX constraint prevents user frustration from message splits"
    date: 2026-02-11

metrics:
  duration: "52 minutes"
  completed: 2026-02-11
  tasks: 4
  commits: 4
  lines-added: 753

wave: 1
status: complete
---

# Phase 12 Plan 01: Coordinate Picker & SMS Export Summary

**One-liner:** Interactive trail map with pin drop and WX SMS command copy for satellite users

## What Was Built

A publicly accessible `/prototype` route that lets users:
1. Select any of the 252 trails from the popularTrails dataset
2. View the trail on an OpenTopoMap basemap (topo contours + relief)
3. Drop up to 8 pins along the trail by tapping the map
4. Copy formatted WX coordinates for SMS forecast requests

This is **Step 1** of the companion app POC. It delivers immediate value for hikers with satellite SMS (Telstra Satellite, T-Mobile Starlink coverage, Rogers Lynk). No weather API yet - just coordinate export.

## Components Created

### 1. `/prototype` Page (109 lines)
- Mobile-first layout: header → trail picker → map → pin panel
- State management: selectedTrailId, trailGeojson, pins array
- Pin management: addPin (max 8), removePin (with re-labeling), clearPins
- Pin labels: sequential A-H
- Dark theme (zinc-900) for outdoor aesthetic
- Dynamic PrototypeMap import (SSR disabled for MapLibre)

### 2. PrototypeMap Component (192 lines)
- MapLibre GL map with react-map-gl wrapper
- OpenTopoMap basemap (raster tiles)
- Trail rendering: white border (5px) + magenta line (3px, #FF10F0)
- Auto-fit bounds to trail on selection
- Pin drop: map click → onMapClick(lat, lng)
- Pin markers: 32px blue circles with letter labels
- Pin interaction: first click selects (yellow highlight), second click removes
- NavigationControl for zoom
- Mobile optimization: touchPitch disabled (prevents accidental 3D tilt)

### 3. TrailPicker Component (223 lines)
- Search filter: trails by name, region, or country
- Country-grouped display with alphabetical sorting
- Quick picks: 5 popular trails (Overland Track, PCT, Wonderland, Milford, TMB)
- Lazy loading: fetches coordinates from `/trail-data/{id}.json` for 252 trails
- Collapsed state: shows selected trail name + distance
- Expanded state: scrollable list with search
- Loading spinner during coordinate fetch
- GeoJSON conversion: coordinates → LineString Feature

### 4. PinPanel Component (229 lines)
- Pin list: lettered markers with coordinates (3 decimal places)
- Individual pin copy: "Copy" icon per pin → `WX lat lng`
- Multi-pin copy: "Copy All Pins for SMS" → `WX lat1 lng1 lat2 lng2 ...`
- SMS character counter: shows `{length} / 160 characters`
- Warning: "Too long for single SMS" when > 160 chars
- Copy feedback: 2-second toast "Copied!"
- Clear all: tap twice to confirm
- Expandable bottom sheet: collapsed shows pin count + quick copy
- Empty state: "Tap the map to drop a pin" with pin emoji
- Clipboard API with fallback for older browsers

## Technical Patterns

### Mobile-First Layout
```
┌─────────────────────┐
│ Header (fixed)      │  60px
├─────────────────────┤
│ Trail Picker        │  Variable (collapsed: 60px, expanded: 384px)
├─────────────────────┤
│                     │
│     MAP (flex-1)    │  Takes remaining space
│                     │
├─────────────────────┤
│ Pin Panel (sheet)   │  Variable (collapsed: 60px, expanded: 400px)
└─────────────────────┘
```

Full viewport height (`h-screen`), flexbox column, map takes `flex-1`.

### Lazy Trail Loading
252 trails in `popularTrails.ts`, but only metadata inline. Coordinates in separate JSON files:
- Check if `lazyTrailIds.has(trailId)`
- Fetch `/trail-data/{id}.json` on selection
- 189 trails from OSM/Waymarked Trails (Phase 10 pipeline)
- Reduces initial bundle size

### WX Command Format
```
Single pin:  WX -42.753 146.012
Multi-pin:   WX -42.753 146.012 -42.748 146.019 -42.741 146.025
```

3 decimal places (~100m precision). Space-separated lat/lng pairs.

## Deviations from Plan

None - plan executed exactly as written.

## Testing & Verification

✅ `npm run build` passes (no TypeScript errors)
✅ `/prototype` route loads (HTTP 200)
✅ No authentication required
✅ Trail picker shows all 252 trails grouped by country
✅ Trail selection loads coordinates and displays on map
✅ Map click drops lettered pins (A, B, C...)
✅ Up to 8 pins can be placed
✅ PinPanel displays coordinates with copy buttons
✅ Single-pin copy: `WX lat lng`
✅ Multi-pin copy: `WX lat1 lng1 lat2 lng2 ...`
✅ SMS character count warns at >160 chars
✅ Mobile-responsive layout works

### Build Output
```
Route (app)                              Size     First Load JS
├ ○ /prototype                           4.86 kB         131 kB
```

131 kB First Load JS includes MapLibre GL bundle (~40 kB) + react-map-gl (~15 kB).

## Next Phase Readiness

**Ready for Plan 12-02:** Multi-Pin Weather + Grid + Time Scrubber

Requirements for 12-02:
- ✅ Pin state management (array of {id, lat, lng, label})
- ✅ Map infrastructure (PrototypeMap ready for weather overlays)
- ✅ Trail + pin display (visual foundation for grid)
- ✅ Mobile-first layout (space for forecast cards)

Plan 12-02 will add:
- Open-Meteo API calls for each pin (hourly forecast)
- Weather grid: pins × hours in a scrollable table
- Time scrubber: slide through 48-hour forecast
- Forecast cards: temp, precipitation, wind per pin

No blockers. Pin panel can expand to show weather data. Map can render color-coded grid overlay.

## Commits

| Hash    | Message                                            | Files |
|---------|---------------------------------------------------|-------|
| dd3d4c1 | feat(12-01): create /prototype page layout        | 1     |
| 8e8c5d9 | feat(12-01): create PrototypeMap component         | 1     |
| f395a59 | feat(12-01): create TrailPicker with lazy loading  | 1     |
| 4f7e3a5 | feat(12-01): create PinPanel with SMS export       | 1     |

**Total:** 4 commits, 753 lines added, 0 lines removed

## User Value Delivered

**Immediate value for satellite SMS users:**

This POC delivers a working tool TODAY for hikers with satellite SMS. Example user flow:

1. Hiker opens https://thunderbird.bot/prototype on phone before trip
2. Selects "Overland Track" from trail picker
3. Drops pins at Day 1, Day 3, Day 5 camps
4. Taps "Copy All Pins for SMS"
5. Pastes into satellite SMS app: `WX -41.637 145.951 -41.753 146.012 -41.881 146.089`
6. Sends to Thunderbird number, receives 3 forecasts back

No weather display yet (that's Plan 12-02), but the coordinate picker + SMS export is a standalone tool that reduces manual coordinate entry from trail maps.

**Target users:** Telstra Satellite customers (live now), T-Mobile Starlink coverage (launching Q2 2026), Rogers Lynk (Canada, Q3 2026), One NZ (Q4 2026).

---

*Summary completed: 2026-02-11*
*Execution time: 52 minutes*
*Status: Complete*
