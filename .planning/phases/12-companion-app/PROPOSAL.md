# Phase 12: Thunderbird Trail Weather — Companion App

## Executive Summary

Thunderbird Trail Weather is a satellite-optimised weather forecasting app for backcountry hikers. It delivers hyper-local, trail-specific weather forecasts requiring no dedicated hardware beyond the user's smartphone. The app enables hikers to drop multiple pins along a trail and view changing conditions across their route in a single UI — a capability no existing product offers.

The app operates in two modes:
1. **Data mode** (Starlink Direct-to-Cell): Automatic JSON forecast retrieval when satellite data is available
2. **SMS mode** (universal fallback): One-tap coordinate copy/paste for use with Thunderbird's existing SMS pull command — works today on any carrier with satellite SMS, including Telstra

This dual-mode approach means the app delivers value immediately on SMS-only networks, and automatically upgrades to the richer data experience as carriers enable satellite app data.

**Pricing**:
- **$19.99 USD one-time purchase, lifetime access** — purchased via thunderbird.bot website (avoids Apple/Google 30% commission)
- Account created on website → app download link emailed to user
- Free for PCT thru-hikers (verified via permit number)

**Purchase flow**:
1. User visits thunderbird.bot → creates account → pays $19.99
2. Receives email with app download link (iOS/Android)
3. Logs into app with account credentials
4. Full access to offline maps, satellite data mode, and SMS coordinate export

This keeps 100% of revenue vs losing $6 per sale to app store fees. The app itself is free to download from App Store / Play Store but requires a thunderbird.bot account to activate.

**Target launch**: US market first (PCT corridor), expanding to Australia when Telstra enables satellite data. SMS mode functional globally from day one.

---

## The Opportunity

### Market Gap

| Product | Hardware | Subscription | Weather Quality | Trail-Aware | Works Today (SMS) |
|---------|----------|-------------|----------------|-------------|-------------------|
| Garmin inReach | $300-450 device | $15-65/month | Basic text forecast | No | N/A (own network) |
| AccuWeather (T-Satellite) | None | Free app | General purpose | No | No (data only) |
| Apple Weather | None | Free | General purpose | No | No (data only) |
| **Thunderbird** | **None** | **$19.99 one-time** | **Grid-resolution, multi-point** | **Yes** | **Yes** |

No existing product lets a hiker see forecast conditions at multiple points along their route simultaneously, scrub through time, and make go/no-go decisions based on how weather evolves across elevation and terrain.

### Satellite Ecosystem Status

- **T-Mobile (US)**: Satellite app data live since October 2025. Open developer process — no certification required. Email SatelliteApps@T-Mobile.com for listing. ~650+ Starlink Direct-to-Cell satellites.
- **Telstra (Australia)**: SMS only as of June 2025. Data expected mid-to-late 2026 based on T-Mobile's trajectory.
- **Developer requirements**: Android SDK 35+ with satellite manifest tag. iOS 26+ with ultra-constrained network entitlement. Standard HTTPS works over satellite.

---

## Delivery Phases

### Phase 12A: Proof of Concept (POC) — Web-Based

**Objective**: Build a rapid, iterable POC that validates the core UX concept using existing Thunderbird web infrastructure. This is NOT the production app — it is a design and experience testbed.

**Approach**: Fork or extend the existing thunderbird.bot web mapping/pin system to create a browser-based prototype that demonstrates:

1. **Offline map display** — PCT trail corridor rendered with the GPX track overlaid
2. **Weather grid overlay** — Visual mesh showing US weather model resolution cells (GFS at ~13km, HRRR at 3km for CONUS)
3. **Multi-pin drop** — User taps to place multiple pins along the trail
4. **Pin snap-to-grid** — Dropped pins snap to the nearest weather grid cell center
5. **Forecast retrieval (data mode)** — Each pin triggers a JSON request to a weather API (NOAA/NWS or Open-Meteo for POC)
6. **SMS coordinate export (SMS mode)** — One-tap copy of pin coordinates formatted for the Thunderbird SMS pull command
7. **Multi-pin forecast display** — All pin forecasts visible simultaneously with a shared time-scrubber
8. **Color-coded severity** — Pins change colour (green/amber/red) based on conditions at the selected time

#### SMS Mode Detail

The SMS fallback makes Thunderbird useful on day one, before any carrier enables satellite data:

