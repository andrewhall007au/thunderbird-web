"""
Route Library API endpoints.

ROUT-10: Browse library routes
ROUT-11: Clone library routes
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List

from app.services.route_library import get_route_library_service
from app.services.auth import get_current_account
from app.models.account import Account

router = APIRouter(prefix="/api/library", tags=["library"])


class LibraryRouteResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    country: Optional[str] = None
    region: Optional[str] = None
    difficulty_grade: Optional[int] = None
    distance_km: Optional[float] = None
    typical_days: Optional[str] = None


class LibraryRouteDetailResponse(LibraryRouteResponse):
    waypoint_preview: List[dict] = []
    track_geojson: Optional[dict] = None


class CloneResponse(BaseModel):
    success: bool
    route_id: int
    message: str


@router.get("", response_model=List[LibraryRouteResponse])
async def list_library_routes(
    country: Optional[str] = Query(None, description="Filter by country")
):
    """
    List all active library routes.
    No authentication required - public endpoint.
    """
    service = get_route_library_service()
    routes = service.list_active_routes(country=country)

    return [
        LibraryRouteResponse(
            id=r.id,
            name=r.name,
            description=r.description,
            country=r.country,
            region=r.region,
            difficulty_grade=r.difficulty_grade,
            distance_km=r.distance_km,
            typical_days=r.typical_days
        )
        for r in routes
    ]


@router.get("/{library_id}", response_model=LibraryRouteDetailResponse)
async def get_library_route(library_id: int):
    """
    Get detailed library route info including track preview.
    No authentication required - public endpoint.
    """
    service = get_route_library_service()
    detail = service.get_route_detail(library_id)

    if not detail:
        raise HTTPException(status_code=404, detail="Library route not found")

    return LibraryRouteDetailResponse(
        id=detail.id,
        name=detail.name,
        description=detail.description,
        country=detail.country,
        region=detail.region,
        difficulty_grade=detail.difficulty_grade,
        distance_km=detail.distance_km,
        typical_days=detail.typical_days,
        waypoint_preview=detail.waypoint_preview,
        track_geojson=detail.track_geojson
    )


@router.post("/{library_id}/clone", response_model=CloneResponse)
async def clone_library_route(
    library_id: int,
    account: Account = Depends(get_current_account)
):
    """
    Clone a library route to user's account.
    Creates a new draft route that the user can customize.
    """
    service = get_route_library_service()
    route = service.clone_to_account(library_id, account.id)

    if not route:
        raise HTTPException(status_code=404, detail="Library route not found")

    return CloneResponse(
        success=True,
        route_id=route.id,
        message=f"Route cloned successfully. Edit at /create?id={route.id}"
    )
