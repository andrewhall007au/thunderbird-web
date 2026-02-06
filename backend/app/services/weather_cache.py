"""
Weather API Caching Layer
Reduces load on external weather APIs by caching forecast responses.
"""

import time
from typing import Optional, Dict, Any
from functools import lru_cache
from datetime import datetime, timedelta
import hashlib
import json


class WeatherCache:
    """
    Simple in-memory cache for weather forecasts.
    Cache key: lat, lng, rounded timestamp (hour)
    TTL: 1 hour (forecasts don't change that frequently)
    """

    def __init__(self, max_size: int = 1000, ttl_seconds: int = 3600):
        self.cache: Dict[str, tuple[Any, float]] = {}
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds

    def _generate_key(self, lat: float, lng: float, forecast_type: str = "default") -> str:
        """
        Generate cache key from coordinates and current hour.
        Rounds lat/lng to 2 decimal places (~1km precision).
        Includes current hour in key so cache expires hourly.
        """
        rounded_lat = round(lat, 2)
        rounded_lng = round(lng, 2)
        current_hour = datetime.utcnow().strftime("%Y-%m-%d-%H")

        key_string = f"{rounded_lat}:{rounded_lng}:{forecast_type}:{current_hour}"
        return hashlib.md5(key_string.encode()).hexdigest()

    def get(self, lat: float, lng: float, forecast_type: str = "default") -> Optional[Any]:
        """
        Get cached forecast if available and not expired.

        Args:
            lat: Latitude
            lng: Longitude
            forecast_type: Type of forecast (for different cache buckets)

        Returns:
            Cached data or None if not found/expired
        """
        key = self._generate_key(lat, lng, forecast_type)

        if key in self.cache:
            data, timestamp = self.cache[key]

            # Check if expired
            if time.time() - timestamp < self.ttl_seconds:
                return data
            else:
                # Remove expired entry
                del self.cache[key]

        return None

    def set(self, lat: float, lng: float, data: Any, forecast_type: str = "default") -> None:
        """
        Store forecast in cache.

        Args:
            lat: Latitude
            lng: Longitude
            data: Forecast data to cache
            forecast_type: Type of forecast (for different cache buckets)
        """
        key = self._generate_key(lat, lng, forecast_type)

        # Simple eviction: if cache is full, clear oldest 20%
        if len(self.cache) >= self.max_size:
            self._evict_oldest()

        self.cache[key] = (data, time.time())

    def _evict_oldest(self) -> None:
        """Evict oldest 20% of cache entries."""
        if not self.cache:
            return

        # Sort by timestamp, remove oldest 20%
        sorted_items = sorted(self.cache.items(), key=lambda x: x[1][1])
        num_to_remove = max(1, len(sorted_items) // 5)

        for key, _ in sorted_items[:num_to_remove]:
            del self.cache[key]

    def clear(self) -> None:
        """Clear entire cache."""
        self.cache.clear()

    def stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        return {
            "size": len(self.cache),
            "max_size": self.max_size,
            "ttl_seconds": self.ttl_seconds,
            "utilization": f"{len(self.cache) / self.max_size * 100:.1f}%"
        }


# Global cache instance
weather_cache = WeatherCache(max_size=1000, ttl_seconds=3600)


def get_cached_forecast(lat: float, lng: float, forecast_type: str = "default") -> Optional[Any]:
    """
    Get cached forecast (convenience function).

    Args:
        lat: Latitude
        lng: Longitude
        forecast_type: Type of forecast

    Returns:
        Cached forecast or None
    """
    return weather_cache.get(lat, lng, forecast_type)


def cache_forecast(lat: float, lng: float, data: Any, forecast_type: str = "default") -> None:
    """
    Cache forecast data (convenience function).

    Args:
        lat: Latitude
        lng: Longitude
        data: Forecast data
        forecast_type: Type of forecast
    """
    weather_cache.set(lat, lng, data, forecast_type)


def get_cache_stats() -> Dict[str, Any]:
    """Get cache statistics."""
    return weather_cache.stats()