```
User flow (SMS mode):
1. Open app → Map with trail and pins (works offline)
2. Drop pin on location of interest
3. Tap pin → "Get Forecast" button shows two options:
   a. "Auto" (greyed out if no data connection) — JSON request
   b. "Copy for SMS" — copies coordinates to clipboard
4. User opens SMS app, pastes coordinates, sends to Thunderbird number
5. Thunderbird SMS service replies with text forecast
6. User returns to app — forecast is visible alongside their pinned location

Coordinate format copied to clipboard:
"WX -42.753 146.012"

Multi-pin SMS export:
"WX -42.753 146.012 -42.748 146.019 -42.741 146.025"
```

#### POC Tech Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Runtime | Web (browser-based) | Fastest iteration, no app store, hot reload |
| Map | MapLibre GL JS + PMTiles | Offline-capable vector tiles, free, open source |
| Trail data | PCT GPX file (already in Thunderbird Web) | Existing asset |
| Grid overlay | GeoJSON or canvas overlay | Lightweight rendering of weather model grid |
| Weather API | Open-Meteo (free, no key) or NOAA/NWS API | JSON forecast by lat/lon, no cost during POC |
| Backend | Minimal — direct API calls or thin proxy | Keep it simple, validate UX first |
| Hosting | Existing thunderbird.bot infrastructure | No new infra for POC |

#### POC User Flow

```
DATA MODE (satellite data available):
1. Open app → Map loads with PCT trail visible
2. Weather grid mesh is subtly overlaid (toggleable)
3. Tap trail → Pin drops, snaps to nearest grid cell
4. Tap again → Second pin drops (up to 5-8 pins)
5. Bottom sheet shows forecast cards for ALL pins
6. Time scrubber at bottom → Slide from now to +72hrs
7. Pin colours update in real-time as time scrubs
8. Each forecast card shows: temp, wind/gusts, rain %, precip mm, condition icon
9. Red/amber/green risk indicator per pin based on thresholds

SMS MODE (no data connection / SMS-only satellite):
1. Open app → Map loads offline with PCT trail visible
2. Tap trail → Pin drops, snaps to nearest grid cell
3. Tap additional pins as needed
4. Tap "Get Forecast" → sees "Copy for SMS" option
5. Coordinates copied to clipboard (single or multi-pin)
6. Switch to SMS app → Paste → Send to Thunderbird number
7. Receive text forecast reply
8. Return to app → Pin locations still visible for reference

WEB MODE (thunderbird.bot — no install required):
1. Open thunderbird.bot in mobile browser
2. Same map UI, same pin system, same grid overlay
3. Same SMS coordinate export flow
4. Data mode forecast retrieval also available when on WiFi/cellular
5. No app store fees — free access tier
```

#### POC Key Metrics to Validate

- **Comprehension**: Do testers understand the grid and multi-pin concept without explanation?
- **Decision quality**: Can testers articulate a go/no-go decision from the UI?
- **Payload size**: Measure actual JSON request/response sizes for satellite feasibility
- **Latency tolerance**: Simulate satellite delay (2-10 seconds) — is the UX still usable?
- **Grid resolution**: Is GFS (13km) too coarse? Is HRRR (3km) necessary for mountain terrain?
- **SMS flow friction**: How many seconds from pin drop to SMS sent? Target under 15 seconds
- **Multi-pin SMS usability**: Is the coordinate string format easy to paste and send?
- **Web vs native parity**: Does the browser-based experience feel sufficient, or do users need native offline maps?

#### POC Deliverables

1. Working web prototype accessible via browser
2. Multi-pin weather comparison UI
3. Measured JSON payload sizes per request
4. UX test findings from 5-10 PCT/hiking community testers
5. Documented decisions on grid resolution, forecast parameters, and risk thresholds

#### POC Timeline

- **Weeks 1-2**: Map + grid overlay + PCT GPX rendering
- **Weeks 3-4**: Pin drop + weather API integration + forecast cards
- **Weeks 5-6**: Time scrubber + severity colouring + simulated satellite latency testing
- **Weeks 7-8**: UX testing with hikers, iterate, document findings

---

### Phase 12B: Production Architecture Decision

#### The Question: Flutter vs React Native

After the POC validates the UX, the production app needs a cross-platform framework that supports offline maps, minimal app size, satellite-constrained networking, and a single codebase for iOS and Android.

#### Flutter (Dart)

