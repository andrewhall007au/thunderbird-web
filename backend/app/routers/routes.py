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


# ============================================================================
# Forecast Preview Endpoint
# ============================================================================

class WaypointForForecast(BaseModel):
    """Waypoint data for multi-waypoint forecasts."""
    lat: float
    lng: float
    elevation: int
    name: str
    sms_code: str
    type: str  # camp, peak, poi


class ForecastPreviewRequest(BaseModel):
    """Request for forecast preview."""
    lat: float
    lng: float
    elevation: int
    name: str
    sms_code: str
    command: str  # CAST12, CAST24, CAMPS7, PEAKS7
    waypoints: Optional[List[WaypointForForecast]] = None  # For CAMPS7/PEAKS7


class ForecastPreviewResponse(BaseModel):
    """Formatted forecast preview."""
    sms_content: str
    source: str  # 'live' or 'sample'


@router.post("/forecast-preview", response_model=ForecastPreviewResponse)
async def get_forecast_preview(
    request: ForecastPreviewRequest,
    account: Account = Depends(get_current_account)
):
    """
    Get a formatted forecast preview for a waypoint.

    Returns the exact SMS content the user would receive.
    """
    from app.services.bom import get_bom_service
    from app.services.formatter import ForecastFormatter, LightCalculator
    from datetime import date

    bom = get_bom_service()
    formatter = ForecastFormatter()

    try:
        # Fetch real weather data
        if request.command == "CAST24":
            forecast = await bom.get_hourly_forecast(
                lat=request.lat,
                lon=request.lng,
                hours=24
            )
        else:
            forecast = await bom.get_hourly_forecast(
                lat=request.lat,
                lon=request.lng,
                hours=12
            )

        if not forecast or not forecast.periods:
            raise ValueError("No forecast data available")

        # Get light hours
        light_hours = LightCalculator.get_light_hours(
            request.lat, request.lng, date.today()
        )

        # Format based on command type
        if request.command == "CAST12":
            lines = [
                f"CAST12 {request.sms_code} {request.elevation}m",
                f"{request.lat:.4f}, {request.lng:.4f}",
                light_hours,
                "12 hour detailed forecast",
                ""
            ]

            # Add hourly forecasts (first 12 periods)
            for period in forecast.periods[:12]:
                formatted = formatter.format_period(
                    period=period,
                    day_number=period.datetime.day,
                    is_continuation=True,
                    target_elevation=request.elevation,
                    is_hourly=True,
                    base_elevation=forecast.base_elevation
                )
                hour = period.datetime.strftime("%Hh")
                line = f"{hour} {formatted.temp_range}° Rn{formatted.rain_pct} {formatted.rain_range}mm W{formatted.wind_avg}-{formatted.wind_max} Cld{formatted.cloud_pct} CB{formatted.cloud_base} FL{formatted.freeze_level}"
                if formatted.danger:
                    line += f" {formatted.danger}"
                lines.append(line)
                lines.append("")

            lines.append("Rn=Rain W=Wind Cld=Cloud")
            lines.append("CB=CloudBase FL=Freeze(x100m)")

            return ForecastPreviewResponse(
                sms_content="\n".join(lines),
                source="live"
            )

        elif request.command == "CAST24":
            lines = [
                f"CAST24 {request.sms_code} {request.elevation}m",
                f"{request.lat:.4f}, {request.lng:.4f}",
                light_hours,
                "24 hour detailed forecast",
                ""
            ]

            # Add hourly forecasts (first 24 periods)
            for period in forecast.periods[:24]:
                formatted = formatter.format_period(
                    period=period,
                    day_number=period.datetime.day,
                    is_continuation=True,
                    target_elevation=request.elevation,
                    is_hourly=True,
                    base_elevation=forecast.base_elevation
                )
                hour = period.datetime.strftime("%Hh")
                line = f"{hour} {formatted.temp_range}° Rn{formatted.rain_pct} {formatted.rain_range}mm W{formatted.wind_avg}-{formatted.wind_max} Cld{formatted.cloud_pct} CB{formatted.cloud_base} FL{formatted.freeze_level}"
                if formatted.danger:
                    line += f" {formatted.danger}"
                lines.append(line)
                lines.append("")

            lines.append("Rn=Rain W=Wind Cld=Cloud")
            lines.append("CB=CloudBase FL=Freeze(x100m)")

            return ForecastPreviewResponse(
                sms_content="\n".join(lines),
                source="live"
            )

        elif request.command in ("CAMPS7", "PEAKS7"):
            # Filter waypoints by type
            target_type = "camp" if request.command == "CAMPS7" else "peak"
            waypoints = [w for w in (request.waypoints or []) if w.type == target_type]

            if not waypoints:
                return ForecastPreviewResponse(
                    sms_content=f"{request.command}\n7-Day Forecast for All {target_type.title()}s\n\nNo {target_type}s defined",
                    source="sample"
                )

            # Build response for each waypoint
            waypoint_sections = []
            day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

            for wp in waypoints:
                # Fetch 7-day forecast for this waypoint
                wp_forecast = await bom.get_daily_forecast(
                    lat=wp.lat,
                    lon=wp.lng,
                    days=7
                )

                section_lines = [
                    f"{wp.sms_code}: {wp.name}",
                    f"{wp.lat:.4f}, {wp.lng:.4f}",
                    ""
                ]

                # Process daily forecast periods
                if wp_forecast and wp_forecast.periods:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.info(f"Waypoint {wp.name}: {len(wp_forecast.periods)} daily periods")

                    for period in wp_forecast.periods[:7]:  # Limit to 7 days
                        day_name = day_names[period.datetime.weekday()]

                        temp_min = period.temp_min
                        temp_max = period.temp_max
                        rain_pct = period.rain_chance
                        rain_min = period.rain_min
                        rain_max = period.rain_max
                        wind_avg = period.wind_avg
                        wind_max = period.wind_max
                        cloud_pct = period.cloud_cover
                        cloud_base = int(period.cloud_base / 100)  # Convert to x100m
                        freeze_level = int(period.freezing_level / 100)  # Convert to x100m

                        # Adjust temps for waypoint elevation
                        elev_diff = wp.elevation - wp_forecast.base_elevation
                        lapse_adjustment = (elev_diff / 100) * 0.65
                        temp_min = int(temp_min - lapse_adjustment)
                        temp_max = int(temp_max - lapse_adjustment)

                        section_lines.append(
                            f"{day_name} {temp_min}-{temp_max}° Rn{rain_pct}% {int(rain_min)}-{int(rain_max)}mm W{wind_avg}-{wind_max} Cld{cloud_pct}% CB{cloud_base} FL{freeze_level}"
                        )
                        section_lines.append("")  # Blank line between days

                waypoint_sections.append("\n".join(section_lines))

            # Combine all waypoint sections
            separator = "\n\n─────────────────\n\n"
            all_sections = separator.join(waypoint_sections)

            content = f"""{request.command}
7-Day Forecast for All {target_type.title()}s

{all_sections}

Rn=Rain W=Wind"""

            return ForecastPreviewResponse(
                sms_content=content,
                source="live"
            )

        else:
            raise HTTPException(status_code=400, detail=f"Unsupported command: {request.command}")

    except Exception as e:
        # Fall back to sample data if live fetch fails
        import logging
        logging.warning(f"Forecast preview failed, using sample: {e}")

        # Return sample data indicator
        raise HTTPException(
            status_code=503,
            detail="Weather service temporarily unavailable. Sample data shown in preview."
        )
