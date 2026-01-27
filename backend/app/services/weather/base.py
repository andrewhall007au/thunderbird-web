"""
Weather provider base abstractions for international weather support.

Phase 6: International Weather
- WTHR-09: Open-Meteo fallback
- WTHR-10: Response normalization

Provides the foundation that all country-specific providers build upon.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional


@dataclass
class WeatherAlert:
    """
    Weather alert/warning from a provider.

    Not all providers support alerts - most return empty list.
    """
    event: str  # e.g., "Winter Storm Warning", "High Wind Advisory"
    headline: str  # Brief description
    severity: str  # Minor, Moderate, Severe, Extreme
    urgency: str  # Immediate, Expected, Future, Past, Unknown
    expires: Optional[datetime] = None


@dataclass
class NormalizedForecast:
    """
    Normalized forecast period across all providers.

    Allows consistent handling regardless of data source.
    All values use metric units:
    - Temperature: Celsius
    - Rain: mm
    - Snow: cm
    - Wind: km/h
    - Elevation: meters

    Elevation handling:
    - model_elevation: The elevation the weather data is valid for (grid cell or DEM)
    - Providers return temperature at 2m above this elevation
    - To get temperature at a different elevation, apply lapse rate:
      adjusted_temp = temp - (target_elevation - model_elevation) * 0.0065
    """
    provider: str  # Provider name for display (e.g., "Open-Meteo", "NWS")
    lat: float
    lon: float
    timestamp: datetime

    # Temperature
    temp_min: float  # Celsius
    temp_max: float  # Celsius

    # Precipitation
    rain_chance: int  # 0-100%
    rain_amount: float  # mm (total for period)

    # Wind
    wind_avg: float  # km/h
    wind_max: float  # km/h (gusts)
    wind_direction: str  # N, NE, E, SE, S, SW, W, NW

    # Cloud
    cloud_cover: int  # 0-100%

    # Alpine conditions
    freezing_level: Optional[int] = None  # meters ASL
    snow_amount: float = 0.0  # cm

    # Summary
    description: str = ""

    # Alerts (usually empty for period forecasts)
    alerts: List[WeatherAlert] = field(default_factory=list)


@dataclass
class NormalizedDailyForecast:
    """
    Multi-day forecast with normalized periods.

    Contains all periods for requested duration plus any alerts.

    Elevation handling:
    - model_elevation: The elevation (in meters) that temperature data is valid for
    - For Open-Meteo: This is the 90m DEM elevation (already downscaled)
    - For NWS: This is the grid cell elevation
    - For BOM: This is estimated from Open-Meteo DEM
    - Use this as base_elevation when applying lapse rate adjustments
    """
    provider: str  # Provider name
    lat: float
    lon: float
    country_code: str  # ISO 3166-1 alpha-2 (e.g., "US", "FR", "NZ")

    periods: List[NormalizedForecast]
    alerts: List[WeatherAlert]

    fetched_at: datetime
    is_fallback: bool = False  # True if fallback provider was used
    model_elevation: Optional[int] = None  # Elevation (meters) that temps are valid for


class WeatherProvider(ABC):
    """
    Abstract base class for weather providers.

    Each country-specific provider implements this interface
    to provide normalized weather data.
    """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Human-readable provider name for display."""
        pass

    @property
    def supports_alerts(self) -> bool:
        """Whether this provider supports weather alerts. Default False."""
        return False

    @abstractmethod
    async def get_forecast(
        self,
        lat: float,
        lon: float,
        days: int = 7
    ) -> NormalizedDailyForecast:
        """
        Get normalized forecast for coordinates.

        Args:
            lat: Latitude (-90 to 90)
            lon: Longitude (-180 to 180)
            days: Number of forecast days (1-16 depending on provider)

        Returns:
            NormalizedDailyForecast with periods and alerts
        """
        pass

    async def get_alerts(
        self,
        lat: float,
        lon: float
    ) -> List[WeatherAlert]:
        """
        Get weather alerts for location.

        Default implementation returns empty list.
        Override in providers that support alerts (e.g., NWS).

        Args:
            lat: Latitude
            lon: Longitude

        Returns:
            List of active WeatherAlert objects
        """
        return []
