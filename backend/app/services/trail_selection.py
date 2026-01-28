"""
Trail Selection Service - Multi-trail SMS selection flow.

Based on START-command-flow.md specification.
Allows users to switch active trail via conversational SMS.
"""

import logging
from typing import Optional, Tuple, List
from dataclasses import dataclass

from app.models.trail_selection import (
    SelectionState, TrailSelectionSession, trail_selection_store
)
from app.models.account import account_store, Account
from app.models.custom_route import (
    custom_route_store, route_library_store,
    CustomRoute, RouteLibrary
)

logger = logging.getLogger(__name__)

# Constants from spec
TRAILS_PER_PAGE = 5
SESSION_TIMEOUT_MINUTES = 30


@dataclass
class TrailInfo:
    """Unified trail info for display."""
    id: int
    name: str
    country: Optional[str] = None  # For library trails
    waypoint_count: int = 0
    typical_days: Optional[str] = None


class TrailSelectionService:
    """
    State machine for SMS trail selection.

    Flow:
    1. START received
    2. If user has saved trails: show main menu (My Trails / Library)
    3. If user has no saved trails: skip to library
    4. User navigates with numbers, 0 for more pages
    5. Selecting a trail sets active_trail_id
    """

    def __init__(self):
        self.session_store = trail_selection_store

    def start_selection(self, phone: str, account: Account) -> str:
        """
        Begin trail selection flow for a registered user.

        Returns the first response message.
        """
        logger.info(f"Starting trail selection for phone={phone}, account_id={account.id}")

        # Get user's saved trails
        user_trails = custom_route_store.get_by_account_id(account.id)
        has_saved_trails = len(user_trails) > 0

        if has_saved_trails:
            # Show main menu
            logger.info(f"User has {len(user_trails)} saved trails, showing main menu")
            session = self.session_store.create(phone, SelectionState.MAIN_MENU)
            session.trail_ids = None  # Will be populated when entering a list
            return self._format_main_menu(account, len(user_trails))
        else:
            # Skip to library
            logger.info("User has no saved trails, jumping to library")
            library_trails = route_library_store.list_active()
            session = self.session_store.create(phone, SelectionState.LIBRARY)
            session.trail_ids = [t.id for t in library_trails]
            session.page = 0
            return self._format_library_list(library_trails, page=0, is_new_user=True)

    def process_input(self, phone: str, text: str, account: Account) -> Tuple[str, bool]:
        """
        Process user input during trail selection.

        Args:
            phone: User's phone number
            text: User's SMS input
            account: User's account

        Returns:
            (response_message, is_complete)
            is_complete=True means selection is done, clear session
        """
        session = self.session_store.get(phone)

        if not session:
            # Session expired or doesn't exist
            logger.warning(f"Session expired or not found for phone={phone}")
            return "Session expired. Send START to select a trail.", False

        text = text.strip()
        logger.info(f"Processing input: phone={phone}, state={session.state}, text='{text}'")

        # Refresh session on interaction
        session.refresh_expiry()

        if session.state == SelectionState.MAIN_MENU:
            return self._handle_main_menu(session, text, account)
        elif session.state == SelectionState.MY_TRAILS:
            return self._handle_my_trails(session, text, account)
        elif session.state == SelectionState.LIBRARY:
            return self._handle_library(session, text, account)

        return "Something went wrong. Send START to try again.", False

    def _handle_main_menu(self, session: TrailSelectionSession, text: str, account: Account) -> Tuple[str, bool]:
        """Handle input when showing main menu."""
        if text == "1":
            # Go to My Trails
            logger.info(f"User selected My Trails (state transition: MAIN_MENU -> MY_TRAILS)")
            user_trails = custom_route_store.get_by_account_id(account.id)
            session.state = SelectionState.MY_TRAILS
            session.trail_ids = [t.id for t in user_trails]
            session.page = 0
            self.session_store.update(session.phone, state=session.state, trail_ids=session.trail_ids, page=0)
            return self._format_my_trails_list(user_trails, page=0), False

        elif text == "2":
            # Go to Library
            logger.info(f"User selected Library (state transition: MAIN_MENU -> LIBRARY)")
            library_trails = route_library_store.list_active()
            session.state = SelectionState.LIBRARY
            session.trail_ids = [t.id for t in library_trails]
            session.page = 0
            self.session_store.update(session.phone, state=session.state, trail_ids=session.trail_ids, page=0)
            return self._format_library_list(library_trails, page=0), False

        else:
            return "Reply 1 or 2", False

    def _handle_my_trails(self, session: TrailSelectionSession, text: str, account: Account) -> Tuple[str, bool]:
        """Handle input when showing user's trails."""
        user_trails = custom_route_store.get_by_account_id(account.id)
        total_trails = len(user_trails)
        total_pages = (total_trails + TRAILS_PER_PAGE - 1) // TRAILS_PER_PAGE

        if text == "0":
            # Next page
            session.page = (session.page + 1) % total_pages
            logger.info(f"Pagination: advancing to page {session.page} of {total_pages}")
            self.session_store.update(session.phone, page=session.page)
            return self._format_my_trails_list(user_trails, session.page), False

        # Try to parse as trail selection
        try:
            selection = int(text)
            # Selection is 1-indexed display number
            if 1 <= selection <= total_trails:
                trail_index = selection - 1
                selected_trail = user_trails[trail_index]
                logger.info(f"User selected trail: id={selected_trail.id}, name='{selected_trail.name}'")
                return self._select_trail(account, selected_trail.id, selected_trail.name, session)
            else:
                valid_max = min(total_trails, (session.page + 1) * TRAILS_PER_PAGE)
                valid_min = session.page * TRAILS_PER_PAGE + 1
                return f"Reply {valid_min}-{valid_max} to select a trail, or 0 for more options.", False
        except ValueError:
            return f"Reply 1-{total_trails} to select, or 0 for more.", False

    def _handle_library(self, session: TrailSelectionSession, text: str, account: Account) -> Tuple[str, bool]:
        """Handle input when showing library trails."""
        library_trails = route_library_store.list_active()
        total_trails = len(library_trails)
        total_pages = (total_trails + TRAILS_PER_PAGE - 1) // TRAILS_PER_PAGE

        if text == "0":
            # Next page
            next_page = session.page + 1
            if next_page >= total_pages:
                # Wrap around or stay on last
                next_page = 0
            logger.info(f"Pagination: advancing to page {next_page} of {total_pages}")
            session.page = next_page
            self.session_store.update(session.phone, page=session.page)
            return self._format_library_list(library_trails, session.page), False

        # Try to parse as trail selection
        try:
            selection = int(text)
            if 1 <= selection <= total_trails:
                trail_index = selection - 1
                selected_trail = library_trails[trail_index]
                logger.info(f"User selected library trail: id={selected_trail.id}, name='{selected_trail.name}'")

                # For library trails, we need to create/find user's copy
                # or just set active to library trail directly
                # Per spec: "If selecting from library (not already saved), optionally add to user's saved trails"
                # For v1: Just set active trail ID to the library trail ID
                # This means we're treating library trails as usable directly

                return self._select_trail(
                    account,
                    selected_trail.id,
                    selected_trail.name,
                    session,
                    is_library=True,
                    typical_days=selected_trail.typical_days
                )
            else:
                # Calculate valid range for current page
                page_start = session.page * TRAILS_PER_PAGE + 1
                page_end = min(total_trails, (session.page + 1) * TRAILS_PER_PAGE)
                return f"Reply {page_start}-{page_end} to select, or 0 for more.", False
        except ValueError:
            page_start = session.page * TRAILS_PER_PAGE + 1
            page_end = min(total_trails, (session.page + 1) * TRAILS_PER_PAGE)
            return f"Reply {page_start}-{page_end} to select, or 0 for more.", False

    def _select_trail(
        self,
        account: Account,
        trail_id: int,
        trail_name: str,
        session: TrailSelectionSession,
        is_library: bool = False,
        typical_days: Optional[str] = None
    ) -> Tuple[str, bool]:
        """
        Set the selected trail as active and return confirmation.

        Returns (message, is_complete=True)
        """
        # Set active trail
        logger.info(f"Setting active trail: account_id={account.id}, trail_id={trail_id}")
        account_store.set_active_trail(account.id, trail_id)

        # Clear session
        self.session_store.delete(session.phone)
        logger.info(f"Trail selection complete, session cleared for phone={session.phone}")

        # Get waypoint counts for display
        waypoint_info = self._get_waypoint_info(trail_id, is_library)

        # Format confirmation per spec
        return self._format_confirmation(trail_name, waypoint_info, typical_days), True

    def _get_waypoint_info(self, trail_id: int, is_library: bool) -> dict:
        """Get waypoint counts for trail."""
        # For now, return placeholder - will integrate with actual waypoint queries
        # In a real implementation, query custom_waypoints for the trail
        return {
            "camps": 0,
            "peaks": 0,
            "pois": 0
        }

    # =========================================================================
    # Message Formatting (per spec character limits)
    # =========================================================================

    def _format_main_menu(self, account: Account, trail_count: int) -> str:
        """Format main menu message (~60 chars target)."""
        # Get first name or use "back" as fallback
        name = "back"  # Default for returning users
        return (
            f"Welcome {name}!\n"
            f"1. My Trails ({trail_count})\n"
            f"2. Trail Library\n"
            f"Reply 1 or 2"
        )

    def _format_my_trails_list(self, trails: List[CustomRoute], page: int) -> str:
        """Format user's trails list with pagination."""
        total = len(trails)
        start_idx = page * TRAILS_PER_PAGE
        end_idx = min(start_idx + TRAILS_PER_PAGE, total)
        page_trails = trails[start_idx:end_idx]

        lines = ["Your trails:"]
        for i, trail in enumerate(page_trails):
            display_num = start_idx + i + 1
            name = self._truncate_name(trail.name, 20)
            lines.append(f"{display_num}. {name}")

        # Add "More" if there are more pages
        if end_idx < total:
            lines.append("0. More ->")

        # Add instructions
        if end_idx < total:
            lines.append(f"Reply 1-{end_idx} or 0")
        else:
            lines.append(f"Reply 1-{total} to select")

        return "\n".join(lines)

    def _format_library_list(self, trails: List[RouteLibrary], page: int, is_new_user: bool = False) -> str:
        """Format library trails list with pagination."""
        if not trails:
            return "No trails available. Create one at thunderbird.bot"

        total = len(trails)
        start_idx = page * TRAILS_PER_PAGE
        end_idx = min(start_idx + TRAILS_PER_PAGE, total)
        page_trails = trails[start_idx:end_idx]

        if is_new_user and page == 0:
            lines = ["Welcome to Thunderbird!", "Trail Library:"]
        elif page == 0:
            lines = ["Trail Library:"]
        else:
            lines = ["More trails:"]

        for i, trail in enumerate(page_trails):
            display_num = start_idx + i + 1
            name = self._truncate_name(trail.name, 20)
            country = f" ({trail.country})" if trail.country else ""
            lines.append(f"{display_num}. {name}{country}")

        # Add "More" if there are more pages
        if end_idx < total:
            lines.append("0. More ->")

        # Add instructions
        page_start = start_idx + 1
        page_end = end_idx
        if end_idx < total:
            lines.append(f"Reply {page_start}-{page_end} or 0")
        else:
            lines.append(f"Reply {page_start}-{page_end}")

        return "\n".join(lines)

    def _format_confirmation(self, trail_name: str, waypoint_info: dict, typical_days: Optional[str] = None) -> str:
        """Format selection confirmation message (~150 chars target)."""
        lines = [f"Active: {trail_name}"]

        # Add stats if available
        stats_parts = []
        if waypoint_info.get("camps"):
            stats_parts.append(f"{waypoint_info['camps']} camps")
        if waypoint_info.get("peaks"):
            stats_parts.append(f"{waypoint_info['peaks']} peaks")
        if typical_days:
            stats_parts.append(typical_days)

        if stats_parts:
            lines.append(", ".join(stats_parts))

        lines.append("")
        lines.append("Commands:")
        lines.append("CAST12 <code> - 12hr forecast")
        lines.append("CAST7 CAMPS - 7-day overview")
        lines.append("ROUTE - list waypoint codes")

        return "\n".join(lines)

    def _truncate_name(self, name: str, max_len: int) -> str:
        """Truncate name with ellipsis if too long."""
        if len(name) <= max_len:
            return name
        return name[:max_len - 3] + "..."


# Singleton instance
_trail_selection_service: Optional[TrailSelectionService] = None


def get_trail_selection_service() -> TrailSelectionService:
    """Get or create singleton TrailSelectionService."""
    global _trail_selection_service
    if _trail_selection_service is None:
        _trail_selection_service = TrailSelectionService()
    return _trail_selection_service
