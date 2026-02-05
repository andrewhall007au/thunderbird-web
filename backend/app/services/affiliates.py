"""
Affiliate service for partner program.

Handles commission calculation, attribution tracking, and click tracking.
Commission is calculated on post-discount amount and has a 30-day hold period.
"""
from typing import Optional, List
from datetime import datetime, timedelta
from dataclasses import dataclass
import logging

from app.models.affiliates import (
    affiliate_store,
    commission_store,
    attribution_store,
    click_store,
    Affiliate,
    Commission,
    Attribution,
    AffiliateClick
)

logger = logging.getLogger(__name__)

# Payout configuration
PAYOUT_MINIMUM_CENTS = 5000  # $50 minimum payout
MILESTONE_THRESHOLDS = [5000, 10000, 50000, 100000]  # $50, $100, $500, $1000


@dataclass
class PayoutRequest:
    """
    Payout request data for admin review.

    Attributes:
        affiliate_id: Affiliate ID
        affiliate_code: Affiliate code
        affiliate_name: Affiliate name
        affiliate_email: Affiliate email
        requested_cents: Total amount requested
        payout_method: "paypal" | "bank"
        payout_details: JSON blob with payout info
        commission_count: Number of commissions in request
    """
    affiliate_id: int
    affiliate_code: str
    affiliate_name: str
    affiliate_email: str
    requested_cents: int
    payout_method: Optional[str]
    payout_details: Optional[str]
    commission_count: int


@dataclass
class AffiliateStats:
    """
    Aggregate statistics for affiliate analytics.

    Attributes:
        total_clicks: Total click count
        unique_clicks: Unique session click count
        total_conversions: Total number of conversions
        conversion_rate: Conversion rate (conversions / unique_clicks)
        total_commission_cents: Total commissions earned (all statuses)
        pending_cents: Commissions still pending (30-day hold)
        available_cents: Commissions available for payout
        requested_cents: Commissions requested but not yet paid
        paid_cents: Commissions already paid out
        topup_count: Number of top-up conversions
        topup_commission_cents: Commission from top-ups only
    """
    total_clicks: int
    unique_clicks: int
    total_conversions: int
    conversion_rate: float
    total_commission_cents: int
    pending_cents: int
    available_cents: int
    requested_cents: int
    paid_cents: int
    topup_count: int
    topup_commission_cents: int


