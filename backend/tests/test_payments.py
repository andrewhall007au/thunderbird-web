"""
Tests for payment endpoints and webhook handling.

PAY-01, PAY-03, PAY-06, PAY-07
"""
import pytest
import os
import uuid
import json
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

# Set up test environment before importing app
os.environ.setdefault("THUNDERBIRD_DB_PATH", ":memory:")
os.environ.setdefault("DEBUG", "true")
os.environ.setdefault("JWT_SECRET", "test-secret-key-for-testing")

from app.main import app

client = TestClient(app)


class TestPaymentEndpoints:
    """Test payment API endpoints - authentication requirements."""

    def test_checkout_requires_auth(self):
        """Checkout endpoint requires authentication."""
        response = client.post("/api/payments/checkout", json={})
        assert response.status_code == 401

    def test_balance_requires_auth(self):
        """Balance endpoint requires authentication."""
        response = client.get("/api/payments/balance")
        assert response.status_code == 401

    def test_topup_requires_auth(self):
        """Topup endpoint requires authentication."""
        response = client.post("/api/payments/topup", json={})
        assert response.status_code == 401

    def test_orders_requires_auth(self):
        """Orders endpoint requires authentication."""
        response = client.get("/api/payments/orders")
        assert response.status_code == 401


class TestPricingService:
    """Test dynamic pricing service."""

    def test_launch_price(self):
        """Launch mode returns $29.99."""
        from app.services.pricing_dynamic import get_pricing_service
        svc = get_pricing_service()
        assert svc.get_base_price_cents() == 2999

    def test_discount_calculation_no_discount(self):
        """No discount code returns original price."""
        from app.services.pricing_dynamic import get_pricing_service
        svc = get_pricing_service()
        calc = svc.calculate_final_price(2999, None)
        assert calc.final_price_cents == 2999

    def test_get_checkout_price_format(self):
        """Checkout price returns proper structure."""
        from app.services.pricing_dynamic import get_pricing_service
        svc = get_pricing_service()
        price = svc.get_checkout_price(None)
        assert hasattr(price, 'final_price_cents')
        assert price.final_price_cents > 0


class TestBalanceService:
    """Test balance tracking service.

    Note: Tests that require database tables are marked with
    pytest.mark.skip since the test database doesn't have tables.
    Full integration tests require running Alembic migrations first.
    """

    def test_balance_service_exists(self):
        """Balance service can be instantiated."""
        from app.services.balance import get_balance_service, BalanceService
        svc = get_balance_service()
        assert isinstance(svc, BalanceService)

    def test_balance_service_methods_exist(self):
        """Balance service has required methods."""
        from app.services.balance import get_balance_service
        svc = get_balance_service()

        assert hasattr(svc, 'get_balance')
        assert hasattr(svc, 'add_credits')
        assert hasattr(svc, 'deduct')
        assert hasattr(svc, 'get_balance_display')

    def test_add_credits_validates_amount(self):
        """add_credits rejects zero/negative amounts."""
        from app.services.balance import BalanceService
        from unittest.mock import MagicMock

        # Create service with mock store
        mock_store = MagicMock()
        mock_store.get_balance.return_value = 1000
        svc = BalanceService(store=mock_store)

        # Zero amount
        result = svc.add_credits(1, 0, "Test")
        assert not result.success
        assert "positive" in result.error.lower()

        # Negative amount
        result = svc.add_credits(1, -100, "Test")
        assert not result.success
        assert "positive" in result.error.lower()

    def test_deduct_validates_amount(self):
        """deduct rejects zero/negative amounts."""
        from app.services.balance import BalanceService
        from unittest.mock import MagicMock

        mock_store = MagicMock()
        mock_store.get_balance.return_value = 1000
        svc = BalanceService(store=mock_store)

        # Zero amount
        result = svc.deduct(1, 0, "Test")
        assert not result.success
        assert "positive" in result.error.lower()

        # Negative amount
        result = svc.deduct(1, -100, "Test")
        assert not result.success
        assert "positive" in result.error.lower()


class TestStripeWebhook:
    """Test Stripe webhook handling."""

    def test_webhook_endpoint_exists(self):
        """Webhook endpoint is registered."""
        response = client.post(
            "/webhook/stripe",
            content=b"{}",
            headers={"Content-Type": "application/json"}
        )
        # Will fail validation but endpoint exists (not 404)
        assert response.status_code != 404

    def test_webhook_handles_invalid_json(self):
        """Webhook handles invalid JSON gracefully."""
        response = client.post(
            "/webhook/stripe",
            content=b"not valid json",
            headers={"Content-Type": "application/json"}
        )
        # Should return 400 or 500, not crash
        assert response.status_code in [400, 500]


class TestPaymentRouterRegistration:
    """Test payment router is properly registered."""

    def test_payment_routes_exist(self):
        """Payment routes are registered in the app."""
        routes = [r.path for r in app.routes]
        payment_routes = [r for r in routes if '/api/payments' in r]

        assert len(payment_routes) >= 4  # checkout, balance, topup, orders
        assert any('/checkout' in r for r in routes)
        assert any('/balance' in r for r in routes)
        assert any('/topup' in r for r in routes)
        assert any('/orders' in r for r in routes)


class TestAccountStoreStripeCustomerId:
    """Test AccountStore Stripe customer ID methods."""

    def test_update_stripe_customer_id_exists(self):
        """update_stripe_customer_id method exists."""
        from app.models.account import AccountStore
        store = AccountStore()
        assert hasattr(store, 'update_stripe_customer_id')
        assert callable(getattr(store, 'update_stripe_customer_id'))

    def test_get_stripe_customer_id_exists(self):
        """get_stripe_customer_id method exists."""
        from app.models.account import AccountStore
        store = AccountStore()
        assert hasattr(store, 'get_stripe_customer_id')
        assert callable(getattr(store, 'get_stripe_customer_id'))
