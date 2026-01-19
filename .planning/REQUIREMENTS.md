# Requirements: Thunderbird Global

**Defined:** 2026-01-19
**Core Value:** Hikers anywhere in the world can create a custom route and receive accurate, location-specific weather forecasts via SMS — even in areas with no cell coverage (via satellite SMS).

## v1 Requirements

Requirements for initial global launch. Each maps to roadmap phases.

### Foundation

- [x] **FOUN-01**: Codebase refactored with modular service structure (payments.py, route_builder.py, affiliates.py, weather_intl.py)
- [x] **FOUN-02**: Database migrations system in place (Alembic)
- [x] **FOUN-03**: User can create account with email and password
- [x] **FOUN-04**: User session persists across browser refresh
- [x] **FOUN-05**: User can link phone number to account

### Payments

- [x] **PAY-01**: User can purchase access for $29.99 via Stripe Checkout
- [x] **PAY-02**: System applies dynamic pricing (RRP $49.99, launch $29.99, configurable in admin)
- [x] **PAY-03**: User can enter discount code at checkout
- [x] **PAY-04**: Discount codes stack with launch pricing
- [x] **PAY-05**: User receives order confirmation email with SMS number and quick start
- [x] **PAY-06**: User balance tracked per account
- [x] **PAY-07**: User can top up $10 blocks via web with stored card
- [x] **PAY-08**: User can top up via SMS command ("BUY $10")
- [x] **PAY-09**: User receives low balance warning SMS at $2 remaining
- [x] **PAY-10**: Country-specific SMS cost tables implemented (8 countries)
- [x] **PAY-11**: Segment count per $10 varies by country (80% min margin maintained)
- [x] **PAY-12**: SMS cost verification function reconciles against Twilio actuals

### Route Creation

- [x] **ROUT-01**: User can upload GPX file
- [x] **ROUT-02**: Uploaded GPX displays on interactive map
- [x] **ROUT-03**: User can add waypoint pins by clicking map
- [x] **ROUT-04**: Three pin types available: camps (color 1), peaks (color 2), POIs (color 3)
- [x] **ROUT-05**: User can name each waypoint
- [x] **ROUT-06**: System auto-generates SMS code from waypoint name ("Lake Oberon" -> "LAKEO")
- [x] **ROUT-07**: User can drag waypoints to reposition
- [x] **ROUT-08**: User can delete waypoints
- [x] **ROUT-09**: User can save draft routes to account
- [x] **ROUT-10**: Route library displays admin-uploaded popular trails
- [x] **ROUT-11**: User can clone and customize library routes
- [x] **ROUT-12**: Map is mobile-responsive with touch controls

### User Flows

- [ ] **FLOW-01**: Phone simulator shows example SMS forecast for user's route
- [ ] **FLOW-02**: "Create first" path: user creates route, sees simulator, then pays to activate
- [ ] **FLOW-03**: "Buy now" path: fast checkout, create route after purchase
- [ ] **FLOW-04**: Analytics tracks conversion rate by path (A/B capability)
- [ ] **FLOW-05**: Paywall appears after simulator — pay to activate route and receive SMS number
- [ ] **FLOW-06**: Entry path tracked at session start and persisted through purchase

### Affiliates

- [ ] **AFFL-01**: Admin can create affiliates in admin console
- [ ] **AFFL-02**: Each affiliate has configurable: discount %, commission %, trailing duration (years)
- [ ] **AFFL-03**: Affiliate codes function as discount codes at checkout
- [ ] **AFFL-04**: Commission calculated on actual paid price (not RRP)
- [ ] **AFFL-05**: Trailing commission tracked on all user top-ups within duration
- [ ] **AFFL-06**: Admin can view affiliate performance analytics (clicks, conversions, revenue)
- [ ] **AFFL-07**: Commission payout tracking (pending vs paid)

### International Weather

- [ ] **WTHR-01**: Weather API integration for USA (NWS)
- [ ] **WTHR-02**: Weather API integration for Canada
- [ ] **WTHR-03**: Weather API integration for UK (Met Office)
- [ ] **WTHR-04**: Weather API integration for France (Meteo-France)
- [ ] **WTHR-05**: Weather API integration for Italy
- [ ] **WTHR-06**: Weather API integration for Switzerland (MeteoSwiss)
- [ ] **WTHR-07**: Weather API integration for New Zealand
- [ ] **WTHR-08**: Weather API integration for South Africa
- [ ] **WTHR-09**: Open-Meteo fallback for all countries
- [ ] **WTHR-10**: Weather response normalization layer (consistent format across APIs)
- [ ] **WTHR-11**: Data source displayed in forecasts

