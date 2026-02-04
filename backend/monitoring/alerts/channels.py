"""
Alert Channels
SMS via Twilio and Email via Resend for monitoring alerts.
"""

import logging
import time
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)


class TwilioSMSChannel:
    """Send SMS alerts via Twilio."""

    def __init__(self, account_sid: str, auth_token: str, from_number: str):
        """
        Initialize Twilio SMS channel.

        Args:
            account_sid: Twilio account SID
            auth_token: Twilio auth token
            from_number: Twilio phone number to send from
        """
        self.account_sid = account_sid
        self.auth_token = auth_token
        self.from_number = from_number
        self.client = None

        # Check if credentials are configured
        if account_sid and auth_token and from_number:
            try:
                from twilio.rest import Client
                self.client = Client(account_sid, auth_token)
                logger.info("Twilio SMS channel initialized")
            except ImportError:
                logger.warning("twilio package not installed, SMS alerts disabled")
            except Exception as e:
                logger.warning(f"Failed to initialize Twilio client: {e}")
        else:
            logger.warning("Twilio credentials not configured, SMS alerts disabled")

    def send(self, message: str, to_numbers: list[str]) -> bool:
        """
        Send SMS alert to configured phone numbers.

        Args:
            message: Alert message (will be truncated to 160 chars)
            to_numbers: List of phone numbers to send to (E.164 format)

        Returns:
            True if at least one SMS sent successfully
        """
        if not self.client:
            logger.warning("Twilio client not available, skipping SMS send")
            return False

        if not to_numbers:
            logger.warning("No phone numbers configured for SMS alerts")
            return False

        # Truncate message to 160 chars for single segment
        message = message[:160]

        success_count = 0
        for phone_number in to_numbers:
            try:
                message_obj = self.client.messages.create(
                    body=message,
                    from_=self.from_number,
                    to=phone_number
                )
                logger.info(f"SMS sent to {phone_number}: {message_obj.sid}")
                success_count += 1
            except Exception as e:
                logger.error(f"Failed to send SMS to {phone_number}: {e}")

        return success_count > 0

    def _format_alert_sms(self, severity: str, check_name: str, message: str) -> str:
        """
        Format alert message for SMS.

        Args:
            severity: Alert severity (CRITICAL, WARNING, INFO)
            check_name: Name of the check that failed
            message: Error message

        Returns:
            Formatted SMS message (max 155 chars)
        """
        timestamp = datetime.utcnow().strftime("%H:%M UTC")

        # Base format
        base = f"THUNDERBIRD {severity}: {check_name}\n{message}\n{timestamp}"

        # Truncate to 155 chars (leave room for carrier metadata)
        if len(base) > 155:
            # Truncate message part to fit
            max_message_len = 155 - len(f"THUNDERBIRD {severity}: {check_name}\n\n{timestamp}")
            message = message[:max_message_len] + "..."
            base = f"THUNDERBIRD {severity}: {check_name}\n{message}\n{timestamp}"

        return base

    def _format_recovery_sms(self, check_name: str, downtime_minutes: int) -> str:
        """
        Format recovery message for SMS.

        Args:
            check_name: Name of the check that recovered
            downtime_minutes: Minutes the check was down

        Returns:
            Formatted SMS message
        """
        timestamp = datetime.utcnow().strftime("%H:%M UTC")
        return f"THUNDERBIRD OK: {check_name} recovered\nDowntime: {downtime_minutes}min\n{timestamp}"


