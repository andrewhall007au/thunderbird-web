"""
V3.2 Dynamic Grouping Tests

Tests for the CAST7 CAMPS/PEAKS dynamic grouping feature:
- Weather metrics extraction
- Similarity comparison (±2°C, ±2mm, ±5km/h)
- Location grouping algorithm
- Grouped format output

Run with: pytest tests/test_v3_dynamic_grouping.py -v
"""

import pytest
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

TZ_HOBART = ZoneInfo("Australia/Hobart")


# =============================================================================
# Weather Metrics Tests
# =============================================================================

class TestWeatherMetrics:
    """Test weather metrics extraction and comparison."""

    def test_extract_metrics_basic(self):
        """Should extract min/max temp, rain, wind from forecast data."""
        from app.services.formatter import extract_weather_metrics

        forecast_days = [
            {"temp": "5-12", "rain_max": 3, "wind_max": 25},
            {"temp": "6-14", "rain_max": 5, "wind_max": 30},
            {"temp": "4-10", "rain_max": 2, "wind_max": 20},
        ]

        metrics = extract_weather_metrics("LAKEO", forecast_days)

        assert metrics.location_code == "LAKEO"
        assert metrics.temp_min == 4  # min of mins
        assert metrics.temp_max == 14  # max of maxs
        assert metrics.rain_max == 5  # max rain
        assert metrics.wind_max == 30  # max wind

    def test_extract_metrics_handles_string_values(self):
        """Should handle string-formatted values."""
        from app.services.formatter import extract_weather_metrics

        forecast_days = [
            {"temp": "3-8", "rain_max": "4", "wind_max": "35"},
            {"temp_range": "5-10", "rain": "R0-6", "wm": "40"},
        ]

        metrics = extract_weather_metrics("HIGHM", forecast_days)

        assert metrics.temp_min == 3
        assert metrics.temp_max == 10
        assert metrics.rain_max == 6
        assert metrics.wind_max == 40

    def test_extract_metrics_empty_data(self):
        """Should handle empty forecast data gracefully."""
        from app.services.formatter import extract_weather_metrics

        metrics = extract_weather_metrics("EMPTY", [])

        assert metrics.location_code == "EMPTY"
        assert metrics.temp_min == 0
        assert metrics.rain_max == 0

    def test_metrics_similarity_within_threshold(self):
        """Locations within ±2°C, ±2mm, ±5km/h should be similar."""
        from app.services.formatter import WeatherMetrics

        loc1 = WeatherMetrics("LOC1", temp_min=5, temp_max=12, rain_max=4, wind_max=30)
        loc2 = WeatherMetrics("LOC2", temp_min=6, temp_max=13, rain_max=5, wind_max=33)

        assert loc1.is_similar_to(loc2), "Locations within threshold should be similar"

    def test_metrics_similarity_outside_temp_threshold(self):
        """Locations with >2°C difference should not be similar."""
        from app.services.formatter import WeatherMetrics

        loc1 = WeatherMetrics("LOC1", temp_min=5, temp_max=10, rain_max=3, wind_max=25)
        loc2 = WeatherMetrics("LOC2", temp_min=10, temp_max=18, rain_max=3, wind_max=25)

        # Average temp: (5+10)/2=7.5 vs (10+18)/2=14, diff=6.5 > 2
        assert not loc1.is_similar_to(loc2), "Large temp difference should not be similar"

    def test_metrics_similarity_outside_rain_threshold(self):
        """Locations with >2mm rain difference should not be similar."""
        from app.services.formatter import WeatherMetrics

        loc1 = WeatherMetrics("LOC1", temp_min=5, temp_max=12, rain_max=2, wind_max=30)
        loc2 = WeatherMetrics("LOC2", temp_min=5, temp_max=12, rain_max=8, wind_max=30)

        assert not loc1.is_similar_to(loc2), "Large rain difference should not be similar"

    def test_metrics_similarity_outside_wind_threshold(self):
        """Locations with >5km/h wind difference should not be similar."""
        from app.services.formatter import WeatherMetrics

        loc1 = WeatherMetrics("LOC1", temp_min=5, temp_max=12, rain_max=3, wind_max=25)
        loc2 = WeatherMetrics("LOC2", temp_min=5, temp_max=12, rain_max=3, wind_max=35)

        assert not loc1.is_similar_to(loc2), "Large wind difference should not be similar"


