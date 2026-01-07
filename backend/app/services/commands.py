"""
SMS Command Parser
Based on THUNDERBIRD_SPEC_v2.4 Sections 7, 8.7, 8.7.1
"""

from datetime import datetime, date
from typing import Optional, Tuple, Dict, Any, List
from dataclasses import dataclass
from enum import Enum
import re

from config.settings import TZ_HOBART


class CommandType(str, Enum):
    """Known command types."""
    START = "START"
    STOP = "STOP"
    HELP = "HELP"
    STATUS = "STATUS"
    DELAY = "DELAY"
    EXTEND = "EXTEND"
    RESEND = "RESEND"
    EDIT = "EDIT"
    KEY = "KEY"
    ALERTS = "ALERTS"
    CAST = "CAST"
    SAFE = "SAFE"           # Add SafeCheck contact
    SAFEDEL = "SAFEDEL"     # Remove SafeCheck contact
    SAFELIST = "SAFELIST"   # List SafeCheck contacts
    YES = "Y"
    NO = "N"
    CAMP_CODE = "CAMP"
    AMBIGUOUS_CAMP = "AMBIGUOUS_CAMP"
    LIVETEST = "LIVETEST"
    NEXT = "NEXT"
    KILL = "KILL"
    UNKNOWN = "UNKNOWN"


@dataclass
class ParsedCommand:
    """Result of parsing an SMS command."""
    command_type: CommandType
    raw_input: str
    args: Dict[str, Any]
    is_valid: bool
    error_message: Optional[str] = None


