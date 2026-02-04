# Project State: Thunderbird Global

**Last updated:** 2026-02-04
**Current phase:** Phase 9 In Progress - Monitoring & Alerting

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-01-19)

**Core value:** Hikers anywhere in the world can create a custom route and receive accurate, location-specific weather forecasts via SMS — even in areas with no cell coverage.

## Current Position

Phase: 9 of 9 (Monitoring & Alerting) - IN PROGRESS
Plan: 5 of 6 completed (09-05-PLAN.md)
Status: Complete monitoring system with self-monitoring, automated reports, and production deployment ready
Last activity: 2026-02-04 - Completed 09-05-PLAN.md (Self-Monitoring & Production Deployment)

Progress: ████████████ 83% (Phase 9 Plan 5 complete: Monitoring operational with self-checks, daily/weekly/monthly reports, production-ready)

---

## Phase 9 In Progress: Monitoring & Alerting (2026-02-04)

### Plan 1: Monitoring Service Foundation (COMPLETE)

**Summary:** Standalone monitoring service with SQLite metrics DB, health checks for all critical systems including DB query performance and external API latency, APScheduler running checks every 1-10 minutes.

**Commits:**
- `ba51b02` - Monitoring config, metrics storage, CheckResult types
- `af32b33` - Health checks, database/API monitoring, scheduler

**Key Accomplishments:**
- SQLite metrics database with WAL mode for concurrent access
- Health checks: backend, frontend, beta signup, API response time, weather API
- Database query performance tracking (separate from connectivity)
- External API latency monitoring (Stripe, Twilio, Open-Meteo)
- APScheduler with interval-based jobs (1min health, 5min DB, 10min external APIs)
- FastAPI monitoring app on port 8001 with metrics API
- Incident tracking with acknowledgment capability

**Key Decisions:**
1. **SQLite with WAL mode for metrics** - Simpler than PostgreSQL, adequate for monitoring data
2. **Separate monitoring service on port 8001** - Isolation from main app, survives main app crashes
3. **Database query performance separate from connectivity** - Detects slow queries (>500ms threshold)
4. **External API latency tracking** - Monitors Stripe, Twilio, Open-Meteo availability and speed
5. **Pydantic config with extra='ignore'** - Coexists with main app .env without validation errors

**Next:** Plan 2 (Alerting) will add SMS/email alerts based on consecutive failures and incident tracking.

### Plan 2: Alert Manager (COMPLETE)

**Summary:** Alert manager with SMS/email channels, deduplication, escalation, acknowledgment, and scheduler wiring - transforms check failures into actionable notifications.

**Commits:**
- `9e65f93` - SMS and email alert channels (Twilio, Resend)
- `792fc35` - Alert manager with deduplication, escalation, scheduler integration

**Key Accomplishments:**
- TwilioSMSChannel and ResendEmailChannel for alert delivery
- AlertManager with deduplication (15-min window), consecutive failure requirement (2 failures)
- Severity-based routing: critical → SMS+email, warning → email with 15-min escalation
- Incident acknowledgment to stop escalation spam
- SMS rate limiting (10/hour) prevents cost explosion
- Recovery notifications when checks pass (SMS for critical, email for all)
- Scheduler integration: all check jobs use unified evaluate_and_alert pipeline

**Key Decisions:**
1. **Require 2 consecutive failures before alerting** - Reduces false positives from transient issues
2. **15-minute deduplication window** - Prevents alert spam for persistent issues
3. **Critical vs warning severity with escalation** - User-facing flows (beta, checkout) critical, supporting services warnings
4. **Incident acknowledgment stops escalation** - Responders can acknowledge to prevent SMS escalation
5. **SMS rate limit of 10/hour** - Cost protection during major outages
6. **Global alert manager instance** - Single instance maintains deduplication and rate limiting state

**Next:** Plan 3 (Synthetic tests) will add browser-based Playwright tests for critical user flows.

### Plan 3: Synthetic Test Runner (COMPLETE)

**Summary:** Playwright E2E tests as synthetic monitors with login and SMS webhook checks running on schedule against production.

