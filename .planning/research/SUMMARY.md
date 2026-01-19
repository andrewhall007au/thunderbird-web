# Project Research Summary

**Project:** Thunderbird Global
**Domain:** Global hiking weather SMS platform with e-commerce, route creation, and affiliate program
**Researched:** 2026-01-19
**Confidence:** MEDIUM

## Executive Summary

Thunderbird Global is expanding from a Tasmania-only hiking weather SMS service to 8 countries (USA, Canada, UK, France, Italy, Switzerland, New Zealand, South Africa). The expansion requires four major new capabilities: interactive route creation (GPX upload + map editing), Stripe-based payments with balance top-ups, a trailing-commission affiliate program, and country-specific weather API integrations. The existing FastAPI/Next.js/SQLite stack is appropriate for the 500-user target scale, but the main.py file (1685 lines) needs refactoring before adding new features.

The recommended approach is to build in dependency order: foundation refactoring first, then parallel tracks for payments and route creation, followed by user conversion flows, affiliates, and finally international weather APIs. Route creation and payments can proceed in parallel after foundation work, as they share no dependencies. The international weather integration is the highest-risk phase due to external API variability and should be researched per-country before implementation.

The critical risks are: (1) SMS margin erosion across countries with 8x cost variance, (2) affiliate code stacking exploitation that could produce negative unit economics, and (3) weather API resolution/format mismatches that could deliver dangerous misinformation. All three require explicit architectural decisions before implementation begins.

## Key Findings

### Recommended Stack

The existing stack (Next.js 14, FastAPI, SQLAlchemy, SQLite, Tailwind, Twilio) is retained. New additions are well-established libraries with low integration risk.

**Core technologies:**
- **MapLibre GL JS + react-map-gl**: Interactive maps — free/open-source Mapbox fork, no API key required
- **@tmcw/togeojson + gpxpy**: GPX parsing — browser-side and server-side, outputs GeoJSON for direct map integration
- **Stripe Checkout + Billing**: Payments — industry standard, supports stored cards for one-click top-ups
- **Custom affiliate tracking**: Commissions — no off-the-shelf solution handles trailing commissions well at this price point
- **Open-Meteo (fallback) + national APIs**: Weather — existing Open-Meteo integration as universal fallback, national APIs where free/available

### Expected Features

**Must have (table stakes):**
- Mobile-responsive checkout with guest checkout option
- GPX file upload with map display and waypoint editing
- Discount code support at checkout
- Order confirmation with SMS number and quick start
- Auto-generated SMS codes from waypoint names
- Basic affiliate code tracking and commission display

**Should have (competitive):**
- One-time purchase model (vs competitor subscriptions) — core differentiator
- Phone simulator preview showing real forecast format
- SMS top-up command ("BUY $10") without needing data/wifi
- Low balance warning SMS at $2 remaining
- Trailing commissions on top-ups (attracts quality affiliates)

**Defer (v2+):**
- Elevation profile display (high complexity)
- Real-time affiliate dashboard (email reports sufficient)
- Co-branded affiliate landing pages
- Full route drawing tool (GPX upload covers 95%)

### Architecture Approach

The expansion maintains the monolithic FastAPI backend pattern, appropriate for current scale. New components are organized into service modules (payments.py, route_builder.py, affiliates.py, weather_intl.py) with clear boundaries. Database extends with 8 new tables (accounts, custom_routes, custom_waypoints, transactions, discount_codes, affiliates, affiliate_commissions, user_balances). Weather API abstraction uses strategy pattern with per-country providers and Open-Meteo fallback.

**Major components:**
1. **Payment System**: Stripe Checkout + webhooks + balance tracking
2. **Route Creation System**: GPX upload, map editor, waypoint management, SMS code generation
3. **Affiliate System**: Admin-created affiliates, discount codes, trailing commission tracking
4. **Weather Router**: Country-based provider selection with fallback chain
5. **Account System**: Simple email/password auth with phone linking

### Critical Pitfalls

1. **International SMS Margin Erosion** — Build country-specific SMS cost tables from Day 1; calculate segments-per-dollar dynamically; display country-specific values in UI
2. **Affiliate Code Stacking Exploitation** — Model worst-case economics before launch; commission on post-discount price only; implement fraud detection (same-IP flagging, delayed payouts)
3. **Weather API Resolution Mismatch** — Document resolution for every API before integration; build normalization layer with validation bounds; show data source in forecasts
4. **GPX Route Editor State Loss** — Design explicit state machine (draft/saved/active); aggressive auto-save every 30s; handle browser events (beforeunload, visibilitychange)
5. **Two Purchase Paths Without Attribution** — Track entry path at session start; persist through purchase; document affiliate attribution rules (first-touch vs last-touch)

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation
**Rationale:** Enables all other phases; low risk refactoring work
**Delivers:** Modular codebase, database migrations, basic account system
**Addresses:** Code organization, account creation for route saving
**Avoids:** Pitfall #4 (state management) by establishing patterns early
**Research needed:** No — standard patterns

