# Project State: Thunderbird Global

**Last updated:** 2026-02-04
**Current phase:** Phase 9 In Progress - Monitoring & Alerting

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-01-19)

**Core value:** Hikers anywhere in the world can create a custom route and receive accurate, location-specific weather forecasts via SMS — even in areas with no cell coverage.

## Current Position

Phase: 9 of 9 (Monitoring & Alerting) - IN PROGRESS
Plan: 1 of 4 completed (09-01-PLAN.md)
Status: Monitoring service foundation built
Last activity: 2026-02-04 - Completed 09-01-PLAN.md (Monitoring Service Foundation)

Progress: ██░░░░░░░░░ 18% (Phase 9 Plan 1 complete: Monitoring service with health checks, metrics DB, scheduler)

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
# Monitoring Service Foundation (09-01)
backend/monitoring/__init__.py         # Package initialization
backend/monitoring/config.py           # MonitoringSettings with Pydantic
backend/monitoring/storage.py          # SQLite metrics database with WAL mode
backend/monitoring/checks.py           # Health check implementations
backend/monitoring/scheduler.py        # APScheduler configuration
backend/monitoring/main.py             # FastAPI monitoring app on port 8001
```

---
*State updated: 2026-02-04*
