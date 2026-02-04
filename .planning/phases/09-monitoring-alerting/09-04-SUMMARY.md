---
phase: 09-monitoring-alerting
plan: 04
subsystem: infra
tags: [monitoring, dashboard, nextjs, fastapi, incident-management, tailwind]

# Dependency graph
requires:
  - phase: 09-monitoring-alerting
    plan: 01
    provides: Monitoring service foundation with SQLite metrics DB and incident tracking
provides:
  - Dashboard API with 7 RESTful endpoints serving metrics, uptime, incidents, acknowledgment, and timelines
  - Next.js monitoring dashboard at /monitoring with real-time system health visualization
  - Incident acknowledgment workflow to stop alert escalation
  - Incident timeline showing chronological progression of events
affects: [09-02-alerting, future-admin-dashboards]

# Tech tracking
tech-stack:
  added: [fastapi-router, react-hooks (useState, useEffect)]
  patterns: [API router mounted in both monitoring service and main backend, auto-refresh dashboard with 30s polling, expandable timeline component]

key-files:
  created:
    - backend/monitoring/api.py
    - app/monitoring/page.tsx
    - app/monitoring/components/StatusCard.tsx
    - app/monitoring/components/UptimeChart.tsx
    - app/monitoring/components/IncidentLog.tsx
  modified:
    - backend/monitoring/main.py
    - backend/app/main.py

key-decisions:
  - "Mount monitoring API in both monitoring service (port 8001) and main backend (port 8000) for unified access via existing Next.js proxy"
  - "Use display name mapping for human-readable check names in API responses"
  - "Fetch incident timeline on-demand (not eagerly) to reduce initial page load"
  - "Auto-refresh dashboard every 30 seconds via setInterval for near-real-time monitoring"
  - "Simple CSS-based uptime bars instead of chart library (lightweight v1)"
  - "Dashboard is internal tool - not linked in public navigation"

patterns-established:
  - "Dashboard API pattern: GET endpoints for data retrieval, POST for acknowledgment actions"
  - "Color-coded status: green (pass), amber (degraded), red (fail) with uptime thresholds (>99.5%, >99%, <99%)"
  - "Expandable sections: error details in StatusCard, timelines in IncidentLog"
  - "Relative timestamps: '2m ago', '5h ago' for human-readable time display"
  - "Vertical timeline: dots + line for chronological event progression"

# Metrics
duration: 4min
completed: 2026-02-04
---

# Phase 9 Plan 4: Status Dashboard with Incident Acknowledgment and Timeline Summary

**Next.js dashboard at /monitoring with real-time health monitoring, incident acknowledgment to stop escalation, and expandable event timelines showing failure progression**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-04T08:16:19Z
- **Completed:** 2026-02-04T08:20:52Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Dashboard API serving metrics, uptime stats, incident data, acknowledgment endpoint, and timeline reconstruction
- Status dashboard with auto-refresh showing system health, uptime percentages, and active incidents
- Incident acknowledgment workflow stops alert escalation (prevents warning -> SMS transition)
- Incident timelines show chronological events: first failure, consecutive failures, alerts sent, acknowledgment, resolution

## Task Commits

Each task was committed atomically:

1. **Task 1: Dashboard API endpoints including acknowledgment and incident timeline** - `8ae7e53` (feat)
   - Created monitoring/api.py with 7 RESTful endpoints
   - GET /api/monitoring/status - overall system health
   - GET /api/monitoring/uptime - uptime percentages per check
   - GET /api/monitoring/metrics/{check_name} - time series data
   - GET /api/monitoring/incidents - active and resolved incidents
   - POST /api/monitoring/incidents/{id}/acknowledge - stop escalation
   - GET /api/monitoring/incidents/{id}/timeline - chronological events
   - GET /api/monitoring/summary - daily summary stats
   - Mounted router in monitoring service (port 8001)
   - Mounted router in main backend (port 8000) via try/except import
   - Display name mapping for human-readable check names

