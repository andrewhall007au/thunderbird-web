"""
Route Configuration Loader
Based on THUNDERBIRD_SPEC_v2.4 Section 3
"""

import json
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field

from config.settings import ROUTES_DIR, BOMGridConfig


@dataclass
class Waypoint:
    """Camp or peak waypoint."""
    code: str
    name: str
    lat: float
    lon: float
    elevation: int
    bom_cell: str  # Weather zone ID (our grouping identifier, not a BOM concept)
    verified: bool = False
    type: str = "camp"  # 'camp', 'peak', 'trailhead', 'hut', 'endpoint'
    capacity: Optional[int] = None
    notes: Optional[str] = None
    distance_return_km: Optional[float] = None


@dataclass
class ItineraryDay:
    """Single day in standard itinerary."""
    day: int
    from_code: str
    to_code: str
    distance_km: float
    description: str


@dataclass
class Route:
    """Complete route configuration."""
    route_id: str
    name: str
    short_name: str
    region: str
    distance_km: int
    typical_days: str
    grade: int
    grade_description: str
    is_loop: bool
    
    # Elevation config
    camp_typical_elevation: int
    peak_typical_elevation: int
    peak_min_elevation: int
    peak_max_elevation: int
    
    # Waypoints
    camps: List[Waypoint] = field(default_factory=list)
    peaks: List[Waypoint] = field(default_factory=list)
    
    # Itinerary
    standard_itinerary: List[ItineraryDay] = field(default_factory=list)
    
    # Return waypoints (for loop routes)
    return_waypoints: List[Dict[str, str]] = field(default_factory=list)
    
    # Weather zones used by this route (our grouping, not BOM's)
    bom_cells: List[str] = field(default_factory=list)
    
    def get_camp(self, code: str) -> Optional[Waypoint]:
        """Get camp by code."""
        for camp in self.camps:
            if camp.code == code:
                return camp
        return None
    
    def get_peak(self, code: str) -> Optional[Waypoint]:
        """Get peak by code."""
        for peak in self.peaks:
            if peak.code == code:
                return peak
        return None
    
    def get_camp_codes(self) -> List[str]:
        """Get list of camp codes in route order."""
        return [camp.code for camp in self.camps]
    
    def get_camps_in_cell(self, cell_id: str) -> List[Waypoint]:
        """Get all camps in a weather zone."""
        return [camp for camp in self.camps if camp.bom_cell == cell_id]
    
    def get_peaks_in_cell(self, cell_id: str) -> List[Waypoint]:
        """Get all peaks in a weather zone."""
        return [peak for peak in self.peaks if peak.bom_cell == cell_id]
    
    def get_forward_camps(self, from_code: str) -> List[Waypoint]:
        """Get camps ahead of current position."""
        codes = self.get_camp_codes()
        try:
            idx = codes.index(from_code)
            forward_codes = codes[idx + 1:]
            return [c for c in self.camps if c.code in forward_codes]
        except ValueError:
            return []
    
    def is_camp_ahead(self, current: str, target: str) -> bool:
        """Check if target camp is ahead of current."""
        codes = self.get_camp_codes()
        try:
            current_idx = codes.index(current)
            target_idx = codes.index(target)
            return target_idx > current_idx
        except ValueError:
            return False


