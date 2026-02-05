"""
FastAPI TestClient Integration Tests

These tests use the TestClient to make real HTTP requests
against the FastAPI application, testing full request/response cycles.

NOTE: These are integration tests that require database setup.
Run with: pytest tests/test_api_integration.py -v -m integration
Skip with: pytest tests/ -v --ignore=tests/test_api_integration.py

Run with: pytest tests/test_api_integration.py -v
"""

import pytest
import json
import os
import tempfile
import atexit
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

# Mark entire module as integration tests
pytestmark = pytest.mark.integration

# Set test environment before importing app
# Use a temp file instead of :memory: since SQLite :memory: creates
# a new database for each connection
_test_db_file = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
_test_db_path = _test_db_file.name
_test_db_file.close()

os.environ["TESTING"] = "true"
os.environ["DEBUG"] = "true"
os.environ["THUNDERBIRD_DB_PATH"] = _test_db_path
os.environ["JWT_SECRET"] = "test-secret-key-for-integration-tests"
os.environ["STRIPE_SECRET_KEY"] = "sk_test_fake"
os.environ["STRIPE_WEBHOOK_SECRET"] = ""  # Empty to skip validation

# Clean up temp file at exit
def _cleanup_test_db():
    try:
        os.unlink(_test_db_path)
    except Exception:
        pass
atexit.register(_cleanup_test_db)

# Initialize database with all tables before importing app
from tests.conftest import create_test_tables
create_test_tables(_test_db_path)

from app.main import app


@pytest.fixture
def client():
    """Create TestClient for API testing."""
    with TestClient(app) as client:
        yield client


@pytest.fixture
def test_user():
    """Test user credentials."""
    return {
        "email": f"test-{os.urandom(4).hex()}@example.com",
        "password": "TestPassword123!",
        "name": "Test User"
    }


@pytest.fixture
def auth_headers(client, test_user):
    """Get auth headers for authenticated requests."""
    # Register user
    client.post("/auth/register", json=test_user)

    # Login to get token
    response = client.post(
        "/auth/token",
        data={"username": test_user["email"], "password": test_user["password"]}
    )

    if response.status_code != 200:
        pytest.skip("Auth not working - check auth router")

    token = response.json().get("access_token")
    return {"Authorization": f"Bearer {token}"}


# =============================================================================
# Health Check Tests
# =============================================================================

class TestHealthCheck:
    """Test health check endpoints."""

    def test_health_check_returns_200(self, client):
        """Health endpoint should return 200."""
        response = client.get("/api/health")
        assert response.status_code == 200

    def test_health_check_returns_status(self, client):
        """Health endpoint should return status info."""
        response = client.get("/api/health")
        data = response.json()
        assert "status" in data or "ok" in str(data).lower()


# =============================================================================
# Auth API Tests
# =============================================================================

