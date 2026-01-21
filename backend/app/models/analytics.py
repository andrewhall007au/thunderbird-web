"""
Analytics event model for tracking user behavior.

Stores events from the frontend analytics utilities (app/lib/analytics.ts).
Used for conversion funnel analysis and A/B testing.

All events include:
- event name (page_view, purchase_completed, etc.)
- A/B variant assignment
- entry path (create, buy, organic)
- optional properties blob
"""
import json
import os
import sqlite3
from datetime import datetime
from dataclasses import dataclass
from typing import Optional, Dict, Any, List
from contextlib import contextmanager


DB_PATH = os.environ.get("THUNDERBIRD_DB_PATH", "thunderbird.db")


@dataclass
class AnalyticsEvent:
    """
    Analytics event record.

    Attributes:
        id: Primary key
        event: Event name (e.g., 'page_view', 'purchase_completed')
        variant: A/B test variant ('A' or 'B')
        entry_path: How user entered (create, buy, organic)
        properties: JSON blob of additional event data
        account_id: Linked account if user is logged in
        created_at: Event timestamp
    """
    id: int
    event: str
    variant: Optional[str] = None
    entry_path: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None
    account_id: Optional[int] = None
    created_at: Optional[datetime] = None


class AnalyticsStore:
    """SQLite-backed analytics event storage."""

    def __init__(self, db_path: str = None):
        self.db_path = db_path or DB_PATH
        self._init_db()

    @contextmanager
    def _get_connection(self):
        """Get database connection with row factory."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def _init_db(self):
        """Initialize analytics_events table if it doesn't exist."""
        with self._get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS analytics_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event TEXT NOT NULL,
                    variant TEXT,
                    entry_path TEXT,
                    properties TEXT,
                    account_id INTEGER,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)
            # Index for querying by event type
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_analytics_event
                ON analytics_events(event)
            """)
            # Index for date range queries
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_analytics_created
                ON analytics_events(created_at)
            """)
            # Index for conversion analysis by path
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_analytics_path
                ON analytics_events(entry_path, event)
            """)
            conn.commit()

    def _row_to_event(self, row: sqlite3.Row) -> AnalyticsEvent:
        """Convert database row to AnalyticsEvent object."""
        properties = None
        if row["properties"]:
            try:
                properties = json.loads(row["properties"])
            except json.JSONDecodeError:
                properties = None

        return AnalyticsEvent(
            id=row["id"],
            event=row["event"],
            variant=row["variant"],
            entry_path=row["entry_path"],
            properties=properties,
            account_id=row["account_id"],
            created_at=datetime.fromisoformat(row["created_at"]) if row["created_at"] else None
        )

    def create(
        self,
        event: str,
        variant: Optional[str] = None,
        entry_path: Optional[str] = None,
        properties: Optional[Dict[str, Any]] = None,
        account_id: Optional[int] = None
    ) -> AnalyticsEvent:
        """
        Create a new analytics event.

        Args:
            event: Event name (e.g., 'page_view', 'purchase_completed')
            variant: A/B test variant ('A' or 'B')
            entry_path: User entry path ('create', 'buy', 'organic')
            properties: Additional event properties (will be JSON encoded)
            account_id: Associated account ID if user is logged in

        Returns:
            Created AnalyticsEvent object
        """
        now = datetime.utcnow().isoformat()
        properties_json = json.dumps(properties) if properties else None

        with self._get_connection() as conn:
            cursor = conn.execute(
                """INSERT INTO analytics_events
                   (event, variant, entry_path, properties, account_id, created_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (event, variant, entry_path, properties_json, account_id, now)
            )
            conn.commit()

            return AnalyticsEvent(
                id=cursor.lastrowid,
                event=event,
                variant=variant,
                entry_path=entry_path,
                properties=properties,
                account_id=account_id,
                created_at=datetime.fromisoformat(now)
            )

    def get_conversion_by_path(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Dict[str, int]]:
        """
        Get conversion metrics grouped by entry path.

        Returns counts of key events (page_view, checkout_started, purchase_completed)
        for each entry path (create, buy, organic).

        Args:
            start_date: Start of date range (inclusive)
            end_date: End of date range (inclusive)

        Returns:
            Dict with structure:
            {
                'create': {'page_view': 100, 'checkout_started': 50, 'purchase_completed': 25},
                'buy': {'page_view': 80, 'checkout_started': 60, 'purchase_completed': 40},
                'organic': {'page_view': 200, 'checkout_started': 30, 'purchase_completed': 15}
            }
        """
        result = {
            'create': {'page_view': 0, 'checkout_started': 0, 'purchase_completed': 0},
            'buy': {'page_view': 0, 'checkout_started': 0, 'purchase_completed': 0},
            'organic': {'page_view': 0, 'checkout_started': 0, 'purchase_completed': 0}
        }

        query = """
            SELECT entry_path, event, COUNT(*) as count
            FROM analytics_events
            WHERE event IN ('page_view', 'checkout_started', 'purchase_completed')
            AND entry_path IN ('create', 'buy', 'organic')
        """
        params: List[Any] = []

        if start_date:
            query += " AND created_at >= ?"
            params.append(start_date.isoformat())
        if end_date:
            query += " AND created_at <= ?"
            params.append(end_date.isoformat())

        query += " GROUP BY entry_path, event"

        with self._get_connection() as conn:
            cursor = conn.execute(query, params)
            for row in cursor:
                path = row["entry_path"]
                event = row["event"]
                count = row["count"]
                if path in result and event in result[path]:
                    result[path][event] = count

        return result

    def get_variant_performance(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Dict[str, int]]:
        """
        Get A/B variant performance metrics.

        Returns counts of key events for each variant.

        Args:
            start_date: Start of date range (inclusive)
            end_date: End of date range (inclusive)

        Returns:
            Dict with structure:
            {
                'A': {'page_view': 150, 'checkout_started': 60, 'purchase_completed': 35},
                'B': {'page_view': 150, 'checkout_started': 80, 'purchase_completed': 45}
            }
        """
        result = {
            'A': {'page_view': 0, 'checkout_started': 0, 'purchase_completed': 0},
            'B': {'page_view': 0, 'checkout_started': 0, 'purchase_completed': 0}
        }

        query = """
            SELECT variant, event, COUNT(*) as count
            FROM analytics_events
            WHERE event IN ('page_view', 'checkout_started', 'purchase_completed')
            AND variant IN ('A', 'B')
        """
        params: List[Any] = []

        if start_date:
            query += " AND created_at >= ?"
            params.append(start_date.isoformat())
        if end_date:
            query += " AND created_at <= ?"
            params.append(end_date.isoformat())

        query += " GROUP BY variant, event"

        with self._get_connection() as conn:
            cursor = conn.execute(query, params)
            for row in cursor:
                variant = row["variant"]
                event = row["event"]
                count = row["count"]
                if variant in result and event in result[variant]:
                    result[variant][event] = count

        return result


# Singleton instance
analytics_store = AnalyticsStore()
