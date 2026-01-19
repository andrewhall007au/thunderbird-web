"""
Route builder API endpoints.

ROUT-01: GPX upload
ROUT-05, ROUT-06: Waypoint naming with SMS code generation
ROUT-09: Save draft routes
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional, List

from app.services.route_builder import get_route_builder_service
from app.services.auth import get_current_account
from app.models.account import Account
from app.models.custom_route import RouteStatus, WaypointType


router = APIRouter(prefix="/api/routes", tags=["routes"])


# ============================================================================
# Request/Response Models
# ============================================================================

class WaypointResponse(BaseModel):
    """Waypoint data in API responses."""
    id: int
    name: str
    type: str
    sms_code: str
    lat: float
    lng: float
    elevation: float
    order_index: int


class RouteResponse(BaseModel):
    """Route summary in API responses."""
    id: int
    name: str
    status: str
    waypoint_count: int
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class RouteDetailResponse(BaseModel):
    """Full route detail including waypoints."""
    id: int
    name: str
    status: str
    gpx_data: Optional[dict] = None
    waypoints: List[WaypointResponse]
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class GPXUploadResponse(BaseModel):
    """Response from GPX file upload (preview, not saved)."""
    track_geojson: dict
    waypoints: List[dict]
    metadata: dict


class CreateRouteRequest(BaseModel):
    """Request to create a new route."""
    name: str
    gpx_data: Optional[dict] = None


class UpdateRouteRequest(BaseModel):
    """Request to update a route."""
    name: Optional[str] = None
    status: Optional[str] = None


class CreateWaypointRequest(BaseModel):
    """Request to add a waypoint."""
    name: str
    type: str = "poi"  # camp, peak, poi
    lat: float
    lng: float
    elevation: float = 0.0


class UpdateWaypointRequest(BaseModel):
    """Request to update a waypoint."""
    name: Optional[str] = None
    type: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    elevation: Optional[float] = None


class ReorderWaypointsRequest(BaseModel):
    """Request to reorder waypoints."""
    waypoint_ids: List[int]


class SuccessResponse(BaseModel):
    """Generic success response."""
    success: bool


# ============================================================================
# Helper Functions
# ============================================================================

def waypoint_to_response(wp) -> WaypointResponse:
    """Convert CustomWaypoint to API response."""
    return WaypointResponse(
        id=wp.id,
        name=wp.name,
        type=wp.type.value if hasattr(wp.type, 'value') else str(wp.type),
        sms_code=wp.sms_code,
        lat=wp.lat,
        lng=wp.lng,
        elevation=wp.elevation,
        order_index=wp.order_index
    )


def route_to_response(route, waypoint_count: int = 0) -> RouteResponse:
    """Convert CustomRoute to API response."""
    return RouteResponse(
        id=route.id,
        name=route.name,
        status=route.status.value if hasattr(route.status, 'value') else str(route.status),
        waypoint_count=waypoint_count,
        created_at=route.created_at.isoformat() if route.created_at else None,
        updated_at=route.updated_at.isoformat() if route.updated_at else None
    )


def route_to_detail_response(route, waypoints: List) -> RouteDetailResponse:
    """Convert CustomRoute with waypoints to API response."""
    return RouteDetailResponse(
        id=route.id,
        name=route.name,
        status=route.status.value if hasattr(route.status, 'value') else str(route.status),
        gpx_data=route.gpx_data,
        waypoints=[waypoint_to_response(wp) for wp in waypoints],
        created_at=route.created_at.isoformat() if route.created_at else None,
        updated_at=route.updated_at.isoformat() if route.updated_at else None
    )


# ============================================================================
# GPX Upload Endpoint
# ============================================================================

@router.post("/upload-gpx", response_model=GPXUploadResponse)
async def upload_gpx(
    file: UploadFile = File(...),
    account: Account = Depends(get_current_account)
):
    """
    Upload and parse a GPX file (preview only, not saved).

    Returns parsed track as GeoJSON, extracted waypoints, and metadata.
    Use the returned data to create a route with POST /api/routes.

    ROUT-01: GPX upload
    """
    # Validate file type
    if file.content_type and 'xml' not in file.content_type and 'gpx' not in file.content_type:
        # Be lenient - some clients don't set content-type correctly
        pass

    # Read file content
    content = await file.read()

    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    # Parse GPX
    service = get_route_builder_service()
    try:
        parsed = await service.parse_gpx(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid GPX file: {str(e)}")

    return GPXUploadResponse(
        track_geojson=parsed['track_geojson'],
        waypoints=parsed['waypoints'],
        metadata=parsed['metadata']
    )


# ============================================================================
# Route CRUD Endpoints
# ============================================================================

@router.post("", response_model=RouteResponse)
async def create_route(
    request: CreateRouteRequest,
    account: Account = Depends(get_current_account)
):
    """
    Create a new custom route.

    ROUT-09: Save draft routes
    """
    service = get_route_builder_service()
    route = await service.create_route(
        account_id=account.id,
        name=request.name,
        gpx_data=request.gpx_data
    )

    return route_to_response(route, waypoint_count=0)


@router.get("", response_model=List[RouteResponse])
async def list_routes(account: Account = Depends(get_current_account)):
    """
    List all routes for the current account.
    """
    service = get_route_builder_service()
    routes = await service.get_routes_by_account(account.id)

    # Get waypoint counts for each route
    responses = []
    for route in routes:
        waypoints = service.waypoint_store.get_by_route_id(route.id)
        responses.append(route_to_response(route, waypoint_count=len(waypoints)))

    return responses


@router.get("/{route_id}", response_model=RouteDetailResponse)
async def get_route(
    route_id: int,
    account: Account = Depends(get_current_account)
):
    """
    Get route details including waypoints.
    """
    service = get_route_builder_service()
    route = await service.get_route(route_id, account.id)

    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    waypoints = await service.get_waypoints_for_route(route_id, account.id)

    return route_to_detail_response(route, waypoints or [])


@router.patch("/{route_id}", response_model=RouteResponse)
async def update_route(
    route_id: int,
    request: UpdateRouteRequest,
    account: Account = Depends(get_current_account)
):
    """
    Update a route.
    """
    service = get_route_builder_service()

    # Validate status if provided
    status = None
    if request.status:
        try:
            status = RouteStatus(request.status)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status: {request.status}. Must be one of: draft, active, archived"
            )

    route = await service.update_route(
        route_id=route_id,
        account_id=account.id,
        name=request.name,
        status=status
    )

    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    waypoints = service.waypoint_store.get_by_route_id(route.id)
    return route_to_response(route, waypoint_count=len(waypoints))


@router.delete("/{route_id}", response_model=SuccessResponse)
async def delete_route(
    route_id: int,
    account: Account = Depends(get_current_account)
):
    """
    Delete a route and all its waypoints.
    """
    service = get_route_builder_service()
    deleted = await service.delete_route(route_id, account.id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Route not found")

    return SuccessResponse(success=True)


# ============================================================================
# Waypoint Endpoints
# ============================================================================

@router.post("/{route_id}/waypoints", response_model=WaypointResponse)
async def add_waypoint(
    route_id: int,
    request: CreateWaypointRequest,
    account: Account = Depends(get_current_account)
):
    """
    Add a waypoint to a route.

    Automatically generates a unique SMS code based on the waypoint name.

    ROUT-05, ROUT-06: Waypoint naming with SMS code generation
    """
    service = get_route_builder_service()

    # Validate waypoint type
    try:
        waypoint_type = WaypointType(request.type)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid type: {request.type}. Must be one of: camp, peak, poi"
        )

    waypoint = await service.add_waypoint(
        route_id=route_id,
        account_id=account.id,
        name=request.name,
        lat=request.lat,
        lng=request.lng,
        waypoint_type=waypoint_type,
        elevation=request.elevation
    )

    if not waypoint:
        raise HTTPException(status_code=404, detail="Route not found")

    return waypoint_to_response(waypoint)


@router.patch("/{route_id}/waypoints/{waypoint_id}", response_model=WaypointResponse)
async def update_waypoint(
    route_id: int,
    waypoint_id: int,
    request: UpdateWaypointRequest,
    account: Account = Depends(get_current_account)
):
    """
    Update a waypoint.

    Note: SMS code cannot be changed. Delete and recreate to change the code.
    """
    service = get_route_builder_service()

    # Validate waypoint type if provided
    waypoint_type = None
    if request.type:
        try:
            waypoint_type = WaypointType(request.type)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid type: {request.type}. Must be one of: camp, peak, poi"
            )

    waypoint = await service.update_waypoint(
        waypoint_id=waypoint_id,
        account_id=account.id,
        name=request.name,
        waypoint_type=waypoint_type,
        lat=request.lat,
        lng=request.lng,
        elevation=request.elevation
    )

    if not waypoint:
        raise HTTPException(status_code=404, detail="Waypoint not found")

    return waypoint_to_response(waypoint)


@router.delete("/{route_id}/waypoints/{waypoint_id}", response_model=SuccessResponse)
async def delete_waypoint(
    route_id: int,
    waypoint_id: int,
    account: Account = Depends(get_current_account)
):
    """
    Delete a waypoint from a route.
    """
    service = get_route_builder_service()
    deleted = await service.delete_waypoint(waypoint_id, account.id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Waypoint not found")

    return SuccessResponse(success=True)


@router.post("/{route_id}/waypoints/reorder", response_model=List[WaypointResponse])
async def reorder_waypoints(
    route_id: int,
    request: ReorderWaypointsRequest,
    account: Account = Depends(get_current_account)
):
    """
    Reorder waypoints in a route.

    Provide the list of waypoint IDs in the desired order.
    """
    service = get_route_builder_service()

    success = await service.reorder_waypoints(
        route_id=route_id,
        account_id=account.id,
        waypoint_ids=request.waypoint_ids
    )

    if not success:
        raise HTTPException(status_code=404, detail="Route not found or invalid waypoint IDs")

    # Return updated waypoints
    waypoints = await service.get_waypoints_for_route(route_id, account.id)
    return [waypoint_to_response(wp) for wp in waypoints] if waypoints else []