### Content

- [ ] **CONT-01**: Landing page with Garmin/Zoleo comparison messaging
- [ ] **CONT-02**: Carrier/device compatibility page (satellite SMS support by carrier)
- [ ] **CONT-03**: SMS value proposition messaging (small payload, prioritized delivery)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Route Enhancements

- **ROUT-V2-01**: Elevation profile display for routes
- **ROUT-V2-02**: Distance and duration estimates from GPX
- **ROUT-V2-03**: Weather zone visualization on map

### Affiliate Enhancements

- **AFFL-V2-01**: Real-time affiliate earnings dashboard
- **AFFL-V2-02**: Co-branded affiliate landing pages
- **AFFL-V2-03**: Affiliate performance tiers (volume-based terms)

### Payment Enhancements

- **PAY-V2-01**: Apple Pay / Google Pay support
- **PAY-V2-02**: Multi-currency display (auto-detect region)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Multi-tenant architecture | Using fork model for simpler evolution |
| Real-time GPS tracking | SMS only, not live location |
| Mobile app | Web-only for v1 |
| Countries beyond initial 8 | Expand after proving model |
| Subscription model | One-time purchase is core differentiator |
| Full route drawing tool | GPX upload handles 95% of cases |
| Turn-by-turn navigation | Not the product; link to dedicated apps |
| Social route sharing/comments | Community features expensive to moderate |
| Self-service affiliate signup | Quality control via admin approval |
| Multi-level marketing | Reputational and regulatory risk |
| Automatic affiliate payouts | Cash flow risk; manual review required |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUN-01 | Phase 1 | Complete |
| FOUN-02 | Phase 1 | Complete |
| FOUN-03 | Phase 1 | Complete |
| FOUN-04 | Phase 1 | Complete |
| FOUN-05 | Phase 1 | Complete |
| PAY-01 | Phase 2 | Complete |
| PAY-02 | Phase 2 | Complete |
| PAY-03 | Phase 2 | Complete |
| PAY-04 | Phase 2 | Complete |
| PAY-05 | Phase 2 | Complete |
| PAY-06 | Phase 2 | Complete |
| PAY-07 | Phase 2 | Complete |
| PAY-08 | Phase 2 | Complete |
| PAY-09 | Phase 2 | Complete |
| PAY-10 | Phase 2 | Complete |
| PAY-11 | Phase 2 | Complete |
| PAY-12 | Phase 2 | Complete |
| ROUT-01 | Phase 3 | Complete |
| ROUT-02 | Phase 3 | Complete |
| ROUT-03 | Phase 3 | Complete |
| ROUT-04 | Phase 3 | Complete |
| ROUT-05 | Phase 3 | Complete |
| ROUT-06 | Phase 3 | Complete |
| ROUT-07 | Phase 3 | Complete |
| ROUT-08 | Phase 3 | Complete |
| ROUT-09 | Phase 3 | Complete |
| ROUT-10 | Phase 3 | Complete |
| ROUT-11 | Phase 3 | Complete |
| ROUT-12 | Phase 3 | Complete |
| FLOW-01 | Phase 4 | Pending |
| FLOW-02 | Phase 4 | Pending |
| FLOW-03 | Phase 4 | Pending |
| FLOW-04 | Phase 4 | Pending |
| FLOW-05 | Phase 4 | Pending |
| FLOW-06 | Phase 4 | Pending |
| AFFL-01 | Phase 5 | Pending |
| AFFL-02 | Phase 5 | Pending |
| AFFL-03 | Phase 5 | Pending |
| AFFL-04 | Phase 5 | Pending |
| AFFL-05 | Phase 5 | Pending |
| AFFL-06 | Phase 5 | Pending |
| AFFL-07 | Phase 5 | Pending |
| WTHR-01 | Phase 6 | Pending |
| WTHR-02 | Phase 6 | Pending |
| WTHR-03 | Phase 6 | Pending |
| WTHR-04 | Phase 6 | Pending |
| WTHR-05 | Phase 6 | Pending |
| WTHR-06 | Phase 6 | Pending |
| WTHR-07 | Phase 6 | Pending |
| WTHR-08 | Phase 6 | Pending |
| WTHR-09 | Phase 6 | Pending |
| WTHR-10 | Phase 6 | Pending |
| WTHR-11 | Phase 6 | Pending |
| CONT-01 | Phase 4 | Pending |
| CONT-02 | Phase 4 | Pending |
| CONT-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 53 total
- Mapped to phases: 53
- Unmapped: 0

---
*Requirements defined: 2026-01-19*
*Last updated: 2026-01-19 after Phase 2 completion*
