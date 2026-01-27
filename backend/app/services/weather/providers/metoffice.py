"""
Met Office Weather DataHub provider for UK weather forecasts.

Phase 6: International Weather (WTHR-03)

Met Office Weather DataHub provides:
- Official UK Met Office forecasts
- Site-specific hourly/daily data
- Free tier: 360 calls/day

IMPORTANT: Uses Weather DataHub API, NOT the deprecated DataPoint service.

Elevation handling:
- Met Office IMPROVER applies lapse rate correction to site-specific forecasts
- Temperature is adjusted TO the requested location's elevation
- We extract elevation from response geometry or use Open Topo Data
- model_elevation = the elevation temps are valid for (user's point)
"""
import logging
import os
from datetime import datetime, timezone
from typing import List, Optional

import httpx

from app.services.weather.base import (
    WeatherProvider,
    NormalizedForecast,
    NormalizedDailyForecast,
    WeatherAlert,
)

logger = logging.getLogger(__name__)


# Weather DataHub API base URL
API_BASE = "https://data.hub.api.metoffice.gov.uk/sitespecific/v0"


# Met Office significant weather codes
WEATHER_CODES = {
    -1: "Trace rain",
    0: "Clear night",
    1: "Sunny day",
    2: "Partly cloudy (night)",
    3: "Partly cloudy (day)",
    4: "Not used",
    5: "Mist",
    6: "Fog",
    7: "Cloudy",
    8: "Overcast",
    9: "Light rain shower (night)",
    10: "Light rain shower (day)",
    11: "Drizzle",
    12: "Light rain",
    13: "Heavy rain shower (night)",
    14: "Heavy rain shower (day)",
    15: "Heavy rain",
    16: "Sleet shower (night)",
    17: "Sleet shower (day)",
    18: "Sleet",
    19: "Hail shower (night)",
    20: "Hail shower (day)",
    21: "Hail",
    22: "Light snow shower (night)",
    23: "Light snow shower (day)",
    24: "Light snow",
    25: "Heavy snow shower (night)",
    26: "Heavy snow shower (day)",
    27: "Heavy snow",
    28: "Thunder shower (night)",
    29: "Thunder shower (day)",
    30: "Thunder",
}


# Wind direction conversion (degrees to compass)
WIND_DIRECTIONS = [
    (0, 22.5, "N"),
    (22.5, 67.5, "NE"),
    (67.5, 112.5, "E"),
    (112.5, 157.5, "SE"),
    (157.5, 202.5, "S"),
    (202.5, 247.5, "SW"),
    (247.5, 292.5, "W"),
    (292.5, 337.5, "NW"),
    (337.5, 360, "N"),
]


def degrees_to_compass(degrees: Optional[float]) -> str:
    """Convert wind direction in degrees to compass direction."""
    if degrees is None:
        return "N"
    degrees = degrees % 360
    for low, high, direction in WIND_DIRECTIONS:
        if low <= degrees < high:
            return direction
    return "N"


