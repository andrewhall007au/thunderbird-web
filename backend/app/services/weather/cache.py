"""
Weather caching layer with 1-hour TTL.

Phase 6: International Weather

Provides in-memory caching for weather forecasts to reduce API calls
and improve response times. Cache keys include provider, coordinates,
and requested days to ensure correct data is returned.

Design notes:
- Simple in-memory cache (dict with expiry timestamps)
- Per-process cache (fine for single server MVP)
- Restarts clear cache (acceptable for weather data)
- Memory bounded by active locations
- Could be replaced with Redis for horizontal scaling
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional, Tuple

from app.services.weather.base import NormalizedDailyForecast

logger = logging.getLogger(__name__)

# Default cache TTL: 1 hour
DEFAULT_TTL_SECONDS = 3600


class WeatherCache:
    """
    In-memory cache for weather forecasts with 1-hour TTL.

    Thread-safe for single-threaded async operations.
    Uses UTC timestamps for consistent expiry across timezones.
    """

    def __init__(self, ttl_seconds: int = DEFAULT_TTL_SECONDS):
        """
        Initialize cache.

        Args:
            ttl_seconds: Time-to-live for cache entries (default 3600 = 1 hour)
        """
        self.ttl_seconds = ttl_seconds
        self._cache: Dict[str, Tuple[NormalizedDailyForecast, datetime]] = {}

    def _make_key(self, provider: str, lat: float, lon: float, days: int) -> str:
        """
        Generate cache key from parameters.

        Uses 4 decimal places for coordinates (~11m precision).
        """
        return f"{provider}:{lat:.4f},{lon:.4f}:{days}"

    def get(
        self,
        provider: str,
        lat: float,
        lon: float,
        days: int
    ) -> Optional[NormalizedDailyForecast]:
        """
        Get cached forecast if exists and not expired.

        Args:
            provider: Provider name
            lat: Latitude
            lon: Longitude
            days: Number of forecast days requested

        Returns:
            NormalizedDailyForecast if cached and valid, None otherwise
        """
        key = self._make_key(provider, lat, lon, days)
        entry = self._cache.get(key)

        if entry is None:
            logger.debug(f"Cache miss for {key}")
            return None

        forecast, expires_at = entry
        now = datetime.now(timezone.utc)

        if now >= expires_at:
            # Expired - remove from cache
            logger.debug(f"Cache expired for {key}")
            del self._cache[key]
            return None

        logger.debug(f"Cache hit for {key}, expires in {(expires_at - now).seconds}s")
        return forecast

    def set(
        self,
        provider: str,
        lat: float,
        lon: float,
        days: int,
        forecast: NormalizedDailyForecast
    ) -> None:
        """
        Store forecast in cache.

        Args:
            provider: Provider name
            lat: Latitude
            lon: Longitude
            days: Number of forecast days
            forecast: Forecast data to cache
        """
        key = self._make_key(provider, lat, lon, days)
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=self.ttl_seconds)

        self._cache[key] = (forecast, expires_at)
        logger.debug(f"Cached {key}, expires at {expires_at}")

    def invalidate(self, provider: str, lat: float, lon: float) -> int:
        """
        Remove all cached entries for a location.

        Useful when data needs to be refreshed (e.g., after error).

        Args:
            provider: Provider name
            lat: Latitude
            lon: Longitude

        Returns:
            Number of entries removed
        """
        # Build prefix to match any days value
        prefix = f"{provider}:{lat:.4f},{lon:.4f}:"

        keys_to_remove = [
            key for key in self._cache.keys()
            if key.startswith(prefix)
        ]

        for key in keys_to_remove:
            del self._cache[key]

        if keys_to_remove:
            logger.debug(f"Invalidated {len(keys_to_remove)} entries for {prefix}")

        return len(keys_to_remove)

    def clear(self) -> int:
        """
        Clear entire cache.

        Returns:
            Number of entries removed
        """
        count = len(self._cache)
        self._cache.clear()
        logger.info(f"Cleared {count} cache entries")
        return count

    def cleanup_expired(self) -> int:
        """
        Remove all expired entries from cache.

        Called periodically to prevent memory buildup.

        Returns:
            Number of entries removed
        """
        now = datetime.now(timezone.utc)
        expired_keys = [
            key for key, (_, expires_at) in self._cache.items()
            if now >= expires_at
        ]

        for key in expired_keys:
            del self._cache[key]

        if expired_keys:
            logger.debug(f"Cleaned up {len(expired_keys)} expired entries")

        return len(expired_keys)

    @property
    def size(self) -> int:
        """Get number of entries in cache (including expired)."""
        return len(self._cache)

    def stats(self) -> dict:
        """
        Get cache statistics.

        Returns:
            Dict with size, valid_count, expired_count
        """
        now = datetime.now(timezone.utc)
        valid = 0
        expired = 0

        for _, (_, expires_at) in self._cache.items():
            if now < expires_at:
                valid += 1
            else:
                expired += 1

        return {
            "size": len(self._cache),
            "valid": valid,
            "expired": expired,
            "ttl_seconds": self.ttl_seconds,
        }


# Singleton instance
_weather_cache: Optional[WeatherCache] = None


def get_weather_cache() -> WeatherCache:
    """Get singleton weather cache instance."""
    global _weather_cache
    if _weather_cache is None:
        _weather_cache = WeatherCache()
    return _weather_cache


def reset_weather_cache() -> None:
    """Reset the singleton cache instance (for testing)."""
    global _weather_cache
    if _weather_cache is not None:
        _weather_cache.clear()
    _weather_cache = None
