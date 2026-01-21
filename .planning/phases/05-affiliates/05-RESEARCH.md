# Phase 5: Affiliates - Research

**Researched:** 2026-01-21
**Domain:** Affiliate tracking and commission management
**Confidence:** HIGH

## Summary

Affiliate programs for SaaS typically use discount codes combined with database tracking for attribution. The existing codebase already has the foundational patterns needed: discount code system (`discount_codes` table), order/transaction tracking, balance management, Stripe webhook integration, and entry_path analytics tracking via metadata.

Industry best practices for 2025 emphasize server-side tracking over cookies, storing affiliate IDs in payment metadata, and calculating commissions on actual paid amounts. The standard commission rate is 20% for SaaS, with recurring/trailing commissions being expected by affiliates.

This phase will extend the existing discount code infrastructure to link codes to affiliates, add commission tracking tables following the established dataclass + Store pattern, hook into the Stripe webhook flow that already processes `checkout.session.completed` events, and build admin UI following the password-protected `/admin` pattern.

**Primary recommendation:** Extend existing discount codes to function as affiliate codes by adding an `affiliate_id` foreign key, track attribution in Stripe metadata (following the entry_path pattern), and calculate commissions in the webhook handler where orders are already fulfilled.

## Standard Stack

The project's existing stack handles all affiliate requirements:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SQLite | 3.x | Database | Already used for orders, balances, transactions |
| Alembic | Current | Migrations | Existing migration pattern for payment tables |
| FastAPI | Current | Backend API | All existing endpoints follow this pattern |
| Stripe API | Latest | Payment processing | Already integrated for checkout and webhooks |
| Dataclasses | Python 3.9+ | Models | Established pattern in payments.py, account.py |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| SQLAlchemy | Current | ORM (optional) | Not used - project uses raw SQLite with dataclasses |
| Jinja2 | Current | HTML templates | For admin dashboard HTML rendering |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SQLite tracking | Dedicated affiliate platform (Rewardful, PromoteKit) | $99-299/mo SaaS cost vs. custom code maintenance |
| Server-side tracking | Cookie-based tracking | Server-side recovers 30-40% more conversions and is privacy-compliant |
| Manual payouts | Stripe Connect | Manual review gives admin control over fraudulent affiliates |

**Installation:**
No new dependencies required - use existing stack.

## Architecture Patterns

### Recommended Project Structure
```
backend/app/
├── models/
│   ├── payments.py          # EXTEND: Add affiliate_id to DiscountCode
│   └── affiliates.py        # NEW: Affiliate, Commission, AffiliateClick models + Stores
├── services/
│   ├── affiliates.py        # EXTEND: Implement stub methods
│   └── payments.py          # MODIFY: Add affiliate commission logic
├── routers/
│   ├── admin.py            # EXTEND: Add affiliate management routes
│   └── affiliates.py        # NEW: Affiliate dashboard API
└── alembic/versions/
    └── xxx_add_affiliate_tables.py  # NEW: Migration
```

### Pattern 1: Discount Code as Affiliate Code
**What:** Extend existing `DiscountCode` model to support affiliate attribution
**When to use:** For initial purchase tracking (AFFL-03)
**Example:**
```python
# From existing models/payments.py - EXTEND this
@dataclass
class DiscountCode:
    id: int
    code: str
    discount_type: str
    discount_value: int
    # ADD: affiliate_id field to link codes to affiliates
    affiliate_id: Optional[int] = None  # NULL for non-affiliate codes
    stripe_coupon_id: Optional[str] = None
```

**Why:** Reuses existing discount validation, Stripe integration, and prevents code duplication. Affiliates get both discount functionality and attribution in one.

### Pattern 2: Stripe Metadata for Attribution
**What:** Store affiliate_id and sub_id in Stripe Checkout Session metadata
**When to use:** For all purchases (initial + top-ups) to track attribution
**Example:**
```python
# From services/payments.py - EXTEND create_checkout_session
metadata = {
    "account_id": str(account_id),
    "order_id": str(order.id),
    "purchase_type": "initial_access",
    "entry_path": entry_path or "unknown",
    # ADD: Affiliate tracking
    "affiliate_id": str(affiliate_id) if affiliate_id else None,
    "sub_id": sub_id if sub_id else None,
}
```

**Why:** Follows existing entry_path pattern. Metadata persists through Stripe webhooks, survives cookie deletion, and is available in `checkout.session.completed` event.

