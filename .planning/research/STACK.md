# Technology Stack

**Project:** Thunderbird Global
**Researched:** 2026-01-19
**Research Mode:** Ecosystem survey for global hiking weather SMS platform expansion
**Overall Confidence:** MEDIUM (external tool access unavailable - recommendations based on training data, versions need verification)

## Executive Summary

Expanding Thunderbird from Tasmania-only (BOM API) to 8 countries requires:
1. **Weather APIs**: Per-country national services where available, Open-Meteo as universal fallback
2. **GPX Parsing**: `@tmcw/togeojson` (browser) + Python `gpxpy` (backend validation)
3. **Interactive Maps**: MapLibre GL JS with `react-map-gl` wrapper (free, no API key required for basic tiles)
4. **Payments**: Stripe Checkout + Stripe Billing for subscriptions
5. **Affiliate Tracking**: Custom implementation with Stripe webhooks (no good off-the-shelf for trailing commissions)

---

## Existing Stack (Confirmed from codebase)

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 14.1.0 | Frontend framework |
| React | ^18 | UI library |
| FastAPI | >=0.109.0 | Backend API |
| SQLAlchemy | >=2.0.25 | ORM |
| Tailwind CSS | ^3.4.1 | Styling |
| Twilio | >=8.10.0 | SMS delivery |
| httpx | >=0.26.0 | Async HTTP client |
| Open-Meteo | - | Weather fallback (already integrated) |

---

## Recommended Additions

### 1. GPX Parsing

**Confidence: HIGH** (well-established libraries, stable ecosystem)

#### Frontend: @tmcw/togeojson

| Attribute | Value |
|-----------|-------|
| Package | `@tmcw/togeojson` |
| Version | `^5.8.0` (verify on npm) |
| Purpose | Parse GPX files to GeoJSON in browser |
| Why | Lightweight, well-maintained by Tom MacWright (Mapbox alum), returns GeoJSON which integrates directly with map libraries |

**Usage:**
```typescript
import { gpx } from '@tmcw/togeojson';

const gpxText = await file.text();
const dom = new DOMParser().parseFromString(gpxText, 'text/xml');
const geojson = gpx(dom);
// geojson.features contains LineString for track, Point for waypoints
```

**Why not gpxparser:** Less maintained, doesn't output GeoJSON natively.

#### Backend: gpxpy (Python)

| Attribute | Value |
|-----------|-------|
| Package | `gpxpy` |
| Version | `>=1.6.0` (verify on PyPI) |
| Purpose | Server-side GPX validation and processing |
| Why | Standard Python GPX library, extracts elevation profiles, calculates distances |

**Usage:**
```python
import gpxpy

gpx = gpxpy.parse(gpx_file)
for track in gpx.tracks:
    for segment in track.segments:
        for point in segment.points:
            # point.latitude, point.longitude, point.elevation
```

**Alternative considered:** `lxml` direct XML parsing - rejected because gpxpy handles GPX schema variations gracefully.

---

### 2. Interactive Maps with Pin Editing

**Confidence: HIGH** (MapLibre is mature, react-map-gl is widely used)

#### Core: MapLibre GL JS + react-map-gl

| Attribute | Value |
|-----------|-------|
| Packages | `maplibre-gl`, `react-map-gl` |
| Versions | `^4.0.0`, `^7.1.0` (verify - may have newer) |
| Purpose | Interactive map with custom markers |
| Why | MapLibre is free/open-source fork of Mapbox GL JS, no API key required for basic functionality |

**Why MapLibre over alternatives:**

| Alternative | Why Not |
|-------------|---------|
| Mapbox GL JS | Requires API key, usage-based pricing, can get expensive |
| Leaflet | Less smooth/performant for dense data, dated feel |
| Google Maps | Expensive, limited customization, heavy SDK |
| OpenLayers | Steeper learning curve, overkill for this use case |

