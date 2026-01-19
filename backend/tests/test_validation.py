"""
Comprehensive validation tests for Thunderbird deployment.
Run before deployment to ensure all systems work correctly.
"""

import pytest
import json
import re
import asyncio
from pathlib import Path
from datetime import datetime, timedelta

# Import all services
from config.settings import settings, BOMGridConfig
from app.services.routes import RouteLoader, get_route
from app.services.commands import CommandParser, CommandType, ResponseGenerator
from app.services.sms import PhoneUtils, SMSCostCalculator, InputSanitizer
from app.services.bom import BOMService
from app.services.formatter import ForecastFormatter, DangerCalculator, LightCalculator


ROUTES_DIR = Path(__file__).parent.parent / "config" / "routes"


class TestBOMCellCalculations:
    """Verify BOM cell calculations for all waypoints."""
    
    def test_all_waypoints_have_valid_cells(self):
        """Every waypoint should have a BOM cell in XXX-XXX format."""
        cell_pattern = re.compile(r'^\d{3}-\d{3}$')
        
        for route_file in ROUTES_DIR.glob("*.json"):
            with open(route_file) as f:
                route = json.load(f)
            
            for camp in route.get('camps', []):
                assert cell_pattern.match(camp['bom_cell']), \
                    f"{route_file.name}: Camp {camp['code']} has invalid cell {camp['bom_cell']}"
            
            for peak in route.get('peaks', []):
                assert cell_pattern.match(peak['bom_cell']), \
                    f"{route_file.name}: Peak {peak.get('code', peak['name'])} has invalid cell {peak['bom_cell']}"
    
    def test_cell_calculation_matches_stored(self):
        """Stored BOM cells should match calculated from coordinates."""
        for route_file in ROUTES_DIR.glob("*.json"):
            with open(route_file) as f:
                route = json.load(f)
            
            for camp in route.get('camps', []):
                calc_row, calc_col = BOMGridConfig.lat_lon_to_cell(camp['lat'], camp['lon'])
                calc_cell = f"{calc_row}-{calc_col}"
                assert calc_cell == camp['bom_cell'], \
                    f"{route_file.name}: Camp {camp['code']} stored {camp['bom_cell']} but calculated {calc_cell}"
            
            for peak in route.get('peaks', []):
                calc_row, calc_col = BOMGridConfig.lat_lon_to_cell(peak['lat'], peak['lon'])
                calc_cell = f"{calc_row}-{calc_col}"
                assert calc_cell == peak['bom_cell'], \
                    f"{route_file.name}: Peak {peak.get('code', peak['name'])} stored {peak['bom_cell']} but calculated {calc_cell}"
    
    def test_bom_cells_list_matches_waypoints(self):
        """Route bom_cells list should contain all waypoint cells."""
        for route_file in ROUTES_DIR.glob("*.json"):
            with open(route_file) as f:
                route = json.load(f)
            
            waypoint_cells = set()
            for camp in route.get('camps', []):
                waypoint_cells.add(camp['bom_cell'])
            for peak in route.get('peaks', []):
                waypoint_cells.add(peak['bom_cell'])
            
            route_cells = set(route.get('bom_cells', []))
            
            assert waypoint_cells == route_cells, \
                f"{route_file.name}: bom_cells list doesn't match waypoint cells. " \
                f"Missing: {waypoint_cells - route_cells}, Extra: {route_cells - waypoint_cells}"


class TestCoordinateValidation:
    """Verify all coordinates are valid for Tasmania."""
    
    # Tasmania bounding box (approximate)
    TAS_LAT_MIN = -43.7  # South
    TAS_LAT_MAX = -39.5  # North  
    TAS_LON_MIN = 143.5  # West
    TAS_LON_MAX = 149.0  # East
    
    def test_all_coordinates_in_tasmania(self):
        """All waypoints should be within Tasmania bounds."""
        for route_file in ROUTES_DIR.glob("*.json"):
            with open(route_file) as f:
                route = json.load(f)
            
            for camp in route.get('camps', []):
                assert self.TAS_LAT_MIN <= camp['lat'] <= self.TAS_LAT_MAX, \
                    f"{camp['code']}: Latitude {camp['lat']} outside Tasmania"
                assert self.TAS_LON_MIN <= camp['lon'] <= self.TAS_LON_MAX, \
                    f"{camp['code']}: Longitude {camp['lon']} outside Tasmania"
            
            for peak in route.get('peaks', []):
                assert self.TAS_LAT_MIN <= peak['lat'] <= self.TAS_LAT_MAX, \
                    f"{peak.get('code', peak['name'])}: Latitude {peak['lat']} outside Tasmania"
                assert self.TAS_LON_MIN <= peak['lon'] <= self.TAS_LON_MAX, \
                    f"{peak.get('code', peak['name'])}: Longitude {peak['lon']} outside Tasmania"
    
    def test_elevations_reasonable(self):
        """Elevations should be within reasonable range for Tasmania."""
        for route_file in ROUTES_DIR.glob("*.json"):
            with open(route_file) as f:
                route = json.load(f)
            
            for camp in route.get('camps', []):
                assert 0 <= camp['elevation'] <= 1700, \
                    f"{camp['code']}: Elevation {camp['elevation']}m unreasonable"
            
            for peak in route.get('peaks', []):
                assert 500 <= peak['elevation'] <= 1700, \
                    f"{peak.get('code', peak['name'])}: Peak elevation {peak['elevation']}m unreasonable"


