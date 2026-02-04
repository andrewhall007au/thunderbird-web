---
phase: 09-monitoring-alerting
plan: 02
subsystem: infra
tags: [alerting, twilio, resend, sms, email, deduplication, escalation]

# Dependency graph
requires:
  - phase: 09-monitoring-alerting
    plan: 01
    provides: Monitoring service foundation with health checks and incident tracking
provides:
  - Alert manager with SMS and email channels
  - Deduplication prevents duplicate alerts within 15 minutes
  - Severity-based routing (critical → SMS+email, warning → email with escalation)
  - Incident acknowledgment to stop escalation
  - SMS rate limiting (max 10/hour)
  - Recovery notifications when checks pass again
affects: [09-03-synthetic-tests, 09-04-dashboard]

# Tech tracking
tech-stack:
  added: [twilio-python, resend-python]
  patterns: [AlertManager singleton with global instance, async evaluate_and_alert pipeline, consecutive failure tracking before alerting]

key-files:
  created:
    - backend/monitoring/alerts/__init__.py
    - backend/monitoring/alerts/channels.py
    - backend/monitoring/alerts/manager.py
  modified:
    - backend/monitoring/scheduler.py

key-decisions:
  - "Require 2 consecutive failures before alerting (reduces false positives from transient network issues)"
  - "15-minute deduplication window prevents alert spam for persistent issues"
  - "Critical checks (health, beta, checkout, sms_webhook) send SMS+email immediately"
  - "Warning checks (login, weather, db, external_api) send email, escalate to SMS after 15min unacknowledged"
  - "SMS rate limit of 10/hour prevents cost explosion during major outages"
  - "Incident acknowledgment stops escalation but keeps tracking until resolved"
  - "Recovery notifications sent via SMS for critical, email for all severities"

patterns-established:
  - "evaluate_and_alert: Unified pipeline that stores metric, evaluates consecutive failures, routes to channels"
  - "Severity mapping: check_name → severity level → channel routing"
  - "Graceful degradation: Missing credentials log warnings but don't crash monitoring service"
  - "Global alert manager: Single instance shared across all scheduler jobs"

# Metrics
duration: 8min
completed: 2026-02-04
---

# Phase 9 Plan 2: Alert Manager Summary

**Alert manager with SMS/email channels, deduplication, escalation, acknowledgment, and scheduler wiring - transforms check failures into actionable notifications**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-04T08:16:35Z
- **Completed:** 2026-02-04T08:24:46Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- SMS and email alert channels with Twilio and Resend integration
- Alert manager evaluates check results with deduplication (15-min window)
- Consecutive failure requirement (2 failures) reduces false positives
- Severity-based routing: critical checks → immediate SMS+email, warnings → email with 15-min escalation
- Incident acknowledgment prevents escalation spam when responder is investigating
- SMS rate limiting (10/hour) prevents cost explosion during outages
- Recovery notifications sent when checks pass (SMS for critical, email for all)
- Scheduler integration: all check jobs now use unified evaluate_and_alert pipeline

## Task Commits

Each task was committed atomically:

1. **Task 1: Alert channels (SMS via Twilio, Email via Resend)** - `9e65f93` (feat)
   - TwilioSMSChannel: Send SMS via Twilio with 160-char single-segment messages
   - ResendEmailChannel: Send HTML email via Resend with color-coded severity banners
   - Alert formatting: THUNDERBIRD prefix, severity, check name, error message, timestamp
   - Recovery formatting: Separate templates for recovery notifications with downtime duration
   - Graceful credential handling: Missing credentials log warnings, don't crash
   - Rate limiting: 500ms delay between email sends (respects Resend 2 req/sec limit)
   - All send attempts logged with success/failure status

