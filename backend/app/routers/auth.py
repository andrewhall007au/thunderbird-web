"""
Authentication router for registration and login.

Endpoints:
- POST /auth/register - Create new account
- POST /auth/token - Login and get JWT token
- GET /auth/me - Get current account info
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field
from datetime import timedelta

from app.services.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_account,
    create_password_reset_token,
    verify_password_reset_token,
)
from app.services.email import send_password_reset_email
from app.models.account import Account, account_store
from app.services.sms import PhoneUtils
from config.settings import settings


router = APIRouter(prefix="/auth", tags=["auth"])


# Request/Response models

class RegisterRequest(BaseModel):
    """Registration request body."""
    email: EmailStr
    password: str = Field(..., min_length=8, description="Minimum 8 characters")


class LinkPhoneRequest(BaseModel):
    """Request to link phone number to account."""
    phone: str = Field(..., description="Phone number (e.g., +61412345678 or 0412345678)")


class AccountResponse(BaseModel):
    """Account info response (excludes password)."""
    id: int
    email: str
    phone: Optional[str] = None
    unit_system: str = "metric"  # v3.5: "metric" or "imperial"
    created_at: str


class UpdateSettingsRequest(BaseModel):
    """Request to update account settings."""
    unit_system: Optional[str] = Field(None, pattern="^(metric|imperial)$", description="Unit system: metric or imperial")


class Token(BaseModel):
    """JWT token response."""
    access_token: str
    token_type: str


# Endpoints

@router.post("/register", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest):
    """
    Register a new account.

    Args:
        request: Email and password

    Returns:
        Created account info

    Raises:
        400 if email already registered
    """
    # Check if email exists
    existing = account_store.get_by_email(request.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create account
    hashed = hash_password(request.password)
    account = account_store.create(email=request.email, password_hash=hashed)

    return AccountResponse(
        id=account.id,
        email=account.email,
        phone=account.phone,
        unit_system=account.unit_system or "metric",
        created_at=account.created_at.isoformat() if account.created_at else ""
    )


@router.post("/token", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Login to get access token.

    Uses OAuth2 password flow - send username (email) and password
    as form data.

    Returns:
        JWT access token

    Raises:
        401 if credentials are incorrect
    """
    account = account_store.get_by_email(form_data.username)

    if not account or not verify_password(form_data.password, account.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        data={"sub": account.email},
        expires_delta=timedelta(minutes=settings.JWT_EXPIRY_MINUTES)
    )

    return Token(access_token=access_token, token_type="bearer")


@router.get("/me", response_model=AccountResponse)
async def get_me(account: Account = Depends(get_current_account)):
    """
    Get current authenticated account.

    Requires valid JWT in Authorization header.
    """
    return AccountResponse(
        id=account.id,
        email=account.email,
        phone=account.phone,
        unit_system=account.unit_system or "metric",
        created_at=account.created_at.isoformat() if account.created_at else ""
    )


@router.put("/settings", response_model=AccountResponse)
async def update_settings(
    request: UpdateSettingsRequest,
    account: Account = Depends(get_current_account)
):
    """
    Update account settings.

    Currently supports:
    - unit_system: "metric" or "imperial" for temperature/elevation units

    Requires valid JWT in Authorization header.
    """
    updated = False

    if request.unit_system:
        success = account_store.update_unit_system(account.id, request.unit_system)
        if success:
            updated = True

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No settings updated"
        )

    # Return updated account
    updated_account = account_store.get_by_id(account.id)

    return AccountResponse(
        id=updated_account.id,
        email=updated_account.email,
        phone=updated_account.phone,
        unit_system=updated_account.unit_system or "metric",
        created_at=updated_account.created_at.isoformat() if updated_account.created_at else ""
    )


@router.post("/phone", response_model=AccountResponse)
async def link_phone(
    request: LinkPhoneRequest,
    account: Account = Depends(get_current_account)
):
    """
    Link a phone number to the authenticated account.

    The phone number is normalized to international format (+61...).
    This enables connecting the web Account to SMS User data.

    Args:
        request: Phone number to link

    Returns:
        Updated account info

    Raises:
        400 if phone number is invalid format
    """
    # Normalize phone number using existing PhoneUtils
    try:
        normalized_phone = PhoneUtils.normalize(request.phone)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid phone number: {str(e)}"
        )

    # Link phone to account
    success = account_store.link_phone(account.id, normalized_phone)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )

    # Return updated account
    updated_account = account_store.get_by_id(account.id)

    return AccountResponse(
        id=updated_account.id,
        email=updated_account.email,
        phone=updated_account.phone,
        unit_system=updated_account.unit_system or "metric",
        created_at=updated_account.created_at.isoformat() if updated_account.created_at else ""
    )


@router.get("/phone/{phone}", response_model=AccountResponse)
async def get_account_by_phone(
    phone: str,
    account: Account = Depends(get_current_account)
):
    """
    Look up account by phone number.

    Requires authentication. Used for admin/debugging.
    """
    try:
        normalized = PhoneUtils.normalize(phone)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid phone format"
        )

    # Look up account by phone
    found = account_store.get_by_phone(normalized)
    if not found:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account with this phone number"
        )

    return AccountResponse(
        id=found.id,
        email=found.email,
        phone=found.phone,
        unit_system=found.unit_system or "metric",
        created_at=found.created_at.isoformat() if found.created_at else ""
    )


# Password Reset Models

class ForgotPasswordRequest(BaseModel):
    """Request to initiate password reset."""
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Request to set new password with reset token."""
    token: str
    new_password: str = Field(..., min_length=8, description="Minimum 8 characters")


# Password Reset Endpoints

@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """
    Request a password reset email.

    Always returns success to prevent email enumeration.
    If the email exists, a reset link is sent.

    Args:
        request: Email address to reset
    """
    account = account_store.get_by_email(request.email)

    if account:
        # Generate reset token and send email
        reset_token = create_password_reset_token(account.email)
        await send_password_reset_email(account.email, reset_token)

    # Always return success to prevent email enumeration
    return {"message": "If an account exists with this email, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """
    Reset password using a valid reset token.

    Args:
        request: Token and new password

    Returns:
        Success message

    Raises:
        400 if token is invalid or expired
    """
    email = verify_password_reset_token(request.token)

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )

    # Verify account exists
    account = account_store.get_by_email(email)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )

    # Update password
    new_hash = hash_password(request.new_password)
    account_store.update_password(email, new_hash)

    return {"message": "Password has been reset successfully"}