**Tile Sources (FREE):**
- **OpenStreetMap**: General worldwide coverage
- **OpenTopoMap**: Topographic - ideal for hiking (https://opentopomap.org)
- **Stamen Terrain**: Good terrain visualization (now hosted by Stadia Maps)

**Implementation approach:**
```typescript
import Map, { Marker, Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

<Map
  mapStyle="https://tiles.openfreemap.org/styles/liberty"
  // or use OpenTopoMap tiles
>
  {/* GPX track as GeoJSON */}
  <Source type="geojson" data={gpxGeoJson}>
    <Layer type="line" paint={{ 'line-color': '#ff6b35', 'line-width': 3 }} />
  </Source>

  {/* Editable markers for camps/peaks */}
  {waypoints.map(wp => (
    <Marker
      key={wp.id}
      longitude={wp.lon}
      latitude={wp.lat}
      draggable
      onDragEnd={(e) => updateWaypoint(wp.id, e.lngLat)}
    />
  ))}
</Map>
```

#### Drawing/Editing: mapbox-gl-draw (MapLibre compatible)

| Attribute | Value |
|-----------|-------|
| Package | `@mapbox/mapbox-gl-draw` |
| Version | `^1.4.0` |
| Purpose | Draw points, lines, polygons on map |
| Why | Works with MapLibre, enables pin placement mode |

**Note:** For simple pin placement, native Marker with `draggable` is sufficient. Only add mapbox-gl-draw if users need to draw routes/polygons.

---

### 3. Payments: Stripe

**Confidence: HIGH** (Stripe is industry standard, well-documented)

#### Stack: Stripe Checkout + Stripe Billing

| Package | Version | Purpose |
|---------|---------|---------|
| `stripe` (Python) | `>=7.0.0` | Backend Stripe SDK |
| `@stripe/stripe-js` | `^2.0.0` | Frontend Stripe.js loader |
| `@stripe/react-stripe-js` | `^2.0.0` | React components (optional) |

**Why Stripe over alternatives:**

| Alternative | Why Not |
|-------------|---------|
| PayPal | Worse developer experience, higher fees in some regions |
| Square | Less global coverage |
| Paddle | Good for SaaS but adds complexity |
| LemonSqueezy | Newer, less battle-tested |

**Architecture for $29.99 one-time payment:**

```
User clicks "Purchase"
  -> Frontend calls /api/checkout/create-session
  -> Backend creates Stripe Checkout Session
  -> User redirected to Stripe hosted checkout
  -> Stripe webhook fires on success
  -> Backend activates subscription, stores customer_id
```

**Webhook events to handle:**
- `checkout.session.completed` - Payment successful
- `customer.subscription.deleted` - Subscription cancelled (if adding subscriptions later)
- `invoice.payment_failed` - Failed recurring payment

**For affiliate commissions:** Stripe Connect in "destination charges" mode allows splitting payments at transaction time.

---

### 4. Affiliate Tracking with Trailing Commissions

**Confidence: MEDIUM** (no perfect off-the-shelf solution, custom build recommended)

#### Recommendation: Custom Implementation

**Why custom over existing solutions:**

| Solution | Issue |
|----------|-------|
| Rewardful | Monthly fee, may be overkill |
| FirstPromoter | Similar - recurring SaaS cost |
| Refersion | Enterprise pricing |
| Post Affiliate Pro | Self-hosted complexity |

For a $29.99 product with trailing commissions, the affiliate volume likely doesn't justify a monthly SaaS fee. Build custom with:

**Database schema:**
```sql
-- Affiliates
CREATE TABLE affiliates (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  code VARCHAR(20) UNIQUE,  -- e.g., "HIKERJOHN"
  commission_rate DECIMAL(3,2) DEFAULT 0.20,  -- 20%
  trailing_months INTEGER DEFAULT 12,
  created_at TIMESTAMP
);

-- Referrals (links affiliate to customer)
CREATE TABLE referrals (
  id UUID PRIMARY KEY,
  affiliate_id UUID REFERENCES affiliates(id),
  customer_id UUID REFERENCES users(id),
  first_purchase_at TIMESTAMP,
  expires_at TIMESTAMP,  -- first_purchase_at + trailing_months
  UNIQUE(customer_id)  -- Customer can only have one affiliate
);

-- Commissions (tracks each payout)
CREATE TABLE commissions (
  id UUID PRIMARY KEY,
  affiliate_id UUID REFERENCES affiliates(id),
  referral_id UUID REFERENCES referrals(id),
  order_id UUID,
  amount DECIMAL(10,2),
  status VARCHAR(20),  -- pending, paid, cancelled
  created_at TIMESTAMP
);
```

**Flow:**
1. Visitor arrives with `?ref=HIKERJOHN`
2. Store affiliate code in cookie (30-day expiry)
3. On purchase, create referral record
4. Create commission record (20% of $29.99 = $5.99)
5. Monthly cron: pay out commissions via Stripe Transfer

**Trailing logic:** On each purchase, check if customer has active referral (expires_at > now). If yes, create commission for that affiliate.

---

### 5. Weather APIs by Country

**Confidence: MEDIUM** (API landscape changes, verify availability and current pricing)

#### Strategy: National APIs where available + Open-Meteo fallback

The existing codebase already uses Open-Meteo as a fallback - this is the right approach. Open-Meteo provides global coverage with hiking-relevant fields (freezing level, snowfall, cloud cover).

| Country | Primary API | Fallback | Notes |
|---------|-------------|----------|-------|
| **USA** | weather.gov (NWS) | Open-Meteo | Free, no key required, excellent coverage |
| **Canada** | weather.gc.ca (ECCC) | Open-Meteo | Free, XML format, good mountain coverage |
| **UK** | Met Office DataHub | Open-Meteo | Free tier available, requires registration |
| **France** | Meteo-France API | Open-Meteo | Free tier, requires registration |
| **Italy** | Open-Meteo | - | No good national API for public use |
| **Switzerland** | MeteoSwiss | Open-Meteo | Limited free tier, excellent mountain data |
| **New Zealand** | MetService | Open-Meteo | Limited API access, may need to scrape |
| **South Africa** | Open-Meteo | - | SAWS has limited API availability |

#### Detailed API Notes

**USA - National Weather Service (weather.gov)**
- **Endpoint**: `https://api.weather.gov/points/{lat},{lon}`
- **Auth**: None required
- **Rate limit**: Reasonable (no hard limit published, be respectful)
- **Resolution**: 2.5km grid, hourly forecasts
- **Fields**: Temperature, precipitation, wind, snow
- **Hiking-specific**: Excellent - includes elevation-specific forecasts

```python
# Example: Get forecast for a point
response = httpx.get(
    f"https://api.weather.gov/points/{lat},{lon}",
    headers={"User-Agent": "(thunderbird-weather.com, contact@thunderbird.com)"}
)
forecast_url = response.json()["properties"]["forecast"]
```

**Canada - Environment and Climate Change Canada**
- **Endpoint**: `https://dd.weather.gc.ca/`
- **Auth**: None required
- **Format**: XML (requires parsing)
- **Resolution**: Point forecasts for major locations, HRDPS model for 2.5km
- **Challenge**: Less straightforward API, may need to use HRDPS model data

**UK - Met Office DataHub**
- **Endpoint**: `https://data.hub.api.metoffice.gov.uk/`
- **Auth**: API key required (free tier available)
- **Resolution**: 2km grid
- **Fields**: Comprehensive including UV, visibility
- **Note**: Mountain weather forecasts specifically available for hiking areas

**France - Meteo-France**
- **Endpoint**: `https://public-api.meteofrance.fr/`
- **Auth**: API key required (free tier)
- **Resolution**: AROME model at 1.3km
- **Note**: Excellent for Alps hiking

**Switzerland - MeteoSwiss**
- **Endpoint**: `https://data.geo.admin.ch/` (Open Data)
- **Auth**: Varies
- **Resolution**: Excellent for Alps
- **Note**: Best mountain weather data but limited free access

**Open-Meteo (Universal Fallback)**
- **Already integrated** in existing codebase
- **Endpoint**: `https://api.open-meteo.com/v1/forecast`
- **Auth**: None required
- **Rate limit**: Generous (no key = fair use)
- **Resolution**: 1km for Europe, varies globally
- **Fields**: Includes freezing_level_height, snowfall, cloud_cover - exactly what hikers need
- **Recommendation**: Use as primary for Italy and South Africa, fallback for others

#### Implementation Architecture

```python
# weather_router.py
class WeatherRouter:
    """Route weather requests to appropriate API based on country."""

    def __init__(self):
        self.providers = {
            "US": NWSProvider(),
            "CA": ECCCProvider(),
            "GB": MetOfficeProvider(),
            "FR": MeteoFranceProvider(),
            "CH": MeteoSwissProvider(),
            "NZ": OpenMeteoProvider(),  # Fallback primary
            "ZA": OpenMeteoProvider(),  # Fallback primary
            "IT": OpenMeteoProvider(),  # Fallback primary
        }
        self.fallback = OpenMeteoProvider()

    async def get_forecast(self, lat: float, lon: float, country_code: str):
        provider = self.providers.get(country_code, self.fallback)
        try:
            return await provider.get_forecast(lat, lon)
        except ProviderError:
            return await self.fallback.get_forecast(lat, lon)
```

---

## What NOT to Use

| Technology | Why Avoid |
|------------|-----------|
| **Mapbox GL JS** | Requires API key, usage-based pricing adds unpredictable costs |
| **Google Maps Platform** | Expensive, heavy SDK, less customizable for outdoor/hiking |
| **Leaflet** | Performance issues with dense GPX tracks, dated UX |
| **Commercial affiliate platforms** | Overkill for product volume, recurring fees eat into margins |
| **gpxparser (npm)** | Less maintained than @tmcw/togeojson, doesn't output GeoJSON |
| **Commercial weather APIs (Tomorrow.io, etc.)** | Expensive at scale, national APIs are free |
| **PayPal** | Worse developer experience than Stripe |

---

## Installation

### Frontend (package.json additions)

```bash
npm install maplibre-gl react-map-gl @tmcw/togeojson @stripe/stripe-js
```

```json
{
  "dependencies": {
    "maplibre-gl": "^4.0.0",
    "react-map-gl": "^7.1.0",
    "@tmcw/togeojson": "^5.8.0",
    "@stripe/stripe-js": "^2.0.0"
  }
}
```

### Backend (requirements.txt additions)

```bash
# Add to existing requirements.txt
gpxpy>=1.6.0
stripe>=7.0.0
```

---

## Confidence Assessment

| Component | Confidence | Verification Needed |
|-----------|------------|---------------------|
| GPX parsing (@tmcw/togeojson) | HIGH | Verify current version on npm |
| GPX parsing (gpxpy) | HIGH | Verify current version on PyPI |
| MapLibre GL JS | HIGH | Verify v4 is current stable |
| react-map-gl | HIGH | Verify v7 is current stable |
| Stripe packages | HIGH | Verify latest versions |
| NWS API (USA) | HIGH | No changes expected |
| Met Office API (UK) | MEDIUM | Verify free tier limits |
| Meteo-France API | MEDIUM | Verify registration process |
| MeteoSwiss API | LOW | Access may be restricted |
| ECCC Canada API | MEDIUM | Verify current endpoint structure |
| MetService NZ | LOW | API availability uncertain |
| Affiliate custom build | HIGH | Standard patterns, no external deps |

---

## Roadmap Implications

1. **Phase 1: Map + GPX** - Lowest risk, well-established libraries
2. **Phase 2: Payments** - Stripe is straightforward, do before affiliates
3. **Phase 3: Affiliates** - Custom build, depends on payments working
4. **Phase 4: International Weather** - Highest complexity, test one country at a time
   - Start with USA (NWS is simplest, best documented)
   - Then UK (Met Office has good hiking forecasts)
   - Then others incrementally

---

## Sources

**Note:** WebSearch and WebFetch were unavailable during this research. Recommendations are based on training data (cutoff May 2025). All version numbers should be verified against current npm/PyPI before implementation.

**To verify:**
- https://www.npmjs.com/package/maplibre-gl
- https://www.npmjs.com/package/react-map-gl
- https://www.npmjs.com/package/@tmcw/togeojson
- https://pypi.org/project/gpxpy/
- https://pypi.org/project/stripe/
- https://www.weather.gov/documentation/services-web-api
- https://metoffice.apiconnect.ibmcloud.com/metoffice/production/
- https://open-meteo.com/en/docs