class AffiliateService:
    """
    Affiliate service for partner program.

    Handles:
    - AFFL-04: Commission calculation on post-discount amount
    - AFFL-05: Trailing commission tracking
    - AFFL-06: Click tracking with 24h deduplication
    - Commission clawback on refunds
    """

    def __init__(self):
        self.affiliate_store = affiliate_store
        self.commission_store = commission_store
        self.attribution_store = attribution_store
        self.click_store = click_store

    def record_click(
        self,
        affiliate_code: str,
        session_id: Optional[str] = None,
        sub_id: Optional[str] = None
    ) -> Optional[AffiliateClick]:
        """
        Record affiliate click with 24h deduplication.

        Args:
            affiliate_code: Affiliate code
            session_id: Session ID for deduplication
            sub_id: Campaign tracking ID

        Returns:
            AffiliateClick if recorded, None if duplicate or affiliate not found
        """
        try:
            # Look up affiliate
            affiliate = self.affiliate_store.get_by_code(affiliate_code)
            if not affiliate or not affiliate.active:
                logger.warning(f"Click for unknown/inactive affiliate: {affiliate_code}")
                return None
        except Exception as e:
            # Handle database errors gracefully (e.g., missing tables in test environment)
            logger.error(f"Error looking up affiliate {affiliate_code}: {e}")
            return None

        # Check for duplicate click in last 24h
        if session_id:
            recent_click = self.click_store.get_recent_by_session(
                affiliate_id=affiliate.id,
                session_id=session_id,
                hours=24
            )
            if recent_click:
                logger.debug(f"Duplicate click ignored for session {session_id}")
                return None

        # Record click
        click = self.click_store.create(
            affiliate_id=affiliate.id,
            sub_id=sub_id,
            session_id=session_id
        )
        logger.info(f"Click recorded for affiliate {affiliate_code} (sub_id={sub_id})")
        return click

    def calculate_commission(
        self,
        affiliate_id: int,
        account_id: int,
        order_id: int,
        amount_cents: int,
        sub_id: Optional[str] = None,
        is_initial: bool = True
    ) -> Optional[Commission]:
        """
        Calculate and create commission on post-discount amount.

        AFFL-04: Commission calculated on actual paid amount (post-discount).
        Commission starts as "pending" with 30-day hold period.

        Args:
            affiliate_id: Affiliate earning commission
            account_id: Account that made purchase
            order_id: Order ID
            amount_cents: Post-discount amount in cents
            sub_id: Campaign tracking ID
            is_initial: Whether this is initial purchase (for attribution)

        Returns:
            Created Commission object, or None if affiliate inactive
        """
        # Verify affiliate is active
        affiliate = self.affiliate_store.get_by_id(affiliate_id)
        if not affiliate or not affiliate.active:
            logger.warning(f"Cannot create commission for inactive affiliate {affiliate_id}")
            return None

        # Calculate commission amount
        commission_cents = int(amount_cents * (affiliate.commission_percent / 100))

        # Create commission with 30-day pending period
        commission = self.commission_store.create(
            affiliate_id=affiliate_id,
            account_id=account_id,
            order_id=order_id,
            amount_cents=commission_cents,
            sub_id=sub_id
        )

        logger.info(
            f"Commission created: ${commission_cents/100:.2f} for affiliate {affiliate_id} "
            f"on order {order_id} (amount=${amount_cents/100:.2f}, rate={affiliate.commission_percent}%)"
        )

        return commission

    def create_attribution(
        self,
        affiliate_id: int,
        account_id: int,
        order_id: int,
        sub_id: Optional[str] = None
    ) -> Optional[Attribution]:
        """
        Create trailing attribution for an account.

        AFFL-05: Trailing attribution enables commissions on future top-ups.
        One attribution per account (unique constraint on account_id).

        Args:
            affiliate_id: Affiliate to attribute to
            account_id: Account to attribute
            order_id: Initial order
            sub_id: Campaign tracking ID

        Returns:
            Created Attribution object, or None if affiliate inactive or attribution exists
        """
        # Verify affiliate is active
        affiliate = self.affiliate_store.get_by_id(affiliate_id)
        if not affiliate or not affiliate.active:
            logger.warning(f"Cannot create attribution for inactive affiliate {affiliate_id}")
            return None

        # Check if attribution already exists (should be caught by unique constraint, but check anyway)
        existing = self.attribution_store.get_by_account_id(account_id)
        if existing:
            logger.warning(f"Attribution already exists for account {account_id}")
            return None

        # Create attribution with trailing period from affiliate settings
        try:
            attribution = self.attribution_store.create(
                affiliate_id=affiliate_id,
                account_id=account_id,
                order_id=order_id,
                sub_id=sub_id,
                trailing_months=affiliate.trailing_months
            )

            logger.info(
                f"Attribution created: account {account_id} -> affiliate {affiliate_id} "
                f"(trailing={affiliate.trailing_months} months)"
            )

            return attribution

        except Exception as e:
            logger.error(f"Failed to create attribution: {e}")
            return None

    def get_active_attribution(self, account_id: int) -> Optional[Attribution]:
        """
        Get active attribution for an account (checks expiry).

        Args:
            account_id: Account ID

        Returns:
            Attribution if active, None if expired or doesn't exist
        """
        return self.attribution_store.get_active_attribution(account_id)

    def clawback_commission(self, order_id: int) -> bool:
        """
        Clawback commission(s) for a refunded order.

        Marks all commissions for this order as "clawed_back".

        Args:
            order_id: Order that was refunded

        Returns:
            True if any commissions were clawed back
        """
        # Get commissions for this order
        commissions = self.commission_store.get_by_order_id(order_id)

        if not commissions:
            logger.debug(f"No commissions to clawback for order {order_id}")
            return False

        clawed_back_count = 0
        for commission in commissions:
            # Only clawback if not already clawed back or paid
            if commission.status not in ["clawed_back", "paid"]:
                success = self.commission_store.update_status(
                    commission_id=commission.id,
                    status="clawed_back"
                )
                if success:
                    clawed_back_count += 1
                    logger.info(
                        f"Commission clawed back: ${commission.amount_cents/100:.2f} "
                        f"for affiliate {commission.affiliate_id} (order {order_id})"
                    )

        return clawed_back_count > 0

    def get_affiliate_stats(self, affiliate_id: int, period: str = "all") -> Optional[AffiliateStats]:
        """
        Get aggregate statistics for affiliate dashboard.

        Args:
            affiliate_id: Affiliate ID
            period: Time period ("today" | "7d" | "30d" | "all")

        Returns:
            AffiliateStats object, or None if affiliate not found
        """
        # Verify affiliate exists
        affiliate = self.affiliate_store.get_by_id(affiliate_id)
        if not affiliate:
            logger.warning(f"Stats requested for unknown affiliate {affiliate_id}")
            return None

        # Calculate date range
        now = datetime.utcnow()
        start_date = None
        end_date = now

        if period == "today":
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "7d":
            start_date = now - timedelta(days=7)
        elif period == "30d":
            start_date = now - timedelta(days=30)
        # "all" = no start_date filter

        # Get click metrics
        if start_date:
            total_clicks = self.click_store.count_by_date_range(affiliate_id, start_date, end_date)
            unique_clicks = self.click_store.count_unique_by_affiliate(affiliate_id, start_date, end_date)
        else:
            total_clicks = self.click_store.count_by_affiliate(affiliate_id)
            unique_clicks = self.click_store.count_unique_by_affiliate(affiliate_id)

        # Get conversion metrics
        total_conversions = self.commission_store.count_conversions(affiliate_id, start_date, end_date)

        # Calculate conversion rate
        conversion_rate = (total_conversions / unique_clicks * 100) if unique_clicks > 0 else 0.0

        # Get commission breakdowns by status
        pending_cents = self.commission_store.sum_by_status(affiliate_id, "pending", start_date, end_date)
        available_cents = self.commission_store.sum_by_status(affiliate_id, "available", start_date, end_date)
        requested_cents = self.commission_store.sum_by_status(affiliate_id, "requested", start_date, end_date)
        paid_cents = self.commission_store.sum_by_status(affiliate_id, "paid", start_date, end_date)

        total_commission_cents = pending_cents + available_cents + requested_cents + paid_cents

        # Get topup metrics (commissions where account_id already has attribution)
        # For now, we'll count total conversions from attributed accounts
        # A more sophisticated query would join attributions and check if conversion is after initial
        topup_count = 0
        topup_commission_cents = 0

        # Get all commissions in period
        all_commissions = self.commission_store.get_by_affiliate_id(affiliate_id)
        for commission in all_commissions:
            # Filter by date if needed
            if start_date and commission.created_at:
                if commission.created_at < start_date or commission.created_at > end_date:
                    continue

            # Check if this is a topup (account already has attribution and this isn't the initial order)
            attribution = self.attribution_store.get_by_account_id(commission.account_id)
            if attribution and attribution.order_id != commission.order_id:
                # This is a topup
                if commission.status != "clawed_back":
                    topup_count += 1
                    topup_commission_cents += commission.amount_cents

        return AffiliateStats(
            total_clicks=total_clicks,
            unique_clicks=unique_clicks,
            total_conversions=total_conversions,
            conversion_rate=round(conversion_rate, 2),
            total_commission_cents=total_commission_cents,
            pending_cents=pending_cents,
            available_cents=available_cents,
            requested_cents=requested_cents,
            paid_cents=paid_cents,
            topup_count=topup_count,
            topup_commission_cents=topup_commission_cents
        )

    def get_recent_conversions(self, affiliate_id: int, limit: int = 10) -> List[dict]:
        """
        Get recent conversions for affiliate (aggregate data only, no personal info).

        Args:
            affiliate_id: Affiliate ID
            limit: Maximum number of conversions to return

        Returns:
            List of conversion dicts with amount, status, date
        """
        # Get recent commissions
        commissions = self.commission_store.get_by_affiliate_id(affiliate_id)

        # Filter out clawed back
        active_commissions = [c for c in commissions if c.status != "clawed_back"]

        # Sort by created_at desc and limit
        active_commissions.sort(key=lambda c: c.created_at or datetime.min, reverse=True)
        active_commissions = active_commissions[:limit]

        # Return aggregate data only (no account_id or order_id exposed)
        return [
            {
                "amount_cents": c.amount_cents,
                "status": c.status,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "available_at": c.available_at.isoformat() if c.available_at else None,
                "sub_id": c.sub_id
            }
            for c in active_commissions
        ]

    # ==========================================================================
    # Payout Management Methods (AFFL-07)
    # ==========================================================================

    def request_payout(self, affiliate_id: int) -> tuple[bool, str]:
        """
        Request payout for available commissions.

        From CONTEXT.md:
        - $50 minimum threshold
        - Manual approval required
        - Commission states: Available -> Requested

        Args:
            affiliate_id: Affiliate requesting payout

        Returns:
            (success, message) tuple
        """
        affiliate = self.affiliate_store.get_by_id(affiliate_id)
        if not affiliate:
            return False, "Affiliate not found"

        if not affiliate.active:
            return False, "Affiliate account inactive"

        # Check available balance
        available_cents = self.commission_store.sum_by_status(affiliate_id, "available")

        if available_cents < PAYOUT_MINIMUM_CENTS:
            return False, f"Minimum payout is ${PAYOUT_MINIMUM_CENTS/100:.2f}. Current available: ${available_cents/100:.2f}"

        if not affiliate.payout_method:
            return False, "Please set your payout method first"

        # Mark all available commissions as requested
        available_commissions = self.commission_store.get_by_affiliate_id(affiliate_id, status="available")
        for commission in available_commissions:
            self.commission_store.update_status(commission.id, "requested")

        logger.info(f"Payout requested: ${available_cents/100:.2f} for affiliate {affiliate.code}")

        return True, f"Payout of ${available_cents/100:.2f} requested. Admin will process within 5 business days."

    def get_pending_payouts(self) -> List[PayoutRequest]:
        """
        Get all pending payout requests for admin review.

        Returns:
            List of PayoutRequest objects
        """
        # Get all affiliates with "requested" status commissions
        affiliates = self.affiliate_store.list_all(active_only=False)
        pending = []

        for affiliate in affiliates:
            requested = self.commission_store.get_by_affiliate_id(affiliate.id, status="requested")
            if requested:
                amount = sum(c.amount_cents for c in requested)
                earliest_request = min(
                    (c.created_at for c in requested if c.created_at),
                    default=None
                )

                pending.append(PayoutRequest(
                    affiliate_id=affiliate.id,
                    affiliate_code=affiliate.code,
                    affiliate_name=affiliate.name,
                    affiliate_email=affiliate.email,
                    requested_cents=amount,
                    payout_method=affiliate.payout_method,
                    payout_details=affiliate.payout_details,
                    commission_count=len(requested)
                ))

        # Sort by amount descending (largest payouts first)
        return sorted(pending, key=lambda p: p.requested_cents, reverse=True)

    def process_payout(self, affiliate_id: int) -> tuple[bool, str]:
        """
        Mark payout as processed (admin action).

        Args:
            affiliate_id: Affiliate whose payout was processed

        Returns:
            (success, message) tuple
        """
        requested = self.commission_store.get_by_affiliate_id(affiliate_id, status="requested")
        if not requested:
            return False, "No pending payout request"

        amount = sum(c.amount_cents for c in requested)

        # Mark all as paid
        for commission in requested:
            self.commission_store.update_status(commission.id, "paid")

        affiliate = self.affiliate_store.get_by_id(affiliate_id)
        logger.info(f"Payout processed: ${amount/100:.2f} for affiliate {affiliate.code if affiliate else affiliate_id}")

        return True, f"Payout of ${amount/100:.2f} marked as paid"

    def update_payout_method(
        self,
        affiliate_id: int,
        payout_method: str,
        payout_details: str
    ) -> bool:
        """
        Update affiliate's payout method.

        Args:
            affiliate_id: Affiliate ID
            payout_method: "paypal" or "bank"
            payout_details: PayPal email or bank details

        Returns:
            True if updated
        """
        return self.affiliate_store.update(
            affiliate_id,
            payout_method=payout_method,
            payout_details=payout_details
        )

    def check_milestones(self, affiliate_id: int) -> Optional[int]:
        """
        Check if affiliate hit a new milestone.

        From CONTEXT.md: Milestone email alerts at thresholds.
        Thresholds: $50, $100, $500, $1000

        Args:
            affiliate_id: Affiliate to check

        Returns:
            Milestone amount if new milestone hit, None otherwise
        """
        affiliate = self.affiliate_store.get_by_id(affiliate_id)
        if not affiliate:
            return None

        # Get total lifetime earnings (all statuses except clawed_back)
        total_cents = 0
        for status in ("pending", "available", "requested", "paid"):
            total_cents += self.commission_store.sum_by_status(affiliate_id, status)

        # Get last notified milestone
        last_milestone = affiliate.last_milestone_cents or 0

        # Check each threshold
        for threshold in MILESTONE_THRESHOLDS:
            if total_cents >= threshold > last_milestone:
                # New milestone hit!
                self.affiliate_store.update_last_milestone(affiliate_id, threshold)
                return threshold

        return None

    async def send_milestone_email(self, affiliate_id: int, milestone_cents: int):
        """
        Send milestone celebration email.

        Args:
            affiliate_id: Affiliate who hit milestone
            milestone_cents: Milestone amount in cents
        """
        affiliate = self.affiliate_store.get_by_id(affiliate_id)
        if not affiliate or not affiliate.email:
            return

        from app.services.email import send_affiliate_milestone_email
        await send_affiliate_milestone_email(
            to_email=affiliate.email,
            affiliate_name=affiliate.name,
            milestone_amount=f"${milestone_cents/100:.0f}"
        )
        logger.info(f"Milestone email sent: ${milestone_cents/100:.0f} to {affiliate.email}")


_affiliate_service: Optional[AffiliateService] = None


def get_affiliate_service() -> AffiliateService:
    """Get singleton affiliate service instance."""
    global _affiliate_service
    if _affiliate_service is None:
        _affiliate_service = AffiliateService()
    return _affiliate_service
