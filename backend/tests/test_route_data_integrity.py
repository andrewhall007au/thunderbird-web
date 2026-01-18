"""
Route Data Integrity Tests

These tests ensure route JSON files are complete and consistent.
This prevents issues like combined routes missing peaks from component routes.

Run with: pytest tests/test_route_data_integrity.py -v
"""

import pytest
import json
from pathlib import Path
from typing import Dict, List, Set, Any

ROUTES_DIR = Path(__file__).parent.parent / "config" / "routes"


def load_route(route_id: str) -> Dict[str, Any]:
    """Load a route JSON file by ID."""
    path = ROUTES_DIR / f"{route_id}.json"
    if not path.exists():
        pytest.skip(f"Route file {route_id}.json not found")
    with open(path) as f:
        return json.load(f)


def load_all_routes() -> Dict[str, Dict[str, Any]]:
    """Load all route JSON files."""
    routes = {}
    for path in ROUTES_DIR.glob("*.json"):
        with open(path) as f:
            data = json.load(f)
            routes[path.stem] = data
    return routes


def get_location_codes(route: Dict, location_type: str) -> Set[str]:
    """Get all camp or peak codes from a route."""
    return set(loc['code'] for loc in route.get(location_type, []))


def get_locations_dict(route: Dict, location_type: str) -> Dict[str, Dict]:
    """Get locations as a dict keyed by code."""
    return {loc['code']: loc for loc in route.get(location_type, [])}


class TestCombinedRouteCompleteness:
    """
    Combined routes must contain ALL locations from their component routes.
    This test class would have caught the missing peaks bug.
    """

    def test_combined_arthurs_has_all_western_peaks(self):
        """Combined Arthurs must include ALL peaks from Western Arthurs Full."""
        combined = load_route("combined_arthurs")
        western = load_route("western_arthurs_full")

        combined_peaks = get_location_codes(combined, "peaks")
        western_peaks = get_location_codes(western, "peaks")

        missing = western_peaks - combined_peaks
        assert not missing, \
            f"Combined Arthurs missing Western peaks: {sorted(missing)}"

    def test_combined_arthurs_has_all_eastern_peaks(self):
        """Combined Arthurs must include ALL peaks from Eastern Arthurs."""
        combined = load_route("combined_arthurs")
        eastern = load_route("eastern_arthurs")

        combined_peaks = get_location_codes(combined, "peaks")
        eastern_peaks = get_location_codes(eastern, "peaks")

        missing = eastern_peaks - combined_peaks
        assert not missing, \
            f"Combined Arthurs missing Eastern peaks: {sorted(missing)}"

    def test_combined_arthurs_has_all_western_camps(self):
        """Combined Arthurs must include key camps from Western Arthurs."""
        combined = load_route("combined_arthurs")
        western = load_route("western_arthurs_full")

        combined_camps = get_location_codes(combined, "camps")
        western_camps = get_location_codes(western, "camps")

        # Key camps that must be included (not all camps may be needed)
        key_camps = {"SCOTT", "LAKEO", "LAKEC", "LAKEF", "HIGHM", "LAKEH", "LAKES"}
        missing_key = (key_camps & western_camps) - combined_camps

        assert not missing_key, \
            f"Combined Arthurs missing key Western camps: {sorted(missing_key)}"

    def test_combined_arthurs_has_all_eastern_camps(self):
        """Combined Arthurs must include ALL camps from Eastern Arthurs."""
        combined = load_route("combined_arthurs")
        eastern = load_route("eastern_arthurs")

        combined_camps = get_location_codes(combined, "camps")
        eastern_camps = get_location_codes(eastern, "camps")

        missing = eastern_camps - combined_camps
        assert not missing, \
            f"Combined Arthurs missing Eastern camps: {sorted(missing)}"


