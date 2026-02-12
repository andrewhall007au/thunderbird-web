# Phase 12 Research Synthesis

## 1. Codebase Readiness — Almost Everything Exists

The thunderbird-web codebase is exceptionally well-positioned. Key assets already in production:

| Component | Status | Location |
|-----------|--------|----------|
| MapLibre GL JS v5.16.0 | Production | `app/components/map/MapEditor.tsx` |
| react-map-gl v8.1.0 | Production | Same |
| 250+ trails with elevation at every point | Production | `public/trail-data/*.json` |
| GPS parsing (DMS, decimal, cardinal) | Production | `app/lib/trailMatch.ts` |
| 252 trailheads with haversine matching | Production | `app/lib/trailMatch.ts` |
| Multi-country weather (Open-Meteo + NWS + BOM) | Production | `backend/app/services/weather/` |
| NormalizedForecast data structure | Production | `backend/app/services/weather/base.py` |
| Waypoint markers + route tracks | Production | `app/components/map/WaypointMarker.tsx` |
| Next.js 14 + Tailwind | Production | Root app |

**POC can be built as a new Next.js route** (`/prototype`) with no new infrastructure. Everything needed is already installed and free.

---

## 2. Maps & Tiles — PMTiles is the Clear Path

### Architecture for Offline Topo Maps (cost: $0)

```
Protomaps Basemap PMTiles  →  vector: roads, water, labels, land
         +
Mapterhorn Terrain PMTiles →  raster DEM: hillshade + contour generation
         +
Trail GeoJSON overlay      →  PCT track, waypoints, camps
         =
Full offline topo map in MapLibre GL JS
```

### Key Findings

- **PMTiles work from Next.js `/public` folder** — dev server supports HTTP Range Requests natively
- **`pmtiles extract`** can pull a region from the Protomaps planet file: `pmtiles extract https://build.protomaps.com/<latest>.pmtiles public/basemap.pmtiles --bbox=-124.5,32.5,-115.5,49.0 --maxzoom=14`
- **Mapterhorn** provides global terrain DEM as PMTiles (free, Cloudflare-sponsored)
- **`maplibre-contour`** (v0.0.5) generates contour lines client-side from DEM tiles — no pre-baking needed
- **MapLibre GL JS natively renders hillshade** from `raster-dem` source type
- **MapTiler is NOT needed** — Protomaps + Mapterhorn replaces it entirely, no API keys, no licensing

### Estimated Tile Sizes for PCT Corridor

| Scope | Zoom Range | Estimated Size |
|-------|-----------|---------------|
| PCT corridor basemap (vector) | z0-z14 | 500 MB - 2 GB |
| PCT corridor terrain (raster DEM) | z0-z12 | Similar scale |
| World overview | z0-z6 | ~60 MB |

For the **web POC**, we don't need offline tiles — just use online tile sources (OpenTopoMap is already configured in the codebase). Offline tiles are a native app concern for Phase 12C.

### Dependencies Needed

```bash
npm install pmtiles @protomaps/basemaps maplibre-contour
# maplibre-gl already installed (v5.16.0)
```

---

## 3. Weather APIs — Open-Meteo Dominates

### Multi-Pin Batch Requests

Open-Meteo supports **up to 1,000 locations in a single API call**: `&latitude=47.1,49.7&longitude=8.6,9.4`. Weight calculation: `nLocations * (nDays/14) * (nVariables/10)`. 8 pins with 3 days and 7 variables = ~1.2 weight (essentially 1 API call).

### Response Sizes

| Format | Per Pin (72h, 7 vars) | 8 Pins |
|--------|----------------------|--------|
| JSON | ~3-5 KB | ~25-40 KB |
| JSON + gzip | ~1-2 KB | ~8-16 KB |
| FlatBuffers | ~1.5-2.5 KB | ~12-20 KB |

### Grid Resolution by Region

| Region | Model | Resolution | Forecast Range |
|--------|-------|-----------|---------------|
| **US (CONUS)** | HRRR | **3 km** | 18-48h |
| **US** | GFS | 13 km | 16 days |
| **Europe** | AROME/ICON-D2 | 1.3-2 km | 2 days |
| **Canada** | GEM | 2.5 km | 2 days |
| **Australia** | BOM ACCESS-C | 1.5 km | 36h (city domains only) |
| **Global** | ECMWF IFS | 9 km | 10 days |

