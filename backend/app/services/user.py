"""
User Service - V3.0
Based on THUNDERBIRD_SPEC_v3.0 Section 10
"""

from decimal import Decimal
from typing import Optional, Dict
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class UserPreferences:
    """User preferences and settings."""
    alerts_enabled: bool = False
    wind_threshold: str = "moderate"


@dataclass
class UserBalance:
    """User SMS balance tracking."""
    balance: Decimal = Decimal("0.00")
    last_charge: Optional[datetime] = None
    total_segments_used: int = 0


@dataclass
class User:
    """User model."""
    id: str = None
    phone: str = None
    name: Optional[str] = None
    route_id: Optional[str] = None
    current_camp: Optional[str] = None
    preferences: UserPreferences = field(default_factory=UserPreferences)
    balance: UserBalance = field(default_factory=UserBalance)
    sms_balance: Decimal = Decimal("0.00")
    alerts_enabled: bool = False
    created_at: Optional[datetime] = None


class UserService:
    """Service for managing users."""
    
    _users: Dict[str, User] = {}
    
    @classmethod
    def create_user(cls, phone: str, name: Optional[str] = None) -> User:
        """Create a new user with default settings."""
        user = User(
            id=phone,
            phone=phone,
            name=name,
            preferences=UserPreferences(alerts_enabled=False),
            balance=UserBalance(balance=Decimal("0.00")),
            sms_balance=Decimal("0.00"),
            created_at=datetime.now()
        )
        cls._users[phone] = user
        return user
    
    @classmethod
    def get_user(cls, phone: str) -> Optional[User]:
        """Get user by phone number."""
        return cls._users.get(phone)
    
    @classmethod
    def get_or_create(cls, phone: str) -> User:
        """Get existing user or create new one."""
        user = cls.get_user(phone)
        if not user:
            user = cls.create_user(phone)
        return user
    
    @classmethod
    def set_alerts_enabled(cls, phone: str, enabled: bool) -> bool:
        """Enable or disable BOM alerts for user."""
        user = cls.get_user(phone)
        if user:
            user.preferences.alerts_enabled = enabled
            return True
        return False
    
    @classmethod
    def get_alerts_enabled(cls, phone: str) -> bool:
        """Check if user has alerts enabled."""
        user = cls.get_user(phone)
        if user:
            return user.preferences.alerts_enabled
        return False
    
    @classmethod
    def add_balance(cls, phone: str, amount: Decimal) -> Decimal:
        """Add to user's SMS balance."""
        user = cls.get_or_create(phone)
        user.sms_balance += amount
        user.balance.balance += amount
        return user.sms_balance
    
    @classmethod
    def get_balance(cls, phone: str) -> Decimal:
        """Get user's current balance."""
        user = cls.get_user(phone)
        if user:
            return user.sms_balance
        return Decimal("0.00")
    
    @classmethod
    def charge_sms(cls, phone: str, segments: int) -> Decimal:
        """Charge user for SMS segments."""
        from app.services.pricing import get_user_segment_price
        
        user = cls.get_or_create(phone)
        cost = Decimal(segments) * get_user_segment_price()
        user.sms_balance -= cost
        user.balance.balance -= cost
        user.balance.total_segments_used += segments
        user.balance.last_charge = datetime.now()
        return user.sms_balance
    
    @classmethod
    def has_sufficient_balance(cls, phone: str, segments: int = 1) -> bool:
        """Check if user has enough balance for SMS."""
        from app.services.pricing import get_user_segment_price
        
        balance = cls.get_balance(phone)
        cost = Decimal(segments) * get_user_segment_price()
        return balance >= cost
    
    @classmethod
    def is_low_balance(cls, phone: str) -> bool:
        """Check if user has low balance (< $1)."""
        balance = cls.get_balance(phone)
        return balance < Decimal("1.00")
    
    @classmethod
    def clear_all(cls):
        """Clear all users (for testing)."""
        cls._users.clear()

    @classmethod
    def check_low_balance(cls, phone: str) -> bool:
        """Alias for is_low_balance."""
        return cls.is_low_balance(phone)

