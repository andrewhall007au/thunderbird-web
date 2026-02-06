#!/usr/bin/env python3
"""
Launch Pricing Analysis: $49.99 → $29.99 with $29.99 Credits

Analyzes profitability of "free platform" model where:
- List price: $49.99
- Launch discount: $29.99 (40% off)
- Includes: $29.99 worth of SMS credits (299 segments)

This makes the platform effectively "free" - you're just buying credits at retail.
"""

# Pricing
LIST_PRICE = 49.99
LAUNCH_PRICE = 29.99
CREDITS_INCLUDED = 29.99  # Dollar value of credits included
SEGMENTS_INCLUDED = 299   # $29.99 / $0.10 per segment

# Affiliate
AFFILIATE_RATE = 0.30  # 30% commission

# Stripe fees (US)
STRIPE_PERCENTAGE = 0.029  # 2.9%
STRIPE_FIXED = 0.30        # $0.30 per transaction

# SMS costs (actual provider costs)
TWILIO_COST_PER_SEGMENT = 0.0083
TELNYX_COST_PER_SEGMENT = 0.0040

# Sales tax
# Important: In the US, Stripe adds sales tax ON TOP of the purchase price
# So if item is $29.99, customer pays $29.99 + tax
# Merchant receives $29.99, Stripe handles tax remittance
# Sales tax does NOT reduce merchant revenue
SALES_TAX_NOTE = """
Sales Tax Handling:
- Stripe adds sales tax ON TOP of purchase price
- Customer pays: $29.99 + tax (e.g., $32.99 in CA with 10% tax)
- Merchant receives: $29.99 (full amount)
- Stripe remits tax to state
- Sales tax does NOT eat into your $29.99 revenue
"""


def calculate_economics(provider_name, cost_per_segment):
    """Calculate profitability with given SMS provider."""

    print(f"\n{'='*70}")
    print(f"ECONOMICS WITH {provider_name.upper()}")
    print(f"{'='*70}")

    # Revenue
    revenue = LAUNCH_PRICE
    print(f"\n💰 REVENUE")
    print(f"   Customer pays: ${revenue:.2f}")
    print(f"   (List price ${LIST_PRICE:.2f}, discounted 40%)")

    # Costs
    print(f"\n💸 COSTS")

    # 1. Affiliate commission (30% of purchase price)
    affiliate_cost = revenue * AFFILIATE_RATE
    print(f"   Affiliate (30%): -${affiliate_cost:.2f}")

    # 2. Stripe fees
    stripe_cost = (revenue * STRIPE_PERCENTAGE) + STRIPE_FIXED
    print(f"   Stripe fees (2.9% + $0.30): -${stripe_cost:.2f}")

    # 3. SMS credits actual cost
    # Customer gets $29.99 worth of credits (299 segments)
    # But actual cost is much lower due to margin
    sms_actual_cost = SEGMENTS_INCLUDED * cost_per_segment
    customer_credit_value = CREDITS_INCLUDED
    sms_margin_pct = ((customer_credit_value - sms_actual_cost) / customer_credit_value) * 100

    print(f"   SMS credits:")
    print(f"      Customer receives: ${customer_credit_value:.2f} (299 segments)")
    print(f"      Actual {provider_name} cost: -${sms_actual_cost:.2f}")
    print(f"      SMS margin: {sms_margin_pct:.1f}%")

    # Total costs
    total_costs = affiliate_cost + stripe_cost + sms_actual_cost

    print(f"\n   TOTAL COSTS: -${total_costs:.2f}")

    # Profit
    gross_profit = revenue - total_costs
    profit_margin_pct = (gross_profit / revenue) * 100

    print(f"\n✅ NET PROFIT")
    print(f"   Profit per sale: ${gross_profit:.2f}")
    print(f"   Profit margin: {profit_margin_pct:.1f}%")

    # Break even
    print(f"\n📊 WHAT CUSTOMER GETS")
    print(f"   Platform access: 'Free' (bundled with credits)")
    print(f"   SMS credits: ${customer_credit_value:.2f} (299 segments)")
    print(f"   Perceived value: ${LIST_PRICE:.2f}")
    print(f"   Actual payment: ${LAUNCH_PRICE:.2f}")
    print(f"   Discount: ${LIST_PRICE - LAUNCH_PRICE:.2f} (40% off)")

    # Scale projections
    print(f"\n📈 SCALE PROJECTIONS")
    customers = [10, 100, 1000, 10000]
    for count in customers:
        total_revenue = revenue * count
        total_profit = gross_profit * count
        print(f"   {count:>5} customers: ${total_revenue:>9,.2f} revenue → ${total_profit:>8,.2f} profit")

    return {
        'provider': provider_name,
        'revenue': revenue,
        'affiliate_cost': affiliate_cost,
        'stripe_cost': stripe_cost,
        'sms_cost': sms_actual_cost,
        'total_costs': total_costs,
        'profit': gross_profit,
        'margin_pct': profit_margin_pct,
    }


