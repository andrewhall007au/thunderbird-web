"""
Authentication service for JWT tokens and password handling.

Uses PyJWT for tokens and pwdlib with Argon2 for password hashing.
Following FastAPI official security patterns.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from pwdlib import PasswordHash

from config.settings import settings
from app.models.account import Account, account_store


# OAuth2 scheme for token extraction from Authorization header
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

# Argon2 password hasher (recommended replacement for bcrypt)
password_hash = PasswordHash.recommended()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain password against a hashed password.

    Args:
        plain_password: The password to verify
        hashed_password: The stored Argon2 hash

    Returns:
        True if password matches, False otherwise
    """
    return password_hash.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    """
    Hash a password using Argon2.

    Args:
        password: Plain text password

    Returns:
        Argon2 hash string
    """
    return password_hash.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.

    Args:
        data: Payload data (typically {"sub": email})
        expires_delta: Optional custom expiry (defaults to JWT_EXPIRY_MINUTES)

    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRY_MINUTES)

    to_encode.update({"exp": expire})

    return jwt.encode(
        to_encode,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM
    )


async def get_current_account(token: str = Depends(oauth2_scheme)) -> Account:
    """
    FastAPI dependency to get the current authenticated account.

    Use this on protected endpoints:
        @router.get("/protected")
        async def protected(account: Account = Depends(get_current_account)):
            return {"email": account.email}

    Raises:
        HTTPException 401 if token is invalid or expired
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise credentials_exception

    account = account_store.get_by_email(email)
    if account is None:
        raise credentials_exception

    return account