# =============================================================================
# Grouping Algorithm Tests
# =============================================================================

class TestGroupingAlgorithm:
    """Test the location grouping algorithm."""

    def test_group_similar_locations(self):
        """Similar locations should be grouped together."""
        from app.services.formatter import group_locations_by_weather

        # Three locations with similar weather
        forecast_data = {
            "LAKEO": [{"temp": "5-12", "rain_max": 3, "wind_max": 30}] * 7,
            "HIGHM": [{"temp": "5-13", "rain_max": 4, "wind_max": 32}] * 7,
            "LAKEH": [{"temp": "6-12", "rain_max": 3, "wind_max": 28}] * 7,
        }

        groups = group_locations_by_weather(forecast_data)

        # Should all be in one group
        assert len(groups) == 1, f"Expected 1 group, got {len(groups)}"
        assert len(groups[0]) == 3, "All 3 locations should be in same group"

    def test_group_dissimilar_locations(self):
        """Dissimilar locations should be in separate groups."""
        from app.services.formatter import group_locations_by_weather

        forecast_data = {
            # Low elevation - warmer
            "JUNCT": [{"temp": "10-18", "rain_max": 2, "wind_max": 15}] * 7,
            # High elevation - colder
            "LAKEO": [{"temp": "2-8", "rain_max": 5, "wind_max": 35}] * 7,
            # Mid elevation - middle
            "LAKEF": [{"temp": "5-12", "rain_max": 3, "wind_max": 25}] * 7,
        }

        groups = group_locations_by_weather(forecast_data)

        # Should be 3 separate groups (significantly different)
        assert len(groups) >= 2, f"Expected at least 2 groups, got {len(groups)}"

    def test_group_mixed_similarity(self):
        """Should correctly group mixed similar/dissimilar locations."""
        from app.services.formatter import group_locations_by_weather

        forecast_data = {
            # Group 1: Similar high elevation
            "LAKEO": [{"temp": "3-10", "rain_max": 4, "wind_max": 35}] * 7,
            "HIGHM": [{"temp": "3-11", "rain_max": 5, "wind_max": 38}] * 7,
            # Group 2: Similar low elevation
            "JUNCT": [{"temp": "12-20", "rain_max": 1, "wind_max": 12}] * 7,
            "SCOTT": [{"temp": "13-21", "rain_max": 2, "wind_max": 14}] * 7,
        }

        groups = group_locations_by_weather(forecast_data)

        assert len(groups) == 2, f"Expected 2 groups, got {len(groups)}"

        # Each group should have 2 locations
        group_sizes = sorted([len(g) for g in groups])
        assert group_sizes == [2, 2], f"Expected [2, 2], got {group_sizes}"

    def test_group_single_location(self):
        """Single location should form its own group."""
        from app.services.formatter import group_locations_by_weather

        forecast_data = {
            "LAKEO": [{"temp": "5-12", "rain_max": 3, "wind_max": 30}] * 7,
        }

        groups = group_locations_by_weather(forecast_data)

        assert len(groups) == 1
        assert groups[0] == ["LAKEO"]

    def test_group_empty_data(self):
        """Empty forecast data should return empty groups."""
        from app.services.formatter import group_locations_by_weather

        groups = group_locations_by_weather({})

        assert groups == []


# =============================================================================
# Representative Forecast Tests
# =============================================================================

class TestRepresentativeForecast:
    """Test the representative forecast generation for groups."""

    def test_representative_averages_temperatures(self):
        """Representative forecast should average temperatures."""
        from app.services.formatter import get_group_representative_forecast

        forecast_data = {
            "LOC1": [{"temp": "4-10", "rain_chance": 20, "rain_max": 2, "wind_avg": 15, "wind_max": 25}],
            "LOC2": [{"temp": "6-14", "rain_chance": 30, "rain_max": 4, "wind_avg": 20, "wind_max": 30}],
        }

        rep = get_group_representative_forecast(["LOC1", "LOC2"], forecast_data)

        assert len(rep) == 1
        # Average of (4,6)=5 and (10,14)=12
        assert rep[0]["temp"] == "5-12"

    def test_representative_takes_max_rain(self):
        """Representative forecast should take max rain."""
        from app.services.formatter import get_group_representative_forecast

        forecast_data = {
            "LOC1": [{"temp": "5-12", "rain_max": 2, "prec": "R0-2"}],
            "LOC2": [{"temp": "5-12", "rain_max": 6, "prec": "R0-6"}],
        }

        rep = get_group_representative_forecast(["LOC1", "LOC2"], forecast_data)

        assert "6" in rep[0]["prec"], "Should show max rain"

    def test_representative_takes_max_wind(self):
        """Representative forecast should take max wind."""
        from app.services.formatter import get_group_representative_forecast

        forecast_data = {
            "LOC1": [{"temp": "5-12", "wind_avg": 20, "wind_max": 30}],
            "LOC2": [{"temp": "5-12", "wind_avg": 25, "wind_max": 40}],
        }

        rep = get_group_representative_forecast(["LOC1", "LOC2"], forecast_data)

        assert rep[0]["wind_max"] == 40


