"""
Country-specific SMS pricing configuration.

Pricing model:
- Twilio charges vary by country
- We maintain 80% margin on all SMS costs
- Customer rate = Twilio rate / 0.20 (we keep 80%, Twilio gets 20% of customer payment)
- $10 top-up gives variable segments based on country rate

Example for US:
- Twilio: $0.0113/segment (1.13 cents)
- Customer: $0.0566/segment (5.66 cents) to maintain 80% margin
- $10 / $0.0566 = 176 segments per $10
"""
from dataclasses import dataclass
from typing import Dict, Optional
import re


# 80% margin constant - documented for clarity
MARGIN_PERCENT = 80


@dataclass
class CountrySMSCost:
    """
    SMS cost configuration per country.

    Attributes:
        country_code: ISO 2-letter code (e.g., "US", "GB")
        country_name: Full country name
        twilio_cost_per_segment_cents: Twilio cost in cents (fractional stored as hundredths)
        customer_cost_per_segment_cents: What we charge in cents (fractional stored as hundredths)
        segments_per_10_dollars: Calculated segments per $10 top-up
    """
    country_code: str
    country_name: str
    twilio_cost_per_segment_cents: int  # Stored as hundredths of a cent for precision
    customer_cost_per_segment_cents: int  # Stored as hundredths of a cent for precision
    segments_per_10_dollars: int


def _calculate_customer_rate(twilio_rate_hundredths: int) -> int:
    """
    Calculate customer rate to maintain 80% margin.

    Args:
        twilio_rate_hundredths: Twilio rate in hundredths of a cent

    Returns:
        Customer rate in hundredths of a cent
    """
    # customer_rate = twilio_rate / 0.20 = twilio_rate * 5
    return twilio_rate_hundredths * 5


def _calculate_segments_per_10_dollars(customer_rate_hundredths: int) -> int:
    """
    Calculate segments available per $10 top-up.

    Args:
        customer_rate_hundredths: Customer rate in hundredths of a cent

    Returns:
        Number of segments (floored)
    """
    # $10 = 1000 cents = 100000 hundredths of a cent
    return 100000 // customer_rate_hundredths


# Country SMS costs based on Twilio pricing research (2026-01-19)
# Rates are Twilio outbound SMS per segment
# Stored as hundredths of a cent for precision (e.g., 113 = 1.13 cents)
SMS_COSTS_BY_COUNTRY: Dict[str, CountrySMSCost] = {}

# Build the pricing table
_TWILIO_RATES = [
    # (country_code, country_name, twilio_rate_hundredths)
    # twilio_rate_hundredths: rate in hundredths of a cent (1.13 cents = 113)
    ("US", "United States", 113),    # $0.0113 = 1.13 cents
    ("CA", "Canada", 170),           # $0.0170 = 1.70 cents
    ("GB", "United Kingdom", 524),   # $0.0524 = 5.24 cents
    ("FR", "France", 798),           # $0.0798 = 7.98 cents
    ("IT", "Italy", 927),            # $0.0927 = 9.27 cents
    ("CH", "Switzerland", 725),      # $0.0725 = 7.25 cents
    ("NZ", "New Zealand", 1050),     # $0.1050 = 10.50 cents
    ("ZA", "South Africa", 1089),    # $0.1089 = 10.89 cents
]

for code, name, twilio_rate in _TWILIO_RATES:
    customer_rate = _calculate_customer_rate(twilio_rate)
    segments = _calculate_segments_per_10_dollars(customer_rate)
    SMS_COSTS_BY_COUNTRY[code] = CountrySMSCost(
        country_code=code,
        country_name=name,
        twilio_cost_per_segment_cents=twilio_rate,
        customer_cost_per_segment_cents=customer_rate,
        segments_per_10_dollars=segments
    )


# Phone number country code mapping (E.164 prefix -> ISO country code)
_PHONE_PREFIX_TO_COUNTRY = {
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
        CountrySMSCost for the country, defaults to US if unknown
    """
    code_upper = country_code.upper()
    if code_upper in SMS_COSTS_BY_COUNTRY:
        return SMS_COSTS_BY_COUNTRY[code_upper]
    # Default to US rate if country unknown
    return SMS_COSTS_BY_COUNTRY["US"]


def get_segments_per_topup(country_code: str) -> int:
    """
    Get number of segments available per $10 top-up for a country.

    Args:
        country_code: ISO 2-letter country code

    Returns:
        Number of segments per $10
    """
    return get_sms_cost(country_code).segments_per_10_dollars


def calculate_sms_cost_cents(country_code: str, segments: int) -> int:
    """
    Calculate cost in cents for sending SMS segments to a country.

    Args:
        country_code: ISO 2-letter country code
        segments: Number of SMS segments

    Returns:
        Cost in cents (rounded up to ensure margin)
    """
    cost = get_sms_cost(country_code)
    # customer_cost is in hundredths of a cent, so divide by 100 to get cents
    # Use ceiling division to ensure we never lose margin
    total_hundredths = cost.customer_cost_per_segment_cents * segments
    # Round up: (total + 99) // 100 gives ceiling division
    return (total_hundredths + 99) // 100


def get_country_from_phone(phone: str) -> str:
    """
    Extract country code from E.164 formatted phone number.

    Args:
        phone: Phone number in E.164 format (e.g., "+14155551234", "+447700900123")

    Returns:
        ISO 2-letter country code (defaults to "US" if can't determine)
    """
    # Remove any non-digit characters except leading +
    cleaned = re.sub(r"[^\d+]", "", phone)

    # Must start with +
    if not cleaned.startswith("+"):
        # Assume US if no country code
        return "US"

    # Remove the leading +
    digits = cleaned[1:]

    if not digits:
        return "US"

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

    # Default to US
    return "US"


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
