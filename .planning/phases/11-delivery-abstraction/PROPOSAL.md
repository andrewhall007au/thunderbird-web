# Phase 11: JSON Forecast API (Satellite Data Ready)

## Context: Why Now

Satellite-to-phone data services are rolling out across all Thunderbird launch markets in 2026. This is not speculative — multiple carriers already deliver structured app data (including weather) over satellite to standard smartphones.

**Current state (Feb 2026):**

| Market | Carrier | Status | Data apps? |
|--------|---------|--------|------------|
| US | T-Mobile + Starlink | Live | AccuWeather, AllTrails, Google Maps |
| US | AT&T + AST SpaceMobile | Beta Q1 2026 | Full broadband (1-5 Mbps real) |
| Canada | Rogers + Starlink | Live | WhatsApp, Google Maps, AccuWeather |
| Canada | Bell + AST SpaceMobile | Late 2026 | Full broadband |
| New Zealand | One NZ + Starlink | Live | WhatsApp, AllTrails, AccuWeather, Plan My Walk |
| New Zealand | Spark | April 2026 | Data + WhatsApp calling |
| Australia | Telstra + Starlink | Live (SMS only) | Data coming 2026 |
| Australia | Vodafone + AST SpaceMobile | 2026 | Full broadband |
| UK | O2 + Starlink | Early 2026 | SMS + data |
| UK | Vodafone + AST SpaceMobile | 2026 | Voice, data, video |
| France | Orange + Skylo | Live | SMS (expanding) |
| Germany | Deutsche Telekom + Skylo | Live | SMS + IoT |

**AccuWeather is already delivering structured weather data over T-Mobile satellite.** This is our exact use case. Competitors are already there.

## Market Intelligence Summary

### Two Competing Satellite Approaches

**Starlink Direct to Cell (SpaceX)** — "Power through numbers"
- 650+ DTC satellites deployed, 15,000 V3 planned
- Current real speeds: ~3-4 Mbps shared per beam
- V3 satellites (H1 2026): 100x capacity increase
- Developer access: email SatelliteApps@T-Mobile.com for whitelisting
- Partners: T-Mobile, Rogers, Telstra, One NZ, O2

**AST SpaceMobile** — "Power through size"
- 6 satellites launched, 45-60 by end 2026
- "120 Mbps" claim is per-cell shared — real per-user: 1-5 Mbps
- Analyst skepticism: $5-9/GB, 20x terrestrial cost
- Partners: AT&T, Verizon, Bell, Vodafone, 2degrees

### Real-World Performance (What Users Actually Get)

| Metric | Starlink DTC (now) | AST SpaceMobile (2026) | Starlink V3 (H2 2026) |
|--------|-------------------|----------------------|---------------------|
| Per-beam throughput | 3-4 Mbps shared | ~20 Mbps shared | 10-20 Mbps projected |
| Per-user realistic | 100 Kbps - 2 Mbps | 1-5 Mbps | 5-20 Mbps |
| Latency | 20-50ms | 20-50ms | 20-50ms |
| Reliability | Spotty (beta) | Unknown | Improved |
| Our payload (5KB JSON) | < 1 second | < 1 second | Instant |

### Traffic Priority (SMS > Voice > Data)

No provider formally documents priority, but it's implicit:
1. Emergency 911/SOS (FCC mandated)
2. First responder (FirstNet explicitly preempts commercial)
3. SMS (smallest payload, most reliable)
4. Voice
5. Data apps (whitelisted, best effort)

**Key insight:** SMS remains the most reliable satellite channel. JSON-over-satellite is an additional interface to the same backend, not a replacement for SMS.

### Physics Constraints

- Phone transmits at ~200mW (vs Starlink dish at 50-100W)
- Signal travels 500+ km (vs 1-20km to cell tower)
- T-Mobile allocates only 5 MHz to satellite DTC
- A 5KB JSON forecast is ideal — tiny payload, burst transfer, completes fast even on worst connections

## Current Architecture (Source of Truth: Code)

**The system is pull-based.** Users request forecasts on-demand via CAST commands. There are no scheduled forecast pushes in practice — the core flow is:

```
User sends SMS: "CAST LAKEO"
    ↓
Twilio webhook: POST /webhook/sms/inbound
    ↓
CommandParser.parse() → CommandType.CAST
    ↓
generate_cast_forecast(camp_code, hours, phone)
    ↓
    ├── Find waypoint across all routes (lat/lon/elevation)
    ├── bom_service.get_hourly_forecast(lat, lon, hours)
    │   └── WeatherRouter → BOM/NWS/MetOffice/OpenMeteo (country-based)
    ├── FormatCastLabeled.format() → pipe-delimited SMS text
    └── Append low balance warning if needed
    ↓
Return formatted string as TwiML XML response (same HTTP request)
```

