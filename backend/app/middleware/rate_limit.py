"""
Rate Limiting Middleware

Prevents brute force attacks on authentication and API endpoints.
Uses in-memory storage (suitable for single-server deployment).
For multi-server, use Redis-backed rate limiting.
"""
from typing import Dict, Tuple
from datetime import datetime, timedelta
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
import time


class RateLimiter:
    """
    Simple in-memory rate limiter.

    Tracks requests per IP address with sliding window.
    """

    def __init__(self):
        # Store: {ip: [(timestamp, endpoint), ...]}
        self.requests: Dict[str, list] = {}
        self.cleanup_interval = 3600  # Clean old entries every hour
        self.last_cleanup = time.time()

    def _cleanup_old_entries(self):
        """Remove entries older than 1 hour to prevent memory bloat."""
        if time.time() - self.last_cleanup < self.cleanup_interval:
            return

        cutoff = datetime.now() - timedelta(hours=1)
        for ip in list(self.requests.keys()):
            self.requests[ip] = [
                (ts, endpoint) for ts, endpoint in self.requests[ip]
                if ts > cutoff
            ]
            if not self.requests[ip]:
                del self.requests[ip]

        self.last_cleanup = time.time()

    def check_rate_limit(
        self,
        ip: str,
        endpoint: str,
        max_requests: int,
        window_seconds: int
    ) -> Tuple[bool, int]:
        """
        Check if request is within rate limit.

        Args:
            ip: Client IP address
            endpoint: Endpoint being accessed
            max_requests: Maximum requests allowed
            window_seconds: Time window in seconds

        Returns:
            (allowed: bool, remaining: int)
        """
        self._cleanup_old_entries()

        now = datetime.now()
        window_start = now - timedelta(seconds=window_seconds)

        # Get recent requests from this IP to this endpoint
        if ip not in self.requests:
            self.requests[ip] = []

        # Filter to recent requests for this endpoint
        recent = [
            (ts, ep) for ts, ep in self.requests[ip]
            if ts > window_start and ep == endpoint
        ]

        if len(recent) >= max_requests:
            return False, 0

        # Add this request
        self.requests[ip].append((now, endpoint))

        return True, max_requests - len(recent) - 1


# Global rate limiter instance
rate_limiter = RateLimiter()


# Rate limit configurations per endpoint pattern
RATE_LIMITS = {
    "/auth/token": (5, 300),           # 5 login attempts per 5 minutes
    "/auth/register": (3, 3600),       # 3 registrations per hour
    "/auth/forgot-password": (3, 3600), # 3 password resets per hour
    "/api/beta/apply": (5, 3600),      # 5 beta applications per hour
    "default": (100, 60),              # 100 requests per minute for other endpoints
}


def get_rate_limit_for_path(path: str) -> Tuple[int, int]:
    """Get rate limit config for a path."""
    for pattern, limits in RATE_LIMITS.items():
        if pattern in path:
            return limits
    return RATE_LIMITS["default"]


async def rate_limit_middleware(request: Request, call_next):
    """
    Rate limiting middleware.

    Apply different rate limits based on endpoint.
    Returns 429 Too Many Requests if limit exceeded.
    """
    # Get client IP (handle proxy headers)
    client_ip = request.headers.get("X-Real-IP") or \
                request.headers.get("X-Forwarded-For", "").split(",")[0].strip() or \
                request.client.host if request.client else "unknown"

    # Get rate limit for this endpoint
    max_requests, window_seconds = get_rate_limit_for_path(request.url.path)

    # Check rate limit
    allowed, remaining = rate_limiter.check_rate_limit(
        client_ip,
        request.url.path,
        max_requests,
        window_seconds
    )

    if not allowed:
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "detail": f"Rate limit exceeded. Try again in {window_seconds} seconds."
            },
            headers={
                "Retry-After": str(window_seconds),
                "X-RateLimit-Limit": str(max_requests),
                "X-RateLimit-Remaining": "0",
            }
        )

    # Process request
    response = await call_next(request)

    # Add rate limit headers to response
    response.headers["X-RateLimit-Limit"] = str(max_requests)
    response.headers["X-RateLimit-Remaining"] = str(remaining)
    response.headers["X-RateLimit-Window"] = str(window_seconds)

    return response
