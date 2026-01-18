"""
V3.0 Format Change Tests

Tests for SMS format changes:
- Prec column: Merged Rn/Sn into single column (R2-4, S1-2)
- Wd column: Wind direction added (NW, SW, W, etc.)
- CB column: Removed (cloud base)
- Case insensitivity: All codes case-insensitive

Run with: pytest tests/test_v3_format_changes.py -v
"""

import pytest
import re
from datetime import datetime
from zoneinfo import ZoneInfo

TZ_HOBART = ZoneInfo("Australia/Hobart")


# =============================================================================
# Prec Column Tests (Merged Rain/Snow)
# =============================================================================

class TestPrecColumn:
    """
    v3.0 merged Rn and Sn into single Prec column.
    Format: R2-4 (rain mm), S1-2 (snow cm)
    Spec Section 5.2
    """
    
    def test_prec_rain_format(self):
        """Rain should display as R#-# format"""
        from app.services.formatter import format_precipitation
        
        # Test various rain amounts
        test_cases = [
            (0, 0, False, "R0-0"),   # No rain
            (1, 3, False, "R1-3"),   # Light rain
            (5, 12, False, "R5-12"), # Heavy rain
        ]
        
        for rain_min, rain_max, is_snow, expected in test_cases:
            result = format_precipitation(rain_min, rain_max, is_snow)
            assert result == expected, f"Expected {expected}, got {result}"
    
    def test_prec_snow_format(self):
        """Snow should display as S#-# format"""
        from app.services.formatter import format_precipitation

        # Test snow amounts
        test_cases = [
            (0, 0, True, "S0-0"),    # No snow
            (1, 2, True, "S1-2"),    # Light snow
            (3, 8, True, "S3-8"),    # Heavy snow
        ]

        for snow_min, snow_max, is_snow, expected in test_cases:
            result = format_precipitation(snow_min, snow_max, is_snow)
            assert result == expected, f"Expected {expected}, got {result}"

    def test_prec_combined_format(self):
        """v3.1: Should show both rain and snow when both present"""
        from app.services.formatter import format_precipitation_combined

        # Rain only
        assert format_precipitation_combined(1, 4, 0, 0) == "R1-4"

        # Snow only
        assert format_precipitation_combined(0, 0, 1, 2) == "S1-2"

        # Both rain and snow (mixed conditions)
        assert format_precipitation_combined(2, 4, 1, 2) == "R4/S2"

        # No precipitation
        assert format_precipitation_combined(0, 0, 0, 0) == "-"

    def test_prec_determines_type_by_freezing_level(self):
        """Should determine precip type based on freezing level vs elevation"""
        from app.services.formatter import determine_precip_type

        # Camp at 863m
        camp_elevation = 863

        # Freezing level at 1800m - clearly rain (well above elevation)
        assert determine_precip_type(camp_elevation, 1800) == "rain"

        # Freezing level at 500m - clearly snow (well below elevation)
        assert determine_precip_type(camp_elevation, 500) == "snow"

        # Freezing level at 800m - near elevation, could be mixed
        result = determine_precip_type(camp_elevation, 800)
        assert result in ["snow", "mixed"], "Near-freezing should be snow or mixed"

        # Freezing level at 900m - also near elevation
        result = determine_precip_type(camp_elevation, 900)
        assert result in ["snow", "mixed"], "Near-freezing should be snow or mixed"
    
    def test_prec_column_in_header(self):
        """Header should show Prec, not Rn|Sn"""
        from app.services.formatter import get_forecast_header
        
        header = get_forecast_header()
        
        assert "Prec" in header, "Header should include Prec column"
        assert "Rn|Sn" not in header, "Old Rn|Sn format should be removed"
        assert header.count("|Rn|") == 0, "Should not have separate Rn column"
        assert header.count("|Sn|") == 0, "Should not have separate Sn column"


# =============================================================================
# Wd Column Tests (Wind Direction)
# =============================================================================

