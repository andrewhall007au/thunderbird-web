"""
Thunderbird Database Models
SQLite-based persistent storage
"""

import sqlite3
import os
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict
from dataclasses import dataclass, field
from contextlib import contextmanager

# Database file location - can be overridden by environment variable
DB_PATH = os.environ.get("THUNDERBIRD_DB_PATH", "thunderbird.db")


@dataclass
class SafeCheckContact:
    """Emergency contact for SafeCheck alerts."""
    phone: str
    name: str


@dataclass
class User:
    """User data model. v3.0: start_date/end_date are optional (pull-based system)."""
    phone: str
    route_id: str
    start_date: Optional[date] = None  # v3.0: Optional, no longer collected
    end_date: Optional[date] = None    # v3.0: Optional, no longer collected
    trail_name: str = None
    direction: str = "standard"
    current_position: str = None
    last_checkin_at: datetime = None
    status: str = "registered"
    safecheck_contacts: List[SafeCheckContact] = field(default_factory=list)


# Alias for backwards compatibility
InMemoryUser = User


class SQLiteUserStore:
    """SQLite-based persistent user store."""
    
    def __init__(self, db_path: str = None):
        self.db_path = db_path or DB_PATH
        self._init_db()
    
    def _init_db(self):
        """Initialize database tables."""
        with self._get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    phone TEXT PRIMARY KEY,
                    route_id TEXT NOT NULL,
                    start_date TEXT,
                    end_date TEXT,
                    trail_name TEXT,
                    direction TEXT DEFAULT 'standard',
                    current_position TEXT,
                    last_checkin_at TEXT,
                    status TEXT DEFAULT 'registered',
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS safecheck_contacts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_phone TEXT NOT NULL,
                    contact_phone TEXT NOT NULL,
                    contact_name TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_phone) REFERENCES users(phone) ON DELETE CASCADE,
                    UNIQUE(user_phone, contact_phone)
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS message_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_phone TEXT,
                    direction TEXT NOT NULL,
                    message_type TEXT,
                    command_type TEXT,
                    content TEXT,
                    segments INTEGER DEFAULT 1,
                    cost_aud REAL DEFAULT 0,
                    sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    success INTEGER DEFAULT 1
                )
            """)
            # Add indexes for analytics queries
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_message_log_sent_at ON message_log(sent_at)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_message_log_user ON message_log(user_phone)
            """)

            # Migrate: add missing columns to message_log if they don't exist
            self._migrate_message_log(conn)
            conn.commit()

    def _migrate_message_log(self, conn):
        """Add missing columns to message_log table for analytics."""
        # Get existing columns
        cursor = conn.execute("PRAGMA table_info(message_log)")
        existing_columns = {row[1] for row in cursor.fetchall()}

        # Add missing columns
        migrations = [
            ("command_type", "TEXT"),
            ("cost_aud", "REAL DEFAULT 0"),
            ("success", "INTEGER DEFAULT 1"),
        ]

        for col_name, col_type in migrations:
            if col_name not in existing_columns:
                try:
                    conn.execute(f"ALTER TABLE message_log ADD COLUMN {col_name} {col_type}")
                except Exception:
                    pass  # Column might already exist

    @contextmanager
    def _get_connection(self):
        """Get database connection with row factory."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    def _row_to_user(self, row: sqlite3.Row, contacts: List[SafeCheckContact] = None) -> User:
        """Convert database row to User object. v3.0: handles optional dates."""
        return User(
            phone=row["phone"],
            route_id=row["route_id"],
            start_date=date.fromisoformat(row["start_date"]) if row["start_date"] else None,
            end_date=date.fromisoformat(row["end_date"]) if row["end_date"] else None,
            trail_name=row["trail_name"],
            direction=row["direction"] or "standard",
            current_position=row["current_position"],
            last_checkin_at=datetime.fromisoformat(row["last_checkin_at"]) if row["last_checkin_at"] else None,
            status=row["status"] or "registered",
            safecheck_contacts=contacts or []
        )
    
    def _get_contacts_for_user(self, conn, phone: str) -> List[SafeCheckContact]:
        """Get SafeCheck contacts for a user."""
        cursor = conn.execute(
            "SELECT contact_phone, contact_name FROM safecheck_contacts WHERE user_phone = ?",
            (phone,)
        )
        return [SafeCheckContact(phone=row["contact_phone"], name=row["contact_name"]) for row in cursor]
    
    def create_user(
        self,
        phone: str,
        route_id: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        direction: str = "standard",
        trail_name: str = None
    ) -> User:
        """Create or update a user. v3.0: start_date/end_date are optional."""
        with self._get_connection() as conn:
            conn.execute("""
                INSERT INTO users (phone, route_id, start_date, end_date, direction, trail_name, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(phone) DO UPDATE SET
                    route_id = excluded.route_id,
                    start_date = excluded.start_date,
                    end_date = excluded.end_date,
                    direction = excluded.direction,
                    trail_name = excluded.trail_name,
                    updated_at = excluded.updated_at
            """, (
                phone,
                route_id,
                start_date.isoformat() if start_date else None,
                end_date.isoformat() if end_date else None,
                direction,
                trail_name,
                datetime.now().isoformat()
            ))
            conn.commit()

        return User(
            phone=phone,
            route_id=route_id,
            start_date=start_date,
            end_date=end_date,
            direction=direction,
            trail_name=trail_name
        )
    
    def get_user(self, phone: str) -> Optional[User]:
        """Get user by phone number."""
        with self._get_connection() as conn:
            cursor = conn.execute("SELECT * FROM users WHERE phone = ?", (phone,))
            row = cursor.fetchone()
            if row:
                contacts = self._get_contacts_for_user(conn, phone)
                return self._row_to_user(row, contacts)
        return None
    
    def delete_user(self, phone: str) -> bool:
        """Delete user by phone number."""
        with self._get_connection() as conn:
            # Delete contacts first (foreign key)
            conn.execute("DELETE FROM safecheck_contacts WHERE user_phone = ?", (phone,))
            cursor = conn.execute("DELETE FROM users WHERE phone = ?", (phone,))
            conn.commit()
            return cursor.rowcount > 0
    
    def list_users(self) -> List[User]:
        """List all users."""
        users = []
        with self._get_connection() as conn:
            cursor = conn.execute("SELECT * FROM users ORDER BY created_at DESC")
            for row in cursor:
                contacts = self._get_contacts_for_user(conn, row["phone"])
                users.append(self._row_to_user(row, contacts))
        return users
    
    def get_active_users(self) -> List[User]:
        """Get users with active trips (between start and end date)."""
        users = []
        today = date.today().isoformat()
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM users WHERE start_date <= ? AND end_date >= ?",
                (today, today)
            )
            for row in cursor:
                contacts = self._get_contacts_for_user(conn, row["phone"])
                users.append(self._row_to_user(row, contacts))
        return users
    
    def update_position(self, phone: str, camp_code: str) -> bool:
        """Update user's current position and checkin time."""
        now = datetime.now().isoformat()
        with self._get_connection() as conn:
            cursor = conn.execute(
                "UPDATE users SET current_position = ?, last_checkin_at = ?, updated_at = ? WHERE phone = ?",
                (camp_code, now, now, phone)
            )
            conn.commit()
            return cursor.rowcount > 0
    
    def add_safecheck_contact(self, phone: str, contact_phone: str, contact_name: str) -> bool:
        """Add a SafeCheck emergency contact (max 10)."""
        with self._get_connection() as conn:
            # Check current count
            cursor = conn.execute(
                "SELECT COUNT(*) as count FROM safecheck_contacts WHERE user_phone = ?",
                (phone,)
            )
            count = cursor.fetchone()["count"]

            if count >= 10:
                # Check if this is an update to existing contact
                cursor = conn.execute(
                    "SELECT id FROM safecheck_contacts WHERE user_phone = ? AND contact_phone = ?",
                    (phone, contact_phone)
                )
                if not cursor.fetchone():
                    return False  # Already at max and not updating existing
            
            # Insert or update
            conn.execute("""
                INSERT INTO safecheck_contacts (user_phone, contact_phone, contact_name)
                VALUES (?, ?, ?)
                ON CONFLICT(user_phone, contact_phone) DO UPDATE SET
                    contact_name = excluded.contact_name
            """, (phone, contact_phone, contact_name))
            conn.commit()
            return True
    
    def remove_safecheck_contact(self, phone: str, contact_phone: str) -> bool:
        """Remove a SafeCheck contact."""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "DELETE FROM safecheck_contacts WHERE user_phone = ? AND contact_phone = ?",
                (phone, contact_phone)
            )
            conn.commit()
            return cursor.rowcount > 0
    
    def get_safecheck_contacts(self, phone: str) -> List[SafeCheckContact]:
        """Get all SafeCheck contacts for a user."""
        with self._get_connection() as conn:
            return self._get_contacts_for_user(conn, phone)
    
    def log_message(
        self,
        user_phone: str,
        direction: str,
        message_type: str,
        content: str,
        segments: int = 1,
        command_type: str = None,
        cost_aud: float = None,
        success: bool = True
    ):
        """Log an SMS message with cost tracking."""
        # Calculate cost if not provided (AU SMS ~$0.055/segment)
        if cost_aud is None:
            cost_aud = segments * 0.055 if direction == 'outbound' else 0

        with self._get_connection() as conn:
            conn.execute("""
                INSERT INTO message_log (user_phone, direction, message_type, command_type, content, segments, cost_aud, success)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (user_phone, direction, message_type, command_type, content, segments, cost_aud, 1 if success else 0))
            conn.commit()

    def get_today_stats(self) -> Dict:
        """Get today's SMS statistics."""
        today = date.today().isoformat()
        with self._get_connection() as conn:
            cursor = conn.execute("""
                SELECT
                    COUNT(*) as message_count,
                    COALESCE(SUM(segments), 0) as total_segments,
                    COALESCE(SUM(cost_aud), 0) as total_cost,
                    COALESCE(SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END), 0) as failed_count
                FROM message_log
                WHERE direction = 'outbound' AND date(sent_at) = ?
            """, (today,))
            row = cursor.fetchone()
            return {
                "message_count": row["message_count"] or 0,
                "total_segments": row["total_segments"] or 0,
                "total_cost": round(row["total_cost"] or 0, 2),
                "failed_count": row["failed_count"] or 0
            }

    def get_month_stats(self) -> Dict:
        """Get current month's SMS statistics."""
        month_start = date.today().replace(day=1).isoformat()
        with self._get_connection() as conn:
            cursor = conn.execute("""
                SELECT
                    COUNT(*) as message_count,
                    COALESCE(SUM(segments), 0) as total_segments,
                    COALESCE(SUM(cost_aud), 0) as total_cost,
                    COALESCE(SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END), 0) as failed_count
                FROM message_log
                WHERE direction = 'outbound' AND date(sent_at) >= ?
            """, (month_start,))
            row = cursor.fetchone()
            return {
                "message_count": row["message_count"] or 0,
                "total_segments": row["total_segments"] or 0,
                "total_cost": round(row["total_cost"] or 0, 2),
                "failed_count": row["failed_count"] or 0
            }

    def get_command_breakdown(self, days: int = 30) -> List[Dict]:
        """Get breakdown of SMS usage by command type."""
        cutoff = (date.today() - timedelta(days=days)).isoformat()
        with self._get_connection() as conn:
            cursor = conn.execute("""
                SELECT
                    COALESCE(command_type, 'OTHER') as command,
                    COUNT(*) as message_count,
                    COALESCE(SUM(segments), 0) as total_segments,
                    COALESCE(SUM(cost_aud), 0) as total_cost
                FROM message_log
                WHERE direction = 'outbound' AND date(sent_at) >= ?
                GROUP BY command_type
                ORDER BY total_segments DESC
            """, (cutoff,))
            return [
                {
                    "command": row["command"],
                    "message_count": row["message_count"],
                    "total_segments": row["total_segments"],
                    "total_cost": round(row["total_cost"], 2)
                }
                for row in cursor
            ]

    def get_user_usage(self, phone: str) -> Dict:
        """Get SMS usage statistics for a specific user."""
        with self._get_connection() as conn:
            cursor = conn.execute("""
                SELECT
                    COUNT(*) as message_count,
                    COALESCE(SUM(segments), 0) as total_segments,
                    COALESCE(SUM(cost_aud), 0) as total_cost,
                    MAX(sent_at) as last_activity
                FROM message_log
                WHERE user_phone = ? AND direction = 'outbound'
            """, (phone,))
            row = cursor.fetchone()
            return {
                "message_count": row["message_count"] or 0,
                "total_segments": row["total_segments"] or 0,
                "total_cost": round(row["total_cost"] or 0, 2),
                "last_activity": row["last_activity"]
            }

    def get_all_users_usage(self) -> List[Dict]:
        """Get SMS usage for all users."""
        with self._get_connection() as conn:
            cursor = conn.execute("""
                SELECT
                    user_phone,
                    COUNT(*) as message_count,
                    COALESCE(SUM(segments), 0) as total_segments,
                    COALESCE(SUM(cost_aud), 0) as total_cost,
                    MAX(sent_at) as last_activity
                FROM message_log
                WHERE direction = 'outbound' AND user_phone IS NOT NULL
                GROUP BY user_phone
                ORDER BY total_segments DESC
            """)
            return [
                {
                    "phone": row["user_phone"],
                    "message_count": row["message_count"],
                    "total_segments": row["total_segments"],
                    "total_cost": round(row["total_cost"], 2),
                    "last_activity": row["last_activity"]
                }
                for row in cursor
            ]

    def get_daily_trend(self, days: int = 7) -> List[Dict]:
        """Get daily SMS statistics for trending."""
        cutoff = (date.today() - timedelta(days=days)).isoformat()
        with self._get_connection() as conn:
            cursor = conn.execute("""
                SELECT
                    date(sent_at) as day,
                    COUNT(*) as message_count,
                    COALESCE(SUM(segments), 0) as total_segments,
                    COALESCE(SUM(cost_aud), 0) as total_cost
                FROM message_log
                WHERE direction = 'outbound' AND date(sent_at) >= ?
                GROUP BY date(sent_at)
                ORDER BY day DESC
            """, (cutoff,))
            return [
                {
                    "day": row["day"],
                    "message_count": row["message_count"],
                    "total_segments": row["total_segments"],
                    "total_cost": round(row["total_cost"], 2)
                }
                for row in cursor
            ]

    def get_message_stats(self, phone: str = None) -> Dict:
        """Get message statistics (legacy method)."""
        with self._get_connection() as conn:
            if phone:
                cursor = conn.execute("""
                    SELECT
                        COUNT(*) as total_messages,
                        SUM(segments) as total_segments,
                        SUM(CASE WHEN direction = 'outbound' THEN segments ELSE 0 END) as outbound_segments
                    FROM message_log WHERE user_phone = ?
                """, (phone,))
            else:
                cursor = conn.execute("""
                    SELECT
                        COUNT(*) as total_messages,
                        SUM(segments) as total_segments,
                        SUM(CASE WHEN direction = 'outbound' THEN segments ELSE 0 END) as outbound_segments
                    FROM message_log
                """)
            row = cursor.fetchone()
            return {
                "total_messages": row["total_messages"] or 0,
                "total_segments": row["total_segments"] or 0,
                "outbound_segments": row["outbound_segments"] or 0
            }


# =============================================================================
# Global instance
# =============================================================================

# Use SQLite store
user_store = SQLiteUserStore()
