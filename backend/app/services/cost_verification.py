"""
SMS cost verification service.
Compares stored rates to Twilio Pricing API to maintain 80% margin.

PAY-12: SMS cost verification function reconciles against Twilio actuals.
"""
import logging
from dataclasses import dataclass
from typing import Optional, List
from decimal import Decimal
import httpx

from config.settings import settings
from config.sms_pricing import SMS_COSTS_BY_COUNTRY, MARGIN_PERCENT, CountrySMSCost

logger = logging.getLogger(__name__)

TWILIO_PRICING_API = "https://pricing.twilio.com/v2/Voice/Countries"
# Note: Twilio Pricing API for SMS is at /v1/Messaging/Countries/{iso}
TWILIO_SMS_PRICING_API = "https://pricing.twilio.com/v1/Messaging/Countries"

TARGET_MARGIN = Decimal("0.80")  # 80%
MARGIN_ALERT_THRESHOLD = Decimal("0.75")  # Alert if margin drops below 75%
RATE_DRIFT_THRESHOLD = Decimal("0.10")  # Alert if rate differs by >10%


@dataclass
class RateComparison:
    """Result of comparing stored rate to Twilio rate."""
    country_code: str
    country_name: str
    stored_twilio_rate_cents: int
    actual_twilio_rate_cents: Optional[int]
    stored_customer_rate_cents: int
    calculated_margin: Decimal
    is_margin_ok: bool
    rate_drift_percent: Optional[Decimal]
    is_rate_drifted: bool
    error: Optional[str] = None


@dataclass
class VerificationReport:
    """Full verification report for all countries."""
    timestamp: str
    countries_checked: int
    countries_ok: int
    countries_with_issues: int
    margin_alerts: List[str]
    rate_drift_alerts: List[str]
    api_errors: List[str]
    details: List[RateComparison]


