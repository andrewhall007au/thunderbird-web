"""
Pytest Configuration
"""

import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest


@pytest.fixture
def mock_settings(monkeypatch):
    """Mock settings for testing."""
    monkeypatch.setenv("MOCK_BOM_API", "true")
    monkeypatch.setenv("DEBUG", "true")


@pytest.fixture
def sample_forecast_data():
    """Sample forecast data for testing."""
    return {
        "periods": [
            {
                "time": "2026-01-15T09:00:00+11:00",
                "period": "AM",
                "temp_min": 5,
                "temp_max": 12,
                "rain_chance": 60,
                "rain_min": 2,
                "rain_max": 8,
                "snow_min": 0,
                "snow_max": 1,
                "wind_avg": 35,
                "wind_max": 50,
                "cloud_cover": 75,
                "cloud_base_height_agl": 900,
                "freezing_level": 1500,
                "convective_available_potential_energy": 150
            }
        ]
    }
