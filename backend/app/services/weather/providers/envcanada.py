"""
Environment Canada weather provider for Canadian coordinates.

Phase 6: International Weather (WTHR-02)

Environment Canada provides:
- Official government weather data for Canada
- Weather alerts and warnings
- Daily and hourly forecasts

Note: The env-canada library depends on Environment Canada's data distribution
platform (dd.weather.gc.ca) which has intermittent availability issues.
The provider handles these gracefully and allows fallback to Open-Meteo.
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


class EnvironmentCanadaProvider(WeatherProvider):
    """
    Environment Canada weather provider for Canadian coordinates.

    Uses the env-canada library when available, with graceful fallback
    when the Environment Canada API is unavailable.

    Note: Environment Canada's data distribution platform (dd.weather.gc.ca)
    occasionally has availability issues. When this happens, the provider
    raises an exception so the system can use Open-Meteo as fallback.
    """

    def __init__(self, timeout: float = 30.0):
        """
        Initialize Environment Canada provider.

        Args:
            timeout: HTTP request timeout in seconds
        """
        self.timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def provider_name(self) -> str:
        """Human-readable provider name."""
        return "Environment Canada"

    @property
    def supports_alerts(self) -> bool:
        """Environment Canada supports weather alerts."""
        return True

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
        Get normalized forecast for Canadian coordinates.

        Attempts to use the env-canada library for official Environment Canada
        data. If the EC API is unavailable, raises an exception to trigger
        fallback to Open-Meteo.

        Args:
            lat: Latitude (-90 to 90)
            lon: Longitude (-180 to 180)
            days: Number of forecast days (1-7)

        Returns:
            NormalizedDailyForecast with daily period forecasts

        Raises:
            Exception: If Environment Canada API is unavailable
        """
        # Validate coordinates are within Canada bounds (approximately)
        if not (41.0 <= lat <= 84.0 and -141.0 <= lon <= -52.0):
            logger.warning(
                f"Coordinates ({lat}, {lon}) are outside Canada bounds"
            )
            raise ValueError("Coordinates are outside Environment Canada coverage")

        try:
            # Import env-canada library
            from env_canada import ECWeather

            # Create weather object with coordinates
            weather = ECWeather(coordinates=(lat, lon))

            # Fetch weather data
            await weather.update()

            return self._parse_ec_response(lat, lon, weather, days)

        except ImportError:
            logger.error("env-canada library not installed")
            raise RuntimeError("env-canada library not available")

        except Exception as e:
            error_msg = str(e)

            # Handle known EC API issues
            if "404" in error_msg or "Not Found" in error_msg:
                logger.warning(
                    f"Environment Canada API unavailable: {error_msg}"
                )
                raise RuntimeError(
                    "Environment Canada API temporarily unavailable. "
                    "Use Open-Meteo fallback for Canadian forecasts."
                )

            # Handle timeout
            if "timeout" in error_msg.lower():
                logger.warning(f"Environment Canada API timeout: {error_msg}")
                raise RuntimeError(
                    "Environment Canada API timeout. "
                    "Use Open-Meteo fallback for Canadian forecasts."
                )

            # Re-raise other errors
            logger.error(f"Environment Canada API error: {e}")
            raise

    def _parse_ec_response(
        self,
        lat: float,
        lon: float,
        weather,  # ECWeather object
        days: int
    ) -> NormalizedDailyForecast:
        """
        Parse Environment Canada weather data into normalized format.

        Args:
            lat: Request latitude
            lon: Request longitude
            weather: ECWeather object with populated data
            days: Number of days to include

        Returns:
            NormalizedDailyForecast with normalized periods
        """
        periods: List[NormalizedForecast] = []
        fetched_at = datetime.now(timezone.utc)

        # Process daily forecasts from env-canada
        daily_forecasts = getattr(weather, 'daily_forecasts', [])

        for i, day in enumerate(daily_forecasts[:days]):
            if i >= days:
                break

            try:
                # Extract temperature (already in Celsius)
                temp_high = self._safe_float(day.get('temperature'), 15.0)
                temp_low = self._safe_float(day.get('temperature_low'), temp_high - 5)

                # Precipitation
                precip_chance = self._safe_int(day.get('precip_probability'), 0)

                # Extract description for conditions
                text_summary = day.get('text_summary', '')
                short_text = day.get('short_text', '')

                # Wind (may not be available in daily forecast)
                wind_speed = self._safe_float(day.get('wind_speed'), 15.0)
                wind_gust = self._safe_float(day.get('wind_gust'), wind_speed + 10)
                wind_dir = day.get('wind_direction', 'N')

                # Estimate cloud cover from conditions text
                cloud_cover = self._estimate_cloud_cover(text_summary or short_text)

                # Estimate precipitation amount
                rain_amount = self._estimate_precip_amount(precip_chance, text_summary)
                snow_amount = 0.0
                if 'snow' in text_summary.lower():
                    snow_amount = rain_amount / 10  # Rough conversion
                    rain_amount = 0.0

                # Generate timestamp for this day
                timestamp = fetched_at.replace(
                    hour=12, minute=0, second=0, microsecond=0
                )
                if i > 0:
                    from datetime import timedelta
                    timestamp = timestamp + timedelta(days=i)

                period = NormalizedForecast(
                    provider=self.provider_name,
                    lat=lat,
                    lon=lon,
                    timestamp=timestamp,
                    temp_min=round(temp_low, 1),
                    temp_max=round(temp_high, 1),
                    rain_chance=precip_chance,
                    rain_amount=round(rain_amount, 1),
                    wind_avg=round(wind_speed, 1),
                    wind_max=round(wind_gust, 1),
                    wind_direction=wind_dir if wind_dir else "N",
                    cloud_cover=cloud_cover,
                    freezing_level=None,  # Not provided by EC
                    snow_amount=round(snow_amount, 1),
                    description=text_summary[:200] if text_summary else short_text[:200] if short_text else "No forecast available",
                    alerts=[],
                )
                periods.append(period)

            except (KeyError, ValueError, TypeError) as e:
                logger.warning(f"Error parsing EC day {i}: {e}")
                continue

        logger.info(f"Parsed {len(periods)} periods from Environment Canada")

        return NormalizedDailyForecast(
            provider=self.provider_name,
            lat=lat,
            lon=lon,
            country_code="CA",
            periods=periods,
            alerts=[],  # Alerts fetched separately via get_alerts()
            fetched_at=fetched_at,
            is_fallback=False,
        )

    async def get_alerts(
        self,
        lat: float,
        lon: float
    ) -> List[WeatherAlert]:
        """
        Get weather alerts for Canadian location.

        Environment Canada provides detailed weather warnings, watches,
        advisories, and statements.

        Args:
            lat: Latitude
            lon: Longitude

        Returns:
            List of active WeatherAlert objects
        """
        try:
            from env_canada import ECWeather

            weather = ECWeather(coordinates=(lat, lon))
            await weather.update()

            return self._parse_ec_alerts(weather)

        except ImportError:
            logger.error("env-canada library not installed")
            return []

        except Exception as e:
            logger.warning(f"Error fetching EC alerts: {e}")
            return []

    def _parse_ec_alerts(self, weather) -> List[WeatherAlert]:
        """
        Parse Environment Canada alerts into WeatherAlert format.

        Args:
            weather: ECWeather object with populated alerts

        Returns:
            List of WeatherAlert objects
        """
        alerts_list: List[WeatherAlert] = []

        ec_alerts = getattr(weather, 'alerts', {})

        # EC alerts can be a dict with alert types as keys
        if isinstance(ec_alerts, dict):
            for alert_type, alert_data in ec_alerts.items():
                if not alert_data:
                    continue

                # alert_data may be a list or single dict
                if isinstance(alert_data, list):
                    for alert in alert_data:
                        parsed = self._parse_single_alert(alert, alert_type)
                        if parsed:
                            alerts_list.append(parsed)
                elif isinstance(alert_data, dict):
                    parsed = self._parse_single_alert(alert_data, alert_type)
                    if parsed:
                        alerts_list.append(parsed)

        logger.info(f"Parsed {len(alerts_list)} alerts from Environment Canada")
        return alerts_list

    def _parse_single_alert(
        self,
        alert: dict,
        alert_type: str
    ) -> Optional[WeatherAlert]:
        """
        Parse a single EC alert into WeatherAlert format.

        Args:
            alert: Alert dictionary from EC
            alert_type: Type of alert (warning, watch, statement, advisory)

        Returns:
            WeatherAlert or None if parsing fails
        """
        try:
            # Extract event name
            event = alert.get('title') or alert.get('event') or alert_type.capitalize()

            # Extract description/headline
            headline = alert.get('text', '')
            if not headline:
                headline = alert.get('description', '')
            headline = headline[:200] if headline else f"{event} in effect"

            # Map EC alert type to severity
            severity = self._map_alert_severity(alert_type)

            # Urgency - EC doesn't provide this directly
            urgency = "Expected"

            # Expiry time - try to parse if available
            expires = None
            expires_str = alert.get('expires') or alert.get('expiry_time')
            if expires_str:
                try:
                    from dateutil.parser import parse as parse_datetime
                    expires = parse_datetime(expires_str)
                except (ImportError, ValueError):
                    pass

            return WeatherAlert(
                event=event,
                headline=headline,
                severity=severity,
                urgency=urgency,
                expires=expires,
            )

        except Exception as e:
            logger.warning(f"Error parsing EC alert: {e}")
            return None

    def _map_alert_severity(self, alert_type: str) -> str:
        """
        Map Environment Canada alert type to severity level.

        Args:
            alert_type: EC alert type string

        Returns:
            Severity string (Minor, Moderate, Severe, Extreme)
        """
        alert_type_lower = alert_type.lower()

        if 'warning' in alert_type_lower:
            return "Severe"
        elif 'watch' in alert_type_lower:
            return "Moderate"
        elif 'advisory' in alert_type_lower:
            return "Moderate"
        elif 'statement' in alert_type_lower:
            return "Minor"
        else:
            return "Minor"

    def _safe_float(self, value, default: float) -> float:
        """Safely convert value to float with default."""
        if value is None:
            return default
        try:
            return float(value)
        except (ValueError, TypeError):
            return default

    def _safe_int(self, value, default: int) -> int:
        """Safely convert value to int with default."""
        if value is None:
            return default
        try:
            return int(value)
        except (ValueError, TypeError):
            return default

    def _estimate_cloud_cover(self, text: str) -> int:
        """
        Estimate cloud cover percentage from conditions text.

        Args:
            text: Conditions description

        Returns:
            Estimated cloud cover 0-100%
        """
        text_lower = text.lower() if text else ""

        if 'clear' in text_lower or 'sunny' in text_lower:
            return 10
        elif 'mainly sunny' in text_lower or 'mostly clear' in text_lower:
            return 25
        elif 'partly cloudy' in text_lower or 'a mix of' in text_lower:
            return 50
        elif 'mostly cloudy' in text_lower or 'mainly cloudy' in text_lower:
            return 75
        elif 'cloudy' in text_lower or 'overcast' in text_lower:
            return 90
        else:
            return 50  # Default to partly cloudy

    def _estimate_precip_amount(self, chance: int, text: str) -> float:
        """
        Estimate precipitation amount from chance and text.

        Args:
            chance: Precipitation probability 0-100
            text: Conditions description

        Returns:
            Estimated precipitation in mm
        """
        if chance == 0:
            return 0.0

        text_lower = text.lower() if text else ""

        # Check for intensity descriptions
        if 'heavy' in text_lower or 'significant' in text_lower:
            base_amount = 15.0
        elif 'moderate' in text_lower:
            base_amount = 8.0
        elif 'light' in text_lower or 'slight' in text_lower:
            base_amount = 2.0
        elif 'periods of' in text_lower or 'chance of' in text_lower:
            base_amount = 5.0
        else:
            base_amount = 5.0

        # Scale by probability
        return base_amount * (chance / 100)
