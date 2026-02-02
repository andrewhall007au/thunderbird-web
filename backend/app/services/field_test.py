"""
Field Test Automation Service

Allows field testers to trigger automated test sequences with a single SMS.
Results are logged for remote monitoring via dashboard.

Usage: Field tester sends "FIELDTEST" from satellite location
System automatically runs test sequence and reports results.
"""

import asyncio
import json
import re
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field, asdict
from zoneinfo import ZoneInfo
import uuid

TZ_UTC = ZoneInfo("UTC")


class TestStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"
    TIMEOUT = "timeout"


@dataclass
class TestCase:
    """Individual test case in a field test sequence."""
    id: str
    name: str
    command: str
    expected_patterns: List[str]  # Regex patterns that must match response
    timeout_seconds: int = 300  # 5 min default for satellite
    status: TestStatus = TestStatus.PENDING
    sent_at: Optional[datetime] = None
    received_at: Optional[datetime] = None
    response: Optional[str] = None
    latency_seconds: Optional[float] = None
    error: Optional[str] = None


@dataclass
class FieldTestSession:
    """Complete field test session for a tester."""
    id: str
    phone: str
    started_at: datetime
    location_lat: Optional[float] = None
    location_lon: Optional[float] = None
    country: Optional[str] = None
    device_info: Optional[str] = None
    connection_type: str = "unknown"  # satellite, cellular, unknown
    tests: List[TestCase] = field(default_factory=list)
    current_test_index: int = 0
    completed_at: Optional[datetime] = None
    summary: Optional[Dict[str, Any]] = None

    @property
    def is_complete(self) -> bool:
        return self.current_test_index >= len(self.tests)

    @property
    def passed_count(self) -> int:
        return sum(1 for t in self.tests if t.status == TestStatus.PASSED)

    @property
    def failed_count(self) -> int:
        return sum(1 for t in self.tests if t.status in [TestStatus.FAILED, TestStatus.TIMEOUT])

    @property
    def avg_latency(self) -> Optional[float]:
        latencies = [t.latency_seconds for t in self.tests if t.latency_seconds is not None]
        return sum(latencies) / len(latencies) if latencies else None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to JSON-serializable dict."""
        return {
            "id": self.id,
            "phone": self.phone[-4:].rjust(len(self.phone), '*'),  # Masked
            "started_at": self.started_at.isoformat(),
            "location": {
                "lat": self.location_lat,
                "lon": self.location_lon,
                "country": self.country
            } if self.location_lat else None,
            "connection_type": self.connection_type,
            "device_info": self.device_info,
            "tests": [
                {
                    "id": t.id,
                    "name": t.name,
                    "command": t.command,
                    "status": t.status.value,
                    "latency_seconds": t.latency_seconds,
                    "error": t.error
                }
                for t in self.tests
            ],
            "current_test_index": self.current_test_index,
            "is_complete": self.is_complete,
            "passed": self.passed_count,
            "failed": self.failed_count,
            "total": len(self.tests),
            "avg_latency_seconds": self.avg_latency,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None
        }


# =============================================================================
# Test Case Definitions
# =============================================================================

def create_standard_test_sequence(phone_country: str = "US") -> List[TestCase]:
    """
    Create standard field test sequence based on country.
    Tests are ordered from simple to complex.
    """
    tests = []

    # Test 1: Basic connectivity - HELP command
    tests.append(TestCase(
        id="help",
        name="Basic Connectivity",
        command="HELP",
        expected_patterns=[
            r"(?i)cast",  # Should mention CAST command
            r"(?i)(help|command)",  # Should mention help/commands
        ],
        timeout_seconds=300
    ))

    # Test 2: Status check
    tests.append(TestCase(
        id="status",
        name="Account Status",
        command="STATUS",
        expected_patterns=[
            r"(?i)(status|account|balance)",
        ],
        timeout_seconds=300
    ))

    # Test 3: Forecast key/legend
    tests.append(TestCase(
        id="key",
        name="Forecast Legend",
        command="KEY",
        expected_patterns=[
            r"(?i)(key|legend|tmp|wind)",
        ],
        timeout_seconds=300
    ))

    # Test 4: GPS-based CAST (uses coordinates from FIELDTEST location)
    # Placeholder - actual coords inserted when test starts
    tests.append(TestCase(
        id="cast_gps",
        name="GPS Forecast",
        command="CAST {LAT},{LON}",  # Placeholder, replaced at runtime
        expected_patterns=[
            r"\d{2}\|",  # Hour column like "06|" or "12|"
            r"(?i)(hr|tmp|rn|wind)",  # Header elements
        ],
        timeout_seconds=300
    ))

    # Test 5: Extended forecast
    tests.append(TestCase(
        id="cast24_gps",
        name="24-Hour Forecast",
        command="CAST24 {LAT},{LON}",
        expected_patterns=[
            r"\d{2}\|",
        ],
        timeout_seconds=420  # 7 min - multi-SMS
    ))

    # Test 6: 7-day forecast
    tests.append(TestCase(
        id="cast7_gps",
        name="7-Day Forecast",
        command="CAST7 {LAT},{LON}",
        expected_patterns=[
            r"(?i)(mon|tue|wed|thu|fri|sat|sun)",  # Day names
        ],
        timeout_seconds=600  # 10 min - multi-SMS
    ))

    # Test 7: Route listing (if registered)
    tests.append(TestCase(
        id="route",
        name="Route Listing",
        command="ROUTE",
        expected_patterns=[
            r"(?i)(route|camp|peak|trail)",
        ],
        timeout_seconds=300
    ))

    # Test 8: Final connectivity check
    tests.append(TestCase(
        id="help_final",
        name="Final Connectivity",
        command="HELP",
        expected_patterns=[
            r"(?i)cast",
        ],
        timeout_seconds=300
    ))

    return tests


# =============================================================================
# In-Memory Session Store (replace with database for production)
# =============================================================================

_sessions: Dict[str, FieldTestSession] = {}
_sessions_by_phone: Dict[str, str] = {}  # phone -> session_id


def create_session(phone: str, lat: Optional[float] = None,
                   lon: Optional[float] = None) -> FieldTestSession:
    """Create a new field test session."""
    session_id = str(uuid.uuid4())[:8]

    # Detect country from coordinates
    country = None
    if lat and lon:
        country = _detect_country(lat, lon)

    session = FieldTestSession(
        id=session_id,
        phone=phone,
        started_at=datetime.now(TZ_UTC),
        location_lat=lat,
        location_lon=lon,
        country=country,
        tests=create_standard_test_sequence(country or "US")
    )

    # Replace coordinate placeholders in test commands
    if lat and lon:
        for test in session.tests:
            test.command = test.command.replace("{LAT}", f"{lat:.4f}")
            test.command = test.command.replace("{LON}", f"{lon:.4f}")

    _sessions[session_id] = session
    _sessions_by_phone[phone] = session_id

    return session


def get_session(session_id: str) -> Optional[FieldTestSession]:
    """Get session by ID."""
    return _sessions.get(session_id)


def get_session_by_phone(phone: str) -> Optional[FieldTestSession]:
    """Get active session for phone number."""
    session_id = _sessions_by_phone.get(phone)
    if session_id:
        session = _sessions.get(session_id)
        # Only return if not complete or completed recently (within 1 hour)
        if session and (not session.is_complete or
            (session.completed_at and
             datetime.now(TZ_UTC) - session.completed_at < timedelta(hours=1))):
            return session
    return None


def get_all_sessions(limit: int = 50) -> List[FieldTestSession]:
    """Get recent sessions for dashboard."""
    sessions = sorted(
        _sessions.values(),
        key=lambda s: s.started_at,
        reverse=True
    )
    return sessions[:limit]


def _detect_country(lat: float, lon: float) -> str:
    """Simple country detection from coordinates."""
    # US (continental)
    if 24 < lat < 50 and -125 < lon < -66:
        return "US"
    # Canada
    if 41 < lat < 84 and -141 < lon < -52:
        return "CA"
    # Australia
    if -44 < lat < -10 and 112 < lon < 154:
        return "AU"
    # UK
    if 49 < lat < 61 and -8 < lon < 2:
        return "UK"
    # New Zealand
    if -47 < lat < -34 and 166 < lon < 179:
        return "NZ"
    return "UNKNOWN"


# =============================================================================
# Test Orchestration
# =============================================================================

class FieldTestOrchestrator:
    """
    Orchestrates field test sequences.

    Flow:
    1. User sends FIELDTEST [lat,lon]
    2. System creates session and sends first test command
    3. User's response triggers next test
    4. Repeat until all tests complete
    5. Send summary to user
    """

    def __init__(self, sms_service=None):
        self.sms_service = sms_service

    def start_test(self, phone: str, lat: Optional[float] = None,
                   lon: Optional[float] = None) -> str:
        """
        Start a field test session.
        Returns the first instruction message to send to user.
        """
        # Check for existing active session
        existing = get_session_by_phone(phone)
        if existing and not existing.is_complete:
            return (
                f"Field test already in progress (ID: {existing.id}). "
                f"Test {existing.current_test_index + 1}/{len(existing.tests)} running. "
                "Send FIELDTEST CANCEL to stop."
            )

        # Create new session
        session = create_session(phone, lat, lon)

        # Build intro message
        location_str = ""
        if lat and lon:
            location_str = f" at {lat:.4f},{lon:.4f}"
            if session.country:
                location_str += f" ({session.country})"

        intro = (
            f"FIELD TEST STARTED{location_str}\n"
            f"Session: {session.id}\n"
            f"Running {len(session.tests)} tests...\n\n"
            f"Test 1/{len(session.tests)}: {session.tests[0].name}\n"
            f"Sending: {session.tests[0].command}"
        )

        # Mark first test as running
        session.tests[0].status = TestStatus.RUNNING
        session.tests[0].sent_at = datetime.now(TZ_UTC)

        return intro

    def get_current_test_command(self, phone: str) -> Optional[str]:
        """Get the command for the current test (to be sent by webhook)."""
        session = get_session_by_phone(phone)
        if not session or session.is_complete:
            return None

        current_test = session.tests[session.current_test_index]
        return current_test.command

    def process_response(self, phone: str, response: str) -> Optional[str]:
        """
        Process a response from the field tester.
        Returns the next message to send (or summary if complete).
        """
        session = get_session_by_phone(phone)
        if not session:
            return None

        if session.is_complete:
            return None

        current_test = session.tests[session.current_test_index]

        # Record response
        current_test.received_at = datetime.now(TZ_UTC)
        current_test.response = response

        if current_test.sent_at:
            current_test.latency_seconds = (
                current_test.received_at - current_test.sent_at
            ).total_seconds()

        # Validate response
        all_patterns_match = all(
            re.search(pattern, response)
            for pattern in current_test.expected_patterns
        )

        if all_patterns_match:
            current_test.status = TestStatus.PASSED
        else:
            current_test.status = TestStatus.FAILED
            current_test.error = "Response did not match expected patterns"

        # Move to next test
        session.current_test_index += 1

        # Check if complete
        if session.is_complete:
            session.completed_at = datetime.now(TZ_UTC)
            return self._generate_summary(session)

        # Start next test
        next_test = session.tests[session.current_test_index]
        next_test.status = TestStatus.RUNNING
        next_test.sent_at = datetime.now(TZ_UTC)

        status_emoji = "✓" if current_test.status == TestStatus.PASSED else "✗"
        latency_str = f"{current_test.latency_seconds:.1f}s" if current_test.latency_seconds else "?"

        return (
            f"{status_emoji} Test {session.current_test_index}/{len(session.tests)} "
            f"({current_test.name}): {current_test.status.value} [{latency_str}]\n\n"
            f"Test {session.current_test_index + 1}/{len(session.tests)}: {next_test.name}\n"
            f"Sending: {next_test.command}"
        )

    def _generate_summary(self, session: FieldTestSession) -> str:
        """Generate final test summary."""
        passed = session.passed_count
        total = len(session.tests)
        avg_latency = session.avg_latency

        # Build result lines
        results = []
        for t in session.tests:
            status = "✓" if t.status == TestStatus.PASSED else "✗"
            latency = f"{t.latency_seconds:.1f}s" if t.latency_seconds else "?"
            results.append(f"{status} {t.name}: {latency}")

        result_str = "\n".join(results)

        overall = "PASSED" if passed == total else "FAILED"
        latency_str = f"{avg_latency:.1f}s" if avg_latency else "N/A"

        return (
            f"FIELD TEST COMPLETE\n"
            f"Session: {session.id}\n"
            f"Result: {passed}/{total} {overall}\n"
            f"Avg Latency: {latency_str}\n\n"
            f"{result_str}\n\n"
            f"Results logged for monitoring."
        )

    def cancel_test(self, phone: str) -> str:
        """Cancel an active test session."""
        session = get_session_by_phone(phone)
        if not session:
            return "No active field test to cancel."

        session.completed_at = datetime.now(TZ_UTC)
        session.current_test_index = len(session.tests)  # Mark complete

        return f"Field test {session.id} cancelled."

    def check_timeouts(self):
        """Check for timed-out tests (call periodically)."""
        now = datetime.now(TZ_UTC)

        for session in _sessions.values():
            if session.is_complete:
                continue

            current_test = session.tests[session.current_test_index]
            if current_test.status != TestStatus.RUNNING:
                continue

            if current_test.sent_at:
                elapsed = (now - current_test.sent_at).total_seconds()
                if elapsed > current_test.timeout_seconds:
                    current_test.status = TestStatus.TIMEOUT
                    current_test.error = f"No response after {current_test.timeout_seconds}s"
                    session.current_test_index += 1


# =============================================================================
# Command Parser Extension
# =============================================================================

def parse_fieldtest_command(text: str) -> Dict[str, Any]:
    """
    Parse FIELDTEST command with optional coordinates.

    Formats:
    - FIELDTEST
    - FIELDTEST 37.7,-122.4
    - FIELDTEST CANCEL
    """
    text = text.strip().upper()

    if not text.startswith("FIELDTEST"):
        return {"valid": False}

    parts = text.split(None, 1)

    if len(parts) == 1:
        return {"valid": True, "action": "start", "lat": None, "lon": None}

    arg = parts[1].strip()

    if arg == "CANCEL":
        return {"valid": True, "action": "cancel"}

    if arg == "STATUS":
        return {"valid": True, "action": "status"}

    # Try to parse coordinates
    coord_match = re.match(r"(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)", arg)
    if coord_match:
        lat = float(coord_match.group(1))
        lon = float(coord_match.group(2))
        return {"valid": True, "action": "start", "lat": lat, "lon": lon}

    return {"valid": False, "error": "Invalid format. Use: FIELDTEST [lat,lon] or FIELDTEST CANCEL"}


# Singleton orchestrator
_orchestrator: Optional[FieldTestOrchestrator] = None

def get_orchestrator() -> FieldTestOrchestrator:
    """Get or create the orchestrator singleton."""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = FieldTestOrchestrator()
    return _orchestrator