**Commits:**
- `14ccfed` - Playwright monitoring config and synthetic test runner with login/SMS webhook checks
- `792fc35` - Scheduler integration (completed as part of alert manager plan 09-02)

**Key Accomplishments:**
- Playwright synthetic test runner executes existing E2E tests against production via subprocess
- HTTP-based login synthetic check tests authentication endpoint every 10 minutes
- HTTP-based SMS webhook synthetic check tests inbound SMS pipeline daily
- Browser synthetic tests (beta signup, checkout, create-first) run every 5-15 minutes when Playwright available
- All synthetic checks integrated with alert manager for failure detection and escalation

**Key Decisions:**
1. **Separate Playwright config for monitoring** - Production URL, 120s timeouts, JSON reporter, no retries
2. **Parse Playwright JSON output from /tmp file** - More robust than stdout for large test results
3. **Conditional Playwright browser tests** - Only run if npx available, HTTP checks always run
4. **HTTP-based synthetic checks for login/webhook** - Direct API testing faster than browser automation
5. **SMS webhook runs daily, login every 10 minutes** - Daily check for core SMS pipeline, frequent auth checks

**Next:** Plan 4 (Dashboard) will visualize synthetic test results alongside other health metrics.

### Plan 5: Self-Monitoring & Production Deployment (COMPLETE)

**Summary:** Self-monitoring heartbeat with daily/weekly/monthly reports, systemd service with auto-restart, and one-script production deployment.

**Commits:**
- `bad59b5` - Self-monitoring, reporting, requirements (heartbeat, daily/weekly/monthly reports)
- `bb80719` - Production deployment config (systemd service, setup script)

**Key Accomplishments:**
- Self-monitoring heartbeat runs every 5 minutes, alerts if no checks for 10+ minutes
- Daily health reports sent at 8 AM UTC with previous day's stats and incidents
- Weekly reports sent every Monday at 8 AM UTC with trends and worst performer
- Monthly reports sent on 1st of month at 8 AM UTC with SLA compliance (99.9% target)
- Systemd service file with auto-restart on crash (10s delay)
- Automated deployment script handles full setup from scratch
- Metrics and logs cleanup runs nightly at 3 AM UTC (90-day retention)
- Scheduler expanded to 18 jobs total

**Key Decisions:**
1. **Self-monitoring every 5 minutes with 10-minute staleness threshold** - Balance between detection speed and false positives
2. **Reports at 8 AM UTC for consistency** - Daily, weekly (Monday), monthly (1st) - predictable schedule
3. **Monthly reports include 99.9% SLA compliance tracking** - Accountability and performance visibility
4. **Meta-monitoring alerts bypass deduplication** - Self-monitoring failures need immediate escalation
5. **Systemd auto-restart with 10-second delay** - Resilience without thrashing on persistent failures
6. **Cleanup at 3 AM UTC with 90-day retention** - Off-peak hours, adequate history
7. **HTML email reports with status badges and trend arrows** - Professional, easy to scan
8. **Setup script creates environment template** - Guides production config without exposing secrets

**Next:** Phase 9 complete. All monitoring infrastructure operational and production-ready.

### Plan 6: Error Log Aggregation (COMPLETE)

**Summary:** Centralized error log storage with search, rate tracking, pattern detection, and API endpoints for dashboard integration.

**Commits:**
- `efa3de0` - Log storage, collector, and analyzer (MonitoringLogHandler, systemd journalctl, pattern detection)
- `4538745` - API endpoints and scheduler jobs (log collection every 2min, error rate check every 5min)

**Key Accomplishments:**
- SQLite storage for error logs with full-text search and filtering by level/source/time
- Error pattern detection with message normalization (UUIDs, numbers, strings replaced with placeholders)
- Error rate tracking with threshold-based alerting (<1 errors/min = pass, 1-5 = degraded, >5 = fail)
- Log collection via Python logging handler and systemd journalctl
- API endpoints: GET /logs, /logs/rate, /logs/patterns, PATCH /logs/patterns/{id}
- Scheduler jobs: log collection (2min), error rate check (5min), pattern detection (30min)

