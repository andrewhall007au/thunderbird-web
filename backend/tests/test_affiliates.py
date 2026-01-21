"""
Tests for affiliate functionality.

Covers AFFL-01 through AFFL-07 requirements.
"""
import pytest
import os
import tempfile
import sqlite3
from datetime import datetime, timedelta

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))


@pytest.fixture
def test_db():
    """Create a temporary database for tests."""
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
        db_path = f.name

    # Set environment variable before importing models
    os.environ["THUNDERBIRD_DB_PATH"] = db_path

    # Create affiliate tables
    conn = sqlite3.connect(db_path)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS affiliates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            discount_percent INTEGER DEFAULT 0,
            commission_percent INTEGER DEFAULT 20,
            trailing_months INTEGER,
            payout_method TEXT,
            payout_details TEXT,
            active INTEGER DEFAULT 1,
            created_at TEXT,
            last_milestone_cents INTEGER
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS commissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            affiliate_id INTEGER NOT NULL,
            account_id INTEGER NOT NULL,
            order_id INTEGER NOT NULL,
            amount_cents INTEGER NOT NULL,
            status TEXT DEFAULT 'pending',
            sub_id TEXT,
            created_at TEXT,
            available_at TEXT,
            paid_at TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS affiliate_attributions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            affiliate_id INTEGER NOT NULL,
            account_id INTEGER UNIQUE NOT NULL,
            order_id INTEGER NOT NULL,
            sub_id TEXT,
            trailing_expires_at TEXT,
            created_at TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS affiliate_clicks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            affiliate_id INTEGER NOT NULL,
            sub_id TEXT,
            session_id TEXT,
            created_at TEXT
        )
    """)
    conn.commit()
    conn.close()

    # Reset model singletons to use new db path
    from app.models import affiliates as aff_module
    aff_module.affiliate_store = aff_module.AffiliateStore(db_path)
    aff_module.commission_store = aff_module.CommissionStore(db_path)
    aff_module.attribution_store = aff_module.AttributionStore(db_path)
    aff_module.click_store = aff_module.ClickStore(db_path)

    # Also update the references that were imported into the services module
    from app.services import affiliates as svc_module
    svc_module.affiliate_store = aff_module.affiliate_store
    svc_module.commission_store = aff_module.commission_store
    svc_module.attribution_store = aff_module.attribution_store
    svc_module.click_store = aff_module.click_store
    # Reset service singleton so it picks up new stores
    svc_module._affiliate_service = None

    yield db_path

    # Cleanup
    os.unlink(db_path)


class TestAffiliateModels:
    """Test affiliate model CRUD operations."""

    def test_create_affiliate(self, test_db):
        """AFFL-01: Admin can create affiliates."""
        from app.models.affiliates import affiliate_store

        affiliate = affiliate_store.create(
            code="HIKER20",
            name="Test Hiker",
            email="test@example.com",
            discount_percent=20,
            commission_percent=20,
            trailing_months=12
        )

        assert affiliate.id is not None
        assert affiliate.code == "HIKER20"
        assert affiliate.commission_percent == 20
        assert affiliate.trailing_months == 12

    def test_affiliate_code_unique(self, test_db):
        """Affiliate codes must be unique."""
        from app.models.affiliates import affiliate_store

        affiliate_store.create(code="UNIQUE1", name="First", email="a@b.com")

        with pytest.raises(sqlite3.IntegrityError):
            affiliate_store.create(code="UNIQUE1", name="Second", email="c@d.com")

    def test_get_affiliate_by_code(self, test_db):
        """Can look up affiliate by code (case-insensitive)."""
        from app.models.affiliates import affiliate_store

        affiliate_store.create(code="LOOKUP", name="Test", email="t@e.com")

        found = affiliate_store.get_by_code("lookup")  # lowercase
        assert found is not None
        assert found.code == "LOOKUP"

    def test_configurable_terms(self, test_db):
        """AFFL-02: Each affiliate has configurable terms."""
        from app.models.affiliates import affiliate_store

        # Different discount/commission/trailing for each
        a1 = affiliate_store.create(
            code="A1", name="A1", email="a1@t.com",
            discount_percent=10, commission_percent=15, trailing_months=6
        )
        a2 = affiliate_store.create(
            code="A2", name="A2", email="a2@t.com",
            discount_percent=25, commission_percent=30, trailing_months=None
        )

        assert a1.discount_percent == 10
        assert a1.commission_percent == 15
        assert a1.trailing_months == 6

        assert a2.discount_percent == 25
        assert a2.trailing_months is None  # Forever


class TestCommissionCalculation:
    """Test commission calculation logic."""

    def test_commission_on_paid_price(self, test_db):
        """AFFL-04: Commission on actual paid price (post-discount)."""
        from app.models.affiliates import affiliate_store
        from app.services.affiliates import AffiliateService

        affiliate = affiliate_store.create(
            code="CALC20", name="Test", email="t@e.com",
            commission_percent=20
        )

        service = AffiliateService()

        # $29.99 purchase with 20% commission = $5.998 -> $5.99
        result = service.calculate_commission(
            affiliate_id=affiliate.id,
            account_id=1,
            order_id=1,
            amount_cents=2999  # Post-discount amount
        )

        assert result is not None
        assert result.amount_cents == 599  # 20% of 2999 = 599.8 -> 599

    def test_commission_30_day_hold(self, test_db):
        """Commission has 30-day pending period."""
        from app.models.affiliates import affiliate_store, commission_store
        from app.services.affiliates import AffiliateService

        affiliate = affiliate_store.create(code="HOLD", name="Test", email="t@e.com")
        service = AffiliateService()

        result = service.calculate_commission(
            affiliate_id=affiliate.id,
            account_id=1,
            order_id=1,
            amount_cents=1000
        )

        commission = commission_store.get_by_id(result.id)
        assert commission.status == "pending"

        # available_at should be ~30 days from now
        assert commission.available_at is not None
        expected = datetime.utcnow() + timedelta(days=30)
        assert abs((commission.available_at - expected).total_seconds()) < 60  # Within 1 minute


class TestTrailingCommission:
    """Test trailing commission on top-ups."""

    def test_trailing_commission_created(self, test_db):
        """AFFL-05: Trailing commission on top-ups within duration."""
        from app.models.affiliates import affiliate_store
        from app.services.affiliates import AffiliateService

        affiliate = affiliate_store.create(
            code="TRAIL", name="Test", email="t@e.com",
            trailing_months=12
        )

        service = AffiliateService()

        # Create initial attribution
        service.create_attribution(
            affiliate_id=affiliate.id,
            account_id=100,
            order_id=1
        )

        # Check attribution is active
        attribution = service.get_active_attribution(100)
        assert attribution is not None
        assert attribution.affiliate_id == affiliate.id

    def test_trailing_expires(self, test_db):
        """Trailing commission expires after configured duration."""
        from app.models.affiliates import affiliate_store, attribution_store
        from app.services.affiliates import AffiliateService

        affiliate = affiliate_store.create(
            code="EXP", name="Test", email="t@e.com",
            trailing_months=1  # 1 month
        )

        service = AffiliateService()

        # Create attribution that expired (manually set past date)
        past_date = (datetime.utcnow() - timedelta(days=60)).isoformat()

        # Use store directly to create expired attribution
        conn = sqlite3.connect(test_db)
        conn.execute(
            """INSERT INTO affiliate_attributions
               (affiliate_id, account_id, order_id, trailing_expires_at, created_at)
               VALUES (?, ?, ?, ?, ?)""",
            (affiliate.id, 200, 2, past_date, datetime.utcnow().isoformat())
        )
        conn.commit()
        conn.close()

        # Should return None (expired)
        result = service.get_active_attribution(200)
        assert result is None


class TestRefundClawback:
    """Test commission clawback on refunds."""

    def test_clawback_on_refund(self, test_db):
        """Commissions clawed back when order refunded."""
        from app.models.affiliates import affiliate_store, commission_store
        from app.services.affiliates import AffiliateService

        affiliate = affiliate_store.create(code="CLAW", name="Test", email="t@e.com")
        service = AffiliateService()

        # Create commission
        result = service.calculate_commission(
            affiliate_id=affiliate.id,
            account_id=1,
            order_id=999,
            amount_cents=1000
        )

        # Verify commission exists
        commission = commission_store.get_by_id(result.id)
        assert commission.status == "pending"

        # Clawback
        success = service.clawback_commission(order_id=999)
        assert success is True

        # Verify status changed
        commission = commission_store.get_by_id(result.id)
        assert commission.status == "clawed_back"


class TestPayouts:
    """Test payout request and processing."""

    def test_payout_minimum(self, test_db):
        """AFFL-07: $50 minimum for payout."""
        from app.models.affiliates import affiliate_store
        from app.services.affiliates import AffiliateService

        affiliate = affiliate_store.create(
            code="MIN", name="Test", email="t@e.com",
            payout_method="paypal", payout_details="test@paypal.com"
        )

        service = AffiliateService()

        # Try to request payout with $0 available
        success, message = service.request_payout(affiliate.id)
        assert success is False
        assert "Minimum" in message or "50" in message

    def test_payout_request_flow(self, test_db):
        """Full payout request flow."""
        from app.models.affiliates import affiliate_store, commission_store
        from app.services.affiliates import AffiliateService

        affiliate = affiliate_store.create(
            code="FLOW", name="Test", email="t@e.com",
            payout_method="paypal", payout_details="test@paypal.com"
        )

        # Create available commission ($60) - insert directly with status="available"
        conn = sqlite3.connect(test_db)
        now = datetime.utcnow().isoformat()
        conn.execute(
            """INSERT INTO commissions
               (affiliate_id, account_id, order_id, amount_cents, status, created_at, available_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (affiliate.id, 1, 1, 6000, "available", now, now)
        )
        conn.commit()
        conn.close()

        service = AffiliateService()

        # Request payout
        success, message = service.request_payout(affiliate.id)
        assert success is True

        # Verify commission status changed to requested
        commissions = commission_store.get_by_affiliate_id(affiliate.id, status="requested")
        assert len(commissions) >= 1
        assert commissions[0].status == "requested"


