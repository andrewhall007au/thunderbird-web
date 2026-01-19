"""
Payment API endpoints.

Handles checkout initiation, balance queries, and order history.
PAY-01, PAY-03, PAY-06, PAY-07
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List

from app.services.payments import get_payment_service
from app.services.balance import get_balance_service
from app.services.auth import get_current_account
from app.models.account import Account

router = APIRouter(prefix="/api/payments", tags=["payments"])


# Request/Response models

class CreateCheckoutRequest(BaseModel):
    """Request to create Stripe checkout session."""
    discount_code: Optional[str] = None
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None


class CreateCheckoutResponse(BaseModel):
    """Response with checkout URL for redirect."""
    success: bool
    checkout_url: Optional[str] = None
    order_id: Optional[int] = None
    error: Optional[str] = None


class BalanceResponse(BaseModel):
    """Account balance response."""
    balance_cents: int
    balance_display: str  # e.g., "$12.34"


class CreateTopupRequest(BaseModel):
    """Request to create top-up checkout session."""
    amount_cents: int = 1000  # Default $10
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None


class OrderSummary(BaseModel):
    """Order summary for history."""
    id: int
    order_type: str
    amount_cents: int
    status: str
    created_at: Optional[str] = None


class OrderHistoryResponse(BaseModel):
    """Order history response."""
    orders: List[OrderSummary]


# Endpoints

@router.post("/checkout", response_model=CreateCheckoutResponse)
async def create_checkout(
    request: CreateCheckoutRequest,
    account: Account = Depends(get_current_account)
):
    """
    Create Stripe Checkout session for initial purchase.

    Returns checkout_url for redirect to Stripe hosted page.
    After payment, webhook handles fulfillment - NOT success URL.

    PAY-01: Initial $29.99 purchase
    PAY-03: Discount codes via allow_promotion_codes
    """
    payment_service = get_payment_service()
    result = await payment_service.create_checkout_session(
        account_id=account.id,
        discount_code=request.discount_code,
        success_url=request.success_url,
        cancel_url=request.cancel_url
    )

    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)

    return CreateCheckoutResponse(
        success=True,
        checkout_url=result.checkout_url,
        order_id=result.order_id
    )


@router.get("/balance", response_model=BalanceResponse)
async def get_balance(account: Account = Depends(get_current_account)):
    """
    Get current account balance.

    PAY-06: Balance tracking
    """
    balance_service = get_balance_service()
    balance_cents = balance_service.get_balance(account.id)

    return BalanceResponse(
        balance_cents=balance_cents,
        balance_display=balance_service.get_balance_display(account.id)
    )


@router.post("/topup", response_model=CreateCheckoutResponse)
async def create_topup(
    request: CreateTopupRequest,
    account: Account = Depends(get_current_account)
):
    """
    Create checkout session for balance top-up.

    PAY-07: User can top up $10 blocks
    """
    # Validate amount
    if request.amount_cents < 100:  # Minimum $1
        raise HTTPException(status_code=400, detail="Minimum top-up is $1.00")
    if request.amount_cents > 50000:  # Maximum $500
        raise HTTPException(status_code=400, detail="Maximum top-up is $500.00")

    payment_service = get_payment_service()
    result = await payment_service.create_topup_checkout(
        account_id=account.id,
        amount_cents=request.amount_cents,
        success_url=request.success_url,
        cancel_url=request.cancel_url
    )

    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)

    return CreateCheckoutResponse(
        success=True,
        checkout_url=result.checkout_url,
        order_id=result.order_id
    )


@router.get("/orders", response_model=OrderHistoryResponse)
async def get_orders(
    account: Account = Depends(get_current_account),
    limit: int = 20
):
    """
    Get order history for account.
    """
    from app.models.payments import order_store

    # Validate limit
    if limit < 1:
        limit = 1
    if limit > 100:
        limit = 100

    orders = order_store.get_by_account_id(account.id)
    orders = orders[:limit]

    return OrderHistoryResponse(
        orders=[
            OrderSummary(
                id=o.id,
                order_type=o.order_type,
                amount_cents=o.amount_cents,
                status=o.status,
                created_at=o.created_at.isoformat() if o.created_at else None
            )
            for o in orders
        ]
    )