**Pros:**
- Compiles to native ARM — no JavaScript bridge overhead
- Minimum app size ~6-8 MB stripped
- MapLibre Native has an actively maintained Flutter plugin (flutter-maplibre-gl)
- Excellent offline SQLite support via sqflite
- Strong typed language reduces runtime errors
- Hot reload for rapid development
- Growing ecosystem, well-suited for custom UI (forecast cards, time scrubber)
- Platform channels allow clean access to native satellite network APIs on both iOS and Android

**Cons:**
- Dart is less common — smaller hiring pool if team scales
- MapLibre Flutter plugin is less mature than the React Native equivalent
- Slightly larger learning curve if team is JavaScript-native

**Satellite integration approach:**
- Android: Platform channel to set `android.telephony.PROPERTY_SATELLITE_DATA_OPTIMIZED` manifest tag and detect `NET_CAPABILITY_NOT_BANDWIDTH_CONSTRAINED`
- iOS: Platform channel to configure ultra-constrained network entitlement and app category

#### React Native (TypeScript)

**Pros:**
- Huge developer ecosystem — easy to hire
- JavaScript/TypeScript is widely known
- MapLibre React Native plugin exists (@maplibre/maplibre-react-native)
- Extensive package ecosystem for HTTP, SQLite, GPS
- POC web code (if built with React) may share some logic/components
- Expo framework simplifies build and deployment

**Cons:**
- JS bridge adds overhead — heavier runtime, ~8-12 MB minimum app size
- Bridge creates latency for map interactions (panning, zooming, pin interactions)
- Less control over fine-grained UI rendering for custom forecast visualisations
- Background task handling on iOS is more complex through the bridge
- Hermes engine helps but doesn't eliminate the bridge overhead

**Satellite integration approach:**
- Native modules required for both platforms to access satellite network detection
- React Native's bridge adds a layer between JS and native satellite APIs

#### Kotlin Multiplatform (KMP)

**Pros:**
- Shared Kotlin business logic compiles to native on both platforms
- Smallest possible binary (~4-6 MB)
- Direct access to platform satellite APIs without bridges
- Kotlin is modern, well-supported, and growing rapidly

**Cons:**
- UI is NOT shared — you write SwiftUI for iOS, Jetpack Compose for Android
- Not truly single codebase for the full app
- MapLibre Native support for KMP is minimal/non-existent
- Smallest ecosystem of the three options
- Two UI codebases means double the work for the visual layer (which is most of this app)

#### Recommendation: Flutter

For Thunderbird specifically, Flutter is the strongest choice:

1. **App size**: 6-8 MB meets the lightweight requirement
2. **Offline maps**: MapLibre GL Native Flutter plugin handles PMTiles vector tiles
3. **Custom UI**: The multi-pin forecast cards, time scrubber, and grid overlay are highly custom — Flutter's rendering engine gives full control
4. **Single codebase**: Truly one codebase for both platforms, including UI
5. **Satellite networking**: Platform channels provide clean access to native APIs without the overhead of a JS bridge
6. **Performance**: Native ARM compilation means smooth map interactions even on constrained devices

#### Alternative consideration: Web-first PWA

If the POC web prototype works exceptionally well, there is an argument for shipping as a Progressive Web App initially:
- Zero install size (runs in browser)
- Instant updates without app store review
- Works on both platforms immediately
- MapLibre GL JS is the most mature mapping library

However, PWAs have limitations with background GPS, satellite network detection, and offline reliability that likely make a native app necessary for the production version. The POC will help validate whether a PWA could work as an interim launch vehicle.

---

### Phase 12C: Production Build

#### Production Tech Stack (Flutter)

| Component | Library/Tool | Purpose |
|-----------|-------------|---------|
| Framework | Flutter | Cross-platform app shell |
| Map rendering | flutter-maplibre-gl | Offline vector map display |
| Offline tiles | PMTiles extracts per trail region | Pre-downloaded map data |
| Offline DB | sqflite | Weather grid lookup + forecast cache |
| HTTP client | dio | JSON requests with retry/timeout for satellite |
| GPS | geolocator | Device position |
| State management | Riverpod or Bloc | App state, pin management, forecast data |
| Satellite detection | Platform channels | Native Android/iOS satellite network APIs |
| Serialisation | MessagePack (msgpack_dart) | Compressed payloads over satellite |

#### Satellite JSON Protocol

**Request** (~50-150 bytes depending on pin count):
```json
{
  "pins": [
    {"lat": 46.853, "lon": -121.757},
    {"lat": 46.849, "lon": -121.742},
    {"lat": 46.841, "lon": -121.731}
  ],
  "h": 72
}
```

