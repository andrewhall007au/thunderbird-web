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

**Status:** Complete (2026-01-21)

**Goal:** Two purchase paths with phone simulator driving conversion

**Requirements covered:** FLOW-01 through FLOW-06, CONT-01 through CONT-03

**Plans:** 5 plans in 4 waves (5/5 complete)

Plans:
- [x] 04-01-PLAN.md - PhoneSimulator component and analytics infrastructure (Wave 1) (completed 2026-01-21)
- [x] 04-02-PLAN.md - "Create first" conversion path with preview and paywall (Wave 2) (completed 2026-01-21)
- [x] 04-03-PLAN.md - "Buy now" conversion path with Stripe checkout (Wave 2) (completed 2026-01-21)
- [x] 04-04-PLAN.md - Compatibility page and landing page enhancements (Wave 3) (completed 2026-01-21)
- [x] 04-05-PLAN.md - Analytics reporting and end-to-end verification (Wave 4) (completed 2026-01-21)

### Wave Structure

| Wave | Plans | Description |
|------|-------|-------------|
| 1 | 04-01 | Foundation: PhoneSimulator component, analytics utilities, backend storage |
| 2 | 04-02, 04-03 | Core flows: "create first" with preview/paywall, "buy now" with Stripe |
| 3 | 04-04 | Content: compatibility page, landing page SMS value messaging |
| 4 | 04-05 | Verification: analytics reporting, end-to-end testing |

### Deliverables

- [x] Phone simulator showing example SMS forecast
- [x] "Create first" path: create route -> see simulator -> pay to activate
- [x] "Buy now" path: fast checkout -> create route after
- [x] Analytics tracking conversion by path (A/B)
- [x] Paywall after simulator
- [x] Entry path tracking through purchase
- [x] Landing page with Garmin/Zoleo comparison (exists - enhance)
- [x] Carrier/device compatibility page
- [x] SMS value proposition messaging

### Key Files

- `app/components/simulator/PhoneSimulator.tsx`
- `app/lib/analytics.ts`
- `app/create/preview/page.tsx`
- `app/components/paywall/PaywallModal.tsx`
- `app/checkout/page.tsx`
- `app/checkout/success/page.tsx`
- `app/compatibility/page.tsx`
- `app/page.tsx` (landing)
- `backend/app/models/analytics.py`
- `backend/app/routers/analytics.py`
- `backend/scripts/analytics_report.py`

### Database Tables

```sql
analytics_events (id, event, variant, entry_path, properties, account_id, created_at)
```

### Success Criteria

- Phone simulator renders realistic SMS preview
- Both purchase paths complete successfully
- Analytics captures entry path and conversion
- Landing page communicates value vs competitors
- Compatibility page answers satellite SMS questions
- Entry path appears in Stripe metadata for all purchases

### Dependencies

- Phase 2 (payment integration)
- Phase 3 (route creation for simulator)

### Risks

- Simulator accuracy to actual SMS
- Mitigation: use real formatting logic from existing codebase

---

## Phase 5: Affiliates

**Status:** Complete (2026-01-21)

**Goal:** Affiliate program with trailing commissions driving growth

**Requirements covered:** AFFL-01 through AFFL-07

**Plans:** 6 plans in 5 waves (6/6 complete)

Plans:
- [x] 05-01-PLAN.md - Database models and migration for affiliates, commissions, attributions (Wave 1) (completed 2026-01-21)
- [x] 05-02-PLAN.md - Affiliate service and webhook integration for commission calculation (Wave 2) (completed 2026-01-21)
- [x] 05-03-PLAN.md - Admin console for affiliate management and checkout integration (Wave 3) (completed 2026-01-21)
- [x] 05-04-PLAN.md - Affiliate dashboard API and public landing page with click tracking (Wave 4) (completed 2026-01-21)
- [x] 05-05-PLAN.md - Payout tracking and milestone email alerts (Wave 5) (completed 2026-01-21)
- [x] 05-06-PLAN.md - Test suite and commission availability cron script (Wave 5) (completed 2026-01-21)

### Wave Structure