2. **Task 2: Next.js monitoring dashboard page with acknowledge and timeline** - `9e65f93` (feat)
   - Created /monitoring page with real-time system health overview
   - StatusCard component: color-coded status, relative timestamps, expandable errors
   - UptimeChart component: 24-hour uptime bars with color thresholds
   - IncidentLog component: active/resolved incidents with acknowledge buttons and expandable timelines
   - Auto-refresh every 30 seconds via setInterval
   - Acknowledge button updates incident status and stops escalation
   - Timeline fetched on-demand via GET /api/monitoring/incidents/{id}/timeline
   - Vertical timeline with event markers (first failure, consecutive failures, acknowledged, resolved)
   - Responsive grid layout (3 cols desktop, 2 tablet, 1 mobile)
   - Overall status banner (green/yellow/red) based on check results

## Files Created/Modified

- `backend/monitoring/api.py` - Dashboard API router with 7 endpoints for metrics, uptime, incidents, acknowledgment, and timelines
- `backend/monitoring/main.py` - Mounted API router in monitoring service
- `backend/app/main.py` - Mounted API router in main backend via try/except import
- `app/monitoring/page.tsx` - Main dashboard page with auto-refresh and data fetching
- `app/monitoring/components/StatusCard.tsx` - Individual check status cards with expandable error details
- `app/monitoring/components/UptimeChart.tsx` - Horizontal uptime bars with percentage thresholds
- `app/monitoring/components/IncidentLog.tsx` - Incident list with acknowledge buttons and expandable timelines

## Decisions Made

**1. Mount monitoring API in both monitoring service and main backend**
- **Rationale:** Dashboard fetches from main backend via existing Next.js proxy. Mounting in both services ensures API is accessible via proxy while maintaining standalone monitoring service capability.
- **Implementation:** Main backend imports monitoring.api with try/except to handle cases where monitoring module isn't available.

**2. Display name mapping in API responses**
- **Rationale:** Internal check names (health_check, db_query_performance) aren't user-friendly. Display names ("Backend Health", "Database Queries") improve dashboard readability.
- **Implementation:** DISPLAY_NAMES dict in api.py maps check names to readable labels.

**3. On-demand timeline fetching**
- **Rationale:** Fetching timelines for all incidents on page load would be slow. Most users won't expand timelines.
- **Implementation:** Timeline data fetched only when user clicks "Timeline" button, stored in component state.

**4. Simple CSS-based uptime bars instead of chart library**
- **Rationale:** Lightweight v1 dashboard doesn't need Chart.js or Recharts overhead. Horizontal bars with width percentages are sufficient.
- **Trade-off:** Less interactive than charting library, but faster page load and simpler maintenance.

**5. Dashboard is internal (not in public nav)**
- **Rationale:** Status dashboard is for admins/operators only. Accessible via direct URL (/monitoring) but not linked in public navigation.
- **Future:** Could add admin auth requirement if needed.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**Accessing the dashboard:**

The monitoring dashboard is available at `/monitoring` on the frontend (e.g., `http://localhost:3000/monitoring` in development, `https://thunderbird.bot/monitoring` in production).

**No authentication:**
- Dashboard is accessible to anyone with the URL
- Consider adding authentication middleware if exposing publicly
- Currently intended as internal admin tool

**Monitoring service must be running:**
- Ensure monitoring service is running on port 8001: `cd backend && python3 -m monitoring.main`
- Main backend proxies requests to monitoring service or serves directly if monitoring module available

**Verification:**
```bash
# Check dashboard loads
curl http://localhost:3000/monitoring

# Check API endpoints
curl http://localhost:8000/api/monitoring/status
curl http://localhost:8000/api/monitoring/uptime?hours=24
curl http://localhost:8000/api/monitoring/incidents
```

## Next Phase Readiness

**Ready for:**
- Plan 09-02 (Alerting) can reference incident acknowledgment status to decide whether to escalate alerts
- Future admin dashboards can follow similar patterns (API router + Next.js components)
- Monitoring data is now visible without SSH access to server

**No blockers.**

**Potential enhancements:**
- Add authentication to dashboard (currently accessible via direct URL)
- Add response time charts for historical trend analysis
- Add alert history log showing when SMS/email alerts were sent
- Add dashboard for recently resolved incidents (last 7 days)

---
*Phase: 09-monitoring-alerting*
*Completed: 2026-02-04*
