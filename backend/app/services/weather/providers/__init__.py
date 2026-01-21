"""
Weather providers package.

Contains implementations for:
- Open-Meteo (universal fallback, any coordinates)
- Country-specific providers (NWS, Met Office, etc.) to be added

Usage:
    from app.services.weather.providers import OpenMeteoProvider
"""
from app.services.weather.providers.openmeteo import OpenMeteoProvider

__all__ = [
    "OpenMeteoProvider",
]
