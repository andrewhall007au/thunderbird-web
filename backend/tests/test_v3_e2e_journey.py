"""
End-to-End User Journey Tests (Spec Section 7-8)
v3.0: Full user flow from START to CANCEL
"""
import pytest
from datetime import datetime
from zoneinfo import ZoneInfo

TZ_HOBART = ZoneInfo("Australia/Hobart")


class TestFullUserJourney:
    """Test complete user journey through the system."""
    
    def test_new_user_onboarding_flow(self):
        """New user: START → Name → Route → Ready"""
        from app.services.onboarding import OnboardingFlow
        
        flow = OnboardingFlow()
        
        # Step 1: Welcome
        msg1 = flow.get_message(step=1)
        assert "Welcome" in msg1 or "THUNDERBIRD" in msg1
        assert "name" in msg1.lower()
        
        # Step 2: Route selection  
        msg2 = flow.get_message(step=2)
        assert "route" in msg2.lower() or "hiking" in msg2.lower()
        
        # Step 3: Commands guide
        msg3 = flow.get_message(step=3)
        assert "CAST" in msg3
        assert "CHECKIN" in msg3
        
        # Step 4: Camps (with route)
        msg4 = flow.get_message(step=4, route_id="western_arthurs_full")
        assert "CAMP" in msg4.upper()
        
        # Step 5: Peaks
        msg5 = flow.get_message(step=5, route_id="western_arthurs_full")
        assert "PEAK" in msg5.upper()
        
        # Step 6: SafeCheck/Alerts
        msg6 = flow.get_message(step=6)
        assert "SAFE" in msg6.upper() or "ALERT" in msg6.upper()
    
    def test_forecast_request_flow(self):
        """User requests forecast: CAST LAKEO → 12hr forecast"""
        from app.services.commands import CommandParser, CommandType
        
        parser = CommandParser(route_id="western_arthurs_full")
        
        # Parse CAST command
        result = parser.parse("CAST LAKEO")
        assert result.command_type == CommandType.CAST
        assert result.is_valid
        assert result.args.get("location_code") == "LAKEO"
    
    def test_checkin_flow(self):
        """User checks in: CHECKIN LAKEO → Confirmation + SafeCheck"""
        from app.services.commands import CommandParser, CommandType
        from app.services.safecheck import SafeCheckService
        
        SafeCheckService.clear_all()
        
        parser = CommandParser(route_id="western_arthurs_full")
        
        # Add SafeCheck contact first
        user_phone = "+61400000010"
        SafeCheckService.add_contact(user_phone, "+61400111222", "Mum")
        
        # Parse CHECKIN command
        result = parser.parse("CHECKIN LAKEO")
        assert result.command_type == CommandType.CHECKIN
        assert result.is_valid
        
        # Verify notification would be sent
        contacts = SafeCheckService.get_contacts(user_phone)
        assert len(contacts) == 1
    
    def test_safecheck_setup_flow(self):
        """User sets up SafeCheck: SAFE +61... Mum → SAFELIST → SAFEDEL"""
        from app.services.commands import CommandParser, CommandType
        from app.services.safecheck import SafeCheckService
        
        SafeCheckService.clear_all()
        user_phone = "+61400000011"
        
        parser = CommandParser()
        
        # Add contact
        result = parser.parse("SAFE +61400111222 Mum")
        assert result.command_type == CommandType.SAFE
        
        SafeCheckService.add_contact(
            user_phone=user_phone,
            contact_phone=result.args["phone"],
            name=result.args["name"]
        )
        
        # List contacts
        result = parser.parse("SAFELIST")
        assert result.command_type == CommandType.SAFELIST
        
        contacts = SafeCheckService.get_contacts(user_phone)
        assert len(contacts) == 1
        
        # Delete contact
        result = parser.parse("SAFEDEL 1")
        assert result.command_type == CommandType.SAFEDEL
        
        SafeCheckService.remove_contact(user_phone, 1)
        assert SafeCheckService.get_contact_count(user_phone) == 0
    
    def test_alerts_toggle_flow(self):
        """User toggles alerts: ALERTS ON → ALERTS OFF"""
        from app.services.commands import CommandParser, CommandType
        
        parser = CommandParser()
        
        # Enable alerts
        result = parser.parse("ALERTS ON")
        assert result.command_type in [CommandType.ALERTS, CommandType.ALERTS_ON, CommandType.ALERTS_OFF]
        assert result.args.get('action') == 'ON'
        
        # Disable alerts
        result = parser.parse("ALERTS OFF")
        assert result.command_type in [CommandType.ALERTS, CommandType.ALERTS_ON, CommandType.ALERTS_OFF]
        assert result.args.get('action') == 'OFF'
    
    def test_route_info_flow(self):
        """User requests route info: ROUTE → Camp/Peak list"""
        from app.services.commands import CommandParser, CommandType
        
        parser = CommandParser(route_id="western_arthurs_full")
        
        result = parser.parse("ROUTE")
        assert result.command_type == CommandType.ROUTE
    
    def test_help_and_key_flow(self):
        """User requests help: HELP → KEY"""
        from app.services.commands import CommandParser, CommandType
        from app.services.commands import ResponseGenerator
        
        parser = CommandParser()
        
        # Help
        result = parser.parse("HELP")
        assert result.command_type == CommandType.HELP
        
        help_msg = ResponseGenerator.help_message()
        assert "CAST" in help_msg
        
        # Key/Legend
        result = parser.parse("KEY")
        assert result.command_type == CommandType.KEY
        
        key_msg = ResponseGenerator.key_message()
        assert "Tmp" in key_msg or "Temperature" in key_msg
    
    def test_cancel_subscription_flow(self):
        """User cancels: CANCEL → Confirmation"""
        from app.services.commands import CommandParser, CommandType
        
        parser = CommandParser()
        
        result = parser.parse("CANCEL")
        assert result.command_type == CommandType.STOP


