# Phase 6: International Weather - Research

**Researched:** 2026-01-21
**Domain:** Multi-country weather API integration with fallback handling
**Confidence:** MEDIUM (varies by country - see breakdown below)

## Summary

This phase requires integrating weather APIs for 8 countries (USA, Canada, UK, France, Italy, Switzerland, New Zealand, South Africa) with Open-Meteo as universal fallback. The research reveals a mixed landscape: some countries have excellent free APIs (USA NWS), while others require commercial APIs or alternative approaches. The existing codebase already has a solid foundation with BOM + Open-Meteo integration patterns that can be extended.

Key findings:
- **USA (NWS)** is the gold standard - free, well-documented, no auth required (just User-Agent header)
- **Open-Meteo** can serve as both fallback AND primary source for several countries via their MeteoSwiss and Meteo-France model integrations
- **UK Met Office** has deprecated DataPoint; Weather DataHub has free tier (360 calls/day) but requires registration
- **Italy** has no public API; Open-Meteo with DWD ICON is the recommended approach
- **South Africa** requires commercial AfriGIS API; Open-Meteo fallback strongly recommended

**Primary recommendation:** Use Open-Meteo as the backbone for most countries, with native APIs (NWS, Met Office, Environment Canada) where they provide significant value (alerts, higher resolution). The existing normalization layer design in `weather_intl.py` is sound.

## Standard Stack

### Core Libraries

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| httpx | 0.27+ | Async HTTP client | Already in codebase, supports async, timeouts, retries |
| geohash2 | 1.1+ | Location encoding | Already in codebase for BOM API |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| httpx-retries | 0.3+ | Retry transport for httpx | Flaky API connections |
| tenacity | 8.2+ | Advanced retry logic | Complex retry scenarios with backoff |
| env-canada | latest | Environment Canada client | Optional - direct API also works |

### Not Needed

| Instead of | Don't Use | Reason |
|------------|-----------|--------|
| openmeteo-requests | Direct httpx | Our codebase uses httpx already; openmeteo-requests uses niquests |
| nwsapy | Direct httpx | Adds dependency for simple API |
| meteofrance-api | Open-Meteo | Package is for mobile app API, not documented public API |

**Installation:**
```bash
pip install httpx-retries  # Only if retry logic needed beyond httpx built-in
```

## Country-by-Country API Analysis

### USA: National Weather Service (NWS) - WTHR-01

**Confidence:** HIGH

| Aspect | Details |
|--------|---------|
| API Base | `https://api.weather.gov` |
| Cost | FREE (US Government public data) |
| Auth | User-Agent header required (app name + contact) |
| Resolution | ~2.5km grid |
| Forecast Range | 7 days |
| Update Frequency | Hourly |
| Alerts | YES - comprehensive CAP v1.2 alerts |
| Rate Limits | Undisclosed but generous; abuse-only enforcement |

**Endpoints:**
- `/points/{lat},{lon}` - Get grid metadata
- `/gridpoints/{office}/{x},{y}/forecast` - 12-hour periods
- `/gridpoints/{office}/{x},{y}/forecast/hourly` - Hourly forecast
- `/alerts/active?point={lat},{lon}` - Active alerts for location

**Flow:**
1. Call `/points` to get grid office and coordinates
2. Use returned `forecast` URL for actual forecast data

**Pros:** Free, excellent documentation, includes alerts, reliable
**Cons:** Two-step process required (points then forecast)

### Canada: Environment Canada (MSC GeoMet) - WTHR-02

**Confidence:** MEDIUM

| Aspect | Details |
|--------|---------|
| API Base | `https://api.weather.gc.ca` |
| Cost | FREE |
| Auth | None required |
| Resolution | Variable by dataset |
| Forecast Range | 7 days |
| Update Frequency | Varies |
| Alerts | YES - via collections |
| Rate Limits | Not published, reasonable use expected |

**Alternative:** `env-canada` Python package provides cleaner interface:
- ECWeather class for forecasts, current conditions, alerts
- Async support with `update()` method
- MIT licensed

