"""
Affiliate models for Thunderbird Global.

Handles affiliate tracking, commissions, attribution, and click analytics.
All monetary values stored as INTEGER cents to avoid floating-point precision issues.
"""
import os
import sqlite3
from datetime import datetime, timedelta
from dataclasses import dataclass
from typing import Optional, List
from contextlib import contextmanager


DB_PATH = os.environ.get("THUNDERBIRD_DB_PATH", "thunderbird.db")


@dataclass
class Affiliate:
    """
    Affiliate record for partner tracking.

    Attributes:
        id: Primary key
        code: Unique affiliate code (uppercase, e.g., "PARTNER")
        name: Affiliate name
        email: Affiliate email
        discount_percent: Discount percentage for customers (default 0)
        commission_percent: Commission percentage for affiliate (default 20)
        trailing_months: Months to track recurring commissions (None = forever)
        payout_method: "paypal" | "bank" | None
        payout_details: JSON blob with PayPal email or bank details
        active: Whether affiliate is active
        created_at: Creation timestamp
    """
    id: int
    code: str
    name: str
    email: str
    discount_percent: int = 0
    commission_percent: int = 20
    trailing_months: Optional[int] = None
    payout_method: Optional[str] = None
    payout_details: Optional[str] = None
    active: bool = True
    created_at: Optional[datetime] = None


@dataclass
class Commission:
    """
    Commission record for affiliate earnings.

    Commissions start as "pending" for 30 days (chargeback window),
    then become "available" for payout.

    Attributes:
        id: Primary key
        affiliate_id: Foreign key to affiliates
        account_id: Foreign key to accounts
        order_id: Foreign key to orders
        amount_cents: Commission amount in cents
        status: "pending" | "available" | "requested" | "paid" | "clawed_back"
        sub_id: Campaign tracking ID (optional)
        created_at: Creation timestamp
        available_at: When commission becomes available (created_at + 30 days)
        paid_at: When commission was paid (if status = "paid")
    """
    id: int
    affiliate_id: int
    account_id: int
    order_id: int
    amount_cents: int
    status: str = "pending"
    sub_id: Optional[str] = None
    created_at: Optional[datetime] = None
    available_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None


@dataclass
class Attribution:
    """
    Attribution record linking accounts to affiliates.

    One attribution per account (tracks which affiliate referred them).
    Supports trailing attribution (expires after N months if configured).

    Attributes:
        id: Primary key
        affiliate_id: Foreign key to affiliates
        account_id: Foreign key to accounts (unique - one affiliate per account)
        order_id: Initial order that created attribution
        sub_id: Campaign tracking ID (optional)
        trailing_expires_at: When attribution expires (None = forever)
        created_at: Creation timestamp
    """
    id: int
    affiliate_id: int
    account_id: int
    order_id: int
    sub_id: Optional[str] = None
    trailing_expires_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


@dataclass
class AffiliateClick:
    """
    Click tracking record for affiliate analytics.

    Tracks clicks on affiliate links with session deduplication.

    Attributes:
        id: Primary key
        affiliate_id: Foreign key to affiliates
        sub_id: Campaign tracking ID (optional)
        session_id: Session ID for 24h deduplication (optional)
        created_at: Click timestamp
    """
    id: int
    affiliate_id: int
    sub_id: Optional[str] = None
    session_id: Optional[str] = None
    created_at: Optional[datetime] = None