| Wave | Plans | Description |
|------|-------|-------------|
| 1 | 05-01 | Database foundation: affiliate, commission, attribution, click tables |
| 2 | 05-02 | Commission service: calculate on webhooks, trailing attribution, clawback |
| 3 | 05-03 | Admin console: CRUD affiliates, auto-create discount codes, checkout integration |
| 4 | 05-04 | Affiliate dashboard: stats API, landing page, click tracking |
| 5 | 05-05, 05-06 | Payouts: request/process flow, milestone emails, tests, cron script |

### Deliverables

- [x] Admin console for affiliate creation
- [x] Per-affiliate configuration (discount %, commission %, duration)
- [x] Affiliate codes as discount codes
- [x] Commission on actual paid price
- [x] Trailing commission tracking on top-ups
- [x] Affiliate performance analytics
- [x] Payout tracking (pending vs paid)

### Key Files

- `backend/app/models/affiliates.py`
- `backend/app/services/affiliates.py`
- `backend/app/routers/admin.py` (extended)
- `backend/app/routers/affiliates.py`
- `backend/app/routers/affiliate_landing.py`
- `backend/app/routers/webhook.py` (extended)
- `backend/tests/test_affiliates.py`
- `backend/scripts/commission_available.py`

### Database Tables

```sql
affiliates (id, code, name, email, discount_percent, commission_percent, trailing_months, payout_method, payout_details, active, last_milestone_cents, created_at)
commissions (id, affiliate_id, account_id, order_id, amount_cents, status, sub_id, created_at, available_at, paid_at)
affiliate_attributions (id, affiliate_id, account_id, order_id, sub_id, trailing_expires_at, created_at)
affiliate_clicks (id, affiliate_id, sub_id, session_id, created_at)
discount_codes.affiliate_id (added column)
```

### Success Criteria

- Admin can create affiliates with custom terms
- Affiliate codes apply discount at checkout
- Commission calculated on post-discount amount
- Trailing commissions track for configured duration
- Analytics show clicks, conversions, revenue per affiliate
- Payouts can be requested and processed

### Dependencies

- Phase 2 (payment system for commission tracking)

### Risks

- Commission stacking exploitation
- Mitigation: model worst-case economics, delayed payout, fraud detection

---

## Phase 6: International Weather

**Status:** Complete (2026-01-21)

**Goal:** Weather APIs for all 8 countries with fallback handling

**Requirements covered:** WTHR-01 through WTHR-11

**Plans:** 7 plans in 4 waves (7/7 complete)

Plans:
- [x] 06-01-PLAN.md - Weather provider foundation: base abstractions, Open-Meteo provider, caching (Wave 1) (completed 2026-01-21)
- [x] 06-02-PLAN.md - NWS provider for USA with alerts (Wave 2) (completed 2026-01-21)
- [x] 06-03-PLAN.md - Environment Canada provider (Wave 2) (completed 2026-01-21)
- [x] 06-04-PLAN.md - Met Office provider for UK (Wave 2) (completed 2026-01-21)
- [x] 06-05-PLAN.md - Open-Meteo country-specific models for FR/IT/CH/NZ/ZA (Wave 2) (completed 2026-01-21)
- [x] 06-06-PLAN.md - Weather router with fallback and integration to weather_intl.py (Wave 3) (completed 2026-01-21)
- [x] 06-07-PLAN.md - Tests and requirement verification (Wave 4) (completed 2026-01-21)

### Wave Structure

| Wave | Plans | Description |
|------|-------|-------------|
| 1 | 06-01 | Foundation: base abstractions, Open-Meteo universal provider, 1-hour caching |
| 2 | 06-02, 06-03, 06-04, 06-05 | Country providers: NWS (US), EC (CA), Met Office (UK), Open-Meteo models (FR/IT/CH/NZ/ZA) |
| 3 | 06-06 | Integration: router with fallback logic, wire to weather_intl.py service |
| 4 | 06-07 | Verification: comprehensive tests, WTHR-01 through WTHR-11 verification |

### Deliverables

