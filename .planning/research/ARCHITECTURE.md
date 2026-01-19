# Architecture Patterns

**Domain:** Global hiking weather SMS platform with e-commerce
**Researched:** 2026-01-19
**Confidence:** HIGH for existing integration, MEDIUM for new components

## Executive Summary

The existing FastAPI/Next.js architecture is well-suited for the planned expansion. The monolithic FastAPI backend with SQLite is appropriate for the current scale (500 users target), but the new features require careful component boundaries to avoid complexity creep. This document maps how payments, route creation, affiliate tracking, and international weather APIs integrate with the existing codebase.

---

## Existing Architecture Overview

```
+------------------+     +-------------------+     +----------------+
|   Next.js 14     |     |    FastAPI        |     |    SQLite      |
|   (Frontend)     |---->|    (Backend)      |---->|   (Database)   |
|                  |     |                   |     |                |
| - /app pages     |     | - /webhook/sms    |     | - users        |
| - /register      |     | - /api/routes     |     | - safecheck    |
| - /admin         |     | - /api/forecast   |     | - message_log  |
+------------------+     +-------------------+     +----------------+
                               |
                    +----------+----------+
                    |                     |
            +-------v------+      +-------v------+
            |   Twilio     |      |  BOM/Open-   |
            |   SMS API    |      |  Meteo APIs  |
            +--------------+      +--------------+
```

### Current Component Responsibilities

| Component | Responsibility | Key Files |
|-----------|---------------|-----------|
| `main.py` | FastAPI app, webhooks, admin routes | 1685 lines, handles everything |
| `services/bom.py` | Weather API abstraction | BOM + Open-Meteo fallback |
| `services/commands.py` | SMS command parsing | CAST, CHECKIN, SAFE, etc. |
| `services/routes.py` | Route/waypoint management | JSON config loading |
| `services/pricing.py` | Cost estimation | Segment counting, tier pricing |
| `services/sms.py` | Twilio integration | Send/receive SMS |
| `models/database.py` | SQLite ORM | Users, contacts, message log |

### Identified Refactoring Needs

**main.py is too large (1685 lines)** - Before adding new features, split into:
- `routes/webhooks.py` - Twilio webhook handlers
- `routes/api.py` - REST API endpoints
- `routes/admin.py` - Admin interface

---

## New Component Architecture

### High-Level Architecture (Post-Expansion)

```
+-------------------+     +----------------------+     +------------------+
|    Next.js 14     |     |      FastAPI         |     |     SQLite       |
|    (Frontend)     |---->|      (Backend)       |---->|    (Database)    |
|                   |     |                      |     |                  |
| NEW PAGES:        |     | NEW SERVICES:        |     | NEW TABLES:      |
| - /create-route   |     | - payments.py        |     | - accounts       |
| - /simulator      |     | - weather_intl.py    |     | - routes         |
| - /checkout       |     | - affiliates.py      |     | - waypoints      |
| - /account        |     | - accounts.py        |     | - transactions   |
|                   |     |                      |     | - affiliates     |
| NEW COMPONENTS:   |     | NEW ROUTES:          |     | - affiliate_links|
| - MapEditor       |     | - /api/checkout      |     | - discount_codes |
| - GPXUploader     |     | - /webhook/stripe    |     |                  |
| - PhoneSimulator  |     | - /api/affiliates    |     |                  |
+-------------------+     +----------------------+     +------------------+
          |                        |
          |              +---------+---------+
          |              |                   |
          |       +------v------+    +-------v-------+
          |       |   Stripe    |    |  Weather APIs |
          |       |  Payments   |    |  (per country)|
          |       +-------------+    +---------------+
          |
    +-----v-----+
    |  Mapbox   |
    |    GL     |
    +-----------+
```

---

## Component Details

### 1. Payment System (Stripe)

**New Files:**
- `services/payments.py` - Stripe integration logic
- `routes/checkout.py` - Payment endpoints
- `models/transactions.py` - Transaction records

**Data Flow: Purchase Route**

