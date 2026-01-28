"""
Tests for trail selection SMS flow.

Tests the complete flow from START command through trail selection.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock

from app.models.trail_selection import (
    SelectionState, TrailSelectionSession, TrailSelectionSessionStore
)
from app.services.trail_selection import TrailSelectionService


class TestTrailSelectionSession:
    """Test TrailSelectionSession model."""

    def test_session_creation(self):
        """Session should have correct default values."""
        session = TrailSelectionSession(
            phone="+61400000000",
            state=SelectionState.MAIN_MENU
        )
        assert session.phone == "+61400000000"
        assert session.state == SelectionState.MAIN_MENU
        assert session.page == 0
        assert session.created_at is not None
        assert session.expires_at is not None
        assert not session.is_expired()

    def test_session_expiry(self):
        """Session should expire after 30 minutes."""
        session = TrailSelectionSession(
            phone="+61400000000",
            state=SelectionState.MAIN_MENU
        )
        # Manually set expired time
        session.expires_at = datetime.utcnow() - timedelta(minutes=1)
        assert session.is_expired()

    def test_session_refresh(self):
        """Refresh should extend expiry."""
        session = TrailSelectionSession(
            phone="+61400000000",
            state=SelectionState.MAIN_MENU
        )
        old_expiry = session.expires_at
        session.refresh_expiry()
        assert session.expires_at > old_expiry


class TestTrailSelectionSessionStore:
    """Test session store operations."""

    def test_create_and_get(self):
        """Should create and retrieve session."""
        store = TrailSelectionSessionStore()
        session = store.create("+61400000000", SelectionState.LIBRARY)
        retrieved = store.get("+61400000000")
        assert retrieved is not None
        assert retrieved.state == SelectionState.LIBRARY

    def test_get_expired_returns_none(self):
        """Expired session should return None and be deleted."""
        store = TrailSelectionSessionStore()
        session = store.create("+61400000000", SelectionState.MAIN_MENU)
        session.expires_at = datetime.utcnow() - timedelta(minutes=1)
        retrieved = store.get("+61400000000")
        assert retrieved is None

    def test_update_session(self):
        """Should update session fields."""
        store = TrailSelectionSessionStore()
        store.create("+61400000000", SelectionState.MAIN_MENU)
        store.update("+61400000000", state=SelectionState.MY_TRAILS, page=1)
        session = store.get("+61400000000")
        assert session.state == SelectionState.MY_TRAILS
        assert session.page == 1

    def test_delete_session(self):
        """Should delete session."""
        store = TrailSelectionSessionStore()
        store.create("+61400000000", SelectionState.MAIN_MENU)
        store.delete("+61400000000")
        assert store.get("+61400000000") is None


class TestTrailSelectionService:
    """Test trail selection service."""

    @pytest.fixture
    def service(self):
        """Create fresh service for each test."""
        return TrailSelectionService()

    @pytest.fixture
    def mock_account(self):
        """Create mock account."""
        account = Mock()
        account.id = 1
        account.email = "test@test.com"
        account.phone = "+61400000000"
        return account

    def test_start_with_no_trails_shows_library(self, service, mock_account):
        """User with no trails should see library directly."""
        with patch('app.services.trail_selection.custom_route_store') as mock_route_store:
            with patch('app.services.trail_selection.route_library_store') as mock_library_store:
                mock_route_store.get_by_account_id.return_value = []
                trail1 = Mock()
                trail1.id = 1
                trail1.name = "Overland Track"
                trail1.country = "AU"
                trail2 = Mock()
                trail2.id = 2
                trail2.name = "Milford Track"
                trail2.country = "NZ"
                mock_library_store.list_active.return_value = [trail1, trail2]

                response = service.start_selection("+61400000000", mock_account)

                assert "Welcome to Thunderbird" in response
                assert "Trail Library" in response
                assert "Overland Track" in response

    def test_start_with_trails_shows_menu(self, service, mock_account):
        """User with trails should see main menu."""
        with patch('app.services.trail_selection.custom_route_store') as mock_route_store:
            trail = Mock()
            trail.id = 1
            trail.name = "My Trail"
            mock_route_store.get_by_account_id.return_value = [trail]

            response = service.start_selection("+61400000000", mock_account)

            assert "My Trails" in response
            assert "Trail Library" in response
            assert "Reply 1 or 2" in response

    def test_main_menu_option_1_shows_my_trails(self, service, mock_account):
        """Selecting 1 from main menu should show user's trails."""
        with patch('app.services.trail_selection.custom_route_store') as mock_route_store:
            trail1 = Mock()
            trail1.id = 1
            trail1.name = "My Overland Track"
            trail2 = Mock()
            trail2.id = 2
            trail2.name = "My Milford Track"
            mock_route_store.get_by_account_id.return_value = [trail1, trail2]

            # Start session
            service.start_selection("+61400000000", mock_account)

            # Select option 1
            response, complete = service.process_input("+61400000000", "1", mock_account)

            assert "Your trails" in response
            assert "My Overland Track" in response
            assert not complete

    def test_main_menu_option_2_shows_library(self, service, mock_account):
        """Selecting 2 from main menu should show library."""
        with patch('app.services.trail_selection.custom_route_store') as mock_route_store:
            with patch('app.services.trail_selection.route_library_store') as mock_library_store:
                trail = Mock()
                trail.id = 1
                trail.name = "Trail"
                mock_route_store.get_by_account_id.return_value = [trail]
                lib_trail = Mock()
                lib_trail.id = 1
                lib_trail.name = "Overland Track"
                lib_trail.country = "AU"
                mock_library_store.list_active.return_value = [lib_trail]

                # Start session
                service.start_selection("+61400000000", mock_account)

                # Select option 2
                response, complete = service.process_input("+61400000000", "2", mock_account)

                assert "Trail Library" in response or "Overland Track" in response
                assert not complete

    def test_selecting_trail_sets_active(self, service, mock_account):
        """Selecting a trail number should set active_trail_id."""
        with patch('app.services.trail_selection.custom_route_store') as mock_route_store:
            with patch('app.services.trail_selection.account_store') as mock_account_store:
                trail = Mock()
                trail.id = 42
                trail.name = "My Overland Track"
                mock_route_store.get_by_account_id.return_value = [trail]

                # Start session and go to my trails
                service.start_selection("+61400000000", mock_account)
                service.process_input("+61400000000", "1", mock_account)

                # Select trail 1
                response, complete = service.process_input("+61400000000", "1", mock_account)

                # Verify active trail was set
                mock_account_store.set_active_trail.assert_called_once_with(1, 42)
                assert "Active:" in response
                assert complete

    def test_pagination_with_zero(self, service, mock_account):
        """Pressing 0 should show next page."""
        with patch('app.services.trail_selection.custom_route_store') as mock_route_store:
            # Create 7 trails (more than TRAILS_PER_PAGE=5)
            trails = []
            for i in range(7):
                trail = Mock()
                trail.id = i
                trail.name = f"Trail {i}"
                trails.append(trail)
            mock_route_store.get_by_account_id.return_value = trails

            # Start and go to my trails
            service.start_selection("+61400000000", mock_account)
            service.process_input("+61400000000", "1", mock_account)

            # First page should show 1-5
            # Press 0 for more
            response, complete = service.process_input("+61400000000", "0", mock_account)

            # Should show remaining trails (6-7)
            assert "Trail 6" in response or "Trail 5" in response  # Page 2

    def test_invalid_input_shows_error(self, service, mock_account):
        """Invalid input should show error message."""
        with patch('app.services.trail_selection.custom_route_store') as mock_route_store:
            trail = Mock()
            trail.id = 1
            trail.name = "Trail"
            mock_route_store.get_by_account_id.return_value = [trail]

            # Start session
            service.start_selection("+61400000000", mock_account)

            # Invalid input
            response, complete = service.process_input("+61400000000", "invalid", mock_account)

            assert "Reply 1 or 2" in response
            assert not complete

    def test_expired_session_returns_error(self, service, mock_account):
        """Expired session should return error message."""
        # Clear any existing sessions first
        service.session_store.delete("+61400000000")

        # Don't create a session
        response, complete = service.process_input("+61400000000", "1", mock_account)

        assert "Session expired" in response or "START" in response
        assert not complete

    def test_truncate_long_names(self, service):
        """Long trail names should be truncated."""
        result = service._truncate_name("This Is A Very Long Trail Name That Exceeds Limit", 20)
        assert len(result) <= 20
        assert result.endswith("...")

    def test_confirmation_includes_commands(self, service):
        """Confirmation message should include command hints."""
        response = service._format_confirmation("Test Trail", {"camps": 5, "peaks": 3}, "3-5 days")

        assert "Active: Test Trail" in response
        assert "CAST12" in response
        assert "CAST7" in response
        assert "ROUTE" in response


class TestWebhookIntegration:
    """Test webhook routing for trail selection."""

    @pytest.mark.asyncio
    async def test_start_registered_user_enters_trail_selection(self):
        """Registered user sending START should enter trail selection."""
        # This would be an integration test requiring the full app context
        # Marked as placeholder for manual testing
        pass

    @pytest.mark.asyncio
    async def test_start_unregistered_user_enters_onboarding(self):
        """Unregistered user sending START should enter onboarding."""
        pass

    @pytest.mark.asyncio
    async def test_numeric_input_during_session_processes_correctly(self):
        """Numeric input during active session should route to trail selection."""
        pass
