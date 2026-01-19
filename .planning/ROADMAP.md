# Roadmap: Thunderbird Global v1

**Created:** 2026-01-19
**Target:** 100 paying users within 3 months of launch
**Phases:** 6

## Overview

```
Phase 1: Foundation ──────────────────────┐
                                          │
              ┌───────────────────────────┼───────────────────────────┐
              │                           │                           │
              v                           v                           │
Phase 2: Payments            Phase 3: Route Creation                  │
              │                           │                           │
              └───────────────┬───────────┘                           │
                              │                                       │
                              v                                       │
                    Phase 4: User Flows                               │
                              │                                       │
                              v                                       │
                    Phase 5: Affiliates                               │
                              │                                       │
                              v                                       v
                    Phase 6: International Weather ───────────────────┘
```

**Critical path:** Foundation -> Payments -> User Flows (minimum viable purchase)
**Parallel track:** Foundation -> Route Creation -> User Flows (route value)
**Independent:** International Weather (can progress alongside Phases 4-5)

---

## Phase 1: Foundation

**Status:** Complete (2026-01-19)

**Goal:** Modular codebase with account system enabling all future phases

**Requirements covered:** FOUN-01 through FOUN-05

**Plans:** 4 plans (4/4 complete)

Plans:
- [x] 01-01-PLAN.md - Refactor main.py into APIRouter modules and create service stubs (completed 2026-01-19)
- [x] 01-02-PLAN.md - Set up Alembic migrations with SQLite batch mode (completed 2026-01-19)
- [x] 01-03-PLAN.md - Implement account registration, login, and JWT sessions (completed 2026-01-19)
- [x] 01-04-PLAN.md - Add phone number linking and auth tests (completed 2026-01-19)

### Deliverables

- [x] Refactor `main.py` (1685 lines) into service modules
- [x] Set up Alembic database migrations
- [x] Create account system (email/password)
- [x] Session persistence with JWT
- [x] Phone number linking to accounts

### Key Files

- `backend/main.py` -> split into services/
- `backend/services/payments.py` (stub)
- `backend/services/route_builder.py` (stub)
- `backend/services/affiliates.py` (stub)
- `backend/services/weather_intl.py` (stub)
- `backend/models/account.py`
- `alembic/` migration directory

### Success Criteria

- All existing tests pass after refactor
- New user can register and login
- Session persists across page refresh
- Migration system creates tables from scratch

### Dependencies

- None (foundation phase)

### Risks

- Refactoring may break existing SMS functionality
- Mitigation: comprehensive test coverage before refactor

---

## Phase 2: Payments

**Status:** Complete (2026-01-19)

**Goal:** Users can purchase access and manage balance

**Requirements covered:** PAY-01 through PAY-12

**Plans:** 6 plans in 4 waves (6/6 complete)

Plans:
- [x] 02-01-PLAN.md - Payment database models and country SMS pricing (Wave 1) (completed 2026-01-19)
- [x] 02-02-PLAN.md - Dynamic pricing service, balance tracking, and Stripe checkout (Wave 2) (completed 2026-01-19)
- [x] 02-03-PLAN.md - Payment API router and Stripe webhook handler (Wave 2) (completed 2026-01-19)
- [x] 02-04-PLAN.md - Order confirmation email service (Wave 3) (completed 2026-01-19)
- [x] 02-05-PLAN.md - Stored card top-ups and SMS BUY command (Wave 3) (completed 2026-01-19)
- [x] 02-06-PLAN.md - SMS cost verification against Twilio (Wave 4) (completed 2026-01-19)

### Wave Structure

| Wave | Plans | Description |
|------|-------|-------------|
| 1 | 02-01 | Database foundation: models, migrations, SMS pricing config |
| 2 | 02-02, 02-03 | Core payment flow: pricing, balance, checkout, webhooks |
| 3 | 02-04, 02-05 | Enhancement: email, stored cards, SMS commands |
| 4 | 02-06 | Verification: cost reconciliation with Twilio |

### Deliverables

- [x] Stripe Checkout integration ($29.99 purchase)
- [x] Dynamic pricing system (RRP $49.99, configurable launch/sale prices)
- [x] Discount code support with stacking
- [x] Order confirmation email with SMS number
- [x] User balance tracking
- [x] Stored card for one-click top-ups
- [x] SMS-based top-up ("BUY $10" command)
- [x] Low balance warning at $2
- [x] Country-specific SMS cost tables (8 countries)
- [x] Variable segments per $10 (80% margin)
- [x] Cost verification against Twilio actuals

### Key Files

- `backend/app/services/payments.py`
- `backend/app/services/balance.py`
- `backend/app/services/pricing_dynamic.py`
- `backend/app/services/email.py`
- `backend/app/services/cost_verification.py`
- `backend/app/models/payments.py`
- `backend/app/routers/payments.py`
- `backend/config/sms_pricing.py`

### Database Tables

