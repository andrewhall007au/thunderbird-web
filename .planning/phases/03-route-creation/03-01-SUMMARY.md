---
phase: 03-route-creation
plan: 01
subsystem: database
tags: [sqlite, alembic, gpxpy, custom-routes, waypoints]

# Dependency graph
requires:
  - phase: 02-payments
    provides: account_id foreign key reference
provides:
  - CustomRoute, CustomWaypoint, RouteLibrary SQLAlchemy models
  - Database migration for route tables
  - Globally unique sms_code constraint
  - gpxpy dependency for GPX parsing
affects: [03-02, 03-03, 03-04]

# Tech tracking
tech-stack:
  added: [gpxpy]
  patterns: [dataclass-models, store-classes, enum-status]

key-files:
  created:
    - backend/app/models/custom_route.py
    - backend/alembic/versions/3b3ffb2bb293_add_custom_routes_tables.py
  modified:
    - backend/requirements.txt

key-decisions:
  - "GPX stored as JSON dict, not raw XML"
  - "sms_code has UNIQUE index for collision prevention"
  - "RouteStatus enum: draft, active, archived"
  - "WaypointType enum: camp, peak, poi"

patterns-established:
  - "Route models follow account.py/payments.py dataclass + store pattern"
  - "Store classes use contextmanager for connection management"

# Metrics
duration: 3min
completed: 2026-01-19
---

# Phase 3 Plan 01: Custom Route Database Models Summary

**SQLAlchemy models and migration for custom routes, waypoints, and route library with globally unique SMS codes**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-19T11:13:11Z
- **Completed:** 2026-01-19T11:16:05Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- CustomRoute, CustomWaypoint, RouteLibrary dataclass models with all fields
- Alembic migration creating 3 tables with proper indexes
- Unique constraint on sms_code for global collision prevention
- gpxpy dependency added for server-side GPX parsing

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CustomRoute and CustomWaypoint SQLAlchemy models** - `d8d1749` (feat)
2. **Task 2: Create Alembic migration for route tables** - `919f1da` (feat)
3. **Task 3: Add gpxpy to backend requirements** - `a90b480` (chore)

## Files Created/Modified
- `backend/app/models/custom_route.py` - Route, Waypoint, Library models with Store classes
- `backend/alembic/versions/3b3ffb2bb293_add_custom_routes_tables.py` - Database migration
- `backend/requirements.txt` - Added gpxpy>=1.6.0

## Decisions Made
1. **GPX stored as JSON dict** - Parsed on upload, not raw XML, for easier querying
2. **Unique sms_code index** - Global uniqueness across all waypoints prevents collision
3. **RouteStatus enum** - draft/active/archived for route lifecycle management
4. **WaypointType enum** - camp/peak/poi for visual styling consistency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Database already had legacy tables created outside Alembic
- Solution: Stamped alembic_version at 842752b6b27d then ran upgrade head
- Migration applied cleanly after stamp

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Models ready for GPX parsing service in Plan 02
- Database schema supports all route creation requirements
- gpxpy installed for track extraction and waypoint parsing

---
*Phase: 03-route-creation*
*Completed: 2026-01-19*
