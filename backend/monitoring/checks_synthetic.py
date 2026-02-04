"""
Synthetic Test Runner
Executes Playwright E2E tests as synthetic monitors against production.
"""

import subprocess
import json
import time
import os
import requests
from pathlib import Path
from typing import Optional

from .config import settings
from .storage import CheckResult


def run_playwright_check(test_file: str, test_name: Optional[str] = None) -> CheckResult:
    """
    Run a Playwright test against production as a synthetic monitor.

    Args:
        test_file: Path to test file (e.g., "beta-signup-flow.spec.ts")
        test_name: Optional specific test name to run (uses --grep)

    Returns:
        CheckResult with test pass/fail status and duration
    """
    # Derive check name from test file
    check_name = f"synthetic_{test_file.replace('.spec.ts', '').replace('-', '_')}"

    start = time.monotonic()

    # Project root is parent of backend/
    project_root = Path(__file__).parent.parent.parent

    # Build Playwright command
    cmd = [
        "npx",
        "playwright",
        "test",
        f"e2e/{test_file}",
        "--config=e2e/monitoring.config.ts",
        "--reporter=json"
    ]

    if test_name:
        cmd.extend(["--grep", test_name])

    # Set environment variables
    env = os.environ.copy()
    env.update({
        "BASE_URL": settings.PRODUCTION_URL,
        "NODE_ENV": "production",
        "CI": "true"
    })

    try:
        # Run Playwright test
        result = subprocess.run(
            cmd,
            cwd=str(project_root),
            env=env,
            capture_output=True,
            text=True,
            timeout=180  # 3 minute subprocess timeout
        )

        duration_ms = (time.monotonic() - start) * 1000

        # Parse JSON output from the results file
        results_file = Path("/tmp/playwright-monitor-results.json")

        if results_file.exists():
            try:
                with open(results_file, 'r') as f:
                    test_results = json.load(f)

                # Extract overall status
                # Playwright JSON reporter structure:
                # { "suites": [...], "stats": { "expected": N, "unexpected": M } }
                stats = test_results.get("stats", {})
                unexpected_failures = stats.get("unexpected", 0)

                # Check if any test failed
                if unexpected_failures > 0:
                    # Extract error message from first failure
                    error_message = "Test failed"
                    suites = test_results.get("suites", [])
                    if suites:
                        for suite in suites:
                            specs = suite.get("specs", [])
                            for spec in specs:
                                tests = spec.get("tests", [])
                                for test in tests:
                                    results = test.get("results", [])
                                    for test_result in results:
                                        if test_result.get("status") == "failed":
                                            error = test_result.get("error", {})
                                            error_message = error.get("message", "Test failed")
                                            # Truncate long error messages
                                            if len(error_message) > 500:
                                                error_message = error_message[:500] + "..."
                                            break

                    return CheckResult(
                        check_name=check_name,
                        status="fail",
                        duration_ms=duration_ms,
                        error_message=error_message,
                        metadata={"test_file": test_file, "output_file": str(results_file)}
                    )
                else:
                    # All tests passed
                    return CheckResult(
                        check_name=check_name,
                        status="pass",
                        duration_ms=duration_ms,
                        metadata={"test_file": test_file, "output_file": str(results_file)}
                    )

            except json.JSONDecodeError as e:
                # JSON parse failure - return raw stderr
                error_output = result.stderr[:500] if result.stderr else "Unknown error"
                return CheckResult(
                    check_name=check_name,
                    status="fail",
                    duration_ms=duration_ms,
                    error_message=f"JSON parse error: {error_output}"
                )
        else:
            # No results file generated - test probably crashed
            error_output = result.stderr[:500] if result.stderr else result.stdout[:500]
            return CheckResult(
                check_name=check_name,
                status="fail",
                duration_ms=duration_ms,
                error_message=f"No results file: {error_output}"
            )

    except subprocess.TimeoutExpired:
        duration_ms = (time.monotonic() - start) * 1000
        return CheckResult(
            check_name=check_name,
            status="fail",
            duration_ms=duration_ms,
            error_message="Test timed out after 180 seconds"
        )

    except FileNotFoundError:
        duration_ms = (time.monotonic() - start) * 1000
        return CheckResult(
            check_name=check_name,
            status="fail",
            duration_ms=duration_ms,
            error_message="Playwright not installed (npx not found)"
        )

    except Exception as e:
        duration_ms = (time.monotonic() - start) * 1000
        return CheckResult(
            check_name=check_name,
            status="fail",
            duration_ms=duration_ms,
            error_message=str(e)
        )


