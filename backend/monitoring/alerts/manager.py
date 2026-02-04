"""
Alert Manager
Core alert logic with deduplication, escalation, and acknowledgment.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional

from ..storage import CheckResult, store_metric, get_consecutive_failures, get_active_incidents
from ..storage import store_incident, resolve_incident, acknowledge_incident as storage_acknowledge_incident
from ..config import settings
from .channels import TwilioSMSChannel, ResendEmailChannel

logger = logging.getLogger(__name__)


class AlertManager:
    """
    Manages alert evaluation, deduplication, escalation, and delivery.

    Responsibilities:
    - Evaluate check results and decide when to alert
    - Deduplicate alerts (same check within 15 minutes)
    - Route alerts based on severity (critical -> SMS+email, warning -> email with escalation)
    - Track SMS rate limiting (max 10/hour)
    - Send recovery notifications
    - Support incident acknowledgment to prevent escalation
    """

    # Severity mappings for check names
    CRITICAL_CHECKS = [
        'health_check',
        'beta_signup_flow',
        'checkout_flow',
        'sms_webhook'
    ]

    WARNING_CHECKS = [
        'login_flow',
        'weather_api',
        'api_response_time',
        'db_query_performance',
        'external_api_latency'
    ]

    def __init__(
        self,
        config,
        storage,
        sms_channel: TwilioSMSChannel,
        email_channel: ResendEmailChannel
    ):
        """
        Initialize AlertManager.

        Args:
            config: MonitoringSettings instance
            storage: Storage module (for direct function calls)
            sms_channel: SMS alert channel
            email_channel: Email alert channel
        """
        self.config = config
        self.storage = storage
        self.sms_channel = sms_channel
        self.email_channel = email_channel

        # Internal state for deduplication and rate limiting
        self._last_alert_time: dict[str, datetime] = {}
        self._sms_count_this_hour: int = 0
        self._hour_start: datetime = datetime.utcnow()
        self._sms_sent_for_incident: dict[str, bool] = {}  # Track if SMS already sent for incident

        logger.info("AlertManager initialized")

    def evaluate_and_alert(self, result: CheckResult):
        """
        Evaluate check result and send alerts if needed.

        Flow:
        1. Store metric
        2. If pass: check for recovery, send recovery notification if needed
        3. If fail: evaluate consecutive failures, determine severity, send alerts

        Args:
            result: CheckResult from health check
        """
        # Store metric
        store_metric(
            check_name=result.check_name,
            status=result.status,
            duration_ms=result.duration_ms,
            error_message=result.error_message,
            metadata=result.metadata
        )

        # Handle pass (check for recovery)
        if result.status == 'pass':
            self._handle_recovery(result.check_name)
            return

        # Handle fail
        if result.status == 'fail':
            self._handle_failure(result)

    def _handle_recovery(self, check_name: str):
        """Handle check recovery - send recovery notification if there was an active incident."""
        # Check for active incidents
        active_incidents = get_active_incidents()
        incident = None

        for inc in active_incidents:
            if inc['check_name'] == check_name:
                incident = inc
                break

        if not incident:
            # No active incident, nothing to do
            return

        # Calculate downtime
        first_seen_ms = incident['first_seen_ms']
        now_ms = int(datetime.utcnow().timestamp() * 1000)
        downtime_minutes = (now_ms - first_seen_ms) // 60000

        # Resolve incident
        resolve_incident(check_name)
        logger.info(f"Incident resolved for {check_name}, downtime: {downtime_minutes}min")

        # Determine if this was a critical incident (should send SMS recovery)
        severity = self._determine_severity(check_name)
        incident_id = incident['id']

        # Send recovery notification
        self._send_recovery(check_name, downtime_minutes, severity == 'critical')

        # Clear SMS tracking for this incident
        if incident_id in self._sms_sent_for_incident:
            del self._sms_sent_for_incident[incident_id]

    def _handle_failure(self, result: CheckResult):
        """Handle check failure - evaluate consecutive failures and send alerts."""
        check_name = result.check_name

        # Get consecutive failure count
        consecutive = get_consecutive_failures(check_name)

        # Require minimum consecutive failures before alerting
        if consecutive < self.config.CONSECUTIVE_FAILURES_BEFORE_ALERT:
            logger.debug(f"{check_name}: {consecutive} consecutive failures, waiting for {self.config.CONSECUTIVE_FAILURES_BEFORE_ALERT}")
            return

        # Check deduplication
        if not self._should_alert(check_name):
            logger.debug(f"{check_name}: Alert suppressed (deduplication)")
            return

        # Determine severity
        severity = self._determine_severity(check_name)

        # Get or create incident
        active_incidents = get_active_incidents()
        incident = None
        for inc in active_incidents:
            if inc['check_name'] == check_name:
                incident = inc
                break

        if not incident:
            # Create new incident
            incident_id = store_incident(
                check_name=check_name,
                severity=severity,
                message=result.error_message or "Check failed"
            )
            logger.info(f"New incident created: {incident_id} for {check_name} ({severity})")

            # Fetch the incident we just created
            active_incidents = get_active_incidents()
            for inc in active_incidents:
                if inc['id'] == incident_id:
                    incident = inc
                    break
        else:
            # Update existing incident
            incident_id = store_incident(
                check_name=check_name,
                severity=severity,
                message=result.error_message or "Check failed"
            )
            logger.info(f"Incident updated: {incident['id']} for {check_name}")

        # Send alerts based on severity
        if severity == 'critical':
            self._send_critical_alert(check_name, result, incident)
        elif severity == 'warning':
            self._send_warning_alert(check_name, result, incident)
        else:
            # Info level - just log
            logger.info(f"{check_name}: Info-level failure (no alert)")

        # Update last alert time
        self._last_alert_time[check_name] = datetime.utcnow()

    def _should_alert(self, check_name: str) -> bool:
        """
        Check if we should send an alert for this check (deduplication).

        Returns:
            True if alert should be sent (no recent alert), False otherwise
        """
        if check_name not in self._last_alert_time:
            return True

        last_alert = self._last_alert_time[check_name]
        elapsed = datetime.utcnow() - last_alert

        # Suppress alerts within 15 minutes
        return elapsed.total_seconds() > 900  # 15 minutes

    def _should_escalate(self, check_name: str, incident: dict) -> bool:
        """
        Check if warning-level incident should escalate to SMS.

        Escalation criteria:
        - Incident NOT acknowledged
        - Incident active > 15 minutes
        - SMS not already sent for this incident

        Args:
            check_name: Name of the check
            incident: Incident dict from storage

        Returns:
            True if should escalate to SMS
        """
        # Don't escalate if acknowledged
        if incident['status'] == 'acknowledged':
            logger.debug(f"{check_name}: Escalation suppressed (acknowledged)")
            return False

        # Don't escalate if SMS already sent for this incident
        incident_id = incident['id']
        if self._sms_sent_for_incident.get(incident_id, False):
            logger.debug(f"{check_name}: Escalation suppressed (SMS already sent)")
            return False

        # Check if incident has been active > 15 minutes
        first_seen_ms = incident['first_seen_ms']
        now_ms = int(datetime.utcnow().timestamp() * 1000)
        active_minutes = (now_ms - first_seen_ms) // 60000

        if active_minutes > 15:
            logger.info(f"{check_name}: Escalating to SMS (active {active_minutes}min, unacknowledged)")
            return True

        return False

    def _can_send_sms(self) -> bool:
        """
        Check if SMS can be sent (rate limiting).

        Rate limit: SMS_RATE_LIMIT_PER_HOUR per hour

        Returns:
            True if SMS can be sent
        """
        now = datetime.utcnow()

        # Reset counter if hour changed
        if (now - self._hour_start).total_seconds() > 3600:
            self._sms_count_this_hour = 0
            self._hour_start = now
            logger.debug("SMS rate limit counter reset")

        can_send = self._sms_count_this_hour < self.config.SMS_RATE_LIMIT_PER_HOUR

        if not can_send:
            logger.warning(f"SMS rate limit reached ({self.config.SMS_RATE_LIMIT_PER_HOUR}/hour)")

        return can_send

    def _determine_severity(self, check_name: str) -> str:
        """
        Determine alert severity for a check.

        Args:
            check_name: Name of the check

        Returns:
            'critical', 'warning', or 'info'
        """
        if check_name in self.CRITICAL_CHECKS:
            return 'critical'
        elif check_name in self.WARNING_CHECKS:
            return 'warning'
        else:
            return 'info'

    def _send_critical_alert(self, check_name: str, result: CheckResult, incident: dict):
        """
        Send critical alert (SMS + email immediately).

        Args:
            check_name: Name of the check
            result: CheckResult that triggered alert
            incident: Incident dict from storage
        """
        logger.info(f"Sending CRITICAL alert for {check_name}")

        message = result.error_message or "Check failed"
        first_seen = datetime.fromtimestamp(incident['first_seen_ms'] / 1000)
        failure_count = incident['failure_count']

        # Send SMS (if rate limit allows)
        if self._can_send_sms():
            sms_message = self.sms_channel._format_alert_sms(
                severity="CRITICAL",
                check_name=check_name,
                message=message
            )
            success = self.sms_channel.send(
                message=sms_message,
                to_numbers=self.config.ALERT_PHONE_NUMBERS
            )
            if success:
                self._sms_count_this_hour += 1
                self._sms_sent_for_incident[incident['id']] = True
                logger.info(f"Critical SMS alert sent for {check_name}")
        else:
            logger.warning(f"Critical SMS alert skipped for {check_name} (rate limit)")

        # Send email
        subject = f"🚨 CRITICAL: {check_name} failing"
        html = self.email_channel._format_alert_html(
            severity="critical",
            check_name=check_name,
            message=message,
            first_seen=first_seen,
            failure_count=failure_count
        )
        self.email_channel.send(
            alert_subject=subject,
            alert_html=html,
            to_emails=self.config.ALERT_EMAIL_ADDRESSES
        )
        logger.info(f"Critical email alert sent for {check_name}")

    def _send_warning_alert(self, check_name: str, result: CheckResult, incident: dict):
        """
        Send warning alert (email immediately, escalate to SMS after 15 minutes if unacknowledged).

        Args:
            check_name: Name of the check
            result: CheckResult that triggered alert
            incident: Incident dict from storage
        """
        message = result.error_message or "Check failed"
        first_seen = datetime.fromtimestamp(incident['first_seen_ms'] / 1000)
        failure_count = incident['failure_count']

        # Check if should escalate to SMS
        if self._should_escalate(check_name, incident):
            logger.info(f"Escalating WARNING to SMS for {check_name}")

            # Send SMS
            if self._can_send_sms():
                sms_message = self.sms_channel._format_alert_sms(
                    severity="WARNING",
                    check_name=check_name,
                    message=message
                )
                success = self.sms_channel.send(
                    message=sms_message,
                    to_numbers=self.config.ALERT_PHONE_NUMBERS
                )
                if success:
                    self._sms_count_this_hour += 1
                    self._sms_sent_for_incident[incident['id']] = True
                    logger.info(f"Warning SMS alert sent (escalated) for {check_name}")
            else:
                logger.warning(f"Warning SMS alert skipped for {check_name} (rate limit)")

        # Always send email for warnings (first alert or escalation reminder)
        subject = f"⚠️ WARNING: {check_name} degraded"
        html = self.email_channel._format_alert_html(
            severity="warning",
            check_name=check_name,
            message=message,
            first_seen=first_seen,
            failure_count=failure_count
        )
        self.email_channel.send(
            alert_subject=subject,
            alert_html=html,
            to_emails=self.config.ALERT_EMAIL_ADDRESSES
        )
        logger.info(f"Warning email alert sent for {check_name}")

    def _send_recovery(self, check_name: str, downtime_minutes: int, send_sms: bool):
        """
        Send recovery notification.

        Args:
            check_name: Name of the check that recovered
            downtime_minutes: Minutes the check was down
            send_sms: Whether to send SMS (True for critical, False for warning)
        """
        logger.info(f"Sending recovery notification for {check_name} (downtime: {downtime_minutes}min)")

        # Send SMS if critical
        if send_sms and self._can_send_sms():
            sms_message = self.sms_channel._format_recovery_sms(
                check_name=check_name,
                downtime_minutes=downtime_minutes
            )
            self.sms_channel.send(
                message=sms_message,
                to_numbers=self.config.ALERT_PHONE_NUMBERS
            )
            self._sms_count_this_hour += 1
            logger.info(f"Recovery SMS sent for {check_name}")

        # Always send email
        resolved_at = datetime.utcnow()
        subject = f"✓ RECOVERED: {check_name}"
        html = self.email_channel._format_recovery_html(
            check_name=check_name,
            downtime_minutes=downtime_minutes,
            resolved_at=resolved_at
        )
        self.email_channel.send(
            alert_subject=subject,
            alert_html=html,
            to_emails=self.config.ALERT_EMAIL_ADDRESSES
        )
        logger.info(f"Recovery email sent for {check_name}")

    def acknowledge_incident(self, incident_id: str):
        """
        Acknowledge incident to prevent escalation.

        This does NOT resolve the incident - it just marks it as acknowledged
        so that warning-level incidents don't escalate to SMS.

        Args:
            incident_id: UUID of incident to acknowledge
        """
        storage_acknowledge_incident(incident_id)
        logger.info(f"Incident acknowledged: {incident_id}")


def create_alert_manager(config, storage):
    """
    Factory function to create AlertManager with configured channels.

    Args:
        config: MonitoringSettings instance
        storage: Storage module

    Returns:
        Configured AlertManager instance
    """
    sms_channel = TwilioSMSChannel(
        account_sid=config.TWILIO_ACCOUNT_SID,
        auth_token=config.TWILIO_AUTH_TOKEN,
        from_number=config.TWILIO_PHONE_NUMBER
    )

    email_channel = ResendEmailChannel(
        api_key=config.RESEND_API_KEY,
        from_email="alerts@thunderbird.bot"
    )

    return AlertManager(config, storage, sms_channel, email_channel)