**Response** (~200-500 bytes per pin, MessagePack compressed):
```json
{
  "pins": [
    {
      "n": "White Pass - PCT Mile 2295",
      "el": 1350,
      "f": [
        {"t": 0, "tmp": 8, "wc": 3, "w": 25, "g": 45, "r": 85, "p": 2.4, "v": 2, "c": "rain"},
        {"t": 6, "tmp": 6, "wc": -1, "w": 30, "g": 55, "r": 90, "p": 4.1, "v": 1, "c": "storm"}
      ],
      "sev": "red",
      "a": ["wind warning", "hypothermia risk"]
    }
  ]
}
```

**Field key:**
- `t`: hours from now
- `tmp`: temperature C
- `wc`: wind chill C
- `w`: wind speed km/h
- `g`: gust speed km/h
- `r`: rain probability %
- `p`: precipitation mm
- `v`: visibility km
- `c`: condition code
- `sev`: severity (green/amber/red)
- `a`: active alerts

#### Risk/Severity Thresholds (configurable)

| Level | Wind | Wind Chill | Rain Prob | Visibility |
|-------|------|-----------|-----------|------------|
| Green | <30 km/h | >5C | <40% | >5 km |
| Amber | 30-50 km/h | 0-5C | 40-70% | 1-5 km |
| Red | >50 km/h | <0C | >70% + >5mm | <1 km |

#### Backend Architecture

```
DATA MODE:
[Hiker's Phone]
    -> Satellite (Starlink Direct-to-Cell)
    -> T-Mobile / Telstra ground station
    -> Internet
    -> Thunderbird API (Cloudflare Workers or AWS Lambda)
        -> Weather data source (NOAA/NWS, Open-Meteo, BOM ACCESS)
        -> Response assembled, compressed
    -> Back through satellite to phone
    -> Rendered on map against pins

SMS MODE:
[Hiker's Phone — Thunderbird App]
    -> User drops pins on offline map
    -> Copies formatted coordinates to clipboard
    -> Switches to SMS app
    -> Pastes "WX lat lon lat lon..."
    -> Sends via satellite SMS (Telstra/T-Mobile)
    -> Thunderbird SMS gateway receives
    -> Same weather API lookup
    -> Text forecast reply sent back via SMS
    -> User reads SMS, references against app map

WEB MODE (thunderbird.bot — no install required):
[Any Device with Browser]
    -> thunderbird.bot loads map UI
    -> Same pin/grid/export functionality
    -> Data mode works when on WiFi/cellular
    -> SMS coordinate export works always
    -> No app store fees — free tier
    -> Drives discovery -> conversion to paid native app
```

#### Distribution Strategy

| Channel | Role | App Store Fee |
|---------|------|---------------|
| thunderbird.bot (website) | Purchase + account creation ($19.99) | **None — 100% revenue retained** |
| iOS App (App Store) | Free download, login required | None (free app, auth-gated) |
| Android App (Play Store) | Free download, login required | None (free app, auth-gated) |

**How it works**:
- App is listed as **free** on both app stores — no in-app purchase, no subscription
- All functionality is gated behind a thunderbird.bot account login
- Accounts are only created on thunderbird.bot where payment is processed directly (Stripe)
- User pays $19.99 on website → creates account → receives email with app download links → logs into app
- Apple/Google see a free app with external authentication — no commission applies
- PCT hikers enter permit number instead of payment → free account created

This is the same model used by apps like Netflix, Spotify, and Kindle — free app shell, account required, purchase happens outside the app store ecosystem.

**Note on App Store compliance**: Apple's external purchase rules (post-2024 EU DMA and US settlements) allow apps to direct users to external websites for account creation and purchase, provided the app doesn't block functionality for users who haven't paid — it simply requires login. The app should clearly state "Account required — create at thunderbird.bot" rather than attempting to sell within the app.

#### Offline Weather Grid Database

Pre-built SQLite database shipped with the app, containing:
- Grid cell definitions (lat/lon bounds, center point, cell ID)
- Mapping of cells to weather model zones
- Trail segment metadata (PCT mile markers, elevation, exposure rating)
- Nearest shelter/bail-out point per cell

**Size estimate**: ~1-2 MB for PCT corridor at HRRR 3km resolution.

---

### Phase 12D: Market Expansion

#### US Launch
- Purchase at thunderbird.bot → $19.99 → account created → app download link emailed
- PCT hikers: Free account (permit verification) → same app download flow
- SMS mode: Functional immediately on T-Mobile satellite SMS (no data tier required)
- Data mode: Functional on T-Mobile T-Satellite data tier
- Supported trails: PCT, then AT, CDT, JMT, Wonderland Trail
- Email SatelliteApps@T-Mobile.com for T-Satellite listing