**Pros:** Free, government data, includes alerts
**Cons:** OGC-based API can be complex; env-canada package recommended

### UK: Met Office Weather DataHub - WTHR-03

**Confidence:** HIGH

| Aspect | Details |
|--------|---------|
| API Base | `https://datahub.metoffice.gov.uk` |
| Cost | FREE tier: 360 calls/day; Paid: from GBP 8/month |
| Auth | API key required (registration) |
| Resolution | Site-specific (coordinates) |
| Forecast Range | Hourly (2 days), 3-hourly (7 days), Daily (7 days) |
| Update Frequency | Hourly |
| Alerts | Not in basic tier |
| Rate Limits | 360/day free, then tiered |

**Note:** DataPoint service has been DECOMMISSIONED. Use Weather DataHub.

**Products:**
- Global Spot: Deterministic forecasts (most likely scenario)
- Blended Probabilistic: Range of probabilities (BETA)

**Pros:** Official UK Met Office data, good resolution
**Cons:** Requires registration, limited free tier, no free alerts

**Recommendation:** Use free tier for UK forecasts; fallback to Open-Meteo if rate limited

### France: Meteo-France via Open-Meteo - WTHR-04

**Confidence:** HIGH

| Aspect | Details |
|--------|---------|
| API Base | `https://api.open-meteo.com/v1/meteofrance` |
| Cost | FREE (non-commercial) |
| Auth | None required |
| Resolution | AROME: 1.5-2.5km (France), ARPEGE: 11-25km (global) |
| Forecast Range | AROME: 2 days, ARPEGE: 4 days |
| Update Frequency | AROME: every 3 hours, ARPEGE: every 6 hours |
| Alerts | NO |
| Rate Limits | ~10,000 calls/day (free tier) |

**Note:** Direct Meteo-France API requires registration at their portal. Open-Meteo provides the same model data without registration.

**Pros:** High resolution for France, no auth needed via Open-Meteo
**Cons:** Short forecast range for AROME, no alerts

### Italy: Open-Meteo (DWD ICON) - WTHR-05

**Confidence:** HIGH

| Aspect | Details |
|--------|---------|
| API Base | `https://api.open-meteo.com/v1/forecast` |
| Cost | FREE (non-commercial) |
| Auth | None required |
| Resolution | ICON-EU: 7km, ICON: 13km |
| Forecast Range | 7.5 days |
| Update Frequency | Every 3 hours |
| Alerts | NO |
| Rate Limits | ~10,000 calls/day |

**Note:** Italy's Servizio Meteorologico (Air Force) does NOT have a public API. Open-Meteo with DWD ICON model provides excellent European coverage including Italy.

**Pros:** No native API complexity, reliable coverage
**Cons:** No Italian-specific alerts

### Switzerland: MeteoSwiss via Open-Meteo - WTHR-06

**Confidence:** HIGH

| Aspect | Details |
|--------|---------|
| API Base | `https://api.open-meteo.com/v1/meteoswiss` |
| Cost | FREE (non-commercial) |
| Auth | None required |
| Resolution | ICON-CH1: 1km, ICON-CH2: 2km |
| Forecast Range | CH1: 33 hours, CH2: 5 days |
| Update Frequency | CH1: every 3 hours, CH2: every 6 hours |
| Alerts | NO |
| Rate Limits | ~10,000 calls/day |

**Note:** MeteoSwiss is releasing Open Government Data but API access "not before 2026". Open-Meteo provides MeteoSwiss model data NOW.

**Critical for mountain weather:** 1-2km resolution captures convective showers in Alpine terrain. Includes freezing level, which is essential for hiking forecasts.

**Pros:** Excellent Alpine resolution, freezing level data
**Cons:** Short range for highest resolution model

### New Zealand: MetService Point Forecast API - WTHR-07

**Confidence:** MEDIUM

