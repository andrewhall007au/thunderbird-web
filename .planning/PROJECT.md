# Thunderbird Global

## What This Is

A global self-service hiking weather SMS platform — forked from Thunderbird Tasmania. Users create custom routes via GPX upload and interactive map editor, or choose from a library of popular trails. Accurate weather forecasts delivered via SMS to any phone, including satellite SMS devices. Targeting serious hikers on iconic trails across USA, Canada, UK, France, Italy, Switzerland, New Zealand, and South Africa.

## Core Value

Hikers anywhere in the world can create a custom route and receive accurate, location-specific weather forecasts via SMS — even in areas with no cell coverage (via satellite SMS).

## Requirements

### Validated

(Inherited from Tasmania fork)

- ✓ SMS-based weather forecasts via Twilio — existing
- ✓ CAST commands (CAST12, CAST24, CAST7) — existing
- ✓ Weather data from BOM with Open-Meteo fallback — existing
- ✓ Dynamic weather zone grouping (40-85% SMS reduction) — existing
- ✓ SafeCheck emergency contact notifications — existing
- ✓ SMS command parsing (CHECKIN, HELP, STATUS, etc.) — existing

### Active

**E-commerce & Payments**
- [ ] Purchase flow with $29.99 upfront pricing
- [ ] Dynamic pricing: RRP $49.99, configurable launch/sale prices via admin
- [ ] Discount code support (stacks with launch pricing)
- [ ] Stripe integration with stored cards for one-click top-ups
- [ ] SMS-based top-up ("BUY $10" command)
- [ ] $10 top-up blocks with variable segments by country (80% min margin)
- [ ] Low balance warning SMS at $2 remaining
- [ ] Cost verification system (test SMS per country, reconcile against Twilio actuals)

**Affiliate/Influencer Program**
- [ ] Admin console for affiliate setup
- [ ] Configurable per affiliate: discount %, commission %, trailing duration (years)
- [ ] Commission calculated on actual paid price (not RRP)
- [ ] Trailing commission on all user top-ups within duration
- [ ] Affiliate performance analytics

**Route Creation**
- [ ] GPX file upload
- [ ] Interactive map displaying uploaded route
- [ ] Pin editor: camps (color 1), peaks (color 2), POIs (color 3)
- [ ] User enters waypoint name, system generates SMS code (e.g., "Lake Oberon" → "LAKEO")
- [ ] Route library of pre-built popular trails (admin-uploaded)
- [ ] Users can customize library routes or create from scratch
- [ ] Account system (email) for saving draft routes

**User Flow & Conversion**
- [ ] Two purchase paths: "Buy now" (fast) and "Create first" (show value)
- [ ] Phone simulator showing example SMS forecast for user's route
- [ ] Analytics tracking conversion rates by path (A/B testing capability)
- [ ] Paywall after simulator — pay to activate route and get SMS number

**Weather APIs (International)**
- [ ] Weather API integration for 8 countries: USA, Canada, UK, France, Italy, Switzerland, New Zealand, South Africa
- [ ] Best API per region based on resolution vs cost research
- [ ] Fallback API strategy per country

**Website Content**
- [ ] Landing page with Garmin/Zoleo comparison
- [ ] Carrier/device compatibility page (satellite SMS support by carrier)
- [ ] SMS value proposition messaging (small payload, prioritized delivery, works with brief coverage)

### Out of Scope

- Multi-tenant architecture — using fork model, not shared codebase
- Real-time GPS tracking — SMS only, not live location
- Mobile app — web-only for v1
- Countries beyond initial 8 — expand after proving model
- Subscription model — upfront purchase + top-ups only

## Context

**Existing Codebase (Tasmania):**
- Next.js 14 frontend, FastAPI backend, SQLite database
- Twilio SMS integration with signature validation
- BOM weather API with Open-Meteo fallback
- Dynamic grouping reduces SMS segments by 40-85%
- Pricing model with segment estimation per command
- See `.planning/codebase/` for full architecture documentation

**Market Position:**
- Positioned against Garmin InReach ($14.95-$64.95/mo subscription) and Zoleo ($25-$50/mo)
- One-time purchase model is differentiator
- Works with any phone (no special hardware), including satellite SMS capable devices

**Weather API Landscape (needs research):**
- Each country has national weather services with varying API access
- Commercial options: Tomorrow.io, OpenWeather, Open-Meteo
- Tradeoffs: resolution, cost, reliability, mountain-specific data

## Constraints

- **Business Model**: 80% minimum margin on $10 top-up blocks — segment count varies by country SMS costs
- **Pricing**: $10 top-up blocks (fixed), $29.99 launch price, $49.99 RRP
- **Technical**: Fork of Tasmania codebase, evolves independently
- **Coverage**: v1 must support all 8 countries at launch
- **Affiliate**: Commission on actual paid price, not RRP; stacking allowed with launch pricing

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fork vs multi-tenant | Simpler architecture, can evolve independently, different weather APIs per region | — Pending |
| Variable segments vs variable pricing | $10 everywhere easier to market; accept fewer segments in expensive countries | — Pending |
| Codes stack with launch pricing | Aggressive for growth phase, strong influencer incentive | — Pending |
| Two purchase paths | A/B test which converts better, can disable underperformer | — Pending |
| 8 countries at launch | Ambitious but covers major hiking destinations | — Pending |

## Success Criteria

- **Primary**: 100 paying users within 3 months of launch
- **Secondary**: Positive unit economics (80%+ margin maintained across countries)
- **Validation**: Create-first path conversion rate tracked and optimized

---
*Last updated: 2026-01-19 after initialization*