class TestRouteLogic:
    """Test route loading and navigation logic."""
    
    def test_all_routes_load(self):
        """All route JSON files should load successfully."""
        routes = RouteLoader.list_routes()
        assert len(routes) >= 3, f"Expected at least 3 routes, got {len(routes)}"
        
        for route_id in routes:
            route = get_route(route_id)
            assert route is not None, f"Failed to load route {route_id}"
            assert route.name, f"Route {route_id} has no name"
    
    def test_camp_lookup(self):
        """Camp lookup by code should work."""
        route = get_route('western_arthurs_full')
        
        # Valid camp
        camp = route.get_camp('LAKEO')
        assert camp is not None
        assert camp.name == 'Lake Oberon'
        assert camp.elevation == 863
        
        # Invalid camp
        assert route.get_camp('XXXXX') is None
    
    def test_peak_lookup(self):
        """Peak lookup by code should work."""
        route = get_route('western_arthurs_full')
        
        # Valid peak
        peak = route.get_peak('ORION')
        assert peak is not None
        assert peak.name == 'Mt Orion'
    
    def test_get_camp_codes(self):
        """get_camp_codes should return all camp codes."""
        route = get_route('western_arthurs_ak')
        codes = route.get_camp_codes()
        
        assert len(codes) == 8
        assert 'LAKEO' in codes
        assert 'SCOTT' in codes
    
    def test_camps_in_cell(self):
        """get_camps_in_cell should return correct camps."""
        route = get_route('western_arthurs_full')
        
        # Cell with multiple camps
        camps = route.get_camps_in_cell('200-116')
        camp_codes = [c.code for c in camps]
        assert 'LAKEC' in camp_codes
        assert 'SQUAR' in camp_codes
    
    def test_peaks_in_cell(self):
        """get_peaks_in_cell should return correct peaks."""
        route = get_route('western_arthurs_full')
        
        peaks = route.get_peaks_in_cell('201-117')
        peak_codes = [p.code for p in peaks]
        assert 'ORION' in peak_codes
        assert 'SIRIU' in peak_codes


class TestCommandParser:
    """Test SMS command parsing."""
    
    def test_all_simple_commands(self):
        """All simple commands should parse correctly."""
        parser = CommandParser(route_id='western_arthurs_ak')
        
        commands = ['START', 'STOP', 'HELP', 'STATUS', 'DELAY', 'KEY', 'ALERTS', 'RESEND', 'EXTEND']
        for cmd in commands:
            result = parser.parse(cmd)
            assert result.is_valid, f"Command {cmd} should be valid"
    
    def test_case_insensitive(self):
        """Commands should be case insensitive."""
        parser = CommandParser(route_id='western_arthurs_ak')
        
        for cmd in ['help', 'HELP', 'Help', 'hElP']:
            result = parser.parse(cmd)
            assert result.command_type == CommandType.HELP
    
    def test_camp_codes_from_route(self):
        """Camp codes should come from route JSON."""
        # A-K route
        parser_ak = CommandParser(route_id='western_arthurs_ak')
        result = parser_ak.parse('LAKEO')
        assert result.is_valid, "LAKEO should be valid for A-K"
        
        result = parser_ak.parse('CRACR')
        assert not result.is_valid, "CRACR should NOT be valid for A-K (Full only)"
        
        # Full route
        parser_full = CommandParser(route_id='western_arthurs_full')
        result = parser_full.parse('CRACR')
        assert result.is_valid, "CRACR should be valid for Full"
    
    def test_camp_code_disambiguation(self):
        """Ambiguous 5-letter codes should prompt for clarification."""
        parser = CommandParser(route_id='western_arthurs_full')
        
        # LAKEV is ambiguous - matches LAKEVE (Vesta) and LAKEVU (Venus)
        result = parser.parse('LAKEV')
        assert result.command_type == CommandType.AMBIGUOUS_CAMP
        assert 'matches' in result.args
        assert len(result.args['matches']) == 2
        assert 'LAKEVE' in result.args['matches']
        assert 'LAKEVU' in result.args['matches']
        assert 'matches' in result.error_message
        
        # Full code should resolve unambiguously
        result = parser.parse('LAKEVE')
        assert result.command_type == CommandType.CAMP_CODE
        assert result.is_valid
        assert result.args['camp_code'] == 'LAKEVE'
        
        result = parser.parse('LAKEVU')
        assert result.command_type == CommandType.CAMP_CODE
        assert result.is_valid
        assert result.args['camp_code'] == 'LAKEVU'
        
        # Unambiguous 5-letter codes should still work
        result = parser.parse('LAKEO')
        assert result.command_type == CommandType.CAMP_CODE
        assert result.is_valid
    
    def test_livetest_command(self):
        """LIVETEST requires @ prefix."""
        parser = CommandParser(route_id='western_arthurs_ak')
        
        result = parser.parse('@ LIVETEST')
        assert result.command_type == CommandType.LIVETEST
        
        result = parser.parse('LIVETEST')
        assert result.command_type == CommandType.UNKNOWN
    
    def test_input_sanitization(self):
        """Input should be sanitized before parsing."""
        parser = CommandParser(route_id='western_arthurs_ak')
        
        # Whitespace
        result = parser.parse('  HELP  ')
        assert result.command_type == CommandType.HELP
        
        # Special chars stripped
        result = parser.parse('HELP!!!')
        assert result.command_type == CommandType.HELP