```
User clicks "Buy Now"
        |
        v
[Next.js] POST /api/checkout/create-session
        |
        v
[FastAPI] payments.create_checkout_session()
   - Creates Stripe Checkout Session
   - Applies discount code if present
   - Applies affiliate tracking
   - Returns session.url
        |
        v
[Next.js] Redirect to Stripe Checkout
        |
        v
[Stripe] User completes payment
        |
        v
[Stripe] POST /webhook/stripe (checkout.session.completed)
        |
        v
[FastAPI] payments.handle_checkout_completed()
   - Verify webhook signature
   - Create transaction record
   - Activate user route
   - Credit affiliate commission
   - Send confirmation SMS
        |
        v
[Database] Update: users, transactions, affiliate_commissions
```

**Key Patterns:**

1. **Webhook Idempotency**: Store Stripe event IDs, reject duplicates
2. **Stored Cards**: Use Stripe Customer objects for one-click top-ups
3. **SMS Top-Up Command**: `BUY $10` triggers Stripe payment link via SMS

**Stripe Customer Model:**
```python
class StripeCustomer:
    user_phone: str  # Foreign key to users
    stripe_customer_id: str
    default_payment_method_id: Optional[str]
    created_at: datetime
```

**Transaction Model:**
```python
class Transaction:
    id: int
    user_phone: str
    stripe_payment_intent_id: str
    amount_aud: Decimal
    type: str  # 'purchase', 'topup'
    status: str  # 'pending', 'completed', 'refunded'
    discount_code_id: Optional[int]
    affiliate_id: Optional[int]
    created_at: datetime
```

---

### 2. Route Creation System

**New Files:**
- `services/route_builder.py` - Route creation logic
- `routes/route_api.py` - Route CRUD endpoints
- `models/custom_routes.py` - User-created routes

**Data Flow: Create Route from GPX**

```
User uploads GPX file
        |
        v
[Next.js MapEditor] Parse GPX client-side
   - Extract track points
   - Display on Mapbox map
   - Detect potential waypoint locations
        |
        v
[User] Adds/edits pins on map
   - Camp pins (blue)
   - Peak pins (orange)
   - POI pins (gray)
   - Enters name for each
        |
        v
[Next.js] POST /api/routes
   - route_data: { track, waypoints }
   - account_id (if logged in)
        |
        v
[FastAPI] route_builder.create_route()
   - Generate SMS codes from names
   - Calculate weather zones
   - Store as draft (unpaid)
        |
        v
[Database] routes, waypoints tables
```

**Custom Route Model:**
```python
class CustomRoute:
    id: int
    account_id: Optional[int]  # Null for anonymous
    name: str
    track_geojson: str  # Simplified track for display
    country: str
    status: str  # 'draft', 'paid', 'active', 'expired'
    created_at: datetime
    paid_at: Optional[datetime]

class CustomWaypoint:
    id: int
    route_id: int
    code: str  # e.g., "LAKEO" - generated from name
    name: str  # e.g., "Lake Oberon"
    lat: float
    lon: float
    elevation: int
    type: str  # 'camp', 'peak', 'poi'
    weather_zone: str  # Calculated from lat/lon
```

**SMS Code Generation:**
```python
def generate_sms_code(name: str, existing_codes: set) -> str:
    """Generate unique 5-char code from waypoint name."""
    # "Lake Oberon" -> "LAKEO"
    # "Mt. Whitney" -> "MTWHI"
    # Handle collisions with suffix: LAKEO, LAKE2, LAKE3
```

---

### 3. Phone Simulator Component

**Frontend Only (Next.js)**

```
[PhoneSimulator Component]
   - Receives route waypoints
   - Fetches sample forecast from /api/forecast/preview
   - Renders in phone-shaped container
   - Shows scrolling SMS thread
   - Mimics CAST12 response format
```

**API Endpoint:**
```
GET /api/forecast/preview?lat={lat}&lon={lon}&country={country}
   - Returns sample forecast (cached/mock for preview)
   - No authentication required
   - Rate limited per IP
```

---

### 4. Affiliate System

**New Files:**
- `services/affiliates.py` - Affiliate logic
- `routes/affiliate_api.py` - Affiliate endpoints
- `models/affiliates.py` - Affiliate records

**Data Flow: Affiliate Purchase**

