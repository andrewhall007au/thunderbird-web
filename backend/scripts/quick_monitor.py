#!/usr/bin/env python3
"""
Quick monitoring script for immediate production protection.
Runs smoke tests and sends SMS alerts on failure.

Usage:
  python quick_monitor.py --url https://thunderbird.bot --phone +61XXXXXXXXX

Cron setup (every 5 minutes):
  */5 * * * * cd /root/overland-weather && source venv/bin/activate && python scripts/quick_monitor.py --url https://thunderbird.bot --phone +61XXXXXXXXX >> /var/log/thunderbird-monitor.log 2>&1
"""

import sys
import os
import argparse
import requests
from datetime import datetime
from typing import Optional

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from config.settings import settings


class QuickMonitor:
    def __init__(self, base_url: str, alert_phone: Optional[str] = None):
        self.base_url = base_url.rstrip('/')
        self.alert_phone = alert_phone
        self.failed_tests = []
        self.passed_tests = []

    def log(self, message: str, level: str = "INFO"):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] [{level}] {message}")

    def send_sms_alert(self, message: str):
        """Send SMS alert via Twilio"""
        if not self.alert_phone:
            self.log("No alert phone configured, skipping SMS", "WARN")
            return

        if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
            self.log("Twilio credentials not configured", "ERROR")
            return

        try:
            from twilio.rest import Client
            client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

            client.messages.create(
                body=message,
                from_=settings.TWILIO_PHONE_NUMBER,
                to=self.alert_phone
            )
            self.log(f"SMS alert sent to {self.alert_phone}", "INFO")
        except Exception as e:
            self.log(f"Failed to send SMS alert: {e}", "ERROR")

    def test_backend_health(self):
        """Test backend health endpoint"""
        try:
            response = requests.get(f"{self.base_url}/health", timeout=10)
            if response.status_code == 200:
                self.passed_tests.append("Backend Health")
                return True
            else:
                self.failed_tests.append(f"Backend Health (HTTP {response.status_code})")
                return False
        except Exception as e:
            self.failed_tests.append(f"Backend Health ({str(e)})")
            return False

    def test_frontend_loads(self):
        """Test frontend homepage loads"""
        try:
            response = requests.get(self.base_url, timeout=10)
            if response.status_code == 200 and len(response.content) > 1000:
                self.passed_tests.append("Frontend Loads")
                return True
            else:
                self.failed_tests.append(f"Frontend Loads (HTTP {response.status_code})")
                return False
        except Exception as e:
            self.failed_tests.append(f"Frontend Loads ({str(e)})")
            return False

    def test_beta_signup_endpoint(self):
        """Test beta signup endpoint responds"""
        try:
            response = requests.post(
                f"{self.base_url}/api/beta/apply",
                json={"name": "", "email": "", "country": ""},
                timeout=10
            )
            # Should get validation error (422) or success (200), not 404 or 500
            if response.status_code in [200, 400, 422]:
                self.passed_tests.append("Beta Signup Endpoint")
                return True
            else:
                self.failed_tests.append(f"Beta Signup Endpoint (HTTP {response.status_code})")
                return False
        except Exception as e:
            self.failed_tests.append(f"Beta Signup Endpoint ({str(e)})")
            return False

    def test_api_response_time(self):
        """Test API response time is acceptable"""
        try:
            import time
            start = time.time()
            response = requests.get(f"{self.base_url}/health", timeout=10)
            elapsed = time.time() - start

            if elapsed < 2.0:  # 2 second threshold
                self.passed_tests.append(f"Response Time ({elapsed:.2f}s)")
                return True
            else:
                self.failed_tests.append(f"Response Time SLOW ({elapsed:.2f}s)")
                return False
        except Exception as e:
            self.failed_tests.append(f"Response Time ({str(e)})")
            return False

    def run_tests(self):
        """Run all monitoring tests"""
        self.log("Starting monitoring tests...", "INFO")

        all_passed = True
        all_passed &= self.test_backend_health()
        all_passed &= self.test_frontend_loads()
        all_passed &= self.test_beta_signup_endpoint()
        all_passed &= self.test_api_response_time()

        return all_passed

    def generate_alert_message(self) -> str:
        """Generate SMS alert message"""
        timestamp = datetime.now().strftime("%H:%M UTC")

        if len(self.failed_tests) == 1:
            return (
                f"🚨 THUNDERBIRD ALERT\n"
                f"Test Failed: {self.failed_tests[0]}\n"
                f"Time: {timestamp}\n"
                f"Check: {self.base_url}"
            )
        else:
            failed_list = "\n".join([f"- {test}" for test in self.failed_tests])
            return (
                f"🚨 THUNDERBIRD ALERT\n"
                f"{len(self.failed_tests)} tests failed:\n"
                f"{failed_list}\n"
                f"Time: {timestamp}"
            )

    def generate_report(self) -> str:
        """Generate status report"""
        total = len(self.passed_tests) + len(self.failed_tests)
        passed = len(self.passed_tests)

        report = [
            f"\n{'='*60}",
            f"Monitoring Report - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"{'='*60}",
            f"Target: {self.base_url}",
            f"Status: {'✅ ALL PASS' if not self.failed_tests else '❌ FAILURES'}",
            f"Tests: {passed}/{total} passed",
            f"{'='*60}",
        ]

        if self.passed_tests:
            report.append("\n✅ Passed Tests:")
            for test in self.passed_tests:
                report.append(f"  - {test}")

        if self.failed_tests:
            report.append("\n❌ Failed Tests:")
            for test in self.failed_tests:
                report.append(f"  - {test}")

        report.append(f"\n{'='*60}\n")

        return "\n".join(report)


def main():
    parser = argparse.ArgumentParser(description="Quick monitoring for Thunderbird production")
    parser.add_argument(
        "--url",
        default="https://thunderbird.bot",
        help="Base URL to monitor"
    )
    parser.add_argument(
        "--phone",
        help="Phone number for SMS alerts (E.164 format, e.g., +61412345678)"
    )
    parser.add_argument(
        "--no-alert",
        action="store_true",
        help="Skip SMS alerts even if phone is provided"
    )
    args = parser.parse_args()

    monitor = QuickMonitor(args.url, args.phone if not args.no_alert else None)

    # Run tests
    all_passed = monitor.run_tests()

    # Print report
    print(monitor.generate_report())

    # Send alert if failures
    if not all_passed and monitor.alert_phone:
        alert_message = monitor.generate_alert_message()
        monitor.send_sms_alert(alert_message)

    # Exit code 0 if all passed, 1 if any failed
    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