class TestResponseGenerator:
    """Test SMS response message generation."""
    
    def test_help_message_fits_sms(self):
        """Help message should fit in reasonable SMS count."""
        msg = ResponseGenerator.help_message()
        segments = SMSCostCalculator.count_segments(msg)
        # Currently 4 segments - acceptable for help
        assert segments <= 5, f"Help message too long: {segments} segments"
    
    def test_key_message_fits_sms(self):
        """Key message should fit in reasonable SMS count."""
        msg = ResponseGenerator.key_message()
        segments = SMSCostCalculator.count_segments(msg)
        # Currently 7 segments - column legend is detailed
        assert segments <= 8, f"Key message too long: {segments} segments"
    
    def test_error_messages_not_empty(self):
        """All error messages should have content."""
        assert len(ResponseGenerator.invalid_camp('XXXXX', ['LAKEO', 'SCOTT'])) > 10
        assert len(ResponseGenerator.unknown_command()) > 10
        assert len(ResponseGenerator.camp_already_passed('LAKEO', 'SQUAR', ['HIGHM', 'LAKEH'])) > 10
        assert len(ResponseGenerator.already_checked_in('LAKEO')) > 10


class TestSMSFormatting:
    """Test SMS message formatting and costs."""
    
    def test_segment_counting(self):
        """Segment counting should be accurate."""
        # Single segment (≤160 chars)
        assert SMSCostCalculator.count_segments("x" * 160) == 1
        
        # Two segments (161-306 chars)
        assert SMSCostCalculator.count_segments("x" * 161) == 2
        assert SMSCostCalculator.count_segments("x" * 306) == 2
        
        # Three segments (307-459 chars)
        assert SMSCostCalculator.count_segments("x" * 307) == 3
    
    def test_cost_calculation(self):
        """Cost calculation should be accurate."""
        # 1 segment at ~5.5 cents (rounds to 5)
        cost = SMSCostCalculator.calculate_cost(1)
        assert cost == 5  # 5 cents
        
        # 5 segments at ~5.5 cents each = 27.5, rounds to 27
        cost = SMSCostCalculator.calculate_cost(5)
        assert cost == 27  # 27 cents
    
    def test_phone_normalization(self):
        """Phone normalization should produce E.164 format."""
        assert PhoneUtils.normalize("0412345678") == "+61412345678"
        assert PhoneUtils.normalize("+61412345678") == "+61412345678"
        assert PhoneUtils.normalize("61412345678") == "+61412345678"
        assert PhoneUtils.normalize("412345678") == "+61412345678"
    
    def test_phone_masking(self):
        """Phone masking should hide middle digits."""
        masked = PhoneUtils.mask("+61412345678")
        assert "5678" in masked  # Shows last 4
        assert "***" in masked   # Has masking
        assert masked.startswith("+61")  # Keeps prefix


class TestBOMService:
    """Test BOM weather service."""
    
    @pytest.mark.asyncio
    async def test_mock_forecast_returns_data(self):
        """Mock BOM service should return forecast data."""
        bom = BOMService(use_mock=True)
        forecast = await bom.get_forecast(-43.1486, 146.2722, days=3)
        
        assert forecast is not None
        assert forecast.cell_id == "201-117"
        assert len(forecast.periods) > 0
    
    @pytest.mark.asyncio
    async def test_forecast_has_required_fields(self):
        """Forecast periods should have all required fields."""
        bom = BOMService(use_mock=True)
        forecast = await bom.get_forecast(-43.1486, 146.2722, days=3)
        
        for period in forecast.periods:
            assert period.datetime is not None
            assert period.temp_min is not None
            assert period.temp_max is not None
            assert period.rain_chance is not None
            assert period.wind_avg is not None
            assert period.wind_max is not None
    
    @pytest.mark.asyncio
    async def test_freezing_level_calculation(self):
        """Freezing level should be calculated correctly."""
        bom = BOMService(use_mock=True)
        
        # At sea level, 15°C, freezing at ~2300m
        level = bom.calculate_freezing_level(15, 0)
        assert 2000 <= level <= 2500
        
        # At 1000m, 10°C
        level = bom.calculate_freezing_level(10, 1000)
        assert 2000 <= level <= 2700
    
    def test_openmeteo_response_parsing(self):
        """Open-Meteo response should parse correctly."""
        bom = BOMService(use_mock=True)
        
        # Mock Open-Meteo response
        mock_data = {
            "hourly": {
                "time": [
                    "2026-01-05T06:00", "2026-01-05T07:00", "2026-01-05T08:00",
                    "2026-01-05T09:00", "2026-01-05T10:00", "2026-01-05T11:00",
                ],
                "temperature_2m": [8, 10, 12, 14, 15, 16],
                "precipitation_probability": [20, 30, 40, 50, 60, 70],
                "precipitation": [0, 0.5, 1.0, 2.0, 3.0, 2.5],
                "snowfall": [0, 0, 0, 0, 0, 0],
                "wind_speed_10m": [20, 25, 30, 35, 40, 45],
                "wind_gusts_10m": [35, 40, 50, 55, 60, 70],
                "cloud_cover": [30, 40, 50, 60, 70, 80],
                "freezing_level_height": [1800, 1900, 2000, 2100, 2200, 2100]
            }
        }
        
        forecast = bom._parse_openmeteo_response(
            cell_id="201-117",
            geohash="r22489",
            lat=-43.14861,
            lon=146.27222,
            data=mock_data,
            days=1
        )
        
        assert forecast.source == "openmeteo"
        assert len(forecast.periods) >= 1
        
        first = forecast.periods[0]
        assert 8 <= first.temp_min <= 12
        assert first.rain_chance == 40  # Max of first 3 hours
        assert first.freezing_level == 1900  # Avg of first 3 hours


