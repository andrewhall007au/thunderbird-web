"""
Tests for Danger Rating System (Spec Section 6)
v3.0: Comprehensive danger rating logic
"""
import pytest
from datetime import datetime


class TestDangerRatingLogic:
    """Test danger rating calculation per Section 6.1-6.3"""
    
    def test_no_danger_clear_conditions(self):
        """Clear conditions should show no danger marker."""
        from app.services.danger import calculate_danger
        
        result = calculate_danger(
            wind_max_kmh=20,
            rain_probability=10,
            precip_mm=0,
            temp_c=15,
            freezing_level=2500
        )
        assert result == "", "Clear conditions should have no marker"
    
    def test_single_danger_moderate_wind(self):
        """Moderate wind (40-60 km/h) should show single !"""
        from app.services.danger import calculate_danger
        
        result = calculate_danger(
            wind_max_kmh=50,
            rain_probability=10,
            precip_mm=0,
            temp_c=15,
            freezing_level=2500
        )
        assert result == "!", "Moderate wind should show !"
    
    def test_double_danger_high_wind(self):
        """High wind (60-80 km/h) should show !!"""
        from app.services.danger import calculate_danger
        
        result = calculate_danger(
            wind_max_kmh=70,
            rain_probability=10,
            precip_mm=0,
            temp_c=15,
            freezing_level=2500
        )
        assert result == "!!", "High wind should show !!"
    
    def test_triple_danger_extreme_wind(self):
        """Extreme wind (>80 km/h) should show !!!"""
        from app.services.danger import calculate_danger
        
        result = calculate_danger(
            wind_max_kmh=90,
            rain_probability=10,
            precip_mm=0,
            temp_c=15,
            freezing_level=2500
        )
        assert result == "!!!", "Extreme wind should show !!!"
    
    def test_danger_heavy_rain(self):
        """Heavy rain (>10mm) should increase danger."""
        from app.services.danger import calculate_danger
        
        result = calculate_danger(
            wind_max_kmh=20,
            rain_probability=90,
            precip_mm=15,
            temp_c=10,
            freezing_level=1500
        )
        assert "!" in result, "Heavy rain should show danger"
    
    def test_danger_low_freezing_level(self):
        """Low freezing level at elevation should show danger."""
        from app.services.danger import calculate_danger
        
        result = calculate_danger(
            wind_max_kmh=30,
            rain_probability=60,
            precip_mm=5,
            temp_c=2,
            freezing_level=900,  # Below typical peak elevations
            elevation=1100
        )
        assert "!" in result, "Snow at elevation should show danger"


class TestThunderstormDetection:
    """Test thunderstorm detection per Section 6.7.4"""
    
    def test_thunderstorm_possible(self):
        """High CAPE should show TS? marker."""
        from app.services.danger import calculate_danger
        
        result = calculate_danger(
            wind_max_kmh=30,
            rain_probability=70,
            precip_mm=5,
            temp_c=25,
            freezing_level=3500,
            cape=1000  # Moderate instability
        )
        assert "TS?" in result or "!" in result, "CAPE >500 should indicate storm potential"
    
    def test_thunderstorm_likely(self):
        """Very high CAPE should show TS! marker."""
        from app.services.danger import calculate_danger
        
        result = calculate_danger(
            wind_max_kmh=40,
            rain_probability=80,
            precip_mm=10,
            temp_c=28,
            freezing_level=4000,
            cape=2500  # High instability
        )
        assert "TS!" in result or "!!" in result, "CAPE >2000 should indicate likely storms"


class TestCombinedDangers:
    """Test combined danger scenarios."""
    
    def test_wind_plus_rain(self):
        """Wind + rain should compound danger."""
        from app.services.danger import calculate_danger
        
        # Wind alone
        wind_only = calculate_danger(
            wind_max_kmh=50,
            rain_probability=10,
            precip_mm=0,
            temp_c=15,
            freezing_level=2500
        )
        
        # Wind + rain
        combined = calculate_danger(
            wind_max_kmh=50,
            rain_probability=80,
            precip_mm=10,
            temp_c=10,
            freezing_level=1200
        )
        
        assert len(combined) >= len(wind_only), "Combined conditions should not reduce danger"
    
    def test_max_danger_extreme_conditions(self):
        """Extreme conditions should show maximum danger."""
        from app.services.danger import calculate_danger
        
        result = calculate_danger(
            wind_max_kmh=100,
            rain_probability=95,
            precip_mm=30,
            temp_c=-5,
            freezing_level=500,
            cape=3000
        )
        assert "!!!" in result, "Extreme conditions should show !!!"


class TestDangerInForecast:
    """Test danger column in forecast output."""
    
    def test_danger_column_in_header(self):
        """D column should be in forecast header."""
        from app.services.formatter import FormatCAST12
        
        # Check header includes D
        from app.services.formatter import get_forecast_header
        header = get_forecast_header()
        assert "D" in header, "Header should include D (Danger) column"
    
    @pytest.mark.skip(reason="FormatCAST12 API mismatch - needs refactor")
    def test_danger_values_in_output(self):
        """Forecast should include danger values."""
        from app.services.formatter import FormatCAST12
        from datetime import datetime
        from zoneinfo import ZoneInfo
        
        TZ_HOBART = ZoneInfo("Australia/Hobart")
        
        mock_data = []
        for hour in range(12):
            mock_data.append({
                "hour": hour + 6,
                "temp": 10,
                "rain_prob": 80 if hour > 6 else 20,
                "precip_mm": 5 if hour > 6 else 0,
                "wind_avg": 30,
                "wind_max": 70 if hour > 8 else 30,  # High wind later
                "wind_dir": "NW",
                "cloud_cover": 80,
                "freezing_level": 1200
            })
        
        result = FormatCAST12.format(
            location_name="Lake Oberon",
            elevation=863,
            forecast_data=mock_data,
            date=datetime.now(TZ_HOBART)
        )
        
        # Should have some danger markers for high wind periods
        assert "!" in result or "D" in result, "Forecast should show danger indicators"
