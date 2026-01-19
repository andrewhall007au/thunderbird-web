#!/usr/bin/env python3
"""
Cost Monitor for Thunderbird Beta Testing

Monitors daily SMS costs and:
- Sends SMS warning at $20
- Disables service at $25

Run via cron every 5 minutes:
  */5 * * * * /root/overland-weather/venv/bin/python /root/overland-weather/scripts/cost_monitor.py

Logs to: /var/log/thunderbird-cost-monitor.log
"""

import os
import sys
import sqlite3
import subprocess
import logging
from datetime import date, datetime
from pathlib import Path

# Configuration
WARN_THRESHOLD = 20.0   # Send warning SMS at $20
STOP_THRESHOLD = 25.0   # Stop service at $25
ADMIN_PHONE = os.environ.get("ADMIN_PHONE", "+61410663673")  # Your phone
DB_PATH = "/root/overland-weather/thunderbird.db"
STATE_FILE = "/tmp/thunderbird_cost_alerts.txt"
LOG_FILE = "/var/log/thunderbird-cost-monitor.log"

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


def get_today_cost() -> float:
    """Get today's total SMS cost from database."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.execute("""
            SELECT COALESCE(SUM(cost_aud), 0) as total_cost
            FROM message_log
            WHERE direction = 'outbound'
            AND date(sent_at) = date('now')
        """)
        row = cursor.fetchone()
        conn.close()
        return float(row[0]) if row else 0.0
    except Exception as e:
        logger.error(f"Failed to query database: {e}")
        return 0.0


def get_today_alerts() -> set:
    """Get which alerts have already been sent today."""
    today = date.today().isoformat()
    alerts = set()

    if Path(STATE_FILE).exists():
        with open(STATE_FILE, 'r') as f:
            for line in f:
                parts = line.strip().split('|')
                if len(parts) == 2 and parts[0] == today:
                    alerts.add(parts[1])

    return alerts


def mark_alert_sent(alert_type: str):
    """Mark that an alert has been sent today."""
    today = date.today().isoformat()

    # Read existing alerts
    lines = []
    if Path(STATE_FILE).exists():
        with open(STATE_FILE, 'r') as f:
            lines = [l.strip() for l in f if not l.startswith(today)]

    # Add new alert
    lines.append(f"{today}|{alert_type}")

    with open(STATE_FILE, 'w') as f:
        f.write('\n'.join(lines) + '\n')


def send_sms(message: str) -> bool:
    """Send SMS via Twilio."""
    try:
        # Add project to path
        sys.path.insert(0, '/root/overland-weather')

        from twilio.rest import Client

        account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
        auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
        from_number = os.environ.get("TWILIO_PHONE_NUMBER")

        if not all([account_sid, auth_token, from_number]):
            logger.error("Twilio credentials not configured")
            return False

        client = Client(account_sid, auth_token)
        client.messages.create(
            to=ADMIN_PHONE,
            from_=from_number,
            body=message
        )
        logger.info(f"Sent SMS to {ADMIN_PHONE}: {message[:50]}...")
        return True
    except Exception as e:
        logger.error(f"Failed to send SMS: {e}")
        return False


def stop_service():
    """Stop the Thunderbird service."""
    try:
        result = subprocess.run(
            ["systemctl", "stop", "overland"],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            logger.warning("SERVICE STOPPED due to cost threshold")
            return True
        else:
            logger.error(f"Failed to stop service: {result.stderr}")
            return False
    except Exception as e:
        logger.error(f"Failed to stop service: {e}")
        return False


def check_service_status() -> bool:
    """Check if service is running."""
    try:
        result = subprocess.run(
            ["systemctl", "is-active", "overland"],
            capture_output=True,
            text=True
        )
        return result.stdout.strip() == "active"
    except:
        return False


def main():
    """Main monitoring loop."""
    logger.info("Cost monitor check starting...")

    # Get current cost
    cost = get_today_cost()
    logger.info(f"Today's SMS cost: ${cost:.2f}")

    # Get alerts already sent today
    alerts_sent = get_today_alerts()

    # Check thresholds
    if cost >= STOP_THRESHOLD:
        if "stopped" not in alerts_sent:
            logger.warning(f"COST THRESHOLD EXCEEDED: ${cost:.2f} >= ${STOP_THRESHOLD}")

            # Stop the service first
            if check_service_status():
                stop_service()

            # Send notification
            send_sms(
                f"THUNDERBIRD DISABLED\n"
                f"Daily cost ${cost:.2f} exceeded ${STOP_THRESHOLD} limit.\n"
                f"Service stopped to prevent overrun.\n"
                f"To restart: systemctl start overland"
            )
            mark_alert_sent("stopped")
        else:
            logger.info("Service already stopped today, skipping")

    elif cost >= WARN_THRESHOLD:
        if "warning" not in alerts_sent:
            logger.warning(f"COST WARNING: ${cost:.2f} >= ${WARN_THRESHOLD}")

            send_sms(
                f"THUNDERBIRD WARNING\n"
                f"Daily SMS cost: ${cost:.2f}\n"
                f"Approaching ${STOP_THRESHOLD} limit.\n"
                f"Service will auto-disable at ${STOP_THRESHOLD}."
            )
            mark_alert_sent("warning")
        else:
            logger.info("Warning already sent today, skipping")
    else:
        logger.info(f"Cost ${cost:.2f} is below warning threshold ${WARN_THRESHOLD}")

    logger.info("Cost monitor check complete")


if __name__ == "__main__":
    # Load environment from .env file if running standalone
    env_file = Path("/root/overland-weather/.env")
    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ.setdefault(key.strip(), value.strip())

    main()