class RouteLoader:
    """
    Load and cache route configurations from JSON files.
    """
    
    _cache: Dict[str, Route] = {}
    
    @classmethod
    def load(cls, route_id: str) -> Optional[Route]:
        """
        Load route configuration by ID.
        
        Args:
            route_id: Route identifier (e.g., 'western_arthurs_ak')
        
        Returns:
            Route configuration or None if not found
        """
        # Check cache first
        if route_id in cls._cache:
            return cls._cache[route_id]
        
        # Load from file
        config_path = ROUTES_DIR / f"{route_id}.json"
        if not config_path.exists():
            return None
        
        try:
            with open(config_path) as f:
                data = json.load(f)
            
            route = cls._parse_route(data)
            cls._cache[route_id] = route
            return route
            
        except (json.JSONDecodeError, KeyError) as e:
            print(f"Error loading route {route_id}: {e}")
            return None
    
    @classmethod
    def _parse_route(cls, data: Dict[str, Any]) -> Route:
        """Parse route data from JSON."""
        # Parse elevation config
        elev_config = data.get("elevation_config", {})
        
        # Parse camps
        camps = []
        for camp_data in data.get("camps", []):
            camps.append(Waypoint(
                code=camp_data["code"],
                name=camp_data["name"],
                lat=camp_data["lat"],
                lon=camp_data["lon"],
                elevation=camp_data["elevation"],
                bom_cell=camp_data.get("bom_cell", cls._calculate_cell(camp_data)),
                verified=camp_data.get("verified", False),
                type=camp_data.get("type", "camp"),
                capacity=camp_data.get("capacity"),
                notes=camp_data.get("notes")
            ))
        
        # Parse peaks
        peaks = []
        for peak_data in data.get("peaks", []):
            peaks.append(Waypoint(
                code=peak_data["code"],
                name=peak_data["name"],
                lat=peak_data["lat"],
                lon=peak_data["lon"],
                elevation=peak_data["elevation"],
                bom_cell=peak_data.get("bom_cell", cls._calculate_cell(peak_data)),
                verified=peak_data.get("verified", False),
                type=peak_data.get("type", "peak"),
                distance_return_km=peak_data.get("distance_return_km"),
                notes=peak_data.get("notes")
            ))
        
        # Parse itinerary
        itinerary = []
        for day_data in data.get("standard_itinerary", []):
            itinerary.append(ItineraryDay(
                day=day_data["day"],
                from_code=day_data["from"],
                to_code=day_data["to"],
                distance_km=day_data["distance_km"],
                description=day_data["description"]
            ))
        
        return Route(
            route_id=data["route_id"],
            name=data["name"],
            short_name=data.get("short_name", data["name"]),
            region=data.get("region", "Tasmania"),
            distance_km=data.get("distance_km", 0),
            typical_days=data.get("typical_days", "5-7"),
            grade=data.get("grade", 4),
            grade_description=data.get("grade_description", ""),
            is_loop=data.get("is_loop", False),
            camp_typical_elevation=elev_config.get("camp_typical", 850),
            peak_typical_elevation=elev_config.get("peak_typical", 1100),
            peak_min_elevation=elev_config.get("peak_min", 1000),
            peak_max_elevation=elev_config.get("peak_max", 1200),
            camps=camps,
            peaks=peaks,
            standard_itinerary=itinerary,
            return_waypoints=data.get("return_waypoints", []),
            bom_cells=data.get("bom_cells", [])
        )
    
    @classmethod
    def _calculate_cell(cls, waypoint_data: Dict[str, Any]) -> str:
        """Calculate BOM cell from lat/lon if not provided."""
        lat = waypoint_data.get("lat", 0)
        lon = waypoint_data.get("lon", 0)
        row, col = BOMGridConfig.lat_lon_to_cell(lat, lon)
        return BOMGridConfig.cell_to_string(row, col)
    
    @classmethod
    def list_routes(cls) -> List[str]:
        """List available route IDs."""
        routes = []
        if ROUTES_DIR.exists():
            for path in ROUTES_DIR.glob("*.json"):
                routes.append(path.stem)
        return routes
    
    @classmethod
    def clear_cache(cls):
        """Clear route cache."""
        cls._cache.clear()


def get_route(route_id: str) -> Optional[Route]:
    """Convenience function to get a route."""
    return RouteLoader.load(route_id)

# =============================================================================

# =============================================================================
# V3.0 ROUTES ADDITIONS - Add to end of routes.py
# =============================================================================

