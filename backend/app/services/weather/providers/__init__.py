"""
Weather providers package.

Contains implementations for:
- Open-Meteo (universal fallback, any coordinates)
- NWS (National Weather Service for USA)
- Country-specific providers (Met Office, etc.) to be added

Usage:
    from app.services.weather.providers import OpenMeteoProvider, NWSProvider
"""
from app.services.weather.providers.openmeteo import OpenMeteoProvider
from app.services.weather.providers.nws import NWSProvider

__all__ = [
    "OpenMeteoProvider",
    "NWSProvider",
]
