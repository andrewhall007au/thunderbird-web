"""
Payment API endpoints.

Handles checkout initiation, balance queries, and order history.
PAY-01, PAY-03, PAY-06, PAY-07, FLOW-03 (Buy Now path)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List

from app.services.payments import get_payment_service
from app.services.balance import get_balance_service
from app.services.auth import get_current_account, hash_password, create_access_token
from app.models.account import Account, account_store
from datetime import timedelta
from config.settings import settings

router = APIRouter(prefix="/api/payments", tags=["payments"])


# Request/Response models

class CreateCheckoutRequest(BaseModel):
    """Request to create Stripe checkout session."""
    discount_code: Optional[str] = None
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None
    entry_path: Optional[str] = None  # 'buy', 'create', 'organic' for analytics
    route_id: Optional[int] = None  # Route to activate (for Create First flow)
    sub_id: Optional[str] = None  # Campaign tracking ID for affiliate attribution


class BuyNowCheckoutRequest(BaseModel):
    """Request to create account and Stripe checkout session in one step.

    FLOW-03: Buy Now conversion path.
    """
    email: EmailStr
    password: str = Field(..., min_length=8, description="Minimum 8 characters")
    name: str = Field(..., min_length=1, description="User's full name")
    entry_path: Optional[str] = None  # 'buy', 'create', 'organic'
    discount_code: Optional[str] = None
    sub_id: Optional[str] = None  # Campaign tracking ID for affiliate attribution


class BuyNowCheckoutResponse(BaseModel):
    """Response with checkout URL and auth token."""
    success: bool
    checkout_url: Optional[str] = None
    access_token: Optional[str] = None  # JWT for future requests
    error: Optional[str] = None


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
    FLOW-02: entry_path and route_id tracking for Create First flow
    AFFL-03: Affiliate code lookup and attribution
    """
    # Look up affiliate from discount code (AFFL-03)
    affiliate_id = None
    if request.discount_code:
        from app.models.payments import discount_code_store
        discount = discount_code_store.get_by_code(request.discount_code)
        if discount and discount.affiliate_id:
            affiliate_id = discount.affiliate_id

    payment_service = get_payment_service()
    result = await payment_service.create_checkout_session(
        account_id=account.id,
        discount_code=request.discount_code,
        success_url=request.success_url,
        cancel_url=request.cancel_url,
        entry_path=request.entry_path,
        route_id=request.route_id,
        affiliate_id=affiliate_id,
        sub_id=request.sub_id
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


@router.post("/buy-now", response_model=BuyNowCheckoutResponse)
async def buy_now_checkout(request: BuyNowCheckoutRequest):
    """
    Create account and Stripe Checkout session in one step.

    FLOW-03: Buy Now conversion path.
    - Creates new account if email not registered
    - Creates Stripe checkout session with entry_path in metadata
    - Returns checkout_url and JWT access_token

    This endpoint does NOT require authentication - it creates the account.
    AFFL-03: Affiliate code lookup and attribution
    """
    # Check if email already exists
    existing = account_store.get_by_email(request.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered. Please log in."
        )

    # Create account
    hashed = hash_password(request.password)
    account = account_store.create(email=request.email, password_hash=hashed)

    # Update account with name if provided (stored in a name field if model supports it)
    # For now, name is captured in Stripe metadata

    # Look up affiliate from discount code (AFFL-03)
    affiliate_id = None
    if request.discount_code:
        from app.models.payments import discount_code_store
        discount = discount_code_store.get_by_code(request.discount_code)
        if discount and discount.affiliate_id:
            affiliate_id = discount.affiliate_id

    # Create Stripe checkout session with entry_path metadata
    payment_service = get_payment_service()
    base_url = settings.BASE_URL

    result = await payment_service.create_checkout_session_with_metadata(
        account_id=account.id,
        entry_path=request.entry_path,
        customer_name=request.name,
        customer_email=request.email,
        discount_code=request.discount_code,
        success_url=f"{base_url}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{base_url}/checkout",
        affiliate_id=affiliate_id,
        sub_id=request.sub_id
    )

    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)

    # Create JWT for the new user
    access_token = create_access_token(
        data={"sub": account.email},
        expires_delta=timedelta(minutes=settings.JWT_EXPIRY_MINUTES)
    )

    return BuyNowCheckoutResponse(
        success=True,
        checkout_url=result.checkout_url,
        access_token=access_token
    )


@router.get("/session/{session_id}")
async def get_session(session_id: str):
    """
    Get Stripe checkout session details.

    Used by success page to verify payment and get metadata.
    Returns session status, payment status, and metadata.
    """
    payment_service = get_payment_service()
    session_data = payment_service.get_checkout_session(session_id)

    if not session_data:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "success": True,
        "session": session_data
    }
