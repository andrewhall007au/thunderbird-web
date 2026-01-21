"""
National Weather Service (NWS) provider for USA weather forecasts.

Phase 6: International Weather (WTHR-01)

NWS provides:
- High-quality forecasts for US coordinates
- Comprehensive weather alerts
- Free, no API key required
- Requires User-Agent header

Two-step process:
1. Call /points/{lat},{lon} to get grid metadata
2. Use returned forecast URL for actual forecast data

Grid info is cached since it doesn't change for coordinates.
"""
import logging
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, List, Optional

import httpx

from app.services.weather.base import (
    WeatherProvider,
    NormalizedForecast,
    NormalizedDailyForecast,
    WeatherAlert,
)

logger = logging.getLogger(__name__)

# NWS API base URL
BASE_URL = "https://api.weather.gov"

# Required headers for NWS API
NWS_HEADERS = {
    "User-Agent": "(Thunderbird-Web, support@thunderbird.app)",
    "Accept": "application/geo+json",
}

# Wind direction mapping (for compass strings NWS provides)
COMPASS_DIRECTIONS = {
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"
}

# Simplified direction mapping
DIRECTION_MAP = {
    "N": "N", "NNE": "NE", "NE": "NE", "ENE": "E",
    "E": "E", "ESE": "SE", "SE": "SE", "SSE": "S",
    "S": "S", "SSW": "SW", "SW": "SW", "WSW": "W",
    "W": "W", "WNW": "NW", "NW": "NW", "NNW": "N"
}


@dataclass
class _GridInfo:
    """
    NWS grid metadata for a location.

    Required for building forecast URLs.
    """
    office: str  # e.g., "OKX" (New York office)
    gridX: int
    gridY: int
    forecast_url: str
    forecast_hourly_url: str


