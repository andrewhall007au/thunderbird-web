"""
Tests for analytics model query functions.

Tests the conversion funnel and A/B variant reporting queries.
"""

import pytest
import tempfile
import os
from datetime import datetime, timedelta

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.models.analytics import AnalyticsStore


@pytest.fixture
def analytics_store():
    """Create a fresh analytics store with temp database for each test."""
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
        db_path = f.name

    store = AnalyticsStore(db_path=db_path)

    yield store

    # Cleanup
    os.unlink(db_path)


@pytest.fixture
def populated_store(analytics_store):
    """Create analytics store with sample data."""
    store = analytics_store
    now = datetime.utcnow()

    # Create path tracking data
    # Create path: 100 page views, 50 routes, 45 simulators, 20 checkouts, 10 purchases
    for i in range(100):
        store.create('page_view', variant='A' if i % 2 == 0 else 'B', entry_path='create')
    for i in range(50):
        store.create('route_created', variant='A' if i % 2 == 0 else 'B', entry_path='create')
    for i in range(45):
        store.create('simulator_viewed', variant='A' if i % 2 == 0 else 'B', entry_path='create')
    for i in range(20):
        store.create('checkout_started', variant='A' if i % 2 == 0 else 'B', entry_path='create')
    for i in range(10):
        store.create('purchase_completed', variant='A' if i % 2 == 0 else 'B', entry_path='create',
                    properties={'amount': 2999})

    # Buy path: 80 page views, 40 checkouts, 24 purchases
    for i in range(80):
        store.create('page_view', variant='A' if i % 2 == 0 else 'B', entry_path='buy')
    for i in range(40):
        store.create('checkout_started', variant='A' if i % 2 == 0 else 'B', entry_path='buy')
    for i in range(24):
        store.create('purchase_completed', variant='A' if i % 2 == 0 else 'B', entry_path='buy',
                    properties={'amount': 2999})

    # Organic path: 60 page views, 15 purchases
    for i in range(60):
        store.create('page_view', variant='A' if i % 2 == 0 else 'B', entry_path='organic')
    for i in range(15):
        store.create('purchase_completed', variant='A' if i % 2 == 0 else 'B', entry_path='organic',
                    properties={'amount': 2999})

    return store


class TestAnalyticsQueries:
    """Test analytics query functions."""

    def test_get_funnel_by_path_empty(self, analytics_store):
        """Test funnel query with no data."""
        result = analytics_store.get_funnel_by_path()

        assert 'create' in result
        assert 'buy' in result
        assert 'organic' in result

        # All values should be 0
        assert result['create']['page_views'] == 0
        assert result['create']['conversion_rate'] == 0.0

    def test_get_funnel_by_path_with_data(self, populated_store):
        """Test funnel query with sample data."""
        result = populated_store.get_funnel_by_path()

        # Create path
        assert result['create']['page_views'] == 100
        assert result['create']['routes_created'] == 50
        assert result['create']['simulators_viewed'] == 45
        assert result['create']['checkouts_started'] == 20
        assert result['create']['purchases_completed'] == 10
        assert result['create']['conversion_rate'] == 0.10  # 10/100

        # Buy path
        assert result['buy']['page_views'] == 80
        assert result['buy']['checkouts_started'] == 40
        assert result['buy']['purchases_completed'] == 24
        assert result['buy']['conversion_rate'] == 0.30  # 24/80

        # Organic path
        assert result['organic']['page_views'] == 60
        assert result['organic']['purchases_completed'] == 15
        assert result['organic']['conversion_rate'] == 0.25  # 15/60

    def test_get_conversion_by_variant_empty(self, analytics_store):
        """Test variant query with no data."""
        result = analytics_store.get_conversion_by_variant()

        assert 'A' in result
        assert 'B' in result
        assert result['A']['sessions'] == 0
        assert result['A']['purchases'] == 0
        assert result['A']['conversion_rate'] == 0.0
        assert result['A']['avg_revenue'] == 0

    def test_get_conversion_by_variant_with_data(self, populated_store):
        """Test variant query with sample data."""
        result = populated_store.get_conversion_by_variant()

        # Total page views: 100 + 80 + 60 = 240, split evenly between A and B
        assert result['A']['sessions'] == 120
        assert result['B']['sessions'] == 120

        # Total purchases: 10 + 24 + 15 = 49, split ~evenly
        # With alternating assignment: A gets 25, B gets 24
        assert result['A']['purchases'] == 25
        assert result['B']['purchases'] == 24

        # Conversion rates
        assert result['A']['conversion_rate'] == round(25/120, 4)
        assert result['B']['conversion_rate'] == round(24/120, 4)

        # Average revenue should be 2999 for both
        assert result['A']['avg_revenue'] == 2999
        assert result['B']['avg_revenue'] == 2999

    def test_get_daily_events_empty(self, analytics_store):
        """Test daily events query with no data."""
        result = analytics_store.get_daily_events()
        assert result == []

    def test_get_daily_events_with_data(self, populated_store):
        """Test daily events query with sample data."""
        result = populated_store.get_daily_events(event_type='purchase_completed')

        # All events were created today
        assert len(result) == 1
        date_str, count = result[0]

        # Should have today's date
        assert date_str == datetime.utcnow().strftime('%Y-%m-%d')

        # Total purchases: 10 + 24 + 15 = 49
        assert count == 49

    def test_get_daily_events_different_event(self, populated_store):
        """Test daily events query with different event type."""
        result = populated_store.get_daily_events(event_type='page_view')

        # All events were created today
        assert len(result) == 1
        _, count = result[0]

        # Total page views: 100 + 80 + 60 = 240
        assert count == 240

    def test_date_filtering(self, analytics_store):
        """Test that date filtering works correctly."""
        store = analytics_store

        # Create events at different times
        now = datetime.utcnow()
        yesterday = now - timedelta(days=1)
        last_week = now - timedelta(days=7)

        # These should be included in a query for last 3 days
        store.create('page_view', entry_path='create')
        store.create('purchase_completed', entry_path='create')

        # Query with date range
        result = store.get_funnel_by_path(
            start_date=yesterday,
            end_date=now + timedelta(days=1)
        )

        # Should see our events
        assert result['create']['page_views'] >= 1
        assert result['create']['purchases_completed'] >= 1


class TestAnalyticsCreate:
    """Test analytics event creation."""

    def test_create_event(self, analytics_store):
        """Test basic event creation."""
        event = analytics_store.create(
            event='page_view',
            variant='A',
            entry_path='create'
        )

        assert event.id is not None
        assert event.event == 'page_view'
        assert event.variant == 'A'
        assert event.entry_path == 'create'
        assert event.created_at is not None

    def test_create_event_with_properties(self, analytics_store):
        """Test event creation with properties."""
        event = analytics_store.create(
            event='purchase_completed',
            variant='B',
            entry_path='buy',
            properties={'amount': 2999, 'currency': 'USD'}
        )

        assert event.properties == {'amount': 2999, 'currency': 'USD'}

    def test_create_event_null_entry_path(self, analytics_store):
        """Test that NULL entry_path is handled as organic."""
        store = analytics_store

        # Create event without entry_path (organic)
        store.create('page_view', variant='A')
        store.create('purchase_completed', variant='A')

        result = store.get_funnel_by_path()

        # Should be counted under organic
        assert result['organic']['page_views'] >= 1
        assert result['organic']['purchases_completed'] >= 1


# Run tests with: pytest backend/tests/test_analytics.py -v
if __name__ == "__main__":
    pytest.main([__file__, "-v"])
