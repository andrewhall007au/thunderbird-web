"""
V3.0 Pricing Tier Tests

Tests for tiered pricing model:
- Standard: $19.99 (Overland, Federation Peak)
- Advanced: $29.99 (WA A-K, Eastern Arthurs)
- Expert: $49.99 (WA Full, Combined Arthurs)
- SMS Usage: 50% margin over cost

Run with: pytest tests/test_v3_pricing.py -v
"""

import pytest
from decimal import Decimal


# =============================================================================
# Pricing Tier Tests
# =============================================================================

class TestPricingTiers:
    """
    v3.0 uses tiered pricing by route difficulty.
    Spec Section 10.1
    """
    
    def test_standard_tier_routes(self):
        """Standard tier ($19.99) should include Overland and Federation"""
        from app.services.pricing import get_tier_for_route
        
        standard_routes = ["overland_track", "federation_peak"]
        
        for route_id in standard_routes:
            tier = get_tier_for_route(route_id)
            assert tier == "standard", f"{route_id} should be standard tier"
    
    def test_advanced_tier_routes(self):
        """Advanced tier ($29.99) should include WA A-K and Eastern Arthurs"""
        from app.services.pricing import get_tier_for_route
        
        advanced_routes = ["western_arthurs_ak", "eastern_arthurs"]
        
        for route_id in advanced_routes:
            tier = get_tier_for_route(route_id)
            assert tier == "advanced", f"{route_id} should be advanced tier"
    
    def test_expert_tier_routes(self):
        """Expert tier ($49.99) should include WA Full and Combined"""
        from app.services.pricing import get_tier_for_route
        
        expert_routes = ["western_arthurs_full", "combined_arthurs"]
        
        for route_id in expert_routes:
            tier = get_tier_for_route(route_id)
            assert tier == "expert", f"{route_id} should be expert tier"
    
    def test_tier_prices(self):
        """Each tier should have correct price"""
        from app.services.pricing import get_tier_price
        
        expected = {
            "standard": Decimal("19.99"),
            "advanced": Decimal("29.99"),
            "expert": Decimal("49.99"),
        }
        
        for tier, expected_price in expected.items():
            actual = get_tier_price(tier)
            assert actual == expected_price, f"{tier} should be ${expected_price}"


# =============================================================================
# SMS Usage Pricing Tests
# =============================================================================

class TestSMSUsagePricing:
    """
    SMS usage charged at 50% margin over cost.
    Spec Section 10.2
    """
    
    def test_twilio_segment_cost(self):
        """Twilio cost should be $0.055 per segment"""
        from app.services.pricing import TWILIO_SEGMENT_COST
        
        assert TWILIO_SEGMENT_COST == Decimal("0.055"), \
            f"Twilio cost should be $0.055, got {TWILIO_SEGMENT_COST}"
    
    def test_user_segment_price(self):
        """User pays 50% margin: $0.0825 per segment"""
        from app.services.pricing import get_user_segment_price
        
        # 0.055 * 1.5 = 0.0825
        expected = Decimal("0.0825")
        actual = get_user_segment_price()
        
        assert actual == expected, f"User price should be ${expected}, got ${actual}"
    
    def test_50_percent_margin(self):
        """Margin should be exactly 50%"""
        from app.services.pricing import TWILIO_SEGMENT_COST, get_user_segment_price
        
        user_price = get_user_segment_price()
        margin = (user_price - TWILIO_SEGMENT_COST) / TWILIO_SEGMENT_COST * 100
        
        assert margin == 50, f"Margin should be 50%, got {margin}%"


# =============================================================================
# Segment Counting Tests
# =============================================================================

class TestSegmentCounting:
    """
    Test SMS segment calculation for billing.
    """
    
    def test_single_segment(self):
        """Message under 160 chars should be 1 segment"""
        from app.services.pricing import count_segments
        
        short_msg = "Test message under 160 characters"
        assert count_segments(short_msg) == 1
    
    def test_two_segments(self):
        """Message 161-306 chars should be 2 segments"""
        from app.services.pricing import count_segments
        
        # 200 chars
        medium_msg = "x" * 200
        assert count_segments(medium_msg) == 2
    
    def test_three_segments(self):
        """Message 307-459 chars should be 3 segments"""
        from app.services.pricing import count_segments
        
        long_msg = "x" * 400
        assert count_segments(long_msg) == 3
    
    def test_gsm7_segment_boundaries(self):
        """GSM-7 concatenation uses 153 chars per segment after first"""
        from app.services.pricing import count_segments
        
        # Exact boundaries for GSM-7
        # 160 = 1 segment
        # 161-306 = 2 segments (160 + 153 = 313, but concat header uses space)
        # 307-459 = 3 segments
        
        assert count_segments("x" * 160) == 1
        assert count_segments("x" * 161) == 2
        assert count_segments("x" * 306) == 2
        assert count_segments("x" * 307) == 3


# =============================================================================
# Command Segment Cost Tests
# =============================================================================

