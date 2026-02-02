"""
E2E SMS Test Harness

Core testing logic for sending SMS via Twilio test numbers and
capturing/validating responses.
"""
import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional
from enum import Enum

from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

from .config import E2ETestConfig, SMSTestCase

logger = logging.getLogger(__name__)


class TestStatus(Enum):
    """Status of a test execution."""
    PENDING = "pending"
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"
    TIMEOUT = "timeout"
    ERROR = "error"
    SKIPPED = "skipped"


@dataclass
class SMSTestResult:
    """Result of a single SMS test."""
    test_case: SMSTestCase
    status: TestStatus
    started_at: datetime
    completed_at: Optional[datetime] = None
    message_sid: Optional[str] = None
    response_text: Optional[str] = None
    response_time_ms: Optional[int] = None
    segment_count: Optional[int] = None
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def duration_ms(self) -> Optional[int]:
        """Total test duration in milliseconds."""
        if self.completed_at:
            return int((self.completed_at - self.started_at).total_seconds() * 1000)
        return None

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "test_id": self.test_case.test_id,
            "command": self.test_case.command,
            "description": self.test_case.description,
            "country": self.test_case.country,
            "status": self.status.value,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "message_sid": self.message_sid,
            "response_text": self.response_text[:200] if self.response_text else None,
            "response_time_ms": self.response_time_ms,
            "segment_count": self.segment_count,
            "duration_ms": self.duration_ms,
            "errors": self.errors,
            "warnings": self.warnings,
        }


# In-memory response storage (populated by webhook)
# Key: to_number (the test number that receives the response)
# Value: dict with response details
_pending_responses: dict[str, dict] = {}


def register_response(to_number: str, response_body: str, from_number: str):
    """
    Register an incoming response from the Thunderbird number.

    Called by the test webhook endpoint when a response arrives.
    """
    _pending_responses[to_number] = {
        "body": response_body,
        "from": from_number,
        "received_at": datetime.now(timezone.utc),
    }
    logger.info(f"Response registered for {to_number}: {response_body[:50]}...")


def clear_response(to_number: str):
    """Clear any pending response for a test number."""
    _pending_responses.pop(to_number, None)


def get_response(to_number: str) -> Optional[dict]:
    """Get pending response for a test number."""
    return _pending_responses.get(to_number)