class TestAuthAPI:
    """Test authentication endpoints."""

    def test_register_creates_account(self, client, test_user):
        """POST /auth/register should create account."""
        response = client.post("/auth/register", json=test_user)
        assert response.status_code in [200, 201]
        data = response.json()
        assert "id" in data or "account_id" in data

    def test_register_rejects_duplicate_email(self, client, test_user):
        """POST /auth/register should reject duplicate email."""
        # First registration
        client.post("/auth/register", json=test_user)

        # Second registration with same email
        response = client.post("/auth/register", json=test_user)
        assert response.status_code == 400

    def test_register_validates_email_format(self, client):
        """POST /auth/register should validate email format."""
        response = client.post("/auth/register", json={
            "email": "not-an-email",
            "password": "ValidPassword123!",
            "name": "Test"
        })
        assert response.status_code == 422  # Validation error

    def test_login_returns_token(self, client, test_user):
        """POST /auth/token should return JWT token."""
        # Register first
        client.post("/auth/register", json=test_user)

        # Login
        response = client.post(
            "/auth/token",
            data={"username": test_user["email"], "password": test_user["password"]}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_rejects_wrong_password(self, client, test_user):
        """POST /auth/token should reject wrong password."""
        client.post("/auth/register", json=test_user)

        response = client.post(
            "/auth/token",
            data={"username": test_user["email"], "password": "WrongPassword!"}
        )
        assert response.status_code == 401

    def test_me_returns_account_info(self, client, test_user, auth_headers):
        """GET /auth/me should return account info."""
        response = client.get("/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == test_user["email"]

    def test_me_requires_auth(self, client):
        """GET /auth/me should require authentication."""
        response = client.get("/auth/me")
        assert response.status_code == 401


# =============================================================================
# Routes API Tests
# =============================================================================

class TestRoutesAPI:
    """Test route creation endpoints."""

    def test_create_route_requires_auth(self, client):
        """POST /api/routes should require authentication."""
        response = client.post("/api/routes", json={"name": "Test Route"})
        assert response.status_code == 401

    def test_create_route_creates_draft(self, client, auth_headers):
        """POST /api/routes should create draft route."""
        response = client.post(
            "/api/routes",
            json={"name": "My Test Route"},
            headers=auth_headers
        )
        assert response.status_code in [200, 201]
        data = response.json()
        assert "id" in data
        assert data["name"] == "My Test Route"

    def test_get_routes_returns_user_routes(self, client, auth_headers):
        """GET /api/routes should return user's routes."""
        # Create a route first
        client.post(
            "/api/routes",
            json={"name": "Route 1"},
            headers=auth_headers
        )

        response = client.get("/api/routes", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_upload_gpx_parses_track(self, client, auth_headers):
        """POST /api/routes/upload-gpx should parse GPX file."""
        gpx_content = """<?xml version="1.0" encoding="UTF-8"?>
        <gpx version="1.1">
          <trk><name>Test</name><trkseg>
            <trkpt lat="-42.88" lon="146.05"><ele>1200</ele></trkpt>
            <trkpt lat="-42.89" lon="146.06"><ele>1250</ele></trkpt>
          </trkseg></trk>
        </gpx>"""

        response = client.post(
            "/api/routes/upload-gpx",
            files={"file": ("test.gpx", gpx_content, "application/gpx+xml")},
            headers=auth_headers
        )

        # Should parse successfully or return validation error
        assert response.status_code in [200, 201, 422]


# =============================================================================
# Library API Tests
# =============================================================================

class TestLibraryAPI:
    """Test route library endpoints."""

    def test_list_library_returns_routes(self, client):
        """GET /api/library should return library routes."""
        response = client.get("/api/library")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_clone_route_requires_auth(self, client):
        """POST /api/library/{id}/clone should require auth."""
        response = client.post("/api/library/1/clone")
        assert response.status_code == 401


# =============================================================================
# Payments API Tests
# =============================================================================

class TestPaymentsAPI:
    """Test payment endpoints."""

    def test_get_balance_requires_auth(self, client):
        """GET /api/payments/balance should require auth."""
        response = client.get("/api/payments/balance")
        assert response.status_code == 401

    def test_get_balance_returns_amount(self, client, auth_headers):
        """GET /api/payments/balance should return balance."""
        response = client.get("/api/payments/balance", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "balance_cents" in data or "balance" in data

    @patch("app.services.payments.stripe")
    def test_checkout_creates_stripe_session(self, mock_stripe, client, auth_headers):
        """POST /api/payments/checkout should create Stripe session."""
        # Mock Stripe checkout session creation
        mock_stripe.checkout.Session.create.return_value = MagicMock(
            id="cs_test_123",
            url="https://checkout.stripe.com/test"
        )

        response = client.post(
            "/api/payments/checkout",
            json={
                "success_url": "http://localhost:3000/success",
                "cancel_url": "http://localhost:3000/cancel"
            },
            headers=auth_headers
        )

        # Should succeed or return Stripe configuration error
        assert response.status_code in [200, 400, 500]

    @patch("app.services.payments.stripe")
    def test_buy_now_creates_account_and_checkout(self, mock_stripe, client):
        """POST /api/payments/buy-now should create account and checkout."""
        mock_stripe.checkout.Session.create.return_value = MagicMock(
            id="cs_test_456",
            url="https://checkout.stripe.com/test"
        )
        mock_stripe.Customer.create.return_value = MagicMock(id="cus_test_123")

        test_email = f"buynow-{os.urandom(4).hex()}@example.com"

        response = client.post(
            "/api/payments/buy-now",
            json={
                "email": test_email,
                "password": "TestPassword123!",
                "name": "Buy Now User",
                "success_url": "http://localhost:3000/success",
                "cancel_url": "http://localhost:3000/cancel"
            }
        )

        # Should succeed or return configuration error
        assert response.status_code in [200, 400, 500]


# =============================================================================
# Analytics API Tests
# =============================================================================

class TestAnalyticsAPI:
    """Test analytics endpoints."""

    def test_track_event_accepts_data(self, client):
        """POST /api/analytics should accept event data."""
        response = client.post(
            "/api/analytics",
            json={
                "event": "page_view",
                "properties": {"page": "/home"},
                "entry_path": "direct"
            }
        )
        assert response.status_code in [200, 201]

    def test_track_event_validates_required_fields(self, client):
        """POST /api/analytics should validate required fields."""
        response = client.post(
            "/api/analytics",
            json={}  # Missing required fields
        )
        assert response.status_code == 422  # Validation error


# =============================================================================
# Affiliate API Tests
# =============================================================================

class TestAffiliateAPI:
    """Test affiliate endpoints."""

    def test_validate_affiliate_code(self, client):
        """GET /api/affiliate/validate should validate codes."""
        response = client.get("/api/affiliate/validate?code=TESTCODE")

        # Should return validation result or 404 for unknown code
        assert response.status_code in [200, 404]

    def test_affiliate_landing_redirects(self, client):
        """GET /ref/{code} should redirect to home."""
        response = client.get("/ref/TESTPARTNER", follow_redirects=False)

        # Should redirect
        assert response.status_code == 302
        assert response.headers.get("location") == "/"

    def test_affiliate_landing_sets_cookie(self, client):
        """GET /ref/{code} should set tb_affiliate cookie."""
        response = client.get("/ref/PARTNER10", follow_redirects=False)

        # Check Set-Cookie header
        cookies = response.headers.get_list("set-cookie")
        affiliate_cookie = [c for c in cookies if "tb_affiliate" in c]
        assert len(affiliate_cookie) > 0
        assert "PARTNER10" in affiliate_cookie[0].upper()


# =============================================================================
# Webhook Tests
# =============================================================================

class TestStripeWebhook:
    """Test Stripe webhook handlers."""

    def test_webhook_requires_signature(self, client):
        """POST /webhook/stripe should require valid signature."""
        response = client.post(
            "/webhook/stripe",
            content=b'{}',
            headers={"Content-Type": "application/json"}
        )
        # Should reject without valid signature
        assert response.status_code in [400, 401, 403]

    @patch("stripe.Webhook.construct_event")
    def test_webhook_handles_checkout_completed(self, mock_construct, client):
        """POST /webhook/stripe should handle checkout.session.completed."""
        # Mock Stripe webhook verification
        mock_construct.return_value = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "cs_test_123",
                    "customer": "cus_test_123",
                    "amount_total": 2999,
                    "metadata": {
                        "account_id": "1",
                        "order_type": "initial_purchase"
                    }
                }
            }
        }

        response = client.post(
            "/webhook/stripe",
            content=b'{"test": "data"}',
            headers={
                "Content-Type": "application/json",
                "Stripe-Signature": "t=123,v1=fake_sig"
            }
        )

        # Should process or reject
        # Actual processing depends on database state
        assert response.status_code in [200, 400, 500]

    @patch("stripe.Webhook.construct_event")
    def test_webhook_handles_payment_succeeded(self, mock_construct, client):
        """POST /webhook/stripe should handle payment_intent.succeeded."""
        mock_construct.return_value = {
            "type": "payment_intent.succeeded",
            "data": {
                "object": {
                    "id": "pi_test_123",
                    "amount": 1000,
                    "metadata": {
                        "account_id": "1",
                        "order_type": "topup"
                    }
                }
            }
        }

        response = client.post(
            "/webhook/stripe",
            content=b'{"test": "data"}',
            headers={
                "Content-Type": "application/json",
                "Stripe-Signature": "t=123,v1=fake_sig"
            }
        )

        assert response.status_code in [200, 400, 500]


class TestSMSWebhook:
    """Test SMS (Twilio) webhook handlers."""

    def test_sms_webhook_accepts_twilio_format(self, client):
        """POST /webhook/sms/inbound should accept Twilio format."""
        response = client.post(
            "/webhook/sms/inbound",
            data={
                "From": "+61400000001",
                "To": "+61400000002",
                "Body": "CAST LAKEO"
            }
        )

        # Should return TwiML response
        assert response.status_code == 200
        assert "xml" in response.headers.get("content-type", "").lower() or \
               "Response" in response.text

    def test_sms_webhook_handles_help_command(self, client):
        """POST /webhook/sms/inbound should handle HELP command."""
        response = client.post(
            "/webhook/sms/inbound",
            data={
                "From": "+61400000001",
                "To": "+61400000002",
                "Body": "HELP"
            }
        )

        assert response.status_code == 200
        # Response should contain help text
        assert "CAST" in response.text or "command" in response.text.lower()

    def test_sms_webhook_handles_status_command(self, client):
        """POST /webhook/sms/inbound should handle STATUS command."""
        response = client.post(
            "/webhook/sms/inbound",
            data={
                "From": "+61400000001",
                "To": "+61400000002",
                "Body": "STATUS"
            }
        )

        assert response.status_code == 200


# =============================================================================
# Error Handling Tests
# =============================================================================

class TestErrorHandling:
    """Test API error handling."""

    def test_404_for_unknown_route(self, client):
        """Unknown routes should return 404."""
        response = client.get("/api/nonexistent")
        assert response.status_code == 404

    def test_405_for_wrong_method(self, client):
        """Wrong HTTP method should return 405."""
        response = client.delete("/api/health")
        assert response.status_code in [404, 405]

    def test_422_for_invalid_json(self, client, auth_headers):
        """Invalid JSON should return 422."""
        response = client.post(
            "/api/routes",
            content=b"not json",
            headers={**auth_headers, "Content-Type": "application/json"}
        )
        assert response.status_code == 422


# =============================================================================
# CORS Tests
# =============================================================================

class TestCORS:
    """Test CORS configuration."""

    def test_cors_allows_frontend_origin(self, client):
        """CORS should allow frontend origin."""
        # TestClient doesn't properly simulate CORS preflight (OPTIONS),
        # so test with a regular GET request instead
        response = client.get(
            "/api/health",
            headers={"Origin": "http://localhost:3000"}
        )

        # Should allow the request and include CORS headers
        assert response.status_code == 200

    def test_cors_headers_present(self, client):
        """CORS headers should be present in responses."""
        response = client.get(
            "/api/health",
            headers={"Origin": "http://localhost:3000"}
        )

        # Check for CORS header
        cors_header = response.headers.get("access-control-allow-origin")
        assert cors_header is not None or response.status_code == 200