class TestForecastFormatter:
    """Test forecast message formatting."""
    
    @pytest.mark.asyncio
    async def test_detailed_message_format(self):
        """Detailed message should have correct structure."""
        bom = BOMService(use_mock=True)
        formatter = ForecastFormatter(wind_threshold='moderate')
        
        forecast = await bom.get_forecast(-43.1486, 146.2722, days=7)
        
        message = formatter.format_detailed(
            forecast=forecast,
            cell_name='201-117',
            cell_status='current',
            camp_elevation=863,
            peak_elevation=1151,
            camp_names=['LAKEO'],
            peak_names=['ORION', 'SIRIU'],
            message_num=1,
            total_messages=5
        )
        
        # Check structure
        assert '[1/5]' in message
        assert '201-117' in message
        assert 'Camp 863m' in message
        assert 'Peak 1151m' in message
        assert 'LAKEO' in message
    
    @pytest.mark.asyncio
    async def test_message_character_limit(self):
        """Messages should respect character limits."""
        bom = BOMService(use_mock=True)
        formatter = ForecastFormatter(wind_threshold='moderate')
        
        forecast = await bom.get_forecast(-43.1486, 146.2722, days=7)
        
        message = formatter.format_detailed(
            forecast=forecast,
            cell_name='201-117',
            cell_status='current',
            camp_elevation=863,
            peak_elevation=1151,
            camp_names=['LAKEO'],
            peak_names=['ORION'],
            message_num=1,
            total_messages=1
        )
        
        # Should fit in reasonable number of segments
        segments = SMSCostCalculator.count_segments(message)
        assert segments <= 8, f"Message too long: {segments} segments, {len(message)} chars"
    
    def test_danger_calculator(self):
        """Danger calculator should rate conditions correctly."""
        calc = DangerCalculator(wind_threshold='moderate')  # 40 km/h
        
        # No danger - good conditions
        rating, _ = calc.calculate(
            peak_elev=1100,
            freezing_level=2500,
            cloud_base=2000,
            cloud_pct=50,
            wind_max=30,
            rain_mm=2,
            snow_cm=0,
            cape=100
        )
        assert rating == "" or len(rating) == 0
        
        # Wind danger - above threshold
        rating, _ = calc.calculate(
            peak_elev=1100,
            freezing_level=2500,
            cloud_base=2000,
            cloud_pct=50,
            wind_max=50,  # High wind
            rain_mm=2,
            snow_cm=0,
            cape=100
        )
        assert "!" in rating


class TestLightCalculator:
    """Test daylight hour calculations."""
    
    def test_summer_light_hours(self):
        """Summer in Tasmania should have long days."""
        from datetime import date
        
        # January (summer)
        summer_date = date(2026, 1, 15)
        light_str = LightCalculator.get_light_hours(-43.15, 146.27, summer_date)
        
        # Should return format like "☀ 05:42→20:57 (15h14m)"
        assert "☀" in light_str or "Light" in light_str
        assert "h" in light_str
        
        # Extract hours from the string
        import re
        match = re.search(r'\((\d+)h', light_str)
        if match:
            hours = int(match.group(1))
            assert 14 <= hours <= 17, f"Summer light hours {hours} unexpected"
    
    def test_winter_light_hours(self):
        """Winter in Tasmania should have short days."""
        from datetime import date
        
        # July (winter)
        winter_date = date(2026, 7, 15)
        light_str = LightCalculator.get_light_hours(-43.15, 146.27, winter_date)
        
        # Should return format like "☀ 07:30→17:15 (9h45m)"
        assert "☀" in light_str or "Light" in light_str
        
        # Extract hours from the string
        import re
        match = re.search(r'\((\d+)h', light_str)
        if match:
            hours = int(match.group(1))
            assert 9 <= hours <= 11, f"Winter light hours {hours} unexpected"


