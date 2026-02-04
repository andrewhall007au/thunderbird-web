"""
Health Checks
Individual check implementations that return structured CheckResult objects.
"""

import time
import requests
import sqlite3
from typing import Optional

from .config import settings
from .storage import CheckResult, store_metric


def check_backend_health() -> CheckResult:
    """Check backend /health endpoint."""
    check_name = "backend_health"
    start = time.monotonic()

    try:
        response = requests.get(
            f"{settings.PRODUCTION_URL}/health",
            timeout=15
        )
        duration_ms = (time.monotonic() - start) * 1000

        if response.status_code == 200:
            result = CheckResult(
                check_name=check_name,
                status="pass",
                duration_ms=duration_ms
            )
        else:
            result = CheckResult(
                check_name=check_name,
                status="fail",
                duration_ms=duration_ms,
                error_message=f"HTTP {response.status_code}"
            )

    except Exception as e:
        duration_ms = (time.monotonic() - start) * 1000
        result = CheckResult(
            check_name=check_name,
            status="fail",
            duration_ms=duration_ms,
            error_message=str(e)
        )

    return result


def check_frontend_loads() -> CheckResult:
    """Check frontend homepage loads."""
    check_name = "frontend_loads"
    start = time.monotonic()

    try:
        response = requests.get(
            settings.PRODUCTION_URL,
            timeout=15
        )
        duration_ms = (time.monotonic() - start) * 1000

        if response.status_code == 200 and len(response.content) > 1000:
            result = CheckResult(
                check_name=check_name,
                status="pass",
                duration_ms=duration_ms,
                metadata={"content_length": len(response.content)}
            )
        else:
            result = CheckResult(
                check_name=check_name,
                status="fail",
                duration_ms=duration_ms,
                error_message=f"HTTP {response.status_code}, content length {len(response.content)}"
            )

    except Exception as e:
        duration_ms = (time.monotonic() - start) * 1000
        result = CheckResult(
            check_name=check_name,
            status="fail",
            duration_ms=duration_ms,
            error_message=str(e)
        )

    return result


def check_beta_signup_endpoint() -> CheckResult:
    """Check beta signup endpoint responds correctly to validation."""
    check_name = "beta_signup_endpoint"
    start = time.monotonic()

    try:
        response = requests.post(
            f"{settings.PRODUCTION_URL}/api/beta/apply",
            json={"name": "", "email": "", "country": ""},
            timeout=15
        )
        duration_ms = (time.monotonic() - start) * 1000

        # Should get validation error (400/422) or success (200), not 404 or 500
        if response.status_code in [200, 400, 422]:
            result = CheckResult(
                check_name=check_name,
                status="pass",
                duration_ms=duration_ms,
                metadata={"status_code": response.status_code}
            )
        else:
            result = CheckResult(
                check_name=check_name,
                status="fail",
                duration_ms=duration_ms,
                error_message=f"Unexpected HTTP {response.status_code}"
            )

    except Exception as e:
        duration_ms = (time.monotonic() - start) * 1000
        result = CheckResult(
            check_name=check_name,
            status="fail",
            duration_ms=duration_ms,
            error_message=str(e)
        )

    return result


def check_api_response_time() -> CheckResult:
    """Check API response time is acceptable."""
    check_name = "api_response_time"
    start = time.monotonic()

    try:
        response = requests.get(
            f"{settings.PRODUCTION_URL}/health",
            timeout=15
        )
        duration_ms = (time.monotonic() - start) * 1000

        if response.status_code != 200:
            result = CheckResult(
                check_name=check_name,
                status="fail",
                duration_ms=duration_ms,
                error_message=f"HTTP {response.status_code}"
            )
        elif duration_ms < 1000:
            # Fast response (< 1s)
            result = CheckResult(
                check_name=check_name,
                status="pass",
                duration_ms=duration_ms
            )
        elif duration_ms < 2000:
            # Slow but acceptable (1-2s)
            result = CheckResult(
                check_name=check_name,
                status="degraded",
                duration_ms=duration_ms,
                error_message="Response time between 1-2s"
            )
        else:
            # Too slow (> 2s)
            result = CheckResult(
                check_name=check_name,
                status="fail",
                duration_ms=duration_ms,
                error_message=f"Response time {duration_ms:.0f}ms exceeds 2s threshold"
            )

    except Exception as e:
        duration_ms = (time.monotonic() - start) * 1000
        result = CheckResult(
            check_name=check_name,
            status="fail",
            duration_ms=duration_ms,
            error_message=str(e)
        )

    return result