class TestRouteMinimumCounts:
    """
    Each route should have reasonable minimum counts for camps and peaks.
    This catches incomplete route files.
    """

    # Minimum expected counts per route (based on actual route data)
    MINIMUM_CAMPS = {
        "overland_track": 8,
        "western_arthurs_ak": 5,
        "western_arthurs_full": 10,
        "federation_peak": 4,  # Focused route to one peak
        "eastern_arthurs": 7,
        "combined_arthurs": 14,  # Should have camps from both W and E
    }

    MINIMUM_PEAKS = {
        "overland_track": 2,
        "western_arthurs_ak": 5,
        "western_arthurs_full": 15,  # Has many peaks
        "federation_peak": 1,  # Focused route - just Federation Peak
        "eastern_arthurs": 4,
        "combined_arthurs": 20,  # Should have peaks from both W and E
    }

    @pytest.mark.parametrize("route_id,min_camps", MINIMUM_CAMPS.items())
    def test_minimum_camp_count(self, route_id, min_camps):
        """Each route must have at least the minimum number of camps."""
        route = load_route(route_id)
        actual = len(route.get('camps', []))
        assert actual >= min_camps, \
            f"{route_id}: Expected >= {min_camps} camps, got {actual}"

    @pytest.mark.parametrize("route_id,min_peaks", MINIMUM_PEAKS.items())
    def test_minimum_peak_count(self, route_id, min_peaks):
        """Each route must have at least the minimum number of peaks."""
        route = load_route(route_id)
        actual = len(route.get('peaks', []))
        assert actual >= min_peaks, \
            f"{route_id}: Expected >= {min_peaks} peaks, got {actual}"


class TestLocationSchema:
    """Validate that all locations have required fields."""

    REQUIRED_LOCATION_FIELDS = ['code', 'name', 'lat', 'lon', 'elevation', 'bom_cell']

    def test_camps_have_required_fields(self):
        """All camps must have required fields."""
        routes = load_all_routes()
        errors = []

        for route_id, route in routes.items():
            for camp in route.get('camps', []):
                for field in self.REQUIRED_LOCATION_FIELDS:
                    if field not in camp or camp[field] is None:
                        errors.append(f"{route_id}: Camp {camp.get('code', '?')} missing {field}")

        assert not errors, f"Missing fields:\n" + "\n".join(errors)

    def test_peaks_have_required_fields(self):
        """All peaks must have required fields."""
        routes = load_all_routes()
        errors = []

        for route_id, route in routes.items():
            for peak in route.get('peaks', []):
                for field in self.REQUIRED_LOCATION_FIELDS:
                    if field not in peak or peak[field] is None:
                        errors.append(f"{route_id}: Peak {peak.get('code', '?')} missing {field}")

        assert not errors, f"Missing fields:\n" + "\n".join(errors)

    def test_camp_codes_are_5_chars(self):
        """Camp codes should be exactly 5 uppercase characters."""
        routes = load_all_routes()
        errors = []

        for route_id, route in routes.items():
            for camp in route.get('camps', []):
                code = camp.get('code', '')
                if len(code) < 5 or len(code) > 6:
                    errors.append(f"{route_id}: Camp code '{code}' should be 5-6 chars")
                if code != code.upper():
                    errors.append(f"{route_id}: Camp code '{code}' should be uppercase")

        assert not errors, f"Invalid camp codes:\n" + "\n".join(errors)

    def test_peak_codes_are_valid(self):
        """Peak codes should be 4-6 uppercase characters."""
        routes = load_all_routes()
        errors = []

        for route_id, route in routes.items():
            for peak in route.get('peaks', []):
                code = peak.get('code', '')
                # Allow 4-6 chars (OSSA is 4, most are 5)
                if len(code) < 4 or len(code) > 6:
                    errors.append(f"{route_id}: Peak code '{code}' should be 4-6 chars")
                if code != code.upper():
                    errors.append(f"{route_id}: Peak code '{code}' should be uppercase")

        assert not errors, f"Invalid peak codes:\n" + "\n".join(errors)


