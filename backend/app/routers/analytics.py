"""
Analytics API endpoints.

POST /api/analytics - Log analytics events from frontend.
No authentication required (analytics should work for anonymous users).
"""
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any

from app.models.analytics import analytics_store

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


class AnalyticsEventRequest(BaseModel):
    """Request body for logging analytics events."""
    event: str
    variant: Optional[str] = None
    entry_path: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None
    account_id: Optional[int] = None
    timestamp: Optional[str] = None  # Client timestamp (informational only)


@router.post("", status_code=201)
async def log_analytics_event(
    request: AnalyticsEventRequest
):
    """
    Log an analytics event.

    No authentication required - analytics should work for anonymous users.
    Events are stored in analytics_events table for conversion analysis.

    Request body:
    - event: Event name (required) - e.g., 'page_view', 'checkout_started'
    - variant: A/B test variant - 'A' or 'B'
    - entry_path: User entry path - 'create', 'buy', or 'organic'
    - properties: Additional event properties (JSON object)
    - account_id: Account ID if user is logged in
    - timestamp: Client-side timestamp (for reference, server uses own timestamp)

    Returns 201 Created with empty body.
    """
    try:
        # Store event in database
        analytics_store.create(
            event=request.event,
            variant=request.variant,
            entry_path=request.entry_path,
            properties=request.properties,
            account_id=request.account_id
        )
    except Exception as e:
        # Log error but don't fail - analytics should never block user experience
        import logging
        logging.error(f"Analytics error: {e}")

    # Always return 201 - analytics is fire-and-forget
    # IMPORTANT: Use JSONResponse to include proper Content-Type header
    # This prevents browser CORB from aborting the request
    return JSONResponse(status_code=201, content={})
