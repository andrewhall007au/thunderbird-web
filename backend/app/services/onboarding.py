"""
Onboarding State Machine - Section 7 of Spec v2.7

Handles the SMS-based registration flow:
1. START → Q1 (trail selection)
2. Q1 response → Q2 (start date)
3. Q2 response → Q3 (days on trail)
4. Q3 response → Q4 (direction)
5. Q4 response → Confirmation
6. Y → Complete registration + Quick Start Guide
"""

from enum import Enum
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Tuple
import re
import logging

logger = logging.getLogger(__name__)


class OnboardingState(Enum):
    """States in the onboarding flow."""
    NONE = "none"
    AWAITING_NAME = "awaiting_name"
    AWAITING_TRAIL = "awaiting_trail"
    AWAITING_DATE = "awaiting_date"
    AWAITING_DAYS = "awaiting_days"
    AWAITING_DIRECTION = "awaiting_direction"
    AWAITING_CONFIRM = "awaiting_confirm"
    COMPLETE = "complete"


@dataclass
class OnboardingSession:
    """Tracks a user's progress through onboarding."""
    phone: str
    state: OnboardingState = OnboardingState.NONE
    trail_name: Optional[str] = None  # Name shown to SafeCheck contacts
    route_id: Optional[str] = None
    route_name: Optional[str] = None
    start_date: Optional[datetime] = None
    num_days: Optional[int] = None
    direction: Optional[str] = None  # "standard" or "reverse"
    itinerary: List[Tuple[int, str, str]] = field(default_factory=list)  # [(day, date_str, camp_code), ...]
    created_at: datetime = field(default_factory=datetime.now)
    
    def is_expired(self, timeout_minutes: int = 30) -> bool:
        """Check if session has expired."""
        return (datetime.now() - self.created_at).total_seconds() > timeout_minutes * 60


# Route configurations - must match config/routes/*.json
ROUTES = {
    "western_arthurs_ak": {
        "name": "Western Arthurs (A-K)",
        "camps_standard": ["SCOTT", "JUNCT", "LAKEF", "LAKEC", "SQUAR", "LAKEO", "HIGHM", "LAKEH"],
        "camps_reverse": ["LAKEH", "HIGHM", "LAKEO", "SQUAR", "LAKEC", "LAKEF", "JUNCT", "SCOTT"],
        "peaks": ["HESPE", "HAYES", "CAPEL", "PROCY", "ORION", "SIRIU", "PEGAS", "CAPRI", "COLUM", "TAURU"],
        "suggested_days": 7,
        "max_days": 12,
        "direction_q": "Q5: Direction?\n1 = Scotts→Haven (standard)\n2 = Haven→Scotts (reverse)",
        "direction_names": {"1": "Scotts to Haven", "2": "Haven to Scotts"},
    },
    "western_arthurs_full": {
        "name": "Western Arthurs (Full)",
        "camps_standard": ["SCOTT", "JUNCT", "LAKEF", "LAKEC", "SQUAR", "LAKEO", "HIGHM", "LAKEH", 
                          "LAKES", "LAKEVE", "LAKEJ", "PROMO", "LAKEVU", "LAKER", "CRACR"],
        "camps_reverse": None,  # Full traverse is one-way only
        "peaks": ["HESPE", "HAYES", "CAPEL", "PROCY", "ORION", "SIRIU", "PEGAS", "CAPRI", "DORAD", 
                  "COLUM", "TAURU", "ALDEB", "SCORP", "CARIN", "SCULP", "PHOEN", "WESTP", "CANOP", "CENTA", "CRAGS"],
        "suggested_days": 12,
        "max_days": 14,
        "direction_q": None,  # No direction choice for full traverse
        "direction_names": {},
    },
    "overland_track": {
        "name": "Overland Track",
        "camps_standard": ["RONNY", "WATER", "WINDM", "PELIO", "KIAOR", "BERTN", "PINEV", "NARCI"],
        "camps_reverse": ["NARCI", "PINEV", "BERTN", "KIAOR", "PELIO", "WINDM", "WATER", "RONNY"],
        "peaks": ["CRADL", "MARIO", "BARNB", "OAKLE", "OSSA", "ACROP", "LABYR"],
        "suggested_days": 6,
        "max_days": 10,
        "direction_q": "Q5: Direction?\n1 = Cradle→St Clair (standard)\n2 = St Clair→Cradle (reverse)",
        "direction_names": {"1": "Cradle to St Clair", "2": "St Clair to Cradle"},
    }
}