# =============================================================================
# Formatted Output Tests
# =============================================================================

class TestFormatCAST7Grouped:
    """Test the grouped CAST7 output format."""

    def test_format_includes_grouping_notice(self):
        """Output should include grouping thresholds notice."""
        from app.services.formatter import FormatCAST7Grouped

        forecast_data = {
            "LAKEO": [{"temp": "5-12", "rain_chance": 30, "rain_max": 3, "wind_avg": 20, "wind_max": 35}] * 7,
        }

        result = FormatCAST7Grouped.format(
            "Western Arthurs",
            forecast_data,
            "CAMPS",
            date=datetime.now(TZ_HOBART)
        )

        assert "±2C" in result, "Should show temperature threshold"
        assert "±2mm" in result, "Should show rain threshold"
        assert "±5km/h" in result, "Should show wind threshold"

    def test_format_shows_zone_headers(self):
        """Output should show ZONE headers with location codes."""
        from app.services.formatter import FormatCAST7Grouped

        forecast_data = {
            "LAKEO": [{"temp": "5-12", "rain_max": 3, "wind_max": 35}] * 7,
            "HIGHM": [{"temp": "5-13", "rain_max": 4, "wind_max": 38}] * 7,
        }

        result = FormatCAST7Grouped.format(
            "Western Arthurs",
            forecast_data,
            "CAMPS",
            date=datetime.now(TZ_HOBART)
        )

        assert "ZONE 1:" in result, "Should have zone header"
        assert "LAKEO" in result or "HIGHM" in result, "Should list location codes"

    def test_format_shows_column_header(self):
        """Output should include column header."""
        from app.services.formatter import FormatCAST7Grouped

        forecast_data = {
            "LAKEO": [{"temp": "5-12", "rain_max": 3, "wind_max": 35}] * 7,
        }

        result = FormatCAST7Grouped.format(
            "Western Arthurs",
            forecast_data,
            "CAMPS",
            date=datetime.now(TZ_HOBART)
        )

        assert "Day|Tmp|%Rn|Prec|Wa|Wm|Wd|%Cd|CB|FL|D" in result

    def test_format_shows_summary_line(self):
        """Output should show summary of locations vs zones."""
        from app.services.formatter import FormatCAST7Grouped

        forecast_data = {
            "LAKEO": [{"temp": "5-12", "rain_max": 3, "wind_max": 35}] * 7,
            "HIGHM": [{"temp": "5-13", "rain_max": 4, "wind_max": 38}] * 7,
            "LAKEH": [{"temp": "6-12", "rain_max": 3, "wind_max": 33}] * 7,
        }

        result = FormatCAST7Grouped.format(
            "Western Arthurs",
            forecast_data,
            "CAMPS",
            date=datetime.now(TZ_HOBART)
        )

        # Should show "3 locations → X zones"
        assert "locations" in result.lower()
        assert "zones" in result.lower()

    def test_format_multi_splits_large_output(self):
        """Large output should be split into multiple messages."""
        from app.services.formatter import FormatCAST7Grouped

        # Create enough data to exceed single message limit
        forecast_data = {}
        for i in range(10):
            code = f"LOC{i:02d}"
            # Make each unique enough to be its own group
            forecast_data[code] = [
                {"temp": f"{i*3}-{i*3+10}", "rain_max": i, "wind_max": 20 + i*5}
            ] * 7

        messages = FormatCAST7Grouped.format_multi(
            "Test Route",
            forecast_data,
            "CAMPS",
            date=datetime.now(TZ_HOBART)
        )

        # Should split into multiple messages
        if len("".join(messages)) > 450:
            assert len(messages) > 1, "Large output should split into multiple messages"
            # First message should have part number
            assert "[1/" in messages[0]

    def test_format_camps_vs_peaks(self):
        """Should correctly label CAMPS or PEAKS in header."""
        from app.services.formatter import FormatCAST7Grouped

        forecast_data = {
            "HESPE": [{"temp": "0-6", "rain_max": 5, "wind_max": 45}] * 7,
        }

        camps_result = FormatCAST7Grouped.format(
            "Western Arthurs",
            forecast_data,
            "CAMPS",
            date=datetime.now(TZ_HOBART)
        )

        peaks_result = FormatCAST7Grouped.format(
            "Western Arthurs",
            forecast_data,
            "PEAKS",
            date=datetime.now(TZ_HOBART)
        )

        assert "CAST7 CAMPS" in camps_result
        assert "CAST7 PEAKS" in peaks_result