class E2ESMSTester:
    """
    End-to-end SMS tester using Twilio test numbers.

    Sends real SMS from US/CA test numbers to the Thunderbird number,
    waits for responses via webhook, and validates the results.
    """

    def __init__(self, config: E2ETestConfig):
        """
        Initialize the tester.

        Args:
            config: Test configuration with credentials and numbers
        """
        self.config = config
        self.client = Client(config.twilio_account_sid, config.twilio_auth_token)

    def _get_from_number(self, country: str) -> str:
        """Get the test number for a country."""
        if country == "US":
            return self.config.us_test_number
        elif country == "CA":
            return self.config.ca_test_number
        else:
            raise ValueError(f"Unsupported country: {country}")

    async def send_sms(self, command: str, country: str) -> tuple[str, str]:
        """
        Send an SMS from the test number to Thunderbird.

        Args:
            command: The SMS body to send
            country: "US" or "CA" to determine which test number to use

        Returns:
            Tuple of (message_sid, from_number)
        """
        from_number = self._get_from_number(country)

        logger.info(f"Sending SMS from {from_number} to {self.config.thunderbird_number}: {command}")

        try:
            message = self.client.messages.create(
                body=command,
                from_=from_number,
                to=self.config.thunderbird_number,
            )
            logger.info(f"SMS sent, SID: {message.sid}")
            return message.sid, from_number

        except TwilioRestException as e:
            logger.error(f"Twilio error sending SMS: {e}")
            raise

    async def wait_for_response(
        self,
        from_number: str,
        timeout_seconds: Optional[int] = None
    ) -> Optional[str]:
        """
        Wait for a response to arrive at the test number.

        Args:
            from_number: The test number that should receive the response
            timeout_seconds: Max seconds to wait (default from config)

        Returns:
            Response body text, or None if timeout
        """
        timeout = timeout_seconds or self.config.response_timeout_seconds
        start_time = time.time()

        # Clear any stale response
        clear_response(from_number)

        logger.info(f"Waiting up to {timeout}s for response on {from_number}...")

        while time.time() - start_time < timeout:
            response = get_response(from_number)
            if response:
                logger.info(f"Response received after {time.time() - start_time:.1f}s")
                return response["body"]

            await asyncio.sleep(0.5)  # Poll every 500ms

        logger.warning(f"Timeout waiting for response on {from_number}")
        return None

    def count_segments(self, text: str) -> int:
        """
        Count SMS segments for a message.

        GSM-7 encoding: 160 chars for single, 153 per segment for multi
        Unicode: 70 chars for single, 67 per segment for multi
        """
        if not text:
            return 0

        # Check if GSM-7 compatible (simplified check)
        gsm7_chars = set(
            "@\n\r !\"#$%&'()*+,-./0123456789:;<=>?"
            "ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_"
            "abcdefghijklmnopqrstuvwxyz{|}~"
        )
        is_gsm7 = all(c in gsm7_chars for c in text)

        length = len(text)

        if is_gsm7:
            if length <= 160:
                return 1
            return (length + 152) // 153
        else:
            if length <= 70:
                return 1
            return (length + 66) // 67

    def validate_response(
        self,
        test_case: SMSTestCase,
        response: Optional[str]
    ) -> tuple[bool, list[str], list[str]]:
        """
        Validate a response against test case expectations.

        Args:
            test_case: The test case definition
            response: The response text (or None if timeout)

        Returns:
            Tuple of (passed, errors, warnings)
        """
        errors = []
        warnings = []

        # Must have a response
        if response is None:
            errors.append("No response received (timeout)")
            return False, errors, warnings

        # Check expected content
        if test_case.expected_contains:
            for expected in test_case.expected_contains:
                if expected.lower() not in response.lower():
                    errors.append(f"Expected '{expected}' not found in response")

        # Check unexpected content
        if test_case.expected_not_contains:
            for unexpected in test_case.expected_not_contains:
                if unexpected.lower() in response.lower():
                    errors.append(f"Unexpected '{unexpected}' found in response")

        # Check segment count
        segments = self.count_segments(response)
        max_segments = test_case.max_segments or self.config.max_acceptable_segments

        if segments > max_segments:
            errors.append(f"Response has {segments} segments, max allowed is {max_segments}")
        elif segments > max_segments - 2:
            warnings.append(f"Response has {segments} segments, approaching limit of {max_segments}")

        passed = len(errors) == 0
        return passed, errors, warnings

    async def run_test(self, test_case: SMSTestCase, dry_run: bool = False) -> SMSTestResult:
        """
        Run a single test case.

        Args:
            test_case: The test to run
            dry_run: If True, don't actually send SMS

        Returns:
            SMSTestResult with outcome
        """
        result = SMSTestResult(
            test_case=test_case,
            status=TestStatus.RUNNING,
            started_at=datetime.now(timezone.utc),
        )

        try:
            if dry_run:
                logger.info(f"[DRY RUN] Would send: {test_case.command}")
                result.status = TestStatus.SKIPPED
                result.completed_at = datetime.now(timezone.utc)
                return result

            # Send the SMS
            send_start = time.time()
            message_sid, from_number = await self.send_sms(
                test_case.command,
                test_case.country
            )
            result.message_sid = message_sid

            # Wait for response
            response = await self.wait_for_response(from_number)
            result.response_time_ms = int((time.time() - send_start) * 1000)
            result.response_text = response

            if response:
                result.segment_count = self.count_segments(response)

            # Validate
            passed, errors, warnings = self.validate_response(test_case, response)
            result.errors = errors
            result.warnings = warnings

            if response is None:
                result.status = TestStatus.TIMEOUT
            elif passed:
                result.status = TestStatus.PASSED
            else:
                result.status = TestStatus.FAILED

        except Exception as e:
            logger.exception(f"Error running test {test_case.test_id}")
            result.status = TestStatus.ERROR
            result.errors.append(str(e))

        result.completed_at = datetime.now(timezone.utc)
        return result

    async def run_tests(
        self,
        test_cases: list[SMSTestCase],
        dry_run: bool = False
    ) -> list[SMSTestResult]:
        """
        Run multiple test cases sequentially.

        Args:
            test_cases: List of tests to run
            dry_run: If True, don't actually send SMS

        Returns:
            List of SMSTestResult
        """
        results = []

        for i, test_case in enumerate(test_cases):
            logger.info(f"\n{'='*60}")
            logger.info(f"Running test {i+1}/{len(test_cases)}: {test_case.test_id}")
            logger.info(f"Command: {test_case.command}")
            logger.info(f"{'='*60}")

            result = await self.run_test(test_case, dry_run=dry_run)
            results.append(result)

            # Log result
            status_emoji = {
                TestStatus.PASSED: "PASS",
                TestStatus.FAILED: "FAIL",
                TestStatus.TIMEOUT: "TIME",
                TestStatus.ERROR: "ERR",
                TestStatus.SKIPPED: "SKIP",
            }
            logger.info(f"Result: {status_emoji.get(result.status, '?')} - {result.status.value}")

            if result.errors:
                for error in result.errors:
                    logger.error(f"  Error: {error}")

            if result.warnings:
                for warning in result.warnings:
                    logger.warning(f"  Warning: {warning}")

            # Delay between tests (rate limiting)
            if i < len(test_cases) - 1 and not dry_run:
                await asyncio.sleep(self.config.inter_test_delay_seconds)

        return results


