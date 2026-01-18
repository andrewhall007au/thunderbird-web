"""
SMS Command Parser
Based on THUNDERBIRD_SPEC_v3.0 Sections 7, 8
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
    
    # v3.0 new commands
    CAST12 = "CAST12"       # 12hr hourly (alias for CAST)
    CAST24 = "CAST24"       # 24hr hourly
    CAST7 = "CAST7"         # 7-day (location, CAMPS, or PEAKS)
    CHECKIN = "CHECKIN"     # Explicit check-in
    ROUTE = "ROUTE"         # List camp/peak codes
    ALERTS_ON = "ALERTS_ON"
    ALERTS_OFF = "ALERTS_OFF"
    SKIP = "SKIP"           # Skip onboarding step
    
    # Legacy
    WA_PUSH = "WA_PUSH"
    SAFE = "SAFE"
    SAFEDEL = "SAFEDEL"
    SAFELIST = "SAFELIST"
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
    
    # v3.0 convenience properties
    @property
    def location_code(self) -> Optional[str]:
        """Get camp or peak code from args."""
        return self.args.get("camp_code") or self.args.get("peak_code") or self.args.get("location_code")
    
    @property
    def action(self) -> Optional[str]:
        """Get action from args (e.g., ON/OFF for ALERTS)."""
        return self.args.get("action")


class CommandParser:
    """
    Parse incoming SMS messages into commands.
    v3.0 - Pull-based system with explicit CHECKIN.
    """
    
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
    
    @classmethod
    def get_all_peak_codes(cls) -> List[str]:
        """Get all peak codes from all routes."""
        from app.services.routes import RouteLoader, get_route
        all_peaks = set()
        for route_id in RouteLoader.list_routes():
            route = get_route(route_id)
            if route:
                all_peaks.update([p.code for p in route.peaks])
        return list(all_peaks)
    
    def find_camps_by_prefix(self, prefix: str) -> List[str]:
        """Find all camp codes that start with the given prefix."""
        prefix_upper = prefix.upper()
        return [camp for camp in self.valid_camps if camp.startswith(prefix_upper)]
    
    def get_camp_name(self, camp_code: str) -> str:
        """Get the display name for a camp code."""
        from app.services.routes import RouteLoader, get_route
        for route_id in RouteLoader.list_routes():
            route = get_route(route_id)
            if route:
                for camp in route.camps:
                    if camp.code == camp_code:
                        return camp.name
        return camp_code
    
    # Simple command mapping (no args)
    SIMPLE_COMMANDS = {
        "START": CommandType.START,
        "REGISTER": CommandType.START,
        "STOP": CommandType.STOP,
        "CANCEL": CommandType.STOP,
        "HELP": CommandType.HELP,
        "COMMANDS": CommandType.HELP,
        "STATUS": CommandType.STATUS,
        "DELAY": CommandType.DELAY,
        "EXTEND": CommandType.EXTEND,
        "RESEND": CommandType.RESEND,
        "EDIT": CommandType.EDIT,
        "KEY": CommandType.KEY,
        "LEGEND": CommandType.KEY,
        # "ALERTS": CommandType.ALERTS,  # Handled separately
        "WARNINGS": CommandType.ALERTS,
        "SAFELIST": CommandType.SAFELIST,
        "Y": CommandType.YES,
        "YES": CommandType.YES,
        "N": CommandType.NO,
        "NO": CommandType.NO,
        # v3.0 additions
        "ROUTE": CommandType.ROUTE,
        "ROUTES": CommandType.ROUTE,
        "SKIP": CommandType.SKIP,
    }
    
    # Cheat codes (multi-word commands)
    CHEAT_CODES = {
        "WA PUSH": CommandType.WA_PUSH,
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
        self.valid_peaks = self._get_valid_peaks()
    
    def _get_valid_camps(self) -> List[str]:
        """Get valid camp codes for current route."""
        if self.route_id:
            return self.get_camp_codes_for_route(self.route_id)
        return self.get_all_camp_codes()
    
    def _get_valid_peaks(self) -> List[str]:
        """Get valid peak codes for current route."""
        return self.get_all_peak_codes()
    
    def sanitize(self, message: str) -> str:
        """Sanitize incoming SMS message."""
        cleaned = message.strip()
        cleaned = re.sub(r'[^A-Za-z0-9@ +]', '', cleaned)
        return cleaned
    
    def parse(self, message: str) -> ParsedCommand:
        """
        Parse an SMS message into a command.
        v3.0 - All commands case-insensitive.
        """
        sanitized = self.sanitize(message)
        upper = sanitized.upper()
        
        # Check for LIVETEST commands first
        for pattern, cmd_type in self.LIVETEST_COMMANDS.items():
            if upper.startswith(pattern.upper()):
                return ParsedCommand(
                    command_type=cmd_type,
                    raw_input=message,
                    args={},
                    is_valid=True
                )
        
        # Check for cheat codes
        for pattern, cmd_type in self.CHEAT_CODES.items():
            if upper == pattern or upper.startswith(pattern + " "):
                return ParsedCommand(
                    command_type=cmd_type,
                    raw_input=message,
                    args={},
                    is_valid=True
                )
        
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
        
        # Check simple commands first
        if first_word in self.SIMPLE_COMMANDS:
            return ParsedCommand(
                command_type=self.SIMPLE_COMMANDS[first_word],
                raw_input=message,
                args={},
                is_valid=True
            )
        
        # ALERTS ON / ALERTS OFF / bare ALERTS (v3.0)
        if first_word == "ALERTS":
            if len(parts) >= 2:
                action = parts[1]
                if action == "ON":
                    return ParsedCommand(
                        command_type=CommandType.ALERTS_ON,
                        raw_input=message,
                        args={"action": "ON"},
                        is_valid=True
                    )
                elif action == "OFF":
                    return ParsedCommand(
                        command_type=CommandType.ALERTS_OFF,
                        raw_input=message,
                        args={"action": "OFF"},
                        is_valid=True
                    )
            # Bare ALERTS command
            return ParsedCommand(
                command_type=CommandType.ALERTS,
                raw_input=message,
                args={},
                is_valid=True
            )
        
        # CAST / CAST12 with location (v3.0)
        if first_word in ("CAST", "CAST12"):
            return self._parse_cast(parts, CommandType.CAST, message)
        
        # CAST24 with location (v3.0)
        if first_word == "CAST24":
            return self._parse_cast(parts, CommandType.CAST24, message)

        # CAST7 with location, CAMPS, or PEAKS (v3.2)
        if first_word == "CAST7":
            return self._parse_cast7(parts, message)

        # CHECKIN command (v3.0)
        if first_word == "CHECKIN":
            return self._parse_checkin(parts, message)
        
        # SAFE command
        if first_word == "SAFE":
            return self._parse_safe(parts, message)
        
        # SAFEDEL command
        if first_word == "SAFEDEL":
            return self._parse_safedel(parts, message)
        
        # Check if it's a valid camp code
        # v3.0: bare camp code does NOT check in automatically
        if first_word in self.valid_camps:
            return ParsedCommand(
                command_type=CommandType.CAMP_CODE,
                raw_input=message,
                args={"camp_code": first_word},
                is_valid=True,
                error_message="Use CHECKIN command. Example: CHECKIN " + first_word
            )
        
        # Check if it's a valid peak code
        if first_word in self.valid_peaks:
            return ParsedCommand(
                command_type=CommandType.CAMP_CODE,
                raw_input=message,
                args={"peak_code": first_word},
                is_valid=True,
                error_message="Use CAST for forecasts. Example: CAST " + first_word
            )
        
        # Prefix matching for camps
        if len(first_word) >= 3:
            matches = self.find_camps_by_prefix(first_word)
            if len(matches) == 1:
                return ParsedCommand(
                    command_type=CommandType.CAMP_CODE,
                    raw_input=message,
                    args={"camp_code": matches[0]},
                    is_valid=True,
                    error_message="Use CHECKIN command. Example: CHECKIN " + matches[0]
                )
            elif len(matches) > 1:
                return ParsedCommand(
                    command_type=CommandType.AMBIGUOUS_CAMP,
                    raw_input=message,
                    args={"matches": matches},
                    is_valid=False,
                    error_message=f'"{first_word}" matches: {" ".join(matches)}'
                )
        
        # Check for date input (DDMMYY format)
        if re.match(r'^\d{6}$', first_word):
            try:
                parsed_date = self._parse_date(first_word)
                return ParsedCommand(
                    command_type=CommandType.UNKNOWN,
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
        
        # Check for number input (onboarding)
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
            error_message="Command not recognized. Text COMMANDS for help."
        )
    
    def _parse_cast(self, parts: List[str], cmd_type: CommandType, message: str) -> ParsedCommand:
        """Parse CAST/CAST12/CAST24 command."""
        if len(parts) >= 2:
            location = parts[1]
            if location in self.valid_camps or location in self.valid_peaks:
                return ParsedCommand(
                    command_type=cmd_type,
                    raw_input=message,
                    args={"location_code": location, "camp_code": location},
                    is_valid=True
                )
            else:
                return ParsedCommand(
                    command_type=cmd_type,
                    raw_input=message,
                    args={"location_code": location},
                    is_valid=False,
                    error_message=f'"{location}" not recognized. Text ROUTE for valid codes.'
                )
        else:
            return ParsedCommand(
                command_type=cmd_type,
                raw_input=message,
                args={},
                is_valid=False,
                error_message="CAST requires a location. Example: CAST LAKEO"
            )

    def _parse_cast7(self, parts: List[str], message: str) -> ParsedCommand:
        """Parse CAST7 command - 7-day forecast for location, CAMPS, or PEAKS."""
        if len(parts) >= 2:
            location = parts[1]
            if location == "CAMPS":
                return ParsedCommand(
                    command_type=CommandType.CAST7,
                    raw_input=message,
                    args={"all_camps": True},
                    is_valid=True
                )
            elif location == "PEAKS":
                return ParsedCommand(
                    command_type=CommandType.CAST7,
                    raw_input=message,
                    args={"all_peaks": True},
                    is_valid=True
                )
            elif location in self.valid_camps or location in self.valid_peaks:
                return ParsedCommand(
                    command_type=CommandType.CAST7,
                    raw_input=message,
                    args={"location_code": location},
                    is_valid=True
                )
            else:
                return ParsedCommand(
                    command_type=CommandType.CAST7,
                    raw_input=message,
                    args={"location_code": location},
                    is_valid=False,
                    error_message=f'"{location}" not recognized. Text ROUTE for valid codes.'
                )
        else:
            return ParsedCommand(
                command_type=CommandType.CAST7,
                raw_input=message,
                args={},
                is_valid=False,
                error_message="CAST7 requires location. Example: CAST7 LAKEO, CAST7 CAMPS, or CAST7 PEAKS"
            )
    
    def _parse_checkin(self, parts: List[str], message: str) -> ParsedCommand:
        """Parse CHECKIN command (v3.0)."""
        if len(parts) >= 2:
            camp = parts[1]
            if camp in self.valid_camps:
                return ParsedCommand(
                    command_type=CommandType.CHECKIN,
                    raw_input=message,
                    args={"camp_code": camp},
                    is_valid=True
                )
            else:
                return ParsedCommand(
                    command_type=CommandType.CHECKIN,
                    raw_input=message,
                    args={"camp_code": camp},
                    is_valid=False,
                    error_message=f'"{camp}" not recognized. Text ROUTE for valid camps.'
                )
        else:
            return ParsedCommand(
                command_type=CommandType.CHECKIN,
                raw_input=message,
                args={},
                is_valid=False,
                error_message="CHECKIN requires a camp. Example: CHECKIN LAKEO"
            )
    
    def _parse_safe(self, parts: List[str], message: str) -> ParsedCommand:
        """Parse SAFE command."""
        if len(parts) >= 2:
            phone = parts[1]
            name = parts[2] if len(parts) >= 3 else "Contact"
            return ParsedCommand(
                command_type=CommandType.SAFE,
                raw_input=message,
                args={"phone": phone, "name": name},
                is_valid=True
            )
        else:
            return ParsedCommand(
                command_type=CommandType.SAFE,
                raw_input=message,
                args={},
                is_valid=False,
                error_message="SAFE requires phone. Example: SAFE +61400123456 Kate"
            )
    
    def _parse_safedel(self, parts: List[str], message: str) -> ParsedCommand:
        """Parse SAFEDEL command."""
        if len(parts) >= 2 and parts[1].isdigit():
            return ParsedCommand(
                command_type=CommandType.SAFEDEL,
                raw_input=message,
                args={"index": int(parts[1])},
                is_valid=True
            )
        else:
            return ParsedCommand(
                command_type=CommandType.SAFEDEL,
                raw_input=message,
                args={},
                is_valid=False,
                error_message="SAFEDEL requires number. Example: SAFEDEL 1"
            )
    
    def _parse_date(self, date_str: str) -> date:
        """Parse date from DDMMYY format."""
        if len(date_str) != 6:
            raise ValueError("Date must be 6 digits (DDMMYY)")
        
        try:
            day = int(date_str[0:2])
            month = int(date_str[2:4])
            year = int(date_str[4:6])
            
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
    v3.0 updates.
    """
    
    @staticmethod
    def invalid_location(location_code: str) -> str:
        """Generate response for invalid location code (v3.0)."""
        return (
            f'"{location_code}" not recognized.\n\n'
            f'Text ROUTE for valid camps and peaks.'
        )
    
    @staticmethod
    def invalid_camp(camp_code: str, valid_camps: List[str]) -> str:
        """Generate response for invalid camp code."""
        camps_str = ' '.join(valid_camps[:6])
        return (
            f'"{camp_code}" not recognized.\n\n'
            f'Valid camps:\n{camps_str}\n\n'
            f'Text ROUTE for full list.'
        )
    
    @staticmethod
    def unknown_command() -> str:
        """Generate response for unknown command."""
        return (
            'Command not recognized.\n\n'
            'Text COMMANDS for available commands.'
        )
    
    @staticmethod
    def camp_already_passed(camp_code: str, current: str, ahead: List[str]) -> str:
        """Generate response for camp already passed."""
        ahead_str = ', '.join(ahead[:3])
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
        """Generate HELP/COMMANDS response (v3.2)."""
        return (
            'THUNDERBIRD COMMANDS\n'
            '────────────────────\n'
            'CAST12 [LOC] = 12hr forecast\n'
            'CAST24 [LOC] = 24hr forecast\n'
            'CAST7 [LOC] = 7-day location\n'
            'CAST7 CAMPS = 7-day all camps\n'
            'CAST7 PEAKS = 7-day all peaks\n'
            'CHECKIN [CAMP] = Check in\n'
            'ROUTE = List codes\n'
            'ALERTS ON/OFF = Warnings\n'
            'SAFE [PHONE] [NAME]\n'
            'STATUS = Subscription\n'
            'KEY = Legend\n'
            'CANCEL = End service'
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
            f'Text COMMANDS for help.'
        )
    
    @staticmethod
    def key_message() -> str:
        """Generate KEY response (v3.1 - with CB reinstated)."""
        return (
            'FORECAST COLUMN KEY\n'
            '────────────────────\n'
            'Hr  = Hour (24hr)\n'
            'Tmp = Temperature (C)\n'
            '%Rn = Rain probability\n'
            'Prec = R#-# rain mm, S#-# snow cm\n'
            'Wa  = Wind avg (km/h)\n'
            'Wm  = Wind max (km/h)\n'
            'Wd  = Wind direction\n'
            '%Cd = Cloud cover\n'
            'CB  = Cloud base (x100m)\n'
            'FL  = Freezing level (x100m)\n'
            'D   = Danger (!,!!,!!!)\n\n'
            'CB=8 means clouds at 800m\n'
            'FL=12 means freezing at 1200m'
        )
    
    @staticmethod
    def checkin_confirmed(
        camp_code: str,
        camp_name: str,
        timestamp: Optional[datetime] = None,
        safecheck_count: int = 0,
        gps_lat: Optional[float] = None,
        gps_lon: Optional[float] = None
    ) -> str:
        """Generate check-in confirmation (v3.0)."""
        time_str = timestamp.strftime('%H:%M') if timestamp else datetime.now(TZ_HOBART).strftime('%H:%M')
        
        msg = (
            f'✓ Checked in at {camp_name}\n'
            f'  {camp_code} at {time_str}\n'
        )
        
        if gps_lat and gps_lon:
            msg += f'  GPS: {gps_lat:.4f}, {gps_lon:.4f}\n'
        
        if safecheck_count > 0:
            msg += f'\n{safecheck_count} SafeCheck contact(s) notified.'
        
        return msg
    
    @staticmethod
    def route_info(route_name: str, route_id: str) -> str:
        """Generate ROUTE response (v3.0)."""
        from app.services.routes import get_route
        route = get_route(route_id)
        
        if not route:
            return f'Route {route_id} not found.'
        
        camps = ' '.join([c.code for c in route.camps])
        peaks = ' '.join([p.code for p in route.peaks])
        
        return (
            f'{route_name}\n'
            f'────────────────────\n'
            f'CAMPS:\n{camps}\n\n'
            f'PEAKS:\n{peaks}\n\n'
            f'CAST [CODE] = forecast\n'
            f'CHECKIN [CAMP] = check in'
        )
    
    @staticmethod
    def alerts_enabled() -> str:
        """Generate ALERTS ON confirmation (v3.0)."""
        return (
            'BOM alerts enabled.\n\n'
            'You will receive severe weather warnings.\n\n'
            'Text ALERTS OFF to disable.'
        )
    
    @staticmethod
    def alerts_disabled() -> str:
        """Generate ALERTS OFF confirmation (v3.0)."""
        return (
            'BOM alerts disabled.\n\n'
            'Text ALERTS ON to re-enable.'
        )
    
    @staticmethod
    def current_alerts(warnings: List[Dict[str, Any]]) -> str:
        """Generate current BOM warnings response (v3.0)."""
        if not warnings:
            return (
                'No active warnings for your route.\n\n'
                'Text ALERTS ON to receive future warnings.'
            )
        
        msg = 'ACTIVE WARNINGS\n────────────────────\n'
        for w in warnings[:3]:
            msg += f"⚠️ {w.get('title', 'Warning')}\n"
            msg += f"   {w.get('description', '')}\n"
        
        return msg
    
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