# Peak code to info mapping (fallback when route not loaded)
# From THUNDERBIRD_SPEC_v3.1 Section 7.5
KNOWN_PEAKS = {
    # Overland Track (OL)
    "CRADL": {"name": "Cradle Mountain", "elevation": 1545},
    "MARIO": {"name": "Marions Lookout", "elevation": 1224},
    "BARNB": {"name": "Barn Bluff", "elevation": 1559},
    "OAKLE": {"name": "Mt Oakleigh", "elevation": 1286},
    "PELIOW": {"name": "Mt Pelion West", "elevation": 1560},
    "PELIOE": {"name": "Mt Pelion East", "elevation": 1461},
    "OSSA": {"name": "Mt Ossa", "elevation": 1617},
    "ACROP": {"name": "The Acropolis", "elevation": 1471},
    "LABYR": {"name": "Labyrinth Lookout", "elevation": 1202},
    
    # Western Arthurs A-K
    "HESPE": {"name": "Mt Hesperus", "elevation": 1098},
    "PROCY": {"name": "Procyon Peak", "elevation": 1136},
    "PRIOR": {"name": "Mt Prior", "elevation": 1070},
    "CAPRI": {"name": "Mt Capricorn", "elevation": 1037},
    "TAURA": {"name": "Mt Taurus", "elevation": 1011},
    "SCORP": {"name": "Mt Scorpio", "elevation": 1106},
    
    # Western Arthurs Full (additional)
    "SIRIU": {"name": "Mt Sirius", "elevation": 1151},
    "ORION": {"name": "Mt Orion", "elevation": 1151},
    "PEGAU": {"name": "Mt Pegasus", "elevation": 1063},
    "ALDEB": {"name": "Mt Aldebaran", "elevation": 1107},
    "WESTP": {"name": "West Portal", "elevation": 1181},
    
    # Federation Peak
    "FEDER": {"name": "Federation Peak", "elevation": 1225},
    
    # Eastern Arthurs
    "NEEDL": {"name": "The Needles", "elevation": 1080},
    "EASTP": {"name": "East Portal", "elevation": 1008},
    "DIALT": {"name": "The Dial", "elevation": 1083},
    "DEVIL": {"name": "Devils Thumb", "elevation": 1050},
}

def validate_camp_code(code: str) -> bool:
    """
    Check if camp code is valid (case-insensitive).
    v3.0 requirement.
    """
    code_upper = code.upper()
    for route_id in RouteLoader.list_routes():
        route = RouteLoader.load(route_id)
        if route:
            for camp in route.camps:
                if camp.code.upper() == code_upper:
                    return True
    return False


def validate_peak_code(code: str) -> bool:
    """
    Check if peak code is valid (case-insensitive).
    v3.0 requirement.
    
    Checks both loaded routes and known peaks fallback.
    """
    code_upper = code.upper()
    
    # Check known peaks first
    if code_upper in KNOWN_PEAKS:
        return True
    
    # Check loaded routes
    for route_id in RouteLoader.list_routes():
        route = RouteLoader.load(route_id)
        if route:
            for peak in route.peaks:
                if peak.code.upper() == code_upper:
                    return True
    return False


def get_peak_full_name(code: str) -> str:
    """
    Get full name for peak code.
    v3.0 requirement.
    """
    code_upper = code.upper()
    
    # Check known peaks first
    if code_upper in KNOWN_PEAKS:
        return KNOWN_PEAKS[code_upper]["name"]
    
    # Check loaded routes
    for route_id in RouteLoader.list_routes():
        route = RouteLoader.load(route_id)
        if route:
            for peak in route.peaks:
                if peak.code.upper() == code_upper:
                    return peak.name
    return code


def get_peak_display(code: str) -> str:
    """
    Get peak display with name and elevation.
    v3.0: Shows full name + elevation for onboarding.
    """
    code_upper = code.upper()
    
    # Check known peaks first
    if code_upper in KNOWN_PEAKS:
        info = KNOWN_PEAKS[code_upper]
        return f"{info['name']} ({info['elevation']}m)"
    
    # Check loaded routes
    for route_id in RouteLoader.list_routes():
        route = RouteLoader.load(route_id)
        if route:
            for peak in route.peaks:
                if peak.code.upper() == code_upper:
                    return f"{peak.name} ({peak.elevation}m)"
    return code


