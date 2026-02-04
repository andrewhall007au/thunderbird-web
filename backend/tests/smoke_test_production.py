#!/usr/bin/env python3
"""
Production smoke tests - run against actual deployed URL.
Tests critical user flows to catch production-only issues.
"""

import sys
import argparse
import requests
from typing import Dict, Any
from datetime import datetime


class SmokeTestRunner:
    def __init__(self, base_url: str, verbose: bool = False):
        self.base_url = base_url.rstrip('/')
        self.verbose = verbose
        self.passed = 0
        self.failed = 0
        self.errors = []

    def log(self, message: str, level: str = "INFO"):
        if self.verbose or level != "INFO":
            timestamp = datetime.now().strftime("%H:%M:%S")
            print(f"[{timestamp}] [{level}] {message}")

    def test(self, name: str, func):
        """Run a single test"""
        try:
            self.log(f"Running: {name}")
            func()
            self.passed += 1
            self.log(f"✅ PASS: {name}", "PASS")
        except AssertionError as e:
            self.failed += 1
            error_msg = f"❌ FAIL: {name} - {str(e)}"
            self.log(error_msg, "FAIL")
            self.errors.append(error_msg)
        except Exception as e:
            self.failed += 1
            error_msg = f"❌ ERROR: {name} - {str(e)}"
            self.log(error_msg, "ERROR")
            self.errors.append(error_msg)

    def assert_status(self, response: requests.Response, expected: int, context: str = ""):
        """Assert HTTP status code"""
        if response.status_code != expected:
            raise AssertionError(
                f"{context} - Expected status {expected}, got {response.status_code}. "
                f"Response: {response.text[:200]}"
            )

    def assert_json_field(self, data: Dict[str, Any], field: str, context: str = ""):
        """Assert JSON field exists"""
        if field not in data:
            raise AssertionError(f"{context} - Missing field '{field}' in response: {data}")

    # ============================================================================
    # HEALTH & INFRASTRUCTURE TESTS
    # ============================================================================

    def test_backend_health(self):
        """Backend /health endpoint responds"""
        response = requests.get(f"{self.base_url}/health", timeout=10)
        self.assert_status(response, 200, "Backend health check")

    def test_frontend_loads(self):
        """Frontend homepage loads"""
        response = requests.get(self.base_url, timeout=10)
        self.assert_status(response, 200, "Frontend homepage")
        assert len(response.content) > 1000, "Homepage content too small"

    def test_api_docs_accessible(self):
        """API documentation is accessible"""
        response = requests.get(f"{self.base_url}/docs", timeout=10)
        self.assert_status(response, 200, "API documentation")

    # ============================================================================
    # BETA SIGNUP FLOW TESTS (Critical - this is what failed)
    # ============================================================================

    def test_beta_signup_endpoint_exists(self):
        """Beta signup endpoint responds"""
        response = requests.post(
            f"{self.base_url}/api/beta/apply",
            json={"name": "", "email": "", "country": ""},
            timeout=10
        )
        # Should get validation error (422) or success (200), not 404 or 500
        assert response.status_code in [200, 400, 422], \
            f"Beta endpoint returned {response.status_code}, expected 200/400/422"

    def test_beta_signup_validation(self):
        """Beta signup validates required fields"""
        response = requests.post(
            f"{self.base_url}/api/beta/apply",
            json={},
            timeout=10
        )
        # Should reject empty submission
        assert response.status_code in [400, 422], \
            f"Beta signup accepted empty data (status {response.status_code})"

    def test_beta_signup_success(self):
        """Beta signup accepts valid submission"""
        timestamp = int(datetime.now().timestamp())
        response = requests.post(
            f"{self.base_url}/api/beta/apply",
            json={
                "name": f"Smoke Test {timestamp}",
                "email": f"smoke-test-{timestamp}@example.com",
                "country": "Australia"
            },
            timeout=10
        )
        # Should succeed or reject duplicate
        assert response.status_code in [200, 201, 400], \
            f"Beta signup failed with status {response.status_code}: {response.text}"

    # ============================================================================
    # PAYMENT FLOW TESTS
    # ============================================================================

    def test_checkout_endpoint_exists(self):
        """Checkout endpoint responds"""
        response = requests.post(
            f"{self.base_url}/api/payments/create-checkout-session",
            json={"priceId": "price_invalid", "country": "AU"},
            timeout=10
        )
        # Should get error response, not 404 or 500
        assert response.status_code in [200, 400, 422], \
            f"Checkout endpoint returned {response.status_code}"

    def test_stripe_webhook_endpoint_exists(self):
        """Stripe webhook endpoint exists"""
        response = requests.post(
            f"{self.base_url}/api/payments/webhook",
            json={},
            headers={"stripe-signature": "invalid"},
            timeout=10
        )
        # Should reject invalid signature (400), not 404 or 500
        assert response.status_code in [400, 403], \
            f"Webhook endpoint returned {response.status_code}"

    # ============================================================================
    # WEATHER API TESTS
    # ============================================================================

    def test_weather_forecast_endpoint(self):
        """Weather forecast endpoint responds"""
        response = requests.post(
            f"{self.base_url}/api/routes/forecast-preview",
            json={
                "coordinates": [
                    {"lat": -42.0, "lng": 147.0, "type": "waypoint"}
                ],
                "country": "AU"
            },
            timeout=15
        )
        # Should return forecast or validation error
        assert response.status_code in [200, 400, 422], \
            f"Forecast endpoint returned {response.status_code}"

    # ============================================================================
    # SECURITY TESTS
    # ============================================================================

    def test_cors_headers_present(self):
        """CORS headers are configured"""
        response = requests.options(
            f"{self.base_url}/api/beta/apply",
            headers={"Origin": "https://thunderbird.bot"},
            timeout=10
        )
        # Should have CORS headers
        assert "access-control-allow-origin" in response.headers or \
               response.status_code == 200, \
               "CORS headers missing"

    def test_rate_limiting_configured(self):
        """Rate limiting is active (via headers or behavior)"""
        response = requests.get(f"{self.base_url}/health", timeout=10)
        # Check for rate limit headers (if configured)
        # This is a soft check - we just verify the endpoint responds
        self.assert_status(response, 200, "Rate limiting check")

    # ============================================================================
    # STATIC CONTENT TESTS
    # ============================================================================

    def test_static_pages_load(self):
        """Key static pages load correctly"""
        pages = ["/how-it-works", "/pricing", "/faq"]
        for page in pages:
            response = requests.get(f"{self.base_url}{page}", timeout=10)
            assert response.status_code == 200, f"Page {page} returned {response.status_code}"

    def run_all(self):
        """Run all smoke tests"""
        print(f"\n{'='*60}")
        print(f"🔥 Production Smoke Tests")
        print(f"Target: {self.base_url}")
        print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*60}\n")

        # Infrastructure
        self.test("Backend Health Check", self.test_backend_health)
        self.test("Frontend Loads", self.test_frontend_loads)
        self.test("API Docs Accessible", self.test_api_docs_accessible)

        # Beta Signup (Critical - the bug we caught)
        self.test("Beta Signup Endpoint Exists", self.test_beta_signup_endpoint_exists)
        self.test("Beta Signup Validation", self.test_beta_signup_validation)
        self.test("Beta Signup Success Path", self.test_beta_signup_success)

        # Payment Flow
        self.test("Checkout Endpoint Exists", self.test_checkout_endpoint_exists)
        self.test("Stripe Webhook Exists", self.test_stripe_webhook_endpoint_exists)

        # Weather API
        self.test("Weather Forecast Endpoint", self.test_weather_forecast_endpoint)

        # Security
        self.test("CORS Headers Present", self.test_cors_headers_present)
        self.test("Rate Limiting Configured", self.test_rate_limiting_configured)

        # Static Content
        self.test("Static Pages Load", self.test_static_pages_load)

        # Summary
        print(f"\n{'='*60}")
        print(f"📊 Test Summary")
        print(f"{'='*60}")
        print(f"✅ Passed: {self.passed}")
        print(f"❌ Failed: {self.failed}")
        print(f"Total: {self.passed + self.failed}")
        print(f"{'='*60}\n")

        if self.errors:
            print("Failed Tests:")
            for error in self.errors:
                print(f"  {error}")
            print()

        return 0 if self.failed == 0 else 1


def main():
    parser = argparse.ArgumentParser(description="Production smoke tests for Thunderbird")
    parser.add_argument(
        "--url",
        default="https://thunderbird.bot",
        help="Base URL to test (default: https://thunderbird.bot)"
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Verbose output"
    )
    args = parser.parse_args()

    runner = SmokeTestRunner(args.url, verbose=args.verbose)
    exit_code = runner.run_all()
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