| Aspect | Details |
|--------|---------|
| API Base | `https://console.metoceanapi.com` |
| Cost | Basic: USD 30/month (100k API units) |
| Auth | API key via x-api-key header |
| Resolution | 4km WRF model (NZ-specific) |
| Forecast Range | 10 days |
| Update Frequency | 4x daily |
| Alerts | Not specified |
| Rate Limits | Based on plan (100k+ units) |

**Alternative:** Open-Meteo provides NZ coverage via GFS/ECMWF (11-25km resolution)

**Recommendation:** Given $50/month budget threshold and mountain hiking focus, MetService's 4km NZ-specific model may be worth the $30/month. However, Open-Meteo fallback is essential for cost control.

**Open-Meteo NZ alternative:**
- Resolution: 11-25km (less granular)
- Cost: FREE
- Coverage: Global models cover NZ adequately

**Decision needed:** Is 4km resolution worth $30/month vs 11-25km free?

### South Africa: AfriGIS Weather API (SAWS) - WTHR-08

**Confidence:** LOW

| Aspect | Details |
|--------|---------|
| API Base | AfriGIS developer portal |
| Cost | Commercial (pricing not public) |
| Auth | API key required |
| Resolution | Unknown |
| Forecast Range | 10-day forecast available |
| Update Frequency | Unknown |
| Alerts | YES - lightning, storms |
| Rate Limits | Unknown |

**Note:** SAWS data is only available commercially through AfriGIS. Could not verify pricing or detailed specs.

**Recommendation:** Use Open-Meteo as PRIMARY source for South Africa, with AfriGIS as optional enhancement if alerts are critical.

**Open-Meteo SA coverage:**
- Resolution: 11-25km (GFS/ECMWF)
- Cost: FREE
- No alerts

### Open-Meteo Universal Fallback - WTHR-09

**Confidence:** HIGH

| Aspect | Details |
|--------|---------|
| API Base | `https://api.open-meteo.com/v1/forecast` |
| Cost | FREE (non-commercial) |
| Auth | None required |
| Resolution | 1-25km depending on region/model |
| Forecast Range | 7-16 days |
| Update Frequency | Model-dependent |
| Alerts | NO |
| Rate Limits | ~10,000 calls/day |

**Key parameters for mountain hiking:**
- `freezing_level_height` - Direct from API
- `snowfall` - cm accumulation
- `cloud_cover` - percentage
- `wind_gusts_10m` - km/h
- `elevation` - Can override for altitude adjustment

**Endpoint:**
```
GET https://api.open-meteo.com/v1/forecast
?latitude={lat}
&longitude={lon}
&hourly=temperature_2m,precipitation_probability,precipitation,rain,snowfall,wind_speed_10m,wind_gusts_10m,wind_direction_10m,cloud_cover,freezing_level_height
&timezone=auto
&forecast_days=7
```

## Architecture Patterns

### Recommended Project Structure
```
backend/app/services/
├── weather/
│   ├── __init__.py
│   ├── base.py              # WeatherProvider ABC, NormalizedForecast
│   ├── providers/
│   │   ├── __init__.py
│   │   ├── nws.py           # USA - National Weather Service
│   │   ├── envcanada.py     # Canada - Environment Canada
│   │   ├── metoffice.py     # UK - Met Office DataHub
│   │   ├── openmeteo.py     # Universal fallback + FR/IT/CH/NZ/ZA
│   │   └── afrigis.py       # South Africa (optional)
│   ├── router.py            # Country -> Provider routing
│   └── cache.py             # 1-hour caching layer
├── weather_intl.py          # Existing stub - extend this
└── bom.py                   # Existing - keep for AU
```

### Pattern 1: Provider Adapter Pattern

**What:** Each API gets an adapter class implementing common interface
**When to use:** Different APIs with different formats need unified interface

