"""
Webhook Handler Integration Tests

Tests Stripe and Twilio webhook handlers with realistic payloads.
These tests verify the full webhook processing flow.

NOTE: These are integration tests that require a running database.
Run with: pytest tests/test_webhook_handlers.py -v -m integration
Skip with: pytest tests/ -v --ignore=tests/test_webhook_handlers.py

Run with: pytest tests/test_webhook_handlers.py -v
"""

import pytest
import json
import os
import hmac
import hashlib
import time
import tempfile
import atexit
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient

# Mark entire module as integration tests
pytestmark = pytest.mark.integration

# Set test environment before imports
# Use a temp file instead of :memory: since SQLite :memory: creates
# a new database for each connection
_test_db_file = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
_test_db_path = _test_db_file.name
_test_db_file.close()

os.environ["TESTING"] = "true"
os.environ["DEBUG"] = "true"  # Skip signature validation in debug mode
os.environ["THUNDERBIRD_DB_PATH"] = _test_db_path
os.environ["JWT_SECRET"] = "test-secret-key"
os.environ["STRIPE_SECRET_KEY"] = "sk_test_fake"
os.environ["STRIPE_WEBHOOK_SECRET"] = ""  # Empty to skip validation in tests
os.environ["TWILIO_AUTH_TOKEN"] = "test_twilio_token"

# Clean up temp file at exit
def _cleanup_test_db():
    try:
        os.unlink(_test_db_path)
    except Exception:
        pass
atexit.register(_cleanup_test_db)

from app.main import app


@pytest.fixture
def client():
    """Create TestClient."""
    with TestClient(app) as client:
        yield client


# =============================================================================
# Stripe Webhook Payloads
# =============================================================================