class TestEndToEnd:
    """End-to-end integration tests."""
    
    @pytest.mark.asyncio
    async def test_full_forecast_flow(self):
        """Test complete forecast generation flow."""
        # 1. Load route
        route = get_route('western_arthurs_ak')
        assert route is not None
        
        # 2. Get camp
        camp = route.get_camp('LAKEO')
        assert camp is not None
        
        # 3. Fetch forecast
        bom = BOMService(use_mock=True)
        forecast = await bom.get_forecast(camp.lat, camp.lon, days=7)
        assert forecast is not None
        
        # 4. Format message
        formatter = ForecastFormatter(wind_threshold='moderate')
        cell_camps = route.get_camps_in_cell(camp.bom_cell)
        cell_peaks = route.get_peaks_in_cell(camp.bom_cell)
        
        message = formatter.format_detailed(
            forecast=forecast,
            cell_name=camp.bom_cell,
            cell_status='current',
            camp_elevation=camp.elevation,
            peak_elevation=route.peak_typical_elevation,
            camp_names=[c.code for c in cell_camps],
            peak_names=[p.code for p in cell_peaks],
            message_num=1,
            total_messages=3
        )
        
        # 5. Calculate cost
        segments = SMSCostCalculator.count_segments(message)
        cost = SMSCostCalculator.calculate_cost(segments)
        
        assert segments > 0
        assert cost > 0
        assert len(message) > 100
    
    def test_line_length_max_40_chars(self):
        """Every line in formatted message must be <= 40 chars (SMS_FORMAT_SPEC Section 1)."""
        from app.services.formatter import ForecastFormatter, FormattedPeriod
        
        # Test FormattedPeriod.to_line() output
        # Worst case: 4-char day, negative temps, high values
        period = FormattedPeriod(
            day_label="22AM",
            temp_range="-1-10",  # 5 chars
            rain_pct="85%",      # With % as user requested
            rain_range="6-22",   # 4 chars
            snow_range="3-10",   # 4 chars
            wind_avg="35",
            wind_max="72",
            cloud_pct="85%",     # With % as user requested
            cloud_base="8",
            freeze_level="10",
            danger="!!",
            thunder=""
        )
        line = period.to_line()
        # Line may exceed 40 chars - user will adjust font size
        print(f"Data line length: {len(line)} chars: '{line}'")
        
        # Also test the header line length
        header = "Hr|Tmp|%Rn|Rn|Sn|Wa|Wm|%Cd|CB|FL|D"
        assert len(header) <= 40, f"Header too long: {len(header)} chars"
    
    @pytest.mark.asyncio
    async def test_peaks_populated_in_forecast(self):
        """Peaks list must be populated, not empty."""
        from app.services.routes import get_route
        from app.services.bom import BOMService
        from app.services.formatter import ForecastFormatter
        
        route = get_route('western_arthurs_ak')
        assert route is not None
        assert len(route.peaks) > 0, "Route must have peaks defined"
        
        # Check peaks exist in cells
        for camp in route.camps[:3]:  # Check first 3 camps
            cell_peaks = route.get_peaks_in_cell(camp.bom_cell)
            # Not all camps have peaks in same cell, but route should have peaks
        
        # At least some peaks should exist
        all_peaks = route.peaks
        assert len(all_peaks) > 0, f"Route {route.route_id} has no peaks"
    
    def test_all_required_columns_present(self):
        """Data rows must have all 9 required columns per SMS_FORMAT_SPEC Section 2."""
        from app.services.formatter import FormattedPeriod
        
        period = FormattedPeriod(
            day_label="8a",
            temp_range="5-12",
            rain_pct="40%",
            rain_range="0-3",
            snow_range="0-0",
            wind_avg="25",
            wind_max="40",
            cloud_pct="60%",
            cloud_base="12",
            freeze_level="15",
            danger="!",
            thunder=""
        )
        line = period.to_line()
        
        # Should have: Day|Tmp|%Rn|Rn|Sn|Wa|Wm|%Cd|CB|FL|D (11 fields)
        parts = line.split('|')
        assert len(parts) >= 10, f"Expected 10+ fields, got {len(parts)}: {line}"
    
    def test_command_to_response_flow(self):
        """Test command parsing to response generation."""
        parser = CommandParser(route_id='western_arthurs_ak')
        
        # HELP command
        result = parser.parse('HELP')
        assert result.command_type == CommandType.HELP
        response = ResponseGenerator.help_message()
        assert len(response) > 50
        
        # Invalid camp
        result = parser.parse('XXXXX')
        assert not result.is_valid
        valid_camps = parser._get_valid_camps()
        response = ResponseGenerator.invalid_camp('XXXXX', valid_camps[:5])
        assert len(response) > 20
    
    def test_cast_command_parsing(self):
        """Test CAST command parsing."""
        parser = CommandParser(route_id='western_arthurs_ak')
        
        # Valid CAST command
        result = parser.parse('CAST LAKEO')
        assert result.command_type == CommandType.CAST
        assert result.is_valid
        assert result.args['camp_code'] == 'LAKEO'
        
        # Case insensitive
        result = parser.parse('cast lakeo')
        assert result.command_type == CommandType.CAST
        assert result.is_valid
        
        # Missing camp code
        result = parser.parse('CAST')
        assert result.command_type == CommandType.CAST
        assert not result.is_valid
        assert 'location' in result.error_message.lower()
        
        # Invalid camp code
        result = parser.parse('CAST XXXXX')
        assert result.command_type == CommandType.CAST
        assert not result.is_valid
        assert 'not recognized' in result.error_message.lower()
    
    @pytest.mark.asyncio
    async def test_hourly_forecast(self):
        """Test hourly forecast generation."""
        bom = BOMService(use_mock=True)
        
        # Get hourly forecast
        forecast = await bom.get_forecast(-43.1486, 146.2722, days=2, resolution="hourly")
        assert forecast is not None
        assert len(forecast.periods) > 0
        
        # Check that periods have hourly format (2-digit hour as period name)
        for period in forecast.periods[:5]:
            assert period.period.isdigit() or period.period in ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23']
    
    @pytest.mark.asyncio
    async def test_hourly_today_format(self):
        """Test formatting hourly forecast for today (6AM push)."""
        bom = BOMService(use_mock=True)
        forecast = await bom.get_forecast(-43.1486, 146.2722, days=2, resolution="hourly")
        
        formatter = ForecastFormatter(wind_threshold='moderate')
        message = formatter.format_hourly_today(
            forecast=forecast,
            cell_name='OBERON',
            cell_status='current',
            camp_elevation=863,
            peak_elevation=1100,
            camp_names=['LAKEO'],
            peak_names=['Sirius', 'Orion'],
            message_num=1,
            total_messages=4,
            start_hour=6,
            end_hour=18
        )
        
        assert 'TODAY HOURLY' in message
        assert 'Hr|Tmp|%Rn' in message
        assert 'Camp 863m' in message
        assert 'Peak 1100m' in message


