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
        created_at: Account creation timestamp
        updated_at: Last modification timestamp
    """
    id: int
    email: str
    password_hash: str
    phone: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class AccountStore:
    """
    SQLite-backed account storage.

    Follows the same patterns as SQLiteUserStore from database.py.
    """

    def __init__(self, db_path: str = None):
        self.db_path = db_path or DB_PATH

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
                    created_at=datetime.fromisoformat(row["created_at"]) if row["created_at"] else None,
                    updated_at=datetime.fromisoformat(row["updated_at"]) if row["updated_at"] else None
                )
            return None

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


# Singleton instance
account_store = AccountStore()
