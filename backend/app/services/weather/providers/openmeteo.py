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
from datetime import datetime
from typing import Optional

import httpx

from app.services.weather.base import (
    WeatherProvider,
    NormalizedForecast,
    NormalizedDailyForecast,
    WeatherAlert,
)

logger = logging.getLogger(__name__)


# Placeholder - will be implemented in Task 2
class OpenMeteoProvider(WeatherProvider):
    """Open-Meteo weather provider - placeholder for imports."""

    @property
    def provider_name(self) -> str:
        return "Open-Meteo"

    async def get_forecast(
        self,
        lat: float,
        lon: float,
        days: int = 7
    ) -> NormalizedDailyForecast:
        raise NotImplementedError("Implemented in Task 2")