# =============================================================================
# Integration Tests
# =============================================================================

class TestGroupingIntegration:
    """Integration tests for the full grouping workflow."""

    def test_western_arthurs_camps_grouping(self):
        """Test grouping with realistic Western Arthurs camp data."""
        from app.services.formatter import FormatCAST7Grouped, group_locations_by_weather

        # Simulate real-ish Western Arthurs data
        # High camps (similar cold/windy)
        high_camp_weather = [{"temp": "2-8", "rain_max": 6, "wind_max": 45}] * 7
        # Mid camps (moderate)
        mid_camp_weather = [{"temp": "5-12", "rain_max": 4, "wind_max": 30}] * 7
        # Low camps (warmer, less wind)
        low_camp_weather = [{"temp": "10-18", "rain_max": 2, "wind_max": 15}] * 7

        forecast_data = {
            # High elevation
            "LAKEO": high_camp_weather,
            "HIGHM": high_camp_weather,
            "LAKEH": high_camp_weather,
            # Mid elevation
            "LAKEF": mid_camp_weather,
            "LAKEC": mid_camp_weather,
            # Low elevation
            "JUNCT": low_camp_weather,
            "SCOTT": low_camp_weather,
        }

        groups = group_locations_by_weather(forecast_data)

        # Should have 3 groups based on elevation bands
        assert len(groups) == 3, f"Expected 3 elevation-based groups, got {len(groups)}"

        # Format and check it's reasonable
        result = FormatCAST7Grouped.format(
            "Western Arthurs (Full)",
            forecast_data,
            "CAMPS",
            date=datetime.now(TZ_HOBART)
        )

        # Should have 3 zones
        assert result.count("ZONE") == 3
        # Summary should show reduction
        assert "7 locations" in result
        assert "3 zones" in result

    def test_grouping_reduces_sms_payload(self):
        """Grouping should significantly reduce SMS payload."""
        from app.services.formatter import FormatCAST7Grouped, FormatCAST7

        # Same weather data for all camps (worst case for ungrouped)
        same_weather = [
            {"temp": "5-12", "rain_chance": 30, "prec": "R0-3",
             "wind_avg": 20, "wind_max": 35, "wind_dir": "W",
             "cloud": 50, "cloud_base": 12, "freezing_level": 18}
        ] * 7

        forecast_data = {
            "LAKEO": same_weather,
            "HIGHM": same_weather,
            "LAKEH": same_weather,
            "LAKES": same_weather,
            "LAKEV": same_weather,
        }

        # Grouped format
        grouped = FormatCAST7Grouped.format(
            "Test Route",
            forecast_data,
            "CAMPS",
            date=datetime.now(TZ_HOBART)
        )

        # Ungrouped format
        ungrouped = FormatCAST7.format(
            "Test Route",
            forecast_data,
            date=datetime.now(TZ_HOBART)
        )

        # Grouped should be significantly smaller
        assert len(grouped) < len(ungrouped), \
            f"Grouped ({len(grouped)}) should be smaller than ungrouped ({len(ungrouped)})"

        # Should achieve at least 40% reduction for identical weather
        reduction = (len(ungrouped) - len(grouped)) / len(ungrouped)
        assert reduction > 0.4, f"Expected >40% reduction, got {reduction*100:.0f}%"
