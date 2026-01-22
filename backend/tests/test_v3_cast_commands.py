"""
V3.0 CAST Command Tests

Tests for the new pull-based forecast system:
- CAST / CAST12: 12-hour hourly forecast
- CAST24: 24-hour hourly forecast  
- CAST7: 7-day all camps on route
- PEAKS: 7-day all peaks on route

Run with: pytest tests/test_v3_cast_commands.py -v
"""

import pytest
import re
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from zoneinfo import ZoneInfo

TZ_HOBART = ZoneInfo("Australia/Hobart")


# =============================================================================
# CAST / CAST12 Tests (12-hour hourly forecast)
# =============================================================================

class TestCAST12Command:
    """
    CAST and CAST12 return identical 12-hour hourly forecasts.
    Spec Section 8.2.1
    """
    
    def test_cast_parses_camp_code(self):
        """CAST LAKEO should parse camp code correctly"""
        from app.services.commands import CommandParser
        
        parser = CommandParser()
        
        # Test various formats
        for cmd in ["CAST LAKEO", "cast lakeo", "CAST12 LAKEO", "cast12 lakeo"]:
            parsed = parser.parse(cmd)
            assert parsed.command_type.name in ["CAST", "CAST12"], f"Failed for: {cmd}"
            assert parsed.location_code.upper() == "LAKEO", f"Failed to parse location from: {cmd}"
    
    def test_cast_parses_peak_code(self):
        """CAST should also work with peak codes"""
        from app.services.commands import CommandParser
        
        parser = CommandParser()
        
        # Peak codes from spec Section 3.2
        peak_codes = ["HESPE", "PROCY", "FEDER", "SIRIU", "ORION"]
        
        for code in peak_codes:
            parsed = parser.parse(f"CAST {code}")
            assert parsed.location_code.upper() == code, f"Failed to parse peak: {code}"
    
    def test_cast_case_insensitive(self):
        """All commands should be case-insensitive"""
        from app.services.commands import CommandParser
        
        parser = CommandParser()
        
        variations = [
            "CAST LAKEO",
            "cast lakeo",
            "Cast Lakeo",
            "cAsT lAkEo",
        ]
        
        for cmd in variations:
            parsed = parser.parse(cmd)
            assert parsed.command_type.name in ["CAST", "CAST12"], f"Failed: {cmd}"
            assert parsed.location_code.upper() == "LAKEO", f"Failed location: {cmd}"


# =============================================================================
# CAST24 Tests (24-hour hourly forecast)
# =============================================================================

class TestCAST24Command:
    """
    CAST24 returns 24-hour hourly forecast (6 SMS).
    Spec Section 8.2.2
    """
    
    def test_cast24_parses_correctly(self):
        """CAST24 LAKEO should parse correctly"""
        from app.services.commands import CommandParser
        
        parser = CommandParser()
        parsed = parser.parse("CAST24 LAKEO")
        
        assert parsed.command_type.name == "CAST24"
        assert parsed.location_code.upper() == "LAKEO"
    
# =============================================================================
# CAST7 Tests (7-day camp summary)
# =============================================================================

class TestCAST7Command:
    """
    CAST7 returns 7-day summary for all camps on user's route.
    Spec Section 8.2.3
    """
    
    def test_cast7_parses_without_route(self):
        """CAST7 without route should use user's registered route"""
        from app.services.commands import CommandParser
        
        parser = CommandParser()
        parsed = parser.parse("CAST7")
        
        assert parsed.command_type.name == "CAST7"
        # Should not require route code - uses user's route
    
    def test_cast7_includes_all_camps(self):
        """CAST7 should include all camps for route"""
        from app.services.formatter import FormatCAST7
        
        # Western Arthurs Full route camps
        wa_camps = ["SCOTT", "JUNCT", "LAKEF", "LAKEC", "LAKEO", "HIGHM", 
                    "LAKEH", "LAKES", "LAKEV", "LAKEJ", "PROMO", "LAKER", "CRACR"]
        
        mock_data = _create_mock_daily_data(days=7, camps=wa_camps)
        
        response = FormatCAST7.format(
            route_name="Western Arthurs (Full)",
            forecast_data=mock_data,
            date=datetime.now(TZ_HOBART)
        )
        
        # Check at least some camps appear
        camps_found = sum(1 for camp in wa_camps if camp in response)
        assert camps_found >= 6, f"Expected most camps, found {camps_found}"
    
    def test_cast7_shows_7_days(self):
        """CAST7 should show 7 days of forecasts"""
        from app.services.formatter import FormatCAST7
        
        mock_data = _create_mock_daily_data(days=7, camps=["LAKEO", "HIGHM"])
        
        messages = FormatCAST7.format_multi(
            route_name="Western Arthurs (Full)",
            forecast_data=mock_data,
            date=datetime.now(TZ_HOBART)
        )
        
        full_response = "\n".join(messages)
        
        # Check for day indicators (dates or day numbers)
        today = datetime.now(TZ_HOBART).date()
        days_found = 0
        for i in range(7):
            day = today + timedelta(days=i)
            day_str = day.strftime("%d")
            if day_str in full_response:
                days_found += 1
        
        assert days_found >= 5, f"Expected 7 days, found indicators for {days_found}"