class TestWdColumn:
    """
    v3.0 added Wd (wind direction) column.
    Values: NW, SW, W, N, NE, E, SE, S
    Direction changes indicate potential danger.
    Spec Section 5.2
    """
    
    def test_wd_valid_directions(self):
        """Wind direction should be 1-2 letter compass direction"""
        valid_directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
        
        from app.services.formatter import format_wind_direction
        
        for degrees in range(0, 360, 45):
            direction = format_wind_direction(degrees)
            assert direction in valid_directions, \
                f"Invalid direction {direction} for {degrees}°"
    
    def test_wd_degree_conversion(self):
        """Degrees should convert to correct compass direction"""
        from app.services.formatter import format_wind_direction
        
        test_cases = [
            (0, "N"),
            (45, "NE"),
            (90, "E"),
            (135, "SE"),
            (180, "S"),
            (225, "SW"),
            (270, "W"),
            (315, "NW"),
            (360, "N"),  # Same as 0
        ]
        
        for degrees, expected in test_cases:
            result = format_wind_direction(degrees)
            assert result == expected, f"Expected {expected} for {degrees}°, got {result}"
    
    def test_wd_column_in_header(self):
        """Header should include Wd column"""
        from app.services.formatter import get_forecast_header
        
        header = get_forecast_header()
        
        assert "Wd" in header, "Header should include Wd column"
    
    def test_wd_unusual_direction_flagged(self):
        """Unusual wind directions (E, NE) should potentially flag danger"""
        from app.services.formatter import is_unusual_wind_direction
        
        # Tasmania is in Roaring Forties - westerly is normal
        assert not is_unusual_wind_direction("W"), "W is normal"
        assert not is_unusual_wind_direction("NW"), "NW is normal"
        assert not is_unusual_wind_direction("SW"), "SW is normal"
        
        # Easterly winds are unusual - potential front
        assert is_unusual_wind_direction("E"), "E is unusual"
        assert is_unusual_wind_direction("NE"), "NE is unusual"
        assert is_unusual_wind_direction("SE"), "SE is unusual"


# =============================================================================
# CB Column Tests (Reinstated in v3.1)
# =============================================================================

class TestCBColumnPresent:
    """
    v3.1 reinstated CB (cloud base) column - critical for alpine safety.
    Spec Section 5.2
    """

    def test_cb_in_header(self):
        """Header SHOULD include CB column"""
        from app.services.formatter import get_forecast_header

        header = get_forecast_header()

        assert "CB" in header, "CB column should be present in v3.1"
        assert "|CB|" in header, "CB column should appear between other columns"

    def test_cb_in_daily_header(self):
        """Daily header SHOULD include CB column"""
        from app.services.formatter import get_daily_header

        header = get_daily_header()

        assert "CB" in header, "CB column should be present in daily header"
        assert "|CB|" in header, "CB column should appear between other columns"

    def test_cb_in_key_response(self):
        """KEY command should explain CB"""
        from app.services.commands import ResponseGenerator

        key_response = ResponseGenerator.key_message()

        # CB should be explained (cloud base is critical for alpine safety)
        assert "CB" in key_response, "KEY should explain CB column"


# =============================================================================
# Case Insensitivity Tests
# =============================================================================

class TestCaseInsensitivity:
    """
    All codes should be case-insensitive.
    Spec Section 3.1, 3.2
    """
    
    def test_camp_codes_case_insensitive(self):
        """Camp codes should work in any case"""
        from app.services.routes import validate_camp_code
        
        test_codes = [
            ("LAKEO", True),
            ("lakeo", True),
            ("Lakeo", True),
            ("LaKeO", True),
            ("XXXXX", False),
        ]
        
        for code, expected_valid in test_codes:
            result = validate_camp_code(code)
            assert result == expected_valid, f"Code {code} validation failed"
    
    def test_peak_codes_case_insensitive(self):
        """Peak codes should work in any case"""
        from app.services.routes import validate_peak_code
        
        test_codes = [
            ("HESPE", True),
            ("hespe", True),
            ("Hespe", True),
            ("FEDER", True),
            ("feder", True),
        ]
        
        for code, expected_valid in test_codes:
            result = validate_peak_code(code)
            assert result == expected_valid, f"Peak code {code} validation failed"
    
    def test_command_case_insensitive(self):
        """Commands should work in any case"""
        from app.services.commands import CommandParser
        
        parser = CommandParser()
        
        commands = [
            "CAST LAKEO",
            "cast lakeo",
            "Cast Lakeo",
            "CHECKIN LAKEO",
            "checkin lakeo",
            "STATUS",
            "status",
            "KEY",
            "key",
        ]
        
        for cmd in commands:
            parsed = parser.parse(cmd)
            assert parsed is not None, f"Failed to parse: {cmd}"
            assert parsed.command_type is not None, f"No command type for: {cmd}"