class MetOfficeProvider(WeatherProvider):
    """
    Met Office Weather DataHub provider for UK forecasts.

    Uses the Site Specific API for hourly forecasts.
    Free tier allows 360 calls/day.
    """

    def __init__(self, timeout: float = 30.0):
        """
        Initialize Met Office provider.

        Args:
            timeout: HTTP request timeout in seconds
        """
        self.api_key = os.environ.get("METOFFICE_API_KEY")
        self.timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def provider_name(self) -> str:
        """Human-readable provider name."""
        return "Met Office"

    @property
    def supports_alerts(self) -> bool:
        """Met Office free tier does not support weather alerts."""
        return False

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=self.timeout,
                headers={
                    "User-Agent": "Thunderbird-Weather/1.0",
                    "Accept": "application/json",
                    "apikey": self.api_key or "",
                },
            )
        return self._client

    async def close(self):
        """Close HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def get_forecast(
        self,
        lat: float,
        lon: float,
        days: int = 7
    ) -> NormalizedDailyForecast:
        """
        Get normalized forecast for UK coordinates.

        Args:
            lat: Latitude (-90 to 90)
            lon: Longitude (-180 to 180)
            days: Number of forecast days (1-7, API max is ~7 days)

        Returns:
            NormalizedDailyForecast with 3-hour period forecasts

        Raises:
            ValueError: If METOFFICE_API_KEY is not configured
        """
        if not self.api_key:
            raise ValueError("METOFFICE_API_KEY not configured")

        client = await self._get_client()

        # Build request URL
        url = f"{API_BASE}/point/hourly"
        params = {
            "latitude": lat,
            "longitude": lon,
        }

        logger.info(f"Fetching Met Office forecast for ({lat}, {lon}), {days} days")

        try:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPError as e:
            logger.error(f"Met Office API error: {e}")
            raise

        return self._parse_response(lat, lon, data, days)

    def _parse_response(
        self,
        lat: float,
        lon: float,
        data: dict,
        days: int
    ) -> NormalizedDailyForecast:
        """
        Parse Met Office API response and normalize to our format.

        Aggregates hourly data into 3-hour periods for consistency
        with other providers.

        Elevation handling:
        - Met Office IMPROVER applies lapse rate correction to the requested point
        - Temperature is already adjusted for the location's actual elevation
        - We extract elevation from geometry.coordinates[2] if available
        - Otherwise use Open Topo Data to get point elevation
        """
        periods: List[NormalizedForecast] = []
        fetched_at = datetime.now(timezone.utc)

        # Extract time series from response
        features = data.get("features", [])
        if not features:
            logger.warning("Empty response from Met Office API")
            return NormalizedDailyForecast(
                provider=self.provider_name,
                lat=lat,
                lon=lon,
                country_code="GB",
                periods=[],
                alerts=[],
                fetched_at=fetched_at,
                is_fallback=False,
                model_elevation=None,
            )

        # Extract elevation from response geometry if available
        # Met Office returns [lon, lat, elevation] in geometry.coordinates
        model_elevation: Optional[int] = None
        geometry = features[0].get("geometry", {})
        coords = geometry.get("coordinates", [])
        if len(coords) >= 3 and coords[2] is not None:
            model_elevation = int(coords[2])
            logger.info(f"Met Office elevation from response: {model_elevation}m")

        time_series = features[0].get("properties", {}).get("timeSeries", [])
        if not time_series:
            logger.warning("No time series data in Met Office response")
            return NormalizedDailyForecast(
                provider=self.provider_name,
                lat=lat,
                lon=lon,
                country_code="GB",
                periods=[],
                alerts=[],
                fetched_at=fetched_at,
                is_fallback=False,
                model_elevation=model_elevation,
            )

        # Limit to requested number of days (days * 8 = 3-hour periods per day)
        max_periods = days * 8
        step = 3  # Aggregate 3 hourly entries into one period

        for i in range(0, min(len(time_series), max_periods * step), step):
            if i + step > len(time_series):
                break

            try:
                agg_range = time_series[i:i + step]

                # Parse timestamp for period start
                period_time = datetime.fromisoformat(
                    agg_range[0]["time"].replace("Z", "+00:00")
                )

                # Aggregate temperature
                temps = [
                    e.get("screenTemperature")
                    for e in agg_range
                    if e.get("screenTemperature") is not None
                ]
                temp_min = min(temps) if temps else 10.0
                temp_max = max(temps) if temps else 15.0

                # Aggregate wind (convert m/s to km/h)
                wind_speeds = [
                    e.get("windSpeed10m", 0) * 3.6
                    for e in agg_range
                    if e.get("windSpeed10m") is not None
                ]
                wind_gusts = [
                    e.get("windGustSpeed10m", 0) * 3.6
                    for e in agg_range
                    if e.get("windGustSpeed10m") is not None
                ]
                wind_avg = sum(wind_speeds) / len(wind_speeds) if wind_speeds else 20.0
                wind_max = max(wind_gusts) if wind_gusts else wind_avg + 15

                # Wind direction from first entry
                wind_dir_deg = agg_range[0].get("windDirectionFrom10m")
                wind_direction = degrees_to_compass(wind_dir_deg)

                # Precipitation
                rain_probs = [
                    e.get("probOfPrecipitation", 0)
                    for e in agg_range
                    if e.get("probOfPrecipitation") is not None
                ]
                rain_rates = [
                    e.get("precipitationRate", 0)
                    for e in agg_range
                    if e.get("precipitationRate") is not None
                ]
                rain_chance = int(max(rain_probs)) if rain_probs else 0
                # precipitationRate is mm/hr, multiply by hours for total
                rain_amount = sum(rain_rates) if rain_rates else 0.0

                # Snow (totalSnowAmount in mm, convert to cm)
                snow_amounts = [
                    e.get("totalSnowAmount", 0) / 10
                    for e in agg_range
                    if e.get("totalSnowAmount") is not None
                ]
                snow_amount = sum(snow_amounts) if snow_amounts else 0.0

                # Cloud cover - estimate from visibility if not available
                # Met Office uses visibility, we'll map to approximate cloud cover
                visibilities = [
                    e.get("visibility", 20000)
                    for e in agg_range
                ]
                avg_visibility = sum(visibilities) / len(visibilities) if visibilities else 20000
                # Map visibility to cloud cover (rough approximation)
                if avg_visibility > 15000:
                    cloud_cover = 20
                elif avg_visibility > 5000:
                    cloud_cover = 50
                else:
                    cloud_cover = 80

                # Weather code for description
                weather_codes = [
                    e.get("significantWeatherCode", 7)
                    for e in agg_range
                    if e.get("significantWeatherCode") is not None
                ]
                dominant_code = max(set(weather_codes), key=weather_codes.count) if weather_codes else 7
                description = WEATHER_CODES.get(dominant_code, "Unknown")

                period = NormalizedForecast(
                    provider=self.provider_name,
                    lat=lat,
                    lon=lon,
                    timestamp=period_time,
                    temp_min=round(temp_min, 1),
                    temp_max=round(temp_max, 1),
                    rain_chance=rain_chance,
                    rain_amount=round(rain_amount, 1),
                    wind_avg=round(wind_avg, 1),
                    wind_max=round(wind_max, 1),
                    wind_direction=wind_direction,
                    cloud_cover=cloud_cover,
                    freezing_level=None,  # Not in Met Office free tier
                    snow_amount=round(snow_amount, 1),
                    description=description,
                    alerts=[],
                )
                periods.append(period)

            except (KeyError, ValueError, TypeError) as e:
                logger.warning(f"Error parsing Met Office period {i}: {e}")
                continue

        logger.info(f"Parsed {len(periods)} periods from Met Office response (elevation={model_elevation}m)")

        return NormalizedDailyForecast(
            provider=self.provider_name,
            lat=lat,
            lon=lon,
            country_code="GB",
            periods=periods,
            alerts=[],  # Not supported in free tier
            fetched_at=fetched_at,
            is_fallback=False,
            model_elevation=model_elevation,
        )

    async def get_alerts(
        self,
        lat: float,
        lon: float
    ) -> List[WeatherAlert]:
        """
        Get weather alerts for UK location.

        Not supported in Met Office free tier.

        Returns:
            Empty list (alerts not available)
        """
        return []