2. **Task 2: Alert manager with deduplication, escalation, acknowledgment** - `792fc35` (feat)
   - AlertManager class: Core alert evaluation and routing logic
   - Deduplication: _should_alert() checks 15-minute window per check
   - Consecutive failures: Requires 2 failures before alerting (configurable)
   - Severity determination: Maps check names to critical/warning/info levels
   - Critical alert flow: Send SMS (if rate limit allows) + email immediately
   - Warning alert flow: Send email immediately, escalate to SMS after 15min if unacknowledged
   - Escalation suppression: _should_escalate() checks acknowledgment status and time threshold
   - SMS rate limiting: _can_send_sms() enforces 10 SMS/hour limit with hourly reset
   - Recovery handling: Detects when failing check passes, sends recovery notifications
   - Acknowledgment API: acknowledge_incident() marks incident as acknowledged, stops escalation
   - Factory function: create_alert_manager() initializes with configured channels
   - Scheduler integration: All check jobs updated to call evaluate_and_alert()

## Files Created/Modified

**Created:**
- `backend/monitoring/alerts/__init__.py` - Package initialization
- `backend/monitoring/alerts/channels.py` - TwilioSMSChannel and ResendEmailChannel implementations
- `backend/monitoring/alerts/manager.py` - AlertManager with deduplication, escalation, acknowledgment logic

**Modified:**
- `backend/monitoring/scheduler.py` - Integrated AlertManager into all check jobs (health, beta, weather, db, external_api, synthetic tests, error rate)

## Decisions Made

**1. Require 2 consecutive failures before alerting**
- **Rationale:** Single failures often transient (network blips, API timeouts). Two consecutive failures indicate real issue.
- **Implementation:** AlertManager checks get_consecutive_failures() before routing to channels.
- **Trade-off:** Adds 1-5 minute delay (depending on check interval) but dramatically reduces false positives.

**2. 15-minute deduplication window**
- **Rationale:** Persistent issues shouldn't spam SMS/email every check cycle. 15 minutes gives responder time to investigate and acknowledge.
- **Implementation:** _last_alert_time dict tracks last alert per check, _should_alert() enforces 15-min minimum between alerts.
- **Alternative considered:** Single alert per incident - rejected because responders need periodic reminders for long-running incidents.

**3. Critical vs Warning severity with escalation**
- **Rationale:** Not all failures require immediate SMS. User-facing flows (beta signup, checkout) are critical. Supporting services (weather API, external APIs) are warnings.
- **Critical checks:** health_check, beta_signup_flow, checkout_flow, sms_webhook → immediate SMS + email
- **Warning checks:** login_flow, weather_api, api_response_time, db_query_performance, external_api_latency → email, then SMS after 15min if unacknowledged
- **Trade-off:** More complex routing logic, but prevents SMS fatigue and reduces costs.

**4. Incident acknowledgment to stop escalation**
- **Rationale:** When responder sees email and starts investigating, they shouldn't get escalation SMS 15 minutes later. Acknowledgment says "I'm on it, stop escalating."
- **Implementation:** acknowledge_incident() sets status='acknowledged', _should_escalate() checks status before escalating.
- **Does NOT resolve incident:** Acknowledgment stops escalation but incident stays tracked until check passes.

**5. SMS rate limit of 10/hour**
- **Rationale:** During major outage, multiple checks fail simultaneously. Without rate limiting, could send 50+ SMS in first hour (high cost, SMS fatigue).
- **Implementation:** _can_send_sms() tracks count per hour, resets hourly. When limit reached, emails still sent but SMS suppressed.
- **Trade-off:** Some critical alerts might not get SMS during massive outage, but cost protection is essential.

**6. Global alert manager instance in scheduler**
- **Rationale:** AlertManager holds state (deduplication tracking, SMS rate limiting). Single instance across all jobs ensures consistent behavior.
- **Implementation:** get_or_create_alert_manager() creates singleton, all scheduler jobs call it.
- **Alternative considered:** Create AlertManager per job - rejected because would lose deduplication and rate limiting state.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation proceeded smoothly. Twilio and Resend imports are optional (graceful degradation), so missing packages don't crash monitoring service.

## User Setup Required

**Environment variables for alert delivery:**

```bash
# Alert recipients
MONITOR_ALERT_PHONE_NUMBERS='+61412345678,+61498765432'  # Comma-separated E.164 format
MONITOR_ALERT_EMAIL_ADDRESSES='ops@thunderbird.bot,andrew@thunderbird.bot'  # Comma-separated

# Alert thresholds (optional, defaults shown)
MONITOR_CONSECUTIVE_FAILURES_BEFORE_ALERT=2
MONITOR_SMS_RATE_LIMIT_PER_HOUR=10

# Credentials (already in .env from main app)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
RESEND_API_KEY=...
```

