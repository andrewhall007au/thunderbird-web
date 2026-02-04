---
phase: 09-monitoring-alerting
plan: 01
subsystem: infra
tags: [monitoring, apscheduler, sqlite, fastapi, health-checks]

# Dependency graph
requires:
  - phase: 08-security-hardening
    provides: Secured production backend with rate limiting and CORS
provides:
  - Standalone monitoring service with SQLite metrics database
  - Health checks for backend, frontend, API, database query performance, and external API latency
  - APScheduler running checks at configured intervals (1min, 5min, 10min)
  - FastAPI monitoring app on port 8001 with metrics API
  - Incident tracking with create/resolve/acknowledge operations
affects: [09-02-alerting, 09-03-synthetic-tests, 09-04-dashboard]

# Tech tracking
tech-stack:
  added: [apscheduler, sqlite3 (WAL mode), requests]
  patterns: [CheckResult dataclass for structured check returns, separate monitoring service on port 8001, metrics storage with UUIDv4 keys, scheduled jobs with interval triggers]

key-files:
  created:
    - backend/monitoring/__init__.py
    - backend/monitoring/config.py
    - backend/monitoring/storage.py
    - backend/monitoring/checks.py
    - backend/monitoring/scheduler.py
    - backend/monitoring/main.py

key-decisions:
  - "Use SQLite with WAL mode instead of PostgreSQL for metrics (simpler, adequate for monitoring data)"
  - "Separate monitoring service on port 8001 instead of adding to main app (isolation, independent lifecycle)"
  - "UUIDv4 for metric IDs (sufficient for non-sequential identifiers)"
  - "Direct production DB connection for query performance checks (read-only mode)"
  - "Pydantic settings with extra='ignore' to coexist with main app .env"

patterns-established:
  - "CheckResult dataclass: Structured return from all check functions with check_name, status, duration_ms, error_message, metadata"
  - "Store-on-run: Every check execution stores result in metrics DB immediately"
  - "Incident lifecycle: create (store_incident) -> acknowledge -> resolve with failure_count tracking"
  - "Scheduler job wrappers: Individual job functions that call check, store metric, log result"

# Metrics
duration: 4min
completed: 2026-02-04
---

# Phase 9 Plan 1: Monitoring Service Foundation Summary

**Standalone monitoring service with SQLite metrics DB, health checks for all critical systems including DB query performance and external API latency, APScheduler running checks every 1-10 minutes**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-04T08:08:31Z
- **Completed:** 2026-02-04T08:12:21Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Monitoring service infrastructure with SQLite metrics database (WAL mode for concurrent access)
- Health checks detect backend/frontend failures, slow API responses, degraded DB query performance, and slow external APIs
- APScheduler runs checks automatically: health (1min), beta signup + DB queries (5min), weather + external APIs (10min)
- Incident tracking with acknowledgment capability for alert deduplication
- FastAPI monitoring app on port 8001 serves metrics via REST API

## Task Commits

Each task was committed atomically:

1. **Task 1: Monitoring config, metrics storage, and check result types** - `ba51b02` (feat)
   - MonitoringSettings with Pydantic BaseSettings
   - SQLite metrics DB with WAL mode, UUIDv4 keys, timestamps
   - CheckResult dataclass for structured check results
   - Incidents table for failure tracking (create/resolve/acknowledge)
   - Storage functions: store_metric, get_recent_metrics, get_uptime_stats, consecutive failure tracking

2. **Task 2: Health checks and APScheduler runner** - `af32b33` (feat)
   - Health check implementations: backend, frontend, beta signup, API response time, weather API
   - Database query performance check: tests simple + join queries, detects slow queries (>500ms)
   - External API latency check: monitors Stripe, Twilio, Open-Meteo with 5s threshold
   - APScheduler with interval triggers + cron cleanup job
   - FastAPI monitoring service with /health, /api/metrics/latest, /api/uptime, /api/incidents endpoints

## Files Created/Modified

- `backend/monitoring/__init__.py` - Package initialization
- `backend/monitoring/config.py` - MonitoringSettings with Pydantic, loads from .env with MONITOR_ prefix support
- `backend/monitoring/storage.py` - SQLite metrics database with WAL mode, metrics + incidents tables, query functions
- `backend/monitoring/checks.py` - Health check implementations returning CheckResult objects
- `backend/monitoring/scheduler.py` - APScheduler configuration with job wrappers for each check type
- `backend/monitoring/main.py` - FastAPI monitoring app on port 8001 with metrics API endpoints