# =============================================================================
# SMS Character Budget Tests
# =============================================================================

class TestSMSCharacterBudget:
    """
    Test that responses fit within SMS segment limits.
    Spec Section 5.8
    """
    
    def test_cast12_under_500_chars(self):
        """CAST12 should fit in ~3 SMS (under 500 chars)"""
        # This is tested in test_v3_cast_commands.py but double-check
        pass  # Placeholder for format tests
    
    def test_gsm7_encoding_used(self):
        """Responses should use GSM-7 safe characters"""
        from app.services.formatter import is_gsm7_safe
        
        # Characters that break GSM-7 encoding
        unsafe_chars = ["°", "€", "£", "¥", "©", "®", "←", "→"]
        
        for char in unsafe_chars:
            assert not is_gsm7_safe(char), f"{char} should be flagged as unsafe"
        
        # Safe characters
        safe_chars = ["C", "%", "-", "|", "/", "!", "?"]
        for char in safe_chars:
            assert is_gsm7_safe(char), f"{char} should be safe"
    
    def test_no_degree_symbol(self):
        """Responses should use 'C' not '°C' for temperature"""
        from app.services.formatter import format_temperature
        
        result = format_temperature(15)
        
        assert "°" not in result, "Should not use degree symbol"
        assert "C" in result or result.isdigit(), "Should show temp without degree symbol"
    
    def test_header_character_count(self):
        """Header should fit within line limit"""
        from app.services.formatter import get_forecast_header
        
        header = get_forecast_header()
        
        # Target: 42 chars max per line
        assert len(header) <= 45, f"Header too long: {len(header)} chars"


# =============================================================================
# Peak Elevation Display Tests
# =============================================================================

class TestPeakElevationDisplay:
    """
    v3.0 shows peak full names with elevations.
    Spec Section 7.5
    """
    
    def test_peak_shows_full_name(self):
        """Peak codes should resolve to full names"""
        from app.services.routes import get_peak_full_name
        
        test_cases = [
            ("HESPE", "Mt Hesperus"),
            ("PROCY", "Procyon Peak"),
            ("FEDER", "Federation Peak"),
            ("SIRIU", "Mt Sirius"),
            ("CRADL", "Cradle Mountain"),
        ]
        
        for code, expected_name in test_cases:
            result = get_peak_full_name(code)
            assert expected_name in result, f"Expected {expected_name} for {code}, got {result}"
    
    def test_peak_shows_elevation(self):
        """Peak display should include elevation"""
        from app.services.routes import get_peak_display
        
        result = get_peak_display("FEDER")
        
        # Federation Peak is 1225m
        assert "1225" in result, "Should show elevation 1225m for Federation Peak"
        assert "m" in result.lower(), "Should show 'm' for meters"
    
    def test_onboarding_peaks_have_elevations(self):
        """Onboarding message should show peaks with elevations"""
        from app.services.onboarding import get_peaks_message
        
        result = get_peaks_message("western_arthurs_full")
        
        # Check format: CODE = Full Name (####m)
        pattern = r'[A-Z]{5}\s*=\s*.+\(\d{4}m\)'
        matches = re.findall(pattern, result)
        
        assert len(matches) >= 5, f"Expected peaks with elevations, found {len(matches)}"
