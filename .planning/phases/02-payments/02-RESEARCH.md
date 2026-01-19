# Phase 2: Payments - Research

**Researched:** 2026-01-19
**Domain:** Stripe Checkout integration, discount codes, balance tracking, country-specific SMS pricing
**Confidence:** HIGH

## Summary

Phase 2 implements a payment system for one-time purchases ($29.99 initial access) plus top-ups ($10 blocks) using Stripe Checkout. The business model is NOT subscription-based - this is a key differentiator. Users pre-pay for SMS credits, with pricing varying by country to maintain an 80% minimum margin on messaging costs.

The implementation requires Stripe Checkout for the hosted payment flow (avoiding PCI compliance burden), webhook handling for payment confirmation, stored cards for one-click top-ups, and a custom balance/credits tracking system stored locally (not relying solely on Stripe's customer balance feature). Discount codes use Stripe's promotion code system with stacking support.

**Primary recommendation:** Use Stripe Checkout with `payment_intent_data.setup_future_usage: "off_session"` for initial purchase, PaymentIntent API with stored payment methods for top-ups, local balance tracking with Stripe as payment processor only, and SendGrid for order confirmation emails.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| stripe | >=14.1.0 | Stripe Python SDK | Official SDK, full API coverage, async support |
| sendgrid | >=6.11.0 | Transactional email | Twilio-owned, reliable, good Python SDK |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| python-decimal | stdlib | Precise currency math | All money calculations |
| httpx | >=0.26.0 | Async HTTP (already installed) | Twilio pricing API calls |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Stripe Checkout | Custom payment form | More control but PCI compliance burden |
| SendGrid | Mailgun, Amazon SES | SendGrid integrates well since Twilio owns both |
| Local balance tracking | Stripe Customer Balance | Stripe balance auto-applies to invoices; we need SMS credit tracking |

**Installation:**
```bash
pip install stripe sendgrid
```

Note: httpx already in requirements.txt.

## Architecture Patterns

### Recommended Project Structure
```
backend/
├── app/
│   ├── routers/
│   │   ├── payments.py       # NEW: Checkout, top-up, webhook endpoints
│   │   └── ...existing...
│   ├── services/
│   │   ├── payments.py       # UPDATE: Stripe integration logic
│   │   ├── balance.py        # NEW: Balance/credits tracking
│   │   ├── pricing.py        # NEW: Dynamic pricing + discount logic
│   │   ├── email.py          # NEW: SendGrid integration
│   │   └── ...existing...
│   └── models/
│       ├── payments.py       # NEW: Order, Balance, DiscountCode models
│       └── ...existing...
├── config/
│   └── sms_pricing.py        # NEW: Country-specific SMS rates
└── alembic/
    └── versions/
        └── xxx_add_payments_tables.py  # Migration for payment tables
```

### Pattern 1: Stripe Checkout Session Creation
**What:** Create hosted checkout session for initial purchase
**When to use:** Initial $29.99 purchase with card storage
**Example:**
```python
# Source: https://docs.stripe.com/payments/checkout/save-during-payment
from stripe import StripeClient

client = StripeClient(settings.STRIPE_SECRET_KEY)

session = client.v1.checkout.sessions.create({
    "customer_creation": "always",  # Create Stripe customer
    "line_items": [{
        "price_data": {
            "currency": "usd",
            "product_data": {"name": "Thunderbird Access"},
            "unit_amount": price_cents,  # Dynamic: 2999, or discounted
        },
        "quantity": 1,
    }],
    "mode": "payment",
    "payment_intent_data": {
        "setup_future_usage": "off_session",  # Save card for top-ups
    },
    "allow_promotion_codes": True,  # Enable discount code field
    "metadata": {
        "account_id": str(account_id),
        "purchase_type": "initial_access",
    },
    "success_url": f"{base_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
    "cancel_url": f"{base_url}/payment/cancel",
})
```

### Pattern 2: Webhook Signature Verification
**What:** Securely verify Stripe webhook events
**When to use:** All webhook handlers
**Example:**
```python
# Source: https://docs.stripe.com/webhooks
import stripe
from fastapi import APIRouter, Request, HTTPException

router = APIRouter(prefix="/webhook", tags=["webhook"])

@router.post("/stripe")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event.type == "checkout.session.completed":
        session = event.data.object
        account_id = int(session.metadata.get("account_id"))
        await handle_successful_payment(account_id, session)

    return {"status": "success"}
```

### Pattern 3: Off-Session Payment with Stored Card
**What:** Charge stored card for top-ups (one-click)
**When to use:** Web top-up, SMS "BUY $10" command
**Example:**
```python
# Source: https://docs.stripe.com/payments/save-and-reuse
async def charge_stored_card(
    stripe_customer_id: str,
    payment_method_id: str,
    amount_cents: int,
    account_id: int
) -> PaymentResult:
    try:
        payment_intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency="usd",
            customer=stripe_customer_id,
            payment_method=payment_method_id,
            off_session=True,
            confirm=True,
            metadata={
                "account_id": str(account_id),
                "purchase_type": "top_up",
            }
        )
        return PaymentResult(success=True, transaction_id=payment_intent.id)
    except stripe.error.CardError as e:
        return PaymentResult(success=False, error=str(e.user_message))
```

### Pattern 4: Local Balance Tracking
**What:** Track SMS credits locally, not in Stripe
**When to use:** Balance queries, SMS sending, low balance checks
**Example:**
```python
# backend/app/models/payments.py
@dataclass
class AccountBalance:
    account_id: int
    balance_cents: int  # Current balance in cents
    segments_remaining: int  # Calculated from balance and country rate
    updated_at: datetime

class BalanceStore:
    def add_credits(self, account_id: int, amount_cents: int, transaction_id: str):
        """Add credits after successful payment."""
        # Insert transaction record
        # Update balance
        pass

    def deduct_sms_cost(self, account_id: int, country: str, segments: int) -> bool:
        """Deduct cost for sent SMS. Returns False if insufficient balance."""
        cost = self.calculate_sms_cost(country, segments)
        # Check balance >= cost
        # Deduct and record transaction
        pass

    def get_balance(self, account_id: int) -> AccountBalance:
        """Get current balance with segment calculation."""
        pass
```

### Anti-Patterns to Avoid

- **Trusting success URL for fulfillment:** ALWAYS fulfill orders via webhook, never from success page redirect
- **Storing card details:** Use Stripe's stored payment methods, never store card data
- **Calculating prices client-side:** All pricing logic server-side; client receives final amount
- **Single balance update without transaction log:** Always create transaction record, then update balance
- **Blocking webhook response:** Process async, return 200 quickly (within 20 seconds)

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Payment processing | Custom card handling | Stripe Checkout | PCI compliance, security |
| Discount codes | Custom coupon system | Stripe Promotion Codes | Built-in validation, usage limits |
| Card storage | Encrypted card vault | Stripe PaymentMethods | Token-based, PCI compliant |
| Email delivery | SMTP direct send | SendGrid | Deliverability, tracking, templates |
| Webhook verification | Custom HMAC | stripe.Webhook.construct_event | Handles replay protection |
| Currency formatting | String formatting | Python Decimal + locale | Precision, internationalization |

**Key insight:** Stripe handles all card security; we handle balance tracking locally because Stripe's Customer Balance is designed for invoice credits, not pre-paid SMS credits.

## Common Pitfalls

### Pitfall 1: Relying on Success Page for Fulfillment
**What goes wrong:** Customer completes payment but credits not added
**Why it happens:** Success URL can be faked, interrupted, or user closes browser
**How to avoid:**
1. ONLY fulfill via checkout.session.completed webhook
2. Success page just shows confirmation, doesn't trigger fulfillment
3. Implement idempotency - store processed event IDs
**Warning signs:** Credits missing after payment, duplicate credits on retry

### Pitfall 2: Floating Point Money Calculations
**What goes wrong:** Rounding errors in balance calculations
**Why it happens:** Using float instead of integer cents or Decimal
**How to avoid:**
1. Store all amounts as integer cents
2. Use Python Decimal for calculations
3. Convert to dollars only for display
**Warning signs:** Balance off by 1 cent, accumulated errors over time

### Pitfall 3: Webhook Endpoint Timeout
**What goes wrong:** Stripe retries webhook, causes duplicate processing
**Why it happens:** Webhook handler takes >20 seconds
**How to avoid:**
1. Return 200 immediately after signature verification
2. Process fulfillment asynchronously (BackgroundTasks or queue)
3. Implement idempotency with event ID tracking
**Warning signs:** Duplicate orders, Stripe dashboard shows webhook failures

### Pitfall 4: Discount Code Stacking Logic
**What goes wrong:** Discounts applied incorrectly with launch pricing
**Why it happens:** Not understanding Stripe's discount vs our pricing tiers
**How to avoid:**
1. Launch price ($29.99) is our product price, not a Stripe discount
2. Discount codes are Stripe promotion codes on top of our price
3. Configure promotion codes in Stripe with percentage/fixed off
4. Test all combinations: launch + 10% code, launch + $5 code
**Warning signs:** Total goes negative, discounts not stacking correctly

### Pitfall 5: Country Detection for SMS Pricing
**What goes wrong:** Wrong rate applied, margin below 80%
**Why it happens:** Relying on IP geolocation or user input for country
**How to avoid:**
1. Use phone number to determine country (already normalized in system)
2. Parse E.164 format to extract country code
3. Fall back to highest rate if country unknown
**Warning signs:** Negative margin on international SMS, rate lookup failures

### Pitfall 6: Stored Card Declined Off-Session
**What goes wrong:** Top-up fails, user doesn't know why
**Why it happens:** Card expired, insufficient funds, 3DS required
**How to avoid:**
1. Handle CardError exception specifically
2. Send notification to user when off-session charge fails
3. For web top-ups, can redirect to re-auth if needed
4. For SMS top-ups, send failure SMS
**Warning signs:** Silent payment failures, stuck top-up requests

## Code Examples

Verified patterns from official sources:

### Creating Stripe Promotion Codes
```python
# Source: https://docs.stripe.com/api/promotion_codes
# First create a coupon, then create promotion codes for it

# Create 10% off coupon
coupon = stripe.Coupon.create(
    percent_off=10,
    duration="once",
    name="10% Launch Discount"
)

# Create customer-facing code
promo_code = stripe.PromotionCode.create(
    coupon=coupon.id,
    code="LAUNCH10",
    max_redemptions=100,
    restrictions={
        "first_time_transaction": False,  # Allow existing customers
    }
)
```

### Order Confirmation Email with SendGrid
```python
# Source: https://github.com/sendgrid/sendgrid-python
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

async def send_order_confirmation(
    email: str,
    sms_number: str,
    amount_paid: int,
    segments_received: int
):
    message = Mail(
        from_email="noreply@thunderbird.app",
        to_emails=email,
        subject="Welcome to Thunderbird - Your SMS Number",
    )
    message.dynamic_template_data = {
        "sms_number": sms_number,
        "amount_paid": f"${amount_paid / 100:.2f}",
        "segments": segments_received,
        "quick_start_url": "https://thunderbird.app/quickstart",
    }
    message.template_id = settings.SENDGRID_WELCOME_TEMPLATE_ID

    sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
    response = sg.send(message)
    return response.status_code == 202
```

### SMS Top-Up Command Handler
```python
# Handle "BUY $10" SMS command
async def handle_buy_command(phone: str, amount: str) -> str:
    # Validate amount
    if amount not in ["$10", "10"]:
        return "Top-up amount must be $10. Text BUY $10 to add credits."

    # Get account by phone
    account = account_store.get_by_phone(phone)
    if not account or not account.stripe_customer_id:
        return "No payment method on file. Top up at thunderbird.app/topup"

    # Get default payment method
    payment_methods = stripe.PaymentMethod.list(
        customer=account.stripe_customer_id,
        type="card",
    )
    if not payment_methods.data:
        return "No card on file. Add one at thunderbird.app/account"

    # Charge stored card
    result = await charge_stored_card(
        stripe_customer_id=account.stripe_customer_id,
        payment_method_id=payment_methods.data[0].id,
        amount_cents=1000,
        account_id=account.id
    )

    if result.success:
        # Add credits (done via webhook, but confirm here)
        balance = balance_store.get_balance(account.id)
        return f"Success! $10 added. Balance: ${balance.balance_cents/100:.2f}"
    else:
        return f"Payment failed: {result.error}. Try at thunderbird.app/topup"
```

### Low Balance Warning Check
```python
# Called after each SMS send
async def check_low_balance_warning(account_id: int, phone: str):
    balance = balance_store.get_balance(account_id)

    if balance.balance_cents <= 200:  # $2.00 threshold
        # Check if we already warned recently (avoid spam)
        last_warning = await get_last_warning_time(account_id)
        if last_warning and (datetime.utcnow() - last_warning).days < 1:
            return  # Already warned today

        # Send warning SMS
        segments = balance_store.estimate_segments_remaining(account_id)
        await send_sms(
            phone,
            f"Low balance: ${balance.balance_cents/100:.2f} (~{segments} texts). "
            f"Top up: BUY $10 or thunderbird.app/topup"
        )
        await record_warning_sent(account_id)
```

## SMS Pricing by Country

Based on Twilio pricing research (as of 2025). Rates are per segment outbound.

| Country | ISO | Twilio Rate/Segment | With 80% Margin | Segments per $10 |
|---------|-----|---------------------|-----------------|------------------|
| USA | US | $0.0113* | $0.0566 | 176 |
| Canada | CA | $0.0170* | $0.0850 | 117 |
| United Kingdom | GB | $0.0524 | $0.2620 | 38 |
| France | FR | $0.0798 | $0.3990 | 25 |
| Italy | IT | $0.0927 | $0.4635 | 21 |
| Switzerland | CH | $0.0725 | $0.3625 | 27 |
| New Zealand | NZ | $0.1050 | $0.5250 | 19 |
| South Africa | ZA | $0.1089 | $0.5445 | 18 |

*Includes carrier fees (varies by carrier)

**Calculation formula:**
```python
# segments_per_10_dollars = floor(10.00 / (twilio_rate / 0.20))
# 80% margin means we keep 80%, Twilio gets 20%
# So customer pays: twilio_rate / 0.20 = 5x the Twilio rate

def calculate_segments_per_10_dollars(twilio_rate: float) -> int:
    customer_rate = twilio_rate / 0.20  # 80% margin
    return int(10.00 / customer_rate)
```

**Implementation note:** Store rates in config, fetch from Twilio Pricing API periodically to verify/update.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| stripe module patterns | StripeClient class | stripe-python v6+ | Cleaner async, better typing |
| Charges API | PaymentIntent API | 2019+ | SCA compliance, better UX |
| Stored tokens | PaymentMethods | 2019+ | More secure, consistent |
| Custom email | Transactional services | 2020+ | Better deliverability |

**Deprecated/outdated:**
- `stripe.Charge.create()`: Use PaymentIntent API instead
- `stripe.Token`: Use PaymentMethod instead
- Manual signature verification: Use `stripe.Webhook.construct_event()`

## Open Questions

Things that couldn't be fully resolved:

1. **Twilio rate changes without notice**
   - What we know: Twilio states "Prices may change from time to time without notice"
   - What's unclear: How often rates change, if there's a notification system
   - Recommendation: Build cost verification function (PAY-12) that compares stored rates to Twilio Pricing API weekly; alert admin on significant changes

2. **Stripe promotion code stacking limits**
   - What we know: Stripe supports "up to 20 entries in the discounts parameter"
   - What's unclear: Whether allow_promotion_codes + discounts can combine
   - Recommendation: Use allow_promotion_codes only (user enters code); don't pre-apply discounts. Test stacking in Stripe test mode.

3. **Off-session payment authentication requirements**
   - What we know: Some cards require 3DS even for off-session; Stripe handles most via exemptions
   - What's unclear: Failure rate for off-session payments across regions
   - Recommendation: Handle `requires_action` status; fall back to "visit website" message

## Sources

### Primary (HIGH confidence)
- [Stripe Checkout Save During Payment](https://docs.stripe.com/payments/checkout/save-during-payment) - Card storage pattern
- [Stripe Webhooks](https://docs.stripe.com/webhooks) - Signature verification, event handling
- [Stripe Add Discounts](https://docs.stripe.com/payments/checkout/discounts) - Promotion codes in Checkout
- [Stripe Customer Credit Balance](https://docs.stripe.com/invoicing/customer/balance) - Balance system design
- [Twilio SMS Pricing](https://www.twilio.com/en-us/pricing/messaging) - Per-country rates
- [SendGrid Python](https://github.com/sendgrid/sendgrid-python) - Email integration

### Secondary (MEDIUM confidence)
- [FastAPI Stripe Integration (FastSaaS)](https://www.fast-saas.com/blog/fastapi-stripe-integration/) - FastAPI patterns
- [Medium: Stripe Python Module](https://tariyekorogha.medium.com/i-figured-out-stripes-python-module-so-you-wouldn-t-have-to-d1ab197a6b61) - Best practices
- [Medium: FastAPI Stripe Checkout](https://medium.com/@abdulikram/building-a-payment-backend-with-fastapi-stripe-checkout-and-webhooks-08dc15a32010) - Webhook handling

### Tertiary (LOW confidence)
- Twilio per-country pricing pages - Rates verified but subject to change without notice

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Stripe/SendGrid documentation
- Architecture patterns: HIGH - Official Stripe patterns adapted for FastAPI
- SMS pricing: MEDIUM - Verified from Twilio pages but rates can change
- Pitfalls: HIGH - Well-documented in Stripe guides

**Research date:** 2026-01-19
**Valid until:** 2026-02-19 (Stripe SDK stable; verify SMS rates before launch)
