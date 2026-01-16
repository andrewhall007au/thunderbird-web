"""
V3.0 CHECKIN, Onboarding, and Alerts Tests

Tests for:
- CHECKIN command (explicit check-in format)
- Simplified onboarding (5 steps, no start date)
- ALERTS ON/OFF (opt-in BOM warnings)
- ROUTE command (list all codes)

Run with: pytest tests/test_v3_checkin_onboarding.py -v
"""

import pytest
import re
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from zoneinfo import ZoneInfo

TZ_HOBART = ZoneInfo("Australia/Hobart")


# =============================================================================
# CHECKIN Command Tests
# =============================================================================

class TestCHECKINCommand:
    """
    v3.0 uses explicit CHECKIN command instead of just camp code.
    Spec Section 8.3
    """
    
    def test_checkin_parses_correctly(self):
        """CHECKIN LAKEO should parse as check-in command"""
        from app.services.commands import CommandParser
        
        parser = CommandParser()
        parsed = parser.parse("CHECKIN LAKEO")
        
        assert parsed.command_type.name == "CHECKIN"
        assert parsed.location_code.upper() == "LAKEO"
    
    def test_checkin_case_insensitive(self):
        """CHECKIN should be case-insensitive"""
        from app.services.commands import CommandParser
        
        parser = CommandParser()
        
        variations = [
            "CHECKIN LAKEO",
            "checkin lakeo",
            "Checkin Lakeo",
            "CheckIn LAKEO",
        ]
        
        for cmd in variations:
            parsed = parser.parse(cmd)
            assert parsed.command_type.name == "CHECKIN", f"Failed: {cmd}"
            assert parsed.location_code.upper() == "LAKEO", f"Location failed: {cmd}"
    
    def test_checkin_response_format(self):
        """CHECKIN response should confirm location and time"""
        from app.services.commands import ResponseGenerator
        
        response = ResponseGenerator.checkin_confirmed(
            camp_name="Lake Oberon",
            camp_code="LAKEO",
            timestamp=datetime.now(TZ_HOBART),
            safecheck_count=2
        )
        
        assert "Lake Oberon" in response, "Should show camp name"
        assert "✓" in response or "check" in response.lower(), "Should confirm check-in"
        assert "SafeCheck" in response or "notified" in response.lower(), \
            "Should mention SafeCheck notification"
    
    def test_checkin_triggers_safecheck(self):
        """CHECKIN should notify SafeCheck contacts"""
        from app.services.safecheck import SafeCheckService
        
        service = SafeCheckService()
        
        with patch.object(service, 'send_notification') as mock_send:
            mock_send.return_value = True
            
            # Simulate check-in
            result = service.notify_checkin(
                user_id="test-user",
                camp_code="LAKEO",
                camp_name="Lake Oberon",
                timestamp=datetime.now(TZ_HOBART)
            )
            
            # Should attempt to send notifications
            assert mock_send.called or result is not None
    
    def test_checkin_includes_gps(self):
        """CHECKIN response should include GPS coordinates"""
        from app.services.commands import ResponseGenerator
        
        response = ResponseGenerator.checkin_confirmed(
            camp_name="Lake Oberon",
            camp_code="LAKEO",
            timestamp=datetime.now(TZ_HOBART),
            safecheck_count=2,
            gps_lat=-43.1486,
            gps_lon=146.2722
        )
        
        # Should include GPS
        assert "-43" in response or "43" in response, "Should include latitude"
        assert "146" in response, "Should include longitude"
    
    def test_bare_camp_code_does_not_checkin(self):
        """Just sending 'LAKEO' should NOT trigger check-in (v3.0 change)"""
        from app.services.commands import CommandParser
        
        parser = CommandParser()
        parsed = parser.parse("LAKEO")
        
        # Should either not parse as CHECKIN, or be flagged differently
        if parsed and parsed.command_type:
            assert parsed.command_type.name != "CHECKIN", \
                "Bare camp code should not be CHECKIN in v3.0"


# =============================================================================
# Onboarding Tests
# =============================================================================

