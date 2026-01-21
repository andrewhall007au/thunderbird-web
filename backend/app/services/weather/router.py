"""
Weather router for country-to-provider mapping with fallback.

Phase 6: International Weather (WTHR-10, WTHR-11)

The router is the integration point that:
- Maps countries to their best weather provider
- Handles provider failures with Open-Meteo fallback
- Tracks data source for display (is_fallback flag)
- Caches successful responses (1-hour TTL)

Provider mapping:
- US: NWS (National Weather Service)
- CA: Environment Canada
- GB: Met Office
- FR: Open-Meteo (Meteo-France model)
- IT: Open-Meteo (ICON-EU model)
- CH: Open-Meteo (ICON-EU model) - MeteoSwiss endpoint doesn't exist
- NZ: Open-Meteo (best_match)
- ZA: Open-Meteo (best_match)
"""
import logging
from typing import Dict, List, Optional

from app.services.weather.base import (
    WeatherProvider,
    NormalizedDailyForecast,
    WeatherAlert,
)
from app.services.weather.cache import get_weather_cache, WeatherCache
from app.services.weather.providers.nws import NWSProvider
from app.services.weather.providers.envcanada import EnvironmentCanadaProvider
from app.services.weather.providers.metoffice import MetOfficeProvider
from app.services.weather.providers.openmeteo import OpenMeteoProvider, OpenMeteoModel

logger = logging.getLogger(__name__)


class WeatherProviderError(Exception):
    """
    Exception raised when all weather providers fail.

    Indicates that neither the primary provider nor the fallback
    could provide weather data for the requested location.
    """
    pass