**Python packages required:**

```bash
pip install twilio resend
```

**Testing alert delivery:**

To test without waiting for real failures, temporarily modify a check to fail:

```python
# In backend/monitoring/checks.py, modify check_backend_health():
def check_backend_health():
    return CheckResult(
        check_name="health_check",
        status="fail",  # Force failure
        duration_ms=0,
        error_message="TEST ALERT - Backend health check forced failure"
    )
```

Run monitoring service and watch for SMS/email within 2-5 minutes (after 2 consecutive failures).

**Acknowledging incidents:**

Via monitoring API (to be exposed in Plan 4 dashboard):

```bash
curl -X POST http://localhost:8001/api/incidents/{incident_id}/acknowledge
```

Or directly via Python:

```python
from monitoring.storage import acknowledge_incident
acknowledge_incident('incident-uuid-here')
```

## Next Phase Readiness

**Ready for next plans:**

- **09-03 (Synthetic tests):** Alerting pipeline already integrated with synthetic check jobs. When synthetic tests fail (beta signup, checkout, login, SMS webhook), alerts fire automatically.
- **09-04 (Dashboard):** AlertManager exposes acknowledge_incident() method. Dashboard can add "Acknowledge" button to call this API.

**No blockers.**

**Concerns:**

- **SMS cost monitoring:** Each SMS costs ~$0.055 AUD. With rate limit of 10/hour, max cost is $0.55/hour = $13/day during sustained outage. Should monitor Twilio usage and adjust rate limit if needed.
- **Alert recipients not configured:** Without MONITOR_ALERT_PHONE_NUMBERS and MONITOR_ALERT_EMAIL_ADDRESSES, alerts log but don't deliver. This is intentional (graceful degradation), but users must configure recipients to receive alerts.
- **Twilio/Resend packages optional:** If twilio or resend packages not installed, channels log warnings but monitoring service continues running. Install packages for full functionality.

## Alert Flow Examples

**Example 1: Critical check failure (health_check)**

1. Health check fails (backend unreachable)
2. Metric stored, consecutive failures = 1
3. Next check (1 minute later): still failing, consecutive failures = 2
4. AlertManager triggers:
   - Creates incident (severity=critical)
   - SMS sent to all MONITOR_ALERT_PHONE_NUMBERS (if rate limit allows)
   - Email sent to all MONITOR_ALERT_EMAIL_ADDRESSES
   - Updates _last_alert_time[health_check]
5. Subsequent checks: alert suppressed for 15 minutes (deduplication)
6. After 15 minutes: if still failing, alerts sent again
7. When health check passes: recovery SMS + email sent, incident resolved

**Example 2: Warning check with escalation (weather_api)**

1. Weather API check fails twice → consecutive failures = 2
2. AlertManager triggers:
   - Creates incident (severity=warning)
   - Email sent (no SMS yet)
   - Updates _last_alert_time[weather_api]
3. Check continues failing for 10 minutes: no additional alerts (deduplication)
4. After 15 minutes total: _should_escalate() returns True (incident active > 15min, not acknowledged)
5. AlertManager escalates:
   - SMS sent to all phone numbers (if rate limit allows)
   - Email sent again as reminder
6. Responder acknowledges incident: acknowledge_incident(incident_id)
7. Further checks: no more escalation (acknowledged status prevents it)
8. When weather API check passes: recovery email sent, incident resolved

**Example 3: Acknowledgment prevents escalation**

1. Warning check fails, email sent
2. Responder sees email, starts investigating
3. Responder acknowledges: acknowledge_incident(incident_id)
4. 15 minutes later: check still failing
5. AlertManager checks _should_escalate():
   - Incident active > 15 min: Yes
   - Incident acknowledged: Yes → escalation suppressed
6. No SMS sent, responder continues investigation without interruption
7. When check passes: recovery email sent

---
*Phase: 09-monitoring-alerting*
*Completed: 2026-02-04*