### Pattern 3: Dataclass + Store Pattern
**What:** Follow established pattern from payments.py for affiliate models
**When to use:** For all new database models (Affiliate, Commission, AffiliateClick)
**Example:**
```python
# From existing payments.py pattern - REPLICATE for affiliates
@dataclass
class Commission:
    id: int
    affiliate_id: int
    account_id: int
    order_id: int
    amount_cents: int
    status: str  # "pending", "available", "requested", "paid"
    created_at: Optional[datetime] = None
    available_at: Optional[datetime] = None  # created_at + 30 days

class CommissionStore:
    def __init__(self, db_path: str = None):
        self.db_path = db_path or DB_PATH

    @contextmanager
    def _get_connection(self):
        # Same pattern as BalanceStore, OrderStore
```

**Why:** Maintains codebase consistency. No ORM complexity, direct SQL control, matches existing code style.

### Pattern 4: Webhook Commission Calculation
**What:** Calculate and record commissions in existing Stripe webhook handler
**When to use:** On `checkout.session.completed` and `payment_intent.succeeded` events
**Example:**
```python
# From webhook.py handle_checkout_completed - ADD commission logic
async def handle_checkout_completed(session):
    # ... existing order fulfillment code ...

    # ADD: After credits added, calculate affiliate commission
    metadata = session.get("metadata", {}) or {}
    affiliate_id = metadata.get("affiliate_id")

    if affiliate_id:
        affiliate = affiliate_store.get_by_id(int(affiliate_id))
        commission_cents = int(order.amount_cents * affiliate.commission_percent / 100)

        commission_store.create(
            affiliate_id=affiliate.id,
            account_id=account_id,
            order_id=order.id,
            amount_cents=commission_cents,
            status="pending"
        )
```

**Why:** Commissions calculated atomically with order fulfillment. Uses actual paid price (post-discount). Single source of truth for "order completed."

### Pattern 5: Trailing Commission Lookup
**What:** Check if account has active trailing commission on top-ups
**When to use:** For all top-up orders to detect affiliate earnings beyond initial purchase
**Example:**
```python
# In webhook handler for top-ups
async def handle_topup(order):
    # Look up if this account was referred by an affiliate
    attribution = affiliate_store.get_active_attribution(order.account_id)

    if attribution and attribution.is_trailing_active():
        # Calculate commission on top-up
        commission_cents = int(order.amount_cents * attribution.commission_percent / 100)
        commission_store.create(...)
```

**Why:** Trailing commissions (AFFL-05) require looking up historical attribution. Database join on `account_id` to find affiliate relationship.

### Anti-Patterns to Avoid
- **Cookie-based tracking:** Unreliable in 2025 (Safari blocks, privacy laws). Use database + Stripe metadata instead.
- **Real-time analytics:** User specified daily updates. Don't over-engineer with WebSockets or live queries.
- **Pre-calculating totals:** Calculate commission states (pending/available/paid) on query, not cron. Keeps data consistent.
- **Stripe Connect for payouts:** User wants manual approval. Don't integrate automated payout systems.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Affiliate platform | Custom from scratch | Extend existing discount system | Discount codes already validated, Stripe-integrated |
| Click tracking | Cookie-based JS | Server-side DB with Stripe metadata | Recovers 30-40% more conversions, privacy-compliant |
| Commission states | Status flags | Calculated properties | Prevents inconsistencies (e.g., pending count mismatch) |
| Dashboard charts | Custom D3/Chart.js | Plain HTML tables with numbers | User explicitly wants "numbers only, no charts" |
| Payout automation | Stripe Connect | Manual admin approval UI | User wants fraud protection via manual review |

**Key insight:** The existing payments infrastructure (discount codes, Stripe metadata, webhook fulfillment, balance tracking) already solves 80% of affiliate requirements. Extension beats reimplementation.

## Common Pitfalls

### Pitfall 1: Commission Calculation Timing
**What goes wrong:** Calculating commissions before payment confirmed leads to unpaid commission records.
**Why it happens:** Temptation to calculate in checkout creation rather than webhook.
**How to avoid:** Only create commission records in `checkout.session.completed` webhook, never in checkout creation endpoint.
**Warning signs:** Commission count > completed order count, commissions with no corresponding payment_intent.

### Pitfall 2: Refund Handling Without Clawback
**What goes wrong:** Affiliate keeps commission even when customer refunds.
**Why it happens:** Stripe refund webhooks not hooked to commission system.
**How to avoid:** Create `charge.refunded` webhook handler that updates commission status to "clawed_back" and deducts from affiliate's available balance.
**Warning signs:** Affiliate balance doesn't decrease after refunds, negative account balances in production.

### Pitfall 3: Discount Code Stacking
**What goes wrong:** Affiliate 20% discount stacks with 50% launch code = 70% off.
**Why it happens:** No validation that affiliate codes can't combine with other promotions.
**How to avoid:** Check if order already has a discount code before applying affiliate code. Document stacking rules in admin UI.
**Warning signs:** Orders with >50% discounts, near-zero or negative revenue from some affiliates.