**Critical: HRRR only forecasts 18-48h.** Must blend HRRR (hours 0-48) + GFS (hours 48-72) for a 72-hour multi-pin forecast.

### Pricing

| Tier | Price | Calls/Month | Commercial? |
|------|-------|------------|------------|
| Free | $0 | 300,000 | **NO** |
| Standard | **$29/month** | 1,000,000 | Yes |
| Professional | $99/month | 5,000,000 | Yes |

**Open-Meteo free tier prohibits commercial use.** For a $19.99 paid app, Standard plan at $29/month is required. NWS API is completely free for commercial use but US-only.

### Open-Meteo Already Does 90m DEM Elevation Downscaling

Open-Meteo adjusts temperatures using a 0.7C/100m lapse rate based on Copernicus GLO-90 elevation data. This is critical for mountain forecasts — do NOT apply additional lapse rate corrections.

### Recommended Architecture

Pre-fetch entire trail corridors on the backend, cache by model update frequency:
- HRRR: refresh hourly
- GFS/ECMWF: refresh every 6 hours
- Serve per-pin from cache — satellite connection never hits upstream API

---

## 4. Weather Grid Overlay

### PCT Corridor Grid Coverage

- Trail length: ~4,275 km
- Corridor width: ~30 km (15 km each side)
- At HRRR 3 km resolution: **~8,000-12,000 unique grid cells**
- GeoJSON size: ~2 MB raw, **~200 KB compressed** (TopoJSON + gzip)
- Small enough to bundle in the app

### Rendering Approach

GeoJSON FeatureCollection of grid cell polygons, rendered as transparent fill layer in MapLibre. Each cell colored by severity at the selected time step.

---

## 5. Satellite Ecosystem — Faster Than Expected

### Carrier Status (as of Feb 2026)

| Carrier | Country | SMS | Data | Pricing |
|---------|---------|-----|------|---------|
| **T-Mobile** | US | Jul 2025 | **Oct 2025** | Included on Go5G+ |
| **KDDI** | Japan | Apr 2025 | **Aug 2025** | 1,650 yen/month |
| **Rogers** | Canada | Jul 2025 | **Dec 2025** | $15 CAD/month |
| **Telstra** | Australia | Jun 2025 | **Expected 2026** | TBD |
| **One NZ** | New Zealand | Dec 2024 | Voice 2026, data TBD | Included |
| **Salt** | Switzerland | TBD | TBD | TBD |

**Key insight: KDDI launched satellite data FIRST (Aug 2025) and already supports hiking apps (YAMAP, Yamareco).** This is direct market validation.

### Developer Requirements

**Android (SDK 35+):**
```xml
<meta-data
    android:name="android.telephony.PROPERTY_SATELLITE_DATA_OPTIMIZED"
    android:value="com.thunderbird.trailweather" />
```
Plus remove `NET_CAPABILITY_NOT_BANDWIDTH_CONSTRAINED` from NetworkRequest to receive satellite callbacks.

**iOS 26+:**
- Two entitlements: `com.apple.developer.networking.carrier-constrained.appcategory` + `com.apple.developer.networking.carrier-constrained.app-optimized`
- **MUST use `NWConnection` (Network framework), NOT URLSession** — critical architectural constraint
- `NWPath.isUltraConstrained` for detection

**T-Mobile onboarding:** Email SatelliteApps@T-Mobile.com. No certification required. Relationship-based process.

### Real-World Performance

- Speeds: ~4 Mbps outdoors (theoretical), "2G-style" in practice
- Latency: 1-7 minutes for messaging, ~26 ms for data connections
- A 1-2 KB weather payload transfers in <200 ms — **satellite bandwidth is NOT the bottleneck**
- Connection establishment and app reliability are the real challenges

### Three-Tier Detection Strategy

| Tier | Detection | Behavior |
|------|-----------|----------|
| Full connectivity | Normal cellular/WiFi | JSON API, full features |
| Satellite data | `TRANSPORT_SATELLITE` / `isUltraConstrained` | MessagePack, minimal payloads, extended timeouts |
| Satellite SMS only | No data path, SMS capable | CAST/WX SMS commands |
| Fully offline | No network, no SMS | Cached data only |

---

## 6. App Store Distribution — More Complex Than Expected

### Epic v Apple (Dec 2025 Ruling)

The Ninth Circuit ruled Apple MAY charge a "reasonably necessary" commission on external payment links, but the exact amount is being determined by the district court. This means:

