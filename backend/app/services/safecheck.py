"""
SafeCheck Service - V3.0
Based on THUNDERBIRD_SPEC_v3.0 Section 9

Handles SafeCheck notifications to emergency contacts.
"""

from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from datetime import datetime


@dataclass
class SafeCheckContact:
    """Emergency contact for SafeCheck notifications."""
    phone: str
    name: str
    added_at: datetime = None
    
    def __post_init__(self):
        if self.added_at is None:
            self.added_at = datetime.now()


@dataclass
class CheckinRecord:
    """Record of a user check-in."""
    user_phone: str
    camp_code: str
    camp_name: str
    timestamp: datetime
    gps_lat: Optional[float] = None
    gps_lon: Optional[float] = None


class SafeCheckService:
    """
    Service for managing SafeCheck contacts and notifications.
    
    In production, this would connect to a database and SMS service.
    """
    
    # In-memory storage for testing
    _contacts: Dict[str, List[SafeCheckContact]] = {}
    _checkins: List[CheckinRecord] = []
    
    @classmethod
    def add_contact(cls, user_phone: str, contact_phone: str, name: str) -> SafeCheckContact:
        """Add a SafeCheck contact for a user."""
        if user_phone not in cls._contacts:
            cls._contacts[user_phone] = []
        
        contact = SafeCheckContact(phone=contact_phone, name=name)
        cls._contacts[user_phone].append(contact)
        return contact
    
    @classmethod
    def remove_contact(cls, user_phone: str, index: int) -> bool:
        """Remove a SafeCheck contact by index (1-based)."""
        if user_phone in cls._contacts:
            contacts = cls._contacts[user_phone]
            if 1 <= index <= len(contacts):
                contacts.pop(index - 1)
                return True
        return False
    
    @classmethod
    def get_contacts(cls, user_phone: str) -> List[SafeCheckContact]:
        """Get all SafeCheck contacts for a user."""
        return cls._contacts.get(user_phone, [])
    
    @classmethod
    def get_contact_count(cls, user_phone: str) -> int:
        """Get number of SafeCheck contacts for a user."""
        return len(cls.get_contacts(user_phone))
    
    @classmethod
    def record_checkin(
        cls,
        user_phone: str,
        camp_code: str,
        camp_name: str,
        gps_lat: Optional[float] = None,
        gps_lon: Optional[float] = None
    ) -> CheckinRecord:
        """Record a user check-in."""
        record = CheckinRecord(
            user_phone=user_phone,
            camp_code=camp_code,
            camp_name=camp_name,
            timestamp=datetime.now(),
            gps_lat=gps_lat,
            gps_lon=gps_lon
        )
        cls._checkins.append(record)
        return record
    
    @classmethod
    def notify_contacts(cls, user_phone: str, checkin: CheckinRecord) -> int:
        """
        Send SafeCheck notifications to all contacts.
        
        Returns number of contacts notified.
        """
        contacts = cls.get_contacts(user_phone)
        
        for contact in contacts:
            message = format_notification(
                user_phone=user_phone,
                camp_name=checkin.camp_name,
                timestamp=checkin.timestamp,
                gps_lat=checkin.gps_lat,
                gps_lon=checkin.gps_lon
            )
            # In production, send SMS here
            # twilio_client.send(contact.phone, message)
        
        return len(contacts)
    
    @classmethod
    def clear_all(cls):
        """Clear all data (for testing)."""
        cls._contacts.clear()
        cls._checkins.clear()


    @classmethod
    def send_notification(cls, user_phone: str, checkin: CheckinRecord) -> int:
        """Alias for notify_contacts."""
        return cls.notify_contacts(user_phone, checkin)

    @classmethod
    def notify_checkin(
        cls,
        user_id: str,
        camp_code: str,
        camp_name: str,
        timestamp: datetime,
        gps_lat: float = None,
        gps_lon: float = None
    ) -> bool:
        """Process a check-in and notify contacts."""
        checkin = cls.record_checkin(
            user_phone=user_id,
            camp_code=camp_code,
            camp_name=camp_name,
            gps_lat=gps_lat,
            gps_lon=gps_lon
        )
        count = cls.notify_contacts(user_id, checkin)
        return count > 0


def format_notification(
    user_name: str = None,
    camp_name: str = None,
    elevation: int = None,
    route_name: str = None,
    gps_lat: float = None,
    gps_lon: float = None,
    timestamp: datetime = None,
    user_phone: str = None
) -> str:
    """
    Format SafeCheck notification message.
    v3.0: Includes GPS coordinates and map link when available.
    """
    time_str = timestamp.strftime("%H:%M %d/%m") if timestamp else datetime.now().strftime("%H:%M %d/%m")
    
    name = user_name or "Your contact"
    
    msg = (
        f"THUNDERBIRD SAFECHECK\n"
        f"--------------------\n"
        f"{name} checked in:\n"
        f"  {camp_name}"
    )
    
    if elevation:
        msg += f" ({elevation}m)"
    
    msg += f"\n  {time_str}\n"
    
    if route_name:
        msg += f"  Route: {route_name}\n"
    
    if gps_lat and gps_lon:
        msg += f"\nGPS: {gps_lat:.4f}, {gps_lon:.4f}\n"
        map_link = f"https://maps.google.com/?q={gps_lat},{gps_lon}"
        msg += f"Map: {map_link}"
    
    return msg


def get_map_link(lat: float, lon: float) -> str:
    """Generate Google Maps link for coordinates."""
    return f"https://maps.google.com/?q={lat},{lon}"
