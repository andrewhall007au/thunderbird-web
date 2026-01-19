"""
Payment models for Thunderbird Global.

Handles orders, account balances, discount codes, transactions, and country SMS costs.
All monetary values stored as INTEGER cents to avoid floating-point precision issues.
"""
import os
import sqlite3
from datetime import datetime
from dataclasses import dataclass
from typing import Optional, List
from contextlib import contextmanager


DB_PATH = os.environ.get("THUNDERBIRD_DB_PATH", "thunderbird.db")


@dataclass
class Order:
    """
    Order record for purchases.

    Attributes:
        id: Primary key
        account_id: Foreign key to accounts table
        order_type: "initial_access" | "top_up"
        amount_cents: Amount charged in cents
        stripe_session_id: Stripe checkout session ID (for initial purchase)
        stripe_payment_intent_id: Stripe payment intent ID (for off-session payments)
        discount_code_id: ID of applied discount code (if any)
        status: "pending" | "completed" | "failed" | "refunded"
        created_at: Order creation timestamp
        completed_at: Order completion timestamp
    """
    id: int
    account_id: int
    order_type: str
    amount_cents: int
    stripe_session_id: Optional[str] = None
    stripe_payment_intent_id: Optional[str] = None
    discount_code_id: Optional[int] = None
    status: str = "pending"
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


@dataclass
class AccountBalance:
    """
    Account balance tracking.

    One balance record per account. Balance can temporarily go negative
    if SMS is sent just before top-up completes.

    Attributes:
        id: Primary key
        account_id: Foreign key to accounts (unique - one per account)
        balance_cents: Current balance in cents
        updated_at: Last update timestamp
    """
    id: int
    account_id: int
    balance_cents: int
    updated_at: Optional[datetime] = None


@dataclass
class DiscountCode:
    """
    Discount code for purchases.

    Attributes:
        id: Primary key
        code: Unique code (uppercase, e.g., "LAUNCH10")
        discount_type: "percent" | "fixed"
        discount_value: Percent as integer (10 for 10%) or cents for fixed
        max_uses: Maximum uses (None for unlimited)
        current_uses: Current use count
        active: Whether code is active
        stripe_coupon_id: Linked Stripe coupon ID
        created_at: Creation timestamp
    """
    id: int
    code: str
    discount_type: str
    discount_value: int
    max_uses: Optional[int] = None
    current_uses: int = 0
    active: bool = True
    stripe_coupon_id: Optional[str] = None
    created_at: Optional[datetime] = None


@dataclass
class Transaction:
    """
    Transaction record for audit trail.

    Tracks all balance changes for an account.

    Attributes:
        id: Primary key
        account_id: Foreign key to accounts
        order_id: Associated order (if any)
        transaction_type: "credit" | "debit" | "refund"
        amount_cents: Transaction amount in cents
        balance_after_cents: Balance after this transaction
        description: Human-readable description
        created_at: Transaction timestamp
    """
    id: int
    account_id: int
    order_id: Optional[int]
    transaction_type: str
    amount_cents: int
    balance_after_cents: int
    description: str
    created_at: Optional[datetime] = None


@dataclass
class CountrySMSCost:
    """
    SMS cost configuration per country.

    Attributes:
        country_code: ISO 2-letter code (e.g., "US", "GB")
        country_name: Full country name
        twilio_cost_per_segment_cents: Twilio cost in cents
        customer_cost_per_segment_cents: What we charge in cents
        segments_per_10_dollars: Calculated segments per $10 top-up
    """
    country_code: str
    country_name: str
    twilio_cost_per_segment_cents: int
    customer_cost_per_segment_cents: int
    segments_per_10_dollars: int