class CommandParser:
    """
    Parse incoming SMS messages into commands.
    """
    
    # Camp codes are loaded dynamically from route JSON files
    # This ensures alignment with the spec
    
    @classmethod
    def get_camp_codes_for_route(cls, route_id: str) -> List[str]:
        """Load camp codes from route JSON file."""
        from app.services.routes import get_route
        route = get_route(route_id)
        if route:
            return route.get_camp_codes()
        return []
    
    @classmethod
    def get_all_camp_codes(cls) -> List[str]:
        """Get all camp codes from all routes."""
        from app.services.routes import RouteLoader
        all_camps = set()
        for route_id in RouteLoader.list_routes():
            all_camps.update(cls.get_camp_codes_for_route(route_id))
        return list(all_camps)
    
    def find_camps_by_prefix(self, prefix: str) -> List[str]:
        """Find all camp codes that start with the given prefix."""
        prefix_upper = prefix.upper()
        return [camp for camp in self.valid_camps if camp.startswith(prefix_upper)]
    
    def get_camp_name(self, camp_code: str) -> str:
        """Get the display name for a camp code."""
        from app.services.routes import RouteLoader
        for route_id in RouteLoader.list_routes():
            from app.services.routes import get_route
            route = get_route(route_id)
            if route:
                for camp in route.camps:
                    if camp.code == camp_code:
                        return camp.name
        return camp_code  # Fallback to code if name not found
    
    # Simple command mapping (no args)
    SIMPLE_COMMANDS = {
        "START": CommandType.START,
        "REGISTER": CommandType.START,
        "STOP": CommandType.STOP,
        "CANCEL": CommandType.STOP,
        "HELP": CommandType.HELP,
        "STATUS": CommandType.STATUS,
        "DELAY": CommandType.DELAY,
        "EXTEND": CommandType.EXTEND,
        "RESEND": CommandType.RESEND,
        "EDIT": CommandType.EDIT,
        "KEY": CommandType.KEY,
        "LEGEND": CommandType.KEY,
        "ALERTS": CommandType.ALERTS,
        "WARNINGS": CommandType.ALERTS,
        "Y": CommandType.YES,
        "YES": CommandType.YES,
        "N": CommandType.NO,
        "NO": CommandType.NO,
    }
    
    # LIVETEST commands (with @ prefix)
    LIVETEST_COMMANDS = {
        "@ LIVETEST": CommandType.LIVETEST,
        "@LIVETEST": CommandType.LIVETEST,
        "@ NEXT": CommandType.NEXT,
        "@NEXT": CommandType.NEXT,
        "@ KILL": CommandType.KILL,
        "@KILL": CommandType.KILL,
    }
    
    def __init__(self, route_id: Optional[str] = None):
        self.route_id = route_id
        self.valid_camps = self._get_valid_camps()
    
    def _get_valid_camps(self) -> List[str]:
        """Get valid camp codes for current route."""
        if self.route_id:
            return self.get_camp_codes_for_route(self.route_id)
        # Return all camp codes if no route specified
        return self.get_all_camp_codes()
    
    def sanitize(self, message: str) -> str:
        """
        Sanitize incoming SMS message.
        Section 12.9.3
        """
        # Strip whitespace
        cleaned = message.strip()
        # Don't uppercase yet - preserve for @ detection
        # Remove most special chars but keep @ for LIVETEST
        cleaned = re.sub(r'[^A-Za-z0-9@ ]', '', cleaned)
        return cleaned
    
    def parse(self, message: str) -> ParsedCommand:
        """
        Parse an SMS message into a command.
        
        Args:
            message: Raw SMS message text
        
        Returns:
            ParsedCommand with type and any arguments
        """
        sanitized = self.sanitize(message)
        upper = sanitized.upper()
        
        # Check for LIVETEST commands first (preserve @ prefix)
        for pattern, cmd_type in self.LIVETEST_COMMANDS.items():
            if upper.startswith(pattern.upper()):
                return ParsedCommand(
                    command_type=cmd_type,
                    raw_input=message,
                    args={},
                    is_valid=True
                )
        
        # Now work with uppercase
        parts = upper.split()
        if not parts:
            return ParsedCommand(
                command_type=CommandType.UNKNOWN,
                raw_input=message,
                args={},
                is_valid=False,
                error_message="Empty message"
            )
        
        first_word = parts[0]
        
        # Check simple commands
        if first_word in self.SIMPLE_COMMANDS:
            return ParsedCommand(
                command_type=self.SIMPLE_COMMANDS[first_word],
                raw_input=message,
                args={},
                is_valid=True
            )
        
        # Check for CAST command (CAST LAKEO)
        if first_word == "CAST":
            if len(parts) >= 2:
                camp_code = parts[1]
                if camp_code in self.valid_camps:
                    return ParsedCommand(
                        command_type=CommandType.CAST,
                        raw_input=message,
                        args={"camp_code": camp_code},
                        is_valid=True
                    )
                else:
                    return ParsedCommand(
                        command_type=CommandType.CAST,
                        raw_input=message,
                        args={},
                        is_valid=False,
                        error_message=f"CAST requires a valid camp code.\n\nYour route camps:\n{' '.join(self.valid_camps)}\n\nExample: CAST LAKEO"
                    )
            else:
                return ParsedCommand(
                    command_type=CommandType.CAST,
                    raw_input=message,
                    args={},
                    is_valid=False,
                    error_message=f"CAST requires a camp code.\n\nYour route camps:\n{' '.join(self.valid_camps)}\n\nExample: CAST LAKEO"
                )
        
        # Check for SAFE command (SAFE +61400123456 Kate)
        if first_word == "SAFE":
            if len(parts) >= 3:
                contact_phone = parts[1]
                contact_name = ' '.join(parts[2:])  # Name can have spaces
                return ParsedCommand(
                    command_type=CommandType.SAFE,
                    raw_input=message,
                    args={"contact_phone": contact_phone, "contact_name": contact_name},
                    is_valid=True
                )
            elif len(parts) == 2:
                # Just phone, no name
                contact_phone = parts[1]
                return ParsedCommand(
                    command_type=CommandType.SAFE,
                    raw_input=message,
                    args={"contact_phone": contact_phone, "contact_name": "Contact"},
                    is_valid=True
                )
            else:
                return ParsedCommand(
                    command_type=CommandType.SAFE,
                    raw_input=message,
                    args={},
                    is_valid=False,
                    error_message="SAFE requires a phone number.\n\nExample: SAFE +61400123456 Kate"
                )
        
        # Check for SAFEDEL command (SAFEDEL +61400123456)
        if first_word == "SAFEDEL":
            if len(parts) >= 2:
                contact_phone = parts[1]
                return ParsedCommand(
                    command_type=CommandType.SAFEDEL,
                    raw_input=message,
                    args={"contact_phone": contact_phone},
                    is_valid=True
                )
            else:
                return ParsedCommand(
                    command_type=CommandType.SAFEDEL,
                    raw_input=message,
                    args={},
                    is_valid=False,
                    error_message="SAFEDEL requires a phone number.\n\nExample: SAFEDEL +61400123456"
                )
        
        # Check for SAFELIST command
        if first_word == "SAFELIST":
            return ParsedCommand(
                command_type=CommandType.SAFELIST,
                raw_input=message,
                args={},
                is_valid=True
            )
        
        # Check if it's an exact camp code match
        if first_word in self.valid_camps:
            return ParsedCommand(
                command_type=CommandType.CAMP_CODE,
                raw_input=message,
                args={"camp_code": first_word},
                is_valid=True
            )
        
        # Check if it's a 5-letter prefix that matches multiple camps (disambiguation needed)
        if len(first_word) == 5 and first_word.isalpha():
            matching_camps = self.find_camps_by_prefix(first_word)
            if len(matching_camps) > 1:
                # Ambiguous - need user to clarify
                options = []
                for i, camp in enumerate(sorted(matching_camps), 1):
                    camp_name = self.get_camp_name(camp)
                    options.append(f"{i}. {camp_name} ({camp})")
                return ParsedCommand(
                    command_type=CommandType.AMBIGUOUS_CAMP,
                    raw_input=message,
                    args={
                        "prefix": first_word,
                        "matching_camps": sorted(matching_camps)
                    },
                    is_valid=True,
                    error_message=f"Did you mean:\n" + "\n".join(options) + "\n\nReply with number or full code."
                )
            elif len(matching_camps) == 1:
                # Single match - treat as valid
                return ParsedCommand(
                    command_type=CommandType.CAMP_CODE,
                    raw_input=message,
                    args={"camp_code": matching_camps[0]},
                    is_valid=True
                )
            else:
                # No matches - invalid camp code
                return ParsedCommand(
                    command_type=CommandType.CAMP_CODE,
                    raw_input=message,
                    args={"camp_code": first_word},
                    is_valid=False,
                    error_message=f'"{first_word}" not recognized'
                )
        
        # Check if it looks like a camp code (6 chars) but isn't valid
        if len(first_word) == 6 and first_word.isalpha():
            return ParsedCommand(
                command_type=CommandType.CAMP_CODE,
                raw_input=message,
                args={"camp_code": first_word},
                is_valid=False,
                error_message=f'"{first_word}" not recognized'
            )
        
        # Check for date input (DDMMYY format) - used in onboarding
        if re.match(r'^\d{6}$', first_word):
            try:
                parsed_date = self._parse_date(first_word)
                return ParsedCommand(
                    command_type=CommandType.UNKNOWN,  # Will be handled by onboarding flow
                    raw_input=message,
                    args={"date": parsed_date, "date_str": first_word},
                    is_valid=True
                )
            except ValueError as e:
                return ParsedCommand(
                    command_type=CommandType.UNKNOWN,
                    raw_input=message,
                    args={},
                    is_valid=False,
                    error_message=str(e)
                )
        
        # Check for number input (used in onboarding)
        if first_word.isdigit():
            return ParsedCommand(
                command_type=CommandType.UNKNOWN,
                raw_input=message,
                args={"number": int(first_word)},
                is_valid=True
            )
        
        # Unknown command
        return ParsedCommand(
            command_type=CommandType.UNKNOWN,
            raw_input=message,
            args={},
            is_valid=False,
            error_message="Command not recognized"
        )
    
    def _parse_date(self, date_str: str) -> date:
        """
        Parse date from DDMMYY format.
        
        Args:
            date_str: Date string in DDMMYY format
        
        Returns:
            date object
        
        Raises:
            ValueError if invalid format
        """
        if len(date_str) != 6:
            raise ValueError("Date must be 6 digits (DDMMYY)")
        
        try:
            day = int(date_str[0:2])
            month = int(date_str[2:4])
            year = int(date_str[4:6])
            
            # Convert 2-digit year
            if year < 50:
                year += 2000
            else:
                year += 1900
            
            return date(year, month, day)
        except (ValueError, IndexError):
            raise ValueError("Invalid date format. Use DDMMYY (e.g., 150126)")