**Key Decisions:**
1. **Store logs in same SQLite database as metrics** - Simplicity, shared connection pool
2. **Normalize error messages with regex substitution** - Group similar errors by replacing variable data
3. **Support systemd journalctl and log file scraping** - Flexibility for dev/prod environments
4. **Error rate thresholds: <1/1-5/>5 errors per minute** - Based on expected normal error rates
5. **Pattern status lifecycle: new -> known/resolved/ignored** - Manual triage to reduce alert fatigue

**Next:** Phase 9 complete. Monitoring & alerting infrastructure operational.

### Plan 4: Status Dashboard (COMPLETE)

**Summary:** Next.js dashboard at /monitoring with real-time health monitoring, incident acknowledgment to stop escalation, and expandable event timelines showing failure progression.

**Commits:**
- `8ae7e53` - Dashboard API with 7 endpoints (status, uptime, metrics, incidents, acknowledge, timeline, summary)
- `9e65f93` - Next.js dashboard with StatusCard, UptimeChart, IncidentLog components

**Key Accomplishments:**
- Dashboard API mounted in both monitoring service and main backend for unified access
- Real-time status dashboard with 30-second auto-refresh
- Color-coded uptime bars with percentage thresholds (>99.5% green, >99% amber, <99% red)
- Incident acknowledgment workflow stops alert escalation
- Expandable incident timelines show chronological event progression
- Responsive grid layout for mobile/tablet/desktop viewing

**Key Decisions:**
1. **Mount API in both services** - Dashboard accesses via proxy, standalone service remains functional
2. **Display name mapping** - Human-readable check names ("Backend Health" vs "health_check")
3. **On-demand timeline fetching** - Reduces initial page load, fetches only when expanded
4. **Simple CSS-based bars** - No chart library needed for v1, lighter weight
5. **Internal dashboard** - Not linked in public nav, accessible via direct URL only

**Next:** Phase 9 complete. Monitoring & alerting infrastructure operational.

---

## Phase 8 Completion: Security Hardening (2026-02-03)

### Security Improvements Deployed

**1. CORS Whitelisting**
- Restricted to `thunderbird.bot`, `www.thunderbird.bot`, `localhost:3000` only
- Removed wildcard (`*`) that allowed any domain
- File: `backend/app/main.py`

**2. XSS Protection**
- HTML escaping on beta application name field
- Prevents script injection in admin console
- File: `backend/app/routers/beta.py`

**3. Rate Limiting Middleware**
- Auth endpoints: 1 request/minute
- Beta applications: 5 requests/hour
- API endpoints: 10 requests/second
- File: `backend/app/middleware/rate_limit.py`

**4. Nginx Security Headers**
- HSTS (force HTTPS)
- X-Frame-Options (prevent clickjacking)
- X-Content-Type-Options (prevent MIME sniffing)
- Content-Security-Policy
- Server version hidden
- File: `backend/deploy/nginx_complete.conf`

**Deployment Commits:**
- `34015b3` - CORS whitelist + XSS sanitization
- `ebfe7ca` - Rate limiting middleware + nginx config
- `09d88bf`, `8e3fe77`, `986b4f3` - Nginx config fixes

**Documentation:**
- Phase 8 overview: `.planning/phases/08-security-hardening/08-OVERVIEW.md`
- Updated ROADMAP.md and CHANGELOG.md
- Deployment scripts in `backend/deploy/`

---

## Latest Session: Admin & Beta Management (2026-02-02)

### Admin Dashboard Overhaul

**1. Alert Badges for Pending Actions**
- Flashing red `!` badge on "Beta Applications" when pending approvals exist
- Flashing red `!` badge on "Affiliates" when pending payouts exist
- Fast pulse animation (0.4s) with red glow effect
- Red border highlight on links with alerts

