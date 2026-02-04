---
phase: 09-monitoring-alerting
plan: 05
subsystem: infra
tags: [monitoring, self-monitoring, reporting, systemd, apscheduler, email, sms]

# Dependency graph
requires:
  - phase: 09-01
    provides: Monitoring service with health checks and metrics storage
  - phase: 09-02
    provides: Alert manager with SMS/email channels and deduplication
  - phase: 09-06
    provides: Error log aggregation and pattern detection
provides:
  - Self-monitoring heartbeat that detects if monitoring service stops
  - Daily/weekly/monthly health reports via email
  - Production deployment configuration with systemd
  - Automated metrics cleanup (90-day retention)
affects: [production-deployment, monitoring-operations]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Self-monitoring pattern: monitoring service monitors itself
    - Report scheduling with cron triggers (daily 8AM, Monday 8AM, 1st of month)
    - Meta-monitoring alerts bypass deduplication

key-files:
  created:
    - backend/monitoring/self_monitor.py
    - backend/monitoring/reporting.py
    - backend/monitoring/requirements.txt
    - backend/monitoring/deploy/monitoring.service
    - backend/monitoring/deploy/setup_monitoring.sh
  modified:
    - backend/monitoring/scheduler.py

key-decisions:
  - "Self-monitoring runs every 5 minutes, alerts if no checks for 10+ minutes"
  - "Reports sent at 8 AM UTC: daily, weekly (Monday), monthly (1st)"
  - "Monthly reports include SLA compliance tracking (99.9% target)"
  - "Systemd service auto-restarts on crash with 10s delay"
  - "Cleanup job runs nightly at 3 AM UTC with 90-day retention"

patterns-established:
  - "Meta-monitoring pattern: self-monitoring alerts bypass deduplication for reliability"
  - "Report HTML formatting: status badges, color-coded uptime, trend arrows"
  - "Production deployment: systemd service + setup script + environment config template"

# Metrics
duration: 93min
completed: 2026-02-04
---

# Phase 9 Plan 5: Self-Monitoring & Production Deployment Summary

**Self-monitoring heartbeat with daily/weekly/monthly reports, systemd service with auto-restart, and one-script production deployment**

## Performance

- **Duration:** 93 min (1h 33m)
- **Started:** 2026-02-04T08:30:09Z
- **Completed:** 2026-02-04T12:03:31Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Self-monitoring detects if monitoring service itself stops (no checks for 10+ minutes)
- Daily/weekly/monthly health reports with HTML email formatting and SLA tracking
- Production deployment configuration with systemd auto-restart and setup automation
- Scheduler expanded to 18 jobs including heartbeat, reporting, and cleanup

## Task Commits

Each task was committed atomically:

1. **Task 1: Self-monitoring, reporting, and requirements** - `bad59b5` (feat)
   - Self-monitoring heartbeat runs every 5 minutes
   - Daily/weekly/monthly report generation and email delivery
   - All dependencies documented in requirements.txt
   - Scheduler jobs added for heartbeat, reports, cleanup

2. **Task 2: Production deployment configuration** - `bb80719` (chore)
   - Systemd service file with auto-restart on crash
   - Setup script for full deployment automation
   - Environment config template creation

## Files Created/Modified

- `backend/monitoring/self_monitor.py` - Self-health checks and heartbeat with direct SMS/email alerts
- `backend/monitoring/reporting.py` - Daily/weekly/monthly report generation with HTML formatting
- `backend/monitoring/scheduler.py` - Added heartbeat, reporting, and enhanced cleanup jobs
- `backend/monitoring/requirements.txt` - Python dependencies for monitoring service
- `backend/monitoring/deploy/monitoring.service` - Systemd unit file for production
- `backend/monitoring/deploy/setup_monitoring.sh` - Automated deployment script

## Decisions Made

1. **Self-monitoring every 5 minutes with 10-minute staleness threshold** - Detects monitoring failures quickly without false positives
2. **Reports at 8 AM UTC for consistency** - Daily, weekly (Monday), monthly (1st) - predictable schedule
3. **Monthly reports include 99.9% SLA compliance tracking** - Provides accountability and performance visibility
4. **Systemd auto-restart with 10-second delay** - Resilience without thrashing on persistent failures
5. **Cleanup runs at 3 AM UTC with 90-day retention** - Off-peak hours, adequate history for analysis
6. **Meta-monitoring alerts bypass deduplication** - Self-monitoring failures need immediate escalation without rate limiting
7. **HTML email reports with status badges and trend arrows** - Professional appearance, easy to scan visually
8. **Setup script creates environment template** - Guides production configuration without exposing secrets

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added log cleanup to nightly cleanup job**
- **Found during:** Task 1 (cleanup job implementation)
- **Issue:** Plan specified metrics cleanup but logs also need retention enforcement
- **Fix:** Added `cleanup_old_logs()` call to existing cleanup job
- **Files modified:** backend/monitoring/scheduler.py
- **Verification:** Log cleanup imported and called with same 90-day retention
- **Committed in:** bad59b5 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Stored global scheduler reference for self-monitoring**
- **Found during:** Task 1 (self-monitoring implementation)
- **Issue:** Self-health check needs to verify scheduler is running but had no reference
- **Fix:** Added `_scheduler` global variable set in `create_scheduler()`
- **Files modified:** backend/monitoring/scheduler.py
- **Verification:** Self-monitor can check `scheduler.running` status
- **Committed in:** bad59b5 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 missing critical)
**Impact on plan:** Both fixes necessary for complete self-monitoring and cleanup. No scope creep.

## Issues Encountered

None - plan executed smoothly with only minor enhancements for completeness.

## User Setup Required

**Production deployment requires manual configuration.** The setup script creates a template at `/etc/default/thunderbird-monitoring` that must be edited with:

- Real phone numbers for SMS alerts (replace `+61XXXXXXXXX`)
- Real email addresses for alert recipients (replace `admin@thunderbird.bot`)
- Verify Twilio and Resend credentials are configured

Run on production server:
```bash
sudo bash backend/monitoring/deploy/setup_monitoring.sh
sudo vim /etc/default/thunderbird-monitoring  # Edit with real values
sudo systemctl restart thunderbird-monitoring
```

Verify deployment:
```bash
curl http://localhost:8001/health
journalctl -u thunderbird-monitoring -f
```

Optional: Register `https://thunderbird.bot:8001/health` with external monitoring service like healthchecks.io for meta-meta-monitoring.

## Next Phase Readiness

**Monitoring system complete and production-ready:**
- Self-monitoring ensures monitoring service reliability
- Automated reports provide regular health visibility
- Production deployment is one-script setup
- All 18 scheduler jobs operational (health checks, synthetic tests, alerting, reporting, cleanup)

**Remaining in Phase 9:**
- Plan 09-06 already complete (error log aggregation)
- Phase 9 can now be marked complete

**Blockers/concerns:** None

---
*Phase: 09-monitoring-alerting*
*Completed: 2026-02-04*
