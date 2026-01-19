"""
Affiliate service for partner program.

Phase 5 will implement:
- AFFL-01: Affiliate creation
- AFFL-02: Configurable terms (discount %, commission %, trailing duration)
- AFFL-03: Affiliate codes as discount codes
- AFFL-05: Trailing commission tracking
"""
from typing import Optional, List
from dataclasses import dataclass
from datetime import datetime


@dataclass
class Affiliate:
    """An affiliate partner."""
    id: Optional[int] = None
    name: str = ""
    email: str = ""
    code: str = ""
    discount_percent: int = 0
    commission_percent: int = 0
    trailing_months: int = 12
    active: bool = True
    created_at: Optional[datetime] = None


@dataclass
class Commission:
    """A commission payment record."""
    id: Optional[int] = None
    affiliate_id: int = 0
    account_id: int = 0
    amount_cents: int = 0
    transaction_id: str = ""
    created_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None


class AffiliateService:
    """
    Affiliate service stub.

    Will handle affiliate management, commission tracking,
    and discount code integration in Phase 5.
    """

    def __init__(self):
        pass

    async def create_affiliate(self, affiliate: Affiliate) -> Affiliate:
        """Create new affiliate. Stub for Phase 5."""
        raise NotImplementedError("Implemented in Phase 5")

    async def get_by_code(self, code: str) -> Optional[Affiliate]:
        """Look up affiliate by code. Stub for Phase 5."""
        raise NotImplementedError("Implemented in Phase 5")

    async def get_by_id(self, affiliate_id: int) -> Optional[Affiliate]:
        """Look up affiliate by ID. Stub for Phase 5."""
        raise NotImplementedError("Implemented in Phase 5")

    async def update_affiliate(self, affiliate: Affiliate) -> Affiliate:
        """Update affiliate details. Stub for Phase 5."""
        raise NotImplementedError("Implemented in Phase 5")

    async def record_commission(
        self,
        affiliate_id: int,
        account_id: int,
        amount_cents: int,
        transaction_id: str
    ) -> Commission:
        """Record commission for affiliate. Stub for Phase 5."""
        raise NotImplementedError("Implemented in Phase 5")

    async def get_pending_commissions(self, affiliate_id: int) -> List[Commission]:
        """Get unpaid commissions for affiliate. Stub for Phase 5."""
        raise NotImplementedError("Implemented in Phase 5")

    async def get_trailing_accounts(self, affiliate_id: int) -> List[int]:
        """Get accounts still in trailing period for affiliate. Stub for Phase 5."""
        raise NotImplementedError("Implemented in Phase 5")


_affiliate_service: Optional[AffiliateService] = None


def get_affiliate_service() -> AffiliateService:
    """Get singleton affiliate service instance."""
    global _affiliate_service
    if _affiliate_service is None:
        _affiliate_service = AffiliateService()
    return _affiliate_service
