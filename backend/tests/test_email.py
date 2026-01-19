"""
Tests for email service.
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
            mock_settings.SENDGRID_API_KEY = ""
            mock_settings.SENDGRID_FROM_EMAIL = "test@test.com"
            service = EmailService()
            assert not service.is_configured()

    def test_handles_missing_config_gracefully(self):
        """Send methods return error when not configured."""
        with patch('app.services.email.settings') as mock_settings:
            mock_settings.SENDGRID_API_KEY = ""
            mock_settings.SENDGRID_FROM_EMAIL = "test@test.com"
            service = EmailService()

            result = asyncio.run(service.send_order_confirmation(
                "test@test.com", "+1234567890", 2999, 100
            ))

            assert not result.success
            assert "not configured" in result.error.lower()

    @patch('sendgrid.SendGridAPIClient')
    def test_send_order_confirmation_success(self, mock_client_class):
        """Successful email send returns success result."""
        # Mock SendGrid client
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.status_code = 202
        mock_client.send.return_value = mock_response
        mock_client_class.return_value = mock_client

        with patch('app.services.email.settings') as mock_settings:
            mock_settings.SENDGRID_API_KEY = "test_key"
            mock_settings.SENDGRID_FROM_EMAIL = "test@test.com"
            mock_settings.SENDGRID_WELCOME_TEMPLATE_ID = ""
            mock_settings.BASE_URL = "https://test.com"

            service = EmailService()
            result = asyncio.run(service.send_order_confirmation(
                "customer@test.com", "+1234567890", 2999, 100
            ))

            assert result.success
            assert result.status_code == 202
            mock_client.send.assert_called_once()

    @patch('sendgrid.SendGridAPIClient')
    def test_send_order_confirmation_failure(self, mock_client_class):
        """Failed email send returns error result."""
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_client.send.return_value = mock_response
        mock_client_class.return_value = mock_client

        with patch('app.services.email.settings') as mock_settings:
            mock_settings.SENDGRID_API_KEY = "test_key"
            mock_settings.SENDGRID_FROM_EMAIL = "test@test.com"
            mock_settings.SENDGRID_WELCOME_TEMPLATE_ID = ""
            mock_settings.BASE_URL = "https://test.com"

            service = EmailService()
            result = asyncio.run(service.send_order_confirmation(
                "customer@test.com", "+1234567890", 2999, 100
            ))

            assert not result.success
            assert result.status_code == 400

    @patch('sendgrid.SendGridAPIClient')
    def test_handles_exception_gracefully(self, mock_client_class):
        """Exception during send returns error result."""
        mock_client = MagicMock()
        mock_client.send.side_effect = Exception("Network error")
        mock_client_class.return_value = mock_client

        with patch('app.services.email.settings') as mock_settings:
            mock_settings.SENDGRID_API_KEY = "test_key"
            mock_settings.SENDGRID_FROM_EMAIL = "test@test.com"
            mock_settings.SENDGRID_WELCOME_TEMPLATE_ID = ""
            mock_settings.BASE_URL = "https://test.com"

            service = EmailService()
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
            mock_settings.SENDGRID_API_KEY = ""
            mock_settings.SENDGRID_FROM_EMAIL = "test@test.com"
            service = EmailService()

            result = asyncio.run(service.send_low_balance_warning(
                "test@test.com", 200, 5
            ))

            assert not result.success


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
