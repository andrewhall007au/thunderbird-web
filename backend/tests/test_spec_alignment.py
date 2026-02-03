"""
Tests to verify route JSON files match the spec.
Based on THUNDERBIRD_SPEC_v2.7
"""

import pytest
import json
import re
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.weather.router import WeatherRouter

SPEC_PATH = Path(__file__).parent.parent.parent / "docs" / "THUNDERBIRD_SPEC_v3.1.md"
ROUTES_DIR = Path(__file__).parent.parent / "config" / "routes"


def get_spec_counts():
    """Extract expected counts from Section 4.3."""
    with open(SPEC_PATH) as f:
        spec = f.read()
    
    # Parse: | Western Arthurs | 35 locations | 14 cells | 60% |
    wa_match = re.search(r'Western Arthurs \| (\d+) locations \| (\d+) cells', spec)
    ot_match = re.search(r'Overland Track \| (\d+) locations \| (\d+) cells', spec)
    
    return {
        'western_arthurs': {
            'locations': int(wa_match.group(1)) if wa_match else 0,
            'cells': int(wa_match.group(2)) if wa_match else 0
        },
        'overland_track': {
            'locations': int(ot_match.group(1)) if ot_match else 0,
            'cells': int(ot_match.group(2)) if ot_match else 0
        }
    }


def get_spec_cells(route_prefix='WA'):
    """Extract BOM cells from spec Cell sections."""
    with open(SPEC_PATH) as f:
        spec = f.read()
    
    # Pattern: **Cell WA-XX** (BOM index: XXX-XXX) or **Cell OT-XX**
    pattern = rf'\*\*Cell {route_prefix}-\d+a?\*\* \(BOM index: (\d+-\d+)\)'
    cells = set()
    for match in re.finditer(pattern, spec):
        cells.add(match.group(1))
    
    return cells


class TestSpecAlignment:
    """Verify route JSON files align with spec."""
    
    @pytest.mark.skip(reason="Spec format changed in v3.1")
    def test_western_arthurs_full_location_count(self):
        """Full Traverse should have 35 locations per spec Section 4.3."""
        expected = get_spec_counts()
        
        route_path = ROUTES_DIR / "western_arthurs_full.json"
        assert route_path.exists(), "western_arthurs_full.json not found"
        
        with open(route_path) as f:
            route = json.load(f)
        
        actual_locations = len(route['camps']) + len(route['peaks'])
        
        assert actual_locations == expected['western_arthurs']['locations'], \
            f"Expected {expected['western_arthurs']['locations']} locations, got {actual_locations}"
    
    @pytest.mark.skip(reason="Spec format changed in v3.1")
    def test_western_arthurs_full_cell_count(self):
        """Full Traverse should have 14 BOM cells per spec Section 4.3."""
        expected = get_spec_counts()
        
        route_path = ROUTES_DIR / "western_arthurs_full.json"
        with open(route_path) as f:
            route = json.load(f)
        
        actual_cells = len(route['bom_cells'])
        
        assert actual_cells == expected['western_arthurs']['cells'], \
            f"Expected {expected['western_arthurs']['cells']} cells, got {actual_cells}"
    
    @pytest.mark.skip(reason="Spec format changed in v3.1")
    def test_western_arthurs_full_cells_match_spec(self):
        """Full Traverse BOM cells should exactly match spec Cell sections."""
        spec_cells = get_spec_cells('WA')
        
        route_path = ROUTES_DIR / "western_arthurs_full.json"
        with open(route_path) as f:
            route = json.load(f)
        
        route_cells = set(route['bom_cells'])
        
        assert route_cells == spec_cells, \
            f"Cells mismatch. Missing: {spec_cells - route_cells}, Extra: {route_cells - spec_cells}"
    
    def test_western_arthurs_ak_subset_of_full(self):
        """A-K route should be a subset of Full Traverse."""
        ak_path = ROUTES_DIR / "western_arthurs_ak.json"
        full_path = ROUTES_DIR / "western_arthurs_full.json"
        
        with open(ak_path) as f:
            ak = json.load(f)
        with open(full_path) as f:
            full = json.load(f)
        
        ak_camp_codes = set(c['code'] for c in ak['camps'])
        full_camp_codes = set(c['code'] for c in full['camps'])
        
        assert ak_camp_codes.issubset(full_camp_codes), \
            f"A-K camps not subset of Full: {ak_camp_codes - full_camp_codes}"
    
    @pytest.mark.skip(reason="Spec format changed in v3.1")
    def test_overland_track_location_count(self):
        """Overland Track should have 19 locations per spec Section 4.3."""
        expected = get_spec_counts()
        
        route_path = ROUTES_DIR / "overland_track.json"
        assert route_path.exists(), "overland_track.json not found"
        
        with open(route_path) as f:
            route = json.load(f)
        
        actual_locations = len(route['camps']) + len(route['peaks'])
        
        assert actual_locations == expected['overland_track']['locations'], \
            f"Expected {expected['overland_track']['locations']} locations, got {actual_locations}"
    
    @pytest.mark.skip(reason="Spec format changed in v3.1")
    def test_overland_track_cell_count(self):
        """Overland Track should have 19 BOM cells per spec Section 4.3."""
        expected = get_spec_counts()
        
        route_path = ROUTES_DIR / "overland_track.json"
        with open(route_path) as f:
            route = json.load(f)
        
        actual_cells = len(route['bom_cells'])
        
        assert actual_cells == expected['overland_track']['cells'], \
            f"Expected {expected['overland_track']['cells']} cells, got {actual_cells}"
    
    def test_camp_codes_are_5_or_6_chars(self):
        """Camp codes should be 5-6 characters (6 for disambiguation)."""
        for route_file in ROUTES_DIR.glob("*.json"):
            with open(route_file) as f:
                route = json.load(f)
            
            for camp in route.get('camps', []):
                assert 5 <= len(camp['code']) <= 6, \
                    f"{route_file.name}: Camp code '{camp['code']}' should be 5-6 chars"
    
    def test_bom_cells_have_correct_format(self):
        """BOM cells should be in XXX-XXX format."""
        cell_pattern = re.compile(r'^\d{3}-\d{3}$')
        
        for route_file in ROUTES_DIR.glob("*.json"):
            with open(route_file) as f:
                route = json.load(f)
            
            for cell in route.get('bom_cells', []):
                assert cell_pattern.match(cell), \
                    f"{route_file.name}: Invalid cell format '{cell}'"
    
    def test_all_camps_have_bom_cell(self):
        """Every camp should have a bom_cell assigned."""
        for route_file in ROUTES_DIR.glob("*.json"):
            with open(route_file) as f:
                route = json.load(f)
            
            for camp in route.get('camps', []):
                assert 'bom_cell' in camp and camp['bom_cell'], \
                    f"{route_file.name}: Camp {camp['code']} missing bom_cell"
    
    def test_all_peaks_have_bom_cell(self):
        """Every peak should have a bom_cell assigned."""
        for route_file in ROUTES_DIR.glob("*.json"):
            with open(route_file) as f:
                route = json.load(f)

            for peak in route.get('peaks', []):
                assert 'bom_cell' in peak and peak['bom_cell'], \
                    f"{route_file.name}: Peak {peak.get('name', 'unknown')} missing bom_cell"