## Decisions Made

**1. SQLite with WAL mode for metrics instead of PostgreSQL**
- **Rationale:** Metrics are append-only time series data with simple queries. SQLite with WAL mode handles concurrent reads/writes adequately and avoids needing a separate PostgreSQL instance for monitoring.
- **Trade-off:** Less scalable than Postgres, but sufficient for single-server monitoring needs.

**2. Separate monitoring service on port 8001**
- **Rationale:** Isolates monitoring from main app (port 8000). If main app crashes, monitoring service can still detect it and alert. Independent lifecycle management.
- **Alternative considered:** Adding monitoring endpoints to main app - rejected because monitoring should survive main app failures.

**3. Database query performance separate from connectivity**
- **Rationale:** Basic connectivity checks (backend health) don't catch slow queries. MON-03 requirement: track DB query performance independently with configurable thresholds.
- **Implementation:** Read-only connection to production DB, runs representative queries (simple COUNT, join query), measures execution time.

**4. External API latency tracking for Stripe, Twilio, Open-Meteo**
- **Rationale:** Thunderbird depends on external APIs for payments (Stripe), SMS (Twilio), and weather data (Open-Meteo). MON-03 requirement: track their availability and response times.
- **Implementation:** Single check that tests all three APIs, returns aggregated status with per-API latency in metadata.

**5. Pydantic config with extra='ignore' to coexist with main app .env**
- **Rationale:** Monitoring service loads .env from parent directory (same as main app). Without extra='ignore', Pydantic would fail on unknown environment variables.
- **Solution:** Use MONITOR_ prefix for monitoring-specific settings, allow other settings to pass through, import shared credentials (Twilio, Stripe) without prefix.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**1. Pydantic validation error on initial config load**
- **Issue:** MonitoringSettings initially used `env_prefix="MONITOR_"` without `extra="ignore"`, causing validation errors when loading .env with main app settings.
- **Resolution:** Added `extra="ignore"` to SettingsConfigDict to allow non-monitoring environment variables to be present without failing validation.
- **Learning:** When loading shared .env files, Pydantic settings need extra='ignore' to coexist with other configs.

## User Setup Required

**Environment variables required for full functionality:**

The monitoring service works out of the box for basic checks but requires these environment variables for external API latency checks:

```bash
# .env (optional but recommended)
MONITOR_PRODUCTION_URL=https://thunderbird.bot
MONITOR_DB_PATH=backend/monitoring/monitoring.db
MONITOR_PRODUCTION_DB_PATH=/root/overland-weather/backend/production.db

# Shared credentials (already in .env from main app)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
STRIPE_SECRET_KEY=...
```

**Running the monitoring service:**

```bash
cd backend
python3 -m monitoring.main
# Service starts on http://localhost:8001
```

**Verification:**

```bash
# Check service is running
curl http://localhost:8001/health

# View latest metrics
curl http://localhost:8001/api/metrics/latest

# View uptime stats
curl http://localhost:8001/api/uptime?hours=24
```

## Next Phase Readiness

**Ready for next plans:**

- **09-02 (Alerting):** Metrics database and incident tracking ready. Consecutive failure detection implemented. Alert logic can query get_consecutive_failures() to decide when to send SMS/email.
- **09-03 (Synthetic tests):** Check runner pattern established. Playwright browser tests can follow same pattern: run test -> return CheckResult -> store_metric().
- **09-04 (Dashboard):** Metrics API endpoints ready. Dashboard can fetch /api/metrics/latest, /api/uptime for visualization.

**No blockers.**

**Concerns:**

- Database query performance check requires read-only access to production SQLite database. Default path assumes `/root/overland-weather/backend/production.db`. Verify this path on production server or set `MONITOR_PRODUCTION_DB_PATH` environment variable.
- External API latency checks work without credentials (just tests reachability) but authenticated checks are more reliable. Ensure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, STRIPE_SECRET_KEY are set in production.

---
*Phase: 09-monitoring-alerting*
*Completed: 2026-02-04*
