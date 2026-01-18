"""
V3.2 Pricing Tier Tests

Tests for tiered pricing model:
- Standard: $19.99 (Overland, Federation Peak)
- Advanced: $29.99 (WA A-K, Eastern Arthurs)
- Expert: $49.99 (WA Full, Combined Arthurs)
- SMS Usage: 50% margin over cost
- Dynamic Grouping: 40-60% segment reduction for CAST7 CAMPS/PEAKS

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

    def test_cast7_camps_segment_count_grouped(self):
        """CAST7 CAMPS with grouping should use ~6 segments (was ~14)"""
        from app.services.pricing import estimate_command_segments

        segments = estimate_command_segments("CAST7_CAMPS")
        # With dynamic grouping, reduced from ~14 to ~6
        assert 4 <= segments <= 8, f"CAST7_CAMPS (grouped) should use ~6 segments, got {segments}"

    def test_cast7_peaks_segment_count_grouped(self):
        """CAST7 PEAKS with grouping should use ~4 segments (was ~10)"""
        from app.services.pricing import estimate_command_segments

        segments = estimate_command_segments("CAST7_PEAKS")
        # With dynamic grouping, reduced from ~10 to ~4
        assert 3 <= segments <= 6, f"CAST7_PEAKS (grouped) should use ~4 segments, got {segments}"
    
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


# =============================================================================
# Dynamic Grouping Statistics Tests (v3.2)
# =============================================================================

class TestGroupingStatistics:
    """
    Test grouping statistics and savings calculations.
    Spec Section 10.4 (v3.2)
    """

    def test_route_grouping_stats_exist(self):
        """All routes should have grouping statistics"""
        from app.services.pricing import get_grouping_stats

        routes = [
            "overland_track",
            "western_arthurs_ak",
            "western_arthurs_full",
            "eastern_arthurs",
            "federation_peak",
            "combined_arthurs",
        ]

        for route_id in routes:
            stats = get_grouping_stats(route_id)
            assert "camps" in stats, f"{route_id} missing camps stat"
            assert "camp_zones" in stats, f"{route_id} missing camp_zones stat"
            assert "peaks" in stats, f"{route_id} missing peaks stat"
            assert "peak_zones" in stats, f"{route_id} missing peak_zones stat"

    def test_grouping_reduces_zones(self):
        """Grouping should result in fewer zones than locations"""
        from app.services.pricing import get_grouping_stats

        stats = get_grouping_stats("western_arthurs_full")

        assert stats["camp_zones"] < stats["camps"], \
            "Camp zones should be fewer than camps"
        assert stats["peak_zones"] < stats["peaks"], \
            "Peak zones should be fewer than peaks"

    def test_estimate_grouping_savings(self):
        """Should calculate savings from grouping"""
        from app.services.pricing import estimate_grouping_savings

        savings = estimate_grouping_savings(
            route_id="western_arthurs_full",
            cast7_camps_count=1,
            cast7_peaks_count=1
        )

        assert savings["segments_saved"] > 0, "Should save segments"
        assert savings["cost_saved"] > 0, "Should save cost"
        assert savings["reduction_pct"] > 40, "Should achieve >40% reduction"

    def test_grouping_savings_camps_only(self):
        """Should calculate savings for CAMPS only usage"""
        from app.services.pricing import estimate_grouping_savings

        savings = estimate_grouping_savings(
            route_id="overland_track",
            cast7_camps_count=2,
            cast7_peaks_count=0
        )

        # 2 CAST7_CAMPS: ungrouped = 28, grouped = 12
        assert savings["ungrouped_segments"] == 28
        assert savings["grouped_segments"] == 12
        assert savings["segments_saved"] == 16

    def test_grouping_savings_peaks_only(self):
        """Should calculate savings for PEAKS only usage"""
        from app.services.pricing import estimate_grouping_savings

        savings = estimate_grouping_savings(
            route_id="western_arthurs_ak",
            cast7_camps_count=0,
            cast7_peaks_count=2
        )

        # 2 CAST7_PEAKS: ungrouped = 20, grouped = 8
        assert savings["ungrouped_segments"] == 20
        assert savings["grouped_segments"] == 8
        assert savings["segments_saved"] == 12

    def test_calculate_actual_reduction(self):
        """Should calculate reduction from actual zone counts"""
        from app.services.pricing import calculate_actual_grouping_reduction

        # Example: 15 camps -> 4 zones
        result = calculate_actual_grouping_reduction(
            locations_count=15,
            zones_count=4,
            segments_per_zone=2
        )

        assert result["locations"] == 15
        assert result["zones"] == 4
        assert result["ungrouped_segments"] == 30  # 15 * 2
        assert result["grouped_segments"] == 8     # 4 * 2
        assert result["segments_saved"] == 22
        assert result["reduction_pct"] > 70

    def test_trip_savings_summary(self):
        """Should provide trip savings summary"""
        from app.services.pricing import get_trip_savings_summary

        summary = get_trip_savings_summary("western_arthurs_full")

        assert summary["route_id"] == "western_arthurs_full"
        assert summary["camps"] > 0
        assert summary["camp_zones"] > 0
        assert summary["segments_saved_per_trip"] > 0
        assert summary["cost_saved_per_trip"] > 0
        assert summary["avg_reduction_pct"] > 50