class TestOnboardingFlow:
    """
    v3.0 simplified onboarding to 5 steps.
    Removed start date. Name used for SafeCheck.
    Spec Section 7
    """
    
    def test_onboarding_step_count(self):
        """Onboarding should be 5-6 messages total"""
        from app.services.onboarding import OnboardingFlow
        
        flow = OnboardingFlow()
        
        # Count total steps
        assert flow.total_steps <= 6, f"Onboarding too long: {flow.total_steps} steps"
        assert flow.total_steps >= 5, f"Onboarding too short: {flow.total_steps} steps"
    
    def test_step1_welcome_asks_name(self):
        """Step 1 should welcome and ask for name"""
        from app.services.onboarding import OnboardingFlow
        
        flow = OnboardingFlow()
        message = flow.get_message(step=1)
        
        assert "THUNDERBIRD" in message or "Welcome" in message, "Should welcome"
        assert "name" in message.lower(), "Should ask for name"
        assert "SafeCheck" in message, "Should mention SafeCheck purpose for name"
    
    def test_step2_route_selection(self):
        """Step 2 should show route options 1-6"""
        from app.services.onboarding import OnboardingFlow
        
        flow = OnboardingFlow()
        message = flow.get_message(step=2, user_name="Andrew")
        
        # Should show 6 route options
        assert "1" in message and "6" in message, "Should show options 1-6"
        assert "Overland" in message, "Should show Overland Track"
        assert "Western Arthurs" in message, "Should show Western Arthurs"
        assert "Federation" in message, "Should show Federation Peak"
        assert "Eastern" in message, "Should show Eastern Arthurs"
    
    def test_step3_commands_guide(self):
        """Step 3 should show commands guide"""
        from app.services.onboarding import OnboardingFlow
        
        flow = OnboardingFlow()
        message = flow.get_message(step=3, route_name="Western Arthurs (Full)")
        
        assert "CAST" in message, "Should mention CAST command"
        assert "CHECKIN" in message, "Should mention CHECKIN command"
        assert "PEAKS" in message or "CAST7" in message, "Should mention summary commands"
    
    def test_step4_camps_list(self):
        """Step 4 should show camps with codes and names"""
        from app.services.onboarding import OnboardingFlow
        
        flow = OnboardingFlow()
        message = flow.get_message(step=4, route_id="western_arthurs_full")
        
        assert "CAMPS" in message.upper(), "Should have camps header"
        assert "LAKEO" in message, "Should show LAKEO code"
        assert "Lake Oberon" in message or "Oberon" in message, "Should show camp name"
        assert "=" in message, "Should use = format (CODE = Name)"
    
    def test_step5_peaks_with_elevations(self):
        """Step 5 should show peaks with full names AND elevations"""
        from app.services.onboarding import OnboardingFlow
        
        flow = OnboardingFlow()
        message = flow.get_message(step=5, route_id="western_arthurs_full")
        
        assert "PEAKS" in message.upper(), "Should have peaks header"
        assert "HESPE" in message, "Should show HESPE code"
        
        # Should show full name AND elevation
        assert "Hesperus" in message or "hesperus" in message.lower(), "Should show peak name"
        assert "1098" in message or "m)" in message, "Should show elevation"
    
    def test_step6_safecheck_alerts_optional(self):
        """Step 6 should offer SafeCheck and Alerts setup"""
        from app.services.onboarding import OnboardingFlow
        
        flow = OnboardingFlow()
        message = flow.get_message(step=6)
        
        assert "SAFE" in message, "Should mention SAFE command"
        assert "ALERTS" in message, "Should mention ALERTS"
        assert "SKIP" in message, "Should offer SKIP option"
        assert "optional" in message.lower(), "Should indicate optional"
    
    def test_no_start_date_question(self):
        """Onboarding should NOT ask for start date (v3.0 change)"""
        from app.services.onboarding import OnboardingFlow
        
        flow = OnboardingFlow()
        
        # Check all messages don't ask for start date
        for step in range(1, 7):
            message = flow.get_message(step=step, user_name="Test", route_id="western_arthurs_full")
            assert "when do you start" not in message.lower(), \
                f"Step {step} should not ask for start date"
            assert "start date" not in message.lower(), \
                f"Step {step} should not mention start date"


# =============================================================================
# ALERTS Command Tests
# =============================================================================

