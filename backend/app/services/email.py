"""
Email service using Resend.
Handles all transactional emails: order confirmation, password reset, etc.
"""
import logging
from typing import Optional
from dataclasses import dataclass

from config.settings import settings

logger = logging.getLogger(__name__)


@dataclass
class EmailResult:
    """Result of email send operation."""
    success: bool
    message_id: Optional[str] = None
    error: Optional[str] = None


class EmailService:
    """
    Resend email service.

    Handles transactional emails.
    Fails gracefully - email errors don't break payment flow.
    """

    def __init__(self):
        self.api_key = settings.RESEND_API_KEY
        self.from_email = settings.RESEND_FROM_EMAIL
        self._resend = None

    def _get_resend(self):
        """Lazy load resend module."""
        if self._resend is None and self.api_key:
            try:
                import resend
                resend.api_key = self.api_key
                self._resend = resend
            except ImportError:
                logger.warning("resend package not installed")
        return self._resend

    def is_configured(self) -> bool:
        """Check if Resend is properly configured."""
        return bool(self.api_key and self._get_resend())

    async def send_order_confirmation(
        self,
        to_email: str,
        sms_number: str,
        amount_paid_cents: int,
        segments_received: int
    ) -> EmailResult:
        """
        Send order confirmation email.

        PAY-05: Email contains SMS number and quick start guide.

        Args:
            to_email: Customer email address
            sms_number: Assigned Thunderbird SMS number
            amount_paid_cents: Amount charged
            segments_received: Estimated segments purchased

        Returns:
            EmailResult with success status
        """
        if not self.is_configured():
            logger.warning("Resend not configured, skipping order confirmation email")
            return EmailResult(success=False, error="Email service not configured")

        try:
            resend = self._get_resend()

            response = resend.Emails.send({
                "from": self.from_email,
                "to": [to_email],
                "subject": "Welcome to Thunderbird - Your SMS Number",
                "text": f"""Welcome to Thunderbird!

Your SMS number: {sms_number}

You paid: ${amount_paid_cents / 100:.2f}
Estimated messages: ~{segments_received} texts

Quick Start Guide: {settings.BASE_URL}/quickstart

Quick commands:
- CAST24 [location] - Get 24-hour forecast
- CAST7 [location] - Get 7-day forecast
- HELP - See all commands

To check your balance or top up:
{settings.BASE_URL}/account

Happy hiking!
The Thunderbird Team
"""
            })

            logger.info(f"Order confirmation sent to {to_email}")
            return EmailResult(success=True, message_id=response.get("id"))

        except Exception as e:
            logger.error(f"Email send error: {e}")
            return EmailResult(success=False, error=str(e))

    async def send_low_balance_warning(
        self,
        to_email: str,
        balance_cents: int,
        segments_remaining: int
    ) -> EmailResult:
        """
        Send low balance warning email.

        PAY-09: Warning at $2 remaining (also sent via SMS).

        Args:
            to_email: Customer email
            balance_cents: Current balance
            segments_remaining: Estimated texts remaining
        """
        if not self.is_configured():
            return EmailResult(success=False, error="Email service not configured")

        try:
            resend = self._get_resend()

            response = resend.Emails.send({
                "from": self.from_email,
                "to": [to_email],
                "subject": "Low Balance Warning - Thunderbird",
                "text": f"""Your Thunderbird balance is low.

Current balance: ${balance_cents / 100:.2f}
Estimated remaining: ~{segments_remaining} texts

Top up now to avoid interruption:
{settings.BASE_URL}/account

Or text: BUY $10

The Thunderbird Team
"""
            })

            logger.info(f"Low balance warning sent to {to_email}")
            return EmailResult(success=True, message_id=response.get("id"))

        except Exception as e:
            logger.error(f"Low balance email error: {e}")
            return EmailResult(success=False, error=str(e))


# Singleton
_email_service: Optional[EmailService] = None


def get_email_service() -> EmailService:
    """Get singleton email service."""
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service


async def send_order_confirmation(
    to_email: str,
    sms_number: str,
    amount_paid_cents: int,
    segments_received: int
) -> EmailResult:
    """Convenience function for sending order confirmation."""
    service = get_email_service()
    return await service.send_order_confirmation(
        to_email, sms_number, amount_paid_cents, segments_received
    )


async def send_password_reset_email(
    to_email: str,
    reset_token: str
) -> EmailResult:
    """
    Send password reset email with reset link.

    Args:
        to_email: User's email address
        reset_token: JWT token for password reset

    Returns:
        EmailResult with success/error
    """
    service = get_email_service()

    if not service.is_configured():
        logger.warning("Resend not configured, skipping password reset email")
        return EmailResult(success=False, error="Email service not configured")

    try:
        resend = service._get_resend()
        reset_url = f"{settings.BASE_URL}/reset-password?token={reset_token}"

        response = resend.Emails.send({
            "from": service.from_email,
            "to": [to_email],
            "subject": "Reset your Thunderbird password",
            "text": f"""Hi,

You requested to reset your Thunderbird password.

Click this link to set a new password:
{reset_url}

This link expires in 15 minutes.

If you didn't request this, you can safely ignore this email.

- The Thunderbird Team
"""
        })

        logger.info(f"Password reset email sent to {to_email}")
        return EmailResult(success=True, message_id=response.get("id"))

    except Exception as e:
        logger.error(f"Password reset email error: {e}")
        return EmailResult(success=False, error=str(e))


async def send_affiliate_milestone_email(
    to_email: str,
    affiliate_name: str,
    milestone_amount: str
) -> EmailResult:
    """
    Send milestone celebration email to affiliate.

    Sent when affiliates hit $50, $100, $500, $1000 in total earnings.

    Args:
        to_email: Affiliate's email
        affiliate_name: Affiliate's name
        milestone_amount: Formatted amount (e.g., "$500")

    Returns:
        EmailResult with success/error
    """
    service = get_email_service()

    if not service.is_configured():
        logger.warning("Resend not configured, skipping milestone email")
        return EmailResult(success=False, error="Email service not configured")

    try:
        resend = service._get_resend()

        response = resend.Emails.send({
            "from": service.from_email,
            "to": [to_email],
            "subject": f"Congratulations! You've earned {milestone_amount} with Thunderbird",
            "text": f"""Hi {affiliate_name},

Congratulations! You've just crossed {milestone_amount} in total earnings as a Thunderbird affiliate.

Thank you for spreading the word about weather forecasts for hikers. Your referrals are helping adventurers stay safe on the trail.

Keep up the great work!

Best,
The Thunderbird Team

---
View your dashboard: {settings.BASE_URL}/affiliate/dashboard
Request payout: {settings.BASE_URL}/affiliate/payout
"""
        })

        logger.info(f"Milestone email sent to {to_email}: {milestone_amount}")
        return EmailResult(success=True, message_id=response.get("id"))

    except Exception as e:
        logger.error(f"Milestone email error: {e}")
        return EmailResult(success=False, error=str(e))