```python
# Source: Existing weather_intl.py pattern
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, List
from datetime import datetime

@dataclass
class NormalizedForecast:
    """Already defined in weather_intl.py - extend as needed."""
    provider: str
    lat: float
    lon: float
    timestamp: datetime
    temp_min: float  # Celsius
    temp_max: float  # Celsius
    rain_chance: int  # 0-100%
    rain_max: float  # mm
    wind_avg: float  # km/h
    wind_max: float  # km/h
    wind_direction: str  # N, NE, E, etc.
    cloud_cover: int  # 0-100%
    freezing_level: Optional[int] = None  # meters
    snow_max: float = 0.0  # cm
    description: str = ""
    # NEW: Alert support
    alerts: List[dict] = None  # List of alert dicts

class WeatherProviderBase(ABC):
    """Base class for all weather providers."""

    @abstractmethod
    async def get_forecast(
        self,
        lat: float,
        lon: float,
        days: int = 7
    ) -> List[NormalizedForecast]:
        """Fetch and normalize forecast data."""
        pass

    @abstractmethod
    async def get_alerts(
        self,
        lat: float,
        lon: float
    ) -> List[dict]:
        """Fetch active weather alerts. Empty list if not supported."""
        pass

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Human-readable provider name for display."""
        pass
```

### Pattern 2: Country Router with Fallback

**What:** Route requests to correct provider based on country, with automatic fallback
**When to use:** Multi-country support with resilience

```python
# Source: Derived from existing get_provider_for_country pattern
class WeatherRouter:
    """Routes weather requests to appropriate provider with fallback."""

    def __init__(self):
        self.providers = {
            "US": NWSProvider(),
            "CA": EnvironmentCanadaProvider(),
            "GB": MetOfficeProvider(),
            "FR": OpenMeteoProvider(model="meteofrance"),
            "IT": OpenMeteoProvider(model="icon_eu"),
            "CH": OpenMeteoProvider(model="meteoswiss"),
            "NZ": OpenMeteoProvider(model="gfs"),  # or MetService if paid
            "ZA": OpenMeteoProvider(model="gfs"),
        }
        self.fallback = OpenMeteoProvider(model="best_match")

    async def get_forecast(
        self,
        lat: float,
        lon: float,
        country_code: str,
        days: int = 7
    ) -> List[NormalizedForecast]:
        provider = self.providers.get(country_code, self.fallback)

        try:
            return await provider.get_forecast(lat, lon, days)
        except Exception as e:
            logger.warning(f"{provider.provider_name} failed: {e}, using fallback")
            return await self.fallback.get_forecast(lat, lon, days)
```

### Pattern 3: Two-Step API Pattern (NWS)

**What:** Some APIs require metadata lookup before forecast fetch
**When to use:** NWS and similar grid-based APIs

```python
# Source: NWS API documentation
class NWSProvider(WeatherProviderBase):
    BASE_URL = "https://api.weather.gov"

    def __init__(self):
        self._grid_cache: Dict[str, dict] = {}  # Cache points lookups

    async def _get_grid_info(self, lat: float, lon: float) -> dict:
        """Get NWS grid info for coordinates (cached)."""
        cache_key = f"{lat:.4f},{lon:.4f}"
        if cache_key in self._grid_cache:
            return self._grid_cache[cache_key]

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/points/{lat},{lon}",
                headers={"User-Agent": "(Thunderbird, contact@example.com)"}
            )
            response.raise_for_status()
            data = response.json()

            grid_info = {
                "office": data["properties"]["gridId"],
                "gridX": data["properties"]["gridX"],
                "gridY": data["properties"]["gridY"],
                "forecast_url": data["properties"]["forecast"],
                "forecast_hourly_url": data["properties"]["forecastHourly"],
            }
            self._grid_cache[cache_key] = grid_info
            return grid_info

    async def get_forecast(self, lat: float, lon: float, days: int = 7):
        grid = await self._get_grid_info(lat, lon)
        # Then fetch from grid["forecast_url"]
```

### Anti-Patterns to Avoid