```sql
orders (id, account_id, order_type, amount_cents, stripe_session_id, status, created_at)
account_balances (id, account_id, balance_cents, updated_at)
transactions (id, account_id, order_id, transaction_type, amount_cents, balance_after_cents, description, created_at)
discount_codes (id, code, discount_type, discount_value, max_uses, current_uses, active, stripe_coupon_id, created_at)
```

### Success Criteria

- User can complete $29.99 purchase via Stripe Checkout
- Discount codes apply correctly (stacking works with launch price)
- Balance updates after purchase and usage
- SMS top-up works with stored card
- Low balance warning sends at $2
- 80% margin maintained across all 8 countries

### Dependencies

- Phase 1 (account system, service structure)

### Risks

- Stripe webhook reliability
- Mitigation: idempotent webhook handlers, signature verification
- Twilio rate changes
- Mitigation: cost verification service with alerts

---

## Phase 3: Route Creation

**Status:** Complete (2026-01-19)

**Goal:** Users can create custom routes via GPX upload and map editing

**Requirements covered:** ROUT-01 through ROUT-12

**Plans:** 7 plans in 5 waves (7/7 complete)

Plans:
- [x] 03-01-PLAN.md - Database models and migration for routes, waypoints, library (Wave 1) (completed 2026-01-19)
- [x] 03-02-PLAN.md - Backend route builder service with GPX parsing and API (Wave 2) (completed 2026-01-19)
- [x] 03-03-PLAN.md - Frontend map infrastructure with GPX upload (Wave 2) (completed 2026-01-19)
- [x] 03-04-PLAN.md - Waypoint creation, editing, and management (Wave 3) (completed 2026-01-19)
- [x] 03-05-PLAN.md - Save/load draft routes with backend integration (Wave 4) (completed 2026-01-19)
- [x] 03-06-PLAN.md - Route library with admin import and clone functionality (Wave 4) (completed 2026-01-19)
- [x] 03-07-PLAN.md - Backend tests and full verification (Wave 5) (completed 2026-01-19)

### Wave Structure

| Wave | Plans | Description |
|------|-------|-------------|
| 1 | 03-01 | Database foundation: models, migrations, gpxpy dependency |
| 2 | 03-02, 03-03 | Backend API + Frontend map: GPX parsing, MapLibre setup |
| 3 | 03-04 | Waypoint editing: click-to-add, drag, delete, types, SMS codes |
| 4 | 03-05, 03-06 | Persistence: save/load routes, library browse and clone |
| 5 | 03-07 | Verification: tests and human UI verification |

### Deliverables

- [x] GPX file upload with parsing
- [x] MapLibre GL JS map display
- [x] Waypoint pin placement (click-to-add)
- [x] Three pin types: camps, peaks, POIs (color-coded)
- [x] Waypoint naming with SMS code generation
- [x] Drag-to-reposition waypoints
- [x] Delete waypoints
- [x] Save draft routes to account
- [x] Route library (admin-uploaded popular trails)
- [x] Clone and customize library routes
- [x] Mobile-responsive map with touch controls

### Key Files

- `backend/app/services/route_builder.py`
- `backend/app/services/route_library.py`
- `backend/app/models/custom_route.py`
- `backend/app/routers/routes.py`
- `backend/app/routers/library.py`
- `app/create/page.tsx`
- `app/components/map/MapEditor.tsx`
- `app/components/upload/GPXUpload.tsx`
- `app/components/waypoint/WaypointEditor.tsx`
- `app/library/page.tsx`
- `app/routes/page.tsx`

### Database Tables

```sql
custom_routes (id, account_id, name, gpx_data, status, is_library_clone, source_library_id, created_at, updated_at)
custom_waypoints (id, route_id, type, name, sms_code, lat, lng, elevation, order_index, created_at)
route_library (id, name, description, gpx_data, country, region, difficulty_grade, distance_km, typical_days, is_active, created_at, updated_at)
```

### Success Criteria

- GPX uploads parse and display correctly
- User can add/edit/delete waypoints
- SMS codes auto-generate from names (unique across system)
- Draft routes save and load
- Library routes clone correctly
- Map works on mobile with cooperative gestures

### Dependencies

- Phase 1 (account system for draft saving)

### Risks

- GPX format variations
- Mitigation: support common variants, graceful error handling
- MapLibre SSR issues
- Mitigation: dynamic import with ssr: false

---

## Phase 4: User Flows

**Goal:** Two purchase paths with phone simulator driving conversion

**Requirements covered:** FLOW-01 through FLOW-06, CONT-01 through CONT-03

### Deliverables

- [ ] Phone simulator showing example SMS forecast
- [ ] "Create first" path: create route -> see simulator -> pay to activate
- [ ] "Buy now" path: fast checkout -> create route after
- [ ] Analytics tracking conversion by path (A/B)
- [ ] Paywall after simulator
- [ ] Entry path tracking through purchase
- [ ] Landing page with Garmin/Zoleo comparison
- [ ] Carrier/device compatibility page
- [ ] SMS value proposition messaging

### Key Files