```
User clicks affiliate link
   example.com/ref/ANDREW
        |
        v
[Next.js] Store affiliate code in cookie/localStorage
   - Cookie: 30-day expiry
   - Track in analytics
        |
        v
User completes purchase (maybe days later)
        |
        v
[Checkout] Include affiliate_code in session metadata
        |
        v
[Webhook Handler] On payment success:
   - Calculate commission: (actual_paid * commission_rate)
   - Create pending commission record
   - Link user to affiliate (for trailing commission)
        |
        v
[Periodic Job] Calculate trailing commissions
   - Query top-ups by users linked to affiliates
   - Within trailing_duration_years
   - Create commission records
```

**Affiliate Model:**
```python
class Affiliate:
    id: int
    code: str  # "ANDREW" - unique
    name: str
    email: str
    discount_percent: int  # e.g., 15
    commission_percent: int  # e.g., 20
    trailing_duration_years: int  # e.g., 2
    status: str  # 'active', 'paused', 'terminated'
    created_at: datetime

class AffiliateCommission:
    id: int
    affiliate_id: int
    transaction_id: int
    amount_aud: Decimal
    type: str  # 'initial', 'trailing'
    status: str  # 'pending', 'paid'
    created_at: datetime
```

---

### 5. Weather API Abstraction Layer

**New File:** `services/weather_intl.py`

**Pattern: Strategy per Country**

```python
class WeatherProvider(Protocol):
    async def get_forecast(self, lat: float, lon: float, hours: int) -> Forecast:
        ...

class USWeatherProvider(WeatherProvider):
    """NOAA/NWS API for USA"""

class UKWeatherProvider(WeatherProvider):
    """Met Office API for UK"""

class OpenMeteoProvider(WeatherProvider):
    """Fallback for all countries"""

COUNTRY_PROVIDERS = {
    "US": [USWeatherProvider(), OpenMeteoProvider()],
    "UK": [UKWeatherProvider(), OpenMeteoProvider()],
    "AU": [BOMService(), OpenMeteoProvider()],
    "NZ": [OpenMeteoProvider()],  # No dedicated API
    # etc.
}

async def get_forecast(lat: float, lon: float, country: str) -> Forecast:
    """Try providers in order, fall back on failure."""
    for provider in COUNTRY_PROVIDERS.get(country, [OpenMeteoProvider()]):
        try:
            return await provider.get_forecast(lat, lon)
        except Exception:
            continue
    raise WeatherAPIError("All providers failed")
```

---

### 6. Account System

**New Files:**
- `services/accounts.py` - Account management
- `routes/auth.py` - Authentication endpoints

**Simple Email-Based Accounts:**
```python
class Account:
    id: int
    email: str
    password_hash: str  # bcrypt
    stripe_customer_id: Optional[str]
    created_at: datetime

# Session: JWT stored in httpOnly cookie
# No OAuth complexity for v1
```

**Account Links User Phone:**
```python
class AccountPhone:
    account_id: int
    phone: str  # Can have multiple phones per account
    verified: bool
    added_at: datetime
```

---

## Database Schema Additions

### New Tables Summary

