"""
Pricing Service - V3.0
Based on THUNDERBIRD_SPEC_v3.0 Section 10
"""

from decimal import Decimal
from typing import Dict, Optional


# =============================================================================
# Constants
# =============================================================================

TWILIO_SEGMENT_COST = Decimal("0.055")  # Cost per segment
USER_MARGIN = Decimal("1.5")  # 50% margin

TIER_PRICES = {
    "standard": Decimal("19.99"),
    "advanced": Decimal("29.99"),
    "expert": Decimal("49.99"),
}

ROUTE_TIERS = {
    # Standard: Easier routes
    "overland_track": "standard",
    "federation_peak": "standard",
    
    # Advanced: Moderate difficulty
    "western_arthurs_ak": "advanced",
    "eastern_arthurs": "advanced",
    
    # Expert: Most challenging
    "western_arthurs_full": "expert",
    "combined_arthurs": "expert",
}

# Estimated segments per command
COMMAND_SEGMENTS = {
    "CAST": 3,
    "CAST12": 3,
    "CAST24": 6,
    "CAST7": 14,
    "PEAKS": 10,
    "CHECKIN": 1,
    "ROUTE": 2,
    "STATUS": 1,
    "KEY": 1,
    "ALERTS": 1,
    "HELP": 1,
}


# =============================================================================
# Pricing Functions
# =============================================================================

def get_tier_for_route(route_id: str) -> str:
    """
    Get pricing tier for a route.
    
    Args:
        route_id: Route identifier
    
    Returns:
        Tier name: "standard", "advanced", or "expert"
    """
    return ROUTE_TIERS.get(route_id, "standard")


def get_tier_price(tier: str) -> Decimal:
    """
    Get price for a pricing tier.
    
    Args:
        tier: Tier name
    
    Returns:
        Price in AUD
    """
    return TIER_PRICES.get(tier, Decimal("19.99"))


def get_route_price(route_id: str) -> Decimal:
    """
    Get upfront price for a route.
    
    Args:
        route_id: Route identifier
    
    Returns:
        Price in AUD
    """
    tier = get_tier_for_route(route_id)
    return get_tier_price(tier)


def get_user_segment_price() -> Decimal:
    """
    Get price user pays per SMS segment.
    
    Returns:
        Price per segment (cost + 50% margin)
    """
    return TWILIO_SEGMENT_COST * USER_MARGIN


def count_segments(message: str) -> int:
    """
    Count SMS segments for a message.
    
    GSM-7 encoding:
    - First segment: 160 chars
    - Subsequent segments: 153 chars (7 chars for UDH header)
    
    Args:
        message: SMS message text
    
    Returns:
        Number of segments
    """
    length = len(message)
    
    if length <= 160:
        return 1
    
    # Concatenated messages use 153 chars per segment
    # First segment still has 153 usable (header takes 7)
    return (length + 152) // 153


def estimate_command_segments(command: str) -> int:
    """
    Estimate segments for a command type.
    
    Args:
        command: Command name (e.g., "CAST12")
    
    Returns:
        Estimated segments
    """
    return COMMAND_SEGMENTS.get(command.upper(), 1)


def estimate_trip_cost(
    route_id: str,
    days: int,
    cast12_per_day: int = 1,
    cast24_count: int = 0,
    cast7_count: int = 1,
    peaks_count: int = 0,
    checkins_per_day: int = 1,
    safecheck_contacts: int = 0
) -> Dict:
    """
    Estimate total trip cost.
    
    Args:
        route_id: Route identifier
        days: Trip duration in days
        cast12_per_day: CAST12 commands per day
        cast24_count: Total CAST24 commands
        cast7_count: Total CAST7 commands
        peaks_count: Total PEAKS commands
        checkins_per_day: Check-ins per day
        safecheck_contacts: Number of SafeCheck contacts
    
    Returns:
        Dict with upfront, sms_cost, total, segments
    """
    # Upfront cost based on route tier
    upfront = get_route_price(route_id)
    
    # Calculate total segments
    segments = 0
    
    # CAST commands
    segments += days * cast12_per_day * COMMAND_SEGMENTS["CAST12"]
    segments += cast24_count * COMMAND_SEGMENTS["CAST24"]
    segments += cast7_count * COMMAND_SEGMENTS["CAST7"]
    segments += peaks_count * COMMAND_SEGMENTS["PEAKS"]
    
    # Check-ins
    segments += days * checkins_per_day * COMMAND_SEGMENTS["CHECKIN"]
    
    # SafeCheck notifications (1 segment per contact per check-in)
    segments += days * checkins_per_day * safecheck_contacts
    
    # Onboarding messages (~8 segments)
    segments += 8
    
    # Calculate SMS cost
    sms_cost = Decimal(segments) * get_user_segment_price()
    
    return {
        "upfront": upfront,
        "sms_cost": sms_cost,
        "total": upfront + sms_cost,
        "segments": segments,
        "tier": get_tier_for_route(route_id),
    }


def calculate_margin(route_id: str, days: int = 1) -> Decimal:
    """
    Calculate profit margin for a route.
    
    Args:
        route_id: Route identifier
        days: Trip duration
    
    Returns:
        Margin in AUD
    """
    upfront = get_route_price(route_id)
    
    # Minimum SMS cost (assuming 5 segments per day)
    min_segments = days * 5
    cost = Decimal(min_segments) * TWILIO_SEGMENT_COST
    
    return upfront - cost


# =============================================================================
# User Balance Functions
# =============================================================================

def calculate_balance_deduction(segments: int) -> Decimal:
    """
    Calculate amount to deduct from user balance.
    
    Args:
        segments: Number of SMS segments
    
    Returns:
        Amount to deduct
    """
    return Decimal(segments) * get_user_segment_price()


def is_low_balance(balance: Decimal) -> bool:
    """
    Check if user has low balance.
    
    Args:
        balance: Current balance
    
    Returns:
        True if balance < $1
    """
    return balance < Decimal("1.00")
