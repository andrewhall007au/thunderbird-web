"""
Tests for GPS-based international weather routing.

Phase 6: International Weather - GPS Enhancement
Tests for:
- geo.py: Country detection from GPS coordinates
- converter.py: NormalizedDailyForecast to CellForecast conversion
- webhook.py: GPS forecast routing (AU vs international)
- commands.py: CAST7 GPS parsing
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timezone, timedelta

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))


# =============================================================================
# UNIT TESTS: geo.py - Country Detection
# =============================================================================

class TestGeoCountryDetection:
    """Unit tests for get_country_from_coordinates()."""

    def test_australia_sydney(self):
        """Sydney coordinates return AU."""
        from app.services.geo import get_country_from_coordinates
        result = get_country_from_coordinates(-33.86, 151.21)
        assert result == "AU"

    def test_australia_melbourne(self):
        """Melbourne coordinates return AU."""
        from app.services.geo import get_country_from_coordinates
        result = get_country_from_coordinates(-37.81, 144.96)
        assert result == "AU"

    def test_australia_tasmania(self):
        """Tasmania coordinates return AU."""
        from app.services.geo import get_country_from_coordinates
        result = get_country_from_coordinates(-41.89, 146.08)
        assert result == "AU"

    def test_us_new_york(self):
        """NYC coordinates return US."""
        from app.services.geo import get_country_from_coordinates
        result = get_country_from_coordinates(40.71, -74.00)
        assert result == "US"

    def test_us_los_angeles(self):
        """LA coordinates return US."""
        from app.services.geo import get_country_from_coordinates
        result = get_country_from_coordinates(34.05, -118.24)
        assert result == "US"

    def test_us_denver(self):
        """Denver (mountainous) coordinates return US."""
        from app.services.geo import get_country_from_coordinates
        result = get_country_from_coordinates(39.74, -104.99)
        assert result == "US"

    def test_uk_london(self):
        """London coordinates return GB."""
        from app.services.geo import get_country_from_coordinates
        result = get_country_from_coordinates(51.50, -0.12)
        assert result == "GB"

    def test_uk_edinburgh(self):
        """Edinburgh coordinates return GB."""
        from app.services.geo import get_country_from_coordinates
        result = get_country_from_coordinates(55.95, -3.19)
        assert result == "GB"

    def test_france_paris(self):
        """Paris coordinates return FR."""
        from app.services.geo import get_country_from_coordinates
        result = get_country_from_coordinates(48.86, 2.35)
        assert result == "FR"

    def test_france_lyon(self):
        """Lyon coordinates return FR."""
        from app.services.geo import get_country_from_coordinates
        # Note: Chamonix (45.92, 6.87) is in the overlap zone between FR/CH bounding boxes
        # Using Lyon which is clearly in France
        result = get_country_from_coordinates(45.76, 4.84)
        assert result == "FR"

    def test_switzerland_zurich(self):
        """Zurich coordinates return CH."""
        from app.services.geo import get_country_from_coordinates
        result = get_country_from_coordinates(47.37, 8.54)
        assert result == "CH"

    def test_switzerland_zermatt(self):
        """Zermatt (Alps) coordinates return CH."""
        from app.services.geo import get_country_from_coordinates
        result = get_country_from_coordinates(46.02, 7.75)
        assert result == "CH"

    def test_italy_rome(self):
        """Rome coordinates return IT."""
        from app.services.geo import get_country_from_coordinates
        result = get_country_from_coordinates(41.90, 12.50)
        assert result == "IT"

    def test_italy_dolomites(self):
        """Dolomites coordinates return IT."""
        from app.services.geo import get_country_from_coordinates
        result = get_country_from_coordinates(46.41, 11.84)
        assert result == "IT"

    def test_canada_vancouver(self):
        """Vancouver coordinates return CA."""
        from app.services.geo import get_country_from_coordinates
        result = get_country_from_coordinates(49.28, -123.12)
        assert result == "CA"

    def test_canada_banff(self):
        """Banff (Rockies) coordinates return CA."""
        from app.services.geo import get_country_from_coordinates
        result = get_country_from_coordinates(51.18, -115.57)
        assert result == "CA"

    def test_new_zealand_auckland(self):
        """Auckland coordinates return NZ."""
        from app.services.geo import get_country_from_coordinates
        result = get_country_from_coordinates(-36.85, 174.76)
        assert result == "NZ"

    def test_new_zealand_queenstown(self):
        """Queenstown coordinates return NZ."""
        from app.services.geo import get_country_from_coordinates
        result = get_country_from_coordinates(-45.03, 168.66)
        assert result == "NZ"

    def test_south_africa_cape_town(self):
        """Cape Town coordinates return ZA."""
        from app.services.geo import get_country_from_coordinates
        result = get_country_from_coordinates(-33.92, 18.42)
        assert result == "ZA"

    def test_unsupported_ocean(self):
        """Ocean coordinates return None."""
        from app.services.geo import get_country_from_coordinates
        result = get_country_from_coordinates(0.0, 0.0)
        assert result is None

    def test_unsupported_japan(self):
        """Japan (unsupported country) returns None."""
        from app.services.geo import get_country_from_coordinates
        result = get_country_from_coordinates(35.68, 139.69)
        assert result is None

    def test_unsupported_brazil(self):
        """Brazil (unsupported country) returns None."""
        from app.services.geo import get_country_from_coordinates
        result = get_country_from_coordinates(-22.91, -43.17)
        assert result is None

    def test_invalid_latitude_high(self):
        """Invalid latitude (>90) returns None."""
        from app.services.geo import get_country_from_coordinates
        result = get_country_from_coordinates(91.0, 0.0)
        assert result is None

    def test_invalid_latitude_low(self):
        """Invalid latitude (<-90) returns None."""
        from app.services.geo import get_country_from_coordinates
        result = get_country_from_coordinates(-91.0, 0.0)
        assert result is None

    def test_invalid_longitude_high(self):
        """Invalid longitude (>180) returns None."""
        from app.services.geo import get_country_from_coordinates
        result = get_country_from_coordinates(0.0, 181.0)
        assert result is None

    def test_invalid_longitude_low(self):
        """Invalid longitude (<-180) returns None."""
        from app.services.geo import get_country_from_coordinates
        result = get_country_from_coordinates(0.0, -181.0)
        assert result is None

    def test_is_australian_true(self):
        """is_australian() returns True for AU coordinates."""
        from app.services.geo import is_australian
        assert is_australian(-33.86, 151.21) is True

    def test_is_australian_false(self):
        """is_australian() returns False for non-AU coordinates."""
        from app.services.geo import is_australian
        assert is_australian(40.71, -74.00) is False

    def test_get_supported_countries(self):
        """get_supported_countries() returns all 9 countries."""
        from app.services.geo import get_supported_countries
        countries = get_supported_countries()
        assert len(countries) == 9
        assert "AU" in countries
        assert "US" in countries
        assert "GB" in countries


# =============================================================================
# UNIT TESTS: converter.py - Format Conversion
# =============================================================================

class TestWeatherConverter:
    """Unit tests for normalized_to_cell_forecast()."""

    @pytest.fixture
    def sample_normalized_forecast(self):
        """Create a sample NormalizedDailyForecast for testing."""
        from app.services.weather.base import (
            NormalizedDailyForecast,
            NormalizedForecast,
        )

        now = datetime.now(timezone.utc)

        periods = [
            NormalizedForecast(
                provider="NWS",
                lat=40.71,
                lon=-74.00,
                timestamp=now,
                temp_min=5.0,
                temp_max=12.0,
                rain_chance=60,
                rain_amount=5.5,
                wind_avg=25.0,
                wind_max=40.0,
                wind_direction="NW",
                cloud_cover=75,
                freezing_level=1500,
                snow_amount=2.0,
                description="Cloudy with rain"
            ),
            NormalizedForecast(
                provider="NWS",
                lat=40.71,
                lon=-74.00,
                timestamp=now + timedelta(hours=6),
                temp_min=8.0,
                temp_max=15.0,
                rain_chance=30,
                rain_amount=1.0,
                wind_avg=15.0,
                wind_max=25.0,
                wind_direction="W",
                cloud_cover=40,
                freezing_level=1800,
                snow_amount=0.0,
                description="Partly cloudy"
            ),
        ]

        return NormalizedDailyForecast(
            provider="NWS",
            lat=40.71,
            lon=-74.00,
            country_code="US",
            periods=periods,
            alerts=[],
            fetched_at=now,
            is_fallback=False,
            model_elevation=100,  # Grid cell elevation where temps are valid
        )

    def test_conversion_basic(self, sample_normalized_forecast):
        """Conversion produces valid CellForecast."""
        from app.services.weather.converter import normalized_to_cell_forecast
        from app.services.bom import CellForecast

        result = normalized_to_cell_forecast(
            sample_normalized_forecast,
            lat=40.71,
            lon=-74.00,
            target_elevation=100
        )

        assert isinstance(result, CellForecast)
        assert result.lat == 40.71
        assert result.lon == -74.00
        assert result.base_elevation == 100
        assert result.cell_id == "GPS"
        assert len(result.periods) == 2

    def test_conversion_rain_amount_to_range(self, sample_normalized_forecast):
        """rain_amount converts to rain_min=0, rain_max=amount."""
        from app.services.weather.converter import normalized_to_cell_forecast

        result = normalized_to_cell_forecast(
            sample_normalized_forecast,
            lat=40.71,
            lon=-74.00,
            target_elevation=100
        )

        # First period had rain_amount=5.5
        assert result.periods[0].rain_min == 0.0
        assert result.periods[0].rain_max == 5.5

    def test_conversion_snow_amount_to_range(self, sample_normalized_forecast):
        """snow_amount converts to snow_min=0, snow_max=amount."""
        from app.services.weather.converter import normalized_to_cell_forecast

        result = normalized_to_cell_forecast(
            sample_normalized_forecast,
            lat=40.71,
            lon=-74.00,
            target_elevation=100
        )

        # First period had snow_amount=2.0
        assert result.periods[0].snow_min == 0.0
        assert result.periods[0].snow_max == 2.0

    def test_conversion_preserves_freezing_level(self, sample_normalized_forecast):
        """Freezing level is preserved from normalized forecast."""
        from app.services.weather.converter import normalized_to_cell_forecast

        result = normalized_to_cell_forecast(
            sample_normalized_forecast,
            lat=40.71,
            lon=-74.00,
            target_elevation=100
        )

        assert result.periods[0].freezing_level == 1500
        assert result.periods[1].freezing_level == 1800

    def test_conversion_cloud_base_from_cover_high(self, sample_normalized_forecast):
        """High cloud cover (>=80) produces low cloud base."""
        from app.services.weather.converter import normalized_to_cell_forecast

        # Modify to have high cloud cover
        sample_normalized_forecast.periods[0].cloud_cover = 85

        result = normalized_to_cell_forecast(
            sample_normalized_forecast,
            lat=40.71,
            lon=-74.00,
            target_elevation=100
        )

        # Cloud base = base_elevation (100) + 600 for high cloud cover
        assert result.periods[0].cloud_base == 700  # Low clouds (100 + 600)

    def test_conversion_cloud_base_from_cover_low(self, sample_normalized_forecast):
        """Low cloud cover (<20) produces high cloud base."""
        from app.services.weather.converter import normalized_to_cell_forecast

        # Modify to have low cloud cover
        sample_normalized_forecast.periods[1].cloud_cover = 10

        result = normalized_to_cell_forecast(
            sample_normalized_forecast,
            lat=40.71,
            lon=-74.00,
            target_elevation=100
        )

        # Cloud base = base_elevation (100) + 2000 for low cloud cover
        assert result.periods[1].cloud_base == 2100  # High/clear (100 + 2000)

    def test_conversion_source_nws(self, sample_normalized_forecast):
        """NWS provider name converts to 'nws' source."""
        from app.services.weather.converter import normalized_to_cell_forecast

        result = normalized_to_cell_forecast(
            sample_normalized_forecast,
            lat=40.71,
            lon=-74.00,
            target_elevation=100
        )

        assert result.source == "nws"

    def test_conversion_source_openmeteo(self, sample_normalized_forecast):
        """Open-Meteo provider name converts to 'openmeteo' source."""
        from app.services.weather.converter import normalized_to_cell_forecast

        sample_normalized_forecast.provider = "Open-Meteo"

        result = normalized_to_cell_forecast(
            sample_normalized_forecast,
            lat=40.71,
            lon=-74.00,
            target_elevation=100
        )

        assert result.source == "openmeteo"

    def test_conversion_wind_values(self, sample_normalized_forecast):
        """Wind values are converted to integers."""
        from app.services.weather.converter import normalized_to_cell_forecast

        result = normalized_to_cell_forecast(
            sample_normalized_forecast,
            lat=40.71,
            lon=-74.00,
            target_elevation=100
        )

        assert isinstance(result.periods[0].wind_avg, int)
        assert isinstance(result.periods[0].wind_max, int)
        assert result.periods[0].wind_avg == 25
        assert result.periods[0].wind_max == 40

    def test_conversion_cape_default_zero(self, sample_normalized_forecast):
        """CAPE defaults to 0 (not provided by most providers)."""
        from app.services.weather.converter import normalized_to_cell_forecast

        result = normalized_to_cell_forecast(
            sample_normalized_forecast,
            lat=40.71,
            lon=-74.00,
            target_elevation=100
        )

        assert result.periods[0].cape == 0


# =============================================================================
# UNIT TESTS: commands.py - CAST7 GPS Parsing
# =============================================================================

class TestCast7GPSParsing:
    """Unit tests for CAST7 GPS coordinate parsing."""

    @pytest.fixture
    def parser(self):
        """Create CommandParser instance."""
        from app.services.commands import CommandParser
        return CommandParser()

    def test_cast7_gps_comma_separated(self, parser):
        """CAST7 parses comma-separated GPS coordinates."""
        result = parser.parse("CAST7 40.71,-74.00")

        assert result.is_valid is True
        assert result.args.get("is_gps") is True
        assert result.args.get("gps_lat") == 40.71
        assert result.args.get("gps_lon") == -74.00

    def test_cast7_gps_negative_lat(self, parser):
        """CAST7 parses negative latitude (southern hemisphere)."""
        result = parser.parse("CAST7 -33.86,151.21")

        assert result.is_valid is True
        assert result.args.get("is_gps") is True
        assert result.args.get("gps_lat") == -33.86
        assert result.args.get("gps_lon") == 151.21

    def test_cast7_gps_negative_lon(self, parser):
        """CAST7 parses negative longitude (western hemisphere)."""
        result = parser.parse("CAST7 51.50,-0.12")

        assert result.is_valid is True
        assert result.args.get("is_gps") is True
        assert result.args.get("gps_lat") == 51.50
        assert result.args.get("gps_lon") == -0.12

    def test_cast7_gps_space_separated(self, parser):
        """CAST7 parses space-separated GPS coordinates."""
        result = parser.parse("CAST7 40.71 -74.00")

        assert result.is_valid is True
        assert result.args.get("is_gps") is True
        assert result.args.get("gps_lat") == 40.71
        assert result.args.get("gps_lon") == -74.00

    def test_cast7_camps_still_works(self, parser):
        """CAST7 CAMPS still parses correctly (not GPS)."""
        result = parser.parse("CAST7 CAMPS")

        assert result.is_valid is True
        assert result.args.get("all_camps") is True
        assert result.args.get("is_gps") is None

    def test_cast7_peaks_still_works(self, parser):
        """CAST7 PEAKS still parses correctly (not GPS)."""
        result = parser.parse("CAST7 PEAKS")

        assert result.is_valid is True
        assert result.args.get("all_peaks") is True
        assert result.args.get("is_gps") is None

    def test_cast7_location_code_still_works(self, parser):
        """CAST7 with location code still parses (not GPS)."""
        # This depends on valid_camps being populated
        # Just verify it's not treated as GPS
        result = parser.parse("CAST7 LAKEO")

        assert result.args.get("is_gps") is None
        assert result.args.get("location_code") == "LAKEO"

    def test_cast_gps_still_works(self, parser):
        """CAST (12hr) GPS parsing still works."""
        result = parser.parse("CAST 40.71,-74.00")

        assert result.is_valid is True
        assert result.args.get("is_gps") is True
        assert result.args.get("gps_lat") == 40.71


# =============================================================================
# INTEGRATION TESTS: GPS Routing
# =============================================================================

class TestGPSForecastRouting:
    """Integration tests for GPS forecast routing through WeatherRouter."""

    @pytest.fixture
    def mock_bom_service(self):
        """Mock BOM service."""
        with patch('app.services.bom.get_bom_service') as mock:
            service = MagicMock()
            service.get_grid_elevation = AsyncMock(return_value=500)
            service.get_hourly_forecast = AsyncMock()
            service.get_daily_forecast = AsyncMock()
            mock.return_value = service
            yield service

    @pytest.fixture
    def mock_weather_router(self):
        """Mock WeatherRouter."""
        with patch('app.services.weather.router.get_weather_router') as mock:
            router = MagicMock()
            router.get_forecast = AsyncMock()
            mock.return_value = router
            yield router

    @pytest.fixture
    def mock_user_store(self):
        """Mock user store."""
        with patch('app.routers.webhook.user_store') as mock:
            mock.get_user.return_value = None
            yield mock

    @pytest.fixture
    def mock_account_store(self):
        """Mock account store."""
        with patch('app.routers.webhook.account_store') as mock:
            mock.get_by_phone.return_value = None
            yield mock

    @pytest.mark.asyncio
    async def test_au_coordinates_use_bom(self, mock_bom_service, mock_weather_router):
        """Australian GPS coordinates use BOM service."""
        from app.services.bom import CellForecast, ForecastPeriod
        from datetime import datetime
        from config.settings import TZ_HOBART

        # Set up BOM mock to return valid forecast
        mock_forecast = CellForecast(
            cell_id="GPS",
            geohash="r1r0",
            lat=-33.86,
            lon=151.21,
            base_elevation=500,
            periods=[
                ForecastPeriod(
                    datetime=datetime.now(TZ_HOBART),
                    period="AM",
                    temp_min=15,
                    temp_max=22,
                    rain_chance=20,
                    rain_min=0,
                    rain_max=1,
                    snow_min=0,
                    snow_max=0,
                    wind_avg=15,
                    wind_max=25,
                    cloud_cover=30,
                    cloud_base=1500,
                    freezing_level=3000,
                    cape=0
                )
            ],
            fetched_at=datetime.now(TZ_HOBART),
            expires_at=datetime.now(TZ_HOBART),
            source="bom"
        )
        mock_bom_service.get_hourly_forecast.return_value = mock_forecast

        # Import and call
        with patch('app.models.database.user_store') as us, \
             patch('app.models.account.account_store') as acc:
            us.get_user.return_value = None
            acc.get_by_phone.return_value = None

            from app.routers.webhook import generate_cast_forecast_gps
            result = await generate_cast_forecast_gps(-33.86, 151.21, hours=12)

        # Verify BOM was called, not WeatherRouter
        mock_bom_service.get_hourly_forecast.assert_called_once()
        mock_weather_router.get_forecast.assert_not_called()
        assert "GPS" in result or "-33.86" in result

    @pytest.mark.asyncio
    async def test_us_coordinates_use_weather_router(self, mock_bom_service, mock_weather_router):
        """US GPS coordinates use WeatherRouter, not BOM."""
        from app.services.weather.base import NormalizedDailyForecast, NormalizedForecast
        from datetime import datetime, timezone

        # Set up WeatherRouter mock
        mock_normalized = NormalizedDailyForecast(
            provider="NWS",
            lat=40.71,
            lon=-74.00,
            country_code="US",
            periods=[
                NormalizedForecast(
                    provider="NWS",
                    lat=40.71,
                    lon=-74.00,
                    timestamp=datetime.now(timezone.utc),
                    temp_min=5,
                    temp_max=12,
                    rain_chance=30,
                    rain_amount=2.0,
                    wind_avg=20,
                    wind_max=35,
                    wind_direction="NW",
                    cloud_cover=50,
                    freezing_level=1500,
                    snow_amount=0,
                    description="Partly cloudy"
                )
            ],
            alerts=[],
            fetched_at=datetime.now(timezone.utc),
            is_fallback=False
        )
        mock_weather_router.get_forecast.return_value = mock_normalized

        with patch('app.models.database.user_store') as us, \
             patch('app.models.account.account_store') as acc:
            us.get_user.return_value = None
            acc.get_by_phone.return_value = None

            from app.routers.webhook import generate_cast_forecast_gps
            result = await generate_cast_forecast_gps(40.71, -74.00, hours=12)

        # Verify WeatherRouter was called, not BOM hourly
        mock_weather_router.get_forecast.assert_called_once()
        mock_bom_service.get_hourly_forecast.assert_not_called()

    @pytest.mark.asyncio
    async def test_cast7_au_uses_bom(self, mock_bom_service, mock_weather_router):
        """CAST7 with AU GPS coordinates uses BOM service."""
        from app.services.bom import CellForecast, ForecastPeriod
        from datetime import datetime
        from config.settings import TZ_HOBART

        mock_forecast = CellForecast(
            cell_id="GPS",
            geohash="r1r0",
            lat=-33.86,
            lon=151.21,
            base_elevation=500,
            periods=[
                ForecastPeriod(
                    datetime=datetime.now(TZ_HOBART),
                    period="DAY",
                    temp_min=15,
                    temp_max=22,
                    rain_chance=20,
                    rain_min=0,
                    rain_max=1,
                    snow_min=0,
                    snow_max=0,
                    wind_avg=15,
                    wind_max=25,
                    cloud_cover=30,
                    cloud_base=1500,
                    freezing_level=3000,
                    cape=0
                )
            ],
            fetched_at=datetime.now(TZ_HOBART),
            expires_at=datetime.now(TZ_HOBART),
            source="bom"
        )
        mock_bom_service.get_daily_forecast.return_value = mock_forecast

        with patch('app.models.database.user_store') as us, \
             patch('app.models.account.account_store') as acc:
            us.get_user.return_value = None
            acc.get_by_phone.return_value = None

            from app.routers.webhook import generate_cast7_forecast_gps
            result = await generate_cast7_forecast_gps(-33.86, 151.21)

        mock_bom_service.get_daily_forecast.assert_called_once()
        mock_weather_router.get_forecast.assert_not_called()

    @pytest.mark.asyncio
    async def test_cast7_uk_uses_weather_router(self, mock_bom_service, mock_weather_router):
        """CAST7 with UK GPS coordinates uses WeatherRouter."""
        from app.services.weather.base import NormalizedDailyForecast, NormalizedForecast
        from datetime import datetime, timezone

        mock_normalized = NormalizedDailyForecast(
            provider="Met Office",
            lat=51.50,
            lon=-0.12,
            country_code="GB",
            periods=[
                NormalizedForecast(
                    provider="Met Office",
                    lat=51.50,
                    lon=-0.12,
                    timestamp=datetime.now(timezone.utc),
                    temp_min=8,
                    temp_max=14,
                    rain_chance=60,
                    rain_amount=5.0,
                    wind_avg=25,
                    wind_max=40,
                    wind_direction="SW",
                    cloud_cover=80,
                    freezing_level=2000,
                    snow_amount=0,
                    description="Rain likely"
                )
            ],
            alerts=[],
            fetched_at=datetime.now(timezone.utc),
            is_fallback=False
        )
        mock_weather_router.get_forecast.return_value = mock_normalized

        with patch('app.models.database.user_store') as us, \
             patch('app.models.account.account_store') as acc:
            us.get_user.return_value = None
            acc.get_by_phone.return_value = None

            from app.routers.webhook import generate_cast7_forecast_gps
            result = await generate_cast7_forecast_gps(51.50, -0.12)

        mock_weather_router.get_forecast.assert_called_once()
        mock_bom_service.get_daily_forecast.assert_not_called()


# =============================================================================
# INTEGRATION TESTS: End-to-End SMS Command Flow
# =============================================================================

class TestSMSCommandFlow:
    """Integration tests for complete SMS command flow."""

    def test_cast_gps_command_parsed_correctly(self):
        """CAST with GPS coordinates is parsed and marked as GPS."""
        from app.services.commands import CommandParser, CommandType

        parser = CommandParser()
        result = parser.parse("CAST 40.71,-74.00")

        assert result.command_type == CommandType.CAST
        assert result.is_valid is True
        assert result.args.get("is_gps") is True

    def test_cast7_gps_command_parsed_correctly(self):
        """CAST7 with GPS coordinates is parsed and marked as GPS."""
        from app.services.commands import CommandParser, CommandType

        parser = CommandParser()
        result = parser.parse("CAST7 51.50,-0.12")

        assert result.command_type == CommandType.CAST7
        assert result.is_valid is True
        assert result.args.get("is_gps") is True

    def test_unsupported_country_uses_fallback(self):
        """GPS in unsupported country returns None from geo detection."""
        from app.services.geo import get_country_from_coordinates

        # Japan is not supported
        result = get_country_from_coordinates(35.68, 139.69)
        assert result is None

        # WeatherRouter will use Open-Meteo fallback for empty country code


# =============================================================================
# EDGE CASES AND ERROR HANDLING
# =============================================================================

class TestEdgeCases:
    """Tests for edge cases and error handling."""

    def test_geo_boundary_australia_north(self):
        """Northern boundary of Australia bounding box."""
        from app.services.geo import get_country_from_coordinates
        # Darwin area (northern AU)
        result = get_country_from_coordinates(-12.46, 130.84)
        assert result == "AU"

    def test_geo_boundary_australia_south(self):
        """Southern boundary of Australia (Tasmania)."""
        from app.services.geo import get_country_from_coordinates
        result = get_country_from_coordinates(-43.5, 147.0)
        assert result == "AU"

    def test_converter_handles_none_values(self):
        """Converter handles None values gracefully."""
        from app.services.weather.base import NormalizedDailyForecast, NormalizedForecast
        from app.services.weather.converter import normalized_to_cell_forecast
        from datetime import datetime, timezone

        period = NormalizedForecast(
            provider="Test",
            lat=0.0,
            lon=0.0,
            timestamp=datetime.now(timezone.utc),
            temp_min=10.0,
            temp_max=20.0,
            rain_chance=0,
            rain_amount=0.0,  # No None, but 0
            wind_avg=0.0,
            wind_max=0.0,
            wind_direction="N",
            cloud_cover=0,
            freezing_level=None,  # None should be handled
            snow_amount=0.0,
            description=""
        )

        forecast = NormalizedDailyForecast(
            provider="Test",
            lat=0.0,
            lon=0.0,
            country_code="XX",
            periods=[period],
            alerts=[],
            fetched_at=datetime.now(timezone.utc),
            is_fallback=False
        )

        # Should not raise
        result = normalized_to_cell_forecast(forecast, 0.0, 0.0, 500)
        assert result is not None
        assert len(result.periods) == 1

    def test_parser_gps_at_boundary(self):
        """Parser handles GPS at valid boundaries."""
        from app.services.commands import CommandParser

        parser = CommandParser()

        # Max valid values
        result = parser.parse("CAST 90.0,180.0")
        assert result.is_valid is True

        result = parser.parse("CAST -90.0,-180.0")
        assert result.is_valid is True
