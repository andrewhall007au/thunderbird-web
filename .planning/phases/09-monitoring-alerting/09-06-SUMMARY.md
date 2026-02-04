---
phase: 09-monitoring-alerting
plan: 06
subsystem: infra
tags: [monitoring, logs, error-tracking, sqlite, pattern-detection]

# Dependency graph
requires:
  - phase: 09-monitoring-alerting
    plan: 01
    provides: Monitoring service foundation with SQLite database
provides:
  - Centralized error log storage with full-text search capabilities
  - Error rate tracking with threshold-based alerting (1/5 errors per minute)
  - Error pattern detection with message normalization and deduplication
  - Log collection via Python logging handler and systemd journalctl
  - API endpoints for log search, error rate, and pattern management
affects: [09-02-alerting, 09-04-dashboard]

# Tech tracking
tech-stack:
  added: [python-logging-handler, systemd-journalctl, message-normalization]
  patterns: [error-pattern-deduplication, rate-based-alerting, log-aggregation]

key-files:
  created:
    - backend/monitoring/logs/__init__.py
    - backend/monitoring/logs/storage.py
    - backend/monitoring/logs/collector.py
    - backend/monitoring/logs/analyzer.py
  modified:
    - backend/monitoring/api.py
    - backend/monitoring/scheduler.py
    - backend/monitoring/main.py

key-decisions:
  - "Store logs in same SQLite database as metrics (simplicity, shared connection pool)"
  - "Normalize error messages with regex substitution for UUID/numbers/strings (pattern detection)"
  - "Support both systemd journalctl and log file scraping (flexibility for dev/prod)"
  - "Error rate thresholds: <1 errors/min = pass, 1-5 = degraded, >5 = fail"
  - "Pattern status lifecycle: new -> known/resolved/ignored (manual triage)"

patterns-established:
  - "Error pattern detection: normalize message -> hash -> deduplicate -> store occurrence count"
  - "Log collection strategies: systemd journal (production) with fallback to file scraping (development)"
  - "Error rate check integrated with existing alerting pipeline via CheckResult"

# Metrics
duration: 7min
completed: 2026-02-04
---

# Phase 9 Plan 6: Centralized Error Log Aggregation Summary

**Centralized error log storage with search, rate tracking, pattern detection, and API endpoints for dashboard integration**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-04T08:17:30Z
- **Completed:** 2026-02-04T08:24:30Z
- **Tasks:** 2
- **Files created:** 4
- **Files modified:** 3

## Accomplishments

- Error logs centrally collected and stored in SQLite with search/filter capabilities
- Error rate tracking calculates errors per minute with threshold-based status
- Pattern detection normalizes error messages to identify recurring issues
- Log collection via Python logging handler and systemd journalctl
- API endpoints for log search, error rate visualization, and pattern management
- Scheduler jobs collect logs every 2 minutes, check error rate every 5 minutes

## Task Commits

Each task was committed atomically:

1. **Task 1: Log storage schema, collector, and error pattern analyzer** - `efa3de0` (feat)
   - SQLite tables: error_logs (with full-text search) and error_patterns (deduplication)
   - MonitoringLogHandler: custom Python logging handler for automatic error collection
   - Log file scraping: parse structured JSON logs and Python tracebacks
   - Systemd journalctl collection: query systemd journal for error-level logs
   - Error pattern detection: normalize messages (replace UUIDs, numbers, strings with placeholders)
   - Error rate tracking: calculate errors per minute with threshold-based CheckResult

2. **Task 2: Log aggregation API endpoints and scheduler integration** - `4538745` (feat)
   - API endpoints: GET /logs (search/filter), /logs/rate (time-series rate), /logs/patterns (top patterns)
   - PATCH /logs/patterns/{id}: update pattern status (new -> known/resolved/ignored)
   - Scheduler jobs: log_collection (2min), error_rate_check (5min), pattern_detection (30min)
   - Init log tables on monitoring service startup

## Files Created/Modified

**Created:**
- `backend/monitoring/logs/__init__.py` - Package initialization
- `backend/monitoring/logs/storage.py` - SQLite storage with error_logs and error_patterns tables
- `backend/monitoring/logs/collector.py` - MonitoringLogHandler, log file scraping, systemd journalctl collection
- `backend/monitoring/logs/analyzer.py` - Error pattern detection, rate tracking, pattern summary

**Modified:**
- `backend/monitoring/api.py` - Added log aggregation endpoints (/logs, /logs/rate, /logs/patterns)
- `backend/monitoring/scheduler.py` - Added log collection, error rate check, pattern detection jobs
- `backend/monitoring/main.py` - Initialize log tables on startup