class ResponseGenerator:
    """
    Generate response messages for commands.
    Section 8.7.1
    """
    
    @staticmethod
    def invalid_camp(camp_code: str, valid_camps: List[str]) -> str:
        """Generate response for invalid camp code."""
        camps_str = ' '.join(valid_camps[:6])  # First 6 camps
        return (
            f'"{camp_code}" not recognized.\n\n'
            f'Valid camps on your route:\n'
            f'{camps_str}\n\n'
            f'Text HELP for commands.'
        )
    
    @staticmethod
    def unknown_command() -> str:
        """Generate response for unknown command."""
        return (
            'Command not recognized.\n\n'
            'Text HELP for available commands.'
        )
    
    @staticmethod
    def camp_already_passed(camp_code: str, current: str, ahead: List[str]) -> str:
        """Generate response for camp already passed."""
        ahead_str = ', '.join(ahead[:3])  # First 3 camps ahead
        return (
            f"You've already passed {camp_code}.\n\n"
            f"Current position: {current}\n"
            f"Reply with a camp ahead: {ahead_str}\n\n"
            f"Or text HELP for commands."
        )
    
    @staticmethod
    def camp_not_on_route(camp_code: str, route_name: str, valid_camps: List[str]) -> str:
        """Generate response for camp not on route."""
        camps_str = ' '.join(valid_camps)
        return (
            f'{camp_code} is not on your route.\n\n'
            f'Your route ({route_name}):\n'
            f'{camps_str}'
        )
    
    @staticmethod
    def already_checked_in(camp_code: str) -> str:
        """Generate response for duplicate check-in."""
        return (
            f'Already checked in at {camp_code} today.\n\n'
            f'Next check-in: tomorrow 5:30pm\n\n'
            f'Text STATUS for your details.'
        )
    
    @staticmethod
    def extension_limit_reached(expires_at: date) -> str:
        """Generate response for max extensions reached."""
        expires_str = expires_at.strftime('%d %b %Y')
        return (
            f'Maximum 3 extensions reached.\n\n'
            f'Your trip expires: {expires_str}\n\n'
            f'Contact support if you need help.'
        )
    
    @staticmethod
    def help_message() -> str:
        """Generate HELP response."""
        return (
            'THUNDERBIRD COMMANDS\n'
            '────────────────────\n'
            '[CAMP] = Check in (e.g., LAKEO)\n'
            'STATUS = Your subscription\n'
            'DELAY = Weather delay +1 day\n'
            'EXTEND = Extend trip +1 day\n'
            'RESEND = Resend last forecast\n'
            'KEY = Column legend\n'
            'ALERTS = BOM warnings\n'
            'STOP = End service'
        )
    
    @staticmethod
    def status_message(
        route_name: str,
        current_camp: str,
        day_number: int,
        total_days: int,
        expires_at: date
    ) -> str:
        """Generate STATUS response."""
        expires_str = expires_at.strftime('%d %b %Y')
        return (
            f'THUNDERBIRD STATUS\n'
            f'────────────────────\n'
            f'Route: {route_name}\n'
            f'Position: {current_camp}\n'
            f'Day: {day_number} of {total_days}\n'
            f'Expires: {expires_str}\n\n'
            f'Text HELP for commands.'
        )
    
    @staticmethod
    def key_message() -> str:
        """Generate KEY response - column legend."""
        return (
            'FORECAST COLUMN KEY\n'
            '────────────────────\n'
            'Day = Forecast day (Mon, Tue...)\n'
            'Tmp = Temperature range (C)\n'
            '%Rn = Rain probability\n'
            'Rn  = Rain amount (mm)\n'
            'Sn  = Snow amount (cm)\n'
            'Wa  = Wind average (km/h)\n'
            'Wm  = Wind max/gusts (km/h)\n'
            '%Cd = Cloud cover %\n'
            'CB  = Cloud base (x100m)\n'
            'FL  = Freezing level (x100m)\n'
            'D   = Danger (!,!!,!!!)\n'
            'TS  = Thunderstorm risk\n\n'
            'Example: CB=8 means cloud at 800m\n'
            'Example: FL=12 means freezing at 1200m'
        )
    
    @staticmethod
    def checkin_confirmed(camp_code: str, camp_name: str) -> str:
        """Generate check-in confirmation."""
        return (
            f'✓ Checked in at {camp_code}\n'
            f'  {camp_name}\n\n'
            f'Forecast coming at 6pm.'
        )
    
    @staticmethod
    def delay_confirmed(new_expiry: date) -> str:
        """Generate DELAY confirmation."""
        expiry_str = new_expiry.strftime('%d %b %Y')
        return (
            f'Weather delay noted.\n\n'
            f'Trip extended by 1 day.\n'
            f'New expiry: {expiry_str}'
        )
    
    @staticmethod
    def stop_confirmed() -> str:
        """Generate STOP confirmation."""
        return (
            'Thunderbird cancelled.\n\n'
            'Safe travels!\n\n'
            'Text START anytime to re-register.'
        )
