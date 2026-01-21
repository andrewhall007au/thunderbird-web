"""
Weather service package for international weather support.

Phase 6: International Weather
- Provides base abstractions for all weather providers
- Open-Meteo universal provider (fallback)
- 1-hour caching layer

Usage:
    from app.services.weather import WeatherProvider, NormalizedForecast
    from app.services.weather.providers import OpenMeteoProvider
    from app.services.weather.cache import get_weather_cache
"""
from app.services.weather.base import (
    WeatherProvider,
    NormalizedForecast,
    NormalizedDailyForecast,
    WeatherAlert,
)

__all__ = [
    "WeatherProvider",
    "NormalizedForecast",
    "NormalizedDailyForecast",
    "WeatherAlert",
]
