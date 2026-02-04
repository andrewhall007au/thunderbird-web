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

**v1.0 (2026-02-04) - 81 requirements shipped:**

- ✓ Modular codebase with service structure (payments, routes, affiliates, weather) — v1.0
- ✓ Database migrations system (Alembic) — v1.0
- ✓ Account system with email/password and JWT sessions — v1.0
- ✓ Phone number linking to accounts — v1.0
- ✓ Stripe Checkout with dynamic pricing ($29.99/$49.99) and discount codes — v1.0
- ✓ Balance tracking with top-ups via web and SMS ("BUY $10") — v1.0
- ✓ Country-specific SMS pricing (8 countries, 80% margin) — v1.0
- ✓ GPX upload with interactive map editor (MapLibre) — v1.0
- ✓ Three waypoint types (camps/peaks/POIs) with auto-generated SMS codes — v1.0
- ✓ Route library with clone and customize capability — v1.0
- ✓ Phone simulator showing SMS forecast preview — v1.0
- ✓ Dual purchase paths ("Create first" with paywall, "Buy now" fast checkout) — v1.0
- ✓ Analytics tracking conversion by entry path — v1.0
- ✓ Affiliate program with trailing commissions and performance analytics — v1.0
- ✓ International weather (8 countries: NWS, Env Canada, Met Office, Open-Meteo) — v1.0
- ✓ Weather provider routing with fallback strategy — v1.0
- ✓ Multi-trail SMS selection via START command — v1.0
- ✓ Security hardening (CORS whitelist, XSS protection, rate limiting) — v1.0
- ✓ Comprehensive monitoring (health checks, alerting, synthetic tests, dashboard) — v1.0

### Active

(Next milestone - to be defined via /gsd:new-milestone)

### Out of Scope

- Multi-tenant architecture — using fork model, not shared codebase
- Real-time GPS tracking — SMS only, not live location
- Mobile app — web-only for v1
- Countries beyond initial 8 — expand after proving model
- Subscription model — upfront purchase + top-ups only

## Current State (v1.0 - Shipped 2026-02-04)

**Codebase:**
- ~1,754,000 lines (TypeScript + Python)
- Next.js 14 frontend, FastAPI backend, SQLite database
- 361 files created/modified across 9 phases
- Comprehensive test coverage (E2E + unit tests)
- Production monitoring with 99.9% SLA tracking

**Tech Stack:**
- Frontend: Next.js 14, React, MapLibre GL JS, Tailwind CSS
- Backend: FastAPI, SQLAlchemy, Alembic migrations
- Integrations: Stripe (payments), Twilio (SMS), Resend (email)
- Weather: NWS, Environment Canada, Met Office, Open-Meteo (8 countries)
- Monitoring: APScheduler, Playwright (synthetic tests), systemd

**Market Position:**
- Positioned against Garmin InReach ($14.95-$64.95/mo subscription) and Zoleo ($25-$50/mo)
- One-time purchase model ($29.99 launch, $49.99 RRP) is core differentiator
- Works with any phone (no special hardware), including satellite SMS capable devices
- 8-country coverage (USA, Canada, UK, France, Italy, Switzerland, New Zealand, South Africa)

**Known Issues:**
- International weather infrastructure built but not activated for SMS users (intentional - ready for future expansion)
- Monitoring dashboard has no authentication (internal tool only)

## Constraints

- **Business Model**: 80% minimum margin on $10 top-up blocks — segment count varies by country SMS costs
- **Pricing**: $10 top-up blocks (fixed), $29.99 launch price, $49.99 RRP
- **Technical**: Fork of Tasmania codebase, evolves independently
- **Coverage**: v1 must support all 8 countries at launch
- **Affiliate**: Commission on actual paid price, not RRP; stacking allowed with launch pricing

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fork vs multi-tenant | Simpler architecture, can evolve independently, different weather APIs per region | ✓ Good - Enabled rapid development |
| Variable segments vs variable pricing | $10 everywhere easier to market; accept fewer segments in expensive countries | ✓ Good - Maintained 80% margin across all countries |
| Codes stack with launch pricing | Aggressive for growth phase, strong influencer incentive | ✓ Good - Affiliate program active |
| Two purchase paths | A/B test which converts better, can disable underperformer | ✓ Good - Analytics tracking both paths |
| 8 countries at launch | Ambitious but covers major hiking destinations | ✓ Good - All weather APIs integrated |
| SQLite with WAL mode | Simpler than PostgreSQL for v1 | ✓ Good - Adequate for current scale |
| Separate monitoring service (port 8001) | Isolation from main app | ✓ Good - Survives main app crashes |
| 2 consecutive failures before alerting | Reduce false positives | ✓ Good - No alert fatigue |

## Success Criteria

- **Primary**: 100 paying users within 3 months of launch
- **Secondary**: Positive unit economics (80%+ margin maintained across countries)
- **Validation**: Create-first path conversion rate tracked and optimized

---
*Last updated: 2026-02-04 after v1.0 milestone completion*
