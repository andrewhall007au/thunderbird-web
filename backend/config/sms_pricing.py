"""
Country-specific SMS pricing configuration.

Pricing model:
- Regional fixed pricing (third-party terrestrial network costs differ by country)
- Three pricing tiers based on carrier costs:
  - US/Canada: $10 = 100 segments (lowest carrier costs)
  - Standard (AU, UK, CH, FR, IT): $10 = 66 segments
  - Premium (NZ, ZA): $10 = 50 segments (highest carrier costs)
- Volume discounts: +10% at $25, +20% at $50
- 66 segments covers a typical 7-day trip (CAST7 + PEAKS7 + daily CAST12 for camp & peak)

Margin analysis (after 10% sales tax):
- US/Canada: 89-91%
- AU/UK: 55-63%
- CH: 37-47%
- FR: 31-42%
- IT: 19-33%
- NZ: 31-42%
- ZA: 28-40%

FUTURE: Margins can be dramatically improved by switching away from Twilio to
alternative providers (e.g., Cellcast, MessageBird, direct carrier agreements).
Twilio rates are ~2-3x higher than alternatives in most markets. This is a
separate initiative to be handled on a new branch.
"""
from dataclasses import dataclass
from enum import Enum
from typing import Dict
import re


class PricingRegion(Enum):
    """Pricing regions based on carrier costs."""
    US_CANADA = "us_canada"      # $10 = 100 segments
    STANDARD = "standard"        # $10 = 66 segments
    PREMIUM = "premium"          # $10 = 50 segments


@dataclass
class RegionPricing:
    """Pricing configuration for a region."""
    region: PricingRegion
    segments_per_10: int
    segments_per_25: int  # +10% bonus
    segments_per_50: int  # +20% bonus
    cost_per_segment_10: float  # Customer cost at $10 tier
    cost_per_segment_25: float  # Customer cost at $25 tier
    cost_per_segment_50: float  # Customer cost at $50 tier


# Regional pricing tiers
REGION_PRICING: Dict[PricingRegion, RegionPricing] = {
    PricingRegion.US_CANADA: RegionPricing(
        region=PricingRegion.US_CANADA,
        segments_per_10=100,
        segments_per_25=275,   # 100 * 2.5 * 1.10
        segments_per_50=600,   # 100 * 5 * 1.20
        cost_per_segment_10=0.100,
        cost_per_segment_25=0.091,
        cost_per_segment_50=0.083,
    ),
    PricingRegion.STANDARD: RegionPricing(
        region=PricingRegion.STANDARD,
        segments_per_10=66,
        segments_per_25=182,   # 66 * 2.5 * 1.10 = 181.5 -> 182
        segments_per_50=396,   # 66 * 5 * 1.20
        cost_per_segment_10=0.152,
        cost_per_segment_25=0.137,
        cost_per_segment_50=0.126,
    ),
    PricingRegion.PREMIUM: RegionPricing(
        region=PricingRegion.PREMIUM,
        segments_per_10=50,
        segments_per_25=138,   # 50 * 2.5 * 1.10 = 137.5 -> 138
        segments_per_50=300,   # 50 * 5 * 1.20
        cost_per_segment_10=0.200,
        cost_per_segment_25=0.181,
        cost_per_segment_50=0.167,
    ),
}


@dataclass
class CountrySMSCost:
    """
    SMS cost configuration per country.

    Attributes:
        country_code: ISO 2-letter code (e.g., "US", "GB")
        country_name: Full country name
        region: Pricing region for this country
        twilio_cost_per_segment: Twilio cost in dollars
        segments_per_10_dollars: Segments per $10 top-up
    """
    country_code: str
    country_name: str
    region: PricingRegion
    twilio_cost_per_segment: float
    segments_per_10_dollars: int


# Country configurations with Twilio costs (for margin tracking) and region assignment
_COUNTRY_CONFIG = [
    # (country_code, country_name, twilio_cost, region)
    ("US", "United States", 0.0083, PricingRegion.US_CANADA),
    ("CA", "Canada", 0.0083, PricingRegion.US_CANADA),
    ("AU", "Australia", 0.0515, PricingRegion.STANDARD),
    ("GB", "United Kingdom", 0.0524, PricingRegion.STANDARD),
    ("CH", "Switzerland", 0.0725, PricingRegion.STANDARD),
    ("FR", "France", 0.0798, PricingRegion.STANDARD),
    ("IT", "Italy", 0.0927, PricingRegion.STANDARD),
    ("NZ", "New Zealand", 0.1050, PricingRegion.PREMIUM),
    ("ZA", "South Africa", 0.1089, PricingRegion.PREMIUM),
]

# Build the country lookup
SMS_COSTS_BY_COUNTRY: Dict[str, CountrySMSCost] = {}
for code, name, twilio_cost, region in _COUNTRY_CONFIG:
    pricing = REGION_PRICING[region]
    SMS_COSTS_BY_COUNTRY[code] = CountrySMSCost(
        country_code=code,
        country_name=name,
        region=region,
        twilio_cost_per_segment=twilio_cost,
        segments_per_10_dollars=pricing.segments_per_10,
    )


