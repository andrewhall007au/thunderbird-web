"""
Payment service for Stripe integration.

Handles PAY-01 (checkout), PAY-07 (top-ups with stored card).
"""
import logging
from typing import Optional
from dataclasses import dataclass

from config.settings import settings
from app.services.pricing_dynamic import get_pricing_service
from app.models.payments import order_store, Order

logger = logging.getLogger(__name__)

# Stripe import - only initialize if configured
stripe = None
try:
    import stripe as stripe_module
    stripe = stripe_module
except ImportError:
    logger.warning("Stripe library not installed - payment features disabled")


@dataclass
class PaymentResult:
    """Result of a payment operation."""
    success: bool
    checkout_url: Optional[str] = None  # For redirect to Stripe
    transaction_id: Optional[str] = None
    order_id: Optional[int] = None
    error: Optional[str] = None


@dataclass
class CheckoutSession:
    """Stripe checkout session info."""
    session_id: str
    checkout_url: str
    amount_cents: int
    order_id: int


class PaymentService:
    """
    Stripe payment integration.

    Pattern from research:
    - Use Checkout Sessions for initial purchase (hosted payment page)
    - Use PaymentIntent with saved card for top-ups (off-session)
    - setup_future_usage: "off_session" to save card during checkout
    """

    def __init__(self):
        """Initialize payment service and configure Stripe."""
        if stripe and settings.STRIPE_SECRET_KEY:
            stripe.api_key = settings.STRIPE_SECRET_KEY
            logger.info("Stripe API configured")
        else:
            logger.warning("Stripe API not configured - payments disabled")

    def _stripe_available(self) -> bool:
        """Check if Stripe is available and configured."""
        return stripe is not None and settings.stripe_configured

    async def create_checkout_session(
        self,
        account_id: int,
        discount_code: Optional[str] = None,
        success_url: Optional[str] = None,
        cancel_url: Optional[str] = None
    ) -> PaymentResult:
        """
        Create Stripe Checkout session for initial purchase.

        PAY-01: $29.99 via Stripe Checkout
        PAY-03: User can enter discount code (allow_promotion_codes=True)

        Args:
            account_id: Account making purchase
            discount_code: Optional pre-validated discount code
            success_url: Redirect after success (with {CHECKOUT_SESSION_ID})
            cancel_url: Redirect on cancel

        Returns:
            PaymentResult with checkout_url for redirect
        """
        if not self._stripe_available():
            return PaymentResult(
                success=False,
                error="Stripe not configured"
            )

        # Get price from pricing service
        pricing = get_pricing_service()
        price_calc = pricing.get_checkout_price(discount_code)

        # Create pending order in our database
        order = order_store.create(
            account_id=account_id,
            order_type="initial_access",
            amount_cents=price_calc.final_price_cents,
            stripe_session_id=None,
            stripe_payment_intent_id=None,
            discount_code_id=None  # TODO: Link to discount code if used
        )

        # Build success/cancel URLs
        base_url = settings.BASE_URL
        if success_url is None:
            success_url = f"{base_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
        if cancel_url is None:
            cancel_url = f"{base_url}/payment/cancel"

        try:
            session = stripe.checkout.Session.create(
                customer_creation="always",
                line_items=[{
                    "price_data": {
                        "currency": "usd",
                        "product_data": {
                            "name": "Thunderbird Access",
                            "description": "Global weather forecasts via SMS for hikers",
                        },
                        "unit_amount": price_calc.final_price_cents,
                    },
                    "quantity": 1,
                }],
                mode="payment",
                payment_intent_data={
                    "setup_future_usage": "off_session",  # Save card for top-ups
                },
                allow_promotion_codes=True,  # PAY-03: discount code field in Stripe UI
                metadata={
                    "account_id": str(account_id),
                    "order_id": str(order.id),
                    "purchase_type": "initial_access",
                },
                success_url=success_url,
                cancel_url=cancel_url,
            )

            # Update order with Stripe session ID
            order_store.update_stripe_session(order.id, session.id)

            logger.info(f"Created checkout session {session.id} for account {account_id}")

            return PaymentResult(
                success=True,
                checkout_url=session.url,
                order_id=order.id,
                transaction_id=session.id
            )

        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating checkout: {e}")
            order_store.update_status(order.id, "failed")
            return PaymentResult(
                success=False,
                error=str(e),
                order_id=order.id
            )

    async def create_topup_checkout(
        self,
        account_id: int,
        amount_cents: int = 1000,  # Default $10
        success_url: Optional[str] = None,
        cancel_url: Optional[str] = None
    ) -> PaymentResult:
        """
        Create checkout session for top-up.

        PAY-07: User can top up $10 blocks
        Similar to initial checkout but order_type="top_up"

        Args:
            account_id: Account making purchase
            amount_cents: Top-up amount in cents (default $10 = 1000)
            success_url: Redirect after success
            cancel_url: Redirect on cancel

        Returns:
            PaymentResult with checkout_url for redirect
        """
        if not self._stripe_available():
            return PaymentResult(
                success=False,
                error="Stripe not configured"
            )

        # Create pending order
        order = order_store.create(
            account_id=account_id,
            order_type="top_up",
            amount_cents=amount_cents,
            stripe_session_id=None,
            stripe_payment_intent_id=None,
            discount_code_id=None
        )

        # Build URLs
        base_url = settings.BASE_URL
        if success_url is None:
            success_url = f"{base_url}/payment/topup-success?session_id={{CHECKOUT_SESSION_ID}}"
        if cancel_url is None:
            cancel_url = f"{base_url}/account"

        try:
            session = stripe.checkout.Session.create(
                customer_creation="always",
                line_items=[{
                    "price_data": {
                        "currency": "usd",
                        "product_data": {
                            "name": "Thunderbird Top-up",
                            "description": f"${amount_cents / 100:.2f} account credit",
                        },
                        "unit_amount": amount_cents,
                    },
                    "quantity": 1,
                }],
                mode="payment",
                payment_intent_data={
                    "setup_future_usage": "off_session",  # Keep card saved
                },
                metadata={
                    "account_id": str(account_id),
                    "order_id": str(order.id),
                    "purchase_type": "top_up",
                },
                success_url=success_url,
                cancel_url=cancel_url,
            )

            order_store.update_stripe_session(order.id, session.id)

            logger.info(f"Created top-up session {session.id} for account {account_id}")

            return PaymentResult(
                success=True,
                checkout_url=session.url,
                order_id=order.id,
                transaction_id=session.id
            )

        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating top-up checkout: {e}")
            order_store.update_status(order.id, "failed")
            return PaymentResult(
                success=False,
                error=str(e),
                order_id=order.id
            )

    def get_stored_payment_method(self, stripe_customer_id: str) -> Optional[str]:
        """
        Get default payment method ID for customer.

        Args:
            stripe_customer_id: Stripe customer ID

        Returns:
            Payment method ID if found, None otherwise
        """
        if not self._stripe_available():
            return None

        try:
            payment_methods = stripe.PaymentMethod.list(
                customer=stripe_customer_id,
                type="card"
            )
            if payment_methods.data:
                return payment_methods.data[0].id
            return None
        except stripe.error.StripeError as e:
            logger.error(f"Error getting payment methods: {e}")
            return None

    def get_checkout_session(self, session_id: str) -> Optional[dict]:
        """
        Retrieve a Stripe checkout session.

        Args:
            session_id: Stripe session ID

        Returns:
            Session data dict if found, None otherwise
        """
        if not self._stripe_available():
            return None

        try:
            session = stripe.checkout.Session.retrieve(session_id)
            return {
                "id": session.id,
                "status": session.status,
                "payment_status": session.payment_status,
                "customer": session.customer,
                "payment_intent": session.payment_intent,
                "amount_total": session.amount_total,
                "metadata": dict(session.metadata) if session.metadata else {}
            }
        except stripe.error.StripeError as e:
            logger.error(f"Error retrieving session {session_id}: {e}")
            return None


# Singleton instance
_payment_service: Optional[PaymentService] = None


def get_payment_service() -> PaymentService:
    """Get singleton payment service instance."""
    global _payment_service
    if _payment_service is None:
        _payment_service = PaymentService()
    return _payment_service
