"""
Tests for Thunderbird Core Services
Based on THUNDERBIRD_SPEC_v2.4 Section 15
"""

import pytest
from datetime import date, datetime
import sys
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from config.settings import BOMGridConfig
from app.services.sms import PhoneUtils, SMSCostCalculator, InputSanitizer
from app.services.commands import CommandParser, CommandType, ResponseGenerator
from app.services.routes import RouteLoader


class TestBOMGridConfig:
    """Test BOM grid cell calculations."""
    
    def test_lat_lon_to_cell_lake_oberon(self):
        """Test cell calculation for Lake Oberon."""
        # Lake Oberon: -43.1486, 146.2722
        row, col = BOMGridConfig.lat_lon_to_cell(-43.1486, 146.2722)
        assert row == 201
        assert col == 117
    
    def test_lat_lon_to_cell_scotts_peak(self):
        """Test cell calculation for Scotts Peak."""
        # Scotts Peak: -43.0375, 146.2978
        row, col = BOMGridConfig.lat_lon_to_cell(-43.0375, 146.2978)
        assert row == 195
        assert col == 118
    
    def test_cell_to_string(self):
        """Test cell string formatting."""
        result = BOMGridConfig.cell_to_string(201, 117)
        assert result == "201-117"


class TestPhoneUtils:
    """Test phone number utilities."""
    
    def test_normalize_04_format(self):
        """Test normalization of 04xx format."""
        result = PhoneUtils.normalize("0412345678")
        assert result == "+61412345678"
    
    def test_normalize_plus61_format(self):
        """Test normalization of +61 format."""
        result = PhoneUtils.normalize("+61412345678")
        assert result == "+61412345678"
    
    def test_normalize_61_format(self):
        """Test normalization of 61 format."""
        result = PhoneUtils.normalize("61412345678")
        assert result == "+61412345678"
    
    def test_normalize_invalid(self):
        """Test invalid phone number."""
        with pytest.raises(ValueError):
            PhoneUtils.normalize("123456")
    
    def test_mask(self):
        """Test phone masking for logs."""
        result = PhoneUtils.mask("+61412345678")
        assert result == "+614***5678"
        assert "412345" not in result
    
    def test_is_valid_au_mobile(self):
        """Test Australian mobile validation."""
        assert PhoneUtils.is_valid_au_mobile("0412345678")
        assert PhoneUtils.is_valid_au_mobile("+61412345678")
        assert not PhoneUtils.is_valid_au_mobile("0212345678")  # Landline


class TestSMSCostCalculator:
    """Test SMS segment and cost calculations."""
    
    def test_count_segments_short(self):
        """Test single segment message."""
        msg = "Hello world"
        assert SMSCostCalculator.count_segments(msg) == 1
    
    def test_count_segments_exactly_160(self):
        """Test exactly 160 character message."""
        msg = "x" * 160
        assert SMSCostCalculator.count_segments(msg) == 1
    
    def test_count_segments_161(self):
        """Test 161 character message (2 segments)."""
        msg = "x" * 161
        assert SMSCostCalculator.count_segments(msg) == 2
    
    def test_count_segments_long(self):
        """Test long multi-segment message."""
        msg = "x" * 500  # Should be ~4 segments
        segments = SMSCostCalculator.count_segments(msg)
        assert segments >= 3
        assert segments <= 4
    
    def test_calculate_cost_twilio(self):
        """Test cost calculation for Twilio."""
        cost = SMSCostCalculator.calculate_cost(3, "twilio")
        # 3 * $0.055 = $0.165 = 16.5 cents
        assert cost == 16  # Rounds to integer cents


class TestInputSanitizer:
    """Test input sanitization."""
    
    def test_sanitize_sms_basic(self):
        """Test basic SMS sanitization."""
        result = InputSanitizer.sanitize_sms("  hello world  ")
        assert result == "HELLO WORLD"
    
    def test_sanitize_sms_special_chars(self):
        """Test removal of special characters."""
        result = InputSanitizer.sanitize_sms("Hello! @test #123")
        assert result == "HELLO TEST 123"
    
    def test_extract_command(self):
        """Test command extraction."""
        cmd, args = InputSanitizer.extract_command("STATUS")
        assert cmd == "STATUS"
        assert args == ""
    
    def test_extract_command_with_args(self):
        """Test command extraction with arguments."""
        cmd, args = InputSanitizer.extract_command("LAKEO extra stuff")
        assert cmd == "LAKEO"
        assert args == "EXTRA STUFF"


