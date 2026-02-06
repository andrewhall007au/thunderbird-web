#!/usr/bin/env python3
"""
Real-World Usage Coverage Analysis

Shows how many CAST commands fit within $3 SMS gateway budget.
This is the ACTUAL cost to Thunderbird, not customer revenue.

$3 SMS budget = rough cost for a week-long trip with heavy usage
"""

import math

# SMS Gateway Costs (actual provider costs)
TWILIO_COST_PER_SEGMENT = 0.0083
TELNYX_COST_PER_SEGMENT = 0.0040

# Budget constraint
SMS_BUDGET = 3.00  # $3 actual SMS gateway spend

# Command segment usage (from earlier analysis)
CAST7_SEGMENTS = 3   # 7-day forecast
CAST12_SEGMENTS = 4  # 12-hour forecast
CAST24_SEGMENTS = 8  # 24-hour forecast

# Provider data
PROVIDERS = [
    ("Twilio", TWILIO_COST_PER_SEGMENT, "Current provider, premium pricing"),
    ("Telnyx", TELNYX_COST_PER_SEGMENT, "Best value, global coverage"),
]


def calculate_coverage(provider_name, cost_per_segment, description):
    """Calculate how many commands fit in $3 budget."""

    print(f"\n{'='*80}")
    print(f"{provider_name.upper()}: {description}")
    print(f"Rate: ${cost_per_segment:.4f}/segment")
    print(f"{'='*80}")

    # Total segments available
    total_segments = math.floor(SMS_BUDGET / cost_per_segment)

    print(f"\n💰 BUDGET ALLOCATION")
    print(f"   SMS Gateway Budget: ${SMS_BUDGET:.2f}")
    print(f"   Cost per segment: ${cost_per_segment:.4f}")
    print(f"   Total segments: {total_segments}")

    # Commands per type
    cast7_count = math.floor(total_segments / CAST7_SEGMENTS)
    cast12_count = math.floor(total_segments / CAST12_SEGMENTS)
    cast24_count = math.floor(total_segments / CAST24_SEGMENTS)

    print(f"\n📊 COMMAND CAPACITY (Single Command Type)")
    print(f"   CAST7  (3 seg):  {cast7_count:>3} commands")
    print(f"   CAST12 (4 seg):  {cast12_count:>3} commands")
    print(f"   CAST24 (8 seg):  {cast24_count:>3} commands")

    # Real-world usage scenarios
    print(f"\n🏔️  REAL-WORLD TRIP SCENARIOS")

    # Scenario 1: 7-day trip, balanced usage
    print(f"\n   Scenario 1: Week-long trip, balanced usage")
    s1_cast7 = 1   # One overview at start
    s1_cast24 = 7  # Daily 24hr forecast
    s1_cast12 = 14 # Twice-daily 12hr updates
    s1_segments = (s1_cast7 * CAST7_SEGMENTS +
                   s1_cast24 * CAST24_SEGMENTS +
                   s1_cast12 * CAST12_SEGMENTS)
    s1_cost = s1_segments * cost_per_segment
    s1_fits = s1_segments <= total_segments

    print(f"   - 1× CAST7 (trip overview)")
    print(f"   - 7× CAST24 (daily 24hr forecast)")
    print(f"   - 14× CAST12 (2× daily updates)")
    print(f"   Segments: {s1_segments}")
    print(f"   Cost: ${s1_cost:.2f}")
    print(f"   Fits in budget? {'✅ YES' if s1_fits else '❌ NO'}")
    if s1_fits:
        remaining = total_segments - s1_segments
        print(f"   Remaining: {remaining} segments (${remaining * cost_per_segment:.2f})")

    # Scenario 2: 7-day trip, CAST24 only
    print(f"\n   Scenario 2: Week-long trip, daily CAST24 only")
    s2_cast24 = 7
    s2_segments = s2_cast24 * CAST24_SEGMENTS
    s2_cost = s2_segments * cost_per_segment
    s2_fits = s2_segments <= total_segments

    print(f"   - 7× CAST24 (daily 24hr forecast)")
    print(f"   Segments: {s2_segments}")
    print(f"   Cost: ${s2_cost:.2f}")
    print(f"   Fits in budget? {'✅ YES' if s2_fits else '❌ NO'}")
    if s2_fits:
        remaining = total_segments - s2_segments
        extra_cast24 = math.floor(remaining / CAST24_SEGMENTS)
        print(f"   Remaining: {remaining} segments")
        print(f"   Could add {extra_cast24} more CAST24 commands")

    # Scenario 3: 7-day trip, CAST12 only (minimal)
    print(f"\n   Scenario 3: Week-long trip, CAST12 only")
    s3_cast12 = 14  # 2× daily
    s3_segments = s3_cast12 * CAST12_SEGMENTS
    s3_cost = s3_segments * cost_per_segment
    s3_fits = s3_segments <= total_segments

    print(f"   - 14× CAST12 (2× daily for 7 days)")
    print(f"   Segments: {s3_segments}")
    print(f"   Cost: ${s3_cost:.2f}")
    print(f"   Fits in budget? {'✅ YES' if s3_fits else '❌ NO'}")
    if s3_fits:
        remaining = total_segments - s3_segments
        extra_cast12 = math.floor(remaining / CAST12_SEGMENTS)
        print(f"   Remaining: {remaining} segments")
        print(f"   Could add {extra_cast12} more CAST12 commands")

    # Scenario 4: Extended 14-day trip
    print(f"\n   Scenario 4: Extended 14-day trip")
    s4_cast7 = 2   # Overview at start + mid-trip
    s4_cast24 = 14 # Daily 24hr
    s4_cast12 = 28 # Twice-daily
    s4_segments = (s4_cast7 * CAST7_SEGMENTS +
                   s4_cast24 * CAST24_SEGMENTS +
                   s4_cast12 * CAST12_SEGMENTS)
    s4_cost = s4_segments * cost_per_segment
    s4_fits = s4_segments <= total_segments

    print(f"   - 2× CAST7 (start + mid-trip)")
    print(f"   - 14× CAST24 (daily 24hr forecast)")
    print(f"   - 28× CAST12 (2× daily updates)")
    print(f"   Segments: {s4_segments}")
    print(f"   Cost: ${s4_cost:.2f}")
    print(f"   Fits in budget? {'✅ YES' if s4_fits else '❌ NO'}")
    if not s4_fits:
        deficit = s4_segments - total_segments
        print(f"   Exceeds by: {deficit} segments (${deficit * cost_per_segment:.2f})")

    # Scenario 5: Heavy usage (emergency/storm monitoring)
    print(f"\n   Scenario 5: Heavy usage (storm monitoring)")
    s5_cast12 = math.floor(total_segments / CAST12_SEGMENTS)
    s5_segments = s5_cast12 * CAST12_SEGMENTS
    s5_cost = s5_segments * cost_per_segment

    print(f"   - {s5_cast12}× CAST12 (maximum possible)")
    print(f"   = {s5_cast12 // 2} days @ 2× daily")
    print(f"   OR {s5_cast12 // 4} days @ 4× daily (every 6 hours)")
    print(f"   Segments: {s5_segments}")
    print(f"   Cost: ${s5_cost:.2f}")

    return {
        'provider': provider_name,
        'cost_per_segment': cost_per_segment,
        'total_segments': total_segments,
        'cast7_max': cast7_count,
        'cast12_max': cast12_count,
        'cast24_max': cast24_count,
        's1_fits': s1_fits,
        's1_segments': s1_segments,
        's2_fits': s2_fits,
        's3_fits': s3_fits,
        's4_fits': s4_fits,
        's4_segments': s4_segments,
    }


