"""
Public API routes for route information and forecasts.
Based on THUNDERBIRD_SPEC_v2.4 Section 12.4
"""

import logging
from datetime import datetime, date
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config.settings import settings, TZ_HOBART, TZ_UTC
from app.services.sms import get_sms_service, PhoneUtils
from app.services.bom import get_bom_service
from app.services.routes import RouteLoader, get_route

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["api"])


# ============================================================================
# Health Check - Section 12.10.1
# ============================================================================

class HealthStatus(BaseModel):
    status: str
    timestamp: str
    services: dict
    version: str


@router.get("/health", response_model=HealthStatus)
async def health_check():
    """
    Health check endpoint.
    Returns service status for monitoring.
    """
    services = {
        "database": "ok",  # TODO: Check actual connection
        "redis": "ok",  # TODO: Check actual connection
        "bom_api": "ok",  # TODO: Check actual availability
        "twilio": "ok" if settings.TWILIO_ACCOUNT_SID else "not_configured"
    }

    # Overall status
    status = "ok" if all(v == "ok" for v in services.values()) else "degraded"

    return HealthStatus(
        status=status,
        timestamp=datetime.now(TZ_UTC).isoformat(),
        services=services,
        version=settings.APP_VERSION
    )


# ============================================================================
# Forecast API
# ============================================================================

class ForecastPushRequest(BaseModel):
    """Request to trigger forecast push."""
    forecast_type: str = "morning"  # "morning" or "evening"
    phone: Optional[str] = None  # If provided, push to single user


@router.post("/forecast/push")
async def trigger_forecast_push(request: ForecastPushRequest):
    """
    Trigger manual forecast push.

    - If phone provided: Push to that user only
    - If no phone: Push to all active users
    """
    from app.models.database import user_store

    if request.phone:
        # Push to single user
        try:
            normalized = PhoneUtils.normalize(request.phone)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid phone number")

        user = user_store.get_user(normalized)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        try:
            # Import from main module (scheduled jobs)
            from app.main import push_forecast_to_user
            await push_forecast_to_user(user, forecast_type=request.forecast_type)
            return {"status": "sent", "phone": PhoneUtils.mask(normalized), "type": request.forecast_type}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    else:
        # Push to all users
        from app.main import push_morning_forecasts, push_evening_forecasts
        if request.forecast_type == "morning":
            await push_morning_forecasts()
        else:
            await push_evening_forecasts()

        return {"status": "complete", "type": request.forecast_type}


@router.post("/forecast/test-push/{phone}")
async def test_push_to_user(phone: str, forecast_type: str = "morning"):
    """
    Quick test endpoint to push forecast to a specific phone.
    Use: POST /api/forecast/test-push/+61400123456?forecast_type=morning
    """
    from app.models.database import user_store

    try:
        normalized = PhoneUtils.normalize(phone)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid phone number")

    user = user_store.get_user(normalized)
    if not user:
        raise HTTPException(status_code=404, detail=f"User not found. Registered users: {len(user_store.list_users())}")

    try:
        from app.main import push_forecast_to_user
        await push_forecast_to_user(user, forecast_type=forecast_type)
        return {
            "status": "sent",
            "phone": PhoneUtils.mask(normalized),
            "position": user.current_position,
            "type": forecast_type
        }
    except Exception as e:
        logger.error(f"Test push failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# User API
# ============================================================================

class UserStatus(BaseModel):
    """User subscription status response."""
    phone: str
    route_id: str
    route_name: str
    current_position: Optional[str]
    current_day: int
    total_days: int
    status: str
    expires_at: str


@router.get("/user/{phone}/status", response_model=UserStatus)
async def get_user_status(phone: str):
    """Get user subscription status."""
    try:
        normalized = PhoneUtils.normalize(phone)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid phone number")

    # TODO: Fetch from database
    raise HTTPException(status_code=404, detail="User not found")


class PositionUpdate(BaseModel):
    """Position update request."""
    camp_code: str


@router.post("/user/{phone}/position")
async def update_user_position(phone: str, update: PositionUpdate):
    """Update user position manually."""
    try:
        normalized = PhoneUtils.normalize(phone)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid phone number")

    # TODO: Validate and update position
    return {"status": "updated", "position": update.camp_code}


# ============================================================================
# Route Information
# ============================================================================

class RouteCells(BaseModel):
    """Route BOM cells response."""
    route_id: str
    cells: list


@router.get("/route/{route_id}/cells", response_model=RouteCells)
async def get_route_cells(route_id: str):
    """Get all BOM cells for a route."""
    route = get_route(route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    return RouteCells(
        route_id=route_id,
        cells=route.bom_cells
    )


class CellForecastResponse(BaseModel):
    """Cell forecast response."""
    route_id: str
    cell_id: str
    forecast_date: str
    data: dict
    cached: bool
    cache_age_hours: float


@router.get("/forecast/{route_id}/{cell_id}")
async def get_cell_forecast(route_id: str, cell_id: str):
    """Get cached forecast for a cell."""
    route = get_route(route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    if cell_id not in route.bom_cells:
        raise HTTPException(status_code=400, detail="Cell not on route")

    # TODO: Fetch from cache or BOM API
    bom = get_bom_service()

    # For now, return mock data
    return {
        "route_id": route_id,
        "cell_id": cell_id,
        "forecast_date": date.today().isoformat(),
        "data": {},
        "cached": False,
        "cache_age_hours": 0
    }


@router.get("/route-templates")
async def list_route_templates():
    """List available route templates (predefined routes)."""
    route_ids = RouteLoader.list_routes()
    routes = []

    for route_id in route_ids:
        route = get_route(route_id)
        if route:
            routes.append({
                "route_id": route.route_id,
                "name": route.name,
                "short_name": route.short_name,
                "region": route.region,
                "distance_km": route.distance_km,
                "typical_days": route.typical_days,
                "grade": route.grade,
                "is_loop": route.is_loop
            })

    return {"routes": routes}


@router.get("/route-templates/{route_id}")
async def get_route_template_info(route_id: str):
    """Get detailed route template information."""
    route = get_route(route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    return {
        "route_id": route.route_id,
        "name": route.name,
        "short_name": route.short_name,
        "region": route.region,
        "distance_km": route.distance_km,
        "typical_days": route.typical_days,
        "grade": route.grade,
        "grade_description": route.grade_description,
        "is_loop": route.is_loop,
        "camps": [
            {
                "code": c.code,
                "name": c.name,
                "elevation": c.elevation,
                "bom_cell": c.bom_cell
            }
            for c in route.camps
        ],
        "peaks": [
            {
                "code": p.code,
                "name": p.name,
                "elevation": p.elevation,
                "type": p.type
            }
            for p in route.peaks
        ],
        "bom_cells": route.bom_cells
    }