def check_beta_signup_synthetic() -> CheckResult:
    """Run beta signup flow synthetic test."""
    return run_playwright_check("beta-signup-flow.spec.ts")


def check_buy_now_synthetic() -> CheckResult:
    """Run buy now/checkout flow synthetic test."""
    return run_playwright_check("buy-now-flow.spec.ts")


def check_create_first_synthetic() -> CheckResult:
    """Run create-first route flow synthetic test."""
    return run_playwright_check("create-first-flow.spec.ts")


def check_login_synthetic() -> CheckResult:
    """
    Test login/authentication flow via HTTP.

    Tests the authentication endpoint with a monitoring test account.
    Requires MONITOR_TEST_EMAIL and MONITOR_TEST_PASSWORD environment variables.
    """
    check_name = "synthetic_login"
    start = time.monotonic()

    # Get test credentials from environment
    test_email = os.getenv("MONITOR_TEST_EMAIL")
    test_password = os.getenv("MONITOR_TEST_PASSWORD")

    if not test_email or not test_password:
        duration_ms = (time.monotonic() - start) * 1000
        return CheckResult(
            check_name=check_name,
            status="fail",
            duration_ms=duration_ms,
            error_message="MONITOR_TEST_EMAIL or MONITOR_TEST_PASSWORD not set"
        )

    try:
        # POST to login endpoint
        response = requests.post(
            f"{settings.PRODUCTION_URL}/api/auth/login",
            json={"email": test_email, "password": test_password},
            timeout=15
        )

        duration_ms = (time.monotonic() - start) * 1000

        if response.status_code == 200:
            # Check that we got a token back
            data = response.json()
            if "access_token" in data or "token" in data:
                return CheckResult(
                    check_name=check_name,
                    status="pass",
                    duration_ms=duration_ms,
                    metadata={"status_code": response.status_code}
                )
            else:
                return CheckResult(
                    check_name=check_name,
                    status="fail",
                    duration_ms=duration_ms,
                    error_message="Login succeeded but no token in response"
                )
        else:
            return CheckResult(
                check_name=check_name,
                status="fail",
                duration_ms=duration_ms,
                error_message=f"HTTP {response.status_code}: {response.text[:200]}"
            )

    except Exception as e:
        duration_ms = (time.monotonic() - start) * 1000
        return CheckResult(
            check_name=check_name,
            status="fail",
            duration_ms=duration_ms,
            error_message=str(e)
        )


def check_sms_webhook_synthetic() -> CheckResult:
    """
    Test SMS webhook handling pipeline via HTTP.

    Sends a synthetic PING message to the webhook endpoint to verify
    the inbound SMS pipeline is functional.

    Requires MONITOR_TEST_PHONE environment variable.
    """
    check_name = "synthetic_sms_webhook"
    start = time.monotonic()

    # Get test phone number from environment
    test_phone = os.getenv("MONITOR_TEST_PHONE")

    if not test_phone:
        duration_ms = (time.monotonic() - start) * 1000
        return CheckResult(
            check_name=check_name,
            status="fail",
            duration_ms=duration_ms,
            error_message="MONITOR_TEST_PHONE not set"
        )

    try:
        # Construct Twilio webhook payload
        # This matches the format Twilio sends to /api/webhook/sms
        payload = {
            "From": test_phone,
            "To": settings.TWILIO_PHONE_NUMBER or "+18662801940",  # Our service number
            "Body": "PING",
            "MessageSid": f"MONITOR_TEST_{int(time.time())}",
            "AccountSid": settings.TWILIO_ACCOUNT_SID or "TEST",
            "FromCity": "",
            "FromState": "",
            "FromCountry": "US",
        }

        # POST to webhook endpoint
        response = requests.post(
            f"{settings.PRODUCTION_URL}/api/webhook/sms",
            data=payload,  # Twilio sends form data, not JSON
            timeout=15
        )

        duration_ms = (time.monotonic() - start) * 1000

        # Webhook should return 200 or 204 (TwiML response or no content)
        if response.status_code in [200, 204]:
            return CheckResult(
                check_name=check_name,
                status="pass",
                duration_ms=duration_ms,
                metadata={"status_code": response.status_code}
            )
        else:
            return CheckResult(
                check_name=check_name,
                status="fail",
                duration_ms=duration_ms,
                error_message=f"HTTP {response.status_code}: {response.text[:200]}"
            )

    except Exception as e:
        duration_ms = (time.monotonic() - start) * 1000
        return CheckResult(
            check_name=check_name,
            status="fail",
            duration_ms=duration_ms,
            error_message=str(e)
        )
