"""
Balance tracking service.

Handles PAY-06 (balance tracking) with atomic updates and transaction logging.
"""
from dataclasses import dataclass
from typing import Optional, List

from app.models.payments import (
    balance_store,
    BalanceStore,
    Transaction
)


@dataclass
class BalanceResult:
    """Result of a balance operation."""
    success: bool
    balance_cents: int
    transaction_id: Optional[int] = None
    error: Optional[str] = None


class BalanceService:
    """
    Account balance management.

    All operations are atomic - balance update and transaction log in same commit.
    Balance can go negative (for SMS cost tracking before top-up).
    """

    def __init__(self, store: BalanceStore = None):
        """
        Initialize balance service.

        Args:
            store: BalanceStore instance (defaults to singleton)
        """
        self.store = store or balance_store

    def get_balance(self, account_id: int) -> int:
        """
        Get current balance in cents.

        Args:
            account_id: Account ID

        Returns:
            Balance in cents (0 if no balance record exists)
        """
        return self.store.get_balance(account_id)

    def add_credits(
        self,
        account_id: int,
        amount_cents: int,
        description: str,
        order_id: Optional[int] = None
    ) -> BalanceResult:
        """
        Add credits to account balance.
        Creates transaction record atomically.

        Args:
            account_id: Account to credit
            amount_cents: Amount to add (positive)
            description: Audit description (e.g., "Initial purchase", "Top-up")
            order_id: Optional linked order

        Returns:
            BalanceResult with new balance
        """
        if amount_cents <= 0:
            return BalanceResult(
                success=False,
                balance_cents=self.get_balance(account_id),
                error="Amount must be positive"
            )

        try:
            new_balance = self.store.add_credits(
                account_id=account_id,
                amount_cents=amount_cents,
                description=description,
                order_id=order_id
            )
            return BalanceResult(
                success=True,
                balance_cents=new_balance
            )
        except Exception as e:
            return BalanceResult(
                success=False,
                balance_cents=self.get_balance(account_id),
                error=str(e)
            )

    def deduct(
        self,
        account_id: int,
        amount_cents: int,
        description: str
    ) -> BalanceResult:
        """
        Deduct from account balance.
        Creates transaction record atomically.

        Note: Current implementation requires sufficient balance.
        For SMS operations, we may need to allow negative balances.

        Args:
            account_id: Account to debit
            amount_cents: Amount to deduct (positive number)
            description: Audit description (e.g., "SMS to +44xxx")

        Returns:
            BalanceResult with new balance
        """
        if amount_cents <= 0:
            return BalanceResult(
                success=False,
                balance_cents=self.get_balance(account_id),
                error="Amount must be positive"
            )

        success = self.store.deduct(
            account_id=account_id,
            amount_cents=amount_cents,
            description=description
        )

        current_balance = self.get_balance(account_id)

        if success:
            return BalanceResult(
                success=True,
                balance_cents=current_balance
            )
        else:
            return BalanceResult(
                success=False,
                balance_cents=current_balance,
                error="Insufficient balance"
            )

    def force_deduct(
        self,
        account_id: int,
        amount_cents: int,
        description: str
    ) -> BalanceResult:
        """
        Force deduct from account balance, allowing negative balance.
        Used for SMS costs where we need to track even if balance insufficient.

        Args:
            account_id: Account to debit
            amount_cents: Amount to deduct (positive number)
            description: Audit description

        Returns:
            BalanceResult with new balance (may be negative)
        """
        if amount_cents <= 0:
            return BalanceResult(
                success=False,
                balance_cents=self.get_balance(account_id),
                error="Amount must be positive"
            )

        try:
            # Use add_credits with negative amount to force negative balance
            # This is a workaround since deduct() doesn't allow negatives
            current = self.get_balance(account_id)
            new_balance = self.store.add_credits(
                account_id=account_id,
                amount_cents=-amount_cents,  # Negative credit = debit
                description=description,
                order_id=None
            )
            return BalanceResult(
                success=True,
                balance_cents=new_balance
            )
        except Exception as e:
            return BalanceResult(
                success=False,
                balance_cents=self.get_balance(account_id),
                error=str(e)
            )

    def check_sufficient_balance(self, account_id: int, amount_cents: int) -> bool:
        """
        Check if account has sufficient balance for amount.

        Args:
            account_id: Account to check
            amount_cents: Amount needed

        Returns:
            True if balance >= amount
        """
        return self.get_balance(account_id) >= amount_cents

    def get_balance_display(self, account_id: int) -> str:
        """
        Get balance formatted for display.

        Args:
            account_id: Account ID

        Returns:
            Formatted string (e.g., "$12.34")
        """
        cents = self.get_balance(account_id)
        dollars = cents / 100
        if cents < 0:
            return f"-${abs(dollars):.2f}"
        return f"${dollars:.2f}"

    def get_transaction_history(
        self,
        account_id: int,
        limit: int = 20
    ) -> List[Transaction]:
        """
        Get recent transactions for account.

        Args:
            account_id: Account ID
            limit: Maximum transactions to return

        Returns:
            List of Transaction objects (most recent first)
        """
        # Note: BalanceStore doesn't have get_transactions method yet
        # We'll need to add it or return empty for now
        return []

    def ensure_balance_record(self, account_id: int) -> int:
        """
        Ensure a balance record exists for account.
        Creates one with 0 balance if not exists.

        Args:
            account_id: Account ID

        Returns:
            Current balance in cents
        """
        balance = self.store.get_or_create(account_id)
        return balance.balance_cents


# Singleton instance
_balance_service: Optional[BalanceService] = None


def get_balance_service() -> BalanceService:
    """Get balance service singleton."""
    global _balance_service
    if _balance_service is None:
        _balance_service = BalanceService()
    return _balance_service
