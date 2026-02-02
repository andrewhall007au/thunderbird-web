"""
Account model for web authentication.

IMPORTANT: Account is for web login (email/password).
This is DISTINCT from User which is for SMS hikers.
They will be linked via phone number in FOUN-05.
"""
import os
import sqlite3
from datetime import datetime
from dataclasses import dataclass
from typing import Optional
from contextlib import contextmanager


DB_PATH = os.environ.get("THUNDERBIRD_DB_PATH", "thunderbird.db")


@dataclass
class Account:
    """
    Web account for authentication.

    Attributes:
        id: Primary key
        email: Unique email address
        password_hash: Argon2 hashed password
        phone: Optional linked phone number (for connecting to SMS User)
        stripe_customer_id: Stripe customer ID for stored card payments
        unit_system: Preferred units - "metric" (Celsius, meters) or "imperial" (Fahrenheit, feet)
        active_trail_id: Currently active trail for SMS commands (references custom_routes.id)
        created_at: Account creation timestamp
        updated_at: Last modification timestamp
    """
    id: int
    email: str
    password_hash: str
    phone: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    unit_system: str = "metric"  # "metric" or "imperial"
    active_trail_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class AccountStore:
    """
    SQLite-backed account storage.

    Follows the same patterns as SQLiteUserStore from database.py.
    """

    def __init__(self, db_path: str = None):
        self.db_path = db_path or DB_PATH
        self._init_db()

    def _init_db(self):
        """
        Initialize database and create tables if needed.

        Note: Schema is managed by Alembic migrations in production.
        This method provides backwards compatibility and test support.
        """
        import logging
        logger = logging.getLogger(__name__)

        with self._get_connection() as conn:
            # Check if accounts table exists
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='accounts'"
            )
            if not cursor.fetchone():
                logger.warning(
                    "accounts table not found. Creating for backwards compatibility. "
                    "Run 'alembic upgrade head' to initialize schema properly."
                )
                self._create_tables_legacy(conn)
            conn.commit()

    def _create_tables_legacy(self, conn):
        """
        Legacy table creation for backwards compatibility and tests.
        New installations should use `alembic upgrade head` instead.
        """
        conn.execute("""
            CREATE TABLE IF NOT EXISTS accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                phone TEXT,
                stripe_customer_id TEXT,
                unit_system TEXT DEFAULT 'metric',
                active_trail_id INTEGER,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_accounts_email ON accounts(email)")
        conn.execute("CREATE INDEX IF NOT EXISTS ix_accounts_active_trail_id ON accounts(active_trail_id)")

    @contextmanager
    def _get_connection(self):
        """Get database connection with row factory."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def create(self, email: str, password_hash: str) -> Account:
        """
        Create a new account.

        Args:
            email: Account email (must be unique)
            password_hash: Pre-hashed password (use auth.hash_password)

        Returns:
            Created Account object

        Raises:
            sqlite3.IntegrityError: If email already exists
        """
        now = datetime.utcnow().isoformat()

        with self._get_connection() as conn:
            cursor = conn.execute(
                """INSERT INTO accounts (email, password_hash, created_at, updated_at)
                   VALUES (?, ?, ?, ?)""",
                (email.lower(), password_hash, now, now)
            )
            conn.commit()

            return Account(
                id=cursor.lastrowid,
                email=email.lower(),
                password_hash=password_hash,
                phone=None,
                active_trail_id=None,
                created_at=datetime.fromisoformat(now),
                updated_at=datetime.fromisoformat(now)
            )

    def get_by_email(self, email: str) -> Optional[Account]:
        """
        Get account by email address.

        Args:
            email: Email to look up (case-insensitive)

        Returns:
            Account if found, None otherwise
        """
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM accounts WHERE email = ?",
                (email.lower(),)
            )
            row = cursor.fetchone()

            if row:
                return Account(
                    id=row["id"],
                    email=row["email"],
                    password_hash=row["password_hash"],
                    phone=row["phone"],
                    stripe_customer_id=row["stripe_customer_id"] if "stripe_customer_id" in row.keys() else None,
                    unit_system=row["unit_system"] if "unit_system" in row.keys() and row["unit_system"] else "metric",
                    active_trail_id=row["active_trail_id"] if "active_trail_id" in row.keys() else None,
                    created_at=datetime.fromisoformat(row["created_at"]) if row["created_at"] else None,
                    updated_at=datetime.fromisoformat(row["updated_at"]) if row["updated_at"] else None
                )
            return None

    def get_by_id(self, account_id: int) -> Optional[Account]:
        """Get account by ID."""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM accounts WHERE id = ?",
                (account_id,)
            )
            row = cursor.fetchone()

            if row:
                return Account(
                    id=row["id"],
                    email=row["email"],
                    password_hash=row["password_hash"],
                    phone=row["phone"],
                    stripe_customer_id=row["stripe_customer_id"] if "stripe_customer_id" in row.keys() else None,
                    unit_system=row["unit_system"] if "unit_system" in row.keys() and row["unit_system"] else "metric",
                    active_trail_id=row["active_trail_id"] if "active_trail_id" in row.keys() else None,
                    created_at=datetime.fromisoformat(row["created_at"]) if row["created_at"] else None,
                    updated_at=datetime.fromisoformat(row["updated_at"]) if row["updated_at"] else None
                )
            return None

    def link_phone(self, account_id: int, phone: str) -> bool:
        """
        Link a phone number to an account.

        Used to connect web Account to SMS User.

        Args:
            account_id: Account to update
            phone: Phone number to link (normalized format)

        Returns:
            True if updated, False if account not found
        """
        now = datetime.utcnow().isoformat()

        with self._get_connection() as conn:
            cursor = conn.execute(
                "UPDATE accounts SET phone = ?, updated_at = ? WHERE id = ?",
                (phone, now, account_id)
            )
            conn.commit()
            return cursor.rowcount > 0

    def get_by_phone(self, phone: str) -> Optional[Account]:
        """
        Get account by linked phone number.

        Args:
            phone: Normalized phone number (+61...)

        Returns:
            Account if found, None otherwise
        """
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM accounts WHERE phone = ?",
                (phone,)
            )
            row = cursor.fetchone()

            if row:
                return Account(
                    id=row["id"],
                    email=row["email"],
                    password_hash=row["password_hash"],
                    phone=row["phone"],
                    stripe_customer_id=row["stripe_customer_id"] if "stripe_customer_id" in row.keys() else None,
                    unit_system=row["unit_system"] if "unit_system" in row.keys() and row["unit_system"] else "metric",
                    active_trail_id=row["active_trail_id"] if "active_trail_id" in row.keys() else None,
                    created_at=datetime.fromisoformat(row["created_at"]) if row["created_at"] else None,
                    updated_at=datetime.fromisoformat(row["updated_at"]) if row["updated_at"] else None
                )
            return None

    def update_unit_system(self, account_id: int, unit_system: str) -> bool:
        """
        Update unit system preference for an account.

        Args:
            account_id: Account ID to update
            unit_system: "metric" (Celsius, meters) or "imperial" (Fahrenheit, feet)

        Returns:
            True if updated, False if account not found
        """
        if unit_system not in ("metric", "imperial"):
            raise ValueError("unit_system must be 'metric' or 'imperial'")

        now = datetime.utcnow().isoformat()

        with self._get_connection() as conn:
            cursor = conn.execute(
                "UPDATE accounts SET unit_system = ?, updated_at = ? WHERE id = ?",
                (unit_system, now, account_id)
            )
            conn.commit()
            return cursor.rowcount > 0

    def update_unit_system_by_phone(self, phone: str, unit_system: str) -> bool:
        """
        Update unit system preference by phone number.

        Used by SMS UNITS command.

        Args:
            phone: Normalized phone number (+61...)
            unit_system: "metric" or "imperial"

        Returns:
            True if updated, False if account not found
        """
        if unit_system not in ("metric", "imperial"):
            raise ValueError("unit_system must be 'metric' or 'imperial'")

        now = datetime.utcnow().isoformat()

        with self._get_connection() as conn:
            cursor = conn.execute(
                "UPDATE accounts SET unit_system = ?, updated_at = ? WHERE phone = ?",
                (unit_system, now, phone)
            )
            conn.commit()
            return cursor.rowcount > 0

    def update_stripe_customer_id(self, account_id: int, stripe_customer_id: str) -> bool:
        """
        Save Stripe customer ID for stored card payments.

        Called by Stripe webhook when checkout completes.
        Enables future off-session payments with saved card.

        Args:
            account_id: Account ID to update
            stripe_customer_id: Stripe customer ID (cus_xxx)

        Returns:
            True if updated, False if account not found
        """
        now = datetime.utcnow().isoformat()

        with self._get_connection() as conn:
            cursor = conn.execute(
                "UPDATE accounts SET stripe_customer_id = ?, updated_at = ? WHERE id = ?",
                (stripe_customer_id, now, account_id)
            )
            conn.commit()
            return cursor.rowcount > 0

    def get_stripe_customer_id(self, account_id: int) -> Optional[str]:
        """
        Get Stripe customer ID for an account.

        Args:
            account_id: Account ID

        Returns:
            Stripe customer ID if set, None otherwise
        """
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT stripe_customer_id FROM accounts WHERE id = ?",
                (account_id,)
            )
            row = cursor.fetchone()
            if row:
                return row["stripe_customer_id"]
            return None


    def update_password(self, email: str, password_hash: str) -> bool:
        """
        Update password for an account.

        Args:
            email: Account email
            password_hash: New hashed password

        Returns:
            True if updated, False if account not found
        """
        now = datetime.utcnow().isoformat()

        with self._get_connection() as conn:
            cursor = conn.execute(
                "UPDATE accounts SET password_hash = ?, updated_at = ? WHERE email = ?",
                (password_hash, now, email.lower())
            )
            conn.commit()
            return cursor.rowcount > 0

    def set_active_trail(self, account_id: int, trail_id: Optional[int]) -> bool:
        """
        Set the active trail for an account. Pass None to clear.

        Args:
            account_id: Account ID to update
            trail_id: Trail ID to set as active, or None to clear

        Returns:
            True if updated, False if account not found
        """
        now = datetime.utcnow().isoformat()
        with self._get_connection() as conn:
            cursor = conn.execute(
                "UPDATE accounts SET active_trail_id = ?, updated_at = ? WHERE id = ?",
                (trail_id, now, account_id)
            )
            conn.commit()
            return cursor.rowcount > 0

    def get_active_trail_id(self, account_id: int) -> Optional[int]:
        """
        Get the active trail ID for an account.

        Args:
            account_id: Account ID

        Returns:
            Active trail ID if set, None otherwise
        """
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT active_trail_id FROM accounts WHERE id = ?",
                (account_id,)
            )
            row = cursor.fetchone()
            return row["active_trail_id"] if row else None


# Singleton instance
account_store = AccountStore()
