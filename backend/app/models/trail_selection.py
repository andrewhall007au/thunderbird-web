"""
Trail selection session models for multi-trail SMS selection.

Manages the stateful SMS flow for users to select between multiple trails.
Sessions are in-memory with 30-minute expiry.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional, List, Dict
from enum import Enum


__all__ = ['SelectionState', 'TrailSelectionSession', 'TrailSelectionSessionStore', 'trail_selection_store']


class SelectionState(str, Enum):
    """State of the trail selection flow."""
    MAIN_MENU = "main_menu"      # Showing "1. My Trails, 2. Library"
    MY_TRAILS = "my_trails"      # Showing user's saved trails
    LIBRARY = "library"          # Showing library trails


@dataclass
class TrailSelectionSession:
    """
    SMS trail selection session with expiry.

    Attributes:
        phone: User's phone number (session key)
        state: Current selection state (main menu, my trails, or library)
        page: Current pagination offset (0-indexed)
        trail_ids: Cached list of trail IDs for current view
        created_at: Session creation timestamp
        expires_at: Session expiry timestamp (30 minutes from creation)
    """
    phone: str
    state: SelectionState
    page: int = 0                          # Current pagination offset (0-indexed)
    trail_ids: Optional[List[int]] = None  # Cached list of trail IDs for current view
    created_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None  # 30 min timeout

    def __post_init__(self):
        """Initialize timestamps if not provided."""
        if self.created_at is None:
            self.created_at = datetime.utcnow()
        if self.expires_at is None:
            self.expires_at = self.created_at + timedelta(minutes=30)

    def is_expired(self) -> bool:
        """
        Check if session has expired.

        Returns:
            True if expired, False if still valid
        """
        return datetime.utcnow() > self.expires_at

    def refresh_expiry(self):
        """Extend session expiry by 30 minutes on each interaction."""
        self.expires_at = datetime.utcnow() + timedelta(minutes=30)


class TrailSelectionSessionStore:
    """In-memory session store for trail selection flow."""

    def __init__(self):
        self._sessions: Dict[str, TrailSelectionSession] = {}

    def get(self, phone: str) -> Optional[TrailSelectionSession]:
        """
        Get session if exists and not expired.

        Automatically removes expired sessions.

        Args:
            phone: Phone number to look up

        Returns:
            TrailSelectionSession if exists and valid, None otherwise
        """
        session = self._sessions.get(phone)
        if session and session.is_expired():
            del self._sessions[phone]
            return None
        return session

    def create(self, phone: str, state: SelectionState) -> TrailSelectionSession:
        """
        Create new session, replacing any existing.

        Args:
            phone: Phone number (session key)
            state: Initial selection state

        Returns:
            Created TrailSelectionSession
        """
        session = TrailSelectionSession(phone=phone, state=state)
        self._sessions[phone] = session
        return session

    def update(self, phone: str, **kwargs) -> Optional[TrailSelectionSession]:
        """
        Update session fields.

        Automatically refreshes expiry on update.

        Args:
            phone: Phone number to look up
            **kwargs: Fields to update (state, page, trail_ids, etc.)

        Returns:
            Updated session if exists, None if not found
        """
        session = self.get(phone)
        if session:
            for key, value in kwargs.items():
                if hasattr(session, key):
                    setattr(session, key, value)
            session.refresh_expiry()
        return session

    def delete(self, phone: str) -> bool:
        """
        Remove session.

        Args:
            phone: Phone number to remove

        Returns:
            True if removed, False if not found
        """
        if phone in self._sessions:
            del self._sessions[phone]
            return True
        return False

    def clear_expired(self):
        """Remove all expired sessions (call periodically)."""
        expired = [p for p, s in self._sessions.items() if s.is_expired()]
        for phone in expired:
            del self._sessions[phone]


# Singleton instance
trail_selection_store = TrailSelectionSessionStore()