class AffiliateStore:
    """SQLite-backed affiliate storage."""

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

    def _row_to_affiliate(self, row: sqlite3.Row) -> Affiliate:
        """Convert database row to Affiliate object."""
        return Affiliate(
            id=row["id"],
            code=row["code"],
            name=row["name"],
            email=row["email"],
            discount_percent=row["discount_percent"],
            commission_percent=row["commission_percent"],
            trailing_months=row["trailing_months"],
            payout_method=row["payout_method"],
            payout_details=row["payout_details"],
            active=bool(row["active"]),
            created_at=datetime.fromisoformat(row["created_at"]) if row["created_at"] else None
        )

    def create(
        self,
        code: str,
        name: str,
        email: str,
        discount_percent: int = 0,
        commission_percent: int = 20,
        trailing_months: Optional[int] = None,
        payout_method: Optional[str] = None,
        payout_details: Optional[str] = None
    ) -> Affiliate:
        """
        Create a new affiliate.

        Args:
            code: Unique affiliate code (will be uppercased)
            name: Affiliate name
            email: Affiliate email
            discount_percent: Discount percentage for customers (0-100)
            commission_percent: Commission percentage for affiliate (0-100)
            trailing_months: Months to track recurring commissions (None = forever)
            payout_method: "paypal" or "bank"
            payout_details: JSON blob with payout details

        Returns:
            Created Affiliate object

        Raises:
            sqlite3.IntegrityError: If code already exists
        """
        now = datetime.utcnow().isoformat()
        code_upper = code.upper()

        with self._get_connection() as conn:
            cursor = conn.execute(
                """INSERT INTO affiliates
                   (code, name, email, discount_percent, commission_percent,
                    trailing_months, payout_method, payout_details, active, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (code_upper, name, email, discount_percent, commission_percent,
                 trailing_months, payout_method, payout_details, True, now)
            )
            conn.commit()

            return Affiliate(
                id=cursor.lastrowid,
                code=code_upper,
                name=name,
                email=email,
                discount_percent=discount_percent,
                commission_percent=commission_percent,
                trailing_months=trailing_months,
                payout_method=payout_method,
                payout_details=payout_details,
                active=True,
                created_at=datetime.fromisoformat(now)
            )

    def get_by_id(self, affiliate_id: int) -> Optional[Affiliate]:
        """Get affiliate by ID."""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM affiliates WHERE id = ?",
                (affiliate_id,)
            )
            row = cursor.fetchone()
            if row:
                return self._row_to_affiliate(row)
            return None

    def get_by_code(self, code: str) -> Optional[Affiliate]:
        """Get affiliate by code (case-insensitive)."""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM affiliates WHERE code = ?",
                (code.upper(),)
            )
            row = cursor.fetchone()
            if row:
                return self._row_to_affiliate(row)
            return None

    def list_all(self, active_only: bool = True) -> List[Affiliate]:
        """
        List all affiliates.

        Args:
            active_only: If True, only return active affiliates

        Returns:
            List of Affiliate objects
        """
        affiliates = []
        with self._get_connection() as conn:
            if active_only:
                cursor = conn.execute(
                    "SELECT * FROM affiliates WHERE active = 1 ORDER BY created_at DESC"
                )
            else:
                cursor = conn.execute(
                    "SELECT * FROM affiliates ORDER BY created_at DESC"
                )
            for row in cursor:
                affiliates.append(self._row_to_affiliate(row))
        return affiliates

    def update(
        self,
        affiliate_id: int,
        **kwargs
    ) -> bool:
        """
        Update affiliate fields.

        Args:
            affiliate_id: Affiliate to update
            **kwargs: Fields to update (name, email, discount_percent, etc.)

        Returns:
            True if updated, False if affiliate not found
        """
        allowed_fields = {
            'name', 'email', 'discount_percent', 'commission_percent',
            'trailing_months', 'payout_method', 'payout_details', 'active'
        }

        updates = {k: v for k, v in kwargs.items() if k in allowed_fields}
        if not updates:
            return False

        # Handle code separately (needs uppercasing)
        if 'code' in kwargs:
            updates['code'] = kwargs['code'].upper()

        set_clause = ", ".join(f"{k} = ?" for k in updates.keys())
        values = list(updates.values()) + [affiliate_id]

        with self._get_connection() as conn:
            cursor = conn.execute(
                f"UPDATE affiliates SET {set_clause} WHERE id = ?",
                values
            )
            conn.commit()
            return cursor.rowcount > 0

    def deactivate(self, affiliate_id: int) -> bool:
        """
        Deactivate an affiliate.

        Args:
            affiliate_id: Affiliate to deactivate

        Returns:
            True if deactivated, False if affiliate not found
        """
        return self.update(affiliate_id, active=False)


class CommissionStore:
    """SQLite-backed commission storage."""

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

    def _row_to_commission(self, row: sqlite3.Row) -> Commission:
        """Convert database row to Commission object."""
        return Commission(
            id=row["id"],
            affiliate_id=row["affiliate_id"],
            account_id=row["account_id"],
            order_id=row["order_id"],
            amount_cents=row["amount_cents"],
            status=row["status"],
            sub_id=row["sub_id"],
            created_at=datetime.fromisoformat(row["created_at"]) if row["created_at"] else None,
            available_at=datetime.fromisoformat(row["available_at"]) if row["available_at"] else None,
            paid_at=datetime.fromisoformat(row["paid_at"]) if row["paid_at"] else None
        )

    def create(
        self,
        affiliate_id: int,
        account_id: int,
        order_id: int,
        amount_cents: int,
        sub_id: Optional[str] = None
    ) -> Commission:
        """
        Create a new commission record.

        Args:
            affiliate_id: Affiliate earning the commission
            account_id: Account that generated the commission
            order_id: Order that generated the commission
            amount_cents: Commission amount in cents
            sub_id: Campaign tracking ID

        Returns:
            Created Commission object
        """
        now = datetime.utcnow()
        created_at_iso = now.isoformat()
        available_at = now + timedelta(days=30)
        available_at_iso = available_at.isoformat()

        with self._get_connection() as conn:
            cursor = conn.execute(
                """INSERT INTO commissions
                   (affiliate_id, account_id, order_id, amount_cents, status,
                    sub_id, created_at, available_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (affiliate_id, account_id, order_id, amount_cents, "pending",
                 sub_id, created_at_iso, available_at_iso)
            )
            conn.commit()

            return Commission(
                id=cursor.lastrowid,
                affiliate_id=affiliate_id,
                account_id=account_id,
                order_id=order_id,
                amount_cents=amount_cents,
                status="pending",
                sub_id=sub_id,
                created_at=now,
                available_at=available_at,
                paid_at=None
            )

    def get_by_affiliate_id(
        self,
        affiliate_id: int,
        status: Optional[str] = None
    ) -> List[Commission]:
        """
        Get commissions for an affiliate.

        Args:
            affiliate_id: Affiliate ID
            status: Filter by status (None = all statuses)

        Returns:
            List of Commission objects
        """
        commissions = []
        with self._get_connection() as conn:
            if status:
                cursor = conn.execute(
                    """SELECT * FROM commissions
                       WHERE affiliate_id = ? AND status = ?
                       ORDER BY created_at DESC""",
                    (affiliate_id, status)
                )
            else:
                cursor = conn.execute(
                    """SELECT * FROM commissions
                       WHERE affiliate_id = ?
                       ORDER BY created_at DESC""",
                    (affiliate_id,)
                )
            for row in cursor:
                commissions.append(self._row_to_commission(row))
        return commissions

    def get_pending(self) -> List[Commission]:
        """Get all pending commissions (for batch processing to mark available)."""
        commissions = []
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM commissions WHERE status = 'pending' ORDER BY created_at"
            )
            for row in cursor:
                commissions.append(self._row_to_commission(row))
        return commissions

    def mark_available(self, commission_id: int) -> bool:
        """
        Mark a commission as available for payout.

        Args:
            commission_id: Commission to mark available

        Returns:
            True if updated, False if commission not found
        """
        with self._get_connection() as conn:
            cursor = conn.execute(
                "UPDATE commissions SET status = 'available' WHERE id = ?",
                (commission_id,)
            )
            conn.commit()
            return cursor.rowcount > 0

    def mark_requested(self, commission_id: int) -> bool:
        """
        Mark a commission as requested (affiliate requested payout).

        Args:
            commission_id: Commission to mark requested

        Returns:
            True if updated, False if commission not found
        """
        with self._get_connection() as conn:
            cursor = conn.execute(
                "UPDATE commissions SET status = 'requested' WHERE id = ?",
                (commission_id,)
            )
            conn.commit()
            return cursor.rowcount > 0

    def mark_paid(self, commission_id: int) -> bool:
        """
        Mark a commission as paid.

        Args:
            commission_id: Commission to mark paid

        Returns:
            True if updated, False if commission not found
        """
        now = datetime.utcnow().isoformat()
        with self._get_connection() as conn:
            cursor = conn.execute(
                "UPDATE commissions SET status = 'paid', paid_at = ? WHERE id = ?",
                (now, commission_id)
            )
            conn.commit()
            return cursor.rowcount > 0

    def clawback(self, commission_id: int) -> bool:
        """
        Clawback a commission (e.g., due to refund).

        Args:
            commission_id: Commission to clawback

        Returns:
            True if updated, False if commission not found
        """
        with self._get_connection() as conn:
            cursor = conn.execute(
                "UPDATE commissions SET status = 'clawed_back' WHERE id = ?",
                (commission_id,)
            )
            conn.commit()
            return cursor.rowcount > 0