### Phase 2: Payments
**Rationale:** Must work before route creation has value; enables affiliate system
**Delivers:** Stripe checkout, webhooks, balance tracking, top-up flow
**Uses:** Stripe Python SDK, @stripe/stripe-js
**Implements:** Payment system component, transactions table
**Avoids:** Pitfall #1 (SMS margins) by building country costs from start; Pitfall #13 (webhook reliability) by implementing idempotency
**Research needed:** No — Stripe well-documented

### Phase 3: Route Creation
**Rationale:** Core value prop; can parallel with Phase 2
**Delivers:** GPX upload, map editor, waypoint management, SMS code generation
**Uses:** MapLibre GL JS, @tmcw/togeojson, gpxpy
**Implements:** Route creation system, custom_routes/waypoints tables
**Avoids:** Pitfall #8 (GPX parsing) by supporting common variants; Pitfall #11 (clustering) by limiting waypoints; Pitfall #12 (collisions) by collision detection
**Research needed:** No — well-established libraries

### Phase 4: User Flows
**Rationale:** Combines payment + route creation into conversion paths
**Delivers:** Phone simulator, two purchase paths (buy now / create first), route activation
**Avoids:** Pitfall #5 (attribution) by building tracking before flows
**Research needed:** No — integration work

### Phase 5: Affiliates
**Rationale:** Depends on payments working; growth mechanism
**Delivers:** Affiliate admin, discount codes, commission tracking, trailing commissions
**Avoids:** Pitfall #2 (stacking exploitation) by modeling economics first; Pitfall #10 (commission accounting) by implementing state machine
**Research needed:** No — standard CRUD patterns

### Phase 6: International Weather
**Rationale:** Highest risk; can proceed in parallel with Phases 4-5
**Delivers:** Per-country weather API integrations, fallback handling
**Uses:** Existing httpx, Open-Meteo base
**Avoids:** Pitfall #3 (resolution mismatch) by documenting before implementing; Pitfall #7 (failover consistency) by normalization layer; Pitfall #9 (timezone chaos) by explicit timezone handling; Pitfall #14 (rate limits) by caching
**Research needed:** YES — research each API before implementing (NWS, Met Office, Meteo-France, etc.)

### Phase Ordering Rationale

- **Foundation first:** main.py refactor (1685 lines) must happen before adding complexity
- **Payments before affiliates:** Commission tracking requires working payment flow
- **Route creation parallel to payments:** No dependencies between these; both depend only on foundation
- **User flows after payments + routes:** Integration phase combining prior work
- **Weather APIs last:** Highest external risk, can proceed independently, most research needed
- **Critical path:** Foundation -> Payments -> User Flows (minimum viable purchase)
- **Parallel track:** Foundation -> Route Creation -> User Flows (route value)

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 6 (International Weather):** Each country's API has different auth, rate limits, resolution, and field formats. Research per-country before implementation. Start with USA (NWS is simplest, free, no auth).

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Standard FastAPI refactoring patterns
- **Phase 2 (Payments):** Stripe is extensively documented
- **Phase 3 (Route Creation):** MapLibre + GPX parsing have clear tutorials
- **Phase 5 (Affiliates):** Common e-commerce CRUD pattern

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core libraries (MapLibre, Stripe, togeojson) are mature and well-documented |
| Features | MEDIUM | Based on competitor analysis from training data; verify current market expectations |
| Architecture | HIGH | Extends existing well-structured FastAPI codebase; patterns are standard |
| Pitfalls | MEDIUM | Domain expertise plus project context; SMS costs and API details need verification |

**Overall confidence:** MEDIUM

### Gaps to Address

- **SMS cost verification:** Twilio pricing varies; verify current rates for all 8 countries before finalizing pricing model
- **Weather API availability:** Met Office, Meteo-France, MeteoSwiss free tier limits need verification; some may require paid tiers
- **Package versions:** All npm/PyPI versions are from training data; verify current stable versions before implementation
- **New Zealand weather:** MetService API availability unclear; may need to rely entirely on Open-Meteo

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis (/Users/andrewhall/thunderbird-web/) — architecture patterns, current stack
- PROJECT.md specification — feature requirements, anti-features, pricing model

### Secondary (MEDIUM confidence)
- Training data on Stripe, MapLibre, togeojson patterns — version compatibility
- Training data on weather API availability — may have changed

### Tertiary (LOW confidence)
- Training data on Twilio international pricing — verify with current Twilio documentation
- Training data on Met Office, Meteo-France API terms — verify with current provider documentation

---
*Research completed: 2026-01-19*
*Ready for roadmap: yes*