# Phone number country code mapping (E.164 prefix -> ISO country code)
_PHONE_PREFIX_TO_COUNTRY = {
    "61": "AU",     # Australia
    "1": "US",      # US and Canada share +1, default to US
    "44": "GB",     # United Kingdom
    "33": "FR",     # France
    "39": "IT",     # Italy
    "41": "CH",     # Switzerland
    "64": "NZ",     # New Zealand
    "27": "ZA",     # South Africa
}

# Canadian area codes (to distinguish from US within +1)
_CANADIAN_AREA_CODES = {
    "204", "226", "236", "249", "250", "289", "306", "343", "365", "367",
    "403", "416", "418", "431", "437", "438", "450", "506", "514", "519",
    "548", "579", "581", "587", "604", "613", "639", "647", "672", "705",
    "709", "778", "780", "782", "807", "819", "825", "867", "873", "902",
    "905", "942"
}


def get_sms_cost(country_code: str) -> CountrySMSCost:
    """
    Get SMS cost configuration for a country.

    Args:
        country_code: ISO 2-letter country code (e.g., "US", "GB")

    Returns:
        CountrySMSCost for the country, defaults to STANDARD region if unknown
    """
    code_upper = country_code.upper()
    if code_upper in SMS_COSTS_BY_COUNTRY:
        return SMS_COSTS_BY_COUNTRY[code_upper]
    # Default to Australia (STANDARD) if country unknown
    return SMS_COSTS_BY_COUNTRY["AU"]


def get_region_pricing(country_code: str) -> RegionPricing:
    """
    Get the regional pricing for a country.

    Args:
        country_code: ISO 2-letter country code

    Returns:
        RegionPricing for the country's region
    """
    cost = get_sms_cost(country_code)
    return REGION_PRICING[cost.region]


def get_segments_for_topup(country_code: str, amount_dollars: int) -> int:
    """
    Get number of segments for a top-up amount.

    Args:
        country_code: ISO 2-letter country code
        amount_dollars: Top-up amount ($10, $25, or $50)

    Returns:
        Number of segments for that top-up amount
    """
    pricing = get_region_pricing(country_code)
    if amount_dollars == 10:
        return pricing.segments_per_10
    elif amount_dollars == 25:
        return pricing.segments_per_25
    elif amount_dollars == 50:
        return pricing.segments_per_50
    else:
        # For other amounts, use base rate (no discount)
        return int(amount_dollars * pricing.segments_per_10 / 10)


def get_cost_per_segment(country_code: str, amount_dollars: int = 10) -> float:
    """
    Get customer cost per segment for a given top-up tier.

    Args:
        country_code: ISO 2-letter country code
        amount_dollars: Top-up amount ($10, $25, or $50)

    Returns:
        Cost per segment in dollars
    """
    pricing = get_region_pricing(country_code)
    if amount_dollars == 10:
        return pricing.cost_per_segment_10
    elif amount_dollars == 25:
        return pricing.cost_per_segment_25
    elif amount_dollars == 50:
        return pricing.cost_per_segment_50
    else:
        return pricing.cost_per_segment_10


def calculate_segments_cost_cents(country_code: str, segments: int) -> int:
    """
    Calculate cost in cents for a number of segments (at base $10 rate).

    Args:
        country_code: ISO 2-letter country code
        segments: Number of SMS segments

    Returns:
        Cost in cents (rounded up)
    """
    pricing = get_region_pricing(country_code)
    cost_dollars = segments * pricing.cost_per_segment_10
    # Round up to nearest cent
    return int(cost_dollars * 100 + 0.99)


def get_country_from_phone(phone: str) -> str:
    """
    Extract country code from E.164 formatted phone number.

    Args:
        phone: Phone number in E.164 format (e.g., "+14155551234", "+447700900123")

    Returns:
        ISO 2-letter country code (defaults to "AU" if can't determine)
    """
    # Remove any non-digit characters except leading +
    cleaned = re.sub(r"[^\d+]", "", phone)

    # Must start with +
    if not cleaned.startswith("+"):
        # Assume AU if no country code (most users)
        return "AU"

    # Remove the leading +
    digits = cleaned[1:]

    if not digits:
        return "AU"

    # Check for +1 (US/Canada)
    if digits.startswith("1"):
        # Check if it's a Canadian area code
        if len(digits) >= 4:
            area_code = digits[1:4]
            if area_code in _CANADIAN_AREA_CODES:
                return "CA"
        return "US"

    # Check two-digit prefixes
    if len(digits) >= 2:
        prefix2 = digits[:2]
        if prefix2 in _PHONE_PREFIX_TO_COUNTRY:
            return _PHONE_PREFIX_TO_COUNTRY[prefix2]

    # Default to AU
    return "AU"


def get_all_countries() -> list[CountrySMSCost]:
    """
    Get all configured country SMS costs.

    Returns:
        List of CountrySMSCost objects, sorted by country name
    """
    return sorted(
        SMS_COSTS_BY_COUNTRY.values(),
        key=lambda c: c.country_name
    )


def get_volume_discount_info() -> dict:
    """
    Get volume discount information for display.

    Returns:
        Dict with discount info for each tier
    """
    return {
        10: {"bonus": "0%", "description": "Base rate"},
        25: {"bonus": "+10%", "description": "10% bonus segments"},
        50: {"bonus": "+20%", "description": "20% bonus segments"},
    }