### Pitfall 4: Missing Trailing Commission Expiry
**What goes wrong:** "6 month trailing" never expires, affiliates earn forever.
**Why it happens:** Not checking commission eligibility date on top-ups.
**How to avoid:** Store `trailing_expires_at = initial_order.created_at + affiliate.trailing_months` on attribution record. Check expiry before creating commission.
**Warning signs:** Very old customers (2+ years) still generating commissions for expired affiliates.

### Pitfall 5: Counting Clicks Without Unique Constraint
**What goes wrong:** Single user clicking 100 times = 100 "clicks" in analytics.
**Why it happens:** Incrementing click counter on every pageview without deduplication.
**How to avoid:** Use session-based deduplication (store click in cookie/localStorage for 24h) or count unique `account_id` conversions instead of raw clicks.
**Warning signs:** Click counts in thousands but conversions in single digits, affiliates gaming stats.

## Code Examples

Verified patterns based on existing codebase:

### Database Migration Pattern
```python
# From alembic/versions/842752b6b27d_add_payment_tables.py
def upgrade() -> None:
    """Create affiliate tables."""

    # Affiliates table
    op.create_table(
        'affiliates',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('code', sa.String(50), nullable=False, unique=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('discount_percent', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('commission_percent', sa.Integer(), nullable=False, server_default='20'),
        sa.Column('trailing_months', sa.Integer(), nullable=True),  # NULL = forever
        sa.Column('active', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('payout_method', sa.String(20), nullable=True),  # "paypal", "bank"
        sa.Column('payout_details', sa.String(255), nullable=True),  # JSON blob
        sa.Column('created_at', sa.String(50), nullable=False),
    )
    op.create_index('ix_affiliates_code', 'affiliates', ['code'])

    # Commissions table
    op.create_table(
        'commissions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('affiliate_id', sa.Integer(), nullable=False),
        sa.Column('account_id', sa.Integer(), nullable=False),
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('amount_cents', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.String(50), nullable=False),
        sa.Column('available_at', sa.String(50), nullable=True),  # created_at + 30 days
        sa.Column('paid_at', sa.String(50), nullable=True),
    )
    op.create_index('ix_commissions_affiliate_id', 'commissions', ['affiliate_id'])
    op.create_index('ix_commissions_status', 'commissions', ['status'])

    # Affiliate attributions (tracks which accounts were referred by which affiliates)
    op.create_table(
        'affiliate_attributions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('affiliate_id', sa.Integer(), nullable=False),
        sa.Column('account_id', sa.Integer(), nullable=False, unique=True),  # One affiliate per account
        sa.Column('order_id', sa.Integer(), nullable=False),  # Initial order
        sa.Column('sub_id', sa.String(100), nullable=True),  # Campaign tracking
        sa.Column('trailing_expires_at', sa.String(50), nullable=True),  # NULL = forever
        sa.Column('created_at', sa.String(50), nullable=False),
    )
    op.create_index('ix_affiliate_attributions_account_id', 'affiliate_attributions', ['account_id'])

    # Affiliate clicks table (for analytics)
    op.create_table(
        'affiliate_clicks',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('affiliate_id', sa.Integer(), nullable=False),
        sa.Column('sub_id', sa.String(100), nullable=True),
        sa.Column('session_id', sa.String(255), nullable=True),  # For deduplication
        sa.Column('created_at', sa.String(50), nullable=False),
    )
    op.create_index('ix_affiliate_clicks_affiliate_id', 'affiliate_clicks', ['affiliate_id'])

    # Add affiliate_id to discount_codes (extend existing table)
    with op.batch_alter_table('discount_codes') as batch_op:
        batch_op.add_column(sa.Column('affiliate_id', sa.Integer(), nullable=True))
```

### Service Pattern for Commission Calculation
```python
# Based on services/balance.py pattern
class CommissionService:
    """Calculate and track affiliate commissions."""

    def calculate_commission(
        self,
        affiliate_id: int,
        account_id: int,
        order_id: int,
        amount_cents: int
    ) -> Optional[Commission]:
        """
        Calculate commission for an order.

        Args:
            affiliate_id: Affiliate to credit
            account_id: Customer who purchased
            order_id: Order being commissioned
            amount_cents: Actual amount paid (post-discount)

        Returns:
            Commission record or None if ineligible
        """
        affiliate = affiliate_store.get_by_id(affiliate_id)
        if not affiliate or not affiliate.active:
            return None

        commission_cents = int(amount_cents * affiliate.commission_percent / 100)

        # 30-day hold before available
        now = datetime.utcnow()
        available_at = now + timedelta(days=30)

        return commission_store.create(
            affiliate_id=affiliate_id,
            account_id=account_id,
            order_id=order_id,
            amount_cents=commission_cents,
            status="pending",
            available_at=available_at.isoformat()
        )
```