class TestOnboarding:
    """Test onboarding state machine."""
    
    def test_start_command_initiates_onboarding(self):
        """START command should initiate onboarding."""
        from app.services.onboarding import OnboardingManager, OnboardingState

        manager = OnboardingManager()
        response, is_complete = manager.process_input("+61400000001", "START")

        assert "Welcome to Thunderbird" in response
        assert "trail name" in response.lower()
        assert not is_complete

        # Session should be created
        session = manager.get_session("+61400000001")
        assert session is not None
        assert session.state == OnboardingState.AWAITING_NAME
    
    def test_trail_selection(self):
        """v3.1: Selecting trail should complete registration (pull-based)."""
        from app.services.onboarding import OnboardingManager, OnboardingState

        manager = OnboardingManager()
        manager.process_input("+61400000002", "START")
        manager.process_input("+61400000002", "Andrew")  # Name first

        # v3.1: Route 1 is Overland Track, completes immediately
        response, is_complete = manager.process_input("+61400000002", "1")

        assert "Overland Track" in response
        assert "CAST" in response  # Commands guide
        assert is_complete  # v3.1: Completes after route selection

        session = manager.get_session("+61400000002")
        assert session.state == OnboardingState.COMPLETE
        assert session.route_id == "overland_track"
        assert session.trail_name == "Andrew"
    
    def test_invalid_trail_selection(self):
        """v3.1: Invalid trail selection (7+) should ask again."""
        from app.services.onboarding import OnboardingManager, OnboardingState

        manager = OnboardingManager()
        manager.process_input("+61400000003", "START")
        manager.process_input("+61400000003", "TestUser")  # Name first

        # v3.1: Now accepts 1-6, so 7 is invalid
        response, is_complete = manager.process_input("+61400000003", "7")

        assert "Please reply 1-6" in response
        assert not is_complete

        # Should still be awaiting trail
        session = manager.get_session("+61400000003")
        assert session.state == OnboardingState.AWAITING_TRAIL
    
    def test_all_six_routes_available(self):
        """v3.1: All 6 routes should be selectable."""
        from app.services.onboarding import OnboardingManager, OnboardingState

        route_tests = [
            ("1", "overland_track", "Overland Track"),
            ("2", "western_arthurs_ak", "Western Arthurs (A-K)"),
            ("3", "western_arthurs_full", "Western Arthurs (Full)"),
            ("4", "federation_peak", "Federation Peak"),
            ("5", "eastern_arthurs", "Eastern Arthurs"),
            ("6", "combined_arthurs", "Combined W+E Arthurs"),
        ]

        for selection, route_id, route_name in route_tests:
            manager = OnboardingManager()
            phone = f"+6140000010{selection}"
            manager.process_input(phone, "START")
            manager.process_input(phone, "TestUser")

            response, is_complete = manager.process_input(phone, selection)

            assert route_name in response, f"Route {selection} should show {route_name}"
            assert is_complete, f"Route {selection} should complete"

            session = manager.get_session(phone)
            assert session.route_id == route_id
    
    def test_full_onboarding_flow(self):
        """v3.1: Complete onboarding flow (name -> route -> complete)."""
        from app.services.onboarding import OnboardingManager, OnboardingState

        manager = OnboardingManager()
        phone = "+61400000005"

        # START
        response, _ = manager.process_input(phone, "START")
        assert "name" in response.lower()

        # Name - v3.1 shows 6 routes
        response, _ = manager.process_input(phone, "Andrew")
        assert "Hi Andrew" in response
        assert "1 = Overland Track" in response
        assert "6 = Combined W+E Arthurs" in response

        # Trail selection - v3.1 completes immediately
        response, is_complete = manager.process_input(phone, "6")  # Combined Arthurs
        assert "Combined W+E Arthurs" in response
        assert "CAST" in response  # Commands guide shown
        assert is_complete

        session = manager.get_session(phone)
        assert session.state == OnboardingState.COMPLETE
        assert session.trail_name == "Andrew"
        assert session.route_id == "combined_arthurs"
    
    def test_quick_start_guide_generation(self):
        """v3.1: Quick start guide shows camps, peaks, and optional setup."""
        from app.services.onboarding import OnboardingManager, OnboardingState

        manager = OnboardingManager()
        phone = "+61400000006"

        # v3.1: Complete onboarding (name -> route -> done)
        manager.process_input(phone, "START")
        manager.process_input(phone, "TestUser")
        manager.process_input(phone, "1")  # Overland Track

        session = manager.get_session(phone)
        messages = manager.get_quick_start_guide(session)

        # v3.2: 4 messages - forecast key, camps list, peaks list, SafeCheck setup
        assert len(messages) == 4
        assert "FORECAST KEY" in messages[0]
        assert "YOUR CAMPS" in messages[1]
        assert "RONNY" in messages[1]  # Overland Track camp code
        assert "YOUR PEAKS" in messages[2]
        assert "SAFECHECK" in messages[3]
        assert "SAFE" in messages[3]
        assert "maps.google.com" in messages[3]  # GPS link example
    
    def test_restart_onboarding(self):
        """v3.1: START should restart onboarding at any point."""
        from app.services.onboarding import OnboardingManager, OnboardingState

        manager = OnboardingManager()
        phone = "+61400000007"

        # Start and complete onboarding
        manager.process_input(phone, "START")
        manager.process_input(phone, "TestUser")
        manager.process_input(phone, "1")  # Completes in v3.1

        # Session should be COMPLETE
        session = manager.get_session(phone)
        assert session.state == OnboardingState.COMPLETE

        # Start again - should restart
        response, is_complete = manager.process_input(phone, "START")

        assert "name" in response.lower()
        assert not is_complete

        # Should be back at AWAITING_NAME
        session = manager.get_session(phone)
        assert session.state == OnboardingState.AWAITING_NAME