class TestCommandSegmentCosts:
    """
    Each command type has expected segment usage.
    Spec Section 10.3
    """
    
    def test_cast12_segment_count(self):
        """CAST12 should use ~3 segments"""
        from app.services.pricing import estimate_command_segments
        
        segments = estimate_command_segments("CAST12")
        assert 2 <= segments <= 4, f"CAST12 should use ~3 segments, got {segments}"
    
    def test_cast24_segment_count(self):
        """CAST24 should use ~6 segments"""
        from app.services.pricing import estimate_command_segments
        
        segments = estimate_command_segments("CAST24")
        assert 5 <= segments <= 7, f"CAST24 should use ~6 segments, got {segments}"
    
    def test_cast7_segment_count_per_day(self):
        """CAST7 [location] should use ~4 segments"""
        from app.services.pricing import estimate_command_segments

        segments = estimate_command_segments("CAST7")
        # Single location 7-day forecast
        assert 3 <= segments <= 5, f"CAST7 should use ~4 segments, got {segments}"

    def test_cast7_camps_segment_count(self):
        """CAST7 CAMPS should use ~14 segments"""
        from app.services.pricing import estimate_command_segments

        segments = estimate_command_segments("CAST7_CAMPS")
        assert 12 <= segments <= 16, f"CAST7_CAMPS should use ~14 segments, got {segments}"

    def test_cast7_peaks_segment_count(self):
        """CAST7 PEAKS should use ~10 segments"""
        from app.services.pricing import estimate_command_segments

        segments = estimate_command_segments("CAST7_PEAKS")
        assert 8 <= segments <= 12, f"CAST7_PEAKS should use ~10 segments, got {segments}"
    
    def test_checkin_segment_count(self):
        """CHECKIN should use 1 segment"""
        from app.services.pricing import estimate_command_segments
        
        segments = estimate_command_segments("CHECKIN")
        assert segments == 1, f"CHECKIN should use 1 segment, got {segments}"


# =============================================================================
# Trip Cost Estimation Tests
# =============================================================================

class TestTripCostEstimation:
    """
    Test total trip cost calculation.
    Spec Section 10.3
    """
    
    def test_overland_track_cost(self):
        """6-day Overland Track should cost ~$24.30 total"""
        from app.services.pricing import estimate_trip_cost
        
        result = estimate_trip_cost(
            route_id="overland_track",
            days=6,
            cast12_per_day=1,
            cast7_count=1,
            checkins_per_day=1,
            safecheck_contacts=1
        )
        
        # Upfront: $19.99
        # SMS: ~$4.31
        # Total: ~$24.30
        assert Decimal("20") <= result["total"] <= Decimal("30"), \
            f"Overland should cost ~$24, got ${result['total']}"
    
    def test_wa_full_cost(self):
        """9-day WA Full should cost ~$60 total"""
        from app.services.pricing import estimate_trip_cost

        result = estimate_trip_cost(
            route_id="western_arthurs_full",
            days=9,
            cast12_per_day=1,
            cast24_count=2,
            cast7_count=1,
            cast7_peaks_count=1,
            checkins_per_day=1,
            safecheck_contacts=2
        )

        # Upfront: $49.99
        # SMS: ~$10
        # Total: ~$60
        assert Decimal("50") <= result["total"] <= Decimal("70"), \
            f"WA Full should cost ~$60, got ${result['total']}"
    
    def test_break_even_analysis(self):
        """All routes should be profitable from day 1"""
        from app.services.pricing import calculate_margin
        
        routes = [
            "overland_track",
            "western_arthurs_ak",
            "western_arthurs_full",
            "eastern_arthurs",
            "federation_peak",
            "combined_arthurs",
        ]
        
        for route_id in routes:
            margin = calculate_margin(route_id, days=1)
            assert margin > 0, f"{route_id} should be profitable, margin: {margin}"


# =============================================================================
# User Balance Tests
# =============================================================================

class TestUserBalance:
    """
    Test user SMS balance tracking.
    """
    
    def test_initial_balance(self):
        """New user should have zero SMS balance"""
        from app.services.user import UserService
        
        service = UserService()
        user = service.create_user(phone="+61400000000", name="Test")
        
        assert user.sms_balance == Decimal("0"), "New user should have $0 balance"
    
    def test_charge_sms_usage(self):
        """SMS usage should be charged to user"""
        from app.services.user import UserService
        
        service = UserService()
        
        # Create user with some balance
        user = service.create_user(phone="+61400000000", name="Test")
        service.add_balance(user.id, Decimal("10.00"))
        
        # Charge for 3 segments (CAST12)
        service.charge_sms(user.id, segments=3)
        
        # Should deduct 3 × $0.0825 = $0.2475
        updated_user = service.get_user(user.id)
        expected_balance = Decimal("10.00") - (3 * Decimal("0.0825"))
        
        assert updated_user.sms_balance == expected_balance
    
    def test_insufficient_balance_warning(self):
        """User with low balance should be warned"""
        from app.services.user import UserService
        
        service = UserService()
        
        user = service.create_user(phone="+61400000000", name="Test")
        service.add_balance(user.id, Decimal("0.50"))
        
        # Check if warning should be shown
        should_warn = service.check_low_balance(user.id)
        
        assert should_warn, "Should warn when balance < $1"
