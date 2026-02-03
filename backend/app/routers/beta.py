"""
Beta access application endpoint.

Public endpoint for users to apply for beta access.
"""
import logging
import sqlite3

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field
from html import escape

from app.models.beta_application import beta_application_store, SUPPORTED_COUNTRIES, normalize_country
from app.services.beta import send_admin_notification

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/beta", tags=["beta"])


class BetaApplyRequest(BaseModel):
    """Beta application request body."""
    name: str = Field(..., min_length=1, max_length=100, description="Applicant name")
    email: EmailStr
    country: str = Field(..., description="Country of residence")


class BetaApplyResponse(BaseModel):
    """Beta application response."""
    success: bool
    message: str


@router.post("/apply", response_model=BetaApplyResponse)
async def apply_for_beta(request: BetaApplyRequest):
    """
    Submit a beta access application.

    Public endpoint - no authentication required.
    Accepts both country codes (AU, US, etc.) and full names (Australia, United States).
    Validates country, checks for duplicate email, stores application,
    and sends admin notification.
    """
    # Sanitize inputs to prevent XSS
    sanitized_name = escape(request.name.strip())

    # Normalize country (accepts both codes and full names)
    normalized_country = normalize_country(request.country)

    # Validate country
    if normalized_country not in SUPPORTED_COUNTRIES:
        raise HTTPException(
            status_code=400,
            detail=f"Country not supported. Supported: {', '.join(SUPPORTED_COUNTRIES)}"
        )

    # Check for existing application
    existing = beta_application_store.get_by_email(request.email)
    if existing:
        if existing.status == "pending":
            return BetaApplyResponse(
                success=True,
                message="Your application is already being reviewed. We'll be in touch soon."
            )
        elif existing.status == "approved":
            return BetaApplyResponse(
                success=True,
                message="You already have beta access! Check your email for login details."
            )
        else:
            # Rejected - allow re-application by treating as new
            pass

    # Create application
    try:
        application = beta_application_store.create(
            name=sanitized_name,
            email=request.email,
            country=normalized_country,
        )
    except sqlite3.IntegrityError:
        # Race condition - email already exists
        return BetaApplyResponse(
            success=True,
            message="Your application is already being reviewed. We'll be in touch soon."
        )

    # Send admin notification (non-blocking, don't fail if email fails)
    try:
        await send_admin_notification(application)
    except Exception as e:
        logger.error(f"Failed to send admin notification: {e}")

    return BetaApplyResponse(
        success=True,
        message="Application received! You'll receive login details at your email once approved."
    )