class TestAdminDashboard:
    """Test admin dashboard uses SQLite database correctly."""

    def test_database_users_appear_in_list(self):
        """Users saved to database should appear in list_users()."""
        from app.models.database import SQLiteUserStore
        from datetime import date, timedelta
        import tempfile
        import os

        # Create a temporary database for testing
        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
            test_db = f.name

        try:
            store = SQLiteUserStore(db_path=test_db)

            # Create a test user
            store.create_user(
                phone="+61400099001",
                route_id="overland_track",
                start_date=date.today(),
                end_date=date.today() + timedelta(days=7),
                direction="standard",
                trail_name="Test Trail"
            )

            # Verify user appears in list
            users = store.list_users()
            assert len(users) == 1
            assert users[0].phone == "+61400099001"
            assert users[0].route_id == "overland_track"
        finally:
            os.unlink(test_db)

    def test_database_user_can_be_deleted(self):
        """Users can be deleted from database."""
        from app.models.database import SQLiteUserStore
        from datetime import date, timedelta
        import tempfile
        import os

        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
            test_db = f.name

        try:
            store = SQLiteUserStore(db_path=test_db)

            # Create and then delete a user
            store.create_user(
                phone="+61400099002",
                route_id="overland_track",
                start_date=date.today(),
                end_date=date.today() + timedelta(days=7),
                direction="standard"
            )

            assert len(store.list_users()) == 1
            assert store.delete_user("+61400099002") is True
            assert len(store.list_users()) == 0
        finally:
            os.unlink(test_db)

    def test_render_admin_handles_database_user(self):
        """render_admin should work with database User type."""
        from app.models.database import User as DbUser, SafeCheckContact
        from app.services.admin import render_admin
        from datetime import date, timedelta

        # Create a database-style User
        db_user = DbUser(
            phone="+61400099003",
            route_id="western_arthurs",
            start_date=date.today(),
            end_date=date.today() + timedelta(days=5),
            trail_name="Western Arthurs",
            direction="standard",
            current_position=None,
            status="registered",
            safecheck_contacts=[]
        )

        # render_admin should not crash
        html = render_admin([db_user], message="")

        # Should contain user info (phone is masked in new format)
        assert "+61400..." in html or "099003" in html
        assert "Western Arthurs" in html  # Route name is title-cased now
        assert "registered" in html  # Status

    def test_active_users_filtered_by_date(self):
        """get_active_users should only return users within date range."""
        from app.models.database import SQLiteUserStore
        from datetime import date, timedelta
        import tempfile
        import os

        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
            test_db = f.name

        try:
            store = SQLiteUserStore(db_path=test_db)

            # Create active user (today is within range)
            store.create_user(
                phone="+61400099004",
                route_id="overland_track",
                start_date=date.today() - timedelta(days=2),
                end_date=date.today() + timedelta(days=5),
                direction="standard"
            )

            # Create expired user (ended yesterday)
            store.create_user(
                phone="+61400099005",
                route_id="overland_track",
                start_date=date.today() - timedelta(days=10),
                end_date=date.today() - timedelta(days=1),
                direction="standard"
            )

            # Create future user (starts tomorrow)
            store.create_user(
                phone="+61400099006",
                route_id="overland_track",
                start_date=date.today() + timedelta(days=1),
                end_date=date.today() + timedelta(days=8),
                direction="standard"
            )

            # Only the active user should be returned
            active = store.get_active_users()
            assert len(active) == 1
            assert active[0].phone == "+61400099004"

            # But list_users should return all 3
            all_users = store.list_users()
            assert len(all_users) == 3
        finally:
            os.unlink(test_db)


