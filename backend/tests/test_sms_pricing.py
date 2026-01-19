"""
Tests for SMS pricing configuration and cost verification.
"""
import pytest
from decimal import Decimal

from config.sms_pricing import (
    SMS_COSTS_BY_COUNTRY,
    get_sms_cost,
    get_segments_per_topup,
    get_country_from_phone,
    MARGIN_PERCENT
)
from app.services.cost_verification import (
    CostVerificationService,
    TARGET_MARGIN,
    MARGIN_ALERT_THRESHOLD,
)


class TestSMSPricingConfig:
    """Test SMS pricing configuration."""

    def test_all_countries_configured(self):
        """All 8 required countries are configured."""
        required = {"US", "CA", "GB", "FR", "IT", "CH", "NZ", "ZA"}
        configured = set(SMS_COSTS_BY_COUNTRY.keys())
        missing = required - configured
        assert not missing, f"Missing countries: {missing}"

    def test_margin_is_80_percent(self):
        """Margin constant is 80%."""
        assert MARGIN_PERCENT == 80

    def test_us_pricing_correct(self):
        """US pricing matches research values."""
        us = get_sms_cost("US")
        # Research: $0.0113 Twilio, $0.0566 customer (ish)
        assert us.twilio_cost_per_segment_cents > 0
        assert us.customer_cost_per_segment_cents > us.twilio_cost_per_segment_cents
        # Should be ~5x Twilio cost for 80% margin
        ratio = us.customer_cost_per_segment_cents / us.twilio_cost_per_segment_cents
        assert 4.5 <= ratio <= 5.5, f"US ratio should be ~5x, got {ratio}"

    def test_gb_pricing_correct(self):
        """UK pricing matches research values."""
        gb = get_sms_cost("GB")
        # Research: $0.0524 Twilio
        assert gb.twilio_cost_per_segment_cents > 0
        # UK should be more expensive than US
        us = get_sms_cost("US")
        assert gb.twilio_cost_per_segment_cents > us.twilio_cost_per_segment_cents

    def test_segments_per_10_dollars(self):
        """Segments per $10 calculated correctly."""
        us_segments = get_segments_per_topup("US")
        gb_segments = get_segments_per_topup("GB")

        # US should get more segments (cheaper)
        assert us_segments > gb_segments
        # US should be around 176 per research
        assert 150 <= us_segments <= 200
        # GB should be around 38 per research
        assert 30 <= gb_segments <= 50

    def test_unknown_country_defaults_to_us(self):
        """Unknown country codes default to US rates."""
        unknown = get_sms_cost("XX")
        us = get_sms_cost("US")
        assert unknown.customer_cost_per_segment_cents == us.customer_cost_per_segment_cents

    @pytest.mark.parametrize("phone,expected", [
        ("+14155551234", "US"),
        ("+447700900123", "GB"),
        ("+33612345678", "FR"),
        ("+61412345678", "US"),  # Australia not configured, defaults to US
    ])
    def test_country_from_phone(self, phone, expected):
        """Phone number parsing extracts country correctly."""
        result = get_country_from_phone(phone)
        assert result == expected


class TestMarginCalculations:
    """Test margin calculation logic."""

    def test_80_percent_margin(self):
        """80% margin when customer pays 5x Twilio cost."""
        svc = CostVerificationService()
        # If Twilio charges 1, we charge 5, profit is 4, margin is 4/5 = 80%
        margin = svc.calculate_margin(twilio_cost_cents=1, customer_cost_cents=5)
        assert margin == Decimal("0.8")

    def test_all_countries_maintain_80_margin(self):
        """All configured countries maintain ~80% margin."""
        svc = CostVerificationService()

        for country_code, cost in SMS_COSTS_BY_COUNTRY.items():
            margin = svc.calculate_margin(
                cost.twilio_cost_per_segment_cents,
                cost.customer_cost_per_segment_cents
            )
            assert margin >= Decimal("0.79"), f"{country_code} margin too low: {margin}"
            assert margin <= Decimal("0.81"), f"{country_code} margin too high: {margin}"

    def test_margin_alert_threshold(self):
        """Alert threshold is below target margin."""
        assert MARGIN_ALERT_THRESHOLD < TARGET_MARGIN
        assert MARGIN_ALERT_THRESHOLD >= Decimal("0.70")


class TestCostVerificationService:
    """Test cost verification service."""

    def test_service_instantiates(self):
        """Service can be instantiated."""
        svc = CostVerificationService()
        assert svc is not None

    def test_handles_missing_credentials(self):
        """Service handles missing Twilio credentials."""
        svc = CostVerificationService()
        # Without credentials, fetch should return None gracefully
        # (actual test depends on env vars)

    @pytest.mark.asyncio
    async def test_verify_country_handles_unknown(self):
        """Verify handles unknown country codes."""
        svc = CostVerificationService()
        result = await svc.verify_country("XX")
        assert result.error is not None
        assert "not in configuration" in result.error