- The Netflix/Kindle "free app + external purchase" model **is still legally viable** but faces uncertainty
- Apple may eventually charge a small fee (likely much less than 30%) on linked-out purchases
- The fee amount won't be decided until Judge Gonzalez Rogers rules

### iOS 26.2 Third-Party App Stores

Apple is opening third-party app stores beyond the EU — Japan (Dec 2025) and Brazil are live. A 5% fee for eligible purchases outside Apple's store starting Jan 2026. This is an alternative distribution path but adds complexity.

### Practical Recommendation for Thunderbird

1. **Launch as free app + external account** (thunderbird.bot purchase). This is the established pattern.
2. **Monitor the Epic v Apple district court ruling** for the "reasonably necessary" fee amount.
3. **Have IAP fallback plan** — if Apple blocks the external purchase model, add $19.99 IAP (accept the 15-30% commission).
4. **Google Play is more lenient** — external payment links with minimal restrictions.

---

## 7. Flutter vs React Native — Updated Assessment

### Flutter MapLibre Packages

Two Flutter MapLibre packages exist:

| Package | `maplibre_gl` (old) | `maplibre` (new) |
|---------|-------------------|-----------------|
| Version | Stable but unmaintained | v0.3.0 (active development) |
| Crash rate | **44% of users report crashes** | Significantly lower (FFI/JNI direct interop) |
| Platform-specific bugs | 46% of users report | Platform-invariant design goal |
| Offline support | OfflineManager, MBTiles, PMTiles | OfflineManager (mobile only, not web) |
| Architecture | Platform channels (bridge) | Direct FFI/JNI (no bridge) |

**Use the new `maplibre` package (v0.3+)**, not `maplibre_gl`.

### Flutter Still Recommended for Production

- 6-8 MB app size achievable
- OfflineManager supports `downloadRegion` with progress tracking
- MBTiles and PMTiles supported on Android/iOS
- Direct platform channels for satellite network detection
- The web POC validates UX first, then Flutter builds the native experience

---

## 8. Answers to Open Questions

| Question | Answer |
|----------|--------|
| Weather data source | Open-Meteo Standard ($29/mo) for commercial + NWS (free, US-only) as supplement |
| Grid resolution | HRRR 3km for US (blend with GFS after 48h). ECMWF 9km globally. Open-Meteo auto-selects best. |
| Forecast cache TTL | Current conditions: 1h. Short-range (6-24h): 2-3h. Medium-range (24-72h): 6h. |
| PCT free tier abuse | Permit numbers are publicly verifiable via PCTA. Add email verification. |
| Offline barometric trend | Not for MVP. Phone barometers are noisy and uncalibrated. |
| Next carrier after T-Mobile | KDDI (Japan) already live. Rogers (Canada) live. Telstra (AU) expected 2026. |
| SMS response parsing | Technically possible but complex for MVP. Manual reference sufficient. |
| App Store compliance | Free app + external account viable but monitor Epic v Apple fee ruling. Have IAP fallback. |
| SMS multi-pin limits | `WX -42.753 146.012 -42.748 146.019 -42.741 146.025` = ~54 chars for 3 pins. ~4 pins fit in 160 chars. |
| Account system | JWT with long expiry (90 days). Refresh on connectivity. Offline activation after first login. |

---

## 9. Key Decisions for Planning

### Decision 1: POC is a new Next.js route, not a separate project
The existing codebase has MapLibre, trail data, weather APIs, and GPS parsing. Add `/prototype` page.

### Decision 2: Use online tiles for POC, PMTiles for production
No need to download 2GB of tiles for a web prototype. Use existing OpenTopoMap tiles. PMTiles matter for native offline.

### Decision 3: Open-Meteo batch API for multi-pin
One API call for all pins. $29/month for commercial use. Already integrated in backend.

### Decision 4: Pre-fetch corridors on backend
Backend caches entire trail corridor forecasts. Satellite connection only hits your server, never upstream APIs.

### Decision 5: Start with coordinate picker (SMS mode)
SMS mode works TODAY on Telstra, T-Mobile, Rogers, One NZ. Data mode is a progressive enhancement.

### Decision 6: iOS requires NWConnection, not URLSession
This is a hard architectural constraint for the Flutter production app. Must use Network framework for satellite data on iOS.

### Decision 7: Flutter `maplibre` package (v0.3+), not `maplibre_gl`
The old package has 44% crash rate. New package uses direct FFI/JNI interop.
