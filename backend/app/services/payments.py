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
        cancel_url: Optional[str] = None,
        entry_path: Optional[str] = None,
        route_id: Optional[int] = None,
        affiliate_id: Optional[int] = None,
        sub_id: Optional[str] = None
    ) -> PaymentResult:
        """
        Create Stripe Checkout session for initial purchase.

        PAY-01: $29.99 via Stripe Checkout
        PAY-03: User can enter discount code (allow_promotion_codes=True)
        FLOW-02: entry_path tracking for Create First flow

        Args:
            account_id: Account making purchase
            discount_code: Optional pre-validated discount code
            success_url: Redirect after success (with {CHECKOUT_SESSION_ID})
            cancel_url: Redirect on cancel
            entry_path: How user entered the funnel ('buy', 'create', 'organic')
            route_id: Route to activate after purchase (for Create First flow)

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

        # Build metadata including entry_path and route_id for analytics
        metadata = {
            "account_id": str(account_id),
            "order_id": str(order.id),
            "purchase_type": "initial_access",
            "entry_path": entry_path or "unknown",
        }
        if route_id is not None:
            metadata["route_id"] = str(route_id)
        if affiliate_id is not None:
            metadata["affiliate_id"] = str(affiliate_id)
        if sub_id:
            metadata["sub_id"] = sub_id

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
                metadata=metadata,
                success_url=success_url,
                cancel_url=cancel_url,
            )

            # Update order with Stripe session ID
            order_store.update_stripe_session(order.id, session.id)

            logger.info(f"Created checkout session {session.id} for account {account_id} (entry_path={entry_path}, route_id={route_id})")

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

    async def create_checkout_session_with_metadata(
        self,
        account_id: int,
        entry_path: Optional[str] = None,
        customer_name: Optional[str] = None,
        customer_email: Optional[str] = None,
        discount_code: Optional[str] = None,
        success_url: Optional[str] = None,
        cancel_url: Optional[str] = None,
        affiliate_id: Optional[int] = None,
        sub_id: Optional[str] = None
    ) -> PaymentResult:
        """
        Create Stripe Checkout session with entry_path tracking.

        FLOW-03: Buy Now path - includes entry_path in metadata for analytics.

        Args:
            account_id: Account making purchase
            entry_path: How user entered the funnel ('buy', 'create', 'organic')
            customer_name: Customer name for Stripe
            customer_email: Customer email for Stripe
            discount_code: Optional pre-validated discount code
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
            discount_code_id=None
        )

        # Build success/cancel URLs
        base_url = settings.BASE_URL
        if success_url is None:
            success_url = f"{base_url}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}"
        if cancel_url is None:
            cancel_url = f"{base_url}/checkout"

        # Build metadata including entry_path for analytics
        metadata = {
            "account_id": str(account_id),
            "order_id": str(order.id),
            "purchase_type": "initial_access",
        }
        if entry_path:
            metadata["entry_path"] = entry_path
        if customer_name:
            metadata["customer_name"] = customer_name
        if affiliate_id is not None:
            metadata["affiliate_id"] = str(affiliate_id)
        if sub_id:
            metadata["sub_id"] = sub_id

        try:
            session_params = {
                "customer_creation": "always",
                "line_items": [{
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
                "mode": "payment",
                "payment_intent_data": {
                    "setup_future_usage": "off_session",
                },
                "allow_promotion_codes": True,
                "metadata": metadata,
                "success_url": success_url,
                "cancel_url": cancel_url,
            }

            # Pre-fill customer email if provided
            if customer_email:
                session_params["customer_email"] = customer_email

            session = stripe.checkout.Session.create(**session_params)

            # Update order with Stripe session ID
            order_store.update_stripe_session(order.id, session.id)

            logger.info(f"Created checkout session {session.id} for account {account_id} (entry_path={entry_path})")

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
        cancel_url: Optional[str] = None,
        affiliate_id: Optional[int] = None,
        sub_id: Optional[str] = None
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
                    **({"affiliate_id": str(affiliate_id)} if affiliate_id is not None else {}),
                    **({"sub_id": sub_id} if sub_id else {}),
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

    async def charge_stored_card(
        self,
        account_id: int,
        amount_cents: int = 1000,  # Default $10
        description: str = "Top-up"
    ) -> PaymentResult:
        """
        Charge stored card for top-up (off-session payment).

        PAY-07: Web top-up with stored card
        PAY-08: SMS "BUY $10" command

        Uses PaymentIntent API with saved payment method.
        Card was saved during initial checkout (setup_future_usage).

        Args:
            account_id: Account to charge
            amount_cents: Amount to charge (default $10 = 1000 cents)
            description: Transaction description

        Returns:
            PaymentResult with success/error
        """
        if not self._stripe_available():
            return PaymentResult(success=False, error="Stripe not configured")

        # Get account with Stripe customer ID
        from app.models.account import account_store
        account = account_store.get_by_id(account_id)

        if not account or not account.stripe_customer_id:
            return PaymentResult(
                success=False,
                error="No payment method on file. Visit thunderbird.app/account to add a card."
            )

        # Get stored payment method
        payment_method_id = self.get_stored_payment_method(account.stripe_customer_id)
        if not payment_method_id:
            return PaymentResult(
                success=False,
                error="No card on file. Add one at thunderbird.app/account"
            )

        # Create pending order
        order = order_store.create(
            account_id=account_id,
            order_type="top_up",
            amount_cents=amount_cents,
            status="pending"
        )

        try:
            # Create and confirm payment intent in one call
            payment_intent = stripe.PaymentIntent.create(
                amount=amount_cents,
                currency="usd",
                customer=account.stripe_customer_id,
                payment_method=payment_method_id,
                off_session=True,
                confirm=True,  # Charge immediately
                metadata={
                    "account_id": str(account_id),
                    "order_id": str(order.id),
                    "purchase_type": "top_up",
                    "description": description,
                }
            )

            # Update order with payment intent ID
            order_store.update_payment_intent(order.id, payment_intent.id)

            # Check if payment succeeded immediately
            if payment_intent.status == "succeeded":
                # Fulfillment happens via webhook, but we can return success
                return PaymentResult(
                    success=True,
                    transaction_id=payment_intent.id,
                    order_id=order.id
                )
            elif payment_intent.status == "requires_action":
                # Card requires 3DS - can't complete off-session
                order_store.update_status(order.id, "failed")
                return PaymentResult(
                    success=False,
                    error="Card requires authentication. Please top up at thunderbird.app/account"
                )
            else:
                order_store.update_status(order.id, "failed")
                return PaymentResult(
                    success=False,
                    error=f"Payment status: {payment_intent.status}"
                )

        except stripe.error.CardError as e:
            # Card declined
            order_store.update_status(order.id, "failed")
            return PaymentResult(
                success=False,
                error=f"Card declined: {e.user_message}"
            )
        except stripe.error.StripeError as e:
            order_store.update_status(order.id, "failed")
            logger.error(f"Stripe error charging stored card: {e}")
            return PaymentResult(success=False, error=str(e))

    async def quick_topup_web(self, account_id: int) -> PaymentResult:
        """
        One-click web top-up for $10.
        PAY-07: User can top up $10 blocks via web with stored card.

        Args:
            account_id: Account to top up

        Returns:
            PaymentResult with success/error
        """
        return await self.charge_stored_card(account_id, 1000, "Web top-up")


# Singleton instance
_payment_service: Optional[PaymentService] = None


def get_payment_service() -> PaymentService:
    """Get singleton payment service instance."""
    global _payment_service
    if _payment_service is None:
        _payment_service = PaymentService()
    return _payment_service