```sql
-- User accounts (optional, for saving routes)
CREATE TABLE accounts (
    id INTEGER PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    stripe_customer_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Link accounts to phone numbers
CREATE TABLE account_phones (
    account_id INTEGER REFERENCES accounts(id),
    phone TEXT PRIMARY KEY,
    verified INTEGER DEFAULT 0,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User-created routes
CREATE TABLE custom_routes (
    id INTEGER PRIMARY KEY,
    account_id INTEGER REFERENCES accounts(id),
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    track_geojson TEXT,  -- Simplified GeoJSON
    status TEXT DEFAULT 'draft',  -- draft, paid, active, expired
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP
);

-- Waypoints for custom routes
CREATE TABLE custom_waypoints (
    id INTEGER PRIMARY KEY,
    route_id INTEGER REFERENCES custom_routes(id),
    code TEXT NOT NULL,  -- SMS code, e.g., "LAKEO"
    name TEXT NOT NULL,  -- "Lake Oberon"
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    elevation INTEGER,
    type TEXT NOT NULL,  -- camp, peak, poi
    weather_zone TEXT,  -- Calculated
    UNIQUE(route_id, code)
);

-- Payment transactions
CREATE TABLE transactions (
    id INTEGER PRIMARY KEY,
    user_phone TEXT,
    account_id INTEGER REFERENCES accounts(id),
    stripe_payment_intent_id TEXT UNIQUE,
    amount_aud REAL NOT NULL,
    type TEXT NOT NULL,  -- purchase, topup
    status TEXT DEFAULT 'pending',
    route_id INTEGER REFERENCES custom_routes(id),
    discount_code_id INTEGER REFERENCES discount_codes(id),
    affiliate_id INTEGER REFERENCES affiliates(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Discount codes
CREATE TABLE discount_codes (
    id INTEGER PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    discount_percent INTEGER NOT NULL,
    max_uses INTEGER,
    uses INTEGER DEFAULT 0,
    valid_from TIMESTAMP,
    valid_until TIMESTAMP,
    affiliate_id INTEGER REFERENCES affiliates(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Affiliates
CREATE TABLE affiliates (
    id INTEGER PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,  -- URL slug
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    discount_percent INTEGER NOT NULL,
    commission_percent INTEGER NOT NULL,
    trailing_duration_years INTEGER DEFAULT 2,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Affiliate commissions
CREATE TABLE affiliate_commissions (
    id INTEGER PRIMARY KEY,
    affiliate_id INTEGER REFERENCES affiliates(id),
    transaction_id INTEGER REFERENCES transactions(id),
    amount_aud REAL NOT NULL,
    type TEXT NOT NULL,  -- initial, trailing
    status TEXT DEFAULT 'pending',  -- pending, paid
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User balance (for top-up model)
CREATE TABLE user_balances (
    phone TEXT PRIMARY KEY,
    balance_aud REAL DEFAULT 0,
    last_topup_at TIMESTAMP,
    low_balance_warned INTEGER DEFAULT 0
);
```

---

## Integration Points with Existing Code

### 1. User Table Extension

Existing `users` table needs new columns:
```sql
ALTER TABLE users ADD COLUMN account_id INTEGER REFERENCES accounts(id);
ALTER TABLE users ADD COLUMN custom_route_id INTEGER REFERENCES custom_routes(id);
ALTER TABLE users ADD COLUMN balance_aud REAL DEFAULT 0;
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
```

### 2. SMS Service Enhancement

`services/sms.py` needs:
- Balance check before sending
- Low balance warning trigger
- Per-segment cost tracking by country

```python
async def send_message_with_balance_check(phone: str, body: str) -> SendResult:
    segments = count_segments(body)
    cost = get_segment_cost(country=get_user_country(phone)) * segments

    if get_user_balance(phone) < cost:
        # Trigger low balance flow
        await send_low_balance_warning(phone)
        return SendResult(error="Insufficient balance")

    result = await send_message(phone, body)
    if result.success:
        deduct_balance(phone, cost)
    return result
```

### 3. Command Parser Extension

`services/commands.py` needs new command:
```python
CommandType.BUY  # "BUY $10"

# Handler generates Stripe payment link
# Sends SMS: "Top up here: https://checkout.stripe.com/..."
```

### 4. Weather Service Abstraction

`services/bom.py` becomes base class, with `services/weather_intl.py` routing to correct provider based on route country.

---

## Build Order (Dependencies)

### Phase 1: Foundation (No Dependencies)
1. **Database migrations** - Add new tables
2. **Account system** - Basic email auth, no OAuth
3. **main.py refactor** - Split into route modules

### Phase 2: Payments (Depends on Phase 1)
4. **Stripe integration** - Checkout, webhooks
5. **Balance system** - Top-up, deduction, warnings
6. **Transaction logging** - Audit trail

### Phase 3: Route Creation (Depends on Phase 1)
7. **GPX parser** - Server-side validation
8. **Map editor** - Mapbox GL frontend
9. **Route storage** - Draft/paid/active states

### Phase 4: User Flows (Depends on 2 + 3)
10. **Phone simulator** - Preview component
11. **Checkout flow** - Both paths (buy now, create first)
12. **Route activation** - Link payment to route

### Phase 5: Affiliates (Depends on Phase 2)
13. **Affiliate model** - Admin CRUD
14. **Discount codes** - Stacking logic
15. **Commission tracking** - Initial + trailing