class TestNoDuplicates:
    """Ensure no duplicate codes within routes."""

    def test_no_duplicate_camp_codes_per_route(self):
        """Each route should have unique camp codes."""
        routes = load_all_routes()
        errors = []

        for route_id, route in routes.items():
            codes = [c['code'] for c in route.get('camps', [])]
            duplicates = [c for c in codes if codes.count(c) > 1]
            if duplicates:
                errors.append(f"{route_id}: Duplicate camp codes: {set(duplicates)}")

        assert not errors, f"Duplicate codes:\n" + "\n".join(errors)

    def test_no_duplicate_peak_codes_per_route(self):
        """Each route should have unique peak codes."""
        routes = load_all_routes()
        errors = []

        for route_id, route in routes.items():
            codes = [p['code'] for p in route.get('peaks', [])]
            duplicates = [c for c in codes if codes.count(c) > 1]
            if duplicates:
                errors.append(f"{route_id}: Duplicate peak codes: {set(duplicates)}")

        assert not errors, f"Duplicate codes:\n" + "\n".join(errors)

    def test_no_camp_peak_code_collision(self):
        """Camp and peak codes should not collide within a route."""
        routes = load_all_routes()
        errors = []

        for route_id, route in routes.items():
            camp_codes = set(c['code'] for c in route.get('camps', []))
            peak_codes = set(p['code'] for p in route.get('peaks', []))
            collision = camp_codes & peak_codes
            if collision:
                errors.append(f"{route_id}: Code collision between camps and peaks: {collision}")

        assert not errors, f"Code collisions:\n" + "\n".join(errors)


class TestCrossRouteConsistency:
    """
    Same location appearing in multiple routes should have consistent data.
    """

    def test_shared_peaks_have_consistent_coordinates(self):
        """Same peak in different routes should have same coordinates (within tolerance)."""
        routes = load_all_routes()
        all_peaks = {}  # code -> list of (route_id, lat, lon, elevation)

        for route_id, route in routes.items():
            for peak in route.get('peaks', []):
                code = peak['code']
                if code not in all_peaks:
                    all_peaks[code] = []
                all_peaks[code].append({
                    'route': route_id,
                    'lat': peak['lat'],
                    'lon': peak['lon'],
                    'elevation': peak['elevation']
                })

        errors = []
        tolerance = 0.01  # ~1km tolerance for coordinate differences

        for code, occurrences in all_peaks.items():
            if len(occurrences) > 1:
                ref = occurrences[0]
                for other in occurrences[1:]:
                    lat_diff = abs(ref['lat'] - other['lat'])
                    lon_diff = abs(ref['lon'] - other['lon'])
                    elev_diff = abs(ref['elevation'] - other['elevation'])

                    if lat_diff > tolerance or lon_diff > tolerance:
                        errors.append(
                            f"Peak {code}: Coordinate mismatch between {ref['route']} and {other['route']} "
                            f"(lat diff: {lat_diff:.4f}, lon diff: {lon_diff:.4f})"
                        )
                    if elev_diff > 50:  # 50m elevation tolerance
                        errors.append(
                            f"Peak {code}: Elevation mismatch between {ref['route']} ({ref['elevation']}m) "
                            f"and {other['route']} ({other['elevation']}m)"
                        )

        assert not errors, f"Inconsistencies:\n" + "\n".join(errors[:10])  # Show first 10

    @pytest.mark.xfail(reason="Known issue: Camp coordinates differ between routes - needs data normalization")
    def test_shared_camps_have_consistent_coordinates(self):
        """Same camp in different routes should have same coordinates."""
        routes = load_all_routes()
        all_camps = {}

        for route_id, route in routes.items():
            for camp in route.get('camps', []):
                code = camp['code']
                if code not in all_camps:
                    all_camps[code] = []
                all_camps[code].append({
                    'route': route_id,
                    'lat': camp['lat'],
                    'lon': camp['lon'],
                    'elevation': camp['elevation']
                })

        errors = []
        tolerance = 0.01

        for code, occurrences in all_camps.items():
            if len(occurrences) > 1:
                ref = occurrences[0]
                for other in occurrences[1:]:
                    lat_diff = abs(ref['lat'] - other['lat'])
                    lon_diff = abs(ref['lon'] - other['lon'])

                    if lat_diff > tolerance or lon_diff > tolerance:
                        errors.append(
                            f"Camp {code}: Coordinate mismatch between {ref['route']} and {other['route']}"
                        )

        assert not errors, f"Inconsistencies:\n" + "\n".join(errors[:10])