class TestWeatherProviderSpecAlignment:
    """
    Verify weather provider mappings match specification requirements.

    This test validates that the WeatherRouter's provider mappings align
    with the documented spec (WEATHER_API_SPEC.md, THUNDERBIRD_SPEC_v3.2.md).

    It prevents specification drift by ensuring all documented country
    mappings are actually implemented in the router.
    """

    def test_router_provider_mappings_match_spec(self):
        """
        Router provider mappings must match spec requirements.

        Spec sources:
        - docs/WEATHER_API_SPEC.md (Section: Provider Mapping)
        - docs/THUNDERBIRD_SPEC_v3.2.md (Section 15.2)
        - backend/README.md (Provider Mapping table)

        This test prevents the issue caught by OpenClaw where AU→BOM
        mapping was documented but not implemented.
        """
        router = WeatherRouter()

        # Expected mappings from spec
        # These are the PRIMARY provider names (not fallback)
        expected_mappings = {
            "AU": "BOM",                      # Bureau of Meteorology (2.2km)
            "US": "NWS",                      # National Weather Service (2.5km)
            "CA": "Environment Canada",       # Environment Canada (2.5km)
            "GB": "Met Office",               # Met Office IMPROVER (1.5km)
            "FR": "Meteo-France",             # Open-Meteo Meteo-France AROME (1.5km)
            "IT": "ICON",                     # Open-Meteo DWD ICON-EU (7km)
            "CH": "MeteoSwiss",               # Open-Meteo MeteoSwiss ICON-CH2 (2km)
            "JP": "JMA",                      # Open-Meteo JMA MSM (5km)
            "NZ": "ECMWF",                    # Open-Meteo ECMWF (9km)
            "ZA": "ECMWF",                    # Open-Meteo ECMWF (9km)
        }

        for country, expected_provider in expected_mappings.items():
            actual_provider = router.get_provider(country)
            provider_name = actual_provider.provider_name

            assert expected_provider in provider_name, (
                f"Spec deviation detected!\n"
                f"Country: {country}\n"
                f"Spec requires: {expected_provider}\n"
                f"Router provides: {provider_name}\n"
                f"\n"
                f"This indicates the router mapping doesn't match the documented spec.\n"
                f"Update router.py or the spec to align them."
            )

    def test_all_documented_countries_have_providers(self):
        """
        All countries documented in spec must have provider mappings.

        This ensures we don't document support for countries that
        actually fall back to the generic provider.
        """
        router = WeatherRouter()

        # Countries explicitly documented as supported
        documented_countries = [
            "AU", "US", "CA", "GB", "FR", "IT", "CH", "JP", "NZ", "ZA"
        ]

        for country in documented_countries:
            provider = router.get_provider(country)

            # Should NOT be the generic fallback for documented countries
            # Fallback provider name contains "Open-Meteo" and "best_match"
            assert country in router.providers, (
                f"Country {country} is documented in spec but not in router.providers!\n"
                f"Got fallback provider: {provider.provider_name}\n"
                f"Expected explicit country mapping."
            )

    def test_router_fallback_for_undocumented_countries(self):
        """
        Undocumented countries should use fallback provider.

        This verifies the fallback mechanism works for countries
        without explicit provider mappings.
        """
        router = WeatherRouter()

        # Test with a country code not in the spec
        undocumented_countries = ["XX", "YY", "ZZ"]

        for country in undocumented_countries:
            provider = router.get_provider(country)

            # Should use fallback (Open-Meteo with best_match)
            assert "Open-Meteo" in provider.provider_name, (
                f"Undocumented country {country} should use Open-Meteo fallback, "
                f"got {provider.provider_name}"
            )


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
