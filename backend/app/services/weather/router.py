"""
Weather router for country-to-provider mapping with fallback.

Phase 6: International Weather (WTHR-10, WTHR-11)

The router is the integration point that:
- Maps countries to their best weather provider
- Handles provider failures with Open-Meteo fallback
- Supplements providers with missing metrics from Open-Meteo
- Tracks data source for display (is_fallback flag)
- Caches successful responses (1-hour TTL)

Provider mapping (resolution):
- AU: BOM ACCESS-C (2.2km) - native Australian weather service
- US: NWS (2.5km) + Open-Meteo HRRR (3km) for precip amounts
- CA: Environment Canada (2.5km) + Open-Meteo GEM (2.5km) for precip amounts
- GB: Met Office IMPROVER (1.5km)
- FR: Open-Meteo Meteo-France AROME (1.5km)
- IT: Open-Meteo DWD ICON-EU (7km)
- CH: Open-Meteo MeteoSwiss ICON-CH2 (2km) - excellent for Alps!
- JP: Open-Meteo JMA MSM (5km) - excellent for Japan!
- NZ: Open-Meteo ECMWF (9km) - best available for southern hemisphere
- ZA: Open-Meteo ECMWF (9km) - best available for southern hemisphere

Supplementation strategy:
- NWS (US): Use Open-Meteo HRRR (3km) for rain_amount, snow_amount, freezing_level, dewpoint, cape
- EC (Canada): Use Open-Meteo GEM (2.5km) for rain_amount, snow_amount, freezing_level, dewpoint, cape
- Met Office (GB): Use Open-Meteo for freezing_level, dewpoint, cape (Met Office free tier lacks these)

Cloud base calculation:
- Dewpoint enables proper LCL (Lifting Condensation Level) calculation
- LCL formula: Cloud Base (meters AGL) = (Temperature - Dewpoint) × 125
- Falls back to crude cloud cover estimation when dewpoint unavailable

Storm/Lightning prediction:
- CAPE (Convective Available Potential Energy) indicates thunderstorm potential
- CAPE thresholds: <300 weak, 300-1000 moderate, 1000-2500 strong, >2500 extreme
- European Alps: Afternoon convective storms (orographic + heating)
- Tasmania: Frontal systems with embedded thunderstorms
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
from app.services.weather.providers.bom import BOMProvider
from app.services.weather.base import NormalizedForecast

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
    - AU: BOM (Australian Bureau of Meteorology, 2.2km, free)
    - US: NWS (high quality, free, no key needed)
    - CA: Environment Canada (official, may have availability issues)
    - GB: Met Office (requires API key)
    - FR, IT, CH, JP: Open-Meteo with regional models
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
            "AU": BOMProvider(),                                        # 2.2km BOM ACCESS-C
            "US": NWSProvider(),
            "CA": EnvironmentCanadaProvider(),
            "GB": MetOfficeProvider(),
            # European countries use Open-Meteo with regional models
            "FR": OpenMeteoProvider(model=OpenMeteoModel.METEOFRANCE),  # 1.5km AROME
            "IT": OpenMeteoProvider(model=OpenMeteoModel.ICON_EU),      # 7km ICON
            "CH": OpenMeteoProvider(model=OpenMeteoModel.ICON_CH),      # 2km MeteoSwiss!
            # Asia-Pacific
            "JP": OpenMeteoProvider(model=OpenMeteoModel.JMA),          # 5km JMA MSM
            # Southern hemisphere countries use ECMWF (9km - best available)
            "NZ": OpenMeteoProvider(model=OpenMeteoModel.ECMWF),        # 9km ECMWF
            "ZA": OpenMeteoProvider(model=OpenMeteoModel.ECMWF),        # 9km ECMWF
        }

        # Supplemental providers for precipitation and freezing level data
        # Used when primary provider lacks certain metrics
        self.precip_supplements: Dict[str, OpenMeteoProvider] = {
            "CA": OpenMeteoProvider(model=OpenMeteoModel.GEM),   # 2.5km - matches EC resolution!
            "US": OpenMeteoProvider(model=OpenMeteoModel.HRRR),  # 3km - even better than NWS!
            "GB": OpenMeteoProvider(model=OpenMeteoModel.BEST_MATCH),  # For freezing level (Met Office lacks it)
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

            # Supplement with Open-Meteo precipitation if needed (CA, US)
            if country_upper in self.precip_supplements:
                forecast = await self._supplement_precipitation(
                    forecast, lat, lon, country_upper, days
                )

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

    async def _supplement_precipitation(
        self,
        forecast: NormalizedDailyForecast,
        lat: float,
        lon: float,
        country_code: str,
        days: int
    ) -> NormalizedDailyForecast:
        """
        Supplement forecast with precipitation and atmospheric data from Open-Meteo.

        Used for providers (EC, NWS, Met Office) that don't provide:
        - Quantitative precipitation amounts
        - Freezing level heights
        - Dewpoint (needed for LCL cloud base calculation)

        Replaces estimated values with actual model data from Open-Meteo
        regional models (HRRR for US, GEM for CA, etc.).

        Args:
            forecast: Original forecast from primary provider
            lat: Latitude
            lon: Longitude
            country_code: ISO country code
            days: Number of forecast days

        Returns:
            Forecast with supplemented precipitation, freezing level, and dewpoint data
        """
        country_upper = country_code.upper()
        supplement = self.precip_supplements.get(country_upper)

        if not supplement:
            return forecast

        try:
            logger.info(f"Supplementing {country_upper} forecast with {supplement.provider_name} precipitation")
            precip_forecast = await supplement.get_forecast(lat, lon, days)

            # Build lookup of Open-Meteo periods by date
            precip_by_date: Dict[str, NormalizedForecast] = {}
            for period in precip_forecast.periods:
                date_key = period.timestamp.strftime("%Y-%m-%d-%H")
                precip_by_date[date_key] = period

            # Supplement primary forecast periods with Open-Meteo precip data
            supplemented_count = 0
            for period in forecast.periods:
                date_key = period.timestamp.strftime("%Y-%m-%d-%H")
                om_period = precip_by_date.get(date_key)

                if om_period:
                    # Replace estimated values with actual model data
                    period.rain_amount = om_period.rain_amount
                    period.snow_amount = om_period.snow_amount
                    period.rain_chance = om_period.rain_chance
                    if om_period.freezing_level is not None:
                        period.freezing_level = om_period.freezing_level
                    # Supplement dewpoint for LCL cloud base calculation
                    if om_period.dewpoint is not None:
                        period.dewpoint = om_period.dewpoint
                    # Supplement CAPE for storm/lightning prediction
                    if om_period.cape is not None:
                        period.cape = om_period.cape
                    supplemented_count += 1

            logger.info(f"Supplemented {supplemented_count}/{len(forecast.periods)} periods with precip/freezing/dewpoint data")

        except Exception as e:
            logger.warning(f"Failed to supplement precipitation for {country_upper}: {e}")
            # Return original forecast if supplementation fails

        return forecast

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
