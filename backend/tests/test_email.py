"""
Tests for email service (Resend).
"""
import pytest
from unittest.mock import patch, MagicMock
import asyncio

from app.services.email import EmailService, get_email_service, EmailResult


class TestEmailService:
    """Test email service functionality."""

    def test_not_configured_without_api_key(self):
        """Service reports not configured without API key."""
        with patch('app.services.email.settings') as mock_settings:
            mock_settings.RESEND_API_KEY = ""
            mock_settings.RESEND_FROM_EMAIL = "test@test.com"
            service = EmailService()
            assert not service.is_configured()

    def test_handles_missing_config_gracefully(self):
        """Send methods return error when not configured."""
        with patch('app.services.email.settings') as mock_settings:
            mock_settings.RESEND_API_KEY = ""
            mock_settings.RESEND_FROM_EMAIL = "test@test.com"
            service = EmailService()

            result = asyncio.run(service.send_order_confirmation(
                "test@test.com", "+1234567890", 2999, 100
            ))

            assert not result.success
            assert "not configured" in result.error.lower()

    @patch('resend.Emails')
    def test_send_order_confirmation_success(self, mock_emails):
        """Successful email send returns success result."""
        # Mock Resend response
        mock_emails.send.return_value = {"id": "msg_123"}

        with patch('app.services.email.settings') as mock_settings:
            mock_settings.RESEND_API_KEY = "test_key"
            mock_settings.RESEND_FROM_EMAIL = "test@test.com"
            mock_settings.BASE_URL = "https://test.com"

            service = EmailService()
            # Manually set _resend to avoid import issues in test
            mock_resend = MagicMock()
            mock_resend.Emails = mock_emails
            service._resend = mock_resend

            result = asyncio.run(service.send_order_confirmation(
                "customer@test.com", "+1234567890", 2999, 100
            ))

            assert result.success
            assert result.message_id == "msg_123"
            mock_emails.send.assert_called_once()

    @patch('resend.Emails')
    def test_handles_exception_gracefully(self, mock_emails):
        """Exception during send returns error result."""
        mock_emails.send.side_effect = Exception("Network error")

        with patch('app.services.email.settings') as mock_settings:
            mock_settings.RESEND_API_KEY = "test_key"
            mock_settings.RESEND_FROM_EMAIL = "test@test.com"
            mock_settings.BASE_URL = "https://test.com"

            service = EmailService()
            mock_resend = MagicMock()
            mock_resend.Emails = mock_emails
            service._resend = mock_resend

            result = asyncio.run(service.send_order_confirmation(
                "customer@test.com", "+1234567890", 2999, 100
            ))

            assert not result.success
            assert "Network error" in result.error


class TestLowBalanceEmail:
    """Test low balance warning email."""

    def test_low_balance_not_configured(self):
        """Low balance email handles missing config."""
        with patch('app.services.email.settings') as mock_settings:
            mock_settings.RESEND_API_KEY = ""
            mock_settings.RESEND_FROM_EMAIL = "test@test.com"
            service = EmailService()

            result = asyncio.run(service.send_low_balance_warning(
                "test@test.com", 200, 5
            ))

            assert not result.success

    @patch('resend.Emails')
    def test_low_balance_success(self, mock_emails):
        """Low balance email sends successfully."""
        mock_emails.send.return_value = {"id": "msg_456"}

        with patch('app.services.email.settings') as mock_settings:
            mock_settings.RESEND_API_KEY = "test_key"
            mock_settings.RESEND_FROM_EMAIL = "test@test.com"
            mock_settings.BASE_URL = "https://test.com"

            service = EmailService()
            mock_resend = MagicMock()
            mock_resend.Emails = mock_emails
            service._resend = mock_resend

            result = asyncio.run(service.send_low_balance_warning(
                "test@test.com", 200, 5
            ))

            assert result.success
            assert result.message_id == "msg_456"


class TestEmailServiceSingleton:
    """Test email service singleton."""

    def test_get_email_service_returns_singleton(self):
        """get_email_service returns the same instance."""
        # Reset singleton for test
        import app.services.email as email_module
        email_module._email_service = None

        service1 = get_email_service()
        service2 = get_email_service()

        assert service1 is service2
