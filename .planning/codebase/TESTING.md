# Testing Patterns

**Analysis Date:** 2026-01-19

## Test Framework

**Runner:**
- pytest (version 7.4.0+)
- pytest-asyncio (version 0.23.0+) for async test support
- No pytest.ini or pyproject.toml config - uses defaults

**Assertion Library:**
- pytest native assertions
- No additional assertion libraries

**Run Commands:**
```bash
pytest tests/ -v                    # Run all tests with verbose output
pytest tests/test_services.py -v    # Run specific test file
pytest tests/ -v -k "test_camp"     # Run tests matching pattern
pytest tests/ --cov=app             # Run with coverage
```

## Test File Organization

**Location:**
- Tests in `backend/tests/` directory (separate from source)
- No co-located tests with source files

**Naming:**
- `test_*.py` prefix for all test files
- Organized by feature/version:
  - `test_services.py` - Core service unit tests
  - `test_validation.py` - Comprehensive validation tests
  - `test_v3_*.py` - Version 3.0 feature tests
  - `test_spec_alignment.py` - Spec compliance tests

**Structure:**
```
backend/tests/
├── conftest.py                    # Shared fixtures
├── deploy_verify.sh               # Deployment verification script
├── smoke_test_server.py           # Server smoke tests
├── test_route_data_integrity.py   # Route JSON validation
├── test_services.py               # Service unit tests
├── test_spec_alignment.py         # Spec compliance
├── test_v3_cast_commands.py       # CAST command tests
├── test_v3_checkin_onboarding.py  # Onboarding flow tests
├── test_v3_danger_rating.py       # Danger calculation tests
├── test_v3_dynamic_grouping.py    # Weather zone grouping
├── test_v3_e2e_journey.py         # End-to-end user journey
├── test_v3_format_changes.py      # SMS format tests
├── test_v3_pricing.py             # Pricing/cost tests
├── test_v3_safecheck_commands.py  # SafeCheck tests
└── test_validation.py             # Comprehensive validation
```

## Test Structure

**Suite Organization:**
```python
"""
V3.0 CHECKIN, Onboarding, and Alerts Tests

Tests for:
- CHECKIN command (explicit check-in format)
- Simplified onboarding (5 steps, no start date)
- ALERTS ON/OFF (opt-in BOM warnings)
- ROUTE command (list all codes)

Run with: pytest tests/test_v3_checkin_onboarding.py -v
"""

import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from zoneinfo import ZoneInfo

TZ_HOBART = ZoneInfo("Australia/Hobart")


class TestCHECKINCommand:
    """
    v3.0 uses explicit CHECKIN command instead of just camp code.
    Spec Section 8.3
    """

    def test_checkin_parses_correctly(self):
        """CHECKIN LAKEO should parse as check-in command"""
        from app.services.commands import CommandParser

        parser = CommandParser()
        parsed = parser.parse("CHECKIN LAKEO")

        assert parsed.command_type.name == "CHECKIN"
        assert parsed.location_code.upper() == "LAKEO"
```

**Patterns:**
- Class-based test grouping by feature
- Docstrings reference spec sections
- Test methods are descriptive (`test_checkin_parses_correctly`)
- Imports inside test methods when testing specific modules

## Fixtures

**Shared fixtures in `backend/tests/conftest.py`:**
```python
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
                # ... more fields
            }
        ]
    }
```

**Usage:**
```python
def test_something(mock_settings, sample_forecast_data):
    # Fixtures automatically injected
    pass
```

## Mocking

**Framework:** `unittest.mock` (standard library)

**Patterns:**

**Service mocking with patch:**
```python
from unittest.mock import patch

def test_checkin_triggers_safecheck(self):
    from app.services.safecheck import SafeCheckService

    service = SafeCheckService()

    with patch.object(service, 'send_notification') as mock_send:
        mock_send.return_value = True
        result = service.notify_checkin(...)
        assert mock_send.called or result is not None
```

**Environment variable mocking:**
```python
def test_with_mock_env(monkeypatch):
    monkeypatch.setenv("MOCK_BOM_API", "true")
    # Test code
```

**What to Mock:**
- External API calls (BOM, Twilio)
- Database operations in unit tests
- Time-dependent operations (use fixed datetimes)

**What NOT to Mock:**
- Pure functions (test actual behavior)
- Data validation logic
- Command parsing (test real parser)

## Data-Driven Testing

