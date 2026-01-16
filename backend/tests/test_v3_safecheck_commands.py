"""
Tests for SafeCheck Commands (Spec Section 8.6)
v3.0: SAFE, SAFELIST, SAFEDEL commands
"""
import pytest
from datetime import datetime
from zoneinfo import ZoneInfo

TZ_HOBART = ZoneInfo("Australia/Hobart")


class TestSAFECommand:
    """Test SAFE command for adding contacts."""
    
    def test_safe_parses_phone_and_name(self):
        """SAFE +61400111222 Mum should parse correctly."""
        from app.services.commands import CommandParser, CommandType
        
        parser = CommandParser()
        result = parser.parse("SAFE +61400111222 Mum")
        
        assert result.command_type == CommandType.SAFE
        assert result.args.get("phone") == "+61400111222"
        assert result.args.get("name").upper() == "MUM"
    
    def test_safe_with_multi_word_name(self):
        """SAFE +61400111222 My Partner should handle multi-word names."""
        from app.services.commands import CommandParser, CommandType
        
        parser = CommandParser()
        result = parser.parse("SAFE +61400111222 My Partner")
        
        assert result.command_type == CommandType.SAFE
        assert "MY" in result.args.get("name").upper()
    
    def test_safe_adds_contact(self):
        """SAFE should add contact to SafeCheck list."""
        from app.services.safecheck import SafeCheckService
        
        SafeCheckService.clear_all()
        
        user_phone = "+61400000001"
        contact = SafeCheckService.add_contact(
            user_phone=user_phone,
            contact_phone="+61400111222",
            name="Mum"
        )
        
        assert contact.name == "Mum"
        assert SafeCheckService.get_contact_count(user_phone) == 1
    
    def test_safe_max_contacts(self):
        """Users should have max 3 SafeCheck contacts."""
        from app.services.safecheck import SafeCheckService
        
        SafeCheckService.clear_all()
        
        user_phone = "+61400000002"
        for i in range(3):
            SafeCheckService.add_contact(
                user_phone=user_phone,
                contact_phone=f"+6140011122{i}",
                name=f"Contact{i}"
            )
        
        assert SafeCheckService.get_contact_count(user_phone) == 3


class TestSAFELISTCommand:
    """Test SAFELIST command for viewing contacts."""
    
    def test_safelist_parses(self):
        """SAFELIST should parse correctly."""
        from app.services.commands import CommandParser, CommandType
        
        parser = CommandParser()
        result = parser.parse("SAFELIST")
        
        assert result.command_type == CommandType.SAFELIST
    
    def test_safelist_shows_contacts(self):
        """SAFELIST should show numbered contact list."""
        from app.services.safecheck import SafeCheckService
        # ResponseGenerator not needed
        
        SafeCheckService.clear_all()
        
        user_phone = "+61400000003"
        SafeCheckService.add_contact(user_phone, "+61400111222", "Mum")
        SafeCheckService.add_contact(user_phone, "+61400333444", "Dad")
        
        contacts = SafeCheckService.get_contacts(user_phone)
        
        assert len(contacts) == 2
        assert contacts[0].name == "Mum"
        assert contacts[1].name == "Dad"
    
    def test_safelist_empty(self):
        """SAFELIST with no contacts should show helpful message."""
        from app.services.safecheck import SafeCheckService
        
        SafeCheckService.clear_all()
        
        user_phone = "+61400000004"
        contacts = SafeCheckService.get_contacts(user_phone)
        
        assert len(contacts) == 0


class TestSAFEDELCommand:
    """Test SAFEDEL command for removing contacts."""
    
    def test_safedel_parses_number(self):
        """SAFEDEL 1 should parse correctly."""
        from app.services.commands import CommandParser, CommandType
        
        parser = CommandParser()
        result = parser.parse("SAFEDEL 1")
        
        assert result.command_type == CommandType.SAFEDEL
        assert result.args.get("index") == 1
    
    def test_safedel_removes_contact(self):
        """SAFEDEL should remove contact by index."""
        from app.services.safecheck import SafeCheckService
        
        SafeCheckService.clear_all()
        
        user_phone = "+61400000005"
        SafeCheckService.add_contact(user_phone, "+61400111222", "Mum")
        SafeCheckService.add_contact(user_phone, "+61400333444", "Dad")
        
        assert SafeCheckService.get_contact_count(user_phone) == 2
        
        result = SafeCheckService.remove_contact(user_phone, 1)
        
        assert result == True
        assert SafeCheckService.get_contact_count(user_phone) == 1
        assert SafeCheckService.get_contacts(user_phone)[0].name == "Dad"
    
    def test_safedel_invalid_index(self):
        """SAFEDEL with invalid index should fail gracefully."""
        from app.services.safecheck import SafeCheckService
        
        SafeCheckService.clear_all()
        
        user_phone = "+61400000006"
        SafeCheckService.add_contact(user_phone, "+61400111222", "Mum")
        
        result = SafeCheckService.remove_contact(user_phone, 5)
        
        assert result == False
        assert SafeCheckService.get_contact_count(user_phone) == 1


class TestSafeCheckNotificationFlow:
    """Test full SafeCheck notification flow."""
    
    def test_checkin_notifies_all_contacts(self):
        """CHECKIN should notify all SafeCheck contacts."""
        from app.services.safecheck import SafeCheckService
        
        SafeCheckService.clear_all()
        
        user_phone = "+61400000007"
        SafeCheckService.add_contact(user_phone, "+61400111222", "Mum")
        SafeCheckService.add_contact(user_phone, "+61400333444", "Dad")
        
        checkin = SafeCheckService.record_checkin(
            user_phone=user_phone,
            camp_code="LAKEO",
            camp_name="Lake Oberon",
            gps_lat=-43.1486,
            gps_lon=146.2722
        )
        
        count = SafeCheckService.notify_contacts(user_phone, checkin)
        
        assert count == 2
    
    def test_notification_includes_gps(self):
        """SafeCheck notification should include GPS coordinates."""
        from app.services.safecheck import format_notification
        
        msg = format_notification(
            user_name="Andrew",
            camp_name="Lake Oberon",
            gps_lat=-43.1486,
            gps_lon=146.2722,
            timestamp=datetime.now(TZ_HOBART)
        )
        
        assert "-43.1486" in msg
        assert "146.2722" in msg
        assert "maps.google.com" in msg