class NWSProvider(WeatherProvider):
    """
    National Weather Service provider for US weather forecasts.

    The NWS API is free, requires no API key, and provides excellent
    data quality. It's the gold standard for US weather data.

    Note: Only works for US coordinates. For non-US locations,
    the grid lookup will return a 404.
    """

    def __init__(self, timeout: float = 30.0):
        """
        Initialize NWS provider.

        Args:
            timeout: HTTP request timeout in seconds
        """
        self.timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None
        self._grid_cache: Dict[str, _GridInfo] = {}

    @property
    def provider_name(self) -> str:
        """Human-readable provider name."""
        return "NWS"

    @property
    def supports_alerts(self) -> bool:
        """NWS provides comprehensive weather alerts."""
        return True

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=self.timeout,
                headers=NWS_HEADERS,
            )
        return self._client

    async def close(self):
        """Close HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def _get_grid_info(self, lat: float, lon: float) -> _GridInfo:
        """
        Get NWS grid metadata for coordinates.

        Results are cached since grid info doesn't change for a location.

        Args:
            lat: Latitude
            lon: Longitude

        Returns:
            _GridInfo with office, grid coordinates, and forecast URLs

        Raises:
            httpx.HTTPStatusError: For API errors (404 = outside US)
            httpx.TimeoutException: For timeout
        """
        # Check cache first (4 decimal precision = ~11m accuracy)
        cache_key = f"{lat:.4f},{lon:.4f}"
        if cache_key in self._grid_cache:
            logger.debug(f"Grid cache hit for {cache_key}")
            return self._grid_cache[cache_key]

        client = await self._get_client()

        # Call points endpoint
        url = f"{BASE_URL}/points/{lat},{lon}"
        logger.info(f"Fetching NWS grid info for ({lat}, {lon})")

        try:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                logger.warning(f"Coordinates ({lat}, {lon}) outside NWS coverage area")
            raise
        except httpx.TimeoutException:
            logger.error(f"Timeout fetching NWS grid info for ({lat}, {lon})")
            raise

        # Extract grid info from response
        props = data.get("properties", {})

        grid_info = _GridInfo(
            office=props.get("gridId", ""),
            gridX=props.get("gridX", 0),
            gridY=props.get("gridY", 0),
            forecast_url=props.get("forecast", ""),
            forecast_hourly_url=props.get("forecastHourly", ""),
        )

        # Cache the result
        self._grid_cache[cache_key] = grid_info
        logger.debug(f"Cached grid info for {cache_key}: {grid_info.office}")

        return grid_info

    async def get_forecast(
        self,
        lat: float,
        lon: float,
        days: int = 7
    ) -> NormalizedDailyForecast:
        """
        Get normalized forecast for US coordinates.

        Args:
            lat: Latitude (must be within US)
            lon: Longitude (must be within US)
            days: Number of forecast days (NWS provides 7 days)

        Returns:
            NormalizedDailyForecast with periods and any active alerts
        """
        # Get grid info (cached)
        grid_info = await self._get_grid_info(lat, lon)

        client = await self._get_client()

        # Fetch forecast from grid endpoint
        logger.info(f"Fetching NWS forecast from {grid_info.forecast_url}")

        try:
            response = await client.get(grid_info.forecast_url)
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPError as e:
            logger.error(f"NWS forecast API error: {e}")
            raise

        # Parse the forecast
        return self._parse_forecast_response(lat, lon, data)

    def _parse_forecast_response(
        self,
        lat: float,
        lon: float,
        data: dict
    ) -> NormalizedDailyForecast:
        """
        Parse NWS forecast response and normalize to standard format.

        NWS returns 14 periods (7 days x day/night periods).
        We combine day/night into single daily periods.
        """
        periods: List[NormalizedForecast] = []
        fetched_at = datetime.now(timezone.utc)

        raw_periods = data.get("properties", {}).get("periods", [])

        if not raw_periods:
            logger.warning("Empty forecast from NWS API")
            return NormalizedDailyForecast(
                provider=self.provider_name,
                lat=lat,
                lon=lon,
                country_code="US",
                periods=[],
                alerts=[],
                fetched_at=fetched_at,
                is_fallback=False,
            )

        # Process periods - NWS gives day/night pairs
        # We'll process each period individually for more granularity
        for raw_period in raw_periods:
            try:
                period = self._normalize_period(lat, lon, raw_period)
                periods.append(period)
            except (KeyError, ValueError, TypeError) as e:
                logger.warning(f"Error parsing NWS period: {e}")
                continue

        logger.info(f"Parsed {len(periods)} periods from NWS forecast")

        return NormalizedDailyForecast(
            provider=self.provider_name,
            lat=lat,
            lon=lon,
            country_code="US",
            periods=periods,
            alerts=[],  # Alerts fetched separately
            fetched_at=fetched_at,
            is_fallback=False,
        )

    def _normalize_period(
        self,
        lat: float,
        lon: float,
        raw: dict
    ) -> NormalizedForecast:
        """
        Normalize a single NWS forecast period.

        Converts:
        - Temperature: F to C
        - Wind speed: mph string to km/h
        - Extracts rain probability from text if mentioned
        """
        # Parse timestamp
        start_time = raw.get("startTime", "")
        if start_time:
            timestamp = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
        else:
            timestamp = datetime.now(timezone.utc)

        # Temperature conversion (F to C)
        temp_f = raw.get("temperature", 60)
        temp_unit = raw.get("temperatureUnit", "F")

        if temp_unit == "F":
            temp_c = (temp_f - 32) * 5 / 9
        else:
            temp_c = temp_f

        # NWS gives single temp per period (day high or night low)
        is_daytime = raw.get("isDaytime", True)
        if is_daytime:
            temp_max = temp_c
            temp_min = temp_c - 8  # Estimate night temp
        else:
            temp_min = temp_c
            temp_max = temp_c + 8  # Estimate day temp

        # Wind parsing - NWS gives "10 to 15 mph" or "15 mph"
        wind_speed_str = raw.get("windSpeed", "10 mph")
        wind_avg, wind_max = self._parse_wind_speed(wind_speed_str)

        # Wind direction - NWS gives compass direction
        wind_dir = raw.get("windDirection", "N")
        wind_direction = DIRECTION_MAP.get(wind_dir, "N")

        # Extract rain probability from detailed forecast
        detailed = raw.get("detailedForecast", "")
        short = raw.get("shortForecast", "")
        rain_chance = self._extract_rain_probability(detailed)

        # Estimate cloud cover from short forecast
        cloud_cover = self._estimate_cloud_cover(short)

        return NormalizedForecast(
            provider=self.provider_name,
            lat=lat,
            lon=lon,
            timestamp=timestamp,
            temp_min=round(temp_min, 1),
            temp_max=round(temp_max, 1),
            rain_chance=rain_chance,
            rain_amount=0.0,  # NWS doesn't provide exact amounts in basic forecast
            wind_avg=round(wind_avg, 1),
            wind_max=round(wind_max, 1),
            wind_direction=wind_direction,
            cloud_cover=cloud_cover,
            freezing_level=None,  # NWS doesn't provide in basic forecast
            snow_amount=0.0,  # NWS doesn't provide exact amounts
            description=short,
            alerts=[],
        )

    def _parse_wind_speed(self, wind_str: str) -> tuple[float, float]:
        """
        Parse NWS wind speed string to km/h.

        Examples:
            "10 to 15 mph" -> (16.1, 24.1)
            "15 mph" -> (24.1, 24.1)
            "5 to 10 mph" -> (8.0, 16.1)
        """
        # Extract numbers from string
        numbers = re.findall(r'\d+', wind_str)

        if not numbers:
            return (16.0, 24.0)  # Default to moderate wind

        # Convert mph to km/h (1 mph = 1.60934 km/h)
        mph_to_kmh = 1.60934

        if len(numbers) >= 2:
            low = float(numbers[0]) * mph_to_kmh
            high = float(numbers[1]) * mph_to_kmh
            return (low, high)
        else:
            speed = float(numbers[0]) * mph_to_kmh
            return (speed, speed + 10)  # Add small buffer for gusts

    def _extract_rain_probability(self, detailed: str) -> int:
        """
        Extract rain probability from NWS detailed forecast text.

        Examples:
            "Chance of rain 40 percent" -> 40
            "Rain likely, with a 70 percent chance" -> 70
            "Partly cloudy" -> 0
        """
        if not detailed:
            return 0

        detailed_lower = detailed.lower()

        # Look for explicit percentage
        match = re.search(r'(\d+)\s*percent', detailed_lower)
        if match:
            return int(match.group(1))

        # Keyword-based estimation
        if 'rain likely' in detailed_lower or 'showers likely' in detailed_lower:
            return 70
        if 'chance of rain' in detailed_lower or 'chance of showers' in detailed_lower:
            return 40
        if 'slight chance' in detailed_lower:
            return 20
        if 'rain' in detailed_lower or 'showers' in detailed_lower:
            return 50

        return 0

    def _estimate_cloud_cover(self, short_forecast: str) -> int:
        """
        Estimate cloud cover percentage from NWS short forecast.

        Examples:
            "Sunny" -> 10
            "Partly Cloudy" -> 50
            "Cloudy" -> 90
            "Mostly Sunny" -> 30
        """
        if not short_forecast:
            return 50

        short_lower = short_forecast.lower()

        if 'sunny' in short_lower or 'clear' in short_lower:
            if 'partly' in short_lower:
                return 40
            if 'mostly' in short_lower:
                return 30
            return 10

        if 'cloudy' in short_lower:
            if 'partly' in short_lower:
                return 50
            if 'mostly' in short_lower:
                return 80
            return 90

        if 'overcast' in short_lower:
            return 100

        if 'fog' in short_lower or 'haze' in short_lower:
            return 70

        return 50  # Default to partly cloudy

    async def get_alerts(
        self,
        lat: float,
        lon: float
    ) -> List[WeatherAlert]:
        """
        Get active weather alerts for coordinates.

        Args:
            lat: Latitude
            lon: Longitude

        Returns:
            List of WeatherAlert objects (empty if none or error)
        """
        client = await self._get_client()

        # Use point parameter to filter alerts
        url = f"{BASE_URL}/alerts/active"
        params = {"point": f"{lat},{lon}"}

        logger.info(f"Fetching NWS alerts for ({lat}, {lon})")

        try:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPError as e:
            logger.warning(f"NWS alerts API error: {e}")
            return []  # Don't fail on alerts - return empty list

        return self._parse_alerts_response(data)

    def _parse_alerts_response(self, data: dict) -> List[WeatherAlert]:
        """
        Parse NWS alerts response to WeatherAlert objects.
        """
        alerts: List[WeatherAlert] = []

        features = data.get("features", [])

        for feature in features:
            try:
                props = feature.get("properties", {})

                # Parse expiration time
                expires_str = props.get("expires")
                expires = None
                if expires_str:
                    try:
                        expires = datetime.fromisoformat(expires_str.replace("Z", "+00:00"))
                    except ValueError:
                        pass

                alert = WeatherAlert(
                    event=props.get("event", "Weather Alert"),
                    headline=props.get("headline", ""),
                    severity=props.get("severity", "Unknown"),
                    urgency=props.get("urgency", "Unknown"),
                    expires=expires,
                )
                alerts.append(alert)

            except (KeyError, ValueError, TypeError) as e:
                logger.warning(f"Error parsing NWS alert: {e}")
                continue

        logger.info(f"Found {len(alerts)} active alerts")
        return alerts
