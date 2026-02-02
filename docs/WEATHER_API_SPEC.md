# Weather API Integration Specification
## Thunderbird Global Weather Data Architecture

**Version:** 1.0
**Date:** January 2026
**Status:** Production implementation
**Supplements:** THUNDERBIRD_SPEC_v3.2.md Section 12

---

## Table of Contents

1. [Provider Overview](#1-provider-overview)
2. [Data Flow Architecture](#2-data-flow-architecture)
3. [Metrics by Provider](#3-metrics-by-provider)
4. [Supplementation Strategy](#4-supplementation-strategy)
5. [Elevation Handling](#5-elevation-handling)
6. [Cloud Base Calculation (LCL)](#6-cloud-base-calculation-lcl)
7. [Storm Prediction (CAPE)](#7-storm-prediction-cape)
8. [Recent Precipitation](#8-recent-precipitation)
9. [Weather Alerts](#9-weather-alerts)
10. [API Endpoints & Rate Limits](#10-api-endpoints--rate-limits)
11. [Code References](#11-code-references)

---

## 1. Provider Overview

### Primary Providers by Country

| Country | Primary Provider | Resolution | Fallback |
|---------|-----------------|------------|----------|
| US | NWS (National Weather Service) | 2.5 km | Open-Meteo GFS |
| AU | BOM (Bureau of Meteorology) | 2.2 km | Open-Meteo |
| CA | Environment Canada | 2.5 km | Open-Meteo GEM |
| GB | Met Office IMPROVER | 1.5 km | Open-Meteo |
| FR | Open-Meteo (Meteo-France AROME) | 1.5 km | - |
| CH | Open-Meteo (MeteoSwiss ICON-CH2) | 2.0 km | - |
| IT | Open-Meteo (DWD ICON-EU) | 7.0 km | - |
| NZ | Open-Meteo (ECMWF) | 9.0 km | - |
| ZA | Open-Meteo (ECMWF) | 9.0 km | - |

### Open-Meteo Models

```python
class OpenMeteoModel(str, Enum):
    BEST_MATCH = "best_match"      # Auto-selects best model
    METEOFRANCE = "meteofrance"    # 1.5km AROME (France)
    ICON_EU = "icon_eu"            # 7km DWD ICON (Europe)
    ICON_CH = "icon_ch"            # 2km MeteoSwiss (Switzerland)
    GEM = "gem"                    # 2.5km HRDPS (Canada)
    HRRR = "hrrr"                  # 3km NOAA (US CONUS)
    ECMWF = "ecmwf"                # 9km global (NZ, ZA)
    GFS = "gfs"                    # 25km global (fallback)
```

---

## 2. Data Flow Architecture

### International Weather (via WeatherRouter)

```
GPS Coordinates + Country Code
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                     WeatherRouter                            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 1. Select primary provider by country                   ││
│  │ 2. Fetch forecast from primary                          ││
│  │ 3. If country in supplement list → fetch Open-Meteo     ││
│  │ 4. Merge: precip, freezing level, dewpoint, CAPE        ││
│  │ 5. Cache result (1-hour TTL)                            ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
         │
         ▼
   NormalizedDailyForecast
         │
         ▼
   normalized_to_cell_forecast()
         │
         ▼
      CellForecast → Formatters → SMS
```

### Australia (BOM Direct)

```
GPS Coordinates
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                      BOMService                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 1. Fetch BOM forecast (hourly or daily)                 ││
│  │ 2. Fetch Open-Meteo supplements:                        ││
│  │    - Wind (for CAST7 daily)                             ││
│  │    - Dewpoint + CAPE                                    ││
│  │    - Recent precipitation (past 72h)                    ││
│  │ 3. Calculate cloud base via LCL formula                 ││
│  │ 4. Merge all data                                       ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
         │
         ▼
      CellForecast → Formatters → SMS
```

---

## 3. Metrics by Provider

### Native Availability

| Metric | NWS | BOM | Env Canada | Met Office | Open-Meteo |
|--------|-----|-----|------------|------------|------------|
| Temperature | ✓ | ✓ | ✓ | ✓ | ✓ |
| Precip Probability | ~ (text) | ✓ | ✓ | ✓ | ✓ |
| Precip Amount | ✗ | ✓ | ~ (est) | ✓ | ✓ |
| Snowfall | ✗ | ✓ | ~ (est) | ✓ | ✓ |
| Wind Speed | ✓ | ✓ | ✓ | ✓ | ✓ |
| Wind Gusts | ✓ | ✓ | ~ (est) | ✓ | ✓ |
| Cloud Cover | ~ (text) | ~ (est) | ~ (text) | ~ (vis) | ✓ |
| Cloud Base | ✗ | ✗ | ✗ | ✗ | ✓ (via dewpoint) |
| Freezing Level | ✗ | ✓ | ✗ | ✗ (free) | ✓ |
| CAPE | ✗ | ✗ | ✗ | ✗ | ✓ |
| Dewpoint | ✗ | ✗ | ✗ | ✗ | ✓ |
| Weather Alerts | ✓ | ✓ | ✓ | ✗ (paid) | ✗ |
| Grid Elevation | ✓ | ~ (sample) | ~ (sample) | ✓ | ✓ |

### What We Actually Source

| Metric | US | AU | CA | GB | FR/CH/IT | NZ/ZA |
|--------|----|----|----|----|----------|-------|
| Temperature | NWS | BOM | EC | Met Office | O-M native | O-M native |
| Precip Amount | O-M HRRR | BOM | O-M GEM | Met Office | O-M native | O-M native |
| Freezing Level | O-M HRRR | BOM | O-M GEM | O-M supp | O-M native | O-M native |
| Cloud Base | LCL (O-M) | LCL (O-M) | LCL (O-M) | LCL (O-M) | LCL native | LCL native |
| CAPE | O-M HRRR | O-M supp | O-M GEM | O-M supp | O-M native | O-M native |
| Dewpoint | O-M HRRR | O-M supp | O-M GEM | O-M supp | O-M native | O-M native |
| Recent Precip | O-M | O-M | O-M | O-M | O-M native | O-M native |

---

## 4. Supplementation Strategy

### Countries with Open-Meteo Supplementation

```python
# backend/app/services/weather/router.py
self.precip_supplements: Dict[str, OpenMeteoProvider] = {
    "CA": OpenMeteoProvider(model=OpenMeteoModel.GEM),   # 2.5km
    "US": OpenMeteoProvider(model=OpenMeteoModel.HRRR),  # 3km
    "GB": OpenMeteoProvider(model=OpenMeteoModel.BEST_MATCH),
}
```

### Supplemented Metrics

For US, CA, GB the router supplements:
- `rain_amount` - Quantitative precipitation
- `snow_amount` - Snowfall in cm
- `rain_chance` - Probability %
- `freezing_level` - Meters ASL
- `dewpoint` - For LCL cloud base
- `cape` - Storm potential (J/kg)

### BOM (Australia) Supplements

```python
# backend/app/services/bom.py
# Daily forecasts supplement:
wind_by_date = await self._fetch_openmeteo_wind_supplement(lat, lon, days)
dewpoint_by_date, cape_by_date = await self._fetch_openmeteo_dewpoint_cape_supplement(lat, lon, days)
recent_precip = await self._fetch_openmeteo_recent_precip(lat, lon)

# Hourly forecasts supplement:
dewpoint_by_hour, cape_by_hour = await self._fetch_openmeteo_hourly_dewpoint_cape(lat, lon, days)
recent_precip = await self._fetch_openmeteo_recent_precip(lat, lon)
```

---

## 5. Elevation Handling

### The Problem

Weather models provide temperatures at 2m above the model's terrain grid, not at the actual GPS point elevation. A 2.5km grid cell may average 800m but the trail point could be at 1200m.

### Lapse Rate Correction

```
adjusted_temp = model_temp - (target_elevation - model_elevation) × 0.0065
```

Standard environmental lapse rate: **6.5°C per 1000m**

### Model Elevation Sources

| Provider | Source | Resolution |
|----------|--------|------------|
| NWS | API returns grid elevation | 2.5 km |
| BOM | OpenTopoData sampling | 2.2 km cell |
| Met Office | API returns elevation | 1.5 km |
| Open-Meteo | 90m Copernicus DEM | Point elevation |

### Implementation

```python
# backend/app/services/weather/converter.py
# Model elevation flows through NormalizedDailyForecast.model_elevation
# to CellForecast.base_elevation for lapse rate adjustment
```

---

## 6. Cloud Base Calculation (LCL)

### Formula

```
Cloud Base (meters AGL) = (Temperature - Dewpoint) × 125
```

This is the **Lifting Condensation Level** - where rising air reaches saturation.

### Why It Works

1. Rising air cools at dry adiabatic rate (~10°C/km)
2. Dewpoint decreases more slowly (~2°C/km)
3. Where they meet (temp = dewpoint) = condensation = cloud base

### Implementation

```python
# backend/app/services/weather/converter.py
if period.dewpoint is not None and period.temp_max is not None:
    temp_dewpoint_spread = period.temp_max - period.dewpoint
    cloud_base_agl = int(temp_dewpoint_spread * 125)
    cloud_base = base_elevation + max(cloud_base_agl, 100)
```

### Coverage

All countries now use LCL calculation with dewpoint from Open-Meteo (either native or supplemented).

---

## 7. Storm Prediction (CAPE)

### CAPE Thresholds

| CAPE (J/kg) | Severity | Storm Potential |
|-------------|----------|-----------------|
| < 300 | Weak | Unlikely storms |
| 300-1000 | Moderate | Isolated thunderstorms |
| 1000-2500 | Strong | Widespread storms, lightning |
| > 2500 | Extreme | Severe storms, hail possible |

### Storm Patterns

**European Alps / Dolomites:**
- Trigger: Orographic lifting + afternoon heating
- Timing: Predictable (14:00-18:00 local)
- CAPE: 500-1500 J/kg typical in summer
- Warning signs: Building cumulus by noon

**Tasmania / Frontal:**
- Trigger: Cold fronts with embedded thunderstorms
- Timing: Less predictable
- CAPE: Lower (200-800 J/kg)
- Warning signs: Rapid pressure drop, wind shift

### Implementation

```python
# Open-Meteo request
"hourly": "...,cape,..."

# Aggregation (use max in period for peak potential)
cape = int(max(cape_values)) if cape_values else None
```

---

## 8. Recent Precipitation

### Purpose

Trail condition assessment:
- Stream crossing water levels
- Trail mud/wetness
- Recent snow accumulation
- Avalanche risk (snow loading)

### Data Structure

```python
@dataclass
class RecentPrecipitation:
    rain_24h: float = 0.0  # mm in last 24 hours
    rain_48h: float = 0.0  # mm in last 48 hours
    rain_72h: float = 0.0  # mm in last 72 hours
    snow_24h: float = 0.0  # cm in last 24 hours
    snow_48h: float = 0.0  # cm in last 48 hours
    snow_72h: float = 0.0  # cm in last 72 hours
```

### Implementation

```python
# Open-Meteo supports past_days parameter (0-92)
params = {
    "past_days": 3,  # Get last 72 hours
    "hourly": "precipitation,snowfall",
    ...
}

# Sum precipitation by time window
for i, time_str in enumerate(times):
    hours_ago = (now - period_time).total_seconds() / 3600
    if hours_ago <= 24:
        rain_24h += rain
    if hours_ago <= 48:
        rain_48h += rain
    if hours_ago <= 72:
        rain_72h += rain
```

---

## 9. Weather Alerts

### Current Status

| Country | Provider | Status |
|---------|----------|--------|
| US | NWS | ✓ Implemented |
| AU | BOM | Planned (API exists) |
| CA | Environment Canada | ✓ Implemented |
| GB | Met Office | Paid tier only |
| EU | EUMETNET MeteoAlarm | Available (not implemented) |
| NZ | MetService | Commercial API |
| ZA | SAWS | Commercial (via AfriGIS) |

### Alert API Endpoints

**NWS (US):**
```
https://api.weather.gov/alerts?point={lat},{lon}
```

**Environment Canada:**
```python
from env_canada import ECWeather
weather = ECWeather(coordinates=(lat, lon))
await weather.update()
alerts = weather.alerts
```

**MeteoAlarm (EU) - Future:**
```
https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-{country}
```

---

## 10. API Endpoints & Rate Limits

### National Weather Services

| Provider | Endpoint | Rate Limit | Auth |
|----------|----------|------------|------|
| NWS | api.weather.gov | Generous | None (User-Agent required) |
| BOM | api.weather.bom.gov.au | No limit | None |
| Env Canada | via env-canada lib | No limit | None |
| Met Office | datahub.metoffice.gov.uk | 360/day | API Key |

### Open-Meteo

| Endpoint | Rate Limit | Notes |
|----------|------------|-------|
| api.open-meteo.com/v1/forecast | 10,000/day | Free tier |
| api.open-meteo.com/v1/gfs | 10,000/day | HRRR via models param |
| api.open-meteo.com/v1/gem | 10,000/day | Canadian GEM |
| api.open-meteo.com/v1/meteofrance | 10,000/day | AROME model |
| api.open-meteo.com/v1/dwd-icon | 10,000/day | ICON-EU model |
| api.open-meteo.com/v1/ecmwf | 10,000/day | Global model |

### Temporal Resolution

| Provider | Model Update | Forecast Resolution |
|----------|--------------|---------------------|
| NWS | ~6h | 1h available |
| BOM | 6h | 1h (CAST12/24), daily (CAST7) |
| Env Canada | 6h | 1h |
| Met Office | 1h | 1h (D1-2), 3h (D3-7) |
| O-M HRRR | 1h | 1h (15min available) |
| O-M GEM | 6h | 1h |
| O-M ECMWF | 6h | 3h |

---

## 11. Code References

### Core Files

| File | Purpose |
|------|---------|
| `backend/app/services/weather/base.py` | Data models (NormalizedForecast, WeatherAlert, RecentPrecipitation) |
| `backend/app/services/weather/router.py` | Country routing and supplementation |
| `backend/app/services/weather/converter.py` | NormalizedForecast ↔ CellForecast conversion |
| `backend/app/services/weather/cache.py` | 1-hour TTL caching |
| `backend/app/services/bom.py` | BOM service (Australia) |

### Provider Implementations

| File | Provider |
|------|----------|
| `backend/app/services/weather/providers/nws.py` | US National Weather Service |
| `backend/app/services/weather/providers/envcanada.py` | Environment Canada |
| `backend/app/services/weather/providers/metoffice.py` | UK Met Office |
| `backend/app/services/weather/providers/openmeteo.py` | Open-Meteo (all models) |

### Key Data Structures

```python
# NormalizedForecast (per period)
@dataclass
class NormalizedForecast:
    provider: str
    lat: float
    lon: float
    timestamp: datetime
    temp_min: float          # Celsius
    temp_max: float          # Celsius
    rain_chance: int         # 0-100%
    rain_amount: float       # mm
    wind_avg: float          # km/h
    wind_max: float          # km/h
    wind_direction: str      # N, NE, E, SE, S, SW, W, NW
    cloud_cover: int         # 0-100%
    dewpoint: Optional[float]        # Celsius (for LCL)
    freezing_level: Optional[int]    # meters ASL
    snow_amount: float = 0.0         # cm
    cape: Optional[int] = None       # J/kg
    description: str = ""
    alerts: List[WeatherAlert] = field(default_factory=list)

# NormalizedDailyForecast (container)
@dataclass
class NormalizedDailyForecast:
    provider: str
    lat: float
    lon: float
    country_code: str
    periods: List[NormalizedForecast]
    alerts: List[WeatherAlert]
    fetched_at: datetime
    is_fallback: bool = False
    model_elevation: Optional[int] = None
    recent_precip: Optional[RecentPrecipitation] = None

# ForecastPeriod (BOM format)
@dataclass
class ForecastPeriod:
    datetime: datetime
    period: str              # 'N', 'AM', 'PM', or hour like '06'
    temp_min: float
    temp_max: float
    rain_chance: int
    rain_min: float
    rain_max: float
    snow_min: float
    snow_max: float
    wind_avg: int
    wind_max: int
    cloud_cover: int
    cloud_base: int          # meters AGL (LCL calculated)
    dewpoint: Optional[float]
    freezing_level: int
    cape: int

# CellForecast (BOM container)
@dataclass
class CellForecast:
    cell_id: str
    geohash: str
    lat: float
    lon: float
    base_elevation: int
    periods: List[ForecastPeriod]
    fetched_at: datetime
    expires_at: datetime
    is_cached: bool = False
    cache_age_hours: float = 0.0
    source: str = "bom"
    recent_precip: Optional[RecentPrecipitation] = None
```

---

## Changelog

### v1.0 (January 2026)
- Initial specification
- Documented all provider integrations
- Added CAPE for storm prediction
- Added LCL cloud base calculation
- Added recent precipitation (past 72h)
- Added dewpoint supplementation for all countries