**2. Financials Section (Replaced Quick Actions)**
Removed obsolete Quick Actions (push-based system) and added:
- **Total Revenue**: Sum of completed Stripe orders
- **Beta Credits Given**: Total credits issued to beta testers
- **SMS Credit Liability (RRP)**: Outstanding balance users could spend
- **SMS Credit Liability (Cost)**: Our actual cost (~55% of RRP)

**3. Beta User Activity Tracking**
New `/admin/beta/{account_id}/activity` page showing:
- User info (email, phone, account ID)
- Stats: commands sent, responses, GPS points polled, SMS cost
- **GPS Coordinates Table**: Every GPS point polled with timestamp
- **Full Message Log**: All inbound/outbound SMS with timestamps

**Files Modified:**
- `backend/app/services/admin.py` - Alert badges, financials, activity page renderer
- `backend/app/routers/admin.py` - Activity page route
- `backend/app/models/database.py` - `get_user_message_stats()`, `get_user_messages()`

### Previous: Welcome Email & Proxy Setup

**Welcome Email Revamp** (`app/email/welcome/page.tsx`):
- Real phone numbers: US `+1 (866) 280-1940`, AU `+61 468 092 783`
- Two forecast methods: GPS coordinates + Pre-loaded routes
- Realistic SMS format with legend
- Security: removed password, changed "Email" to "Username"

**Admin/API Proxy** (`next.config.js`):
- `/admin/*` and `/api/*` proxy to backend port 8000
- Fixes 404 errors on admin links in emails

---

## Outstanding / Not Yet Built

### 1. Balance Enforcement (Decision Made - Implement Later)
**Decision:**
- **Beta users:** Light warning only (current behavior ✓)
- **Paid users:** Hard stop if zero balance (implement when launching paid)
- **Future:** Pay-by-SMS option for paid users to top up via text

Current implementation is correct for beta. Hard stop + SMS top-up to be built for paid launch.
- File: `backend/app/routers/webhook.py` lines 117-131

### 2. Pending Beta Application
**Application ID 2:**
- Name: Andrew Hall
- Email: andrew_hall_home@icloud.com
- Status: pending
- Action: Approve via `/admin/beta` to create account with $50 credits

### 3. E2E SMS Testing Infrastructure
Built but not yet executed:
- Purchase Twilio test numbers: US ($1.15/mo) + CA ($1.30/mo)
- Run: `python -m tests.e2e_sms.runner --all`
- Optional: Field test for satellite SMS validation
- Docs: `backend/tests/e2e_sms/README.md`, `docs/SATELLITE_FIELD_TEST_PROTOCOL.md`

### 4. Backend Spec Alignment (Investigate)
User noted backend may have "old onboarding system" that doesn't match current spec.
**Action:** Review and update if needed.

---

## Current Beta Status

| ID | Email | Status | Balance |
|----|-------|--------|---------|
| 2 | andrew_hall_home@icloud.com | pending | - |
| 3 | hello@getseen.bot | approved | $50.00 |

**Total SMS Credit Liability:** $100.00 (RRP) / $55.00 (Cost)

---

## What's Next?

### Immediate
1. **Decide on balance enforcement** - Block zero-balance users?
2. **Approve pending beta application** - ID 2 via admin interface
3. **E2E SMS testing** - Purchase test numbers, run automated tests

### Pre-Launch
4. **Final walkthrough** - Test all user flows end-to-end
5. **Field test** - Satellite SMS validation (optional but recommended)

### Future Enhancements
6. Apply for AfriGIS SA pilot (60-day trial, 4.4km resolution)
7. Evaluate MetService NZ ($75/mo for 4km)
8. JWA Japan 1km ($210/mo)

---

## Key Files (This Session)

```
# Alert Manager (09-02)
backend/monitoring/alerts/__init__.py     # Alerts package initialization
backend/monitoring/alerts/channels.py     # TwilioSMSChannel and ResendEmailChannel
backend/monitoring/alerts/manager.py      # AlertManager with deduplication, escalation, acknowledgment
backend/monitoring/scheduler.py           # Updated with alert manager integration
```

---
*State updated: 2026-02-04*
