"""
Open-Meteo weather provider - universal fallback for any coordinates.

Phase 6: International Weather (WTHR-09, WTHR-10)

Open-Meteo provides:
- Global coverage (any coordinates)
- Free, no API key required
- 7-16 day forecasts with hourly resolution
- Model selection (best_match, meteofrance, icon_eu, etc.)

Used as:
- Universal fallback when country-specific APIs fail
- Primary provider for countries without national API
- Reference implementation for normalization patterns
"""
import logging
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


# Model-specific API endpoints
OPENMETEO_ENDPOINTS = {
    "best_match": "https://api.open-meteo.com/v1/forecast",
    "meteofrance": "https://api.open-meteo.com/v1/meteofrance",
    "meteoswiss": "https://api.open-meteo.com/v1/meteoswiss",
    "icon_eu": "https://api.open-meteo.com/v1/dwd-icon",
    "gfs": "https://api.open-meteo.com/v1/gfs",
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


def parse_iso_datetime(dt_string: str) -> datetime:
    """Parse ISO datetime string from Open-Meteo API."""
    # Open-Meteo returns "2026-01-21T00:00" format (no timezone)
    # The timezone is specified separately in response
    if "T" in dt_string:
        return datetime.fromisoformat(dt_string)
    return datetime.fromisoformat(dt_string + "T00:00:00")


class OpenMeteoProvider(WeatherProvider):
    """
    Open-Meteo weather provider for global coverage.

    Supports model selection for regional optimization:
    - best_match (default): Auto-selects best model
    - meteofrance: Optimized for France/Europe
    - meteoswiss: Optimized for Switzerland/Alps
    - icon_eu: German DWD ICON model for Europe
    - gfs: US GFS model for global coverage
    """

    def __init__(self, model: str = "best_match", timeout: float = 30.0):
        """
        Initialize Open-Meteo provider.

        Args:
            model: Model to use (best_match, meteofrance, meteoswiss, icon_eu, gfs)
            timeout: HTTP request timeout in seconds
        """
        self.model = model
        self.timeout = timeout
        self._api_url = OPENMETEO_ENDPOINTS.get(model, OPENMETEO_ENDPOINTS["best_match"])
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def provider_name(self) -> str:
        """Human-readable provider name."""
        if self.model == "best_match":
            return "Open-Meteo"
        model_names = {
            "meteofrance": "Open-Meteo (Meteo-France)",
            "meteoswiss": "Open-Meteo (MeteoSwiss)",
            "icon_eu": "Open-Meteo (DWD ICON)",
            "gfs": "Open-Meteo (GFS)",
        }
        return model_names.get(self.model, f"Open-Meteo ({self.model})")

    @property
    def supports_alerts(self) -> bool:
        """Open-Meteo does not support weather alerts."""
        return False

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=self.timeout,
                headers={
                    "User-Agent": "Thunderbird-Weather/1.0",
                    "Accept": "application/json",
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
        Get normalized forecast for coordinates.

        Fetches hourly data and aggregates into 3-hour periods for
        consistency with other providers.

        Args:
            lat: Latitude (-90 to 90)
            lon: Longitude (-180 to 180)
            days: Number of forecast days (1-16)

        Returns:
            NormalizedDailyForecast with 3-hour period forecasts
        """
        client = await self._get_client()

        # Build request parameters
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
                "freezing_level_height",
            ]),
            "timezone": "auto",
            "forecast_days": min(days, 16),
        }

        logger.info(f"Fetching Open-Meteo forecast for ({lat}, {lon}), {days} days")

        try:
            response = await client.get(self._api_url, params=params)
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPError as e:
            logger.error(f"Open-Meteo API error: {e}")
            raise

        return self._parse_response(lat, lon, data)

    def _parse_response(
        self,
        lat: float,
        lon: float,
        data: dict
    ) -> NormalizedDailyForecast:
        """
        Parse Open-Meteo API response and normalize to our format.

        Aggregates hourly data into 3-hour periods for consistency
        with the existing BOM provider pattern.
        """
        periods: List[NormalizedForecast] = []
        fetched_at = datetime.now(timezone.utc)

        hourly = data.get("hourly", {})
        times = hourly.get("time", [])

        if not times:
            logger.warning("Empty response from Open-Meteo API")
            return NormalizedDailyForecast(
                provider=self.provider_name,
                lat=lat,
                lon=lon,
                country_code="",  # Will be set by caller
                periods=[],
                alerts=[],
                fetched_at=fetched_at,
                is_fallback=False,
            )

        # Aggregate hourly data into 3-hour periods
        step = 3
        for i in range(0, len(times), step):
            if i + step > len(times):
                break

            try:
                # Parse timestamp for period start
                period_time = parse_iso_datetime(times[i])

                # Get the 3-hour range for aggregation
                agg_range = range(i, min(i + step, len(times)))

                # Extract values, handling None gracefully
                temps = self._get_values(hourly, "temperature_2m", agg_range)
                precip_probs = self._get_values(hourly, "precipitation_probability", agg_range)
                precips = self._get_values(hourly, "precipitation", agg_range)
                snowfalls = self._get_values(hourly, "snowfall", agg_range)
                wind_speeds = self._get_values(hourly, "wind_speed_10m", agg_range)
                wind_gusts = self._get_values(hourly, "wind_gusts_10m", agg_range)
                wind_dirs = self._get_values(hourly, "wind_direction_10m", agg_range)
                cloud_covers = self._get_values(hourly, "cloud_cover", agg_range)
                freezing_levels = self._get_values(hourly, "freezing_level_height", agg_range)

                # Calculate aggregates
                temp_min = min(temps) if temps else 10.0
                temp_max = max(temps) if temps else 15.0
                rain_chance = int(max(precip_probs)) if precip_probs else 0
                rain_amount = sum(precips) if precips else 0.0
                snow_amount = sum(snowfalls) if snowfalls else 0.0
                wind_avg = sum(wind_speeds) / len(wind_speeds) if wind_speeds else 20.0
                wind_max = max(wind_gusts) if wind_gusts else wind_avg + 15
                wind_direction = degrees_to_compass(wind_dirs[0] if wind_dirs else None)
                cloud_cover = int(sum(cloud_covers) / len(cloud_covers)) if cloud_covers else 50
                freezing_level = int(sum(freezing_levels) / len(freezing_levels)) if freezing_levels else None

                # Generate description
                description = self._generate_description(
                    temp_max, rain_chance, rain_amount, snow_amount, wind_max, cloud_cover
                )

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
                    freezing_level=freezing_level,
                    snow_amount=round(snow_amount, 1),
                    description=description,
                    alerts=[],
                )
                periods.append(period)

            except (KeyError, ValueError, TypeError) as e:
                logger.warning(f"Error parsing Open-Meteo period {i}: {e}")
                continue

        logger.info(f"Parsed {len(periods)} periods from Open-Meteo response")

        return NormalizedDailyForecast(
            provider=self.provider_name,
            lat=lat,
            lon=lon,
            country_code="",  # Will be set by caller based on coordinates
            periods=periods,
            alerts=[],  # Open-Meteo doesn't support alerts
            fetched_at=fetched_at,
            is_fallback=False,
        )

    def _get_values(
        self,
        hourly: dict,
        key: str,
        indices: range
    ) -> List[float]:
        """Extract non-None values for given indices from hourly data."""
        values = hourly.get(key, [])
        result = []
        for i in indices:
            if i < len(values) and values[i] is not None:
                result.append(float(values[i]))
        return result

    def _generate_description(
        self,
        temp_max: float,
        rain_chance: int,
        rain_amount: float,
        snow_amount: float,
        wind_max: float,
        cloud_cover: int
    ) -> str:
        """Generate a text summary of conditions."""
        parts = []

        # Temperature
        if temp_max < 0:
            parts.append("Freezing")
        elif temp_max < 10:
            parts.append("Cold")
        elif temp_max > 25:
            parts.append("Hot")

        # Precipitation
        if snow_amount > 0:
            if snow_amount > 5:
                parts.append("heavy snow")
            else:
                parts.append("snow")
        elif rain_amount > 0 or rain_chance > 50:
            if rain_amount > 10:
                parts.append("heavy rain")
            elif rain_chance > 70:
                parts.append("likely rain")
            elif rain_chance > 30:
                parts.append("possible rain")

        # Wind
        if wind_max > 60:
            parts.append("strong winds")
        elif wind_max > 40:
            parts.append("windy")

        # Cloud
        if cloud_cover < 20:
            parts.append("clear")
        elif cloud_cover > 80:
            parts.append("cloudy")
        elif cloud_cover > 50:
            parts.append("partly cloudy")

        if not parts:
            return "Mild conditions"

        return ", ".join(parts).capitalize()