#### Australia Launch (when Telstra enables satellite data)
- Same purchase flow via thunderbird.bot → $19.99 AUD
- SMS mode: Functional immediately on Telstra satellite SMS (available now)
- Data mode: Enabled when Telstra activates satellite app data (expected mid-late 2026)
- Trails: Overland Track, Larapinta Trail, Bibbulmun Track, Western Arthurs Traverse, Great Ocean Walk
- Weather source: BOM ACCESS model (1.5km resolution — significantly better than US GFS)

#### B2B Revenue Stream
- Parks services (Parks Tasmania, NPS) — embedded weather alerts in permit systems
- Guided tour operators — real-time trail condition monitoring
- Travel insurance — risk assessment data feed
- Search & rescue — multi-point weather intelligence for operations planning

---

## Web App as Fee-Free Channel

The thunderbird.bot website maintains feature parity with the native app:
- Same mapping UI, same multi-pin system, same grid overlay
- Same SMS coordinate export functionality
- Accessible via any mobile browser — no app store purchase required
- Avoids Apple (30%) and Google (30%) commission on the $19.99 price
- Serves as the free/discovery tier that drives users to the paid native app for offline maps and auto-forecast via satellite data
- Can be bookmarked as a PWA for home-screen access

---

## Open Questions

1. **Weather data source**: NOAA/NWS (free but US only) vs Open-Meteo (free, global) vs commercial API? Cost implications for ongoing operations at $19.99 one-time pricing.
2. **Grid resolution trade-off**: HRRR 3km is ideal but US-only. GFS 13km is global but coarse for mountain terrain. Do we need both?
3. **Forecast cache TTL**: How long before a cached forecast should be refreshed? 2 hours? 4 hours? Impacts satellite bandwidth usage.
4. **PCT free tier abuse**: Is permit number verification sufficient, or do we need additional validation?
5. **Offline forecast mode**: Should the app provide basic barometric trend analysis from phone sensors when satellite is completely unavailable?
6. **International expansion**: Which Starlink carrier partners (Rogers Canada, One NZ, KDDI Japan) are likely to enable app data next?
7. **SMS response parsing**: Can the app automatically parse an incoming Thunderbird SMS forecast and display it against the pinned location, or is manual reference sufficient for MVP?
8. **App Store compliance**: Confirm Apple/Google policies on free app + external account purchase model. Review reader app exemptions and recent DMA/settlement changes.
9. **SMS multi-pin limits**: What's the maximum number of coordinate pairs that fit reliably in a single SMS (160 chars)? Likely 3-4 pins — is that enough?
10. **Account system**: Lightweight auth for the app — JWT token from thunderbird.bot login? Needs to work offline after initial activation.

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| MapTiler/tile provider free tier exhausted | Users can't download tiles | Monitor usage; switch to self-hosted if needed |
| Flutter + MapLibre compatibility breaks | Build failures | Pin dependency versions; bare workflow as fallback |
| Offline tile storage fills phone | Users complain about storage | Show size estimates; allow selective region delete |
| App Store review rejection | Can't distribute | Free app with external auth — established pattern (Netflix, Kindle) |
| Users expect forecast in app before satellite data available | Disappointment | Clear messaging: SMS mode works today, data mode coming |
| T-Mobile satellite data pricing changes | Cost model breaks | SMS fallback always available; monitor carrier terms |
| Apple changes external purchase rules | Revenue model threatened | Monitor DMA/settlement developments; IAP fallback plan |
| Weather API costs at scale with one-time pricing | Unsustainable unit economics | Open-Meteo (free), NOAA (free); commercial only if needed |

---

## Success Criteria

1. User can drop multiple pins on an offline topo map and view forecasts simultaneously
2. Time scrubber shows weather evolution across all pins from now to +72 hours
3. Color-coded severity (green/amber/red) enables go/no-go decisions at a glance
4. SMS coordinate export works in under 15 seconds from pin drop to SMS sent
5. Trail regions download on WiFi and work fully offline
6. Satellite JSON request/response completes in under 30 seconds on Starlink Direct-to-Cell
7. App install size <10MB (before offline tile downloads)
8. Works on iOS 16+ and Android 10+
9. $19.99 purchase via thunderbird.bot retains 100% revenue (no app store commission)