class TestMultiDayTripScenario:
    """Test realistic multi-day hiking scenario."""
    
    def test_day1_camp_to_camp(self):
        """Day 1: Scott's Peak → Junction Creek"""
        from app.services.commands import CommandParser, CommandType
        
        parser = CommandParser(route_id="western_arthurs_full")
        
        # Morning forecast at start
        result = parser.parse("CAST SCOTT")
        assert result.command_type == CommandType.CAST
        
        # Check in at first camp
        result = parser.parse("CHECKIN JUNCT")
        assert result.command_type == CommandType.CHECKIN
    
    def test_7day_overview(self):
        """Get 7-day forecast for planning."""
        from app.services.commands import CommandParser, CommandType
        
        parser = CommandParser(route_id="western_arthurs_full")
        
        result = parser.parse("CAST7")
        assert result.command_type == CommandType.CAST7
    
    def test_peak_forecast(self):
        """Get peak forecast before summit attempt."""
        from app.services.commands import CommandParser, CommandType
        
        parser = CommandParser(route_id="western_arthurs_full")
        
        result = parser.parse("PEAKS")
        assert result.command_type == CommandType.PEAKS


class TestErrorRecoveryScenario:
    """Test error handling and recovery."""
    
    def test_invalid_then_valid_command(self):
        """User makes mistake, then corrects."""
        from app.services.commands import CommandParser, CommandType
        
        parser = CommandParser(route_id="western_arthurs_full")
        
        # Invalid command
        result = parser.parse("CSAT LAKEO")  # Typo
        assert result.command_type == CommandType.UNKNOWN
        
        # Corrected command
        result = parser.parse("CAST LAKEO")
        assert result.command_type == CommandType.CAST
        assert result.is_valid
    
    def test_invalid_camp_code(self):
        """User enters invalid camp code."""
        from app.services.commands import CommandParser, CommandType
        
        parser = CommandParser(route_id="western_arthurs_full")
        
        result = parser.parse("CAST XXXXX")
        assert not result.is_valid
        assert "not recognized" in result.error_message.lower()
    
    def test_case_insensitive_recovery(self):
        """User uses lowercase, system handles it."""
        from app.services.commands import CommandParser, CommandType
        
        parser = CommandParser(route_id="western_arthurs_full")
        
        result = parser.parse("cast lakeo")
        assert result.command_type == CommandType.CAST
        assert result.is_valid