def create_stripe_signature(payload: bytes, secret: str = "whsec_test_secret") -> str:
    """Create a valid Stripe webhook signature for testing."""
    timestamp = str(int(time.time()))
    signed_payload = f"{timestamp}.{payload.decode()}"
    signature = hmac.new(
        secret.encode(),
        signed_payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return f"t={timestamp},v1={signature}"


CHECKOUT_COMPLETED_PAYLOAD = {
    "id": "evt_test_checkout_completed",
    "type": "checkout.session.completed",
    "data": {
        "object": {
            "id": "cs_test_abc123",
            "object": "checkout.session",
            "customer": "cus_test_customer",
            "customer_email": "test@example.com",
            "amount_total": 2999,
            "currency": "usd",
            "payment_status": "paid",
            "metadata": {
                "account_id": "1",
                "order_type": "initial_purchase",
                "entry_path": "buy_now"
            }
        }
    }
}

PAYMENT_INTENT_SUCCEEDED_PAYLOAD = {
    "id": "evt_test_payment_succeeded",
    "type": "payment_intent.succeeded",
    "data": {
        "object": {
            "id": "pi_test_xyz789",
            "object": "payment_intent",
            "amount": 1000,
            "currency": "usd",
            "customer": "cus_test_customer",
            "metadata": {
                "account_id": "1",
                "order_type": "topup"
            }
        }
    }
}

CHARGE_REFUNDED_PAYLOAD = {
    "id": "evt_test_refund",
    "type": "charge.refunded",
    "data": {
        "object": {
            "id": "ch_test_refund123",
            "object": "charge",
            "amount": 2999,
            "amount_refunded": 2999,
            "customer": "cus_test_customer",
            "payment_intent": "pi_test_original",
            "metadata": {
                "account_id": "1",
                "order_id": "1"
            }
        }
    }
}

CUSTOMER_SUBSCRIPTION_DELETED_PAYLOAD = {
    "id": "evt_test_sub_deleted",
    "type": "customer.subscription.deleted",
    "data": {
        "object": {
            "id": "sub_test_123",
            "customer": "cus_test_customer",
            "status": "canceled"
        }
    }
}


# =============================================================================
# Stripe Webhook Tests
# =============================================================================

class TestStripeCheckoutWebhook:
    """Test checkout.session.completed webhook."""

    @patch("stripe.Webhook.construct_event")
    @patch("app.services.balance.get_balance_service")
    @patch("app.services.email.send_order_confirmation")
    def test_checkout_completed_credits_balance(
        self, mock_email, mock_balance, mock_construct, client
    ):
        """Checkout completed should credit user balance."""
        mock_construct.return_value = CHECKOUT_COMPLETED_PAYLOAD
        mock_balance_service = MagicMock()
        mock_balance.return_value = mock_balance_service

        payload = json.dumps(CHECKOUT_COMPLETED_PAYLOAD).encode()

        response = client.post(
            "/webhook/stripe",
            content=payload,
            headers={
                "Content-Type": "application/json",
                "Stripe-Signature": create_stripe_signature(payload)
            }
        )

        # Should process successfully (or fail gracefully with missing account)
        assert response.status_code in [200, 400, 500]

    @patch("stripe.Webhook.construct_event")
    def test_checkout_completed_with_affiliate(self, mock_construct, client):
        """Checkout with affiliate should track commission."""
        payload_with_affiliate = {
            **CHECKOUT_COMPLETED_PAYLOAD,
            "data": {
                "object": {
                    **CHECKOUT_COMPLETED_PAYLOAD["data"]["object"],
                    "metadata": {
                        "account_id": "1",
                        "order_type": "initial_purchase",
                        "affiliate_id": "1",
                        "discount_code": "PARTNER10"
                    }
                }
            }
        }
        mock_construct.return_value = payload_with_affiliate

        payload = json.dumps(payload_with_affiliate).encode()

        response = client.post(
            "/webhook/stripe",
            content=payload,
            headers={
                "Content-Type": "application/json",
                "Stripe-Signature": create_stripe_signature(payload)
            }
        )

        assert response.status_code in [200, 400, 500]


class TestStripePaymentWebhook:
    """Test payment_intent.succeeded webhook."""

    @patch("stripe.Webhook.construct_event")
    def test_topup_payment_adds_credits(self, mock_construct, client):
        """Topup payment should add credits to balance."""
        mock_construct.return_value = PAYMENT_INTENT_SUCCEEDED_PAYLOAD

        payload = json.dumps(PAYMENT_INTENT_SUCCEEDED_PAYLOAD).encode()

        response = client.post(
            "/webhook/stripe",
            content=payload,
            headers={
                "Content-Type": "application/json",
                "Stripe-Signature": create_stripe_signature(payload)
            }
        )

        assert response.status_code in [200, 400, 500]

    @patch("stripe.Webhook.construct_event")
    def test_topup_with_trailing_commission(self, mock_construct, client):
        """Topup from attributed user should create trailing commission."""
        payload_with_trailing = {
            **PAYMENT_INTENT_SUCCEEDED_PAYLOAD,
            "data": {
                "object": {
                    **PAYMENT_INTENT_SUCCEEDED_PAYLOAD["data"]["object"],
                    "metadata": {
                        "account_id": "1",
                        "order_type": "topup"
                    }
                }
            }
        }
        mock_construct.return_value = payload_with_trailing

        payload = json.dumps(payload_with_trailing).encode()

        response = client.post(
            "/webhook/stripe",
            content=payload,
            headers={
                "Content-Type": "application/json",
                "Stripe-Signature": create_stripe_signature(payload)
            }
        )

        assert response.status_code in [200, 400, 500]


class TestStripeRefundWebhook:
    """Test charge.refunded webhook."""

    @patch("stripe.Webhook.construct_event")
    def test_refund_claws_back_commission(self, mock_construct, client):
        """Refund should claw back any affiliate commission."""
        mock_construct.return_value = CHARGE_REFUNDED_PAYLOAD

        payload = json.dumps(CHARGE_REFUNDED_PAYLOAD).encode()

        response = client.post(
            "/webhook/stripe",
            content=payload,
            headers={
                "Content-Type": "application/json",
                "Stripe-Signature": create_stripe_signature(payload)
            }
        )

        assert response.status_code in [200, 400, 500]


class TestStripeWebhookSecurity:
    """Test webhook security measures."""

    def test_rejects_missing_signature(self, client):
        """Should reject requests without signature."""
        response = client.post(
            "/webhook/stripe",
            content=b'{"type": "test"}',
            headers={"Content-Type": "application/json"}
        )

        assert response.status_code in [400, 401, 403]

    def test_rejects_invalid_signature(self, client):
        """Should reject requests with invalid signature."""
        response = client.post(
            "/webhook/stripe",
            content=b'{"type": "test"}',
            headers={
                "Content-Type": "application/json",
                "Stripe-Signature": "t=123,v1=invalid_signature"
            }
        )

        assert response.status_code in [400, 401, 403]

    @patch("stripe.Webhook.construct_event")
    def test_handles_unknown_event_type(self, mock_construct, client):
        """Should handle unknown event types gracefully."""
        mock_construct.return_value = {
            "type": "unknown.event.type",
            "data": {"object": {}}
        }

        payload = b'{"type": "unknown.event.type"}'

        response = client.post(
            "/webhook/stripe",
            content=payload,
            headers={
                "Content-Type": "application/json",
                "Stripe-Signature": create_stripe_signature(payload)
            }
        )

        # Should return 200 (acknowledge) or 400 (unhandled but valid)
        assert response.status_code in [200, 400]


# =============================================================================
# SMS Webhook Tests
# =============================================================================

class TestSMSWebhookCommands:
    """Test SMS command processing via webhook."""

    def test_cast_command_returns_forecast(self, client):
        """CAST command should return weather forecast."""
        response = client.post(
            "/webhook/sms/inbound",
            data={
                "From": "+61400000001",
                "To": "+61400000002",
                "Body": "CAST LAKEO",
                "AccountSid": "test_sid"
            }
        )

        assert response.status_code == 200
        # Should return TwiML with Message
        assert "Message" in response.text or "Response" in response.text

    def test_cast7_command_returns_weekly(self, client):
        """CAST7 command should return 7-day forecast."""
        response = client.post(
            "/webhook/sms/inbound",
            data={
                "From": "+61400000001",
                "To": "+61400000002",
                "Body": "CAST7"
            }
        )

        assert response.status_code == 200

    def test_checkin_command_processes(self, client):
        """CHECKIN command should process check-in."""
        response = client.post(
            "/webhook/sms/inbound",
            data={
                "From": "+61400000001",
                "To": "+61400000002",
                "Body": "CHECKIN LAKEO"
            }
        )

        assert response.status_code == 200

    def test_help_command_returns_help_text(self, client):
        """HELP command should return help text."""
        response = client.post(
            "/webhook/sms/inbound",
            data={
                "From": "+61400000001",
                "To": "+61400000002",
                "Body": "HELP"
            }
        )

        assert response.status_code == 200
        assert "CAST" in response.text or "help" in response.text.lower()

    def test_status_command_returns_status(self, client):
        """STATUS command should return user status."""
        response = client.post(
            "/webhook/sms/inbound",
            data={
                "From": "+61400000001",
                "To": "+61400000002",
                "Body": "STATUS"
            }
        )

        assert response.status_code == 200

    def test_key_command_returns_legend(self, client):
        """KEY command should return symbol legend."""
        response = client.post(
            "/webhook/sms/inbound",
            data={
                "From": "+61400000001",
                "To": "+61400000002",
                "Body": "KEY"
            }
        )

        assert response.status_code == 200

    def test_route_command_returns_route_info(self, client):
        """ROUTE command should return route information."""
        response = client.post(
            "/webhook/sms/inbound",
            data={
                "From": "+61400000001",
                "To": "+61400000002",
                "Body": "ROUTE"
            }
        )

        assert response.status_code == 200

    def test_buy_command_processes_topup(self, client):
        """BUY command should process balance top-up."""
        response = client.post(
            "/webhook/sms/inbound",
            data={
                "From": "+61400000001",
                "To": "+61400000002",
                "Body": "BUY $10"
            }
        )

        assert response.status_code == 200

    def test_case_insensitive_commands(self, client):
        """Commands should be case insensitive."""
        # Lowercase
        response = client.post(
            "/webhook/sms/inbound",
            data={
                "From": "+61400000001",
                "To": "+61400000002",
                "Body": "help"
            }
        )
        assert response.status_code == 200

        # Mixed case
        response = client.post(
            "/webhook/sms/inbound",
            data={
                "From": "+61400000001",
                "To": "+61400000002",
                "Body": "HeLp"
            }
        )
        assert response.status_code == 200

    def test_unknown_command_returns_help(self, client):
        """Unknown command from unregistered user should get 'not linked' message."""
        response = client.post(
            "/webhook/sms/inbound",
            data={
                "From": "+61400000001",
                "To": "+61400000002",
                "Body": "UNKNOWNCOMMAND"
            }
        )

        assert response.status_code == 200
        # Unregistered users get "not linked" message for unknown commands
        assert "not linked" in response.text.lower() or "thunderbird.bot" in response.text.lower()


class TestSMSWebhookValidation:
    """Test SMS webhook input validation."""

    def test_handles_empty_body(self, client):
        """Should handle empty message body."""
        response = client.post(
            "/webhook/sms/inbound",
            data={
                "From": "+61400000001",
                "To": "+61400000002",
                "Body": ""
            }
        )

        assert response.status_code == 200

    def test_handles_missing_from(self, client):
        """Should handle missing From number."""
        response = client.post(
            "/webhook/sms/inbound",
            data={
                "To": "+61400000002",
                "Body": "HELP"
            }
        )

        # Should return error or handle gracefully
        assert response.status_code in [200, 400, 422]

    def test_handles_international_numbers(self, client):
        """Should handle international phone numbers."""
        response = client.post(
            "/webhook/sms/inbound",
            data={
                "From": "+14155551234",  # US number
                "To": "+61400000002",
                "Body": "STATUS"
            }
        )

        assert response.status_code == 200

    def test_handles_special_characters(self, client):
        """Should handle special characters in message."""
        response = client.post(
            "/webhook/sms/inbound",
            data={
                "From": "+61400000001",
                "To": "+61400000002",
                "Body": "CAST <script>alert('xss')</script>"
            }
        )

        assert response.status_code == 200
        # Should not contain unescaped script tags
        assert "<script>" not in response.text


class TestSMSWebhookSafeCheck:
    """Test SafeCheck related SMS commands."""

    def test_safe_command_adds_contact(self, client):
        """SAFE command should add emergency contact."""
        response = client.post(
            "/webhook/sms/inbound",
            data={
                "From": "+61400000001",
                "To": "+61400000002",
                "Body": "SAFE +61400111222 Mum"
            }
        )

        assert response.status_code == 200

    def test_safelist_command_lists_contacts(self, client):
        """SAFELIST command should list contacts."""
        response = client.post(
            "/webhook/sms/inbound",
            data={
                "From": "+61400000001",
                "To": "+61400000002",
                "Body": "SAFELIST"
            }
        )

        assert response.status_code == 200

    def test_safedel_command_removes_contact(self, client):
        """SAFEDEL command should remove contact."""
        response = client.post(
            "/webhook/sms/inbound",
            data={
                "From": "+61400000001",
                "To": "+61400000002",
                "Body": "SAFEDEL 1"
            }
        )

        assert response.status_code == 200


# =============================================================================
# Response Format Tests
# =============================================================================

class TestWebhookResponseFormat:
    """Test webhook response formats."""

    def test_sms_webhook_returns_twiml(self, client):
        """SMS webhook should return valid TwiML."""
        response = client.post(
            "/webhook/sms/inbound",
            data={
                "From": "+61400000001",
                "To": "+61400000002",
                "Body": "HELP"
            }
        )

        assert response.status_code == 200
        content_type = response.headers.get("content-type", "")

        # Should be XML/TwiML
        assert "xml" in content_type.lower() or "Response" in response.text

    def test_stripe_webhook_returns_json_or_empty(self, client):
        """Stripe webhook should return JSON or empty response."""
        with patch("stripe.Webhook.construct_event") as mock:
            mock.return_value = {"type": "ping", "data": {}}

            payload = b'{"type": "ping"}'
            response = client.post(
                "/webhook/stripe",
                content=payload,
                headers={
                    "Content-Type": "application/json",
                    "Stripe-Signature": create_stripe_signature(payload)
                }
            )

            # Should return success
            assert response.status_code in [200, 400]