**Key commands:**
- `CAST LAKEO` / `CAST12 LAKEO` — 12hr hourly forecast for location
- `CAST24 LAKEO` — 24hr hourly forecast
- `CAST7 LAKEO` — 7-day forecast for location
- `CAST7 CAMPS` — 7-day for all camps on route
- `CAST7 PEAKS` — 7-day for all peaks on route
- `CAST -41.89,146.08` — forecast for GPS coordinates

**What's important:** The forecast generation logic (`generate_cast_forecast`, `generate_cast7_forecast`, etc.) is already cleanly separated from the SMS formatting. The functions take a location and return data. The formatting into pipe-delimited SMS happens at the end via `FormatCastLabeled.format()`.

**Also exists but secondary:**
- `main.py` has APScheduler for 6AM/6PM push jobs — but the pull-based CAST system is the primary interface
- `webhook.py` handles CHECKIN (check-in + auto-forecast), SAFE (SafeCheck contacts), BUY/TOPUP (payments), UNITS, etc.

## Goal

Add a JSON API that serves the same forecast data the SMS system already generates, formatted for app/satellite consumption instead of pipe-delimited SMS text. Both channels use the same forecast engine — the only difference is the response format.

## Proposed Architecture

Both channels are pull-based request/response. Same backend, two interfaces:

```
SMS Channel (current)                     JSON Channel (new)
─────────────────────                     ──────────────────
User texts "CAST LAKEO"                   App sends GET /api/v1/forecast?loc=LAKEO
    ↓                                         ↓
Twilio webhook                            JSON API endpoint
    ↓                                         ↓
generate_cast_forecast()        ← SAME →  generate_cast_forecast()
    ↓                                         ↓
FormatCastLabeled (pipe text)             JSON serialization
    ↓                                         ↓
TwiML XML response                        JSON HTTP response (<5KB)
```

### What Needs to Change

**Small refactor: Return structured data, format at the boundary.**

Currently `generate_cast_forecast()` returns a formatted string. Refactor to:
1. Extract the structured forecast data (temps, rain, wind, danger) into a data object
2. Keep SMS formatting where it is (webhook returns pipe text as before)
3. Add JSON endpoint that returns the same data as JSON

```python
# Before (current):
async def generate_cast_forecast(camp_code, hours, phone) -> str:
    ...
    message = FormatCastLabeled.format(forecast=forecast, ...)
    return message  # formatted SMS string

# After (refactored):
async def generate_cast_forecast_data(camp_code, hours, phone) -> ForecastResult:
    ...
    return ForecastResult(
        forecast=forecast,         # raw CellForecast data
        waypoint=waypoint,         # location info
        unit_system=unit_system,   # user preference
        low_balance_warning=warning
    )

# SMS path (unchanged behavior):
result = await generate_cast_forecast_data(camp_code, hours, phone)
message = FormatCastLabeled.format(forecast=result.forecast, ...)
return message + result.low_balance_warning

# JSON path (new):
result = await generate_cast_forecast_data(camp_code, hours, phone)
return ForecastJSONSerializer.serialize(result)  # <5KB compact JSON
```

### JSON Forecast Payload (Target: <5KB)

```json
{
  "v": 1,
  "loc": "LAKEO",
  "name": "Lake Oberon",
  "elev": 980,
  "units": "metric",
  "generated": "2026-02-08T06:00:00Z",
  "type": "cast12",
  "hours": [
    {"h": 6, "t": 4, "rp": 20, "rm": 2, "wa": 15, "wm": 25, "wd": "SW", "cd": 60, "cb": 8, "fl": 12, "d": 1},
    {"h": 7, "t": 5, "rp": 25, "rm": 3, "wa": 18, "wm": 30, "wd": "W", "cd": 70, "cb": 7, "fl": 12, "d": 2}
  ],
  "alerts": ["Strong wind warning above 900m from 2PM"]
}
```

**Key mappings** (same as SMS KEY command):
- `t` = temp, `rp` = rain probability %, `rm` = rain mm
- `wa` = wind avg, `wm` = wind max, `wd` = wind direction
- `cd` = cloud %, `cb` = cloud base (x100m), `fl` = freezing level (x100m)
- `d` = danger score (0-3)

Abbreviated keys keep payload compact. Client-side rendering handles presentation.

### New API Endpoints

```
GET /api/v1/forecast?loc=LAKEO&type=cast12          — 12hr hourly (equivalent to CAST LAKEO)
GET /api/v1/forecast?loc=LAKEO&type=cast24           — 24hr hourly (equivalent to CAST24 LAKEO)
GET /api/v1/forecast?loc=LAKEO&type=cast7            — 7-day (equivalent to CAST7 LAKEO)
GET /api/v1/forecast?lat=-41.89&lon=146.08&type=cast12  — GPS coordinates
GET /api/v1/forecast?type=cast7&scope=camps          — All camps on user's route
GET /api/v1/forecast?type=cast7&scope=peaks          — All peaks on user's route
```

**Auth:** API key per account (generated on web dashboard, stored in accounts table). Simpler than JWT for satellite apps where every byte matters.