class WeatherRouter:
    """
    Routes weather requests to appropriate providers by country.

    The router maintains a mapping of country codes to providers and
    handles fallback to Open-Meteo when the primary provider fails.

    Provider selection:
    - US: NWS (high quality, free, no key needed)
    - CA: Environment Canada (official, may have availability issues)
    - GB: Met Office (requires API key)
    - FR, IT, CH: Open-Meteo with regional models
    - NZ, ZA: Open-Meteo with best_match
    - Unknown: Open-Meteo fallback

    Caching:
    - Uses WeatherCache with 1-hour TTL
    - Cache key includes provider, coordinates, and days
    - Fallback results cached under fallback provider name
    """

    def __init__(self):
        """
        Initialize the weather router with provider instances.

        Creates provider instances for each supported country and
        a fallback Open-Meteo provider for unknown countries or failures.
        """
        # Primary providers by country
        self.providers: Dict[str, WeatherProvider] = {
            "US": NWSProvider(),
            "CA": EnvironmentCanadaProvider(),
            "GB": MetOfficeProvider(),
            # European countries use Open-Meteo with regional models
            "FR": OpenMeteoProvider(model=OpenMeteoModel.METEOFRANCE),
            "IT": OpenMeteoProvider(model=OpenMeteoModel.ICON_EU),
            "CH": OpenMeteoProvider(model=OpenMeteoModel.ICON_EU),  # No MeteoSwiss endpoint
            # Southern hemisphere countries use best_match
            "NZ": OpenMeteoProvider(model=OpenMeteoModel.BEST_MATCH),
            "ZA": OpenMeteoProvider(model=OpenMeteoModel.BEST_MATCH),
        }

        # Universal fallback provider
        self.fallback = OpenMeteoProvider(model=OpenMeteoModel.BEST_MATCH)

        # Cache instance
        self.cache: WeatherCache = get_weather_cache()

    def get_provider(self, country_code: str) -> WeatherProvider:
        """
        Get the primary provider for a country code.

        Args:
            country_code: ISO 3166-1 alpha-2 country code (e.g., "US", "FR", "NZ")

        Returns:
            WeatherProvider for the country, or fallback for unknown countries
        """
        country_upper = country_code.upper() if country_code else ""
        provider = self.providers.get(country_upper)

        if provider is None:
            logger.debug(f"No primary provider for {country_upper}, using fallback")
            return self.fallback

        return provider

    async def get_forecast(
        self,
        lat: float,
        lon: float,
        country_code: str,
        days: int = 7
    ) -> NormalizedDailyForecast:
        """
        Get weather forecast for coordinates with automatic fallback.

        Tries the primary provider for the country first. If that fails,
        falls back to Open-Meteo. Sets is_fallback=True on the result
        when fallback is used.

        Args:
            lat: Latitude (-90 to 90)
            lon: Longitude (-180 to 180)
            country_code: ISO 3166-1 alpha-2 country code
            days: Number of forecast days (1-16)

        Returns:
            NormalizedDailyForecast with periods and is_fallback flag set

        Raises:
            WeatherProviderError: If all providers fail
        """
        provider = self.get_provider(country_code)
        country_upper = country_code.upper() if country_code else ""

        # Check cache first
        cached = self.cache.get(provider.provider_name, lat, lon, days)
        if cached:
            logger.debug(f"Cache hit for {provider.provider_name}:{lat:.4f},{lon:.4f}:{days}")
            return cached

        # Try primary provider
        try:
            logger.info(f"Fetching forecast from {provider.provider_name} for {country_upper}")
            forecast = await provider.get_forecast(lat, lon, days)
            forecast.country_code = country_upper
            forecast.is_fallback = False

            # Cache the result
            self.cache.set(provider.provider_name, lat, lon, days, forecast)
            return forecast

        except Exception as e:
            logger.warning(f"{provider.provider_name} failed for {country_upper}: {e}")

        # Try fallback (Open-Meteo)
        # Skip if primary was already Open-Meteo to avoid duplicate calls
        if "Open-Meteo" in provider.provider_name:
            logger.error(f"Open-Meteo (primary) failed for {country_upper}, no other fallback available")
            raise WeatherProviderError(f"Unable to fetch weather for {country_upper}: primary provider failed")

        try:
            logger.info(f"Falling back to Open-Meteo for {country_upper}")
            forecast = await self.fallback.get_forecast(lat, lon, days)
            forecast.country_code = country_upper
            forecast.is_fallback = True  # Mark as fallback

            # Cache under fallback provider name
            self.cache.set(self.fallback.provider_name, lat, lon, days, forecast)
            return forecast

        except Exception as e:
            logger.error(f"All providers failed for {country_upper}: {e}")
            raise WeatherProviderError(f"Unable to fetch weather for {country_upper}")

    async def get_alerts(
        self,
        lat: float,
        lon: float,
        country_code: str
    ) -> List[WeatherAlert]:
        """
        Get weather alerts for coordinates.

        Only providers that support alerts (NWS, Environment Canada) will
        return data. Others return empty list.

        Args:
            lat: Latitude
            lon: Longitude
            country_code: ISO 3166-1 alpha-2 country code

        Returns:
            List of WeatherAlert objects (empty if none or unsupported)
        """
        provider = self.get_provider(country_code)
        country_upper = country_code.upper() if country_code else ""

        if not provider.supports_alerts:
            logger.debug(f"{provider.provider_name} does not support alerts")
            return []

        try:
            logger.info(f"Fetching alerts from {provider.provider_name} for {country_upper}")
            return await provider.get_alerts(lat, lon)
        except Exception as e:
            logger.warning(f"Error fetching alerts from {provider.provider_name}: {e}")
            return []  # Don't fail on alerts - return empty list


# Singleton instance
_weather_router: Optional[WeatherRouter] = None


def get_weather_router() -> WeatherRouter:
    """Get singleton weather router instance."""
    global _weather_router
    if _weather_router is None:
        _weather_router = WeatherRouter()
    return _weather_router


def reset_weather_router() -> None:
    """Reset the singleton router instance (for testing)."""
    global _weather_router
    _weather_router = None
