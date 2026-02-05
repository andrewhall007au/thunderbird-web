"""
Balance tracking service.

Handles PAY-06 (balance tracking) with atomic updates and transaction logging.
Handles PAY-09 (low balance warning) with SMS alerts.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional, List
import logging

from app.models.payments import (
    balance_store,
    BalanceStore,
    Transaction
)

logger = logging.getLogger(__name__)

# Low balance warning configuration (PAY-09)
LOW_BALANCE_THRESHOLD_CENTS = 200  # $2.00
WARNING_COOLDOWN_HOURS = 24  # Don't warn more than once per day

# Track last warning time per account (in production, store in DB)
_last_warnings: dict[int, datetime] = {}


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

    def is_low_balance(self, account_id: int) -> bool:
        """
        Check if account has low balance (< $2).

        PAY-09: Low balance threshold is $2.00 (200 cents).

        Args:
            account_id: Account ID

        Returns:
            True if balance <= threshold
        """
        return self.get_balance(account_id) <= LOW_BALANCE_THRESHOLD_CENTS

    async def check_and_warn_low_balance(
        self,
        account_id: int,
        phone: str,
        country_code: str = "US"
    ) -> bool:
        """
        Check if balance is low and send warning SMS if needed.

        PAY-09: User receives low balance warning SMS at $2 remaining.

        Args:
            account_id: Account to check
            phone: Phone number for SMS warning
            country_code: Country for segment estimate

        Returns:
            True if warning was sent
        """
        balance_cents = self.get_balance(account_id)

        if balance_cents > LOW_BALANCE_THRESHOLD_CENTS:
            return False  # Balance OK

        # Check cooldown
        last_warning = _last_warnings.get(account_id)
        if last_warning:
            time_since = datetime.utcnow() - last_warning
            if time_since < timedelta(hours=WARNING_COOLDOWN_HOURS):
                logger.debug(f"Skipping low balance warning (cooldown): {account_id}")
                return False

        # Calculate remaining segments
        from config.sms_pricing import get_segments_for_topup
        segments_per_10 = get_segments_for_topup(country_code, 10)
        # Estimate segments from current balance
        # If balance is 200 cents ($2), and $10 = X segments, then $2 = X * 0.2
        segments_remaining = int((balance_cents / 1000) * segments_per_10)

        # Send warning SMS with one-tap top-up options
        from app.services.sms import get_sms_service
        sms_service = get_sms_service()
        message = (
            f"Low balance: ${balance_cents/100:.2f}\n"
            f"~{segments_remaining} forecasts remaining\n\n"
            f"Reply to top up:\n"
            f"YES$10 | YES$25 | YES$50\n\n"
            f"Card on file will be charged."
        )

        try:
            result = await sms_service.send_message(phone, message)
            if not result.error:
                _last_warnings[account_id] = datetime.utcnow()
                logger.info(f"Low balance warning sent: account={account_id}")
                return True
            else:
                logger.error(f"Failed to send low balance warning: {result.error}")
                return False
        except Exception as e:
            logger.error(f"Failed to send low balance warning: {e}")
            return False


# Singleton instance
_balance_service: Optional[BalanceService] = None


def get_balance_service() -> BalanceService:
    """Get balance service singleton."""
    global _balance_service
    if _balance_service is None:
        _balance_service = BalanceService()
    return _balance_service
