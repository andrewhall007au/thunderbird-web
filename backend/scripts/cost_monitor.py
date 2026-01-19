#!/usr/bin/env python3
"""
Cost Monitor for Thunderbird Beta Testing

Two modes:
1. Regular check (every 5 min): Only alerts at thresholds
2. Daily summary (9am): Sends yesterday's cost + today's running total

Cron setup:
  */5 * * * * /root/overland-weather/venv/bin/python /root/overland-weather/scripts/cost_monitor.py
  0 9 * * * /root/overland-weather/venv/bin/python /root/overland-weather/scripts/cost_monitor.py --daily

Logs to: /var/log/thunderbird-cost-monitor.log
"""

import os
import sys
import sqlite3
import subprocess
import logging
import argparse
from datetime import date, datetime, timedelta
from pathlib import Path

# Configuration
WARN_THRESHOLD = 20.0   # Send warning SMS at $20
STOP_THRESHOLD = 25.0   # Stop service at $25
ADMIN_PHONE = os.environ.get("ADMIN_PHONE", "+61410663673")
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


def get_cost_for_date(target_date: date) -> float:
    """Get total SMS cost for a specific date."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.execute("""
            SELECT COALESCE(SUM(cost_aud), 0) as total_cost
            FROM message_log
            WHERE direction = 'outbound'
            AND date(sent_at) = ?
        """, (target_date.isoformat(),))
        row = cursor.fetchone()
        conn.close()
        return float(row[0]) if row else 0.0
    except Exception as e:
        logger.error(f"Failed to query database: {e}")
        return 0.0


def get_today_cost() -> float:
    """Get today's total SMS cost."""
    return get_cost_for_date(date.today())


def get_yesterday_cost() -> float:
    """Get yesterday's total SMS cost."""
    return get_cost_for_date(date.today() - timedelta(days=1))


def get_month_cost() -> float:
    """Get current month's total SMS cost."""
    try:
        conn = sqlite3.connect(DB_PATH)
        month_start = date.today().replace(day=1).isoformat()
        cursor = conn.execute("""
            SELECT COALESCE(SUM(cost_aud), 0) as total_cost
            FROM message_log
            WHERE direction = 'outbound'
            AND date(sent_at) >= ?
        """, (month_start,))
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

    lines = []
    if Path(STATE_FILE).exists():
        with open(STATE_FILE, 'r') as f:
            # Keep only today's alerts (clean up old ones)
            lines = [l.strip() for l in f if l.startswith(today)]

    lines.append(f"{today}|{alert_type}")

    with open(STATE_FILE, 'w') as f:
        f.write('\n'.join(lines) + '\n')


def send_sms(message: str) -> bool:
    """Send SMS via Twilio."""
    try:
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


def send_daily_summary():
    """Send 9am daily summary SMS."""
    logger.info("Sending daily summary...")

    yesterday_cost = get_yesterday_cost()
    today_cost = get_today_cost()
    month_cost = get_month_cost()

    message = (
        f"THUNDERBIRD DAILY\n"
        f"Yesterday: ${yesterday_cost:.2f}\n"
        f"Today so far: ${today_cost:.2f}\n"
        f"Month total: ${month_cost:.2f}\n"
        f"Limit: ${STOP_THRESHOLD}/day"
    )

    if send_sms(message):
        logger.info("Daily summary sent")
    else:
        logger.error("Failed to send daily summary")


def check_thresholds():
    """Check cost thresholds and alert/disable as needed."""
    logger.info("Cost monitor check starting...")

    cost = get_today_cost()
    logger.info(f"Today's SMS cost: ${cost:.2f}")

    alerts_sent = get_today_alerts()

    if cost >= STOP_THRESHOLD:
        if "stopped" not in alerts_sent:
            logger.warning(f"COST THRESHOLD EXCEEDED: ${cost:.2f} >= ${STOP_THRESHOLD}")

            if check_service_status():
                stop_service()

            send_sms(
                f"THUNDERBIRD DISABLED\n"
                f"Daily cost ${cost:.2f} exceeded ${STOP_THRESHOLD} limit.\n"
                f"Service stopped.\n"
                f"To restart: systemctl start overland"
            )
            mark_alert_sent("stopped")
        else:
            logger.info("Service already stopped today")

    elif cost >= WARN_THRESHOLD:
        if "warning" not in alerts_sent:
            logger.warning(f"COST WARNING: ${cost:.2f} >= ${WARN_THRESHOLD}")

            send_sms(
                f"THUNDERBIRD WARNING\n"
                f"Daily cost: ${cost:.2f}\n"
                f"Limit: ${STOP_THRESHOLD}\n"
                f"Service will auto-disable at limit."
            )
            mark_alert_sent("warning")
        else:
            logger.info("Warning already sent today")
    else:
        logger.info(f"Cost ${cost:.2f} below warning threshold ${WARN_THRESHOLD}")

    logger.info("Cost monitor check complete")


def main():
    parser = argparse.ArgumentParser(description="Thunderbird cost monitor")
    parser.add_argument("--daily", action="store_true", help="Send daily summary (9am)")
    args = parser.parse_args()

    if args.daily:
        send_daily_summary()
    else:
        check_thresholds()


if __name__ == "__main__":
    # Load environment from .env file
    env_file = Path("/root/overland-weather/.env")
    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ.setdefault(key.strip(), value.strip())

    main()
