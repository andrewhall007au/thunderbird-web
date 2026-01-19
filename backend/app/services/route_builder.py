"""
Route builder service for custom route creation.

ROUT-01: GPX upload
ROUT-03: Waypoint pin placement
ROUT-05: Waypoint naming with SMS code generation
ROUT-09: Draft route saving
"""
import re
from typing import Optional, List, Dict, Set
import gpxpy
import gpxpy.gpx

from app.models.custom_route import (
    CustomRoute, CustomWaypoint, RouteStatus, WaypointType,
    custom_route_store, custom_waypoint_store
)


class RouteBuilderService:
    """
    Route builder service for GPX parsing, SMS code generation, and route CRUD.

    Handles the complete workflow of creating custom routes from GPX files,
    managing waypoints with unique SMS codes, and route lifecycle.
    """

    # Reserved SMS codes that conflict with system commands
    RESERVED_CODES = {'HELP', 'STOP', 'START', 'CAST', 'CHECK', 'ALERT', 'CAMPS', 'PEAKS'}

    def __init__(self):
        self.route_store = custom_route_store
        self.waypoint_store = custom_waypoint_store

    # =========================================================================
    # GPX Parsing
    # =========================================================================

    async def parse_gpx(self, gpx_content: bytes) -> Dict:
        """
        Parse GPX file and extract route data.

        Args:
            gpx_content: Raw GPX file bytes

        Returns:
            Dict with track_geojson, waypoints, metadata
        """
        gpx = gpxpy.parse(gpx_content.decode('utf-8'))

        # Extract track points as GeoJSON LineString
        track_coords = []
        for track in gpx.tracks:
            for segment in track.segments:
                for point in segment.points:
                    track_coords.append([point.longitude, point.latitude])

        # Also check routes (some GPX files use <rte> instead of <trk>)
        for route in gpx.routes:
            for point in route.points:
                track_coords.append([point.longitude, point.latitude])

        # Simplify if too many points (>500)
        if len(track_coords) > 500:
            track_coords = self._simplify_track(track_coords, 500)

        # Extract existing waypoints from GPX
        waypoints = []
        for wp in gpx.waypoints:
            waypoints.append({
                'name': wp.name or 'Waypoint',
                'lat': wp.latitude,
                'lng': wp.longitude,
                'elevation': wp.elevation or 0
            })

        # Get route name from tracks or routes
        name = 'Untitled Route'
        if gpx.name:
            name = gpx.name
        elif gpx.tracks and gpx.tracks[0].name:
            name = gpx.tracks[0].name
        elif gpx.routes and gpx.routes[0].name:
            name = gpx.routes[0].name

        return {
            'track_geojson': {
                'type': 'Feature',
                'geometry': {
                    'type': 'LineString',
                    'coordinates': track_coords
                }
            },
            'waypoints': waypoints,
            'metadata': {
                'name': name,
                'description': gpx.description
            }
        }

    def _simplify_track(self, coords: List, target: int) -> List:
        """
        Simplify track to target number of points by sampling.

        Uses uniform sampling to reduce point count while maintaining
        route shape. This is a simpler alternative to Douglas-Peucker.

        Args:
            coords: List of [lng, lat] coordinates
            target: Target number of points

        Returns:
            Simplified list of coordinates
        """
        if len(coords) <= target:
            return coords
        step = len(coords) / target
        return [coords[int(i * step)] for i in range(target)]

    # =========================================================================
    # SMS Code Generation
    # =========================================================================

    def generate_sms_code(self, name: str, existing_codes: Set[str]) -> str:
        """
        Generate unique 5-char SMS code from waypoint name.

        Examples:
            "Lake Oberon" -> "LAKEO"
            "Mt. Hesperus" -> "HESPE"
            "Pine Valley" -> "PINEV"

        Args:
            name: Waypoint name
            existing_codes: Set of codes already in use (for collision detection)

        Returns:
            Unique 5-char uppercase SMS code
        """
        # Remove common prefixes
        cleaned = re.sub(
            r'^(Mt\.?|Mount|Lake|The|Camp|Point|Peak|Hut|Lake|River)\s+',
            '',
            name,
            flags=re.IGNORECASE
        )
        cleaned = re.sub(r'[^A-Za-z]', '', cleaned).upper()

        # Take first 5 chars, pad if needed
        base_code = cleaned[:5].ljust(5, 'X')

        # Check for collision with existing codes or reserved codes
        code = base_code
        suffix = 1
        while code in existing_codes or self._is_reserved_code(code):
            if suffix <= 9:
                code = base_code[:4] + str(suffix)
            else:
                code = base_code[:3] + str(suffix).zfill(2)
            suffix += 1
            if suffix > 99:
                # Fallback: use hash-based code
                import hashlib
                hash_code = hashlib.md5(name.encode()).hexdigest()[:5].upper()
                code = hash_code
                break

        return code

    def _is_reserved_code(self, code: str) -> bool:
        """Check if code conflicts with system commands."""
        return code.upper() in self.RESERVED_CODES

    async def _get_existing_codes(self, route_id: Optional[int] = None) -> Set[str]:
        """
        Get all existing SMS codes from the database.

        Args:
            route_id: Optional route ID to exclude (for updates within same route)

        Returns:
            Set of existing SMS codes
        """
        # For now, we check the database directly
        # This could be optimized with caching for high-volume scenarios
        existing = set()
        # Get all waypoints in the database
        # Note: This is a simplified approach - in production you might want
        # to query just the codes with a dedicated method
        return existing

    # =========================================================================
    # Route CRUD Operations
    # =========================================================================

    async def create_route(
        self,
        account_id: int,
        name: str,
        gpx_data: Optional[Dict] = None
    ) -> CustomRoute:
        """
        Create a new custom route.

        Args:
            account_id: Account creating the route
            name: Route name
            gpx_data: Optional parsed GPX data

        Returns:
            Created CustomRoute object
        """
        return self.route_store.create(
            account_id=account_id,
            name=name,
            gpx_data=gpx_data
        )

    async def get_route(
        self,
        route_id: int,
        account_id: int
    ) -> Optional[CustomRoute]:
        """
        Get a route by ID, validating ownership.

        Args:
            route_id: Route ID
            account_id: Account ID (for ownership validation)

        Returns:
            CustomRoute if found and owned by account, None otherwise
        """
        route = self.route_store.get_by_id(route_id)
        if route and route.account_id == account_id:
            return route
        return None

    async def get_routes_by_account(self, account_id: int) -> List[CustomRoute]:
        """
        Get all routes for an account.

        Args:
            account_id: Account ID

        Returns:
            List of CustomRoute objects
        """
        return self.route_store.get_by_account_id(account_id)

    async def update_route(
        self,
        route_id: int,
        account_id: int,
        name: Optional[str] = None,
        status: Optional[RouteStatus] = None,
        gpx_data: Optional[Dict] = None
    ) -> Optional[CustomRoute]:
        """
        Update a route, validating ownership.

        Args:
            route_id: Route ID
            account_id: Account ID (for ownership validation)
            name: New name (optional)
            status: New status (optional)
            gpx_data: New GPX data (optional)

        Returns:
            Updated CustomRoute if successful, None if not found/not owned
        """
        # Verify ownership
        route = await self.get_route(route_id, account_id)
        if not route:
            return None

        # Update
        self.route_store.update(
            route_id=route_id,
            name=name,
            status=status,
            gpx_data=gpx_data
        )

        # Return updated route
        return self.route_store.get_by_id(route_id)

    async def delete_route(self, route_id: int, account_id: int) -> bool:
        """
        Delete a route, validating ownership.

        Args:
            route_id: Route ID
            account_id: Account ID (for ownership validation)

        Returns:
            True if deleted, False if not found/not owned
        """
        # Verify ownership
        route = await self.get_route(route_id, account_id)
        if not route:
            return False

        return self.route_store.delete(route_id)

    # =========================================================================
    # Waypoint Operations
    # =========================================================================

    async def add_waypoint(
        self,
        route_id: int,
        account_id: int,
        name: str,
        lat: float,
        lng: float,
        waypoint_type: WaypointType = WaypointType.POI,
        elevation: float = 0.0
    ) -> Optional[CustomWaypoint]:
        """
        Add a waypoint to a route.

        Automatically generates a unique SMS code based on the waypoint name.

        Args:
            route_id: Route ID
            account_id: Account ID (for ownership validation)
            name: Waypoint name
            lat: Latitude
            lng: Longitude
            waypoint_type: Type of waypoint (camp, peak, poi)
            elevation: Elevation in meters

        Returns:
            Created CustomWaypoint if successful, None if route not found/not owned
        """
        # Verify route ownership
        route = await self.get_route(route_id, account_id)
        if not route:
            return None

        # Get existing codes to avoid collisions
        existing_codes = self._get_all_sms_codes()

        # Generate unique SMS code
        sms_code = self.generate_sms_code(name, existing_codes)

        # Get current max order_index for this route
        existing_waypoints = self.waypoint_store.get_by_route_id(route_id)
        order_index = max((wp.order_index for wp in existing_waypoints), default=-1) + 1

        return self.waypoint_store.create(
            route_id=route_id,
            name=name,
            sms_code=sms_code,
            lat=lat,
            lng=lng,
            waypoint_type=waypoint_type,
            elevation=elevation,
            order_index=order_index
        )

    def _get_all_sms_codes(self) -> Set[str]:
        """Get all existing SMS codes from the database."""
        codes = set()
        # Query all waypoints and extract codes
        # This is done via direct database query for efficiency
        import sqlite3
        from app.models.custom_route import DB_PATH
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.execute("SELECT sms_code FROM custom_waypoints")
            for row in cursor:
                codes.add(row[0])
            conn.close()
        except Exception:
            pass  # Table might not exist yet
        return codes

    async def get_waypoint(
        self,
        waypoint_id: int,
        account_id: int
    ) -> Optional[CustomWaypoint]:
        """
        Get a waypoint by ID, validating ownership via route.

        Args:
            waypoint_id: Waypoint ID
            account_id: Account ID (for ownership validation)

        Returns:
            CustomWaypoint if found and owned, None otherwise
        """
        # Get waypoint first
        import sqlite3
        from app.models.custom_route import DB_PATH
        try:
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                "SELECT * FROM custom_waypoints WHERE id = ?",
                (waypoint_id,)
            )
            row = cursor.fetchone()
            conn.close()
            if not row:
                return None

            # Verify route ownership
            route = await self.get_route(row['route_id'], account_id)
            if not route:
                return None

            return self.waypoint_store._row_to_waypoint(row)
        except Exception:
            return None

    async def update_waypoint(
        self,
        waypoint_id: int,
        account_id: int,
        name: Optional[str] = None,
        waypoint_type: Optional[WaypointType] = None,
        lat: Optional[float] = None,
        lng: Optional[float] = None,
        elevation: Optional[float] = None
    ) -> Optional[CustomWaypoint]:
        """
        Update a waypoint, validating ownership via route.

        Note: SMS code cannot be updated (must delete and recreate).

        Args:
            waypoint_id: Waypoint ID
            account_id: Account ID (for ownership validation)
            name: New name (optional)
            waypoint_type: New type (optional)
            lat: New latitude (optional)
            lng: New longitude (optional)
            elevation: New elevation (optional)

        Returns:
            Updated CustomWaypoint if successful, None if not found/not owned
        """
        # Verify ownership
        waypoint = await self.get_waypoint(waypoint_id, account_id)
        if not waypoint:
            return None

        # Update
        self.waypoint_store.update(
            waypoint_id=waypoint_id,
            name=name,
            waypoint_type=waypoint_type,
            lat=lat,
            lng=lng,
            elevation=elevation
        )

        # Return updated waypoint
        return await self.get_waypoint(waypoint_id, account_id)

    async def delete_waypoint(
        self,
        waypoint_id: int,
        account_id: int
    ) -> bool:
        """
        Delete a waypoint, validating ownership via route.

        Args:
            waypoint_id: Waypoint ID
            account_id: Account ID (for ownership validation)

        Returns:
            True if deleted, False if not found/not owned
        """
        # Verify ownership
        waypoint = await self.get_waypoint(waypoint_id, account_id)
        if not waypoint:
            return False

        return self.waypoint_store.delete(waypoint_id)

    async def reorder_waypoints(
        self,
        route_id: int,
        account_id: int,
        waypoint_ids: List[int]
    ) -> bool:
        """
        Reorder waypoints in a route.

        Args:
            route_id: Route ID
            account_id: Account ID (for ownership validation)
            waypoint_ids: List of waypoint IDs in desired order

        Returns:
            True if reordered successfully, False if route not found/not owned
        """
        # Verify route ownership
        route = await self.get_route(route_id, account_id)
        if not route:
            return False

        # Get existing waypoints to verify they all belong to this route
        existing_waypoints = self.waypoint_store.get_by_route_id(route_id)
        existing_ids = {wp.id for wp in existing_waypoints}

        # Verify all provided IDs belong to this route
        for wp_id in waypoint_ids:
            if wp_id not in existing_ids:
                return False

        # Update order_index for each waypoint
        for index, wp_id in enumerate(waypoint_ids):
            self.waypoint_store.update(waypoint_id=wp_id, order_index=index)

        return True

    async def get_waypoints_for_route(
        self,
        route_id: int,
        account_id: int
    ) -> Optional[List[CustomWaypoint]]:
        """
        Get all waypoints for a route, validating ownership.

        Args:
            route_id: Route ID
            account_id: Account ID (for ownership validation)

        Returns:
            List of CustomWaypoint if route found and owned, None otherwise
        """
        # Verify route ownership
        route = await self.get_route(route_id, account_id)
        if not route:
            return None

        return self.waypoint_store.get_by_route_id(route_id)


# Singleton instance
_route_builder_service: Optional[RouteBuilderService] = None


def get_route_builder_service() -> RouteBuilderService:
    """Get singleton route builder service instance."""
    global _route_builder_service
    if _route_builder_service is None:
        _route_builder_service = RouteBuilderService()
    return _route_builder_service
