"""
Weather providers package.

Contains implementations for:
- Open-Meteo (universal fallback, any coordinates)
- NWS (National Weather Service for USA)
- Environment Canada (Canadian weather)
- Met Office (UK weather)
- BOM (Bureau of Meteorology for Australia)

Usage:
    from app.services.weather.providers import OpenMeteoProvider, NWSProvider
    from app.services.weather.providers import EnvironmentCanadaProvider, MetOfficeProvider
    from app.services.weather.providers import BOMProvider
"""
from app.services.weather.providers.openmeteo import OpenMeteoProvider, OpenMeteoModel
from app.services.weather.providers.nws import NWSProvider
from app.services.weather.providers.envcanada import EnvironmentCanadaProvider
from app.services.weather.providers.metoffice import MetOfficeProvider
from app.services.weather.providers.bom import BOMProvider

__all__ = [
    "OpenMeteoProvider",
    "OpenMeteoModel",
    "NWSProvider",
    "EnvironmentCanadaProvider",
    "MetOfficeProvider",
    "BOMProvider",
]