**JSON route file testing from `test_validation.py`:**
```python
ROUTES_DIR = Path(__file__).parent.parent / "config" / "routes"

class TestBOMCellCalculations:
    def test_all_waypoints_have_valid_cells(self):
        """Every waypoint should have a BOM cell in XXX-XXX format."""
        cell_pattern = re.compile(r'^\d{3}-\d{3}$')

        for route_file in ROUTES_DIR.glob("*.json"):
            with open(route_file) as f:
                route = json.load(f)

            for camp in route.get('camps', []):
                assert cell_pattern.match(camp['bom_cell']), \
                    f"{route_file.name}: Camp {camp['code']} has invalid cell"
```

**Case variation testing:**
```python
def test_checkin_case_insensitive(self):
    parser = CommandParser()

    variations = [
        "CHECKIN LAKEO",
        "checkin lakeo",
        "Checkin Lakeo",
        "CheckIn LAKEO",
    ]

    for cmd in variations:
        parsed = parser.parse(cmd)
        assert parsed.command_type.name == "CHECKIN", f"Failed: {cmd}"
```

## Coverage

**Requirements:** No enforced minimum (no coverage config found)

**View Coverage:**
```bash
pytest tests/ --cov=app --cov-report=html
# Opens htmlcov/index.html
```

**Current Coverage Gaps (observed):**
- Some formatter methods have `@pytest.mark.skip` due to API changes
- E2E integration tests may not run in CI

## Test Types

**Unit Tests:**
- Located in `test_services.py`, `test_v3_*.py`
- Test individual functions/methods in isolation
- Fast execution, no external dependencies

**Integration Tests:**
- Located in `test_integration.py`, `test_validation.py`
- Test module interactions
- May load JSON config files

**E2E Tests:**
- Located in `test_v3_e2e_journey.py`
- Full user journey simulation
- Tests complete flows

**Smoke Tests:**
- Located in `smoke_test_server.py`
- Quick verification of server startup
- Used for deployment verification

## Common Patterns

**Async Testing:**
```python
import pytest

# No pytest-asyncio markers used - tests are synchronous
# Async code tested via sync wrappers or mocking
```

**Error Testing:**
```python
def test_normalize_invalid(self):
    """Test invalid phone number."""
    with pytest.raises(ValueError):
        PhoneUtils.normalize("123456")
```

**Boundary Testing:**
```python
def test_count_segments_exactly_160(self):
    """Test exactly 160 character message."""
    msg = "x" * 160
    assert SMSCostCalculator.count_segments(msg) == 1

def test_count_segments_161(self):
    """Test 161 character message (2 segments)."""
    msg = "x" * 161
    assert SMSCostCalculator.count_segments(msg) == 2
```

**Skip Pattern:**
```python
@pytest.mark.skip(reason="FormatCAST12 API mismatch - needs refactor")
def test_danger_values_in_output(self):
    # Test code
    pass
```

## Assertion Patterns

**Descriptive assertions:**
```python
assert "Lake Oberon" in response, "Should show camp name"
assert "SafeCheck" in response or "notified" in response.lower(), \
    "Should mention SafeCheck notification"
```

**Multiple assertions per test (when related):**
```python
def test_camp_lookup(self):
    route = get_route('western_arthurs_full')
    camp = route.get_camp('LAKEO')

    assert camp is not None
    assert camp.name == 'Lake Oberon'
    assert camp.elevation == 863
```

**Conditional assertions for robustness:**
```python
def test_load_western_arthurs(self):
    route = RouteLoader.load("western_arthurs_ak")

    if route:  # May not exist in test environment
        assert route.route_id == "western_arthurs_ak"
        assert route.is_loop == True
```

## Test Data Management

**Inline test data:**
```python
def test_process_input(self):
    mock_warnings = [
        {
            "title": "Wind Warning",
            "description": "SW Tasmania highlands",
            "details": "Gusts 90-100km/h ridges",
            "valid_from": "2026-01-16T06:00:00+11:00",
            "valid_to": "2026-01-16T18:00:00+11:00",
        }
    ]
```

**Location:**
- Test data inline in test files
- JSON route files in `backend/config/routes/` used directly
- No separate fixtures directory

## Running Tests

**From backend directory:**
```bash
cd /Users/andrewhall/thunderbird-web/backend

# Run all tests
pytest tests/ -v

# Run specific test class
pytest tests/test_v3_checkin_onboarding.py::TestCHECKINCommand -v

# Run with pattern matching
pytest tests/ -v -k "danger"

# Run with coverage
pytest tests/ --cov=app --cov-report=term-missing
```

**Path setup in conftest.py:**
```python
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))
```

---

*Testing analysis: 2026-01-19*