### Phase 6: International (Can Parallel with 4-5)
16. **Weather abstraction** - Provider interface
17. **US/UK providers** - First two countries
18. **Remaining providers** - Other 5 countries

---

## Anti-Patterns to Avoid

### 1. Stripe Key in Frontend
**Wrong:** Exposing secret key in Next.js client code
**Right:** All Stripe operations via FastAPI, only publishable key in frontend

### 2. Webhook Without Signature Verification
**Wrong:** Trusting webhook payload without verifying
**Right:** Always verify `stripe-signature` header with endpoint secret

### 3. Payment Before Route Complete
**Wrong:** Allowing payment for incomplete routes
**Right:** Validate route has minimum required waypoints before checkout

### 4. Synchronous Weather Calls
**Wrong:** Blocking on multiple weather API calls sequentially
**Right:** Use `asyncio.gather()` for parallel requests

### 5. Storing Full GPX Tracks
**Wrong:** Storing raw GPX (megabytes) in database
**Right:** Simplify to ~100 points, store as GeoJSON

### 6. Hardcoded Affiliate Rules
**Wrong:** Commission rates in code
**Right:** Configurable per affiliate in database

---

## Scalability Considerations

| Concern | Current (100 users) | At 1K users | At 10K users |
|---------|---------------------|-------------|--------------|
| Database | SQLite fine | SQLite fine | Consider PostgreSQL |
| Weather API | Sequential OK | Add caching | Redis cache + rate limiting |
| Map tiles | Mapbox free tier | Mapbox free tier | May need paid tier |
| SMS costs | ~$5/day | ~$50/day | ~$500/day, monitor closely |
| Stripe webhooks | Sync OK | Sync OK | Consider queue |

---

## Technology Recommendations

### Frontend (New Components)
- **Mapbox GL JS**: Best for interactive editing, free tier generous
- **@mapbox/mapbox-gl-draw**: Pin/line editing plugin
- **react-phone-simulator**: Custom component (no library needed)
- **gpxparser**: Client-side GPX parsing

### Backend (New Services)
- **stripe**: Official Python SDK
- **httpx**: Already used, for weather APIs
- **bcrypt**: Password hashing (via `passlib`)
- **python-jose**: JWT tokens for auth

### Database
- **SQLite**: Keep for now, migration path clear
- **Alembic**: Add for schema migrations (currently manual)

---

## Sources

- Existing codebase analysis (HIGH confidence)
- FastAPI documentation for patterns (HIGH confidence)
- Stripe Python SDK patterns (MEDIUM confidence - based on training data, verify current docs)
- Mapbox GL JS capabilities (MEDIUM confidence - verify current pricing/features)

---

## Roadmap Implications

**Recommended Phase Structure:**

1. **Phase 1: Foundation** - Refactor main.py, add migrations, account system
   - Low risk, enables all other phases
   - Estimate: 1-2 weeks

2. **Phase 2: Payments** - Stripe checkout, webhooks, balance
   - Medium risk (Stripe integration complexity)
   - Must complete before any paid features
   - Estimate: 2-3 weeks

3. **Phase 3: Route Creation** - GPX, map editor, waypoint management
   - Medium risk (map integration, UX complexity)
   - Can parallel with Phase 2
   - Estimate: 2-3 weeks

4. **Phase 4: User Flows** - Simulator, conversion paths, activation
   - Low risk (mostly frontend, integration)
   - Depends on Phases 2 + 3
   - Estimate: 1-2 weeks

5. **Phase 5: Affiliates** - Admin console, tracking, commissions
   - Low risk (standard CRUD)
   - Depends on Phase 2
   - Estimate: 1 week

6. **Phase 6: International Weather** - API integrations per country
   - HIGH risk (external API dependencies, research needed)
   - Can parallel with Phases 4-5
   - Estimate: 2-4 weeks (needs deeper research per API)

**Critical Path:** Phase 1 -> Phase 2 -> Phase 4 (minimum for MVP)

**Parallel Tracks:**
- Track A: Phases 1 -> 2 -> 4 -> 5 (payments + affiliates)
- Track B: Phases 1 -> 3 -> 4 (route creation)
- Track C: Phase 6 (international, independent research)