class TestClickTracking:
    """Test click recording and deduplication."""

    def test_click_recorded(self, test_db):
        """Clicks are recorded for analytics."""
        from app.models.affiliates import affiliate_store, click_store
        from app.services.affiliates import AffiliateService

        affiliate = affiliate_store.create(code="CLICK", name="Test", email="t@e.com")
        service = AffiliateService()

        result = service.record_click("CLICK", session_id="sess1", sub_id="youtube")
        assert result is not None  # Returns AffiliateClick object

        clicks = click_store.count_by_affiliate(affiliate.id)
        assert clicks >= 1

    def test_click_deduplication(self, test_db):
        """Same session_id within 24h not counted twice."""
        from app.models.affiliates import affiliate_store
        from app.services.affiliates import AffiliateService

        affiliate_store.create(code="DEDUP", name="Test", email="t@e.com")
        service = AffiliateService()

        # First click
        result1 = service.record_click("DEDUP", session_id="same-session")
        assert result1 is not None  # First click recorded

        # Second click with same session
        result2 = service.record_click("DEDUP", session_id="same-session")
        assert result2 is None  # Deduplicated

        # Different session
        result3 = service.record_click("DEDUP", session_id="different-session")
        assert result3 is not None  # New session recorded


class TestAffiliateStats:
    """Test affiliate statistics and dashboard data."""

    def test_get_affiliate_stats(self, test_db):
        """Stats include clicks, conversions, and commission breakdown."""
        from app.models.affiliates import affiliate_store
        from app.services.affiliates import AffiliateService

        affiliate = affiliate_store.create(code="STATS", name="Test", email="t@e.com")
        service = AffiliateService()

        # Record some clicks
        service.record_click("STATS", session_id="s1")
        service.record_click("STATS", session_id="s2")

        # Create a commission
        service.calculate_commission(
            affiliate_id=affiliate.id,
            account_id=1,
            order_id=1,
            amount_cents=1000
        )

        # Get stats
        stats = service.get_affiliate_stats(affiliate.id)
        assert stats is not None
        assert stats.total_clicks >= 2
        assert stats.total_conversions >= 1
        assert stats.pending_cents >= 200  # 20% of 1000


class TestMilestones:
    """Test milestone checking and notifications."""

    def test_milestone_detection(self, test_db):
        """Milestones are detected when thresholds are crossed."""
        from app.models.affiliates import affiliate_store, commission_store
        from app.services.affiliates import AffiliateService

        affiliate = affiliate_store.create(code="MILE", name="Test", email="t@e.com")

        # Create commission that brings total to $50
        conn = sqlite3.connect(test_db)
        now = datetime.utcnow().isoformat()
        conn.execute(
            """INSERT INTO commissions
               (affiliate_id, account_id, order_id, amount_cents, status, created_at, available_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (affiliate.id, 1, 1, 5000, "pending", now, now)
        )
        conn.commit()
        conn.close()

        service = AffiliateService()

        # Check milestone
        milestone = service.check_milestones(affiliate.id)
        assert milestone == 5000  # $50 threshold


# Run with: pytest backend/tests/test_affiliates.py -v
if __name__ == "__main__":
    pytest.main([__file__, "-v"])