class OnboardingManager:
    """
    Manages onboarding sessions for all users.
    In production, this would be backed by a database.
    """
    
    def __init__(self):
        self._sessions: Dict[str, OnboardingSession] = {}
    
    def get_session(self, phone: str) -> Optional[OnboardingSession]:
        """Get existing session for phone, or None if not in onboarding."""
        session = self._sessions.get(phone)
        if session and session.is_expired():
            del self._sessions[phone]
            return None
        return session
    
    def start_session(self, phone: str) -> OnboardingSession:
        """Start a new onboarding session."""
        session = OnboardingSession(
            phone=phone,
            state=OnboardingState.AWAITING_NAME
        )
        self._sessions[phone] = session
        return session
    
    def update_session(self, phone: str, **kwargs) -> Optional[OnboardingSession]:
        """Update session with new data."""
        session = self.get_session(phone)
        if session:
            for key, value in kwargs.items():
                setattr(session, key, value)
        return session
    
    def complete_session(self, phone: str) -> Optional[OnboardingSession]:
        """Mark session as complete and return it."""
        session = self.get_session(phone)
        if session:
            session.state = OnboardingState.COMPLETE
        return session
    
    def clear_session(self, phone: str):
        """Remove session (after completion or cancellation)."""
        if phone in self._sessions:
            del self._sessions[phone]
    
    def process_input(self, phone: str, text: str) -> Tuple[str, bool]:
        """
        Process user input during onboarding.
        
        Returns:
            (response_message, is_complete)
        """
        text_upper = text.strip().upper()
        session = self.get_session(phone)
        
        # START/REGISTER always (re)starts onboarding
        if text_upper in ["START", "REGISTER"]:
            self.start_session(phone)  # This overwrites any existing session
            return self._get_welcome_message(), False
        
        if not session:
            # Not in onboarding and not a START command
            return None, False  # Not an onboarding message
        
        # Process based on current state
        text = text.strip()
        
        if session.state == OnboardingState.AWAITING_NAME:
            return self._process_name(session, text)
        elif session.state == OnboardingState.AWAITING_TRAIL:
            return self._process_trail_selection(session, text)
        
        elif session.state == OnboardingState.AWAITING_DATE:
            return self._process_date_input(session, text)
        
        elif session.state == OnboardingState.AWAITING_DAYS:
            return self._process_days_input(session, text)
        
        elif session.state == OnboardingState.AWAITING_DIRECTION:
            return self._process_direction_input(session, text)
        
        elif session.state == OnboardingState.AWAITING_CONFIRM:
            return self._process_confirmation(session, text)
        
        return "Something went wrong. Text START to begin again.", False
    
    def _get_welcome_message(self) -> str:
        """Return the initial welcome message with Q1 (name)."""
        return (
            "Welcome to Thunderbird!\n"
            "5 quick questions to set up.\n\n"
            "Q1: Your trail name?\n"
            "(This identifies you to your SafeCheck contacts)"
        )
    
    def _process_name(self, session: OnboardingSession, text: str) -> Tuple[str, bool]:
        """Process Q1: trail name."""
        text = text.strip()
        
        # Basic validation
        if len(text) < 1:
            return "Please enter a name (e.g. Andrew, Dad, etc.)", False
        
        if len(text) > 30:
            return "Name too long. Please use 30 characters or less.", False
        
        session.trail_name = text
        session.state = OnboardingState.AWAITING_TRAIL
        
        return (
            f"Got it: {text}\n\n"
            "Q2: Which trail?\n"
            "1 = Western Arthurs (A-K)\n"
            "2 = Western Arthurs (Full)\n"
            "3 = Overland Track"
        ), False
    
    def _process_trail_selection(self, session: OnboardingSession, text: str) -> Tuple[str, bool]:
        """Process Q2: trail selection."""
        text = text.strip()
        
        route_map = {
            "1": "western_arthurs_ak",
            "2": "western_arthurs_full", 
            "3": "overland_track",
        }
        
        if text not in route_map:
            return (
                "Please reply 1, 2, or 3:\n"
                "1 = Western Arthurs (A-K)\n"
                "2 = Western Arthurs (Full)\n"
                "3 = Overland Track"
            ), False
        
        route_id = route_map[text]
        route = ROUTES[route_id]
        
        session.route_id = route_id
        session.route_name = route["name"]
        session.state = OnboardingState.AWAITING_DATE
        
        return (
            f"Got it: {route['name']}\n\n"
            "Q3: Start date? (DDMMYY)\n"
            "e.g. 190126 = 19 Jan 2026"
        ), False
    
    def _process_date_input(self, session: OnboardingSession, text: str) -> Tuple[str, bool]:
        """Process Q3: start date."""
        text = text.strip().replace("/", "").replace("-", "").replace(" ", "")
        
        # Parse DDMMYY format
        if len(text) != 6 or not text.isdigit():
            return (
                "Please enter date as DDMMYY\n"
                "e.g. 190126 = 19 Jan 2026"
            ), False
        
        try:
            day = int(text[0:2])
            month = int(text[2:4])
            year = int("20" + text[4:6])
            
            start_date = datetime(year, month, day)
            
            # Validate date is in future
            if start_date.date() < datetime.now().date():
                return "Start date must be in the future.", False
            
            # Validate date is within reasonable range (next 365 days)
            if start_date > datetime.now() + timedelta(days=365):
                return "Start date must be within the next year.", False
            
        except ValueError:
            return (
                "Invalid date. Please enter as DDMMYY\n"
                "e.g. 190126 = 19 Jan 2026"
            ), False
        
        session.start_date = start_date
        session.state = OnboardingState.AWAITING_DAYS
        
        route = ROUTES[session.route_id]
        date_str = start_date.strftime("%d %b %Y")
        
        return (
            f"Got it: {date_str}\n\n"
            f"Q4: Days on trail? (1-{route['max_days']})\n"
            f"Suggested: {route['suggested_days']} days"
        ), False
    
    def _process_days_input(self, session: OnboardingSession, text: str) -> Tuple[str, bool]:
        """Process Q4: number of days."""
        text = text.strip()
        
        route = ROUTES[session.route_id]
        
        try:
            num_days = int(text)
            if num_days < 1 or num_days > route['max_days']:
                return f"Please enter a number between 1 and {route['max_days']}.", False
        except ValueError:
            return f"Please enter a number (1-{route['max_days']}).", False
        
        session.num_days = num_days
        
        # Check if route has direction choice
        if route.get("direction_q"):
            session.state = OnboardingState.AWAITING_DIRECTION
            return (
                f"Got it: {num_days} days\n\n"
                f"{route['direction_q']}"
            ), False
        else:
            # No direction choice (e.g., full traverse) - go straight to completion
            session.direction = "standard"
            return self._complete_registration(session)
    
    def _process_direction_input(self, session: OnboardingSession, text: str) -> Tuple[str, bool]:
        """Process Q5: direction selection."""
        text = text.strip()
        
        route = ROUTES[session.route_id]
        
        if text not in ["1", "2"]:
            return (
                "Please reply 1 or 2:\n"
                f"{route['direction_q']}"
            ), False
        
        session.direction = "standard" if text == "1" else "reverse"
        direction_name = route["direction_names"].get(text, "")
        
        # Go straight to completion - no confirmation needed
        return self._complete_registration(session, direction_name)
    
    def _complete_registration(self, session: OnboardingSession, direction_name: str = "") -> Tuple[str, bool]:
        """Complete registration without confirmation step."""
        session.state = OnboardingState.COMPLETE
        
        route = ROUTES[session.route_id]
        camps = route["camps_standard"] if session.direction == "standard" else route.get("camps_reverse", route["camps_standard"])
        
        # Generate itinerary (for internal tracking)
        itinerary = []
        for day in range(1, session.num_days + 1):
            date = session.start_date + timedelta(days=day - 1)
            date_str = date.strftime("%d%b")
            if day <= len(camps):
                camp = camps[min(day - 1, len(camps) - 1)]
            else:
                camp = "Exit"
            itinerary.append((day, date_str, camp))
        session.itinerary = itinerary
        
        # Calculate first forecast date (6pm day before start)
        first_forecast = session.start_date - timedelta(days=1)
        first_forecast_str = first_forecast.strftime("%d %b")
        
        # Build response
        lines = []
        if direction_name:
            lines.append(f"Got it: {direction_name}\n")
        
        lines.append("All set! ✓\n")
        lines.append(f"Route: {route['name']}")
        lines.append(f"Start: {session.start_date.strftime('%d %b %Y')}")
        lines.append(f"Days: {session.num_days}")
        lines.append(f"\nFirst forecast: 6pm {first_forecast_str}")
        lines.append("(day before start)\n")
        lines.append("Sending Quick Start Guide...")
        
        return "\n".join(lines), True
    
    def _process_confirmation(self, session: OnboardingSession, text: str) -> Tuple[str, bool]:
        """Legacy - no longer used but kept for safety."""
        return self._complete_registration(session)
    
    def get_quick_start_guide(self, session: OnboardingSession) -> List[str]:
        """
        Generate the Quick Start Guide messages for the user's route.
        Returns list of messages to send.
        """
        route = ROUTES.get(session.route_id, ROUTES["western_arthurs_ak"])
        camps = route["camps_standard"] if session.direction == "standard" else route.get("camps_reverse", route["camps_standard"])
        peaks = route.get("peaks", [])
        
        messages = []
        
        # [1/6] CHECK-IN - How to check in and alert loved ones (FIRST!)
        messages.append(
            "[1/6] CHECK-IN\n"
            "────────────────────\n"
            "Text your camp code when you\n"
            "arrive (e.g. LAKEO or NPELI)\n\n"
            "Your SafeCheck contacts will\n"
            "be notified of your position.\n\n"
            "Check in anytime to update\n"
            "your location on the trail."
        )
        
        # [2/6] WAYPOINTS - All camps and peaks together
        camp_rows = []
        for i in range(0, len(camps), 4):
            camp_rows.append(" ".join(camps[i:i+4]))
        
        peak_section = ""
        if peaks:
            peak_rows = []
            for i in range(0, len(peaks), 5):
                peak_rows.append(" ".join(peaks[i:i+5]))
            peak_section = "\n\nPeaks:\n" + "\n".join(peak_rows)
        
        messages.append(
            "[2/6] WAYPOINTS\n"
            "────────────────────\n"
            "Camps:\n"
            + "\n".join(camp_rows)
            + peak_section
        )
        
        # [3/6] DAILY ROUTINE
        messages.append(
            "[3/6] DAILY ROUTINE\n"
            "────────────────────\n"
            "6:00am  Morning forecast\n"
            "        (hourly for today)\n\n"
            "5:30pm  Check-in prompt\n"
            "        → Reply with camp code\n\n"
            "6:00pm  Evening forecast\n"
            "        (tomorrow + 7-day outlook)"
        )
        
        # [4/6] COMMANDS
        messages.append(
            "[4/6] COMMANDS\n"
            "────────────────────\n"
            "CAST LAKEO = On-demand forecast\n"
            "(12hr hourly for any camp/peak)\n\n"
            "DELAY  = Weather delay +1 day\n"
            "EXTEND = Add days to trip\n"
            "STATUS = Your trip details\n"
            "KEY    = Forecast legend\n"
            "HELP   = Show this guide\n"
            "STOP   = End service"
        )
        
        # [5/6] FORECAST KEY
        messages.append(
            "[5/6] FORECAST KEY\n"
            "────────────────────\n"
            "Hr  = Hour (06, 09, 12...)\n"
            "Tmp = Temperature °C\n"
            "%Rn = Rain chance\n"
            "Rn  = Rain mm | Sn = Snow cm\n"
            "Wa  = Wind avg | Wm = Gusts\n"
            "%Cd = Cloud % | CB = Cloud base\n"
            "FL  = Freezing level (x100m)\n"
            "D   = Danger (!,!!,!!!)\n\n"
            "CB=14 → cloud at 1400m\n"
            "FL=18 → freezing at 1800m"
        )
        
        # [6/6] IMPORTANT RULES
        messages.append(
            "[6/6] IMPORTANT RULES\n"
            "────────────────────\n"
            "• Forecasts only for camps AHEAD\n"
            "  (already passed = no forecast)\n\n"
            "• Peak forecasts show summit\n"
            "  conditions, not camp level\n\n"
            "• Wind from WEST is normal\n"
            "  (Roaring Forties)\n\n"
            "• Text START to re-register\n"
            "  if you need to change dates\n\n"
            "Ready for your adventure! 🏔️"
        )
        
        return messages


# Global singleton instance
onboarding_manager = OnboardingManager()
