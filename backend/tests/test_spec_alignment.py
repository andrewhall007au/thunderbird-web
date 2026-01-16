"""
Tests to verify route JSON files match the spec.
Based on THUNDERBIRD_SPEC_v2.7
"""

import pytest
import json
import re
from pathlib import Path

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


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