- [x] USA: NWS integration (free, no auth)
- [x] Canada: Environment Canada integration (env-canada library)
- [x] UK: Met Office Weather DataHub integration
- [x] France: Meteo-France via Open-Meteo
- [x] Italy: DWD ICON via Open-Meteo
- [x] Switzerland: ICON-EU via Open-Meteo (MeteoSwiss endpoint doesn't exist)
- [x] New Zealand: Open-Meteo (best_match model)
- [x] South Africa: Open-Meteo (best_match model)
- [x] Open-Meteo universal fallback for all countries
- [x] Weather response normalization layer
- [x] Data source display in forecasts

### Key Files

- `backend/app/services/weather/__init__.py`
- `backend/app/services/weather/base.py`
- `backend/app/services/weather/cache.py`
- `backend/app/services/weather/router.py`
- `backend/app/services/weather/providers/openmeteo.py`
- `backend/app/services/weather/providers/nws.py`
- `backend/app/services/weather/providers/envcanada.py`
- `backend/app/services/weather/providers/metoffice.py`
- `backend/app/services/weather_intl.py` (updated)
- `backend/tests/test_weather_providers.py`
- `backend/tests/test_weather_router.py`

### Success Criteria

- Each country returns accurate forecasts
- Fallback triggers when primary API fails
- All responses normalize to consistent format
- Data source shown to users (provider name + fallback indicator)
- Rate limits respected with 1-hour caching
- Alerts fetched for supporting providers (NWS, EC)

### Dependencies

- Phase 1 (service structure)

### Risks

- API availability and rate limits vary by country
- Some APIs may require paid tiers (Met Office has 360/day free limit)
- Resolution varies significantly
- Mitigation: Open-Meteo universal fallback, 1-hour caching

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

- **Phase 6:** Research complete (see 06-RESEARCH.md)
- **Phases 1-5:** Standard patterns, can plan without additional research

### Critical Path to MVP

Minimum to accept first payment:
1. Phase 1: Foundation (accounts)
2. Phase 2: Payments (checkout)
3. Phase 4: User Flows (landing, basic flow)

Route creation (Phase 3) can soft-launch with admin-created routes only.

---

## Phase 7: Multi-Trail SMS Selection

**Status:** Planned

**Goal:** Users can select active trail via SMS START command, enabling multi-route management

**Requirements covered:** START-01 through START-08

**Plans:** 3 plans in 3 waves

Plans:
- [ ] 07-01-PLAN.md - Database migration and models for active_trail_id and session state (Wave 1)
- [ ] 07-02-PLAN.md - Trail selection state machine service with pagination (Wave 2)
- [ ] 07-03-PLAN.md - Webhook integration and comprehensive tests (Wave 3)

### Wave Structure

| Wave | Plans | Description |
|------|-------|-------------|
| 1 | 07-01 | Database: active_trail_id migration, TrailSelectionSession model |
| 2 | 07-02 | Service: state machine, pagination, message formatting |
| 3 | 07-03 | Integration: webhook routing, CAST active trail check, tests |

### Deliverables

- [ ] `active_trail_id` column on accounts table
- [ ] Trail selection session state machine
- [ ] START command handler with menu flow
- [ ] "My Trails" listing with pagination
- [ ] Trail Library listing with pagination
- [ ] Numeric input handling during session
- [ ] CAST commands check active trail
- [ ] "No active trail" error handling
- [ ] Session timeout (30 min)

### Key Files

- `backend/app/models/account.py` (add active_trail_id)
- `backend/app/models/trail_selection.py` (new)
- `backend/app/services/trail_selection.py` (new)
- `backend/app/routers/webhook.py` (START flow routing)
- `backend/tests/test_trail_selection.py` (new)
- `alembic/versions/xxx_add_active_trail_id.py` (migration)

### Database Changes

```sql
ALTER TABLE accounts ADD COLUMN active_trail_id INTEGER REFERENCES custom_routes(id);
```

### Success Criteria

- Registered user with trails sees "1. My Trails, 2. Library" menu
- Registered user without trails jumps to library
- Unregistered user gets current onboarding flow
- Trail selection sets active_trail_id
- CAST commands use active trail waypoints
- Pagination works for >5 trails
- Session expires after 30 minutes

### Dependencies

- Phase 3 (custom routes)
- Phase 4 (account system)

### Risks

- State machine complexity
- Mitigation: clear state transitions, comprehensive tests

### Spec Reference

- `.planning/specs/START-command-flow.md` - detailed message specifications

---

*Roadmap created: 2026-01-19*
*Last updated: 2026-01-28 - Phase 7 planned (3 plans in 3 waves)*
