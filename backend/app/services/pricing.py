"""
Pricing Service - V3.2
Based on THUNDERBIRD_SPEC_v3.2 Section 10
Updated for dynamic grouping (40-85% SMS reduction)
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

# Estimated segments per command (v3.2 - with dynamic grouping)
# Grouped commands now use ~40-60% fewer segments
COMMAND_SEGMENTS = {
    "CAST": 3,
    "CAST12": 3,
    "CAST24": 6,
    "CAST7": 4,           # 7-day single location
    "CAST7_CAMPS": 6,     # 7-day all camps (grouped) - was 14, now ~6
    "CAST7_PEAKS": 4,     # 7-day all peaks (grouped) - was 10, now ~4
    "CHECKIN": 1,
    "ROUTE": 2,
    "STATUS": 1,
    "KEY": 1,
    "ALERTS": 1,
    "HELP": 1,
}

# Legacy ungrouped segment estimates (for comparison/reporting)
COMMAND_SEGMENTS_UNGROUPED = {
    "CAST7_CAMPS": 14,    # Without grouping
    "CAST7_PEAKS": 10,    # Without grouping
}

# Route-specific grouping estimates (typical zone counts)
ROUTE_GROUPING_STATS = {
    "overland_track": {
        "camps": 10, "camp_zones": 4, "peaks": 9, "peak_zones": 3,
        "camp_reduction": 0.60, "peak_reduction": 0.67,
    },
    "western_arthurs_ak": {
        "camps": 8, "camp_zones": 3, "peaks": 6, "peak_zones": 2,
        "camp_reduction": 0.63, "peak_reduction": 0.67,
    },
    "western_arthurs_full": {
        "camps": 15, "camp_zones": 4, "peaks": 12, "peak_zones": 3,
        "camp_reduction": 0.73, "peak_reduction": 0.75,
    },
    "eastern_arthurs": {
        "camps": 9, "camp_zones": 3, "peaks": 5, "peak_zones": 2,
        "camp_reduction": 0.67, "peak_reduction": 0.60,
    },
    "federation_peak": {
        "camps": 4, "camp_zones": 2, "peaks": 1, "peak_zones": 1,
        "camp_reduction": 0.50, "peak_reduction": 0.00,
    },
    "combined_arthurs": {
        "camps": 20, "camp_zones": 5, "peaks": 15, "peak_zones": 4,
        "camp_reduction": 0.75, "peak_reduction": 0.73,
    },
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
    cast7_camps_count: int = 0,
    cast7_peaks_count: int = 0,
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
        cast7_count: Total CAST7 [location] commands
        cast7_camps_count: Total CAST7 CAMPS commands
        cast7_peaks_count: Total CAST7 PEAKS commands
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
    segments += cast7_camps_count * COMMAND_SEGMENTS["CAST7_CAMPS"]
    segments += cast7_peaks_count * COMMAND_SEGMENTS["CAST7_PEAKS"]
    
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


# =============================================================================
# Grouping Statistics Functions (v3.2)
# =============================================================================

def get_grouping_stats(route_id: str) -> Dict:
    """
    Get grouping statistics for a route.

    Args:
        route_id: Route identifier

    Returns:
        Dict with camps, camp_zones, peaks, peak_zones, reductions
    """
    return ROUTE_GROUPING_STATS.get(route_id, {
        "camps": 0, "camp_zones": 0, "peaks": 0, "peak_zones": 0,
        "camp_reduction": 0.0, "peak_reduction": 0.0,
    })


def estimate_grouping_savings(route_id: str, cast7_camps_count: int = 0, cast7_peaks_count: int = 0) -> Dict:
    """
    Estimate SMS segment savings from dynamic grouping.

    Args:
        route_id: Route identifier
        cast7_camps_count: Number of CAST7 CAMPS commands
        cast7_peaks_count: Number of CAST7 PEAKS commands

    Returns:
        Dict with segments_saved, cost_saved, reduction_pct
    """
    # Calculate ungrouped segments
    ungrouped_camps = cast7_camps_count * COMMAND_SEGMENTS_UNGROUPED.get("CAST7_CAMPS", 14)
    ungrouped_peaks = cast7_peaks_count * COMMAND_SEGMENTS_UNGROUPED.get("CAST7_PEAKS", 10)
    ungrouped_total = ungrouped_camps + ungrouped_peaks

    # Calculate grouped segments
    grouped_camps = cast7_camps_count * COMMAND_SEGMENTS["CAST7_CAMPS"]
    grouped_peaks = cast7_peaks_count * COMMAND_SEGMENTS["CAST7_PEAKS"]
    grouped_total = grouped_camps + grouped_peaks

    # Calculate savings
    segments_saved = ungrouped_total - grouped_total
    cost_saved = Decimal(segments_saved) * get_user_segment_price()
    reduction_pct = (segments_saved / ungrouped_total * 100) if ungrouped_total > 0 else 0

    return {
        "ungrouped_segments": ungrouped_total,
        "grouped_segments": grouped_total,
        "segments_saved": segments_saved,
        "cost_saved": cost_saved,
        "reduction_pct": round(reduction_pct, 1),
    }


def calculate_actual_grouping_reduction(
    locations_count: int,
    zones_count: int,
    segments_per_zone: int = 2
) -> Dict:
    """
    Calculate actual grouping reduction from real forecast data.

    Args:
        locations_count: Total number of locations (camps or peaks)
        zones_count: Number of zones after grouping
        segments_per_zone: Estimated SMS segments per zone (default 2)

    Returns:
        Dict with reduction stats
    """
    # Estimate ungrouped: ~2 segments per location
    ungrouped_segments = locations_count * 2

    # Grouped: segments per zone
    grouped_segments = zones_count * segments_per_zone

    segments_saved = ungrouped_segments - grouped_segments
    reduction_pct = (segments_saved / ungrouped_segments * 100) if ungrouped_segments > 0 else 0

    return {
        "locations": locations_count,
        "zones": zones_count,
        "ungrouped_segments": ungrouped_segments,
        "grouped_segments": grouped_segments,
        "segments_saved": segments_saved,
        "reduction_pct": round(reduction_pct, 1),
    }


def get_trip_savings_summary(route_id: str, days: int = 7) -> Dict:
    """
    Get summary of potential savings for a trip using grouped commands.

    Args:
        route_id: Route identifier
        days: Trip duration

    Returns:
        Dict with savings summary
    """
    stats = get_grouping_stats(route_id)

    # Assume typical usage: 1 CAST7 CAMPS + 1 CAST7 PEAKS per trip
    savings = estimate_grouping_savings(route_id, cast7_camps_count=1, cast7_peaks_count=1)

    return {
        "route_id": route_id,
        "camps": stats.get("camps", 0),
        "camp_zones": stats.get("camp_zones", 0),
        "peaks": stats.get("peaks", 0),
        "peak_zones": stats.get("peak_zones", 0),
        "segments_saved_per_trip": savings["segments_saved"],
        "cost_saved_per_trip": savings["cost_saved"],
        "avg_reduction_pct": round(
            (stats.get("camp_reduction", 0) + stats.get("peak_reduction", 0)) / 2 * 100, 1
        ),
    }
