# Feature Landscape

**Domain:** Hiking weather SMS platform with e-commerce, route creation, and affiliate program
**Researched:** 2026-01-19
**Confidence:** MEDIUM (based on training data - WebSearch unavailable for verification)

## Executive Summary

This document categorizes features for Thunderbird Global across three domains:
1. **E-commerce** - Purchase flow, payment processing, top-ups
2. **Route Creation** - GPX upload, map editor, route library
3. **Affiliate Program** - Discount codes, commissions, tracking

Features are classified as table stakes (must have), differentiators (competitive advantage), or anti-features (deliberately avoid).

---

## E-Commerce Features

### Table Stakes

Features users expect from any purchase flow. Missing these causes cart abandonment.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Mobile-responsive checkout | 60%+ of outdoor gear purchases happen on mobile | Low | Must work on all screen sizes |
| Guest checkout | Users abandon when forced to create account before purchase | Low | Critical - 23% abandon when account required |
| Clear pricing display | Users expect transparent pricing, no hidden fees | Low | Show $29.99 upfront, explain top-up model |
| SSL/security indicators | Trust signals required for credit card entry | Low | Stripe handles this, but show padlock |
| Multiple payment methods | Credit card minimum; PayPal/Apple Pay expected | Medium | Stripe supports all; prioritize cards + Apple Pay |
| Order confirmation email | Standard expectation after purchase | Low | Include SMS number, quick start guide |
| Loading states and error handling | Users need feedback during payment processing | Low | Stripe's default UI handles this well |
| Discount code field | Users look for this; hidden = friction | Low | Visible in checkout, not buried |
| Clear refund/return policy | Trust signal; required for new brands | Low | State policy clearly (digital product = limited) |
| Receipt/invoice download | Business users need for expense reports | Low | PDF generation or email copy |

### Differentiators

Features that set Thunderbird apart from competitors.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| One-time purchase model | Competitors charge monthly ($15-65); this is the core differentiator | Low | Already decided in PROJECT.md |
| SMS top-up command ("BUY $10") | Top up without needing cell/wifi - unique to SMS-first product | Medium | Parse SMS command, trigger Stripe saved card |
| Phone simulator preview | "Try before you buy" - show real forecast for their route | High | Deferred payment until value demonstrated |
| Two purchase paths (A/B) | "Buy now" fast path vs "create first" value path | Medium | Analytics to determine winner |
| Low balance warning SMS | Proactive notification at $2 remaining | Low | Reduces churn from accidental balance depletion |
| Route-based pricing tiers | Price by complexity/duration (already in spec) | Low | Signals value alignment |
| Stored card for one-click top-up | Frictionless repeat purchases | Medium | Stripe Customer Portal or custom |

### Anti-Features

Features to deliberately NOT build for e-commerce.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Subscription model | Competitors charge monthly; one-time purchase is differentiator | Upfront purchase + top-ups |
| Complex account dashboard | Users interact via SMS, not web; web dashboard adds complexity | Minimal web - just purchase and route creation |
| Wallet/credits display on web | Encourages checking web instead of using product | Balance check via SMS ("STATUS" command) |
| Multi-currency pricing | Adds complexity; start with single currency per region | Price in local currency per country, no selector |
| Cart/basket system | Single product purchase; cart adds friction | Direct to checkout |
| Upsells during checkout | Outdoor users hate this; damages trust | Clean checkout, upsell in email post-purchase |

---

## Route Creation Features

### Table Stakes

Features users expect from any route/map editor.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| GPX file upload | Standard format; users export from Gaia, Caltopo, AllTrails | Medium | Parse GPX, display on map |
| Map display of uploaded route | Users need visual confirmation of upload | Medium | Leaflet with OpenStreetMap tiles |
| Waypoint/pin placement | Add points of interest to route | Medium | Click-to-add on map |
| Waypoint naming | Users name their own camps, peaks, POIs | Low | Text input per waypoint |
| Drag-to-reposition waypoints | Adjust pin placement after initial drop | Medium | Leaflet marker dragging |
| Delete waypoint | Remove mistakes | Low | Click-to-delete or X button |
| Save draft routes | Don't lose work; return later | Medium | Requires account system |
| Route library browsing | Pre-built routes for popular trails | Low | Admin-uploaded routes users can select |
| Mobile-responsive map | Many users plan on tablets | Medium | Touch-friendly map controls |

### Differentiators

Features that enhance route creation experience.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Auto-generated SMS codes | "Lake Oberon" -> "LAKEO" automatically | Low | Already specified in PROJECT.md |
| Pin type differentiation (camp/peak/POI) | Color-coded pins with different SMS behaviors | Medium | Different forecast types per pin type |
| Clone and customize library routes | Start from template, modify for your trip | Medium | Faster than building from scratch |
| Route preview with sample forecast | See what SMS you'll receive before purchase | High | Strong conversion driver |
| Elevation profile display | Standard in hiking apps; shows route difficulty | High | Calculate from GPX, display chart |
| Distance/duration estimates | How long is this route? | Medium | Calculate from GPX waypoints |
| Weather zone visualization | Show BOM cells on map (already in spec) | Medium | Transparency about forecast resolution |

### Anti-Features

Features to deliberately NOT build for route creation.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full route drawing tool | Complex to build; GPX upload handles 95% of cases | GPX upload + waypoint editing |
| Turn-by-turn navigation | Not the product; SMS is about weather, not navigation | Link to AllTrails/Gaia for navigation |
| Offline map downloads | App feature, not web feature; out of scope | Users use dedicated nav apps |
| Social route sharing | Adds complexity; not core to weather SMS | Simple share link for route page |
| Route comments/reviews | Community features are expensive to moderate | Focus on weather, not community |
| Real-time GPS tracking | Explicitly out of scope per PROJECT.md | SMS-based check-ins only |
| Mobile app | Web-only for v1 per PROJECT.md | Progressive web app if needed later |