def main():
    print("\n" + "="*70)
    print("LAUNCH PRICING ANALYSIS")
    print("$49.99 → $29.99 with $29.99 in SMS Credits")
    print("="*70)

    print(f"\n🎯 PRICING STRATEGY")
    print(f"   Original price: ${LIST_PRICE:.2f}")
    print(f"   Launch price: ${LAUNCH_PRICE:.2f} (40% discount)")
    print(f"   Credits included: ${CREDITS_INCLUDED:.2f} (299 segments)")
    print(f"   ")
    print(f"   Positioning: 'Platform is FREE, just buy credits at retail'")
    print(f"   Customer perception: Getting ${LIST_PRICE:.2f} value for ${LAUNCH_PRICE:.2f}")

    print(SALES_TAX_NOTE)

    # Calculate with both providers
    results = []
    results.append(calculate_economics("Twilio", TWILIO_COST_PER_SEGMENT))
    results.append(calculate_economics("Telnyx", TELNYX_COST_PER_SEGMENT))

    # Comparison
    print(f"\n{'='*70}")
    print("PROVIDER COMPARISON")
    print(f"{'='*70}")

    print(f"\n{'Provider':<15} {'Revenue':<12} {'SMS Cost':<12} {'Total Cost':<12} {'Profit':<12} {'Margin':<10}")
    print("-" * 70)
    for r in results:
        print(f"{r['provider']:<15} ${r['revenue']:<11.2f} ${r['sms_cost']:<11.2f} "
              f"${r['total_costs']:<11.2f} ${r['profit']:<11.2f} {r['margin_pct']:<9.1f}%")

    # Recommendation
    print(f"\n{'='*70}")
    print("RECOMMENDATION")
    print(f"{'='*70}")

    twilio_result = results[0]
    telnyx_result = results[1]

    print(f"\n✅ YES, THIS PRICING MODEL WORKS!")
    print(f"\n   Even with 30% affiliate commission and giving away ${CREDITS_INCLUDED:.2f} in credits,")
    print(f"   you still make ${twilio_result['profit']:.2f} profit per sale ({twilio_result['margin_pct']:.1f}% margin).")
    print(f"\n   Why it works:")
    print(f"   • SMS credits have {((CREDITS_INCLUDED - twilio_result['sms_cost']) / CREDITS_INCLUDED * 100):.1f}% margin")
    print(f"   • $29.99 in credits only costs you ${twilio_result['sms_cost']:.2f}")
    print(f"   • After affiliate (${twilio_result['affiliate_cost']:.2f}) and fees (${twilio_result['stripe_cost']:.2f}),")
    print(f"     you keep ~${twilio_result['profit']:.2f} per customer")

    print(f"\n   Switching to Telnyx improves profit to ${telnyx_result['profit']:.2f} (+${telnyx_result['profit'] - twilio_result['profit']:.2f})")

    print(f"\n💡 MESSAGING STRATEGY")
    print(f"   'Regular price ${LIST_PRICE:.2f}, now ${LAUNCH_PRICE:.2f}'")
    print(f"   'Includes ${CREDITS_INCLUDED:.2f} in SMS credits - platform access is FREE!'")
    print(f"   'That's 299 segments - enough for 2-3 week-long trips'")

    print(f"\n🎯 COMPETITIVE ADVANTAGE")
    print(f"   vs Garmin: They pay $549 device + $30/mo = $599 first trip")
    print(f"   vs Zoleo: They pay $349 device + $25/mo = $399 first trip")
    print(f"   vs You:    They pay ${LAUNCH_PRICE:.2f} total, no device needed")
    print(f"   ")
    print(f"   Your pricing is 13-20× cheaper for first trip!")

    # Customer LTV
    print(f"\n{'='*70}")
    print("CUSTOMER LIFETIME VALUE PROJECTION")
    print(f"{'='*70}")

    print(f"\n   Scenario: Customer does 4 trips/year for 3 years")
    print(f"   ")
    print(f"   Initial purchase: ${LAUNCH_PRICE:.2f}")
    print(f"   - Profit: ${twilio_result['profit']:.2f}")
    print(f"   ")
    print(f"   12 trips × $11.50 top-up each = $138 in top-ups")

    # Top-up economics (straight $10 credits, no affiliate on top-ups)
    topup_revenue = 11.50
    topup_segments = 115  # From earlier analysis (7-day trip)
    topup_sms_cost = topup_segments * TWILIO_COST_PER_SEGMENT
    topup_stripe = (topup_revenue * STRIPE_PERCENTAGE) + STRIPE_FIXED
    topup_profit = topup_revenue - topup_sms_cost - topup_stripe
    topup_margin = (topup_profit / topup_revenue) * 100

    print(f"   - Per top-up profit: ${topup_profit:.2f} ({topup_margin:.1f}% margin)")
    print(f"   - 12 top-ups profit: ${topup_profit * 12:.2f}")
    print(f"   ")
    print(f"   3-Year Customer LTV:")
    print(f"   - Total revenue: ${LAUNCH_PRICE:.2f} + $138 = ${LAUNCH_PRICE + 138:.2f}")
    print(f"   - Total profit: ${twilio_result['profit']:.2f} + ${topup_profit * 12:.2f} = ${twilio_result['profit'] + topup_profit * 12:.2f}")
    print(f"   - LTV: ${twilio_result['profit'] + topup_profit * 12:.2f}")

    print(f"\n{'='*70}\n")


if __name__ == "__main__":
    main()