## Decisions Made

**1. Store logs in same SQLite database as metrics**
- **Rationale:** Logs are similar to metrics (time-series append-only data). Sharing the same database simplifies connection management and avoids needing a separate database instance.
- **Implementation:** `get_connection()` from monitoring.storage returns shared SQLite connection with WAL mode.

**2. Normalize error messages with regex substitution**
- **Rationale:** Identical errors with different IDs/timestamps/values should be grouped as the same pattern. Replace variable data with placeholders (e.g., UUID -> {UUID}, numbers -> {N}) before hashing.
- **Trade-off:** Normalization may occasionally group distinct errors, but dramatically reduces pattern noise.

**3. Support both systemd journalctl and log file scraping**
- **Rationale:** Production servers likely use systemd, but development environments may use log files. Supporting both ensures flexibility.
- **Implementation:** `collect_from_systemd_journal()` tries journalctl first, falls back to `collect_recent_errors()` for file-based logs.

**4. Error rate thresholds: <1/1-5/>5 errors per minute**
- **Rationale:** MON-07 requires detecting sustained error spikes. Thresholds based on expected normal error rate:
  - Normal: <1 error/min (occasional user errors, retries)
  - Elevated: 1-5 errors/min (degraded, investigate)
  - Critical: >5 errors/min (system failure, page immediately)
- **Integration:** Error rate check returns CheckResult, feeds through existing alerting pipeline.

**5. Pattern status lifecycle: new -> known/resolved/ignored**
- **Rationale:** Not all error patterns require immediate action. Allow marking patterns as "known" (expected), "resolved" (fixed), or "ignored" (noise) to reduce alert fatigue.
- **API:** PATCH /logs/patterns/{id} updates status for manual triage.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**1. Pydantic validation error on Query parameter with float ge constraint**
- **Issue:** FastAPI Query parameter `hours: int = Query(1, ge=0.1, le=24)` caused pydantic error: "ge must be coercible to an integer"
- **Resolution:** Changed `ge=0.1` to `ge=1` since hours parameter is integer. If fractional hours needed, change type to `float`.
- **Learning:** FastAPI Query constraints must match parameter type (int constraints for int params).

## User Setup Required

**No additional environment variables required.** Log aggregation works out of the box using the existing monitoring database.

**Optional configuration (for log file scraping):**
```bash
# .env (optional)
SYSTEMD_SERVICE_NAME=thunderbird-backend  # Default service name for journalctl
LOG_FILE_PATH=/var/log/thunderbird-backend.log  # Fallback log file path
```

**Using the MonitoringLogHandler (optional integration with main app):**

To automatically collect errors from the main backend application, add the monitoring log handler:

```python
# In backend/app/main.py
import logging
from monitoring.logs.collector import MonitoringLogHandler

# Add handler to root logger
logging.getLogger().addHandler(MonitoringLogHandler(level=logging.ERROR))
```

This will automatically store ERROR and above to the monitoring database.

**Accessing log endpoints:**

```bash
# Search logs
curl "http://localhost:8001/api/monitoring/logs?query=failed&level=ERROR&hours=24"

# Error rate
curl "http://localhost:8001/api/monitoring/logs/rate?hours=1"

# Error patterns
curl "http://localhost:8001/api/monitoring/logs/patterns?hours=24"

# Update pattern status
curl -X PATCH "http://localhost:8001/api/monitoring/logs/patterns/{pattern_id}" \
  -H "Content-Type: application/json" \
  -d '{"status": "known"}'
```

## Next Phase Readiness

**Ready for next plans:**

- **09-02 (Alerting):** Error rate check returns CheckResult and integrates with existing alerting pipeline. Elevated/critical error rates will trigger alerts when alerting plan is implemented.
- **09-04 (Dashboard):** Log endpoints ready for dashboard integration. UI can display recent errors, error rate trends, and top error patterns.

**No blockers.**

**Concerns:**

- **Log volume in production:** With 2-minute collection intervals, high-traffic applications may generate large log volumes. Monitor `error_logs` table size and adjust `cleanup_old_logs()` retention if needed (default: 90 days).
- **Pattern deduplication accuracy:** Normalization regex may occasionally group distinct errors or separate identical errors. Review top patterns to validate grouping logic.
- **Systemd journal availability:** If journalctl is not available or returns permission errors, log collection will fail silently. Check scheduler logs for "journalctl error" messages.

---
*Phase: 09-monitoring-alerting*
*Completed: 2026-02-04*
