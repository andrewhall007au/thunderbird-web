"""
Bureau of Meteorology (BOM) provider for Australian weather forecasts.

Phase 6: International Weather (WTHR-01)

BOM provides:
- High-quality forecasts for Australian coordinates
- 2.2-3km resolution (ACCESS-C model near cities)
- Free, no API key required
- Geohash-based lookups

This provider wraps the existing BOMService and converts CellForecast
to NormalizedDailyForecast for compatibility with the WeatherRouter.
"""
import logging
from datetime import datetime, timezone
from typing import List

from app.services.weather.base import (
    WeatherProvider,
    NormalizedDailyForecast,
    WeatherAlert,
)
from app.services.bom import BOMService, get_bom_service
from app.services.weather.converter import cell_to_normalized_forecast

logger = logging.getLogger(__name__)


class BOMProvider(WeatherProvider):
    """
    Bureau of Meteorology provider for Australian weather forecasts.

    Uses the undocumented BOM API (api.weather.bom.gov.au) which provides
    high-resolution forecasts for Australia without requiring an API key.

    The BOM service returns CellForecast format, which is converted to
    NormalizedDailyForecast for compatibility with the international
    weather routing system.
    """

    def __init__(self):
        """
        Initialize BOM provider.

        Uses the singleton BOMService instance.
        """
        self._service: BOMService = get_bom_service()

    @property
    def provider_name(self) -> str:
        """Human-readable provider name."""
        return "BOM"

    @property
    def supports_alerts(self) -> bool:
        """BOM does not currently support weather alerts through this provider."""
        return False

    async def get_forecast(
        self,
        lat: float,
        lon: float,
        days: int = 7
    ) -> NormalizedDailyForecast:
        """
        Get normalized forecast for Australian coordinates.

        Args:
            lat: Latitude (-90 to 90)
            lon: Longitude (-180 to 180)
            days: Number of forecast days (1-7)

        Returns:
            NormalizedDailyForecast with periods

        Raises:
            Exception: If BOM API fails or coordinates are invalid
        """
        logger.info(f"Fetching BOM forecast for ({lat}, {lon}), days={days}")

        # BOM service uses 3-hourly periods by default
        # For 7 days, we get ~56 periods (7 days × 8 periods/day)
        # BOM service handles geohash conversion internally

        # Fetch forecast from BOM service
        cell_forecast = await self._service.get_forecast(
            lat=lat,
            lon=lon,
            days=days,
            resolution="3hourly"  # Use 3-hourly for better detail
        )

        # Convert CellForecast to NormalizedDailyForecast
        normalized = cell_to_normalized_forecast(
            cell=cell_forecast,
            country_code="AU"
        )

        # Limit to requested number of days worth of periods
        # Each day has ~8 periods (3-hourly), so days * 8
        max_periods = days * 8
        normalized.periods = normalized.periods[:max_periods]

        logger.info(
            f"BOM forecast fetched: {len(normalized.periods)} periods, "
            f"source={cell_forecast.source}"
        )

        return normalized

    async def get_alerts(
        self,
        lat: float,
        lon: float
    ) -> List[WeatherAlert]:
        """
        Get weather alerts for location.

        BOM alerts are not currently implemented through this provider.

        Args:
            lat: Latitude
            lon: Longitude

        Returns:
            Empty list (alerts not supported)
        """
        logger.debug("BOM alerts not implemented, returning empty list")
        return []
