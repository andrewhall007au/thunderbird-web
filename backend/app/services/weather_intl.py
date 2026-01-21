"""
International weather service for multi-country support.

Phase 6: International Weather
- WTHR-01 through WTHR-08: Country-specific APIs
- WTHR-09: Open-Meteo fallback
- WTHR-10: Response normalization
- WTHR-11: Data source display

Supported countries at launch (8):
- USA: National Weather Service (NWS)
- Canada: Environment Canada
- UK: Met Office
- France: Open-Meteo (Meteo-France model)
- Italy: Open-Meteo (ICON-EU model)
- Switzerland: Open-Meteo (ICON-EU model)
- New Zealand: Open-Meteo (best_match)
- South Africa: Open-Meteo (best_match)

All unsupported countries fall back to Open-Meteo with best_match model.
"""
from typing import Optional, List
from enum import Enum

from app.services.weather.router import WeatherRouter, get_weather_router
from app.services.weather.base import (
    NormalizedForecast,
    NormalizedDailyForecast,
    WeatherAlert,
)


class WeatherProvider(str, Enum):
    """
    Weather data providers by country.

    Kept for backwards compatibility with existing code that references
    this enum. The actual provider selection is done by WeatherRouter.
    """
    NWS = "nws"  # USA
    ENVCAN = "envcan"  # Canada
    MET_OFFICE = "met_office"  # UK
    METEO_FRANCE = "meteo_france"  # France
    SERVIZIO_METEO = "servizio_meteo"  # Italy
    METEOSWISS = "meteoswiss"  # Switzerland
    METSERVICE = "metservice"  # New Zealand
    SAWS = "saws"  # South Africa
    OPEN_METEO = "open_meteo"  # Fallback


class InternationalWeatherService:
    """
    International weather service with unified API across 8 countries.

    Routes requests through WeatherRouter which handles:
    - Country-to-provider mapping
    - Automatic fallback to Open-Meteo on failure
    - Response caching (1-hour TTL)
    - Data source tracking (is_fallback flag)

    Usage:
        service = get_weather_intl_service()
        forecast = await service.get_daily_forecast(lat, lon, country_code)
        source = service.get_data_source(forecast)
    """

    def __init__(self):
        """Initialize with WeatherRouter for provider selection."""
        self.router: WeatherRouter = get_weather_router()

    async def get_forecast(
        self,
        lat: float,
        lon: float,
        country_code: str
    ) -> Optional[NormalizedForecast]:
        """
        Get current/next period forecast for coordinates.

        Args:
            lat: Latitude (-90 to 90)
            lon: Longitude (-180 to 180)
            country_code: ISO 3166-1 alpha-2 country code (e.g., "US", "FR")

        Returns:
            NormalizedForecast for next period, or None if no data
        """
        daily = await self.router.get_forecast(lat, lon, country_code, days=1)
        return daily.periods[0] if daily.periods else None

    async def get_daily_forecast(
        self,
        lat: float,
        lon: float,
        country_code: str,
        days: int = 7
    ) -> NormalizedDailyForecast:
        """
        Get multi-day forecast for coordinates.

        Args:
            lat: Latitude (-90 to 90)
            lon: Longitude (-180 to 180)
            country_code: ISO 3166-1 alpha-2 country code
            days: Number of forecast days (1-16)

        Returns:
            NormalizedDailyForecast with periods and alerts
        """
        return await self.router.get_forecast(lat, lon, country_code, days)

    async def fetch_with_fallback(
        self,
        lat: float,
        lon: float,
        country_code: str
    ) -> Optional[NormalizedForecast]:
        """
        Fetch forecast from primary provider with Open-Meteo fallback.

        This method is a convenience wrapper that returns a single period.
        The actual fallback logic is handled by WeatherRouter.

        Args:
            lat: Latitude
            lon: Longitude
            country_code: ISO 3166-1 alpha-2 country code

        Returns:
            NormalizedForecast for next period, or None if all providers fail
        """
        return await self.get_forecast(lat, lon, country_code)

    async def get_alerts(
        self,
        lat: float,
        lon: float,
        country_code: str
    ) -> List[WeatherAlert]:
        """
        Get active weather alerts for location.

        Only supported by some providers (NWS, Environment Canada).
        Other providers return empty list.

        Args:
            lat: Latitude
            lon: Longitude
            country_code: ISO 3166-1 alpha-2 country code

        Returns:
            List of WeatherAlert objects (may be empty)
        """
        return await self.router.get_alerts(lat, lon, country_code)

    def get_provider_for_country(self, country_code: str) -> WeatherProvider:
        """
        Get preferred provider enum for country code.

        Kept for backwards compatibility. Returns the logical provider
        even if the actual implementation uses a different one (e.g.,
        Open-Meteo for France instead of direct Meteo-France API).

        Args:
            country_code: ISO 3166-1 alpha-2 country code

        Returns:
            WeatherProvider enum value
        """
        provider_map = {
            "US": WeatherProvider.NWS,
            "CA": WeatherProvider.ENVCAN,
            "GB": WeatherProvider.MET_OFFICE,
            "FR": WeatherProvider.METEO_FRANCE,
            "IT": WeatherProvider.SERVIZIO_METEO,
            "CH": WeatherProvider.METEOSWISS,
            "NZ": WeatherProvider.METSERVICE,
            "ZA": WeatherProvider.SAWS,
        }
        return provider_map.get(country_code.upper(), WeatherProvider.OPEN_METEO)

    def get_data_source(self, forecast: NormalizedDailyForecast) -> str:
        """
        Get display-friendly data source name.

        For WTHR-11: Shows the provider name with "(fallback)" suffix
        when a fallback provider was used due to primary failure.

        Args:
            forecast: NormalizedDailyForecast from get_daily_forecast()

        Returns:
            Provider name string, e.g., "NWS" or "Open-Meteo (fallback)"
        """
        source = forecast.provider
        if forecast.is_fallback:
            return f"{source} (fallback)"
        return source


_weather_intl_service: Optional[InternationalWeatherService] = None


def get_weather_intl_service() -> InternationalWeatherService:
    """Get singleton international weather service instance."""
    global _weather_intl_service
    if _weather_intl_service is None:
        _weather_intl_service = InternationalWeatherService()
    return _weather_intl_service


def reset_weather_intl_service() -> None:
    """Reset the singleton service instance (for testing)."""
    global _weather_intl_service
    _weather_intl_service = None