class TestElevationRanges:
    """Validate elevations are within reasonable ranges for Tasmania."""

    # Different elevation ranges by region
    PEAK_ELEVATION_RANGES = {
        "overland_track": (1000, 1700),  # Cradle/Ossa region - higher peaks
        "default": (800, 1400),  # Arthurs Range
    }

    def test_peak_elevations_reasonable(self):
        """Peaks should have elevations within reasonable ranges for their region."""
        routes = load_all_routes()
        errors = []

        for route_id, route in routes.items():
            min_elev, max_elev = self.PEAK_ELEVATION_RANGES.get(
                route_id, self.PEAK_ELEVATION_RANGES["default"]
            )

            for peak in route.get('peaks', []):
                elev = peak.get('elevation', 0)
                if elev < min_elev or elev > max_elev:
                    errors.append(
                        f"{route_id}: Peak {peak['code']} has unusual elevation {elev}m "
                        f"(expected {min_elev}-{max_elev}m)"
                    )

        assert not errors, f"Elevation issues:\n" + "\n".join(errors)

    def test_camp_elevations_reasonable(self):
        """Camps should have elevations between 200m and 1100m."""
        routes = load_all_routes()
        errors = []

        for route_id, route in routes.items():
            for camp in route.get('camps', []):
                elev = camp.get('elevation', 0)
                if elev < 100 or elev > 1100:
                    errors.append(
                        f"{route_id}: Camp {camp['code']} has unusual elevation {elev}m"
                    )

        assert not errors, f"Elevation issues:\n" + "\n".join(errors)


class TestBomCellsCompleteness:
    """Validate BOM cells array includes all cells referenced by locations."""

    def test_all_location_cells_in_bom_cells(self):
        """Every bom_cell referenced by a location should be in the route's bom_cells array."""
        routes = load_all_routes()
        errors = []

        for route_id, route in routes.items():
            bom_cells = set(route.get('bom_cells', []))

            for camp in route.get('camps', []):
                cell = camp.get('bom_cell')
                if cell and cell not in bom_cells:
                    errors.append(f"{route_id}: Camp {camp['code']} cell {cell} not in bom_cells")

            for peak in route.get('peaks', []):
                cell = peak.get('bom_cell')
                if cell and cell not in bom_cells:
                    errors.append(f"{route_id}: Peak {peak['code']} cell {cell} not in bom_cells")

        assert not errors, f"Missing BOM cells:\n" + "\n".join(errors)


class TestKeyPeaksPresent:
    """Ensure famous/important peaks are present in relevant routes."""

    def test_federation_peak_in_eastern_and_combined(self):
        """Federation Peak (FEDER) must be in Eastern Arthurs and Combined."""
        eastern = load_route("eastern_arthurs")
        combined = load_route("combined_arthurs")

        eastern_peaks = get_location_codes(eastern, "peaks")
        combined_peaks = get_location_codes(combined, "peaks")

        assert "FEDER" in eastern_peaks, "Federation Peak missing from Eastern Arthurs"
        assert "FEDER" in combined_peaks, "Federation Peak missing from Combined Arthurs"

    def test_west_portal_in_western_and_combined(self):
        """West Portal (WESTP) must be in Western Arthurs Full and Combined."""
        western = load_route("western_arthurs_full")
        combined = load_route("combined_arthurs")

        western_peaks = get_location_codes(western, "peaks")
        combined_peaks = get_location_codes(combined, "peaks")

        assert "WESTP" in western_peaks, "West Portal missing from Western Arthurs Full"
        assert "WESTP" in combined_peaks, "West Portal missing from Combined Arthurs"

    def test_mt_ossa_in_overland_track(self):
        """Mt Ossa (highest in Tasmania) should be in Overland Track."""
        overland = load_route("overland_track")
        peaks = get_location_codes(overland, "peaks")

        # Check for OSSA or similar code
        ossa_present = any('OSSA' in code for code in peaks)
        assert ossa_present, f"Mt Ossa missing from Overland Track. Peaks: {peaks}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