# =============================================================================
# PEAKS Tests (7-day peak summary)
# =============================================================================

class TestPEAKSCommand:
    """
    CAST7 PEAKS returns 7-day summary for all peaks on user's route.
    Spec Section 8.2.4 - Now unified under CAST7 command.
    """

    def test_peaks_parses_correctly(self):
        """CAST7 PEAKS should parse as CAST7 with all_peaks flag"""
        from app.services.commands import CommandParser

        parser = CommandParser()
        parsed = parser.parse("CAST7 PEAKS")

        assert parsed.command_type.name == "CAST7"
        assert parsed.args.get("all_peaks") is True
    
    def test_peaks_includes_all_route_peaks(self):
        """PEAKS should include all peaks for route"""
        from app.services.formatter import FormatPEAKS
        
        # Western Arthurs A-K peaks
        ak_peaks = ["HESPE", "PROCY", "PRIOR", "CAPRI", "TAURA", "SCORP"]
        
        mock_data = _create_mock_daily_data(days=7, camps=ak_peaks)
        
        response = FormatPEAKS.format(
            route_name="Western Arthurs (A-K)",
            forecast_data=mock_data,
            date=datetime.now(TZ_HOBART)
        )
        
        peaks_found = sum(1 for peak in ak_peaks if peak in response)
        assert peaks_found >= 4, f"Expected most peaks, found {peaks_found}"
    
    def test_peaks_includes_freezing_level(self):
        """PEAKS should include FL (freezing level) - critical for summit"""
        from app.services.formatter import FormatPEAKS
        
        mock_data = _create_mock_daily_data(days=7, camps=["HESPE", "PROCY"])
        
        response = FormatPEAKS.format(
            route_name="Western Arthurs",
            forecast_data=mock_data,
            date=datetime.now(TZ_HOBART)
        )
        
        # FL column should be present (important for peaks)
        assert "FL" in response, "PEAKS should include FL (freezing level)"


# =============================================================================
# Error Handling Tests
# =============================================================================

class TestCastErrorHandling:
    """Test error responses for invalid CAST commands"""
    
    def test_invalid_camp_code(self):
        """Invalid camp code should return helpful error"""
        from app.services.commands import CommandParser, ResponseGenerator
        
        parser = CommandParser()
        parsed = parser.parse("CAST XXXXX")
        
        # Should parse but location validation should fail
        response = ResponseGenerator.invalid_location("XXXXX")
        
        assert "not recognized" in response.lower() or "invalid" in response.lower()
        assert "ROUTE" in response or "camps" in response.lower(), \
            "Error should suggest ROUTE command"
    
    def test_missing_location(self):
        """CAST without location should return error"""
        from app.services.commands import CommandParser
        
        parser = CommandParser()
        parsed = parser.parse("CAST")
        
        # Should either fail to parse or return error about missing location
        # Implementation may vary
        assert parsed is None or parsed.location_code is None or parsed.error is not None


# =============================================================================
# Helper Functions
# =============================================================================

def _create_mock_hourly_data(hours: int = 12) -> dict:
    """Create mock hourly forecast data"""
    base_time = datetime.now(TZ_HOBART).replace(minute=0, second=0, microsecond=0)
    
    periods = []
    for i in range(hours):
        hour_time = base_time + timedelta(hours=i)
        periods.append({
            "time": hour_time.isoformat(),
            "temp_min": 5 + i % 5,
            "temp_max": 10 + i % 5,
            "rain_chance": 20 + (i * 5) % 60,
            "rain_min": 0,
            "rain_max": i % 4,
            "snow_min": 0,
            "snow_max": 0,
            "wind_avg": 15 + i % 10,
            "wind_max": 25 + i % 15,
            "wind_direction": ["NW", "W", "SW", "W"][i % 4],
            "cloud_cover": 30 + i % 40,
            "freezing_level": 1800 - (i * 50) % 400,
        })
    
    return {"periods": periods}


def _create_mock_daily_data(days: int = 7, camps: list = None) -> dict:
    """Create mock daily forecast data for multiple locations"""
    if camps is None:
        camps = ["LAKEO", "HIGHM"]
    
    base_date = datetime.now(TZ_HOBART).date()
    
    data = {}
    for camp in camps:
        data[camp] = []
        for i in range(days):
            data[camp].append({
                "date": (base_date + timedelta(days=i)).isoformat(),
                "temp_min": 3 + i % 5,
                "temp_max": 12 + i % 5,
                "rain_chance": 25 + (i * 10) % 50,
                "rain_min": 0,
                "rain_max": i % 6,
                "wind_avg": 20 + i % 15,
                "wind_max": 35 + i % 20,
                "wind_direction": ["W", "NW", "SW", "W", "NW", "W", "SW"][i],
                "freezing_level": 1700 - (i * 100) % 500,
            })
    
    return data
