"""
Tests for weather router and cache functionality.

Phase 6: International Weather
Covers WTHR-09 (fallback), WTHR-10 (normalization), WTHR-11 (data source).

Tests:
- Country-to-provider mapping
- Fallback on provider failure
- is_fallback flag tracking
- Cache behavior (get, set, invalidate)
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timezone, timedelta

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.weather.router import (
    WeatherRouter,
    WeatherProviderError,
    reset_weather_router,
)
from app.services.weather.cache import (
    WeatherCache,
    reset_weather_cache,
)
from app.services.weather.base import (
    NormalizedDailyForecast,
    NormalizedForecast,
    WeatherAlert,
)


@pytest.fixture(autouse=True)
def reset_singletons():
    """Reset router and cache singletons before each test."""
    reset_weather_router()
    reset_weather_cache()
    yield
    reset_weather_router()
    reset_weather_cache()


class TestWeatherRouter:
    """Tests for weather router (WTHR-09, WTHR-11)."""

    def test_provider_mapping_us(self):
        """Router maps US to NWS."""
        router = WeatherRouter()
        provider = router.get_provider("US")
        assert provider.provider_name == "NWS"

    def test_provider_mapping_canada(self):
        """Router maps CA to Environment Canada."""
        router = WeatherRouter()
        provider = router.get_provider("CA")
        assert provider.provider_name == "Environment Canada"

    def test_provider_mapping_uk(self):
        """Router maps GB to Met Office."""
        router = WeatherRouter()
        provider = router.get_provider("GB")
        assert provider.provider_name == "Met Office"

    def test_provider_mapping_france(self):
        """Router maps FR to Open-Meteo Meteo-France."""
        router = WeatherRouter()
        provider = router.get_provider("FR")
        assert "Meteo-France" in provider.provider_name

    def test_provider_mapping_switzerland(self):
        """Router maps CH to Open-Meteo ICON (not MeteoSwiss)."""
        router = WeatherRouter()
        provider = router.get_provider("CH")
        # Switzerland uses ICON_EU since MeteoSwiss endpoint doesn't exist
        assert "ICON" in provider.provider_name or "DWD" in provider.provider_name

    def test_provider_mapping_italy(self):
        """Router maps IT to Open-Meteo ICON."""
        router = WeatherRouter()
        provider = router.get_provider("IT")
        assert "ICON" in provider.provider_name or "DWD" in provider.provider_name

    def test_provider_mapping_new_zealand(self):
        """Router maps NZ to Open-Meteo."""
        router = WeatherRouter()
        provider = router.get_provider("NZ")
        assert "Open-Meteo" in provider.provider_name

    def test_provider_mapping_south_africa(self):
        """Router maps ZA to Open-Meteo."""
        router = WeatherRouter()
        provider = router.get_provider("ZA")
        assert "Open-Meteo" in provider.provider_name

    def test_provider_mapping_unknown(self):
        """Router uses Open-Meteo fallback for unknown countries."""
        router = WeatherRouter()
        provider = router.get_provider("XX")
        assert "Open-Meteo" in provider.provider_name

    def test_provider_mapping_lowercase(self):
        """Router handles lowercase country codes."""
        router = WeatherRouter()
        provider = router.get_provider("us")
        assert provider.provider_name == "NWS"

    def test_provider_mapping_empty(self):
        """Router handles empty country code."""
        router = WeatherRouter()
        provider = router.get_provider("")
        assert "Open-Meteo" in provider.provider_name

    @pytest.mark.asyncio
    async def test_fallback_on_primary_failure(self):
        """Router falls back to Open-Meteo when primary fails (WTHR-09)."""
        router = WeatherRouter()

        # Mock the US provider to fail
        mock_provider = router.providers["US"]
        mock_provider.get_forecast = AsyncMock(
            side_effect=Exception("NWS API Error")
        )

        # Mock the fallback to succeed
        mock_forecast = NormalizedDailyForecast(
            provider="Open-Meteo",
            lat=40.0,
            lon=-74.0,
            country_code="US",
            periods=[],
            alerts=[],
            fetched_at=datetime.now(timezone.utc),
            is_fallback=True,
        )
        router.fallback.get_forecast = AsyncMock(return_value=mock_forecast)

        # Clear any cached data
        router.cache.clear()

        # Request forecast - should use fallback
        forecast = await router.get_forecast(40.0, -74.0, "US", days=2)

        assert forecast.is_fallback is True
        assert "Open-Meteo" in forecast.provider

    @pytest.mark.asyncio
    async def test_is_fallback_false_when_primary_succeeds(self):
        """Router sets is_fallback=False when primary succeeds (WTHR-11)."""
        router = WeatherRouter()

        # Mock the US provider to succeed
        mock_forecast = NormalizedDailyForecast(
            provider="NWS",
            lat=40.0,
            lon=-74.0,
            country_code="",
            periods=[],
            alerts=[],
            fetched_at=datetime.now(timezone.utc),
            is_fallback=False,
        )
        router.providers["US"].get_forecast = AsyncMock(return_value=mock_forecast)

        # Clear cache
        router.cache.clear()

        forecast = await router.get_forecast(40.0, -74.0, "US", days=2)

        assert forecast.is_fallback is False
        assert forecast.country_code == "US"

    @pytest.mark.asyncio
    async def test_open_meteo_primary_no_double_fallback(self):
        """When Open-Meteo is primary and fails, raise error (no double fallback)."""
        router = WeatherRouter()

        # France uses Open-Meteo as primary
        # Mock it to fail
        router.providers["FR"].get_forecast = AsyncMock(
            side_effect=Exception("Open-Meteo API Error")
        )

        # Clear cache
        router.cache.clear()

        # Should raise WeatherProviderError since primary is Open-Meteo
        with pytest.raises(WeatherProviderError):
            await router.get_forecast(45.0, 6.0, "FR", days=2)

    @pytest.mark.asyncio
    async def test_cache_hit(self):
        """Router uses cached forecast on repeat request."""
        router = WeatherRouter()

        # Create a mock forecast
        mock_forecast = NormalizedDailyForecast(
            provider="NWS",
            lat=40.0,
            lon=-74.0,
            country_code="US",
            periods=[],
            alerts=[],
            fetched_at=datetime.now(timezone.utc),
            is_fallback=False,
        )

        # Pre-populate cache
        router.cache.set("NWS", 40.0, -74.0, 2, mock_forecast)

        # Mock provider - should NOT be called
        router.providers["US"].get_forecast = AsyncMock(
            side_effect=Exception("Should not be called")
        )

        # Request should hit cache
        forecast = await router.get_forecast(40.0, -74.0, "US", days=2)

        assert forecast.provider == "NWS"
        # Provider mock was not called (would have raised)

    @pytest.mark.asyncio
    async def test_alerts_for_supporting_provider(self):
        """Router fetches alerts from supporting providers (WTHR-11)."""
        router = WeatherRouter()

        # Mock NWS get_alerts
        mock_alerts = [
            WeatherAlert(
                event="Winter Storm Warning",
                headline="Heavy snow expected",
                severity="Severe",
                urgency="Expected",
            )
        ]
        router.providers["US"].get_alerts = AsyncMock(return_value=mock_alerts)

        alerts = await router.get_alerts(40.0, -74.0, "US")

        assert len(alerts) == 1
        assert alerts[0].event == "Winter Storm Warning"

    @pytest.mark.asyncio
    async def test_alerts_empty_for_non_supporting_provider(self):
        """Router returns empty alerts for non-supporting providers."""
        router = WeatherRouter()

        # France (Open-Meteo) doesn't support alerts
        alerts = await router.get_alerts(45.0, 6.0, "FR")

        assert alerts == []

    @pytest.mark.asyncio
    async def test_alerts_error_returns_empty(self):
        """Router returns empty list on alerts error (graceful degradation)."""
        router = WeatherRouter()

        # Mock NWS get_alerts to fail
        router.providers["US"].get_alerts = AsyncMock(
            side_effect=Exception("Alerts API error")
        )

        alerts = await router.get_alerts(40.0, -74.0, "US")

        # Should return empty list, not raise
        assert alerts == []


class TestWeatherCache:
    """Tests for weather cache."""

    def test_cache_miss(self):
        """Cache returns None for missing entries."""
        cache = WeatherCache()
        result = cache.get("test", 40.0, -74.0, 7)
        assert result is None

    def test_cache_hit(self):
        """Cache returns stored forecast."""
        cache = WeatherCache()

        mock_forecast = NormalizedDailyForecast(
            provider="test",
            lat=40.0,
            lon=-74.0,
            country_code="US",
            periods=[],
            alerts=[],
            fetched_at=datetime.now(timezone.utc),
            is_fallback=False,
        )

        cache.set("test", 40.0, -74.0, 7, mock_forecast)
        result = cache.get("test", 40.0, -74.0, 7)

        assert result is not None
        assert result.provider == "test"

    def test_cache_different_days(self):
        """Cache distinguishes by days parameter."""
        cache = WeatherCache()

        forecast_7 = NormalizedDailyForecast(
            provider="test-7",
            lat=40.0,
            lon=-74.0,
            country_code="US",
            periods=[],
            alerts=[],
            fetched_at=datetime.now(timezone.utc),
            is_fallback=False,
        )
        forecast_14 = NormalizedDailyForecast(
            provider="test-14",
            lat=40.0,
            lon=-74.0,
            country_code="US",
            periods=[],
            alerts=[],
            fetched_at=datetime.now(timezone.utc),
            is_fallback=False,
        )

        cache.set("test", 40.0, -74.0, 7, forecast_7)
        cache.set("test", 40.0, -74.0, 14, forecast_14)

        assert cache.get("test", 40.0, -74.0, 7).provider == "test-7"
        assert cache.get("test", 40.0, -74.0, 14).provider == "test-14"

    def test_cache_invalidate(self):
        """Cache invalidate removes all entries for location."""
        cache = WeatherCache()

        mock_forecast = NormalizedDailyForecast(
            provider="test",
            lat=40.0,
            lon=-74.0,
            country_code="US",
            periods=[],
            alerts=[],
            fetched_at=datetime.now(timezone.utc),
            is_fallback=False,
        )

        # Add entries for different days
        cache.set("test", 40.0, -74.0, 7, mock_forecast)
        cache.set("test", 40.0, -74.0, 14, mock_forecast)

        # Invalidate all for this location
        count = cache.invalidate("test", 40.0, -74.0)
        assert count == 2

        # Both should be gone
        assert cache.get("test", 40.0, -74.0, 7) is None
        assert cache.get("test", 40.0, -74.0, 14) is None

    def test_cache_clear(self):
        """Cache clear removes all entries."""
        cache = WeatherCache()

        mock_forecast = NormalizedDailyForecast(
            provider="test",
            lat=40.0,
            lon=-74.0,
            country_code="US",
            periods=[],
            alerts=[],
            fetched_at=datetime.now(timezone.utc),
            is_fallback=False,
        )

        cache.set("test", 40.0, -74.0, 7, mock_forecast)
        cache.set("test", 50.0, -75.0, 7, mock_forecast)

        count = cache.clear()
        assert count == 2
        assert cache.size == 0

    def test_cache_ttl_expiry(self):
        """Cache entries expire after TTL."""
        # Use very short TTL for testing
        cache = WeatherCache(ttl_seconds=1)

        mock_forecast = NormalizedDailyForecast(
            provider="test",
            lat=40.0,
            lon=-74.0,
            country_code="US",
            periods=[],
            alerts=[],
            fetched_at=datetime.now(timezone.utc),
            is_fallback=False,
        )

        cache.set("test", 40.0, -74.0, 7, mock_forecast)

        # Should exist immediately
        assert cache.get("test", 40.0, -74.0, 7) is not None

        # Manually expire by manipulating cache entry
        key = cache._make_key("test", 40.0, -74.0, 7)
        cache._cache[key] = (mock_forecast, datetime.now(timezone.utc) - timedelta(seconds=10))

        # Should be expired now
        assert cache.get("test", 40.0, -74.0, 7) is None

    def test_cache_key_precision(self):
        """Cache uses 4 decimal precision for coordinates."""
        cache = WeatherCache()

        # These should produce the same cache key
        key1 = cache._make_key("test", 40.71280001, -74.00600001, 7)
        key2 = cache._make_key("test", 40.71280009, -74.00600009, 7)
        assert key1 == key2

    def test_cache_stats(self):
        """Cache stats returns size information."""
        cache = WeatherCache()

        mock_forecast = NormalizedDailyForecast(
            provider="test",
            lat=40.0,
            lon=-74.0,
            country_code="US",
            periods=[],
            alerts=[],
            fetched_at=datetime.now(timezone.utc),
            is_fallback=False,
        )

        cache.set("test", 40.0, -74.0, 7, mock_forecast)

        stats = cache.stats()
        assert stats["size"] == 1
        assert stats["valid"] == 1
        assert stats["expired"] == 0
        assert stats["ttl_seconds"] == 3600

    def test_cache_cleanup_expired(self):
        """Cache cleanup removes expired entries."""
        cache = WeatherCache(ttl_seconds=1)

        mock_forecast = NormalizedDailyForecast(
            provider="test",
            lat=40.0,
            lon=-74.0,
            country_code="US",
            periods=[],
            alerts=[],
            fetched_at=datetime.now(timezone.utc),
            is_fallback=False,
        )

        cache.set("test", 40.0, -74.0, 7, mock_forecast)

        # Manually expire
        key = cache._make_key("test", 40.0, -74.0, 7)
        cache._cache[key] = (mock_forecast, datetime.now(timezone.utc) - timedelta(seconds=10))

        # Cleanup
        count = cache.cleanup_expired()
        assert count == 1
        assert cache.size == 0


class TestRouterCacheIntegration:
    """Integration tests for router with caching."""

    @pytest.mark.asyncio
    async def test_forecast_cached_after_fetch(self):
        """Forecast is cached after successful fetch."""
        router = WeatherRouter()

        # Mock provider
        mock_forecast = NormalizedDailyForecast(
            provider="NWS",
            lat=40.0,
            lon=-74.0,
            country_code="",
            periods=[],
            alerts=[],
            fetched_at=datetime.now(timezone.utc),
            is_fallback=False,
        )
        router.providers["US"].get_forecast = AsyncMock(return_value=mock_forecast)

        # Clear cache
        router.cache.clear()

        # First request
        await router.get_forecast(40.0, -74.0, "US", days=2)

        # Should be cached
        cached = router.cache.get("NWS", 40.0, -74.0, 2)
        assert cached is not None
        assert cached.provider == "NWS"

    @pytest.mark.asyncio
    async def test_fallback_cached_under_fallback_name(self):
        """Fallback results are cached under fallback provider name."""
        router = WeatherRouter()

        # Mock primary to fail
        router.providers["US"].get_forecast = AsyncMock(
            side_effect=Exception("NWS API Error")
        )

        # Mock fallback to succeed
        mock_forecast = NormalizedDailyForecast(
            provider="Open-Meteo",
            lat=40.0,
            lon=-74.0,
            country_code="US",
            periods=[],
            alerts=[],
            fetched_at=datetime.now(timezone.utc),
            is_fallback=True,
        )
        router.fallback.get_forecast = AsyncMock(return_value=mock_forecast)

        # Clear cache
        router.cache.clear()

        # Request
        await router.get_forecast(40.0, -74.0, "US", days=2)

        # Should be cached under fallback provider name
        cached = router.cache.get("Open-Meteo", 40.0, -74.0, 2)
        assert cached is not None
        assert cached.is_fallback is True


# Run with: pytest backend/tests/test_weather_router.py -v
if __name__ == "__main__":
    pytest.main([__file__, "-v"])