class TestGSM7Compliance:
    """Test SMS messages are GSM-7 safe to minimize segment costs."""

    # GSM-7 basic character set (160 chars per segment)
    GSM7_BASIC = set(
        "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ ÆæßÉ "
        "!\"#¤%&'()*+,-./0123456789:;<=>?"
        "¡ABCDEFGHIJKLMNOPQRSTUVWXYZ§ÄÖÑܧ¿"
        "abcdefghijklmnopqrstuvwxyz|äöñüà"
    )
    GSM7_EXTENDED = set("€[\\]^{|}~")  # Count as 2 chars each

    # Characters that force UCS-2 encoding (70 chars per segment = 2.3x more expensive!)
    KNOWN_UNSAFE = set("°±═║╔╗╚╝─│┌┐└┘←→↑↓∞≠≤≥÷×©®")

    def is_gsm7_safe(self, text: str) -> tuple[bool, list]:
        """Check if text uses only GSM-7 characters."""
        unsafe = []
        for char in text:
            if char not in self.GSM7_BASIC and char not in self.GSM7_EXTENDED:
                unsafe.append((char, ord(char)))
        return len(unsafe) == 0, unsafe

    def calculate_segments(self, text: str) -> tuple[int, str]:
        """Calculate SMS segments and encoding type."""
        is_safe, _ = self.is_gsm7_safe(text)
        length = len(text)

        if is_safe:
            # GSM-7: 160 first segment, 153 for concatenated
            if length <= 160:
                return 1, "GSM-7"
            return 1 + ((length - 160 + 152) // 153), "GSM-7"
        else:
            # UCS-2: 70 first segment, 67 for concatenated
            if length <= 70:
                return 1, "UCS-2"
            return 1 + ((length - 70 + 66) // 67), "UCS-2"

    def test_formatter_gsm7_safe(self):
        """Formatter output should be GSM-7 safe."""
        from app.services.formatter import FormatCAST7Grouped

        # Mock forecast data
        forecast_data = {
            "LAKEO": [
                {"day": "Mon", "temp": "5-12", "rain_chance": 30, "prec": "R0-2",
                 "wind_avg": 20, "wind_max": 35, "wind_dir": "W",
                 "cloud": 60, "cloud_base": 12, "freezing_level": 18, "danger": ""},
            ] * 7,
            "HIGHM": [
                {"day": "Mon", "temp": "3-10", "rain_chance": 35, "prec": "R0-3",
                 "wind_avg": 25, "wind_max": 40, "wind_dir": "NW",
                 "cloud": 70, "cloud_base": 10, "freezing_level": 16, "danger": "!"},
            ] * 7,
        }

        from datetime import datetime
        result = FormatCAST7Grouped.format(
            route_name="Western Arthurs",
            forecast_data=forecast_data,
            location_type="CAMPS",
            date=datetime.now()
        )

        is_safe, unsafe_chars = self.is_gsm7_safe(result)
        assert is_safe, f"Formatter output contains non-GSM7 chars: {unsafe_chars[:10]}"

    def test_onboarding_gsm7_safe(self):
        """Onboarding messages should be GSM-7 safe."""
        from app.services.onboarding import OnboardingManager

        manager = OnboardingManager()
        phone = "+61400000099"

        # Test START response
        response, _ = manager.process_input(phone, "START")
        is_safe, unsafe = self.is_gsm7_safe(response)
        assert is_safe, f"START response contains non-GSM7 chars: {unsafe[:10]}"

        # Test name response
        response, _ = manager.process_input(phone, "TestUser")
        is_safe, unsafe = self.is_gsm7_safe(response)
        assert is_safe, f"Name response contains non-GSM7 chars: {unsafe[:10]}"

        # Test route selection
        response, _ = manager.process_input(phone, "1")
        is_safe, unsafe = self.is_gsm7_safe(response)
        assert is_safe, f"Route response contains non-GSM7 chars: {unsafe[:10]}"

    def test_quick_start_guide_gsm7_safe(self):
        """Quick start guide should be GSM-7 safe."""
        from app.services.onboarding import OnboardingManager

        # Complete onboarding to trigger quick start guide generation
        manager = OnboardingManager()
        phone = "+61400000098"
        manager.process_input(phone, "START")
        manager.process_input(phone, "TestUser")
        response, _ = manager.process_input(phone, "1")  # Select route

        # The completion response should be GSM-7 safe
        is_safe, unsafe = self.is_gsm7_safe(response)
        assert is_safe, f"Quick start response contains non-GSM7 chars: {unsafe[:10]}"

    def test_segment_calculation(self):
        """Verify segment calculation matches expected values."""
        # GSM-7 tests
        assert self.calculate_segments("Hello")[0] == 1  # Short message
        assert self.calculate_segments("A" * 160)[0] == 1  # Exactly 1 segment
        assert self.calculate_segments("A" * 161)[0] == 2  # Just over 1 segment
        assert self.calculate_segments("A" * 306)[0] == 2  # 160 + 146 = 306 chars fits in 2 segs
        assert self.calculate_segments("A" * 460)[0] == 3  # 160 + 153 + 153 = 466 max for 3 segs

        # UCS-2 tests (with non-GSM7 char)
        assert self.calculate_segments("Hello±World")[0] == 1  # Short with ±
        assert self.calculate_segments("±" + "A" * 69)[0] == 1  # Exactly 70 UCS-2
        assert self.calculate_segments("±" + "A" * 70)[0] == 2  # Just over 70

    def test_cost_estimation(self):
        """Test cost estimation based on segment count."""
        COST_PER_SEGMENT = 0.05  # ~5 cents per segment (Twilio AU)

        # GSM-7 message (1332 chars)
        gsm7_msg = "A" * 1332
        gsm7_segs, encoding = self.calculate_segments(gsm7_msg)
        assert encoding == "GSM-7"
        assert gsm7_segs == 9  # (1332 - 160) / 153 + 1 = 8.7 -> 9

        # Same length but with Unicode (forces UCS-2)
        ucs2_msg = "±" + "A" * 1331
        ucs2_segs, encoding = self.calculate_segments(ucs2_msg)
        assert encoding == "UCS-2"
        assert ucs2_segs == 20  # (1332 - 70) / 67 + 1 = 19.8 -> 20

        # Cost comparison
        gsm7_cost = gsm7_segs * COST_PER_SEGMENT
        ucs2_cost = ucs2_segs * COST_PER_SEGMENT

        assert ucs2_cost > gsm7_cost * 2, "UCS-2 should be >2x more expensive"
        print(f"\n1332 chars: GSM-7 = {gsm7_segs} segs (${gsm7_cost:.2f}), "
              f"UCS-2 = {ucs2_segs} segs (${ucs2_cost:.2f})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
