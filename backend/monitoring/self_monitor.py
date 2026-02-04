"""
Self-Monitoring
The monitoring service monitors itself to detect if monitoring stops working.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional
from pathlib import Path

from .config import settings

logger = logging.getLogger(__name__)


def check_self_health(storage_module, scheduler) -> dict:
    """
    Check if the monitoring service itself is healthy.

    Checks:
    1. Recent metrics exist (checks are running)
    2. Database file exists and is writable
    3. Scheduler is running

    Args:
        storage_module: Storage module for querying metrics
        scheduler: APScheduler instance

    Returns:
        Dictionary with health status and metadata
    """
    try:
        conn = storage_module.get_connection()

        # Check 1: Get most recent metric across all checks
        cursor = conn.execute("""
            SELECT MAX(timestamp_ms) as latest_ts
            FROM metrics
        """)
        row = cursor.fetchone()
        conn.close()

        if not row or not row['latest_ts']:
            return {
                "healthy": False,
                "reason": "No metrics exist in database",
                "last_check_age_seconds": None,
                "db_size_mb": None,
                "scheduler_running": False
            }

        latest_ts_ms = row['latest_ts']
        latest_dt = datetime.fromtimestamp(latest_ts_ms / 1000)
        age_seconds = (datetime.utcnow() - latest_dt).total_seconds()

        # If latest metric is older than 10 minutes, monitoring is stale
        if age_seconds > 600:
            return {
                "healthy": False,
                "reason": f"No recent checks (last check {age_seconds:.0f}s ago)",
                "last_check_age_seconds": age_seconds,
                "db_size_mb": None,
                "scheduler_running": scheduler.running if scheduler else False
            }

        # Check 2: Database file exists and size
        db_path = Path(settings.MONITORING_DB_PATH)
        if not db_path.exists():
            return {
                "healthy": False,
                "reason": "Database file does not exist",
                "last_check_age_seconds": age_seconds,
                "db_size_mb": None,
                "scheduler_running": scheduler.running if scheduler else False
            }

        db_size_mb = db_path.stat().st_size / (1024 * 1024)

        # Check 3: Scheduler is running
        scheduler_running = scheduler.running if scheduler else False
        if not scheduler_running:
            return {
                "healthy": False,
                "reason": "Scheduler is not running",
                "last_check_age_seconds": age_seconds,
                "db_size_mb": db_size_mb,
                "scheduler_running": False
            }

        # All checks passed
        return {
            "healthy": True,
            "last_check_age_seconds": age_seconds,
            "db_size_mb": db_size_mb,
            "scheduler_running": True
        }

    except Exception as e:
        logger.error(f"Self-health check failed: {e}")
        return {
            "healthy": False,
            "reason": f"Exception during self-check: {str(e)}",
            "last_check_age_seconds": None,
            "db_size_mb": None,
            "scheduler_running": False
        }


def send_heartbeat(config, storage, scheduler, alert_channels: Optional[dict] = None):
    """
    Send self-monitoring heartbeat.

    Called by scheduler every 5 minutes to:
    1. Store a self-check metric
    2. Run self-health check
    3. Send alert if monitoring is unhealthy

    Args:
        config: MonitoringSettings instance
        storage: Storage module
        scheduler: APScheduler instance
        alert_channels: Optional dict with 'sms' and 'email' channels for direct alerts
    """
    try:
        # Store heartbeat metric
        storage.store_metric(
            check_name="self_heartbeat",
            status="pass",
            duration_ms=0,
            metadata={"timestamp": datetime.utcnow().isoformat()}
        )

        # Run self-health check
        health = check_self_health(storage, scheduler)

        if not health["healthy"]:
            reason = health.get("reason", "Unknown")
            logger.error(f"SELF-MONITORING ALERT: Monitoring service unhealthy - {reason}")

            # Send SMS alert directly (bypass dedup since this is meta-monitoring)
            if alert_channels and 'sms' in alert_channels:
                sms_channel = alert_channels['sms']
                message = f"THUNDERBIRD MONITOR: Monitoring service unhealthy - {reason}"
                try:
                    sms_channel.send(message, config.ALERT_PHONE_NUMBERS)
                except Exception as e:
                    logger.error(f"Failed to send self-monitoring SMS alert: {e}")

            # Send email alert
            if alert_channels and 'email' in alert_channels:
                email_channel = alert_channels['email']
                subject = "[THUNDERBIRD] CRITICAL: Monitoring Service Unhealthy"
                html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
</head>
<body style="font-family: sans-serif; line-height: 1.6; color: #374151;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">⚠️ Monitoring Service Alert</h1>
        </div>
        <div style="background-color: white; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="color: #dc2626;">Monitoring Service is Unhealthy</h2>
            <p><strong>Reason:</strong> {reason}</p>
            <h3>Details:</h3>
            <ul>
                <li>Last check age: {health.get('last_check_age_seconds', 'N/A')} seconds</li>
                <li>Database size: {health.get('db_size_mb', 'N/A')} MB</li>
                <li>Scheduler running: {health.get('scheduler_running', 'N/A')}</li>
            </ul>
            <p><strong>Action required:</strong> Check monitoring service logs and restart if needed.</p>
            <p style="margin-top: 20px; padding: 10px; background-color: #fef2f2; border-left: 4px solid #dc2626;">
                <strong>External Meta-Monitoring:</strong><br>
                For external monitoring of this service, register the health endpoint with a service like:
                <ul>
                    <li><a href="https://healthchecks.io">https://healthchecks.io</a> (free tier available)</li>
                    <li><a href="https://uptimerobot.com">https://uptimerobot.com</a> (free tier available)</li>
                </ul>
                Endpoint: <code>https://thunderbird.bot:8001/health</code>
            </p>
        </div>
    </div>
</body>
</html>
"""
                try:
                    email_channel.send(subject, html, config.ALERT_EMAIL_ADDRESSES)
                except Exception as e:
                    logger.error(f"Failed to send self-monitoring email alert: {e}")
        else:
            logger.debug(f"Self-monitoring heartbeat OK (last check {health['last_check_age_seconds']:.0f}s ago)")

    except Exception as e:
        logger.error(f"Failed to send heartbeat: {e}")