- `frontend/components/PhoneSimulator.tsx`
- `frontend/app/create/flow.tsx`
- `frontend/app/buy/page.tsx`
- `frontend/app/page.tsx` (landing)
- `frontend/app/compatibility/page.tsx`
- `backend/services/analytics.py`

### Success Criteria

- Phone simulator renders realistic SMS preview
- Both purchase paths complete successfully
- Analytics captures entry path and conversion
- Landing page communicates value vs competitors
- Compatibility page answers satellite SMS questions

### Dependencies

- Phase 2 (payment integration)
- Phase 3 (route creation for simulator)

### Risks

- Simulator accuracy to actual SMS
- Mitigation: use real formatting logic from existing codebase

---

## Phase 5: Affiliates

**Goal:** Affiliate program with trailing commissions driving growth

**Requirements covered:** AFFL-01 through AFFL-07

### Deliverables

- [ ] Admin console for affiliate creation
- [ ] Per-affiliate configuration (discount %, commission %, duration)
- [ ] Affiliate codes as discount codes
- [ ] Commission on actual paid price
- [ ] Trailing commission tracking on top-ups
- [ ] Affiliate performance analytics
- [ ] Payout tracking (pending vs paid)

### Key Files

- `backend/services/affiliates.py`
- `backend/models/affiliate.py`
- `backend/models/affiliate_commission.py`
- `frontend/app/admin/affiliates/`
- `backend/admin/affiliate_routes.py`

### Database Tables

```sql
affiliates (id, name, email, code, discount_percent, commission_percent, trailing_months, active, created_at)
affiliate_commissions (id, affiliate_id, user_id, transaction_id, amount, type, status, created_at)
```

### Success Criteria

- Admin can create affiliates with custom terms
- Affiliate codes apply discount at checkout
- Commission calculated on post-discount amount
- Trailing commissions track for configured duration
- Analytics show clicks, conversions, revenue per affiliate

### Dependencies

- Phase 2 (payment system for commission tracking)

### Risks

- Commission stacking exploitation
- Mitigation: model worst-case economics, delayed payout, fraud detection

---

## Phase 6: International Weather

**Goal:** Weather APIs for all 8 countries with fallback handling

**Requirements covered:** WTHR-01 through WTHR-11

**Research required:** Yes - each country's API needs research before implementation

### Deliverables

- [ ] USA: NWS integration (free, no auth)
- [ ] Canada: Weather API integration
- [ ] UK: Met Office integration
- [ ] France: Meteo-France integration
- [ ] Italy: Weather API integration
- [ ] Switzerland: MeteoSwiss integration
- [ ] New Zealand: Weather API integration (may be Open-Meteo only)
- [ ] South Africa: Weather API integration
- [ ] Open-Meteo fallback for all countries
- [ ] Weather response normalization layer
- [ ] Data source display in forecasts

### Key Files

- `backend/services/weather_intl.py`
- `backend/services/weather/nws.py`
- `backend/services/weather/met_office.py`
- `backend/services/weather/meteo_france.py`
- `backend/services/weather/open_meteo.py`
- `backend/services/weather/normalizer.py`

### Success Criteria

- Each country returns accurate forecasts
- Fallback triggers when primary API fails
- All responses normalize to consistent format
- Data source shown to users
- Rate limits respected with caching

### Dependencies

- Phase 1 (service structure)
- Can run parallel with Phases 4-5

### Risks

- API availability and rate limits vary by country
- Some APIs may require paid tiers
- Resolution varies significantly
- Mitigation: research per-country, comprehensive fallback, caching

---

## Milestone Summary

| Phase | Goal | Requirements | Dependencies |
|-------|------|--------------|--------------|
| 1 | Foundation | FOUN-01 to FOUN-05 (5) | None |
| 2 | Payments | PAY-01 to PAY-12 (12) | Phase 1 |
| 3 | Route Creation | ROUT-01 to ROUT-12 (12) | Phase 1 |
| 4 | User Flows | FLOW-01 to FLOW-06, CONT-01 to CONT-03 (9) | Phases 2, 3 |
| 5 | Affiliates | AFFL-01 to AFFL-07 (7) | Phase 2 |
| 6 | International Weather | WTHR-01 to WTHR-11 (11) | Phase 1 |

**Total v1 requirements:** 53

---

## Execution Notes

### Parallelization Opportunities

- **Phases 2 & 3:** Can execute simultaneously after Phase 1
- **Phase 6:** Can progress alongside Phases 4-5 (only needs Phase 1)

### Research Flags

- **Phase 6:** Requires per-country API research before planning
- **Phases 1-5:** Standard patterns, can plan without additional research

### Critical Path to MVP

Minimum to accept first payment:
1. Phase 1: Foundation (accounts)
2. Phase 2: Payments (checkout)
3. Phase 4: User Flows (landing, basic flow)

Route creation (Phase 3) can soft-launch with admin-created routes only.

---
*Roadmap created: 2026-01-19*
*Last updated: 2026-01-19 after Phase 3 planning*