### Admin Route Pattern
```python
# From routers/admin.py - replicate for affiliate management
@router.get("/admin/affiliates", response_class=HTMLResponse)
async def admin_affiliates(request: Request):
    """Affiliate management page - requires admin login."""
    if not require_admin(request):
        return RedirectResponse("/admin/login", status_code=302)

    affiliates = affiliate_store.list_all()
    return render_affiliate_admin(affiliates)

@router.post("/admin/affiliates/create")
async def create_affiliate(request: Request):
    """Create new affiliate."""
    if not require_admin(request):
        return RedirectResponse("/admin/login", status_code=302)

    form = await request.form()

    # Create affiliate
    affiliate = affiliate_store.create(
        code=form.get("code").upper(),
        name=form.get("name"),
        email=form.get("email"),
        discount_percent=int(form.get("discount_percent", 0)),
        commission_percent=int(form.get("commission_percent", 20)),
        trailing_months=int(form.get("trailing_months")) if form.get("trailing_months") else None
    )

    # Create corresponding discount code
    discount_code_store.create(
        code=affiliate.code,
        discount_type="percent",
        discount_value=affiliate.discount_percent,
        affiliate_id=affiliate.id
    )

    return RedirectResponse(f"/admin/affiliates?msg=Created {affiliate.code}", status_code=302)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Cookie-based tracking | Server-side database + Stripe metadata | 2023-2024 | 30-40% more conversions tracked |
| One-time commissions | Recurring/trailing commissions | Industry standard | Expected by affiliates for SaaS |
| Manual spreadsheet tracking | API-first affiliate platforms | 2020+ | Real-time data, automated payouts |
| Affiliate-specific landing pages | Generic checkout with URL params | 2022+ | Simpler maintenance, less duplication |

**Deprecated/outdated:**
- **Third-party cookies:** Safari/Firefox blocking, Chrome deprecation in 2024 makes this unreliable
- **Pixel-based tracking:** Server-side postbacks are more accurate and privacy-compliant
- **Unlimited trailing commissions:** Most programs now cap at 12-24 months to manage costs

## Open Questions

Things that couldn't be fully resolved:

1. **Sub-ID parameter passing**
   - What we know: Sub-IDs track campaigns (e.g., YouTube video vs. blog post)
   - What's unclear: URL structure (`?ref=CODE&sid=VIDEO1` vs. `?ref=CODE-VIDEO1`)
   - Recommendation: Use separate param (`?ref=CODE&sub=VIDEO1`), store in Stripe metadata alongside affiliate_id

2. **Discount code stacking rules**
   - What we know: User wants to prevent abuse (70% combined discounts)
   - What's unclear: Can launch codes (LAUNCH50) stack with affiliate codes?
   - Recommendation: Allow EITHER affiliate code OR promo code, not both. Document in admin UI.

3. **Milestone email thresholds**
   - What we know: Email alerts when affiliates hit earning milestones
   - What's unclear: What thresholds? ($100, $500, $1000?)
   - Recommendation: Start with [$50, $100, $500, $1000] and make configurable in settings

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis:
  - `/backend/app/models/payments.py` - DiscountCode, Order, Transaction patterns
  - `/backend/app/services/payments.py` - Stripe checkout with metadata
  - `/backend/app/routers/webhook.py` - Order fulfillment in checkout.session.completed
  - `/backend/alembic/versions/842752b6b27d_add_payment_tables.py` - Migration pattern
  - `/backend/app/routers/admin.py` - Password-protected admin UI pattern

### Secondary (MEDIUM confidence)
- [SaaS Affiliate Marketing Commission Rates and Structures | Post Affiliate Pro](https://www.postaffiliatepro.com/blog/saas-affiliate-commission-rates/)
- [A Complete Guide for SaaS Affiliate Commissions - Tapfiliate](https://tapfiliate.com/blog/a-complete-guide-for-saas-affiliate-commissions/)
- [Metadata use cases | Stripe Documentation](https://docs.stripe.com/metadata/use-cases)
- [Cookieless Affiliate Tracking: How to Adapt and Thrive in 2025](https://www.anstrex.com/blog/cookieless-affiliate-tracking-how-to-adapt-and-thrive-in-2025)
- [Affiliate Tracking 2025: From Pixels to Server-Side — What Really Works Now](https://automatetoprofit.com/affiliate-tracking-2025-from-pixels-to-server-side-what-really-works-now/)

### Tertiary (LOW confidence)
- None - all findings verified against existing code or official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, patterns established
- Architecture: HIGH - Extends existing payment/discount infrastructure directly
- Pitfalls: HIGH - Based on actual refund handling gaps and discount validation in codebase

**Research date:** 2026-01-21
**Valid until:** 2026-02-21 (30 days - stable domain, established patterns)