- **One giant provider class:** Keep each API in its own module
- **Blocking calls:** All API calls must be async (httpx AsyncClient)
- **No timeout:** Always set timeouts (30s default for weather APIs)
- **Ignoring cache headers:** Weather APIs provide Cache-Control - respect them
- **Hardcoded credentials:** All API keys via environment variables

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Temperature unit conversion | Manual formulas | Open-Meteo `temperature_unit` param | API does it correctly |
| Wind speed unit conversion | Manual formulas | Open-Meteo `wind_speed_unit` param | API does it correctly |
| Elevation lookup | Terrain database | Open-Meteo Elevation API | Already used in bom.py |
| Lapse rate adjustment | Complex altitude model | Open-Meteo `elevation` param | API adjusts for you |
| Retry with backoff | Manual retry loops | httpx-retries or tenacity | Battle-tested |
| Timezone handling | Manual offset calc | Open-Meteo `timezone=auto` | API returns local time |
| Geohash encoding | Custom implementation | geohash2 library | Already in codebase |

## Common Pitfalls

### Pitfall 1: NWS User-Agent Requirement
**What goes wrong:** 403 Forbidden errors from NWS API
**Why it happens:** NWS requires User-Agent header identifying your application
**How to avoid:** Always include User-Agent: "(AppName, contact@email.com)"
**Warning signs:** Works in browser, fails in code

### Pitfall 2: Met Office DataPoint Deprecation
**What goes wrong:** Tutorials reference DataPoint which no longer exists
**Why it happens:** Met Office deprecated DataPoint; old docs still online
**How to avoid:** Use Weather DataHub API only
**Warning signs:** 404 errors, "service unavailable" messages

### Pitfall 3: Open-Meteo Rate Limiting
**What goes wrong:** 429 errors after seemingly low usage
**Why it happens:** Rate limit counting changed; ~10k/day limit
**How to avoid:** Implement 1-hour caching, don't re-fetch same coordinates
**Warning signs:** Sudden 429s mid-day, "Daily API request limit exceeded"