class CostVerificationService:
    """
    Verifies SMS costs against Twilio Pricing API.

    Twilio Pricing API requires authentication and returns current rates.
    We compare to our stored rates in SMS_COSTS_BY_COUNTRY.
    """

    def __init__(self):
        self.account_sid = settings.TWILIO_ACCOUNT_SID
        self.auth_token = settings.TWILIO_AUTH_TOKEN

    def is_configured(self) -> bool:
        """Check if Twilio credentials available."""
        return bool(self.account_sid and self.auth_token)

    async def fetch_twilio_rate(self, country_code: str) -> Optional[Decimal]:
        """
        Fetch current SMS rate from Twilio Pricing API.

        Args:
            country_code: ISO 2-letter country code (e.g., "US", "GB")

        Returns:
            Rate per segment in dollars, or None on error
        """
        if not self.is_configured():
            logger.warning("Twilio not configured for pricing API")
            return None

        url = f"{TWILIO_SMS_PRICING_API}/{country_code}"

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    url,
                    auth=(self.account_sid, self.auth_token),
                    timeout=30.0
                )

                if response.status_code == 200:
                    data = response.json()
                    # Twilio returns outbound_sms_prices array with nested structure:
                    # [{"carrier": "Telstra", "prices": [{"current_price": "0.0515", "number_type": "mobile"}]}]
                    carriers = data.get("outbound_sms_prices", [])
                    if carriers:
                        # Get the first carrier's mobile price
                        for carrier in carriers:
                            carrier_prices = carrier.get("prices", [])
                            for price in carrier_prices:
                                if price.get("number_type") == "mobile":
                                    return Decimal(price["current_price"])
                        # Fallback to first carrier's first price
                        if carriers[0].get("prices"):
                            return Decimal(carriers[0]["prices"][0]["current_price"])
                    return None
                elif response.status_code == 404:
                    logger.warning(f"Country not found in Twilio: {country_code}")
                    return None
                else:
                    logger.error(f"Twilio API error: {response.status_code}")
                    return None

        except Exception as e:
            logger.error(f"Failed to fetch Twilio rate for {country_code}: {e}")
            return None

    def calculate_margin(
        self,
        twilio_cost_cents: int,
        customer_cost_cents: int
    ) -> Decimal:
        """
        Calculate actual margin.

        Margin = (customer_pays - twilio_cost) / customer_pays
        80% margin means customer pays 5x what Twilio charges.

        Args:
            twilio_cost_cents: What Twilio charges us
            customer_cost_cents: What customer pays

        Returns:
            Margin as decimal (0.80 = 80%)
        """
        if customer_cost_cents == 0:
            return Decimal("0")

        profit = customer_cost_cents - twilio_cost_cents
        return Decimal(profit) / Decimal(customer_cost_cents)

    async def verify_country(self, country_code: str) -> RateComparison:
        """
        Verify single country's SMS pricing.

        Args:
            country_code: ISO country code

        Returns:
            RateComparison with status
        """
        stored = SMS_COSTS_BY_COUNTRY.get(country_code)
        if not stored:
            return RateComparison(
                country_code=country_code,
                country_name="Unknown",
                stored_twilio_rate_cents=0,
                actual_twilio_rate_cents=None,
                stored_customer_rate_cents=0,
                calculated_margin=Decimal("0"),
                is_margin_ok=False,
                rate_drift_percent=None,
                is_rate_drifted=False,
                error=f"Country {country_code} not in configuration"
            )

        # Fetch actual Twilio rate (returns dollars, e.g., 0.0515)
        actual_rate = await self.fetch_twilio_rate(country_code)
        # Convert to hundredths of a cent to match stored format (0.0515 * 10000 = 515)
        actual_cents = int(actual_rate * 10000) if actual_rate else None

        # Calculate margin based on stored rates
        margin = self.calculate_margin(
            stored.twilio_cost_per_segment_cents,
            stored.customer_cost_per_segment_cents
        )

        # Calculate rate drift
        rate_drift = None
        is_drifted = False
        if actual_cents is not None:
            if stored.twilio_cost_per_segment_cents > 0:
                drift = abs(actual_cents - stored.twilio_cost_per_segment_cents)
                rate_drift = Decimal(drift) / Decimal(stored.twilio_cost_per_segment_cents)
                is_drifted = rate_drift > RATE_DRIFT_THRESHOLD

        return RateComparison(
            country_code=country_code,
            country_name=stored.country_name,
            stored_twilio_rate_cents=stored.twilio_cost_per_segment_cents,
            actual_twilio_rate_cents=actual_cents,
            stored_customer_rate_cents=stored.customer_cost_per_segment_cents,
            calculated_margin=margin,
            is_margin_ok=margin >= MARGIN_ALERT_THRESHOLD,
            rate_drift_percent=rate_drift,
            is_rate_drifted=is_drifted,
            error=None if actual_cents is not None else "Could not fetch Twilio rate"
        )

    async def verify_all_countries(self) -> VerificationReport:
        """
        Verify all configured countries.

        Returns:
            VerificationReport with all comparisons and alerts
        """
        from datetime import datetime

        details = []
        margin_alerts = []
        drift_alerts = []
        api_errors = []
        ok_count = 0

        for country_code in SMS_COSTS_BY_COUNTRY.keys():
            result = await self.verify_country(country_code)
            details.append(result)

            if result.error:
                api_errors.append(f"{country_code}: {result.error}")
            elif result.is_rate_drifted:
                drift_alerts.append(
                    f"{country_code} ({result.country_name}): "
                    f"stored={result.stored_twilio_rate_cents}c, "
                    f"actual={result.actual_twilio_rate_cents}c, "
                    f"drift={result.rate_drift_percent:.1%}"
                )
            elif not result.is_margin_ok:
                margin_alerts.append(
                    f"{country_code} ({result.country_name}): "
                    f"margin={result.calculated_margin:.1%} (target: 80%)"
                )
            else:
                ok_count += 1

        issues = len(margin_alerts) + len(drift_alerts) + len(api_errors)

        return VerificationReport(
            timestamp=datetime.utcnow().isoformat(),
            countries_checked=len(SMS_COSTS_BY_COUNTRY),
            countries_ok=ok_count,
            countries_with_issues=issues,
            margin_alerts=margin_alerts,
            rate_drift_alerts=drift_alerts,
            api_errors=api_errors,
            details=details
        )


# Singleton
_verification_service: Optional[CostVerificationService] = None


def get_verification_service() -> CostVerificationService:
    """Get singleton verification service."""
    global _verification_service
    if _verification_service is None:
        _verification_service = CostVerificationService()
    return _verification_service


async def verify_all_countries() -> VerificationReport:
    """Convenience function for verification."""
    service = get_verification_service()
    return await service.verify_all_countries()