def check_database_health() -> CheckResult:
    """
    Check database connectivity.
    Note: The backend /health endpoint already checks DB, so this delegates to that.
    """
    # This is essentially the same as check_backend_health for now
    # since the backend health endpoint includes DB checks
    return check_backend_health()


def check_weather_api() -> CheckResult:
    """Check weather API endpoint responds."""
    check_name = "weather_api"
    start = time.monotonic()

    try:
        # Test with dummy coordinates
        response = requests.post(
            f"{settings.PRODUCTION_URL}/api/routes/forecast-preview",
            json={
                "coordinates": [
                    {"lat": -39.0, "lon": 143.0, "elevation": 1000}
                ]
            },
            timeout=15
        )
        duration_ms = (time.monotonic() - start) * 1000

        # Should get 200/400/422, not 404 or 500
        if response.status_code in [200, 400, 422]:
            result = CheckResult(
                check_name=check_name,
                status="pass",
                duration_ms=duration_ms,
                metadata={"status_code": response.status_code}
            )
        else:
            result = CheckResult(
                check_name=check_name,
                status="fail",
                duration_ms=duration_ms,
                error_message=f"HTTP {response.status_code}"
            )

    except Exception as e:
        duration_ms = (time.monotonic() - start) * 1000
        result = CheckResult(
            check_name=check_name,
            status="fail",
            duration_ms=duration_ms,
            error_message=str(e)
        )

    return result


def check_database_query_performance() -> CheckResult:
    """
    Check database query performance separately from basic connectivity.
    Tests representative queries against the production database.
    """
    check_name = "db_query_performance"
    overall_start = time.monotonic()

    try:
        # Connect to production database (read-only)
        conn = sqlite3.connect(
            f"file:{settings.PRODUCTION_DB_PATH}?mode=ro",
            uri=True,
            timeout=5
        )

        metadata = {}

        # Test 1: Simple aggregate query
        start = time.monotonic()
        cursor = conn.execute("SELECT COUNT(*) FROM accounts")
        cursor.fetchone()
        simple_query_ms = (time.monotonic() - start) * 1000
        metadata["simple_query_ms"] = round(simple_query_ms, 2)

        # Test 2: Join query (representative of typical load)
        start = time.monotonic()
        cursor = conn.execute("""
            SELECT COUNT(*)
            FROM orders o
            JOIN accounts a ON o.account_id = a.id
            WHERE o.created_at > datetime('now', '-7 days')
        """)
        cursor.fetchone()
        join_query_ms = (time.monotonic() - start) * 1000
        metadata["join_query_ms"] = round(join_query_ms, 2)

        conn.close()

        # Determine status based on thresholds
        overall_duration_ms = (time.monotonic() - overall_start) * 1000
        threshold = settings.DB_QUERY_SLOW_THRESHOLD_MS

        max_query_ms = max(simple_query_ms, join_query_ms)

        if max_query_ms < threshold:
            result = CheckResult(
                check_name=check_name,
                status="pass",
                duration_ms=overall_duration_ms,
                metadata=metadata
            )
        elif max_query_ms < threshold * 2:
            # Degraded: slow but not critical
            result = CheckResult(
                check_name=check_name,
                status="degraded",
                duration_ms=overall_duration_ms,
                error_message=f"Queries slow: max {max_query_ms:.0f}ms (threshold: {threshold}ms)",
                metadata=metadata
            )
        else:
            # Failed: critically slow
            result = CheckResult(
                check_name=check_name,
                status="fail",
                duration_ms=overall_duration_ms,
                error_message=f"Queries critically slow: max {max_query_ms:.0f}ms (threshold: {threshold}ms)",
                metadata=metadata
            )

    except Exception as e:
        overall_duration_ms = (time.monotonic() - overall_start) * 1000
        result = CheckResult(
            check_name=check_name,
            status="fail",
            duration_ms=overall_duration_ms,
            error_message=f"Database query error: {str(e)}"
        )

    return result


