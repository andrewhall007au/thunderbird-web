"""
Onboarding State Machine - Section 7 of Spec v3.1

v3.0 Update: Simplified to 5-6 steps. Removed start date question.
Pull-based system - users request forecasts when needed.

Flow:
1. START → Ask name (for SafeCheck)
2. Name → Route selection (6 options)
3. Route → Complete + Quick Start Guide
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


# Route configurations - v3.1 spec Section 7.3
# All 6 routes with camps/peaks loaded dynamically from JSON
ROUTES = {
    "overland_track": {
        "name": "Overland Track",
        "short_code": "OL",
    },
    "western_arthurs_ak": {
        "name": "Western Arthurs (A-K)",
        "short_code": "WA",
    },
    "western_arthurs_full": {
        "name": "Western Arthurs (Full)",
        "short_code": "WA",
    },
    "federation_peak": {
        "name": "Federation Peak",
        "short_code": "FP",
    },
    "eastern_arthurs": {
        "name": "Eastern Arthurs",
        "short_code": "EA",
    },
    "combined_arthurs": {
        "name": "Combined W+E Arthurs",
        "short_code": "CA",
    },
}

# Route selection menu order (matches spec Section 7.3)
ROUTE_MENU = [
    ("1", "overland_track", "Overland Track"),
    ("2", "western_arthurs_ak", "Western Arthurs (A-K)"),
    ("3", "western_arthurs_full", "Western Arthurs (Full)"),
    ("4", "federation_peak", "Federation Peak"),
    ("5", "eastern_arthurs", "Eastern Arthurs"),
    ("6", "combined_arthurs", "Combined W+E Arthurs"),
]


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
            "Welcome to Thunderbird weather bot.\n"
            "Thunderbird fetches the weather\n"
            "forecast for you when out on trail.\n\n"
            "3 quick questions to set up.\n\n"
            "What's your trail name?\n"
            "(Identifies you to SafeCheck contacts,\n"
            "set up later in onboarding)"
        )
    
    def _process_name(self, session: OnboardingSession, text: str) -> Tuple[str, bool]:
        """Process Q1: trail name (for SafeCheck notifications)."""
        text = text.strip()

        # Basic validation
        if len(text) < 1:
            return "Please enter a name (e.g. Andrew, Dad, etc.)", False

        if len(text) > 30:
            return "Name too long. Please use 30 characters or less.", False

        session.trail_name = text
        session.state = OnboardingState.AWAITING_TRAIL

        # v3.1: Show all 6 routes
        return (
            f"Hi {text}! Which route?\n"
            "(So we show the correct camps & peaks)\n\n"
            "1 = Overland Track\n"
            "2 = Western Arthurs (A-K)\n"
            "3 = Western Arthurs (Full)\n"
            "4 = Federation Peak\n"
            "5 = Eastern Arthurs\n"
            "6 = Combined W+E Arthurs\n\n"
            "Reply 1-6"
        ), False
    
    def _process_trail_selection(self, session: OnboardingSession, text: str) -> Tuple[str, bool]:
        """Process Q2: trail selection. v3.1: Goes straight to completion."""
        text = text.strip()

        # v3.1: 6 route options matching spec Section 7.3
        route_map = {
            "1": "overland_track",
            "2": "western_arthurs_ak",
            "3": "western_arthurs_full",
            "4": "federation_peak",
            "5": "eastern_arthurs",
            "6": "combined_arthurs",
        }

        if text not in route_map:
            return (
                "Please reply 1-6:\n"
                "1 = Overland Track\n"
                "2 = Western Arthurs (A-K)\n"
                "3 = Western Arthurs (Full)\n"
                "4 = Federation Peak\n"
                "5 = Eastern Arthurs\n"
                "6 = Combined W+E Arthurs"
            ), False

        route_id = route_map[text]
        route = ROUTES[route_id]

        session.route_id = route_id
        session.route_name = route["name"]
        session.direction = "standard"  # v3.1: No direction question

        # v3.1: Skip date/days/direction - go straight to completion
        return self._complete_registration(session)
    
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
        """
        Complete registration - v3.1 pull-based system.
        No start date/days - users request forecasts when needed.
        """
        session.state = OnboardingState.COMPLETE

        route = ROUTES[session.route_id]

        # v3.2: Pull-based confirmation message
        lines = [
            f"{route['name']} [OK]\n",
            "FORECAST COMMANDS",
            "-----------------",
            "CAST12 [CAMP/PEAK]",
            "  12hr hourly e.g. CAST12 LAKEO",
            "CAST24 [CAMP/PEAK]",
            "  24hr hourly e.g. CAST24 WESTP",
            "CAST7 [CAMP/PEAK]",
            "  7-day for location",
            "CAST7 CAMPS = 7-day all camps",
            "CAST7 PEAKS = 7-day all peaks\n",
            "OTHER COMMANDS",
            "-----------------",
            "CHECKIN [CAMP]",
            "  Check in & notify SafeCheck",
            "ROUTE = List camp/peak codes",
            "STATUS = Your trip info",
            "KEY = Forecast legend\n",
            "Sending camps & peaks list..."
        ]

        return "\n".join(lines), True
    
    def _process_confirmation(self, session: OnboardingSession, text: str) -> Tuple[str, bool]:
        """Legacy - no longer used but kept for safety."""
        return self._complete_registration(session)
    
    def get_quick_start_guide(self, session: OnboardingSession) -> List[str]:
        """
        Generate the Quick Start Guide messages for the user's route.
        v3.1: Dynamically loads camps and peaks from JSON route files.
        v3.2: Groups peaks by BOM cell to show primary + nearby count.
        v3.3: Adds forecast KEY as first message.
        Returns list of messages to send.
        """
        from app.services.routes import get_route, get_peak_groups

        messages = []
        route_data = get_route(session.route_id)

        # [1/3] FORECAST KEY - explain the columns first
        key_lines = [
            "FORECAST KEY",
            "======================",
            "Hr  = Hour (24hr)",
            "Tmp = Temperature C",
            "%Rn = Rain probability",
            "Prec = R#-# rain(mm), S#-# snow(cm)",
            "Wa/Wm = Wind avg/max km/h",
            "Wd  = Wind direction",
            "%Cd = Cloud cover",
            "CB  = Cloud base (x100m)",
            "FL  = Freezing lvl (x100m)",
            "D   = Danger (!,!!,!!!)",
            "",
            "CB=8 = clouds at 800m",
            "FL=12 = freezing at 1200m"
        ]
        messages.append("\n".join(key_lines))

        # [2/3] CAMPS LIST
        if route_data:
            camp_lines = ["YOUR CAMPS", "======================"]
            for camp in route_data.camps:
                camp_lines.append(f"{camp.code} = {camp.name}")
            camp_lines.append("")
            camp_lines.append("Use: CAST12 LAKEO or CHECKIN LAKEO")
            messages.append("\n".join(camp_lines))

            # [3/3] PEAKS LIST - Grouped by BOM cell
            if route_data.peaks:
                peak_groups = get_peak_groups(route_data)
                peak_lines = ["YOUR PEAKS", "======================"]
                peak_lines.append(f"({len(peak_groups)} forecast zones)")
                peak_lines.append("")
                for group in peak_groups:
                    # Show: WESTP = West Portal (1181m) +3
                    peak_lines.append(group.display_short())
                peak_lines.append("")
                peak_lines.append("+N = nearby peaks with same forecast")
                peak_lines.append("Use: CAST WESTP for peak forecast")
                messages.append("\n".join(peak_lines))
        else:
            # Fallback if route not found
            messages.append(
                "YOUR CAMPS\n"
                "======================\n"
                "(Route data loading...)\n\n"
                "Text ROUTE to see all codes."
            )

        # [3/3] SafeCheck setup - v3.2
        messages.append(
            "SAFECHECK\n"
            "======================\n"
            "Notify loved ones of your\n"
            "progress on trail.\n\n"
            "To add a contact, type:\n"
            "  SAFE +61400123456 Mum\n\n"
            "(Up to 10 contacts)\n\n"
            "When you CHECKIN, they get:\n"
            "--------------------\n"
            "Andrew checked in at\n"
            "Lake Oberon (863m)\n"
            "14:32 18/01\n"
            "maps.google.com/?q=-43.14,146.27"
        )

        return messages


# Global singleton instance
onboarding_manager = OnboardingManager()

# =============================================================================
# V3.0 ONBOARDING ADDITIONS - Add to end of onboarding.py
# =============================================================================

class OnboardingFlow:
    """
    V3.0 Onboarding flow manager.
    
    6-step flow (no start date question):
    1. Welcome + ask name
    2. Route selection
    3. Commands guide
    4. Camps list
    5. Peaks with elevations
    6. SafeCheck + Alerts (optional)
    """
    
    TOTAL_STEPS = 6
    total_steps = 6  # Alias for tests
    
    def __init__(self, route_id: str = None):
        self.route_id = route_id
        self.current_step = 1
        self.user_name = None
        self.completed = False
    
    def get_step_count(self) -> int:
        """Return total number of onboarding steps."""
        return self.TOTAL_STEPS
    
    def get_current_step(self) -> int:
        """Return current step number."""
        return self.current_step
    
    def get_message(self, step: int = None, route_name: str = None, route_id: str = None, user_name: str = None, **kwargs) -> str:
        """Alias for get_step_message."""
        if route_id:
            self.route_id = route_id
        return self.get_step_message(step)
    
    def get_step_message(self, step: int = None) -> str:
        """Get message for a specific step."""
        if step is None:
            step = self.current_step
        
        if step == 1:
            return self._step1_welcome()
        elif step == 2:
            return self._step2_route_selection()
        elif step == 3:
            return self._step3_commands()
        elif step == 4:
            return self._step4_camps()
        elif step == 5:
            return self._step5_peaks()
        elif step == 6:
            return self._step6_safecheck_alerts()
        else:
            return "Onboarding complete!"
    
    def advance(self) -> str:
        """Advance to next step and return its message."""
        if self.current_step < self.TOTAL_STEPS:
            self.current_step += 1
            return self.get_step_message()
        else:
            self.completed = True
            return "Onboarding complete! Text COMMANDS for help."
    
    def _step1_welcome(self) -> str:
        """Step 1: Welcome and ask for name."""
        return (
            "Welcome to Thunderbird!\n"
            "--------------------\n"
            "Backcountry weather for hikers.\n\n"
            "What's your name? (Used for SafeCheck notifications)"
        )
    
    def _step2_route_selection(self) -> str:
        """Step 2: Route selection."""
        from app.services.routes import RouteLoader
        
        routes = RouteLoader.list_routes()
        route_names = []
        for r in routes[:6]:
            route = RouteLoader.load(r)
            if route:
                route_names.append(route.name)
            else:
                route_names.append(r)
        route_list = "\n".join([f"  {i+1}. {name}" for i, name in enumerate(route_names)])
        
        return (
            f"Which route are you hiking?\n\n"
            f"{route_list}\n\n"
            f"Reply with number or route name."
        )
    
    def _step3_commands(self) -> str:
        """Step 3: Commands guide."""
        return (
            "QUICK COMMANDS\n"
            "--------------------\n"
            "CAST [LOC] = 12hr forecast\n"
            "CAST24 [LOC] = 24hr forecast\n"
            "CAST7 = 7-day all camps\n"
            "CHECKIN [CAMP] = Check in\n"
            "PEAKS = Peak forecasts\n\n"
            "Reply NEXT to continue."
        )
    
    def _step4_camps(self) -> str:
        """Step 4: List camps on route."""
        if not self.route_id:
            return "No route selected. Reply with route number."
        
        from app.services.routes import get_route
        route = get_route(self.route_id)
        
        if not route:
            return "Route not found."
        
        camp_list = "\n".join([f"{c.code} = {c.name}" for c in route.camps])
        
        return (
            f"YOUR ROUTE CAMPS\n"
            f"--------------------\n"
            f"{camp_list}\n\n"
            f"Use: CAST [CODE] for forecast\n"
            f"Use: CHECKIN [CODE] to check in\n\n"
            f"Reply NEXT to continue."
        )
    
    def _step5_peaks(self) -> str:
        """Step 5: List peaks with elevations."""
        if not self.route_id:
            return "No route selected."
        
        return get_peaks_message(self.route_id)
    
    def _step6_safecheck_alerts(self) -> str:
        """Step 6: SafeCheck and Alerts setup."""
        return (
            "OPTIONAL FEATURES\n"
            "--------------------\n"
            "SafeCheck: Notify contacts when you check in\n"
            "  SAFE +61400123456 Kate\n\n"
            "BOM Alerts: Severe weather warnings\n"
            "  ALERTS ON (disabled by default)\n\n"
            "Reply SKIP or set up now.\n"
            "Text COMMANDS anytime for help."
        )


def get_peaks_message(route_id: str) -> str:
    """
    Generate peaks message with full names and elevations.
    
    v3.0: Shows elevation for each peak.
    """
    from app.services.routes import get_route
    
    route = get_route(route_id)
    if not route or not route.peaks:
        return "No peaks on this route."
    
    lines = ["YOUR ROUTE PEAKS", "--------------------"]
    
    for peak in route.peaks:
        lines.append(f"{peak.code} = {peak.name} ({peak.elevation}m)")
    
    lines.append("")
    lines.append("Use: CAST [CODE] for forecast")
    lines.append("Reply NEXT to continue.")
    
    return "\n".join(lines)
