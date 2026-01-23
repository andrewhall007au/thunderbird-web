"""
Beta access approval service.

Handles approving/rejecting beta applications.
On approval: creates account, loads $50 credits, sends welcome email.
"""
import logging
import secrets
import string
from typing import Tuple

from app.models.beta_application import beta_application_store, BetaApplication
from app.models.account import account_store
from app.services.auth import hash_password
from app.services.balance import get_balance_service
from app.services.email import get_email_service, EmailResult
from config.settings import settings

logger = logging.getLogger(__name__)

# Beta credit amount: $50 USD = 5000 cents
BETA_CREDIT_CENTS = 5000


def generate_password(length: int = 12) -> str:
    """Generate a random password for beta accounts."""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


async def approve_application(application_id: int) -> Tuple[bool, str]:
    """
    Approve a beta application.

    Creates an account with a generated password, loads $50 credits,
    and sends a welcome email with login details.

    Args:
        application_id: ID of the application to approve

    Returns:
        (success, message) tuple
    """
    application = beta_application_store.get_by_id(application_id)
    if not application:
        return False, "Application not found"

    if application.status != "pending":
        return False, f"Application already {application.status}"

    # Check if account with this email already exists
    existing = account_store.get_by_email(application.email)
    if existing:
        # Link existing account
        beta_application_store.update_status(
            application_id, "approved", account_id=existing.id
        )
        # Still load credits
        balance_service = get_balance_service()
        balance_service.add_credits(
            existing.id, BETA_CREDIT_CENTS, "Beta access credit"
        )
        return True, f"Approved (existing account {existing.email}, $50 credit added)"

    # Generate password and create account
    password = generate_password()
    password_hash = hash_password(password)

    try:
        account = account_store.create(
            email=application.email,
            password_hash=password_hash
        )
    except Exception as e:
        logger.error(f"Failed to create account for {application.email}: {e}")
        return False, f"Failed to create account: {e}"

    # Load $50 credits
    balance_service = get_balance_service()
    balance_service.add_credits(
        account.id, BETA_CREDIT_CENTS, "Beta access credit"
    )

    # Update application status
    beta_application_store.update_status(
        application_id, "approved", account_id=account.id
    )

    # Send welcome email with login details
    await send_beta_welcome_email(application.email, password)

    logger.info(f"Beta application approved: {application.email} (account {account.id})")
    return True, f"Approved: account created for {application.email} with $50 credit"


async def reject_application(application_id: int, notes: str = None) -> Tuple[bool, str]:
    """
    Reject a beta application.

    Args:
        application_id: ID of the application to reject
        notes: Optional admin notes

    Returns:
        (success, message) tuple
    """
    application = beta_application_store.get_by_id(application_id)
    if not application:
        return False, "Application not found"

    if application.status != "pending":
        return False, f"Application already {application.status}"

    beta_application_store.update_status(
        application_id, "rejected", admin_notes=notes
    )

    logger.info(f"Beta application rejected: {application.email}")
    return True, f"Rejected: {application.email}"


async def send_beta_welcome_email(email: str, password: str) -> EmailResult:
    """
    Send welcome email to approved beta user with login details.

    Args:
        email: User's email
        password: Generated password

    Returns:
        EmailResult
    """
    service = get_email_service()

    if not service.is_configured():
        logger.warning("SendGrid not configured, skipping beta welcome email")
        return EmailResult(success=False, error="Email service not configured")

    try:
        from sendgrid.helpers.mail import Mail, Email, To, Content

        subject = "Welcome to Thunderbird Beta!"
        body = f"""Welcome to Thunderbird Beta!

Your account has been approved. Here are your login details:

Email: {email}
Password: {password}

Login at: {settings.BASE_URL}/login

Your account includes $50 USD credit for SMS weather forecasts.

Next steps:
1. Log in at {settings.BASE_URL}/login
2. Link your phone number in Account Settings
3. Text any command to your Thunderbird number

Quick commands:
- CAST [location] - Get weather forecast
- HELP - See all commands

Questions? Reply to this email.

- The Thunderbird Team
"""

        message = Mail(
            from_email=Email(service.from_email, "Thunderbird"),
            to_emails=To(email),
            subject=subject,
        )
        message.content = [Content("text/plain", body)]

        response = service.client.send(message)

        if response.status_code in (200, 202):
            logger.info(f"Beta welcome email sent to {email}")
            return EmailResult(success=True, status_code=response.status_code)
        else:
            logger.error(f"Beta welcome email failed: {response.status_code}")
            return EmailResult(
                success=False,
                status_code=response.status_code,
                error=f"SendGrid returned {response.status_code}"
            )

    except Exception as e:
        logger.error(f"Beta welcome email error: {e}")
        return EmailResult(success=False, error=str(e))


async def send_admin_notification(application: BetaApplication) -> EmailResult:
    """
    Notify admin when a new beta application is received.

    Args:
        application: The new application

    Returns:
        EmailResult
    """
    service = get_email_service()

    if not service.is_configured():
        logger.warning("SendGrid not configured, skipping admin notification")
        return EmailResult(success=False, error="Email service not configured")

    try:
        from sendgrid.helpers.mail import Mail, Email, To, Content

        admin_email = "hello@thunderbird.bot"
        subject = f"New Beta Application: {application.name} ({application.country})"
        body = f"""New beta application received:

Name: {application.name}
Email: {application.email}
Country: {application.country}
Applied: {application.created_at}

Review at: {settings.BASE_URL}/admin/beta

- Thunderbird Bot
"""

        message = Mail(
            from_email=Email(service.from_email, "Thunderbird"),
            to_emails=To(admin_email),
            subject=subject,
        )
        message.content = [Content("text/plain", body)]

        response = service.client.send(message)

        if response.status_code in (200, 202):
            logger.info(f"Admin notification sent for application {application.id}")
            return EmailResult(success=True, status_code=response.status_code)
        else:
            return EmailResult(
                success=False,
                status_code=response.status_code,
                error=f"SendGrid returned {response.status_code}"
            )

    except Exception as e:
        logger.error(f"Admin notification error: {e}")
        return EmailResult(success=False, error=str(e))
