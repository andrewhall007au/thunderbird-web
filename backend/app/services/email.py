"""
Email service using SendGrid.
Handles PAY-05 (order confirmation with SMS number and quick start).
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
    status_code: Optional[int] = None
    error: Optional[str] = None


class EmailService:
    """
    SendGrid email service.

    Handles transactional emails with dynamic templates.
    Fails gracefully - email errors don't break payment flow.
    """

    def __init__(self):
        self.api_key = settings.SENDGRID_API_KEY
        self.from_email = settings.SENDGRID_FROM_EMAIL
        self.client = None
        if self.api_key:
            try:
                from sendgrid import SendGridAPIClient
                self.client = SendGridAPIClient(self.api_key)
            except ImportError:
                logger.warning("sendgrid package not installed")

    def is_configured(self) -> bool:
        """Check if SendGrid is properly configured."""
        return bool(self.api_key and self.client)

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
            logger.warning("SendGrid not configured, skipping email")
            return EmailResult(success=False, error="Email service not configured")

        try:
            from sendgrid.helpers.mail import Mail, Email, To, Content

            message = Mail(
                from_email=Email(self.from_email, "Thunderbird"),
                to_emails=To(to_email),
            )

            # Use dynamic template if configured
            if settings.SENDGRID_WELCOME_TEMPLATE_ID:
                message.template_id = settings.SENDGRID_WELCOME_TEMPLATE_ID
                message.dynamic_template_data = {
                    "sms_number": sms_number,
                    "amount_paid": f"${amount_paid_cents / 100:.2f}",
                    "segments": segments_received,
                    "quick_start_url": f"{settings.BASE_URL}/quickstart",
                    "account_url": f"{settings.BASE_URL}/account",
                }
            else:
                # Fallback to plain text if no template
                message.subject = "Welcome to Thunderbird - Your SMS Number"
                message.content = [Content(
                    "text/plain",
                    f"""Welcome to Thunderbird!

Your SMS number: {sms_number}

You paid: ${amount_paid_cents / 100:.2f}
Estimated messages: ~{segments_received} texts

Quick Start Guide: {settings.BASE_URL}/quickstart

To check your balance or top up:
{settings.BASE_URL}/account

Happy hiking!
The Thunderbird Team
"""
                )]

            response = self.client.send(message)

            if response.status_code in (200, 202):
                logger.info(f"Order confirmation sent to {to_email}")
                return EmailResult(success=True, status_code=response.status_code)
            else:
                logger.error(f"Email send failed: {response.status_code}")
                return EmailResult(
                    success=False,
                    status_code=response.status_code,
                    error=f"SendGrid returned {response.status_code}"
                )

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
            from sendgrid.helpers.mail import Mail, Email, To, Content

            message = Mail(
                from_email=Email(self.from_email, "Thunderbird"),
                to_emails=To(to_email),
                subject="Low Balance Warning - Thunderbird",
            )
            message.content = [Content(
                "text/plain",
                f"""Your Thunderbird balance is low.

Current balance: ${balance_cents / 100:.2f}
Estimated remaining: ~{segments_remaining} texts

Top up now to avoid interruption:
{settings.BASE_URL}/account

Or text: BUY $10

The Thunderbird Team
"""
            )]

            response = self.client.send(message)
            return EmailResult(
                success=response.status_code in (200, 202),
                status_code=response.status_code
            )

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
        logger.warning("SendGrid not configured, skipping milestone email")
        return EmailResult(success=False, error="Email service not configured")

    try:
        from sendgrid.helpers.mail import Mail, Email, To, Content

        subject = f"Congratulations! You've earned {milestone_amount} with Thunderbird"

        body = f"""Hi {affiliate_name},

Congratulations! You've just crossed {milestone_amount} in total earnings as a Thunderbird affiliate.

Thank you for spreading the word about weather forecasts for hikers. Your referrals are helping adventurers stay safe on the trail.

Keep up the great work!

Best,
The Thunderbird Team

---
View your dashboard: {settings.BASE_URL}/affiliate/dashboard
Request payout: {settings.BASE_URL}/affiliate/payout
"""

        message = Mail(
            from_email=Email(service.from_email, "Thunderbird"),
            to_emails=To(to_email),
            subject=subject,
        )
        message.content = [Content("text/plain", body)]

        response = service.client.send(message)

        if response.status_code in (200, 202):
            logger.info(f"Milestone email sent to {to_email}: {milestone_amount}")
            return EmailResult(success=True, status_code=response.status_code)
        else:
            logger.error(f"Milestone email failed: {response.status_code}")
            return EmailResult(
                success=False,
                status_code=response.status_code,
                error=f"SendGrid returned {response.status_code}"
            )

    except Exception as e:
        logger.error(f"Milestone email error: {e}")
        return EmailResult(success=False, error=str(e))