class TestALERTSCommand:
    """
    v3.0 makes BOM alerts opt-in.
    ALERTS ON / ALERTS OFF commands.
    Spec Section 8.5
    """
    
    def test_alerts_command_parses(self):
        """ALERTS should parse as command"""
        from app.services.commands import CommandParser
        
        parser = CommandParser()
        
        for cmd in ["ALERTS", "alerts", "Alerts"]:
            parsed = parser.parse(cmd)
            assert parsed.command_type.name == "ALERTS", f"Failed: {cmd}"
    
    def test_alerts_on_parses(self):
        """ALERTS ON should enable alerts"""
        from app.services.commands import CommandParser
        
        parser = CommandParser()
        parsed = parser.parse("ALERTS ON")
        
        assert parsed.command_type.name == "ALERTS_ON" or \
               (parsed.command_type.name == "ALERTS" and parsed.action == "ON")
    
    def test_alerts_off_parses(self):
        """ALERTS OFF should disable alerts"""
        from app.services.commands import CommandParser
        
        parser = CommandParser()
        parsed = parser.parse("ALERTS OFF")
        
        assert parsed.command_type.name == "ALERTS_OFF" or \
               (parsed.command_type.name == "ALERTS" and parsed.action == "OFF")
    
    def test_alerts_default_disabled(self):
        """New users should have alerts disabled by default"""
        from app.services.user import UserService
        
        service = UserService()
        
        # Create mock new user
        user = service.create_user(phone="+61400000000", name="Test")
        
        assert not user.alerts_enabled, "Alerts should be OFF by default"
    
    def test_alerts_on_response(self):
        """ALERTS ON should confirm enablement"""
        from app.services.commands import ResponseGenerator
        
        response = ResponseGenerator.alerts_enabled()
        
        assert "enabled" in response.lower() or "ON" in response
        assert "ALERTS OFF" in response, "Should tell how to disable"
    
    def test_alerts_off_response(self):
        """ALERTS OFF should confirm disablement"""
        from app.services.commands import ResponseGenerator
        
        response = ResponseGenerator.alerts_disabled()
        
        assert "disabled" in response.lower() or "OFF" in response
        assert "ALERTS ON" in response or "ALERTS" in response, "Should tell how to re-enable"
    
    def test_alerts_shows_current_warnings(self):
        """ALERTS (no argument) should show current BOM warnings"""
        from app.services.commands import ResponseGenerator
        from app.services.bom import BOMService
        
        # Mock BOM warnings
        mock_warnings = [
            {
                "title": "Wind Warning",
                "description": "SW Tasmania highlands",
                "details": "Gusts 90-100km/h ridges",
                "valid_from": "2026-01-16T06:00:00+11:00",
                "valid_to": "2026-01-16T18:00:00+11:00",
            }
        ]
        
        response = ResponseGenerator.current_alerts(mock_warnings)
        
        assert "Wind" in response or "WARNING" in response.upper()
        assert "SW Tasmania" in response or "highlands" in response


# =============================================================================
# ROUTE Command Tests
# =============================================================================

class TestROUTECommand:
    """
    ROUTE command lists all camp and peak codes for user's route.
    Spec Section 8.4
    """
    
    def test_route_command_parses(self):
        """ROUTE should parse as command"""
        from app.services.commands import CommandParser
        
        parser = CommandParser()
        parsed = parser.parse("ROUTE")
        
        assert parsed.command_type.name == "ROUTE"
    
    def test_route_shows_camps(self):
        """ROUTE should list all camp codes"""
        from app.services.commands import ResponseGenerator
        
        response = ResponseGenerator.route_info(
            route_name="Western Arthurs (Full)",
            route_id="western_arthurs_full"
        )
        
        assert "CAMPS" in response.upper()
        assert "LAKEO" in response
        assert "SCOTT" in response
        assert "HIGHM" in response
    
    def test_route_shows_peaks(self):
        """ROUTE should list all peak codes"""
        from app.services.commands import ResponseGenerator
        
        response = ResponseGenerator.route_info(
            route_name="Western Arthurs (Full)",
            route_id="western_arthurs_full"
        )
        
        assert "PEAKS" in response.upper()
        assert "HESPE" in response
        assert "PROCY" in response


# =============================================================================
# SafeCheck Notification Tests
# =============================================================================

class TestSafeCheckNotification:
    """
    SafeCheck notifications sent on CHECKIN.
    Spec Section 8.3
    """
    
    def test_safecheck_message_format(self):
        """SafeCheck notification should include key info"""
        from app.services.safecheck import format_notification
        
        notification = format_notification(
            user_name="Andrew",
            camp_name="Lake Oberon",
            elevation=863,
            route_name="Western Arthurs",
            gps_lat=-43.1486,
            gps_lon=146.2722,
            timestamp=datetime.now(TZ_HOBART)
        )
        
        assert "Andrew" in notification, "Should include hiker name"
        assert "Lake Oberon" in notification, "Should include camp name"
        assert "863" in notification, "Should include elevation"
        assert "-43" in notification or "43" in notification, "Should include GPS"
        assert "maps.google" in notification.lower() or "map" in notification.lower(), \
            "Should include map link"
    
    def test_safecheck_includes_map_link(self):
        """SafeCheck should include clickable map link"""
        from app.services.safecheck import format_notification
        
        notification = format_notification(
            user_name="Andrew",
            camp_name="Lake Oberon",
            elevation=863,
            route_name="Western Arthurs",
            gps_lat=-43.1486,
            gps_lon=146.2722,
            timestamp=datetime.now(TZ_HOBART)
        )
        
        # Should have Google Maps link
        assert "maps.google.com" in notification or "goo.gl/maps" in notification, \
            "Should include Google Maps link"
        assert "-43.1486" in notification or "43.1486" in notification
        assert "146.2722" in notification