def get_peak_elevation(code: str) -> int:
    """
    Get elevation for peak code.
    Returns 0 if not found.
    """
    code_upper = code.upper()
    
    # Check known peaks first
    if code_upper in KNOWN_PEAKS:
        return KNOWN_PEAKS[code_upper]["elevation"]
    
    # Check loaded routes
    for route_id in RouteLoader.list_routes():
        route = RouteLoader.load(route_id)
        if route:
            for peak in route.peaks:
                if peak.code.upper() == code_upper:
                    return peak.elevation
    return 0


def get_camp_display(code: str) -> str:
    """
    Get camp display with name and elevation.
    """
    code_upper = code.upper()
    for route_id in RouteLoader.list_routes():
        route = RouteLoader.load(route_id)
        if route:
            for camp in route.camps:
                if camp.code.upper() == code_upper:
                    return f"{camp.name} ({camp.elevation}m)"
    return code


# =============================================================================
# PEAK GROUPING BY BOM CELL
# =============================================================================

@dataclass
class PeakGroup:
    """Group of peaks sharing the same BOM cell (same weather forecast)."""
    cell_id: str
    primary_peak: Waypoint  # Highest peak in the group
    other_peaks: List[Waypoint]  # Other peaks in same cell

    @property
    def all_peaks(self) -> List[Waypoint]:
        """All peaks in group, primary first."""
        return [self.primary_peak] + self.other_peaks

    @property
    def count(self) -> int:
        """Total peaks in group."""
        return 1 + len(self.other_peaks)

    def display_short(self) -> str:
        """Short display for onboarding: 'WESTP = West Portal (1181m) +3'"""
        p = self.primary_peak
        if self.other_peaks:
            return f"{p.code} = {p.name} ({p.elevation}m) +{len(self.other_peaks)}"
        else:
            return f"{p.code} = {p.name} ({p.elevation}m)"

    def other_peaks_text(self) -> str:
        """Text listing other peaks: 'Mt Canopus, Centaurus Ridge, Crags of Andromeda'"""
        return ", ".join(p.name for p in self.other_peaks)


def get_peak_groups(route: Route) -> List[PeakGroup]:
    """
    Group peaks by BOM cell, with highest peak as primary.

    Returns list of PeakGroup sorted by primary peak elevation (highest first).
    """
    from collections import defaultdict

    # Group peaks by cell
    cells: Dict[str, List[Waypoint]] = defaultdict(list)
    for peak in route.peaks:
        cells[peak.bom_cell].append(peak)

    # Create PeakGroup for each cell
    groups = []
    for cell_id, peaks in cells.items():
        # Sort by elevation descending
        peaks_sorted = sorted(peaks, key=lambda p: p.elevation, reverse=True)
        primary = peaks_sorted[0]
        others = peaks_sorted[1:]
        groups.append(PeakGroup(
            cell_id=cell_id,
            primary_peak=primary,
            other_peaks=others
        ))

    # Sort groups by primary peak elevation (highest first)
    groups.sort(key=lambda g: g.primary_peak.elevation, reverse=True)

    return groups


def get_peak_group_for_code(route: Route, peak_code: str) -> Optional[PeakGroup]:
    """
    Get the PeakGroup containing a specific peak code.
    Useful for CAST command to show "Also covers: ..." message.
    """
    peak_code_upper = peak_code.upper()
    groups = get_peak_groups(route)

    for group in groups:
        for peak in group.all_peaks:
            if peak.code.upper() == peak_code_upper:
                return group
    return None


def get_other_peaks_in_cell(route: Route, peak_code: str) -> List[Waypoint]:
    """
    Get other peaks in the same BOM cell as the given peak.
    Returns empty list if peak not found or is the only peak in cell.
    """
    group = get_peak_group_for_code(route, peak_code)
    if not group:
        return []

    peak_code_upper = peak_code.upper()
    return [p for p in group.all_peaks if p.code.upper() != peak_code_upper]
