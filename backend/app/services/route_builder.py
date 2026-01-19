"""
Route builder service for custom route creation.

Phase 3 will implement:
- ROUT-01: GPX upload
- ROUT-03: Waypoint pin placement
- ROUT-05: Waypoint naming with SMS code generation
- ROUT-09: Draft route saving
"""
from typing import Optional, List
from dataclasses import dataclass, field


@dataclass
class CustomWaypoint:
    """A user-defined waypoint on a custom route."""
    id: Optional[int] = None
    name: str = ""
    sms_code: str = ""
    lat: float = 0.0
    lng: float = 0.0
    elevation: float = 0.0
    waypoint_type: str = "poi"  # camp, peak, poi


@dataclass
class CustomRoute:
    """A user-created custom route."""
    id: Optional[int] = None
    account_id: int = 0
    name: str = ""
    waypoints: List[CustomWaypoint] = field(default_factory=list)
    status: str = "draft"
    gpx_source: Optional[str] = None
    total_distance_km: float = 0.0


class RouteBuilderService:
    """
    Route builder service stub.

    Will handle GPX parsing, waypoint management,
    and route persistence in Phase 3.
    """

    def __init__(self):
        pass

    async def parse_gpx(self, gpx_content: bytes) -> CustomRoute:
        """Parse GPX file content. Stub for Phase 3."""
        raise NotImplementedError("Implemented in Phase 3")

    async def save_draft(self, route: CustomRoute) -> CustomRoute:
        """Save route as draft. Stub for Phase 3."""
        raise NotImplementedError("Implemented in Phase 3")

    async def generate_sms_code(self, waypoint_name: str) -> str:
        """Generate unique 5-char SMS code for waypoint. Stub for Phase 3."""
        raise NotImplementedError("Implemented in Phase 3")

    async def add_waypoint(self, route_id: int, waypoint: CustomWaypoint) -> CustomWaypoint:
        """Add waypoint to route. Stub for Phase 3."""
        raise NotImplementedError("Implemented in Phase 3")

    async def remove_waypoint(self, route_id: int, waypoint_id: int) -> bool:
        """Remove waypoint from route. Stub for Phase 3."""
        raise NotImplementedError("Implemented in Phase 3")

    async def publish_route(self, route_id: int) -> CustomRoute:
        """Publish draft route for use. Stub for Phase 3."""
        raise NotImplementedError("Implemented in Phase 3")


_route_builder_service: Optional[RouteBuilderService] = None


def get_route_builder_service() -> RouteBuilderService:
    """Get singleton route builder service instance."""
    global _route_builder_service
    if _route_builder_service is None:
        _route_builder_service = RouteBuilderService()
    return _route_builder_service
