"""
International weather service for multi-country support.

Phase 6 will implement:
- WTHR-01 through WTHR-08: Country-specific APIs
- WTHR-09: Open-Meteo fallback
- WTHR-10: Response normalization

Supported countries at launch (8):
- USA: National Weather Service (NWS)
- Canada: Environment Canada
- UK: Met Office
- France: Meteo France
- Italy: Servizio Meteorologico
- Switzerland: MeteoSwiss
- New Zealand: MetService
- South Africa: SAWS
"""
from typing import Optional, List
from dataclasses import dataclass
from enum import Enum
from datetime import datetime


class WeatherProvider(str, Enum):
    """Weather data providers by country."""
    NWS = "nws"  # USA
    ENVCAN = "envcan"  # Canada
    MET_OFFICE = "met_office"  # UK
    METEO_FRANCE = "meteo_france"  # France
    SERVIZIO_METEO = "servizio_meteo"  # Italy
    METEOSWISS = "meteoswiss"  # Switzerland
    METSERVICE = "metservice"  # New Zealand
    SAWS = "saws"  # South Africa
    OPEN_METEO = "open_meteo"  # Fallback


@dataclass
class NormalizedForecast:
    """
    Normalized forecast format across all providers.

    Allows consistent handling regardless of data source.
    """
    provider: WeatherProvider
    lat: float
    lon: float
    timestamp: datetime
    temp_min: float  # Celsius
    temp_max: float  # Celsius
    rain_chance: int  # 0-100%
    rain_max: float  # mm
    wind_avg: float  # km/h
    wind_max: float  # km/h
    wind_direction: str  # N, NE, E, etc.
    cloud_cover: int  # 0-100%
    freezing_level: Optional[int] = None  # meters
    snow_max: float = 0.0  # cm
    description: str = ""


@dataclass
class NormalizedDailyForecast:
    """Multi-day forecast with normalized periods."""
    provider: WeatherProvider
    lat: float
    lon: float
    periods: List[NormalizedForecast]


class InternationalWeatherService:
    """
    International weather service stub.

    Will provide unified weather API across 8 countries
    with automatic fallback to Open-Meteo in Phase 6.
    """

    def __init__(self):
        pass

    async def get_forecast(
        self,
        lat: float,
        lon: float,
        country_code: str
    ) -> NormalizedForecast:
        """Get normalized forecast for any supported country. Stub for Phase 6."""
        raise NotImplementedError("Implemented in Phase 6")

    async def get_daily_forecast(
        self,
        lat: float,
        lon: float,
        country_code: str,
        days: int = 7
    ) -> NormalizedDailyForecast:
        """Get multi-day forecast for any supported country. Stub for Phase 6."""
        raise NotImplementedError("Implemented in Phase 6")

    def get_provider_for_country(self, country_code: str) -> WeatherProvider:
        """Get preferred provider for country code. Stub for Phase 6."""
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
        return provider_map.get(country_code, WeatherProvider.OPEN_METEO)

    async def fetch_with_fallback(
        self,
        lat: float,
        lon: float,
        country_code: str
    ) -> NormalizedForecast:
        """Fetch from primary provider, fall back to Open-Meteo. Stub for Phase 6."""
        raise NotImplementedError("Implemented in Phase 6")


_weather_intl_service: Optional[InternationalWeatherService] = None


def get_weather_intl_service() -> InternationalWeatherService:
    """Get singleton international weather service instance."""
    global _weather_intl_service
    if _weather_intl_service is None:
        _weather_intl_service = InternationalWeatherService()
    return _weather_intl_service
