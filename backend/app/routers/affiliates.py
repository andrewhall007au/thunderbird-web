"""
Affiliate dashboard API endpoints.

GET /api/affiliates/stats/{code} - Get affiliate statistics by period
GET /api/affiliates/conversions/{code} - Get recent conversions
GET /api/affiliates/summary/{code} - Get quick summary for dashboard header
POST /api/affiliates/payout/method/{code} - Update payout method
POST /api/affiliates/payout/request/{code} - Request payout
GET /api/affiliates/payout/status/{code} - Get payout status
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List

from app.services.affiliates import get_affiliate_service, PAYOUT_MINIMUM_CENTS
from app.models.affiliates import affiliate_store

router = APIRouter(prefix="/api/affiliates", tags=["affiliates"])


class AffiliateStatsResponse(BaseModel):
    """Response for affiliate statistics."""
    code: str
    name: str
    total_clicks: int
    unique_clicks: int
    total_conversions: int
    conversion_rate: float
    total_commission_cents: int
    pending_cents: int
    available_cents: int
    requested_cents: int
    paid_cents: int
    topup_count: int
    topup_commission_cents: int
    discount_percent: int
    commission_percent: int


class ConversionData(BaseModel):
    """Single conversion data."""
    amount_cents: int
    status: str
    created_at: Optional[str]
    available_at: Optional[str]
    sub_id: Optional[str]


class RecentConversionsResponse(BaseModel):
    """Response for recent conversions."""
    code: str
    conversions: List[ConversionData]


class AffiliateSummaryResponse(BaseModel):
    """Quick summary response for dashboard header."""
    code: str
    name: str
    total_commission_cents: int
    available_cents: int
    pending_cents: int
    conversion_rate: float


@router.get("/stats/{code}", response_model=AffiliateStatsResponse)
async def get_affiliate_stats(
    code: str,
    period: str = Query("30d", pattern="^(today|7d|30d|all)$")
):
    """
    Get affiliate statistics for a given period.

    Args:
        code: Affiliate code (e.g., "PARTNER")
        period: Time period - "today", "7d", "30d", or "all" (default: 30d)

    Returns:
        AffiliateStatsResponse with clicks, conversions, earnings breakdown

    Raises:
        404: Affiliate not found or inactive
    """
    # Look up affiliate by code
    affiliate = affiliate_store.get_by_code(code)
    if not affiliate or not affiliate.active:
        raise HTTPException(status_code=404, detail="Affiliate not found")

    # Get stats
    affiliate_service = get_affiliate_service()
    stats = affiliate_service.get_affiliate_stats(affiliate.id, period)

    if not stats:
        raise HTTPException(status_code=404, detail="Affiliate not found")

    return AffiliateStatsResponse(
        code=affiliate.code,
        name=affiliate.name,
        total_clicks=stats.total_clicks,
        unique_clicks=stats.unique_clicks,
        total_conversions=stats.total_conversions,
        conversion_rate=stats.conversion_rate,
        total_commission_cents=stats.total_commission_cents,
        pending_cents=stats.pending_cents,
        available_cents=stats.available_cents,
        requested_cents=stats.requested_cents,
        paid_cents=stats.paid_cents,
        topup_count=stats.topup_count,
        topup_commission_cents=stats.topup_commission_cents,
        discount_percent=affiliate.discount_percent,
        commission_percent=affiliate.commission_percent
    )


@router.get("/conversions/{code}", response_model=RecentConversionsResponse)
async def get_affiliate_conversions(
    code: str,
    limit: int = Query(10, ge=1, le=100)
):
    """
    Get recent conversions for affiliate.

    Returns aggregate data only - no personal information about customers.

    Args:
        code: Affiliate code (e.g., "PARTNER")
        limit: Maximum conversions to return (1-100, default: 10)

    Returns:
        RecentConversionsResponse with conversion list

    Raises:
        404: Affiliate not found or inactive
    """
    # Look up affiliate by code
    affiliate = affiliate_store.get_by_code(code)
    if not affiliate or not affiliate.active:
        raise HTTPException(status_code=404, detail="Affiliate not found")

    # Get recent conversions
    affiliate_service = get_affiliate_service()
    conversions_data = affiliate_service.get_recent_conversions(affiliate.id, limit)

    # Convert to response model
    conversions = [ConversionData(**conv) for conv in conversions_data]

    return RecentConversionsResponse(
        code=affiliate.code,
        conversions=conversions
    )


@router.get("/summary/{code}", response_model=AffiliateSummaryResponse)
async def get_affiliate_summary(code: str):
    """
    Get quick summary for dashboard header.

    Returns key metrics for affiliate - total earnings, available balance,
    pending balance, and conversion rate (all-time).

    Args:
        code: Affiliate code (e.g., "PARTNER")

    Returns:
        AffiliateSummaryResponse with quick summary

    Raises:
        404: Affiliate not found or inactive
    """
    # Look up affiliate by code
    affiliate = affiliate_store.get_by_code(code)
    if not affiliate or not affiliate.active:
        raise HTTPException(status_code=404, detail="Affiliate not found")

    # Get all-time stats for summary
    affiliate_service = get_affiliate_service()
    stats = affiliate_service.get_affiliate_stats(affiliate.id, "all")

    if not stats:
        raise HTTPException(status_code=404, detail="Affiliate not found")

    return AffiliateSummaryResponse(
        code=affiliate.code,
        name=affiliate.name,
        total_commission_cents=stats.total_commission_cents,
        available_cents=stats.available_cents,
        pending_cents=stats.pending_cents,
        conversion_rate=stats.conversion_rate
    )


# =============================================================================
# Payout Management Endpoints (AFFL-07)
# =============================================================================

class PayoutMethodRequest(BaseModel):
    """Request to update payout method."""
    payout_method: str  # "paypal" or "bank"
    payout_details: str  # PayPal email or bank info


class PayoutRequestResponse(BaseModel):
    """Response for payout request."""
    success: bool
    message: str
    amount_requested: Optional[str] = None


class PayoutStatusResponse(BaseModel):
    """Response for payout status."""
    affiliate_code: str
    payout_method: Optional[str]
    payout_details_set: bool
    available_cents: int
    available: str
    requested_cents: int
    requested: str
    paid_cents: int
    paid: str
    can_request_payout: bool
    minimum_payout: str


@router.post("/payout/method/{code}")
async def update_payout_method(
    code: str,
    request: PayoutMethodRequest
):
    """
    Update affiliate's payout method.

    Must be set before requesting payout.
    Accepts "paypal" or "bank" as payout_method.

    Args:
        code: Affiliate code (e.g., "PARTNER")
        request: PayoutMethodRequest with method and details

    Returns:
        Success status

    Raises:
        404: Affiliate not found or inactive
        400: Invalid payout method
    """
    affiliate = affiliate_store.get_by_code(code.upper())
    if not affiliate:
        raise HTTPException(status_code=404, detail="Affiliate not found")

    if request.payout_method not in ("paypal", "bank"):
        raise HTTPException(status_code=400, detail="Invalid payout method. Use 'paypal' or 'bank'")

    affiliate_service = get_affiliate_service()
    success = affiliate_service.update_payout_method(
        affiliate.id,
        request.payout_method,
        request.payout_details
    )

    if not success:
        raise HTTPException(status_code=500, detail="Failed to update payout method")

    return {"success": True, "message": "Payout method updated"}


@router.post("/payout/request/{code}", response_model=PayoutRequestResponse)
async def request_payout(code: str):
    """
    Request payout of available commission.

    From CONTEXT.md:
    - $50 minimum threshold
    - Manual approval by admin
    - PayPal or bank transfer

    Args:
        code: Affiliate code (e.g., "PARTNER")

    Returns:
        PayoutRequestResponse with success status and message

    Raises:
        404: Affiliate not found
    """
    affiliate = affiliate_store.get_by_code(code.upper())
    if not affiliate:
        raise HTTPException(status_code=404, detail="Affiliate not found")

    affiliate_service = get_affiliate_service()
    success, message = affiliate_service.request_payout(affiliate.id)

    if not success:
        return PayoutRequestResponse(success=False, message=message)

    # Get amount for response
    stats = affiliate_service.get_affiliate_stats(affiliate.id, "all")
    requested_amount = f"${stats.requested_cents/100:.2f}" if stats else "Unknown"

    return PayoutRequestResponse(
        success=True,
        message=message,
        amount_requested=requested_amount
    )


@router.get("/payout/status/{code}", response_model=PayoutStatusResponse)
async def get_payout_status(code: str):
    """
    Get current payout status and balance breakdown.

    Shows available, requested, and paid amounts.

    Args:
        code: Affiliate code (e.g., "PARTNER")

    Returns:
        PayoutStatusResponse with balance breakdown

    Raises:
        404: Affiliate not found or inactive
    """
    affiliate = affiliate_store.get_by_code(code.upper())
    if not affiliate:
        raise HTTPException(status_code=404, detail="Affiliate not found")

    affiliate_service = get_affiliate_service()
    stats = affiliate_service.get_affiliate_stats(affiliate.id, "all")

    available_cents = stats.available_cents if stats else 0
    requested_cents = stats.requested_cents if stats else 0
    paid_cents = stats.paid_cents if stats else 0

    return PayoutStatusResponse(
        affiliate_code=affiliate.code,
        payout_method=affiliate.payout_method,
        payout_details_set=bool(affiliate.payout_details),
        available_cents=available_cents,
        available=f"${available_cents/100:.2f}",
        requested_cents=requested_cents,
        requested=f"${requested_cents/100:.2f}",
        paid_cents=paid_cents,
        paid=f"${paid_cents/100:.2f}",
        can_request_payout=available_cents >= PAYOUT_MINIMUM_CENTS and bool(affiliate.payout_method),
        minimum_payout=f"${PAYOUT_MINIMUM_CENTS/100:.2f}"
    )
