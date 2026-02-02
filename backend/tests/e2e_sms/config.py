"""
E2E SMS Test Configuration

Environment-based configuration for Twilio test numbers and endpoints.
"""
import os
from dataclasses import dataclass
from typing import Optional


@dataclass
class E2ETestConfig:
    """Configuration for E2E SMS testing."""

    # Twilio credentials (can use separate test account)
    twilio_account_sid: str
    twilio_auth_token: str

    # Phone numbers
    thunderbird_number: str  # The main Thunderbird number to test
    us_test_number: str      # US Twilio number for sending tests
    ca_test_number: str      # CA Twilio number for sending tests

    # Webhook for capturing responses
    test_webhook_base_url: str

    # Timeouts
    response_timeout_seconds: int = 120  # Max wait for response (satellite can be slow)
    inter_test_delay_seconds: int = 3    # Delay between tests (rate limiting)

    # Limits
    max_acceptable_segments: int = 8     # Max SMS segments for satellite-friendly response

    @classmethod
    def from_env(cls) -> "E2ETestConfig":
        """Load configuration from environment variables."""
        return cls(
            twilio_account_sid=os.environ.get("TWILIO_TEST_ACCOUNT_SID", os.environ.get("TWILIO_ACCOUNT_SID", "")),
            twilio_auth_token=os.environ.get("TWILIO_TEST_AUTH_TOKEN", os.environ.get("TWILIO_AUTH_TOKEN", "")),
            thunderbird_number=os.environ.get("THUNDERBIRD_NUMBER", ""),
            us_test_number=os.environ.get("US_TEST_NUMBER", ""),
            ca_test_number=os.environ.get("CA_TEST_NUMBER", ""),
            test_webhook_base_url=os.environ.get("TEST_WEBHOOK_BASE_URL", "http://localhost:8000"),
            response_timeout_seconds=int(os.environ.get("E2E_RESPONSE_TIMEOUT", "120")),
            inter_test_delay_seconds=int(os.environ.get("E2E_INTER_TEST_DELAY", "3")),
            max_acceptable_segments=int(os.environ.get("E2E_MAX_SEGMENTS", "8")),
        )

    def validate(self) -> list[str]:
        """Validate configuration, return list of errors."""
        errors = []

        if not self.twilio_account_sid:
            errors.append("TWILIO_TEST_ACCOUNT_SID or TWILIO_ACCOUNT_SID is required")
        if not self.twilio_auth_token:
            errors.append("TWILIO_TEST_AUTH_TOKEN or TWILIO_AUTH_TOKEN is required")
        if not self.thunderbird_number:
            errors.append("THUNDERBIRD_NUMBER is required")
        if not self.us_test_number:
            errors.append("US_TEST_NUMBER is required for US tests")
        if not self.ca_test_number:
            errors.append("CA_TEST_NUMBER is required for CA tests")
        if not self.test_webhook_base_url:
            errors.append("TEST_WEBHOOK_BASE_URL is required")

        return errors


# Test case definitions
@dataclass
class SMSTestCase:
    """Definition of a single SMS test case."""
    test_id: str
    country: str  # "US" or "CA"
    command: str
    description: str
    expected_provider: Optional[str] = None  # "NWS", "EnvCanada", etc.
    expected_contains: Optional[list[str]] = None  # Strings that should be in response
    expected_not_contains: Optional[list[str]] = None  # Strings that should NOT be in response
    max_segments: Optional[int] = None  # Override default max segments


# US Test Cases - NWS Provider
US_TEST_CASES = [
    SMSTestCase(
        test_id="us_yosemite_cast7",
        country="US",
        command="CAST7 37.7459,-119.5332",
        description="Yosemite Valley 7-day forecast",
        expected_provider="NWS",
        expected_contains=["GPS", "37.7459"],
    ),
    SMSTestCase(
        test_id="us_rainier_cast7",
        country="US",
        command="CAST7 46.8523,-121.7603",
        description="Mt Rainier 7-day forecast (high altitude)",
        expected_provider="NWS",
        expected_contains=["GPS", "46.8523"],
    ),
    SMSTestCase(
        test_id="us_grandcanyon_cast7",
        country="US",
        command="CAST7 36.0544,-112.1401",
        description="Grand Canyon 7-day forecast",
        expected_provider="NWS",
        expected_contains=["GPS", "36.0544"],
    ),
    SMSTestCase(
        test_id="us_colorado_cast12",
        country="US",
        command="CAST 39.5501,-105.7821",
        description="Colorado 12-hour forecast",
        expected_provider="NWS",
        expected_contains=["GPS"],
    ),
    SMSTestCase(
        test_id="us_denali_cast7",
        country="US",
        command="CAST7 63.0695,-151.0074",
        description="Denali Alaska 7-day forecast",
        expected_provider="NWS",
        expected_contains=["GPS", "63.0695"],
    ),
    SMSTestCase(
        test_id="us_help",
        country="US",
        command="HELP",
        description="Help command from US number",
        expected_contains=["CAST"],
    ),
]

# Canada Test Cases - Environment Canada Provider
CA_TEST_CASES = [
    SMSTestCase(
        test_id="ca_banff_cast7",
        country="CA",
        command="CAST7 51.4254,-116.1773",
        description="Banff 7-day forecast",
        expected_provider="EnvCanada",
        expected_contains=["GPS", "51.4254"],
    ),
    SMSTestCase(
        test_id="ca_whistler_cast7",
        country="CA",
        command="CAST7 50.1163,-122.9574",
        description="Whistler 7-day forecast",
        expected_provider="EnvCanada",
        expected_contains=["GPS", "50.1163"],
    ),
    SMSTestCase(
        test_id="ca_vancouver_cast12",
        country="CA",
        command="CAST 49.2827,-123.1207",
        description="Vancouver 12-hour forecast",
        expected_provider="EnvCanada",
        expected_contains=["GPS"],
    ),
    SMSTestCase(
        test_id="ca_grosmorne_cast7",
        country="CA",
        command="CAST7 49.5810,-57.7517",
        description="Gros Morne Newfoundland 7-day forecast",
        expected_provider="EnvCanada",
        expected_contains=["GPS", "49.5810"],
    ),
    SMSTestCase(
        test_id="ca_help",
        country="CA",
        command="HELP",
        description="Help command from CA number",
        expected_contains=["CAST"],
    ),
]

# Edge Case Tests
EDGE_CASE_TESTS = [
    SMSTestCase(
        test_id="segment_count_check",
        country="US",
        command="CAST7 37.7459,-119.5332",
        description="Verify response fits in acceptable segment count",
        max_segments=8,
    ),
    SMSTestCase(
        test_id="invalid_coordinates",
        country="US",
        command="CAST7 999.0,999.0",
        description="Invalid coordinates error handling",
        expected_contains=["Unable", "error"],
    ),
]

# All test cases
ALL_TEST_CASES = US_TEST_CASES + CA_TEST_CASES + EDGE_CASE_TESTS