def check_external_api_latency() -> CheckResult:
    """
    Check latency to external APIs that Thunderbird depends on.
    Tests Stripe, Twilio, and Open-Meteo weather API.
    """
    check_name = "external_api_latency"
    overall_start = time.monotonic()

    metadata = {}
    statuses = []

    # Test Stripe API
    try:
        start = time.monotonic()
        if settings.STRIPE_SECRET_KEY:
            # Authenticated call if key available
            response = requests.get(
                "https://api.stripe.com/v1/balance",
                auth=(settings.STRIPE_SECRET_KEY, ""),
                timeout=10
            )
        else:
            # Just test reachability
            response = requests.get(
                "https://api.stripe.com/",
                timeout=10
            )
        stripe_ms = (time.monotonic() - start) * 1000
        metadata["stripe_ms"] = round(stripe_ms, 2)

        if response.status_code in [200, 401]:
            statuses.append("pass" if stripe_ms < settings.EXTERNAL_API_SLOW_THRESHOLD_MS else "degraded")
        else:
            statuses.append("fail")
            metadata["stripe_error"] = f"HTTP {response.status_code}"

    except Exception as e:
        stripe_ms = (time.monotonic() - start) * 1000
        metadata["stripe_ms"] = round(stripe_ms, 2)
        metadata["stripe_error"] = str(e)
        statuses.append("fail")

    # Test Twilio API
    try:
        start = time.monotonic()
        if settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
            # Authenticated call if credentials available
            response = requests.get(
                f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}.json",
                auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
                timeout=10
            )
        else:
            # Just test reachability
            response = requests.get(
                "https://api.twilio.com/",
                timeout=10
            )
        twilio_ms = (time.monotonic() - start) * 1000
        metadata["twilio_ms"] = round(twilio_ms, 2)

        if response.status_code in [200, 401]:
            statuses.append("pass" if twilio_ms < settings.EXTERNAL_API_SLOW_THRESHOLD_MS else "degraded")
        else:
            statuses.append("fail")
            metadata["twilio_error"] = f"HTTP {response.status_code}"

    except Exception as e:
        twilio_ms = (time.monotonic() - start) * 1000
        metadata["twilio_ms"] = round(twilio_ms, 2)
        metadata["twilio_error"] = str(e)
        statuses.append("fail")

    # Test Open-Meteo weather API
    try:
        start = time.monotonic()
        response = requests.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": 0,
                "longitude": 0,
                "hourly": "temperature_2m",
                "forecast_days": 1
            },
            timeout=10
        )
        openmeteo_ms = (time.monotonic() - start) * 1000
        metadata["openmeteo_ms"] = round(openmeteo_ms, 2)

        if response.status_code == 200:
            statuses.append("pass" if openmeteo_ms < settings.EXTERNAL_API_SLOW_THRESHOLD_MS else "degraded")
        else:
            statuses.append("fail")
            metadata["openmeteo_error"] = f"HTTP {response.status_code}"

    except Exception as e:
        openmeteo_ms = (time.monotonic() - start) * 1000
        metadata["openmeteo_ms"] = round(openmeteo_ms, 2)
        metadata["openmeteo_error"] = str(e)
        statuses.append("fail")

    # Aggregate status
    overall_duration_ms = (time.monotonic() - overall_start) * 1000

    if all(s == "pass" for s in statuses):
        status = "pass"
        error_message = None
    elif "fail" in statuses:
        status = "fail"
        failed_apis = []
        if "stripe_error" in metadata:
            failed_apis.append("Stripe")
        if "twilio_error" in metadata:
            failed_apis.append("Twilio")
        if "openmeteo_error" in metadata:
            failed_apis.append("Open-Meteo")
        error_message = f"Failed APIs: {', '.join(failed_apis)}"
    else:
        status = "degraded"
        error_message = "Some APIs slow"

    result = CheckResult(
        check_name=check_name,
        status=status,
        duration_ms=overall_duration_ms,
        error_message=error_message,
        metadata=metadata
    )

    return result


def run_all_health_checks() -> list[CheckResult]:
    """
    Run all health checks and store results.

    Returns:
        List of CheckResult objects
    """
    checks = [
        check_backend_health,
        check_frontend_loads,
        check_beta_signup_endpoint,
        check_api_response_time,
        check_weather_api,
        check_database_query_performance,
        check_external_api_latency,
    ]

    results = []

    for check_func in checks:
        try:
            result = check_func()
            results.append(result)

            # Store metric
            store_metric(
                check_name=result.check_name,
                status=result.status,
                duration_ms=result.duration_ms,
                error_message=result.error_message,
                metadata=result.metadata
            )

        except Exception as e:
            # If check function itself crashes, record it
            result = CheckResult(
                check_name=check_func.__name__,
                status="fail",
                duration_ms=0,
                error_message=f"Check function crashed: {str(e)}"
            )
            results.append(result)

            store_metric(
                check_name=result.check_name,
                status=result.status,
                duration_ms=result.duration_ms,
                error_message=result.error_message
            )

    return results