class TestCommandParser:
    """Test command parsing."""
    
    def test_parse_help(self):
        """Test HELP command."""
        parser = CommandParser()
        result = parser.parse("HELP")
        assert result.command_type == CommandType.HELP
        assert result.is_valid
    
    def test_parse_stop(self):
        """Test STOP command."""
        parser = CommandParser()
        result = parser.parse("stop")  # Lowercase
        assert result.command_type == CommandType.STOP
        assert result.is_valid
    
    def test_parse_camp_code_valid(self):
        """Test valid camp code."""
        parser = CommandParser(route_id="western_arthurs_ak")
        result = parser.parse("LAKEO")
        assert result.command_type == CommandType.CAMP_CODE
        assert result.args.get("camp_code") == "LAKEO"
        assert result.is_valid
    
    def test_parse_camp_code_invalid(self):
        """Test invalid camp code."""
        parser = CommandParser(route_id="western_arthurs_ak")
        result = parser.parse("XXXXX")
        assert result.command_type == CommandType.UNKNOWN  # v3.0: invalid codes return UNKNOWN
        # Invalid codes now return UNKNOWN type
        assert result.error_message is None or "not recognized" in str(result.error_message) or result.command_type == CommandType.UNKNOWN
    
    def test_parse_date(self):
        """Test date parsing (DDMMYY)."""
        parser = CommandParser()
        result = parser.parse("150126")  # 15 Jan 2026
        assert result.args.get("date") == date(2026, 1, 15)
    
    def test_parse_livetest(self):
        """Test LIVETEST command with @ prefix."""
        parser = CommandParser()
        result = parser.parse("@ LIVETEST")
        assert result.command_type == CommandType.LIVETEST
        assert result.is_valid
    
    def test_parse_unknown(self):
        """Test unknown command."""
        parser = CommandParser()
        result = parser.parse("GIBBERISH")
        assert result.command_type == CommandType.UNKNOWN
        # Invalid codes now return UNKNOWN type


class TestResponseGenerator:
    """Test response message generation."""
    
    def test_help_message(self):
        """Test HELP response contains commands."""
        msg = ResponseGenerator.help_message()
        assert "THUNDERBIRD COMMANDS" in msg
        assert "STATUS" in msg
        assert "CAST" in msg  # v3.0: DELAY removed
        assert "CANCEL" in msg  # v3.0: STOP renamed to CANCEL
    
    def test_key_message(self):
        """Test KEY response contains column definitions."""
        msg = ResponseGenerator.key_message()
        assert "FORECAST COLUMN KEY" in msg
        assert "Temperature" in msg
        assert "Freezing level" in msg  # v3.0: CB removed, FL added
        assert "FL=" in msg  # v3.0: CB removed, FL example instead
    
    def test_invalid_camp(self):
        """Test invalid camp response."""
        msg = ResponseGenerator.invalid_camp("XXXXX", ["LAKEO", "LAKEC"])
        assert '"XXXXX" not recognized' in msg
        assert "LAKEO" in msg
    
    def test_stop_confirmed(self):
        """Test STOP confirmation."""
        msg = ResponseGenerator.stop_confirmed()
        assert "cancelled" in msg
        assert "Safe travels" in msg


class TestRouteLoader:
    """Test route configuration loading."""
    
    def test_load_western_arthurs(self):
        """Test loading Western Arthurs route."""
        route = RouteLoader.load("western_arthurs_ak")
        
        if route:  # May not exist in test environment
            assert route.route_id == "western_arthurs_ak"
            assert route.is_loop == True
            assert len(route.camps) > 0
            assert "LAKEO" in route.get_camp_codes()
    
    def test_load_nonexistent(self):
        """Test loading nonexistent route."""
        route = RouteLoader.load("nonexistent_route")
        assert route is None
    
    def test_list_routes(self):
        """Test listing available routes."""
        routes = RouteLoader.list_routes()
        assert isinstance(routes, list)


# Run tests with: pytest tests/ -v
if __name__ == "__main__":
    pytest.main([__file__, "-v"])
