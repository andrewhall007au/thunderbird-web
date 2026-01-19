"""
Dynamic pricing service.

Handles PAY-02 (dynamic pricing) and PAY-03/04 (discount codes).
"""
from dataclasses import dataclass
from typing import Optional

from config.settings import PricingConfig
from app.models.payments import discount_code_store, DiscountCode


@dataclass
class DiscountValidation:
    """Result of discount code validation."""
    valid: bool
    discount_code: Optional[DiscountCode] = None
    error_message: Optional[str] = None


@dataclass
class PriceCalculation:
    """Result of price calculation."""
    base_price_cents: int
    discount_cents: int
    final_price_cents: int
    discount_code_applied: Optional[str] = None


class DynamicPricingService:
    """
    Manages product pricing with launch/RRP/sale modes.

    Pricing modes:
    - "launch": $29.99 promotional price
    - "rrp": $49.99 standard retail price
    - "sale": Custom sale price

    Discount codes can stack with any pricing mode (PAY-04).
    """

    def __init__(self, config: type = None):
        """
        Initialize pricing service.

        Args:
            config: PricingConfig class (defaults to global PricingConfig)
        """
        self.config = config or PricingConfig

    def get_base_price_cents(self) -> int:
        """
        Get current base price based on pricing mode.

        Returns:
            Base price in cents
        """
        mode = self.config.PRICE_MODE.lower()

        if mode == "launch":
            return self.config.PRICE_LAUNCH_CENTS
        elif mode == "rrp":
            return self.config.PRICE_RRP_CENTS
        elif mode == "sale":
            return self.config.PRICE_SALE_CENTS
        else:
            # Default to launch price if mode unknown
            return self.config.PRICE_LAUNCH_CENTS

    def get_pricing_mode(self) -> str:
        """Get current pricing mode."""
        return self.config.PRICE_MODE

    def validate_discount_code(self, code: str) -> DiscountValidation:
        """
        Validate a discount code.

        Args:
            code: Discount code to validate

        Returns:
            DiscountValidation with result
        """
        if not code:
            return DiscountValidation(
                valid=False,
                error_message="No discount code provided"
            )

        is_valid, error = discount_code_store.validate(code)

        if not is_valid:
            return DiscountValidation(
                valid=False,
                error_message=error
            )

        discount = discount_code_store.get_by_code(code)
        return DiscountValidation(
            valid=True,
            discount_code=discount
        )

    def calculate_discount(
        self,
        base_price_cents: int,
        discount_code: DiscountCode
    ) -> int:
        """
        Calculate discount amount in cents.

        Args:
            base_price_cents: Original price in cents
            discount_code: Valid discount code object

        Returns:
            Discount amount in cents
        """
        if discount_code.discount_type == "percent":
            # discount_value is percentage (10 = 10%)
            discount = (base_price_cents * discount_code.discount_value) // 100
        elif discount_code.discount_type == "fixed":
            # discount_value is amount in cents
            discount = discount_code.discount_value
        else:
            discount = 0

        # Can't discount more than the price
        return min(discount, base_price_cents)

    def calculate_final_price(
        self,
        base_price_cents: int,
        discount_code: Optional[str] = None
    ) -> PriceCalculation:
        """
        Calculate final price with optional discount.

        PAY-04: Discounts stack with launch pricing.
        Example: $29.99 launch - 10% discount = $26.99

        Args:
            base_price_cents: Base price in cents
            discount_code: Optional discount code string

        Returns:
            PriceCalculation with breakdown
        """
        discount_cents = 0
        discount_code_applied = None

        if discount_code:
            validation = self.validate_discount_code(discount_code)
            if validation.valid and validation.discount_code:
                discount_cents = self.calculate_discount(
                    base_price_cents,
                    validation.discount_code
                )
                discount_code_applied = validation.discount_code.code

        final_price = base_price_cents - discount_cents

        return PriceCalculation(
            base_price_cents=base_price_cents,
            discount_cents=discount_cents,
            final_price_cents=final_price,
            discount_code_applied=discount_code_applied
        )

    def get_checkout_price(
        self,
        discount_code: Optional[str] = None
    ) -> PriceCalculation:
        """
        Convenience method: get base price and apply discount.

        Args:
            discount_code: Optional discount code string

        Returns:
            PriceCalculation with final price
        """
        base = self.get_base_price_cents()
        return self.calculate_final_price(base, discount_code)

    def format_price_display(self, cents: int) -> str:
        """
        Format price for display.

        Args:
            cents: Price in cents

        Returns:
            Formatted string (e.g., "$29.99")
        """
        dollars = cents / 100
        return f"${dollars:.2f}"


# Singleton instance
_pricing_service: Optional[DynamicPricingService] = None


def get_pricing_service() -> DynamicPricingService:
    """Get pricing service singleton."""
    global _pricing_service
    if _pricing_service is None:
        _pricing_service = DynamicPricingService()
    return _pricing_service