class AttributionStore:
    """SQLite-backed attribution storage."""

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

    def _row_to_attribution(self, row: sqlite3.Row) -> Attribution:
        """Convert database row to Attribution object."""
        return Attribution(
            id=row["id"],
            affiliate_id=row["affiliate_id"],
            account_id=row["account_id"],
            order_id=row["order_id"],
            sub_id=row["sub_id"],
            trailing_expires_at=datetime.fromisoformat(row["trailing_expires_at"]) if row["trailing_expires_at"] else None,
            created_at=datetime.fromisoformat(row["created_at"]) if row["created_at"] else None
        )

    def create(
        self,
        affiliate_id: int,
        account_id: int,
        order_id: int,
        sub_id: Optional[str] = None,
        trailing_months: Optional[int] = None
    ) -> Attribution:
        """
        Create a new attribution record.

        Args:
            affiliate_id: Affiliate to attribute to
            account_id: Account being attributed
            order_id: Initial order that created attribution
            sub_id: Campaign tracking ID
            trailing_months: Months until attribution expires (None = forever)

        Returns:
            Created Attribution object

        Raises:
            sqlite3.IntegrityError: If account already has attribution
        """
        now = datetime.utcnow()
        created_at_iso = now.isoformat()

        trailing_expires_at_iso = None
        trailing_expires_at_dt = None
        if trailing_months is not None:
            trailing_expires_at_dt = now + timedelta(days=trailing_months * 30)
            trailing_expires_at_iso = trailing_expires_at_dt.isoformat()

        with self._get_connection() as conn:
            cursor = conn.execute(
                """INSERT INTO affiliate_attributions
                   (affiliate_id, account_id, order_id, sub_id, trailing_expires_at, created_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (affiliate_id, account_id, order_id, sub_id, trailing_expires_at_iso, created_at_iso)
            )
            conn.commit()

            return Attribution(
                id=cursor.lastrowid,
                affiliate_id=affiliate_id,
                account_id=account_id,
                order_id=order_id,
                sub_id=sub_id,
                trailing_expires_at=trailing_expires_at_dt,
                created_at=now
            )

    def get_by_account_id(self, account_id: int) -> Optional[Attribution]:
        """
        Get attribution for an account.

        Args:
            account_id: Account ID

        Returns:
            Attribution object if exists, None otherwise
        """
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM affiliate_attributions WHERE account_id = ?",
                (account_id,)
            )
            row = cursor.fetchone()
            if row:
                return self._row_to_attribution(row)
            return None

    def get_active_attribution(self, account_id: int) -> Optional[Attribution]:
        """
        Get active attribution for an account (checks expiry).

        Args:
            account_id: Account ID

        Returns:
            Attribution object if active, None if expired or doesn't exist
        """
        attribution = self.get_by_account_id(account_id)
        if not attribution:
            return None

        # If no expiry, always active
        if attribution.trailing_expires_at is None:
            return attribution

        # Check if expired
        if datetime.utcnow() > attribution.trailing_expires_at:
            return None

        return attribution


class ClickStore:
    """SQLite-backed click tracking storage."""

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

    def _row_to_click(self, row: sqlite3.Row) -> AffiliateClick:
        """Convert database row to AffiliateClick object."""
        return AffiliateClick(
            id=row["id"],
            affiliate_id=row["affiliate_id"],
            sub_id=row["sub_id"],
            session_id=row["session_id"],
            created_at=datetime.fromisoformat(row["created_at"]) if row["created_at"] else None
        )

    def create(
        self,
        affiliate_id: int,
        sub_id: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> AffiliateClick:
        """
        Create a new click record.

        Args:
            affiliate_id: Affiliate whose link was clicked
            sub_id: Campaign tracking ID
            session_id: Session ID for deduplication

        Returns:
            Created AffiliateClick object
        """
        now = datetime.utcnow().isoformat()

        with self._get_connection() as conn:
            cursor = conn.execute(
                """INSERT INTO affiliate_clicks
                   (affiliate_id, sub_id, session_id, created_at)
                   VALUES (?, ?, ?, ?)""",
                (affiliate_id, sub_id, session_id, now)
            )
            conn.commit()

            return AffiliateClick(
                id=cursor.lastrowid,
                affiliate_id=affiliate_id,
                sub_id=sub_id,
                session_id=session_id,
                created_at=datetime.fromisoformat(now)
            )

    def count_by_affiliate(self, affiliate_id: int) -> int:
        """
        Count total clicks for an affiliate.

        Args:
            affiliate_id: Affiliate ID

        Returns:
            Total click count
        """
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT COUNT(*) as count FROM affiliate_clicks WHERE affiliate_id = ?",
                (affiliate_id,)
            )
            row = cursor.fetchone()
            return row["count"] if row else 0

    def count_by_date_range(
        self,
        affiliate_id: int,
        start_date: datetime,
        end_date: datetime
    ) -> int:
        """
        Count clicks for an affiliate within a date range.

        Args:
            affiliate_id: Affiliate ID
            start_date: Start of range (inclusive)
            end_date: End of range (inclusive)

        Returns:
            Click count in range
        """
        start_iso = start_date.isoformat()
        end_iso = end_date.isoformat()

        with self._get_connection() as conn:
            cursor = conn.execute(
                """SELECT COUNT(*) as count FROM affiliate_clicks
                   WHERE affiliate_id = ? AND created_at >= ? AND created_at <= ?""",
                (affiliate_id, start_iso, end_iso)
            )
            row = cursor.fetchone()
            return row["count"] if row else 0


# Singleton instances
affiliate_store = AffiliateStore()
commission_store = CommissionStore()
attribution_store = AttributionStore()
click_store = ClickStore()