### Pitfall 4: Two-Step API Caching
**What goes wrong:** Redundant /points calls for NWS, slow responses
**Why it happens:** Forgetting to cache the metadata lookup
**How to avoid:** Cache grid info (it doesn't change for coordinates)
**Warning signs:** 2x API calls per forecast, slow NWS responses

### Pitfall 5: Alert API Response Size
**What goes wrong:** Huge responses, slow parsing, memory issues
**Why it happens:** Fetching all alerts instead of filtering
**How to avoid:** Use `?point=` parameter for NWS, filter by location
**Warning signs:** Multi-MB responses, timeouts on alerts endpoint

### Pitfall 6: Assuming All APIs Have Alerts
**What goes wrong:** Code expects alerts from APIs that don't provide them
**Why it happens:** Not all weather APIs include alert data
**How to avoid:** `get_alerts()` returns empty list if not supported
**Warning signs:** KeyError, AttributeError when accessing alerts

## Code Examples

### NWS Forecast Fetch

```python
# Source: NWS API documentation + best practices
import httpx
from typing import List

async def fetch_nws_forecast(lat: float, lon: float) -> dict:
    """Fetch NWS forecast for coordinates."""
    headers = {
        "User-Agent": "(Thunderbird-Web, contact@thunderbird.app)",
        "Accept": "application/geo+json"
    }

    async with httpx.AsyncClient(timeout=30.0, headers=headers) as client:
        # Step 1: Get grid info
        points_response = await client.get(
            f"https://api.weather.gov/points/{lat:.4f},{lon:.4f}"
        )
        points_response.raise_for_status()
        points_data = points_response.json()

        # Step 2: Get forecast from grid URL
        forecast_url = points_data["properties"]["forecast"]
        forecast_response = await client.get(forecast_url)
        forecast_response.raise_for_status()

        return forecast_response.json()
```

### NWS Alerts Fetch

```python
# Source: NWS API documentation
async def fetch_nws_alerts(lat: float, lon: float) -> List[dict]:
    """Fetch active NWS alerts for a point."""
    headers = {"User-Agent": "(Thunderbird-Web, contact@thunderbird.app)"}

    async with httpx.AsyncClient(timeout=30.0, headers=headers) as client:
        response = await client.get(
            f"https://api.weather.gov/alerts/active",
            params={"point": f"{lat:.4f},{lon:.4f}"}
        )
        response.raise_for_status()
        data = response.json()

        return [
            {
                "event": feature["properties"]["event"],
                "headline": feature["properties"]["headline"],
                "severity": feature["properties"]["severity"],
                "urgency": feature["properties"]["urgency"],
                "expires": feature["properties"]["expires"],
            }
            for feature in data.get("features", [])
        ]
```

### Open-Meteo Universal Fetch

```python
# Source: Open-Meteo documentation
async def fetch_openmeteo_forecast(
    lat: float,
    lon: float,
    days: int = 7,
    model: str = "best_match"
) -> dict:
    """Fetch forecast from Open-Meteo with hiking-relevant parameters."""
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": ",".join([
            "temperature_2m",
            "precipitation_probability",
            "precipitation",
            "rain",
            "snowfall",
            "wind_speed_10m",
            "wind_gusts_10m",
            "wind_direction_10m",
            "cloud_cover",
            "freezing_level_height"
        ]),
        "timezone": "auto",
        "forecast_days": min(days, 16),
    }

    # Model-specific endpoints
    endpoints = {
        "best_match": "https://api.open-meteo.com/v1/forecast",
        "meteofrance": "https://api.open-meteo.com/v1/meteofrance",
        "meteoswiss": "https://api.open-meteo.com/v1/meteoswiss",
        "icon_eu": "https://api.open-meteo.com/v1/dwd-icon",
    }

    url = endpoints.get(model, endpoints["best_match"])

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        return response.json()
```

### Met Office DataHub Fetch

```python
# Source: Met Office Weather DataHub documentation
import os

async def fetch_metoffice_forecast(lat: float, lon: float) -> dict:
    """Fetch forecast from Met Office Weather DataHub."""
    api_key = os.environ.get("METOFFICE_API_KEY")
    if not api_key:
        raise ValueError("METOFFICE_API_KEY not configured")

    headers = {
        "apikey": api_key,
        "Accept": "application/json"
    }

    async with httpx.AsyncClient(timeout=30.0, headers=headers) as client:
        # Global Spot hourly endpoint
        response = await client.get(
            "https://data.hub.api.metoffice.gov.uk/sitespecific/v0/point/hourly",
            params={
                "latitude": lat,
                "longitude": lon
            }
        )
        response.raise_for_status()
        return response.json()
```

### Environment Canada Fetch (using env-canada)

```python
# Source: env-canada library documentation
from env_canada import ECWeather

async def fetch_envcanada_forecast(lat: float, lon: float) -> dict:
    """Fetch forecast from Environment Canada."""
    # ECWeather accepts coordinates
    weather = ECWeather(coordinates=(lat, lon))
    await weather.update()

    return {
        "current": weather.conditions,
        "daily_forecasts": weather.daily_forecasts,
        "hourly_forecasts": weather.hourly_forecasts,
        "alerts": weather.alerts
    }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Met Office DataPoint | Weather DataHub | 2024 | Must use new API, old one decommissioned |
| WMO GTS data exchange | WMO WIS 2.0 | Jan 2025 | Improved data availability |
| Environment Canada RSS | MSC GeoMet + env-canada | 2025 | JSON API now available |
| MeteoSwiss proprietary | Open Government Data | May 2025 | Data accessible, API coming 2026 |
| ECMWF paid data | ECMWF open-data | Oct 2025 | 9km IFS now free via Open-Meteo |

**Deprecated/outdated:**
- Met Office DataPoint: DECOMMISSIONED - use Weather DataHub
- Early Open-Meteo limits: Changed from ~500 to ~10,000 calls/day

## Weather Alerts Summary

| Country | Alerts Available | Source | Notes |
|---------|-----------------|--------|-------|
| USA | YES | NWS `/alerts/active` | Full CAP v1.2 format |
| Canada | YES | Environment Canada / env-canada | Via alerts property |
| UK | Limited | Met Office (paid tier) | Not in free Global Spot |
| France | NO | N/A | Use MeteoAlarm separately if needed |
| Italy | NO | N/A | Use MeteoAlarm separately if needed |
| Switzerland | NO | N/A | MeteoSwiss API coming 2026 |
| New Zealand | Unknown | MetService (if paid) | Not confirmed |
| South Africa | YES | AfriGIS (commercial) | Lightning, storms |

**Recommendation:** For European alerts, consider MeteoAlarm (https://www.meteoalarm.org/) as a separate integration if alerts become critical.

## Open Questions

1. **New Zealand: MetService vs Open-Meteo**
   - What we know: MetService is $30/month for 4km resolution; Open-Meteo is free at 11-25km
   - What's unclear: Is 4km resolution necessary for NZ mountain hiking?
   - Recommendation: Start with Open-Meteo, upgrade to MetService if users request better NZ accuracy

2. **South Africa API costs**
   - What we know: AfriGIS provides SAWS data commercially
   - What's unclear: Exact pricing, rate limits, response format
   - Recommendation: Use Open-Meteo as primary for ZA; skip AfriGIS unless alerts required

3. **European weather alerts**
   - What we know: MeteoAlarm aggregates 38 European national services
   - What's unclear: API access method, integration complexity
   - Recommendation: Defer alert integration for EU countries; focus on forecast data

## Sources

### Primary (HIGH confidence)
- [NWS API Documentation](https://www.weather.gov/documentation/services-web-api) - Official US government API docs
- [NWS API GitHub FAQs](https://weather-gov.github.io/api/general-faqs) - Rate limits, User-Agent requirements
- [Open-Meteo Documentation](https://open-meteo.com/en/docs) - Comprehensive API reference
- [Open-Meteo MeteoSwiss API](https://open-meteo.com/en/docs/meteoswiss-api) - Swiss ICON model specs
- [Open-Meteo Meteo-France API](https://open-meteo.com/en/docs/meteofrance-api) - AROME/ARPEGE specs
- [Met Office Weather DataHub](https://datahub.metoffice.gov.uk/) - UK API portal
- [Met Office Site-Specific Pricing](https://datahub.metoffice.gov.uk/pricing/site-specific) - Free tier details
- [Environment Canada MSC GeoMet](https://api.weather.gc.ca/) - Canadian government API
- [env-canada GitHub](https://github.com/michaeldavie/env_canada) - Python library for EC data

### Secondary (MEDIUM confidence)
- [MetService Data Portal](https://data.metservice.com/product/point-forecast-api) - NZ API pricing/features
- [MeteoSwiss Open Data Docs](https://opendatadocs.meteoswiss.ch/) - Data availability, API roadmap
- [AfriGIS Weather API](https://developers.afrigis.co.za/portfolio/weather-api/) - SA weather API (limited details)

### Tertiary (LOW confidence)
- Meteo-France direct API - Could not verify public access; Open-Meteo recommended
- Italy Servizio Meteorologico - No public API found; Open-Meteo recommended

## Metadata

**Confidence breakdown:**
- USA (NWS): HIGH - Well-documented free API, verified
- Canada: MEDIUM - API exists, env-canada library verified
- UK: HIGH - Weather DataHub verified, pricing confirmed
- France: HIGH - Open-Meteo Meteo-France verified
- Italy: HIGH - Open-Meteo ICON verified (no native API)
- Switzerland: HIGH - Open-Meteo MeteoSwiss verified, excellent resolution
- New Zealand: MEDIUM - MetService commercial, Open-Meteo fallback verified
- South Africa: LOW - AfriGIS commercial, details unverified
- Open-Meteo fallback: HIGH - Extensively documented, already in codebase
- Normalization pattern: HIGH - Existing codebase pattern sound

**Research date:** 2026-01-21
**Valid until:** ~2026-03-21 (check Met Office and MeteoSwiss for API updates)