---

## Affiliate Program Features

### Table Stakes

Features expected from any affiliate/referral program.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Unique affiliate codes | Each affiliate needs trackable code | Low | Generate on affiliate creation |
| Commission tracking | Affiliates need to see what they've earned | Medium | Dashboard or email reports |
| Payout tracking | When will I get paid? | Medium | Show pending vs paid commissions |
| Basic analytics | How many clicks? How many conversions? | Medium | Clicks, conversions, revenue |
| Code application at checkout | Users enter code, discount applies | Low | Standard checkout integration |
| Terms and conditions | Legal requirements for affiliate programs | Low | Static page, affiliate agrees on signup |

### Differentiators

Features that attract and retain quality affiliates.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Trailing commissions on top-ups | Commission on all user top-ups within duration (years) | High | Unique - most programs only pay on initial sale |
| Configurable per-affiliate terms | Different % discount, % commission, duration | Medium | Admin console for setup |
| Stacking with launch pricing | Aggressive for growth; strong influencer incentive | Low | Already decided in PROJECT.md |
| Commission on actual paid price | Fair - affiliates share in discounts given | Low | Calculate on post-discount amount |
| Real-time earnings dashboard | Instant gratification for affiliates | Medium | Live updates on conversions |
| Affiliate performance tiers | Higher volume = better terms | Medium | Incentivize top performers |
| Co-branded landing pages | Affiliate's name/branding on landing page | High | Nice for influencers; complex to build |

### Anti-Features

Features to deliberately NOT build for affiliate program.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Self-service affiliate signup | Quality control; outdoor influencers only | Admin-approved affiliates only |
| Automatic payouts | Cash flow risk; need manual review | Manual payout approval, regular cadence |
| Multi-level marketing | Reputational risk; regulatory complexity | Single-tier affiliate only |
| Affiliate API access | Over-engineering for early stage | Admin console + email reports |
| Public affiliate leaderboard | Privacy concerns; competitive tension | Private performance metrics |
| Complex attribution models | Last-click is simple and understood | Last-click attribution only |

---

## Feature Dependencies

```
ROUTE CREATION (foundation)
    |
    v
E-COMMERCE (monetization)
    |
    v
AFFILIATE PROGRAM (growth)
```

**Rationale:**
1. Route creation must work before users can purchase (value demonstration)
2. E-commerce must work before affiliates can earn commissions
3. Affiliate program drives new user acquisition after core product stable

### Within E-Commerce

```
Stripe Integration -> Stored Cards -> SMS Top-up
                  -> Discount Codes -> Affiliate Tracking
                  -> Checkout Flow -> Order Confirmation
```

### Within Route Creation

```
GPX Upload -> Map Display -> Waypoint Editor -> SMS Code Generation
                         -> Elevation Profile (optional)
                         -> Route Preview
```

### Within Affiliate Program

```
Affiliate Setup (admin) -> Discount Codes -> Commission Tracking -> Trailing Commissions
                                          -> Payout Management
```

---

## MVP Recommendation

For MVP, prioritize:

### E-Commerce (Critical Path)
1. Stripe checkout with single purchase ($29.99)
2. Discount code support (affiliate codes)
3. Order confirmation email with SMS number
4. Mobile-responsive checkout

### Route Creation (Critical Path)
1. GPX file upload and map display
2. Waypoint editor (camp, peak, POI types)
3. Auto-generated SMS codes
4. Save draft routes (account system)
5. Route library (admin-uploaded)

### Affiliate Program (Post-Launch OK)
1. Unique affiliate codes (admin-created)
2. Commission tracking (can be manual initially)
3. Basic analytics (conversions per code)

**Defer to post-MVP:**
- SMS top-up command (requires stored cards, SMS parsing)
- Phone simulator preview (high complexity)
- Trailing commissions (need usage tracking first)
- Elevation profile display (nice-to-have)
- Real-time affiliate dashboard (email reports sufficient initially)

---

## Competitive Feature Matrix

| Feature | Thunderbird | Garmin InReach | Zoleo | AllTrails |
|---------|-------------|----------------|-------|-----------|
| One-time purchase | **YES** | No (subscription) | No (subscription) | Freemium |
| Works via satellite SMS | **YES** | Proprietary network | Proprietary network | No |
| No special hardware | **YES** | $500-600 device | $280-350 device | Phone app |
| Custom route creation | **YES** | Limited | No | Yes |
| Location-specific weather | **YES** | Generic | Basic | No |
| SMS-based top-up | **YES** | N/A | N/A | N/A |
| Price (annual) | **~$40** | $300-780 | $360-960 | $36 |

**Key differentiators emphasized:**
1. No monthly subscription
2. No proprietary hardware
3. Works with existing phone + satellite SMS
4. Route-specific weather forecasts

---

## Sources and Confidence

| Category | Confidence | Basis |
|----------|------------|-------|
| E-commerce table stakes | MEDIUM | Training data on checkout UX patterns; no 2025/2026 verification |
| Route editor features | MEDIUM | Training data on AllTrails, Komoot, Gaia GPS, Caltopo |
| Affiliate program features | MEDIUM | Training data on affiliate platforms (Impact, PartnerStack, etc.) |
| Competitive positioning | HIGH | Documented in PROJECT.md and THUNDERBIRD_SPEC |
| Anti-features rationale | HIGH | Based on PROJECT.md explicit out-of-scope items |

**Note:** WebSearch was unavailable during research. Features marked MEDIUM confidence should be validated against current e-commerce and outdoor app best practices before implementation.

---

*Feature landscape research: 2026-01-19*