class ResendEmailChannel:
    """Send email alerts via Resend."""

    def __init__(self, api_key: str, from_email: str = "alerts@thunderbird.bot"):
        """
        Initialize Resend email channel.

        Args:
            api_key: Resend API key
            from_email: Email address to send from
        """
        self.api_key = api_key
        self.from_email = from_email
        self.resend_available = False

        # Check if Resend is configured
        if api_key:
            try:
                import resend
                resend.api_key = api_key
                self.resend = resend
                self.resend_available = True
                logger.info("Resend email channel initialized")
            except ImportError:
                logger.warning("resend package not installed, email alerts disabled")
            except Exception as e:
                logger.warning(f"Failed to initialize Resend: {e}")
        else:
            logger.warning("Resend API key not configured, email alerts disabled")

    def send(self, alert_subject: str, alert_html: str, to_emails: list[str]) -> bool:
        """
        Send email alert to configured addresses.

        Args:
            alert_subject: Email subject line
            alert_html: HTML email body
            to_emails: List of email addresses to send to

        Returns:
            True if sent successfully
        """
        if not self.resend_available:
            logger.warning("Resend not available, skipping email send")
            return False

        if not to_emails:
            logger.warning("No email addresses configured for alerts")
            return False

        try:
            # Send to all recipients (Resend supports multiple 'to' addresses)
            # Respect 2 req/sec rate limit
            for i, email in enumerate(to_emails):
                if i > 0:
                    time.sleep(0.5)  # 500ms delay between sends

                self.resend.Emails.send({
                    "from": self.from_email,
                    "to": email,
                    "subject": alert_subject,
                    "html": alert_html,
                })
                logger.info(f"Email sent to {email}")

            return True
        except Exception as e:
            logger.error(f"Failed to send email alert: {e}")
            return False

    def _format_alert_html(
        self,
        severity: str,
        check_name: str,
        message: str,
        first_seen: datetime,
        failure_count: int
    ) -> str:
        """
        Format alert as HTML email.

        Args:
            severity: Alert severity (critical, warning, info)
            check_name: Name of the check that failed
            message: Error message
            first_seen: Timestamp of first failure
            failure_count: Number of consecutive failures

        Returns:
            HTML email body
        """
        # Color coding by severity
        severity_colors = {
            "critical": "#dc2626",  # red
            "warning": "#ea580c",   # orange
            "info": "#2563eb"       # blue
        }
        color = severity_colors.get(severity.lower(), "#6b7280")

        html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #374151; margin: 0; padding: 0; background-color: #f9fafb;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
            <div style="background-color: {color}; color: white; padding: 20px;">
                <h1 style="margin: 0; font-size: 24px; font-weight: 600;">
                    Thunderbird Alert: {severity.upper()}
                </h1>
            </div>
            <div style="padding: 30px;">
                <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: #111827;">
                    {check_name}
                </h2>
                <div style="background-color: #fef2f2; border-left: 4px solid {color}; padding: 15px; margin-bottom: 20px;">
                    <p style="margin: 0; color: #991b1b; font-family: monospace; font-size: 14px;">
                        {message}
                    </p>
                </div>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #6b7280;">First Seen:</td>
                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{first_seen.strftime('%Y-%m-%d %H:%M:%S UTC')}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #6b7280;">Failure Count:</td>
                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{failure_count}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; font-weight: 600; color: #6b7280;">Severity:</td>
                        <td style="padding: 10px;">
                            <span style="background-color: {color}; color: white; padding: 4px 12px; border-radius: 4px; font-size: 14px; font-weight: 600;">
                                {severity.upper()}
                            </span>
                        </td>
                    </tr>
                </table>
                <div style="text-align: center; margin-top: 30px;">
                    <a href="http://localhost:8001/monitoring" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                        View Monitoring Dashboard
                    </a>
                </div>
            </div>
            <div style="background-color: #f9fafb; padding: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
                <p style="margin: 0;">
                    Thunderbird Monitoring Service<br>
                    Automated alert from monitoring.thunderbird.bot
                </p>
            </div>
        </div>
    </div>
</body>
</html>
"""
        return html

    def _format_recovery_html(
        self,
        check_name: str,
        downtime_minutes: int,
        resolved_at: datetime
    ) -> str:
        """
        Format recovery notification as HTML email.

        Args:
            check_name: Name of the check that recovered
            downtime_minutes: Minutes the check was down
            resolved_at: Timestamp when check recovered

        Returns:
            HTML email body
        """
        html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #374151; margin: 0; padding: 0; background-color: #f9fafb;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
            <div style="background-color: #16a34a; color: white; padding: 20px;">
                <h1 style="margin: 0; font-size: 24px; font-weight: 600;">
                    ✓ Thunderbird Recovery
                </h1>
            </div>
            <div style="padding: 30px;">
                <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: #111827;">
                    {check_name}
                </h2>
                <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px; margin-bottom: 20px;">
                    <p style="margin: 0; color: #166534; font-size: 16px;">
                        Check has recovered and is now passing.
                    </p>
                </div>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #6b7280;">Recovered At:</td>
                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{resolved_at.strftime('%Y-%m-%d %H:%M:%S UTC')}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; font-weight: 600; color: #6b7280;">Total Downtime:</td>
                        <td style="padding: 10px;">{downtime_minutes} minutes</td>
                    </tr>
                </table>
                <div style="text-align: center; margin-top: 30px;">
                    <a href="http://localhost:8001/monitoring" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                        View Monitoring Dashboard
                    </a>
                </div>
            </div>
            <div style="background-color: #f9fafb; padding: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
                <p style="margin: 0;">
                    Thunderbird Monitoring Service<br>
                    Automated alert from monitoring.thunderbird.bot
                </p>
            </div>
        </div>
    </div>
</body>
</html>
"""
        return html
