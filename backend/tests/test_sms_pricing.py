"""
Tests for SMS pricing configuration and cost verification.
"""
import pytest
from decimal import Decimal

from config.sms_pricing import (
    SMS_COSTS_BY_COUNTRY,
    MARGIN_PERCENT,
    PricingRegion,
    REGION_PRICING,
    get_sms_cost,
    get_segments_for_topup,
    get_region_pricing,
    get_country_from_phone,
    get_cost_per_segment,
    calculate_segments_cost_cents,
    get_all_countries,
)
from app.services.cost_verification import (
    CostVerificationService,
    TARGET_MARGIN,
    MARGIN_ALERT_THRESHOLD,
)


class TestSMSPricingConfig:
    """Test SMS pricing configuration."""

    def test_all_countries_configured(self):
        """All 9 required countries are configured."""
        required = {"US", "CA", "AU", "GB", "FR", "IT", "CH", "NZ", "ZA"}
        configured = set(SMS_COSTS_BY_COUNTRY.keys())
        missing = required - configured
        assert not missing, f"Missing countries: {missing}"

    def test_margin_is_80_percent(self):
        """Margin constant is 80%."""
        assert MARGIN_PERCENT == 80

    def test_us_pricing_correct(self):
        """US pricing uses US_CANADA region."""
        us = get_sms_cost("US")
        assert us.region == PricingRegion.US_CANADA
        assert us.segments_per_10_dollars == 100
        assert us.twilio_cost_per_segment > 0

    def test_ca_pricing_correct(self):
        """Canada pricing uses US_CANADA region."""
        ca = get_sms_cost("CA")
        assert ca.region == PricingRegion.US_CANADA
        assert ca.segments_per_10_dollars == 100

    def test_gb_pricing_correct(self):
        """UK pricing uses STANDARD region."""
        gb = get_sms_cost("GB")
        assert gb.region == PricingRegion.STANDARD
        assert gb.segments_per_10_dollars == 66
        # UK should have higher Twilio cost than US
        us = get_sms_cost("US")
        assert gb.twilio_cost_per_segment > us.twilio_cost_per_segment

    def test_nz_pricing_correct(self):
        """NZ pricing uses PREMIUM region."""
        nz = get_sms_cost("NZ")
        assert nz.region == PricingRegion.PREMIUM
        assert nz.segments_per_10_dollars == 50

    def test_segments_per_10_dollars(self):
        """Segments per $10 vary by region."""
        us_segments = get_segments_for_topup("US", 10)
        gb_segments = get_segments_for_topup("GB", 10)
        nz_segments = get_segments_for_topup("NZ", 10)

        # US should get most segments (cheapest carrier costs)
        assert us_segments > gb_segments > nz_segments
        # Exact values
        assert us_segments == 100
        assert gb_segments == 66
        assert nz_segments == 50

    def test_volume_discounts(self):
        """Volume discounts apply at $25 and $50."""
        # $25 gives 10% bonus
        us_25 = get_segments_for_topup("US", 25)
        assert us_25 == 275  # 100 * 2.5 * 1.10

        # $50 gives 20% bonus
        us_50 = get_segments_for_topup("US", 50)
        assert us_50 == 600  # 100 * 5 * 1.20

    def test_unknown_country_defaults_to_au(self):
        """Unknown country codes default to AU (STANDARD region)."""
        unknown = get_sms_cost("XX")
        au = get_sms_cost("AU")
        assert unknown.segments_per_10_dollars == au.segments_per_10_dollars

    @pytest.mark.parametrize("phone,expected", [
        ("+14155551234", "US"),      # US number
        ("+16045551234", "CA"),      # Canadian area code (604 = Vancouver)
        ("+14165551234", "CA"),      # Canadian area code (416 = Toronto)
        ("+447700900123", "GB"),     # UK number
        ("+33612345678", "FR"),      # France
        ("+61412345678", "AU"),      # Australia
        ("+64211234567", "NZ"),      # New Zealand
        ("+27821234567", "ZA"),      # South Africa
    ])
    def test_country_from_phone(self, phone, expected):
        """Phone number parsing extracts country correctly."""
        result = get_country_from_phone(phone)
        assert result == expected

    def test_cost_per_segment_varies_by_tier(self):
        """Cost per segment decreases with higher top-up amounts."""
        cost_10 = get_cost_per_segment("US", 10)
        cost_25 = get_cost_per_segment("US", 25)
        cost_50 = get_cost_per_segment("US", 50)

        assert cost_10 > cost_25 > cost_50
        assert cost_10 == 0.100  # $0.10 per segment at $10
        assert cost_25 == 0.091  # ~$0.091 per segment at $25
        assert cost_50 == 0.083  # ~$0.083 per segment at $50

    def test_get_all_countries(self):
        """get_all_countries returns all configured countries."""
        countries = get_all_countries()
        assert len(countries) == 9
        codes = [c.country_code for c in countries]
        assert "US" in codes
        assert "CA" in codes
        assert "GB" in codes


class TestRegionPricing:
    """Test region-based pricing tiers."""

    def test_three_regions_configured(self):
        """Three pricing regions are configured."""
        assert len(REGION_PRICING) == 3
        assert PricingRegion.US_CANADA in REGION_PRICING
        assert PricingRegion.STANDARD in REGION_PRICING
        assert PricingRegion.PREMIUM in REGION_PRICING

    def test_us_canada_has_most_segments(self):
        """US_CANADA region has highest segment count."""
        us_canada = REGION_PRICING[PricingRegion.US_CANADA]
        standard = REGION_PRICING[PricingRegion.STANDARD]
        premium = REGION_PRICING[PricingRegion.PREMIUM]

        assert us_canada.segments_per_10 > standard.segments_per_10
        assert standard.segments_per_10 > premium.segments_per_10


class TestCostVerificationService:
    """Test cost verification service."""

    def test_service_instantiates(self):
        """Service can be instantiated."""
        svc = CostVerificationService()
        assert svc is not None

    def test_target_margin_is_80_percent(self):
        """Target margin is 80%."""
        assert TARGET_MARGIN == Decimal("0.80")

    def test_alert_threshold_below_target(self):
        """Alert threshold is below target margin."""
        assert MARGIN_ALERT_THRESHOLD < TARGET_MARGIN
        assert MARGIN_ALERT_THRESHOLD >= Decimal("0.70")

    def test_calculate_margin(self):
        """Margin calculation is correct."""
        svc = CostVerificationService()
        # If Twilio charges 1 cent, we charge 5 cents, profit is 4, margin is 4/5 = 80%
        margin = svc.calculate_margin(twilio_cost_cents=1, customer_cost_cents=5)
        assert margin == Decimal("0.8")

    def test_calculate_margin_zero_twilio(self):
        """Margin is 100% if Twilio cost is zero."""
        svc = CostVerificationService()
        margin = svc.calculate_margin(twilio_cost_cents=0, customer_cost_cents=5)
        assert margin == Decimal("1.0")

    @pytest.mark.asyncio
    async def test_verify_country_handles_unknown(self):
        """Verify handles unknown country codes."""
        svc = CostVerificationService()
        result = await svc.verify_country("ZZ")
        assert result.error is not None