class OrderStore:
    """SQLite-backed order storage."""

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

    def _row_to_order(self, row: sqlite3.Row) -> Order:
        """Convert database row to Order object."""
        return Order(
            id=row["id"],
            account_id=row["account_id"],
            order_type=row["order_type"],
            amount_cents=row["amount_cents"],
            stripe_session_id=row["stripe_session_id"],
            stripe_payment_intent_id=row["stripe_payment_intent_id"],
            discount_code_id=row["discount_code_id"],
            status=row["status"],
            created_at=datetime.fromisoformat(row["created_at"]) if row["created_at"] else None,
            completed_at=datetime.fromisoformat(row["completed_at"]) if row["completed_at"] else None
        )

    def create(
        self,
        account_id: int,
        order_type: str,
        amount_cents: int,
        stripe_session_id: Optional[str] = None,
        stripe_payment_intent_id: Optional[str] = None,
        discount_code_id: Optional[int] = None
    ) -> Order:
        """
        Create a new order.

        Args:
            account_id: Account making the purchase
            order_type: "initial_access" or "top_up"
            amount_cents: Amount in cents
            stripe_session_id: Stripe checkout session ID
            stripe_payment_intent_id: Stripe payment intent ID
            discount_code_id: Applied discount code ID

        Returns:
            Created Order object
        """
        now = datetime.utcnow().isoformat()

        with self._get_connection() as conn:
            cursor = conn.execute(
                """INSERT INTO orders
                   (account_id, order_type, amount_cents, stripe_session_id,
                    stripe_payment_intent_id, discount_code_id, status, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (account_id, order_type, amount_cents, stripe_session_id,
                 stripe_payment_intent_id, discount_code_id, "pending", now)
            )
            conn.commit()

            return Order(
                id=cursor.lastrowid,
                account_id=account_id,
                order_type=order_type,
                amount_cents=amount_cents,
                stripe_session_id=stripe_session_id,
                stripe_payment_intent_id=stripe_payment_intent_id,
                discount_code_id=discount_code_id,
                status="pending",
                created_at=datetime.fromisoformat(now),
                completed_at=None
            )

    def get_by_id(self, order_id: int) -> Optional[Order]:
        """Get order by ID."""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM orders WHERE id = ?",
                (order_id,)
            )
            row = cursor.fetchone()
            if row:
                return self._row_to_order(row)
            return None

    def get_by_account_id(self, account_id: int) -> List[Order]:
        """Get all orders for an account."""
        orders = []
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM orders WHERE account_id = ? ORDER BY created_at DESC",
                (account_id,)
            )
            for row in cursor:
                orders.append(self._row_to_order(row))
        return orders

    def get_by_stripe_session(self, stripe_session_id: str) -> Optional[Order]:
        """Get order by Stripe checkout session ID."""
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM orders WHERE stripe_session_id = ?",
                (stripe_session_id,)
            )
            row = cursor.fetchone()
            if row:
                return self._row_to_order(row)
            return None

    def update_status(
        self,
        order_id: int,
        status: str,
        stripe_payment_intent_id: Optional[str] = None
    ) -> bool:
        """
        Update order status.

        Args:
            order_id: Order to update
            status: New status
            stripe_payment_intent_id: Payment intent ID (for completed orders)

        Returns:
            True if updated, False if order not found
        """
        now = datetime.utcnow().isoformat()
        completed_at = now if status == "completed" else None

        with self._get_connection() as conn:
            if stripe_payment_intent_id:
                cursor = conn.execute(
                    """UPDATE orders
                       SET status = ?, completed_at = ?, stripe_payment_intent_id = ?
                       WHERE id = ?""",
                    (status, completed_at, stripe_payment_intent_id, order_id)
                )
            else:
                cursor = conn.execute(
                    "UPDATE orders SET status = ?, completed_at = ? WHERE id = ?",
                    (status, completed_at, order_id)
                )
            conn.commit()
            return cursor.rowcount > 0


class BalanceStore:
    """SQLite-backed balance tracking."""

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

    def get_or_create(self, account_id: int) -> AccountBalance:
        """
        Get or create balance record for an account.

        Args:
            account_id: Account ID

        Returns:
            AccountBalance object (created with 0 balance if new)
        """
        now = datetime.utcnow().isoformat()

        with self._get_connection() as conn:
            # Try to get existing
            cursor = conn.execute(
                "SELECT * FROM account_balances WHERE account_id = ?",
                (account_id,)
            )
            row = cursor.fetchone()

            if row:
                return AccountBalance(
                    id=row["id"],
                    account_id=row["account_id"],
                    balance_cents=row["balance_cents"],
                    updated_at=datetime.fromisoformat(row["updated_at"]) if row["updated_at"] else None
                )

            # Create new balance record
            cursor = conn.execute(
                """INSERT INTO account_balances (account_id, balance_cents, updated_at)
                   VALUES (?, ?, ?)""",
                (account_id, 0, now)
            )
            conn.commit()

            return AccountBalance(
                id=cursor.lastrowid,
                account_id=account_id,
                balance_cents=0,
                updated_at=datetime.fromisoformat(now)
            )

    def get_balance(self, account_id: int) -> int:
        """
        Get current balance for an account.

        Args:
            account_id: Account ID

        Returns:
            Balance in cents (0 if no balance record exists)
        """
        balance = self.get_or_create(account_id)
        return balance.balance_cents

    def add_credits(
        self,
        account_id: int,
        amount_cents: int,
        description: str,
        order_id: Optional[int] = None
    ) -> int:
        """
        Add credits to account balance.

        Args:
            account_id: Account to credit
            amount_cents: Amount to add in cents
            description: Transaction description
            order_id: Associated order (if any)

        Returns:
            New balance in cents
        """
        now = datetime.utcnow().isoformat()

        with self._get_connection() as conn:
            # Get or create balance
            cursor = conn.execute(
                "SELECT id, balance_cents FROM account_balances WHERE account_id = ?",
                (account_id,)
            )
            row = cursor.fetchone()

            if row:
                new_balance = row["balance_cents"] + amount_cents
                conn.execute(
                    "UPDATE account_balances SET balance_cents = ?, updated_at = ? WHERE id = ?",
                    (new_balance, now, row["id"])
                )
            else:
                new_balance = amount_cents
                conn.execute(
                    """INSERT INTO account_balances (account_id, balance_cents, updated_at)
                       VALUES (?, ?, ?)""",
                    (account_id, new_balance, now)
                )

            # Record transaction
            conn.execute(
                """INSERT INTO transactions
                   (account_id, order_id, transaction_type, amount_cents,
                    balance_after_cents, description, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (account_id, order_id, "credit", amount_cents, new_balance, description, now)
            )
            conn.commit()

            return new_balance

    def deduct(
        self,
        account_id: int,
        amount_cents: int,
        description: str
    ) -> bool:
        """
        Deduct from account balance.

        Args:
            account_id: Account to debit
            amount_cents: Amount to deduct in cents
            description: Transaction description

        Returns:
            True if successful, False if insufficient balance
        """
        now = datetime.utcnow().isoformat()

        with self._get_connection() as conn:
            # Get current balance
            cursor = conn.execute(
                "SELECT id, balance_cents FROM account_balances WHERE account_id = ?",
                (account_id,)
            )
            row = cursor.fetchone()

            if not row or row["balance_cents"] < amount_cents:
                return False

            new_balance = row["balance_cents"] - amount_cents

            conn.execute(
                "UPDATE account_balances SET balance_cents = ?, updated_at = ? WHERE id = ?",
                (new_balance, now, row["id"])
            )

            # Record transaction
            conn.execute(
                """INSERT INTO transactions
                   (account_id, order_id, transaction_type, amount_cents,
                    balance_after_cents, description, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (account_id, None, "debit", amount_cents, new_balance, description, now)
            )
            conn.commit()

            return True

    def record_transaction(
        self,
        account_id: int,
        transaction_type: str,
        amount_cents: int,
        description: str,
        order_id: Optional[int] = None
    ) -> Transaction:
        """
        Record a transaction without modifying balance.

        Useful for tracking refunds or adjustments made externally.

        Args:
            account_id: Account ID
            transaction_type: "credit" | "debit" | "refund"
            amount_cents: Amount in cents
            description: Transaction description
            order_id: Associated order (if any)

        Returns:
            Created Transaction object
        """
        now = datetime.utcnow().isoformat()
        current_balance = self.get_balance(account_id)

        with self._get_connection() as conn:
            cursor = conn.execute(
                """INSERT INTO transactions
                   (account_id, order_id, transaction_type, amount_cents,
                    balance_after_cents, description, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (account_id, order_id, transaction_type, amount_cents,
                 current_balance, description, now)
            )
            conn.commit()

            return Transaction(
                id=cursor.lastrowid,
                account_id=account_id,
                order_id=order_id,
                transaction_type=transaction_type,
                amount_cents=amount_cents,
                balance_after_cents=current_balance,
                description=description,
                created_at=datetime.fromisoformat(now)
            )


class DiscountCodeStore:
    """SQLite-backed discount code storage."""

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

    def _row_to_discount_code(self, row: sqlite3.Row) -> DiscountCode:
        """Convert database row to DiscountCode object."""
        return DiscountCode(
            id=row["id"],
            code=row["code"],
            discount_type=row["discount_type"],
            discount_value=row["discount_value"],
            max_uses=row["max_uses"],
            current_uses=row["current_uses"],
            active=bool(row["active"]),
            stripe_coupon_id=row["stripe_coupon_id"],
            created_at=datetime.fromisoformat(row["created_at"]) if row["created_at"] else None
        )

    def create(
        self,
        code: str,
        discount_type: str,
        discount_value: int,
        max_uses: Optional[int] = None,
        stripe_coupon_id: Optional[str] = None
    ) -> DiscountCode:
        """
        Create a new discount code.

        Args:
            code: Unique code (will be uppercased)
            discount_type: "percent" or "fixed"
            discount_value: Percent (10 for 10%) or cents for fixed
            max_uses: Maximum uses (None for unlimited)
            stripe_coupon_id: Linked Stripe coupon ID

        Returns:
            Created DiscountCode object

        Raises:
            sqlite3.IntegrityError: If code already exists
        """
        now = datetime.utcnow().isoformat()
        code_upper = code.upper()

        with self._get_connection() as conn:
            cursor = conn.execute(
                """INSERT INTO discount_codes
                   (code, discount_type, discount_value, max_uses, current_uses,
                    active, stripe_coupon_id, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (code_upper, discount_type, discount_value, max_uses, 0,
                 True, stripe_coupon_id, now)
            )
            conn.commit()

            return DiscountCode(
                id=cursor.lastrowid,
                code=code_upper,
                discount_type=discount_type,
                discount_value=discount_value,
                max_uses=max_uses,
                current_uses=0,
                active=True,
                stripe_coupon_id=stripe_coupon_id,
                created_at=datetime.fromisoformat(now)
            )

    def get_by_code(self, code: str) -> Optional[DiscountCode]:
        """
        Get discount code by code string.

        Args:
            code: Code to look up (case-insensitive)

        Returns:
            DiscountCode if found, None otherwise
        """
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM discount_codes WHERE code = ?",
                (code.upper(),)
            )
            row = cursor.fetchone()
            if row:
                return self._row_to_discount_code(row)
            return None

    def increment_uses(self, code: str) -> bool:
        """
        Increment usage count for a discount code.

        Args:
            code: Code to increment

        Returns:
            True if incremented, False if code not found
        """
        with self._get_connection() as conn:
            cursor = conn.execute(
                "UPDATE discount_codes SET current_uses = current_uses + 1 WHERE code = ?",
                (code.upper(),)
            )
            conn.commit()
            return cursor.rowcount > 0

    def validate(self, code: str) -> tuple[bool, Optional[str]]:
        """
        Validate a discount code.

        Args:
            code: Code to validate

        Returns:
            Tuple of (is_valid, error_message)
            - (True, None) if valid
            - (False, "reason") if invalid
        """
        discount = self.get_by_code(code)

        if not discount:
            return False, "Invalid discount code"

        if not discount.active:
            return False, "Discount code is no longer active"

        if discount.max_uses is not None and discount.current_uses >= discount.max_uses:
            return False, "Discount code has reached its usage limit"

        return True, None


# Singleton instances
order_store = OrderStore()
balance_store = BalanceStore()
discount_code_store = DiscountCodeStore()