def main():
    print("\n" + "="*80)
    print("REAL-WORLD USAGE COVERAGE ANALYSIS")
    print(f"Budget: ${SMS_BUDGET:.2f} SMS Gateway Spend")
    print("="*80)

    print(f"\n📱 COMMAND SIZES")
    print(f"   CAST7:  {CAST7_SEGMENTS} segments (7-day forecast)")
    print(f"   CAST12: {CAST12_SEGMENTS} segments (12-hour forecast)")
    print(f"   CAST24: {CAST24_SEGMENTS} segments (24-hour forecast)")

    results = []
    for provider_name, cost, desc in PROVIDERS:
        results.append(calculate_coverage(provider_name, cost, desc))

    # Comparison table
    print(f"\n{'='*80}")
    print("PROVIDER COMPARISON TABLE")
    print(f"{'='*80}")

    print(f"\n💰 SEGMENT BUDGET (${SMS_BUDGET:.2f} gateway spend)")
    print(f"\n{'Provider':<12} {'$/Segment':<12} {'Total Segs':<12} {'CAST7':<10} {'CAST12':<10} {'CAST24':<10}")
    print("-" * 80)
    for r in results:
        print(f"{r['provider']:<12} ${r['cost_per_segment']:<11.4f} {r['total_segments']:<12} "
              f"{r['cast7_max']:<10} {r['cast12_max']:<10} {r['cast24_max']:<10}")

    print(f"\n🏔️  TRIP SCENARIO COVERAGE")
    print(f"\n{'Provider':<12} {'7-day Mix':<15} {'7-day CAST24':<15} {'7-day CAST12':<15} {'14-day Mix':<15}")
    print("-" * 80)
    for r in results:
        s1_status = '✅ Fits' if r['s1_fits'] else '❌ No'
        s2_status = '✅ Fits' if r['s2_fits'] else '❌ No'
        s3_status = '✅ Fits' if r['s3_fits'] else '❌ No'
        s4_status = '✅ Fits' if r['s4_fits'] else f"❌ {r['s4_segments']} seg"

        print(f"{r['provider']:<12} {s1_status:<15} {s2_status:<15} {s3_status:<15} {s4_status:<15}")

    # Key insights
    print(f"\n{'='*80}")
    print("KEY INSIGHTS")
    print(f"{'='*80}")

    twilio_result = results[0]
    telnyx_result = results[1]

    print(f"\n📊 Coverage Comparison:")
    print(f"   Twilio: {twilio_result['total_segments']} segments (${SMS_BUDGET:.2f})")
    print(f"   Telnyx: {telnyx_result['total_segments']} segments (${SMS_BUDGET:.2f})")
    print(f"   Difference: {telnyx_result['total_segments'] - twilio_result['total_segments']} more segments with Telnyx")
    print(f"   That's {((telnyx_result['total_segments'] - twilio_result['total_segments']) / twilio_result['total_segments'] * 100):.0f}% more capacity")

    print(f"\n✅ Real-World Verdict:")
    print(f"   ${SMS_BUDGET:.2f} gateway budget covers:")
    print(f"   • 7-day trip with balanced usage (CAST7 + CAST24 + CAST12): ✅ Both providers")
    print(f"   • 7-day trip with daily CAST24 only: ✅ Both providers")
    print(f"   • 7-day trip with 2× daily CAST12: ✅ Both providers")

    if twilio_result['s4_fits']:
        print(f"   • 14-day extended trip: ✅ Both providers")
    else:
        print(f"   • 14-day extended trip: ❌ Twilio, ✅ Telnyx" if telnyx_result['s4_fits'] else "❌ Both (need ${:.2f})".format((twilio_result['s4_segments'] - twilio_result['total_segments']) * twilio_result['cost_per_segment']))

    print(f"\n💡 Recommendation:")
    print(f"   ${SMS_BUDGET:.2f} SMS budget is sufficient for:")
    print(f"   • Most 7-day trips with heavy forecast usage")
    print(f"   • Telnyx provides {telnyx_result['total_segments'] - twilio_result['total_segments']} extra segments for same cost")
    print(f"   • That's ~{(telnyx_result['total_segments'] - twilio_result['total_segments']) // CAST12_SEGMENTS} more CAST12 commands")
    print(f"     or ~{(telnyx_result['total_segments'] - twilio_result['total_segments']) // CAST24_SEGMENTS} more CAST24 commands")

    print(f"\n{'='*80}\n")


if __name__ == "__main__":
    main()
