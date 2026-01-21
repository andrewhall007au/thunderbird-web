"""
Affiliate dashboard API endpoints.

GET /api/affiliates/stats/{code} - Get affiliate statistics by period
GET /api/affiliates/conversions/{code} - Get recent conversions
GET /api/affiliates/summary/{code} - Get quick summary for dashboard header
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List

from app.services.affiliates import get_affiliate_service
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
