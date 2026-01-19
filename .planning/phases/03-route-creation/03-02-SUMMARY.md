---
phase: 03-route-creation
plan: 02
subsystem: api
tags: [fastapi, gpxpy, geojson, sms-codes, route-builder]

# Dependency graph
requires:
  - phase: 03-01
    provides: CustomRoute, CustomWaypoint, RouteLibrary models and stores
provides:
  - RouteBuilderService with GPX parsing and SMS code generation
  - REST API endpoints for route and waypoint CRUD
  - Account ownership validation on all operations
affects: [03-03, 03-04, 04-user-flows]

# Tech tracking
tech-stack:
  added: []
  patterns: [service-singleton, ownership-validation, prefix-removal-sms-codes]

key-files:
  created:
    - backend/app/routers/routes.py
  modified:
    - backend/app/services/route_builder.py
    - backend/app/main.py

key-decisions:
  - "SMS codes remove common prefixes (Mt., Lake, Camp, etc.) before taking 5 chars"
  - "Code collisions handled with numeric suffix (OBERO -> OBER1 -> OBER2)"
  - "Reserved codes protected (HELP, STOP, START, etc.)"
  - "Track simplification via uniform sampling for >500 points"

patterns-established:
  - "Route/waypoint operations validate account ownership before CRUD"
  - "GPX upload returns preview data, not persisted until route creation"
  - "Waypoint SMS codes immutable (delete/recreate to change)"

# Metrics
duration: 3min
completed: 2026-01-19
---

# Phase 3 Plan 02: Route Builder Service and API Summary

**RouteBuilderService with GPX parsing, SMS code generation, and full REST API for route/waypoint CRUD with ownership validation**

## Performance

- **Duration:** 3 min 20 sec
- **Started:** 2026-01-19T11:17:41Z
- **Completed:** 2026-01-19T11:21:01Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- RouteBuilderService with GPX parsing via gpxpy (tracks + waypoints + metadata)
- SMS code generation from names with prefix removal and collision handling
- 10 API endpoints for routes and waypoints with authentication
- Track simplification for large GPX files (>500 points)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement RouteBuilderService** - `c0b981d` (feat)
2. **Task 2: Create routes API router** - `e6792f3` (feat)
3. **Task 3: Register router in main app** - `a308650` (feat)

## Files Created/Modified
- `backend/app/services/route_builder.py` - Full RouteBuilderService with GPX parsing, SMS codes, CRUD
- `backend/app/routers/routes.py` - 10 REST API endpoints for route management
- `backend/app/main.py` - Added routes router import and include

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/routes/upload-gpx | Parse GPX file (preview) |
| POST | /api/routes | Create route |
| GET | /api/routes | List user's routes |
| GET | /api/routes/{id} | Get route with waypoints |
| PATCH | /api/routes/{id} | Update route |
| DELETE | /api/routes/{id} | Delete route |
| POST | /api/routes/{id}/waypoints | Add waypoint |
| PATCH | /api/routes/{id}/waypoints/{id} | Update waypoint |
| DELETE | /api/routes/{id}/waypoints/{id} | Delete waypoint |
| POST | /api/routes/{id}/waypoints/reorder | Reorder waypoints |

## Decisions Made

1. **SMS code prefix removal** - Common geographic prefixes (Mt., Lake, Camp, Point, Peak, Hut, River) removed before taking first 5 characters
2. **Collision handling** - Numeric suffix appended: OBERO -> OBER1 -> OBER2 -> ... -> OBE10
3. **Reserved code protection** - System commands protected: HELP, STOP, START, CAST, CHECK, ALERT, CAMPS, PEAKS
4. **Track simplification** - Uniform sampling for >500 points (simple but effective)
5. **GPX upload preview** - Upload parses but doesn't persist; separate create route endpoint

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Missing Python dependencies (gpxpy, pwdlib[argon2], email-validator) in venv
- Solution: Installed as needed during verification steps
- Not a plan deviation - dependencies already in requirements.txt, just needed pip install

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Route builder API complete, ready for frontend integration (Plan 03-03: Map editor)
- All endpoints tested and working
- Waypoint management ready for UI (Plan 03-04)

---
*Phase: 03-route-creation*
*Completed: 2026-01-19*
