"""
Beta application model for access requests.

Users apply for beta access via the website. Admins approve/reject.
On approval, an account is created with $50 USD credit.
"""
import os
import sqlite3
from datetime import datetime
from dataclasses import dataclass
from typing import Optional, List
from contextlib import contextmanager


DB_PATH = os.environ.get("THUNDERBIRD_DB_PATH", "thunderbird.db")

# Supported countries for beta (full names)
SUPPORTED_COUNTRIES = [
    "Australia",
    "New Zealand",
    "United States",
    "United Kingdom",
    "Canada",
    "Germany",
    "France",
    "Japan",
    "South Korea",
]

# Country code to full name mapping
COUNTRY_CODE_MAP = {
    "AU": "Australia",
    "NZ": "New Zealand",
    "US": "United States",
    "UK": "United Kingdom",
    "GB": "United Kingdom",  # Alternative code
    "CA": "Canada",
    "DE": "Germany",
    "FR": "France",
    "JP": "Japan",
    "KR": "South Korea",
}


def normalize_country(country: str) -> str:
    """
    Normalize country input to full country name.

    Accepts:
    - Full country names: "Australia", "New Zealand", etc.
    - ISO country codes: "AU", "NZ", "US", etc.

    Returns:
        Full country name if valid, original input if not found

    Examples:
        >>> normalize_country("AU")
        "Australia"
        >>> normalize_country("Australia")
        "Australia"
        >>> normalize_country("au")
        "Australia"
    """
    country_clean = country.strip()

    # Check if it's already a full name (case-insensitive)
    for supported in SUPPORTED_COUNTRIES:
        if country_clean.lower() == supported.lower():
            return supported

    # Check if it's a country code (case-insensitive)
    country_upper = country_clean.upper()
    if country_upper in COUNTRY_CODE_MAP:
        return COUNTRY_CODE_MAP[country_upper]

    # Return original if not found (will fail validation later)
    return country_clean


@dataclass
class BetaApplication:
    """
    Beta access application.

    Attributes:
        id: Primary key
        name: Applicant's name
        email: Applicant's email (unique)
        country: Country of residence
        status: pending/approved/rejected
        account_id: Linked account ID (populated on approval)
        admin_notes: Optional notes from admin
        created_at: Application timestamp
        reviewed_at: When admin reviewed
    """
    id: int
    name: str
    email: str
    country: str
    status: str = "pending"
    account_id: Optional[int] = None
    admin_notes: Optional[str] = None
    created_at: Optional[str] = None
    reviewed_at: Optional[str] = None


class BetaApplicationStore:
    """
    SQLite-backed beta application storage.

    Follows the same patterns as AccountStore.
    """

    def __init__(self, db_path: str = None):
        self.db_path = db_path or DB_PATH
        self._init_db()

    def _init_db(self):
        """Initialize database and create tables if needed."""
        import logging
        logger = logging.getLogger(__name__)

        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='beta_applications'"
            )
            if not cursor.fetchone():
                logger.warning("beta_applications table not found. Creating for backwards compatibility.")
                self._create_tables_legacy(conn)
            conn.commit()

    def _create_tables_legacy(self, conn):
        """Legacy table creation for backwards compatibility and tests."""
        conn.execute("""
            CREATE TABLE IF NOT EXISTS beta_applications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                country TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                account_id INTEGER,
                admin_notes TEXT,
                created_at TEXT NOT NULL,
                reviewed_at TEXT
            )
        """)
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_beta_applications_email ON beta_applications(email)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_beta_applications_status ON beta_applications(status)")

    @contextmanager
    def _get_connection(self):
        """Get database connection with row factory."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def _row_to_application(self, row) -> BetaApplication:
        """Convert a database row to BetaApplication."""
        return BetaApplication(
            id=row["id"],
            name=row["name"],
            email=row["email"],
            country=row["country"],
            status=row["status"],
            account_id=row["account_id"],
            admin_notes=row["admin_notes"],
            created_at=row["created_at"],
            reviewed_at=row["reviewed_at"],
        )

    def create(self, name: str, email: str, country: str) -> BetaApplication:
        """
        Create a new beta application.

        Args:
            name: Applicant name
            email: Applicant email (must be unique)
            country: Country of residence

        Returns:
            Created BetaApplication

        Raises:
            sqlite3.IntegrityError: If email already exists
        """
        now = datetime.utcnow().isoformat()

        with self._get_connection() as conn:
            cursor = conn.execute(
                """INSERT INTO beta_applications (name, email, country, status, created_at)
                   VALUES (?, ?, ?, 'pending', ?)""",
                (name.strip(), email.lower().strip(), country, now)
            )
            conn.commit()

            return BetaApplication(
                id=cursor.lastrowid,
                name=name.strip(),
                email=email.lower().strip(),
                country=country,
                status="pending",
                created_at=now,
            )

    def get_by_email(self, email: str) -> Optional[BetaApplication]:
        """Get application by email address."""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM beta_applications WHERE email = ?",
                (email.lower().strip(),)
            )
            row = cursor.fetchone()
            if row:
                return self._row_to_application(row)
            return None

    def get_by_id(self, application_id: int) -> Optional[BetaApplication]:
        """Get application by ID."""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM beta_applications WHERE id = ?",
                (application_id,)
            )
            row = cursor.fetchone()
            if row:
                return self._row_to_application(row)
            return None

    def list_all(self, status_filter: Optional[str] = None) -> List[BetaApplication]:
        """
        List all applications, optionally filtered by status.

        Args:
            status_filter: Optional status to filter by (pending/approved/rejected)

        Returns:
            List of applications, pending first, then by creation date desc
        """
        with self._get_connection() as conn:
            if status_filter:
                cursor = conn.execute(
                    """SELECT * FROM beta_applications
                       WHERE status = ?
                       ORDER BY created_at DESC""",
                    (status_filter,)
                )
            else:
                cursor = conn.execute(
                    """SELECT * FROM beta_applications
                       ORDER BY
                         CASE status
                           WHEN 'pending' THEN 0
                           WHEN 'approved' THEN 1
                           WHEN 'rejected' THEN 2
                         END,
                         created_at DESC"""
                )
            return [self._row_to_application(row) for row in cursor.fetchall()]

    def update_status(
        self,
        application_id: int,
        status: str,
        account_id: Optional[int] = None,
        admin_notes: Optional[str] = None
    ) -> bool:
        """
        Update application status.

        Args:
            application_id: Application to update
            status: New status (approved/rejected)
            account_id: Account ID if approved
            admin_notes: Optional admin notes

        Returns:
            True if updated, False if not found
        """
        now = datetime.utcnow().isoformat()

        with self._get_connection() as conn:
            cursor = conn.execute(
                """UPDATE beta_applications
                   SET status = ?, account_id = ?, admin_notes = ?, reviewed_at = ?
                   WHERE id = ?""",
                (status, account_id, admin_notes, now, application_id)
            )
            conn.commit()
            return cursor.rowcount > 0


# Singleton instance
beta_application_store = BetaApplicationStore()