@dataclass
class TestSuiteReport:
    """Summary report for a test suite run."""
    started_at: datetime
    completed_at: datetime
    total_tests: int
    passed: int
    failed: int
    timeout: int
    errors: int
    skipped: int
    results: list[SMSTestResult]

    @property
    def success_rate(self) -> float:
        """Percentage of tests that passed."""
        if self.total_tests == 0:
            return 0.0
        return (self.passed / self.total_tests) * 100

    @property
    def all_passed(self) -> bool:
        """True if all tests passed."""
        return self.passed == self.total_tests

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat(),
            "duration_seconds": (self.completed_at - self.started_at).total_seconds(),
            "total_tests": self.total_tests,
            "passed": self.passed,
            "failed": self.failed,
            "timeout": self.timeout,
            "errors": self.errors,
            "skipped": self.skipped,
            "success_rate": self.success_rate,
            "all_passed": self.all_passed,
            "results": [r.to_dict() for r in self.results],
        }

    def print_summary(self):
        """Print a human-readable summary."""
        print("\n" + "=" * 60)
        print("E2E SMS TEST REPORT")
        print("=" * 60)
        print(f"Duration: {(self.completed_at - self.started_at).total_seconds():.1f}s")
        print(f"Total:    {self.total_tests}")
        print(f"Passed:   {self.passed}")
        print(f"Failed:   {self.failed}")
        print(f"Timeout:  {self.timeout}")
        print(f"Errors:   {self.errors}")
        print(f"Skipped:  {self.skipped}")
        print(f"Success:  {self.success_rate:.1f}%")
        print("=" * 60)

        if not self.all_passed:
            print("\nFailed Tests:")
            for result in self.results:
                if result.status in (TestStatus.FAILED, TestStatus.TIMEOUT, TestStatus.ERROR):
                    print(f"  - {result.test_case.test_id}: {result.status.value}")
                    for error in result.errors:
                        print(f"      {error}")


def generate_report(results: list[SMSTestResult], started_at: datetime) -> TestSuiteReport:
    """Generate a summary report from test results."""
    completed_at = datetime.now(timezone.utc)

    return TestSuiteReport(
        started_at=started_at,
        completed_at=completed_at,
        total_tests=len(results),
        passed=sum(1 for r in results if r.status == TestStatus.PASSED),
        failed=sum(1 for r in results if r.status == TestStatus.FAILED),
        timeout=sum(1 for r in results if r.status == TestStatus.TIMEOUT),
        errors=sum(1 for r in results if r.status == TestStatus.ERROR),
        skipped=sum(1 for r in results if r.status == TestStatus.SKIPPED),
        results=results,
    )