### Database Changes (Minimal)

```sql
-- Add API key to accounts table
ALTER TABLE accounts ADD COLUMN api_key TEXT UNIQUE;

-- Track API usage for analytics (parallel to sms_messages log)
CREATE TABLE api_requests (
    id INTEGER PRIMARY KEY,
    account_id INTEGER REFERENCES accounts(id),
    endpoint TEXT NOT NULL,
    location TEXT,
    request_type TEXT,  -- 'cast12', 'cast24', 'cast7'
    response_bytes INTEGER,
    latency_ms INTEGER,
    source TEXT,  -- 'satellite_app', 'pwa', 'api'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Satellite App Whitelisting Path

To get Thunderbird whitelisted on T-Mobile T-Satellite:
1. Build optimized satellite-aware app/PWA
2. Apply via SatelliteApps@T-Mobile.com
3. App must handle `NET_CAPABILITY_NOT_BANDWIDTH_CONSTRAINED` (Android) or `com.apple.developer.networking.carrier-constrained.app-optimized` (iOS)
4. Design for high-latency, low-bandwidth: burst transfers, no streaming, graceful timeouts

## Scope Boundaries

### In Scope
- Refactor `generate_cast_forecast()` to return structured data (ForecastResult)
- JSON serializer for compact satellite-optimized payload
- New `/api/v1/forecast` endpoint with API key auth
- API key generation and storage
- Request logging for analytics
- Covers all CAST variants: cast12, cast24, cast7, cast7 camps/peaks, GPS

### Out of Scope (Future Phases)
- Native companion app — Phase 12 (see "Phase 12 Direction" below)
- T-Mobile / carrier whitelisting application (business process, not code)
- Push notifications (current system is pull-based, keep it that way)
- Any changes to the SMS CAST command behavior (zero regression)
- DeliveryRouter / channel preference / fallback logic (not needed — both channels are independent pull interfaces)
- Scheduled push refactoring (keep the 6AM/6PM jobs as-is)

## Phase 12 Direction: Native Companion App

**Why native, not PWA:**

PWA was considered and rejected for this use case. The problem:
- iOS evicts service worker caches after ~7 days of non-use
- A hiker installs the PWA at home, doesn't open it for 2 weeks, cache is gone
- On the trail with only satellite data, re-downloading the 2-3MB app shell is unacceptable (2-3 min at 100 Kbps)
- This is a safety-critical tool — "need to re-download" is not acceptable on a ridge in a storm

Native app advantages for satellite:
- Installed permanently — never needs to re-download the shell
- Over satellite, it ONLY sends the 5KB API request, every time, guaranteed
- Can declare satellite-constrained network capabilities (Android/iOS manifests)
- Background GPS for position tracking (PWA can't on iOS)
- App Store discovery ("hiking weather" searches)
- Push notifications for storm warnings (future)

**Minimal viable native app:**
- Trail list with search (bundled data, ~200KB)
- Map view with trail overlay (vector tiles, cached on WiFi)
- Tap location → fetch forecast (5KB API call)
- Render forecast as charts/icons (replaces pipe-delimited SMS)
- Offline: show last-fetched forecast with "updated X hours ago"
- Install size target: <10MB

**Stack options to evaluate in Phase 12:**
- React Native / Expo — cross-platform, large ecosystem
- Flutter — cross-platform, good offline/performance
- Native Swift + Kotlin — best performance, 2x development
- Kotlin Multiplatform — shared logic, native UI

Phase 11 (JSON API) is a prerequisite — the app consumes the API this phase builds.

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Satellite data apps require carrier whitelisting | Can't get on T-Satellite app list | JSON API works for any client regardless — PWA, native app, direct API |
| Payload size exceeds satellite capacity | Forecast doesn't load | Compact JSON format (<5KB); abbreviated keys; only essential data |
| Over-engineering before market validates | Wasted effort | This is literally 2 plans — refactor + endpoint. Minimal investment |
| API key security on satellite | Keys could be intercepted | HTTPS is standard even over satellite; rate limiting per key |

## Estimated Scope

**2 plans:**

1. **Forecast data refactor** — Extract structured ForecastResult from generate_cast_forecast functions. Keep SMS formatting unchanged. Add JSON serializer with compact abbreviated-key format. Cover all CAST variants (12hr, 24hr, 7-day, GPS, camps, peaks).

2. **JSON API endpoint + auth** — New `/api/v1/forecast` endpoint. API key generation/storage in accounts table. Request logging. Rate limiting. API key management in admin panel.

## Success Criteria

1. Existing SMS CAST commands work identically (zero regression)
2. `GET /api/v1/forecast?loc=LAKEO&type=cast12` returns the same data as `CAST LAKEO` would via SMS, but as JSON
3. JSON forecast payload is <5KB for any single-location CAST request
4. All CAST variants (12hr, 24hr, 7-day, GPS, camps, peaks) have JSON equivalents
5. API requests are logged for analytics
6. API key auth protects the endpoint
