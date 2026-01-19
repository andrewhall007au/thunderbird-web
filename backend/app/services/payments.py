"""
Payment service for Stripe integration.

Phase 2 will implement:
- PAY-01: $29.99 purchase via Stripe Checkout
- PAY-02: Dynamic pricing
- PAY-03: Discount codes
- PAY-06: Balance tracking
- PAY-07: Top-up with stored card
"""
from typing import Optional
from dataclasses import dataclass


@dataclass
class PaymentResult:
    """Result of a payment operation."""
    success: bool
    transaction_id: Optional[str] = None
    error: Optional[str] = None


class PaymentService:
    """
    Payment service stub.

    Will handle Stripe integration, balance management,
    and top-up processing in Phase 2.
    """

    def __init__(self):
        pass

    async def create_checkout_session(self, account_id: int, amount_cents: int) -> PaymentResult:
        """Create Stripe checkout session. Stub for Phase 2."""
        raise NotImplementedError("Implemented in Phase 2")

    async def get_balance(self, account_id: int) -> int:
        """Get account balance in cents. Stub for Phase 2."""
        raise NotImplementedError("Implemented in Phase 2")

    async def process_webhook(self, event_type: str, data: dict) -> bool:
        """Process Stripe webhook event. Stub for Phase 2."""
        raise NotImplementedError("Implemented in Phase 2")

    async def apply_discount_code(self, account_id: int, code: str) -> PaymentResult:
        """Apply discount code to account. Stub for Phase 2."""
        raise NotImplementedError("Implemented in Phase 2")


_payment_service: Optional[PaymentService] = None


def get_payment_service() -> PaymentService:
    """Get singleton payment service instance."""
    global _payment_service
    if _payment_service is None:
        _payment_service = PaymentService()
    return _payment_service
