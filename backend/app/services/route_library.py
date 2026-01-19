"""
Route Library Service.

ROUT-10: Route library displays admin-uploaded popular trails
ROUT-11: User can clone and customize library routes
"""
import re
from typing import List, Optional
from dataclasses import dataclass

from app.models.custom_route import (
    RouteLibraryStore,
    CustomRouteStore,
    CustomWaypointStore,
    RouteLibrary,
    CustomRoute,
    WaypointType
)


@dataclass
class LibraryRouteDetail:
    """Library route with all details for display."""
    id: int
    name: str
    description: str
    country: str
    region: str
    difficulty_grade: int
    distance_km: float
    typical_days: str
    waypoint_preview: List[dict]  # First few waypoints for preview
    track_geojson: Optional[dict]


class RouteLibraryService:
    """Service for route library operations."""

    def __init__(self):
        self.library_store = RouteLibraryStore()
        self.route_store = CustomRouteStore()
        self.waypoint_store = CustomWaypointStore()

    def list_active_routes(self, country: Optional[str] = None) -> List[RouteLibrary]:
        """
        Get all active library routes, optionally filtered by country.
        """
        routes = self.library_store.list_active()
        if country:
            routes = [r for r in routes if r.country == country]
        return routes

    def get_route_detail(self, library_id: int) -> Optional[LibraryRouteDetail]:
        """
        Get detailed library route info for display.
        """
        route = self.library_store.get_by_id(library_id)
        if not route:
            return None

        # Extract waypoint preview from GPX data
        waypoint_preview = []
        if route.gpx_data and 'waypoints' in route.gpx_data:
            waypoint_preview = route.gpx_data['waypoints'][:5]  # First 5 waypoints

        # Extract track GeoJSON
        track_geojson = None
        if route.gpx_data and 'track_geojson' in route.gpx_data:
            track_geojson = route.gpx_data['track_geojson']

        return LibraryRouteDetail(
            id=route.id,
            name=route.name,
            description=route.description or '',
            country=route.country or '',
            region=route.region or '',
            difficulty_grade=route.difficulty_grade or 3,
            distance_km=route.distance_km or 0,
            typical_days=route.typical_days or '',
            waypoint_preview=waypoint_preview,
            track_geojson=track_geojson
        )

    def clone_to_account(self, library_id: int, account_id: int) -> Optional[CustomRoute]:
        """
        Clone a library route to user's account.

        Creates a new draft route with:
        - Copied GPX data
        - Copied waypoints (with new unique SMS codes)
        - is_library_clone = True
        - source_library_id set

        ROUT-11: User can clone and customize library routes
        """
        library_route = self.library_store.get_by_id(library_id)
        if not library_route:
            return None

        # Create the cloned route
        route = self.route_store.create(
            account_id=account_id,
            name=f"{library_route.name} (Copy)",
            gpx_data=library_route.gpx_data,
            is_library_clone=True,
            source_library_id=library_id
        )

        # Clone waypoints if they exist in GPX data
        if library_route.gpx_data and 'waypoints' in library_route.gpx_data:
            existing_codes = set()
            for i, wp_data in enumerate(library_route.gpx_data['waypoints']):
                # Generate unique SMS code for each waypoint
                sms_code = self._generate_sms_code(wp_data.get('name', f'WP{i+1}'), existing_codes)
                existing_codes.add(sms_code)

                self.waypoint_store.create(
                    route_id=route.id,
                    name=wp_data.get('name', f'Waypoint {i+1}'),
                    waypoint_type=WaypointType.POI,  # Default type, user can change
                    lat=wp_data.get('lat', 0),
                    lng=wp_data.get('lng', 0),
                    elevation=wp_data.get('elevation', 0),
                    sms_code=sms_code,
                    order_index=i
                )

        return route

    def _generate_sms_code(self, name: str, existing_codes: set) -> str:
        """Generate unique SMS code (same logic as route_builder)."""
        cleaned = re.sub(r'^(Mt\.?|Mount|Lake|The|Camp|Point|Peak)\s+', '', name, flags=re.IGNORECASE)
        cleaned = re.sub(r'[^A-Za-z]', '', cleaned).upper()
        base_code = cleaned[:5].ljust(5, 'X')

        code = base_code
        suffix = 1
        reserved = {'HELP', 'STOP', 'START', 'CAST', 'CHECK', 'ALERT'}

        while code in existing_codes or code in reserved or self.waypoint_store.check_sms_code_exists(code):
            if suffix <= 9:
                code = base_code[:4] + str(suffix)
            else:
                code = base_code[:3] + str(suffix)
            suffix += 1

        return code


# Singleton
_route_library_service: Optional[RouteLibraryService] = None


def get_route_library_service() -> RouteLibraryService:
    global _route_library_service
    if _route_library_service is None:
        _route_library_service = RouteLibraryService()
    return _route_library_service
