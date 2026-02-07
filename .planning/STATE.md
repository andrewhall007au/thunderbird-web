# Project State: Thunderbird Global

**Last updated:** 2026-02-07
**Current milestone:** v1.1 Trail Data & UX Polish

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-02-04)

**Core value:** Hikers anywhere in the world can create a custom route and receive accurate, location-specific weather forecasts via SMS — even in areas with no cell coverage.

## Current Position

Phase: 10 of 10+ (Real Trail Data from OpenStreetMap)
Plan: 2 of 7
Status: In progress
Last activity: 2026-02-07 - Completed 10-02-PLAN.md (Country-grouped trail selector)

Progress: ██░░░░░░░░░░ 14% (1/7 plans complete in Phase 10)

### Roadmap Evolution
- Phase 10 added: Replace simplified trail data with real GPX-quality data from OpenStreetMap. Expand to ~200 trails (100 US, 25 Canada, 100 global). Add country codes to UI.

---

## v1.0 Milestone Summary

**Delivered:** Complete global SMS weather platform with e-commerce, route builder, affiliate program, and production monitoring across 8 countries

**Phases completed:** 1-9 (44 plans, ~180 tasks, 28 days)

**Key accomplishments:**
- E-commerce platform with Stripe, dynamic pricing, discount codes, SMS top-ups
- Interactive route builder with GPX upload, map editor, route library
- Dual conversion paths with phone simulator and analytics
- Affiliate program with trailing commissions
- International weather coverage (8 countries)
- Production monitoring with health checks, alerting, synthetic tests, dashboard

**Archives:**
- Roadmap: `.planning/milestones/v1.0-ROADMAP.md`
- Requirements: `.planning/milestones/v1.0-REQUIREMENTS.md`
- Audit: `.planning/milestones/v1-MILESTONE-AUDIT.md`

---

## What's Next

### Immediate Actions

1. **Deploy monitoring to production** - Run systemd setup script, configure alert numbers
2. **Production testing** - Run E2E tests, verify monitoring alerts working
3. **Define v1.1 milestone** - Use `/gsd:new-milestone` for next phase of work

### Pending Items

**Pending Beta Application:**
- Application ID 2: Andrew Hall (andrew_hall_home@icloud.com) - needs approval via `/admin/beta`

**E2E SMS Testing:**
- Purchase Twilio test numbers: US ($1.15/mo) + CA ($1.30/mo)
- Run: `python -m tests.e2e_sms.runner --all`
- Optional field test for satellite SMS validation

**Balance Enforcement Decision:**
- Beta users: Light warning only (current behavior ✓)
- Paid users: Hard stop if zero balance (implement when launching paid)
- Future: Pay-by-SMS option for paid users

### Current Beta Status

| ID | Email | Status | Balance |
|----|-------|--------|---------|
| 2 | andrew_hall_home@icloud.com | pending | - |
| 3 | hello@getseen.bot | approved | $50.00 |

**Total SMS Credit Liability:** $100.00 (RRP) / $55.00 (Cost)

---

## Outstanding Technical Debt

1. **International weather activation** - Infrastructure built, not yet activated for SMS users (intentional)
2. **Monitoring dashboard auth** - Currently internal tool only, accessible via direct URL
3. **Backend spec alignment** - User noted backend may have "old onboarding system" that doesn't match spec (investigate)

---

## Phase 10 Accumulated Decisions

### UI/UX Decisions
| Decision | Rationale | Phase-Plan | Date |
|----------|-----------|------------|------|
| Country sorting by display name, not code | "Australia" before "United States" is more intuitive than "AU" before "US" | 10-02 | 2026-02-07 |
| Show all 11 weather API countries regardless of trail data | Sets expectation that these markets are supported; "Coming Soon" indicates work in progress | 10-02 | 2026-02-07 |
| Hide empty country groups during search | When searching, "Coming Soon" for every country clutters results; user wants matching trails, not reminders of what's missing | 10-02 | 2026-02-07 |

### Technical Patterns
- **Country grouping with sticky headers:** Use sticky positioning for country headers within scrollable containers for large datasets (10-02)
- **useMemo for expensive operations:** Filter/group operations on large datasets should use useMemo to avoid re-computation on every render (10-02)
- **COUNTRY_NAMES constant:** Define all weather API countries in one place for consistency across components (10-02)

---

## Key Files Reference

**Planning:**
- `.planning/PROJECT.md` - What this is, core value, requirements
- `.planning/MILESTONES.md` - Milestone history
- `.planning/milestones/v1.0-ROADMAP.md` - v1.0 archive
- `.planning/STATE.md` - This file

**Monitoring (Phase 9):**
- `backend/monitoring/` - Monitoring service package
- `backend/monitoring/main.py` - FastAPI monitoring app (port 8001)
- `backend/monitoring/deploy/setup_monitoring.sh` - Production deployment script
- `app/monitoring/page.tsx` - Status dashboard

**Deployment:**
- `backend/deploy/nginx_complete.conf` - Security headers configuration
- `backend/deploy/apply_nginx_security.sh` - Nginx security setup
- `backend/monitoring/deploy/monitoring.service` - Systemd service file

---

## Session Continuity

Last session: 2026-02-07 08:41:31 UTC
Stopped at: Completed 10-02-PLAN.md
Resume file: None

---

*State updated: 2026-02-07*
