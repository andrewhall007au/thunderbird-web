"""
Affiliate landing page router with click tracking.

GET /ref/{code} - Record click, set cookie, redirect to home
GET /ref/{code}/{sub_id} - Record click with campaign tracking
GET /api/affiliate/validate - Validate affiliate code and return discount info
"""
import uuid
from fastapi import APIRouter, HTTPException, Response, Cookie, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional

from app.services.affiliates import get_affiliate_service
from app.models.affiliates import affiliate_store

router = APIRouter(tags=["affiliate-landing"])


class AffiliateValidateResponse(BaseModel):
    """Response for affiliate code validation."""
    valid: bool
    code: str
    discount_percent: int
    name: Optional[str] = None


@router.get("/ref/{code}")
async def affiliate_landing(
    code: str,
    response: Response,
    session_id: Optional[str] = Cookie(None, alias="tb_session")
):
    """
    Affiliate landing page - records click and redirects to home.

    Sets two cookies:
    - tb_affiliate: Affiliate code for checkout attribution (7 days)
    - tb_session: Session ID for click deduplication (24 hours)

    Args:
        code: Affiliate code (e.g., "PARTNER")
        session_id: Existing session ID from cookie (for deduplication)

    Returns:
        Redirect to home page

    Side effects:
        - Records click in affiliate_clicks table (deduplicated by session)
        - Sets tb_affiliate cookie (7 days)
        - Sets/refreshes tb_session cookie (24 hours)
    """
    # Generate session ID if not present
    if not session_id:
        session_id = str(uuid.uuid4())

    # Record click (will deduplicate if session clicked in last 24h)
    affiliate_service = get_affiliate_service()
    click = affiliate_service.record_click(
        affiliate_code=code,
        session_id=session_id,
        sub_id=None
    )

    # Set cookies regardless of whether click was recorded (deduplicated)
    # This ensures attribution works even for returning visitors
    redirect = RedirectResponse(url="/", status_code=302)

    # tb_affiliate cookie: 7 days
    redirect.set_cookie(
        key="tb_affiliate",
        value=code.upper(),
        max_age=7 * 24 * 60 * 60,  # 7 days
        httponly=True,
        samesite="lax"
    )

    # tb_session cookie: 24 hours
    redirect.set_cookie(
        key="tb_session",
        value=session_id,
        max_age=24 * 60 * 60,  # 24 hours
        httponly=True,
        samesite="lax"
    )

    return redirect


@router.get("/ref/{code}/{sub_id}")
async def affiliate_landing_with_sub_id(
    code: str,
    sub_id: str,
    response: Response,
    session_id: Optional[str] = Cookie(None, alias="tb_session")
):
    """
    Affiliate landing page with campaign tracking (sub_id).

    Same as /ref/{code} but includes sub_id for granular campaign tracking.
    Example: /ref/PARTNER/FB tracks Facebook campaign vs /ref/PARTNER/IG for Instagram.

    Args:
        code: Affiliate code (e.g., "PARTNER")
        sub_id: Campaign tracking ID (e.g., "FB", "IG", "EMAIL")
        session_id: Existing session ID from cookie (for deduplication)

    Returns:
        Redirect to home page

    Side effects:
        - Records click with sub_id in affiliate_clicks table
        - Sets tb_affiliate cookie (7 days)
        - Sets tb_sub_id cookie (7 days)
        - Sets/refreshes tb_session cookie (24 hours)
    """
    # Generate session ID if not present
    if not session_id:
        session_id = str(uuid.uuid4())

    # Record click with sub_id
    affiliate_service = get_affiliate_service()
    click = affiliate_service.record_click(
        affiliate_code=code,
        session_id=session_id,
        sub_id=sub_id
    )

    # Set cookies
    redirect = RedirectResponse(url="/", status_code=302)

    # tb_affiliate cookie: 7 days
    redirect.set_cookie(
        key="tb_affiliate",
        value=code.upper(),
        max_age=7 * 24 * 60 * 60,
        httponly=True,
        samesite="lax"
    )

    # tb_sub_id cookie: 7 days
    redirect.set_cookie(
        key="tb_sub_id",
        value=sub_id,
        max_age=7 * 24 * 60 * 60,
        httponly=True,
        samesite="lax"
    )

    # tb_session cookie: 24 hours
    redirect.set_cookie(
        key="tb_session",
        value=session_id,
        max_age=24 * 60 * 60,
        httponly=True,
        samesite="lax"
    )

    return redirect


@router.get("/api/affiliate/validate", response_model=AffiliateValidateResponse)
async def validate_affiliate_code(code: str = Query(..., description="Affiliate code to validate")):
    """
    Validate affiliate code and return discount information.

    Used by frontend to:
    - Check if code in cookie is still valid
    - Display discount amount in checkout UI
    - Auto-apply discount at checkout

    Args:
        code: Affiliate code (e.g., "PARTNER")

    Returns:
        AffiliateValidateResponse with valid flag, code, discount_percent, name

    Example:
        GET /api/affiliate/validate?code=PARTNER
        {
            "valid": true,
            "code": "PARTNER",
            "discount_percent": 15,
            "name": "Partner Affiliate"
        }
    """
    # Look up affiliate
    affiliate = affiliate_store.get_by_code(code)

    if not affiliate or not affiliate.active:
        return AffiliateValidateResponse(
            valid=False,
            code=code.upper(),
            discount_percent=0,
            name=None
        )

    return AffiliateValidateResponse(
        valid=True,
        code=affiliate.code,
        discount_percent=affiliate.discount_percent,
        name=affiliate.name
    )
