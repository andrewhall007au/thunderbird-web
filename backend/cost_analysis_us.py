#!/usr/bin/env python3
"""
US Cost Structure Analysis for CAST Commands

Analyzes character counts, SMS segments, and true costs for:
- CAST7 (7-day forecast, single GPS point)
- CAST12 (12-hour forecast, single GPS point)
- CAST24 (24-hour forecast, single GPS point)

Compares Twilio vs competitor pricing.
"""

import math
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

# SMS Segment Calculations
GSM7_SINGLE_SEGMENT = 160  # chars
GSM7_MULTI_SEGMENT = 153   # chars per segment (with UDH header)
UCS2_SINGLE_SEGMENT = 70   # chars (Unicode/emoji)
UCS2_MULTI_SEGMENT = 67    # chars per segment (Unicode with UDH)

# Twilio US Pricing
TWILIO_US_COST_PER_SEGMENT = 0.0083  # $0.0083 per segment

# Competitor Pricing (2024 rates - research based)
COMPETITORS = {
    "Twilio": 0.0083,
    "MessageBird": 0.0050,      # ~40% cheaper
    "Vonage (Nexmo)": 0.0055,   # ~34% cheaper
    "Plivo": 0.0048,            # ~42% cheaper
    "Telnyx": 0.0040,           # ~52% cheaper
    "Bandwidth": 0.0045,        # ~46% cheaper
}

# Thunderbird Pricing to Customer
THUNDERBIRD_US_SEGMENTS_PER_10 = 100
THUNDERBIRD_US_COST_PER_SEGMENT = 0.10  # $10 / 100 segments


def calculate_sms_segments(text: str, encoding="GSM7") -> int:
    """
    Calculate number of SMS segments required.

    Args:
        text: Message text
        encoding: "GSM7" or "UCS2"

    Returns:
        Number of SMS segments
    """
    char_count = len(text)

    if encoding == "GSM7":
        if char_count == 0:
            return 0
        elif char_count <= GSM7_SINGLE_SEGMENT:
            return 1
        else:
            return math.ceil(char_count / GSM7_MULTI_SEGMENT)
    else:  # UCS2
        if char_count == 0:
            return 0
        elif char_count <= UCS2_SINGLE_SEGMENT:
            return 1
        else:
            return math.ceil(char_count / UCS2_MULTI_SEGMENT)


def generate_cast7_sample() -> str:
    """Generate realistic CAST7 response (7-day daily forecast)."""
    return """CAST7 GPS
Lake Oberon (1200m)
7-Day Forecast

Day|Tmp|%Rn|Prec|Wa|Wm|Wd|%Cd|CB|FL|D
Mon|5-12|40%|R0-2|25|35|W|60%|8|15|
Tue|3-10|60%|R2-5|30|42|SW|75%|7|12|!
Wed|2-8|70%|R5-10/S0-1|35|48|W|85%|6|10|!!
Thu|4-11|50%|R1-3|28|38|NW|65%|9|14|
Fri|6-13|30%|R0-1|22|32|W|50%|11|16|
Sat|7-15|20%|-|18|28|W|40%|13|18|
Sun|8-16|25%|R0-2|20|30|W|45%|12|17|

Loc: GPS Point"""

def generate_cast12_sample() -> str:
    """Generate realistic CAST12 response (12-hour hourly forecast)."""
    return """CAST GPS
Lake Oberon (1200m)
Light 05:42-20:15 (14h33m)

Hr|Tmp  | %Rn|Prec|Wa|Wm|Wd| %Cd|CB|FL|D
06|  3-5| 45%|R0-2|28|38|W | 65%| 8|12|
07|  4-6| 40%|R0-1|26|36|W | 60%| 9|13|
08|  5-8| 35%|R0-1|24|34|W | 55%|10|14|
09|  7-10| 30%| -|22|32|W | 50%|11|15|
10|  8-12| 25%| -|20|30|W | 45%|12|16|
11| 9-13| 20%| -|18|28|W | 40%|13|17|
12|10-14| 20%| -|18|28|W | 40%|13|17|
13|11-15| 25%|R0-1|20|30|W | 45%|12|16|
14|10-14| 30%|R0-2|22|32|W | 50%|11|15|
15| 9-12| 35%|R1-3|24|34|W | 55%|10|14|
16| 7-10| 40%|R2-4|26|36|SW| 60%| 9|13|!
17| 6-8| 45%|R3-5|28|38|SW| 65%| 8|12|!"""


def generate_cast24_sample() -> str:
    """Generate realistic CAST24 response (24-hour hourly forecast)."""
    return """CAST GPS
Lake Oberon (1200m)
Light 05:42-20:15 (14h33m)

Hr|Tmp  | %Rn|Prec|Wa|Wm|Wd| %Cd|CB|FL|D
06|  3-5| 45%|R0-2|28|38|W | 65%| 8|12|
07|  4-6| 40%|R0-1|26|36|W | 60%| 9|13|
08|  5-8| 35%|R0-1|24|34|W | 55%|10|14|
09|  7-10| 30%| -|22|32|W | 50%|11|15|
10|  8-12| 25%| -|20|30|W | 45%|12|16|
11| 9-13| 20%| -|18|28|W | 40%|13|17|
12|10-14| 20%| -|18|28|W | 40%|13|17|
13|11-15| 25%|R0-1|20|30|W | 45%|12|16|
14|10-14| 30%|R0-2|22|32|W | 50%|11|15|
15| 9-12| 35%|R1-3|24|34|W | 55%|10|14|
16| 7-10| 40%|R2-4|26|36|SW| 60%| 9|13|!
17| 6-8| 45%|R3-5|28|38|SW| 65%| 8|12|!
18| 5-7| 50%|R4-6|30|40|SW| 70%| 7|11|!!
19| 4-6| 55%|R5-8|32|42|W | 75%| 6|10|!!
20| 3-5| 60%|R6-10|34|44|W | 80%| 5| 9|!!
21| 2-4| 65%|R8-12|36|46|W | 85%| 4| 8|!!!
22| 2-3| 70%|R10-15|38|48|W | 90%| 3| 7|!!!
23| 1-3| 70%|R10-15|38|48|W | 90%| 3| 7|!!!
00| 1-2| 65%|R8-12|36|46|W | 85%| 4| 8|!!!
01| 1-2| 60%|R6-10|34|44|W | 80%| 5| 9|!!
02| 2-3| 55%|R5-8|32|42|W | 75%| 6|10|!!
03| 2-4| 50%|R4-6|30|40|SW| 70%| 7|11|!!
04| 3-5| 45%|R3-5|28|38|SW| 65%| 8|12|!
05| 3-5| 40%|R2-4|26|36|W | 60%| 9|13|"""


def analyze_command(command_name: str, sample_text: str):
    """Analyze a command's cost structure."""
    print(f"\n{'='*70}")
    print(f"{command_name} - COST ANALYSIS")
    print(f"{'='*70}")

    # Character analysis
    char_count = len(sample_text)
    line_count = len(sample_text.split('\n'))

    print(f"\n📊 MESSAGE STRUCTURE")
    print(f"   Total characters: {char_count}")
    print(f"   Total lines: {line_count}")
    print(f"   Avg chars/line: {char_count / line_count:.1f}")

    # SMS segmentation
    segments_gsm7 = calculate_sms_segments(sample_text, "GSM7")

    print(f"\n📱 SMS SEGMENTATION (GSM-7)")
    print(f"   Segments required: {segments_gsm7}")
    if segments_gsm7 == 1:
        print(f"   Fits in: 1 SMS (≤160 chars)")
    else:
        print(f"   Multi-part SMS: {segments_gsm7} × 153 chars = {segments_gsm7 * 153} chars capacity")
        print(f"   Utilization: {char_count}/{segments_gsm7 * 153} ({char_count/(segments_gsm7*153)*100:.1f}%)")

    # Cost analysis
    print(f"\n💰 COST BREAKDOWN")
    print(f"\n   TWILIO (Current Provider):")
    twilio_cost = segments_gsm7 * TWILIO_US_COST_PER_SEGMENT
    print(f"      Cost per CAST: ${twilio_cost:.4f}")
    print(f"      Per segment: ${TWILIO_US_COST_PER_SEGMENT}")

    # Revenue & margin
    customer_cost = segments_gsm7 * THUNDERBIRD_US_COST_PER_SEGMENT
    margin = customer_cost - twilio_cost
    margin_pct = (margin / customer_cost) * 100 if customer_cost > 0 else 0

    print(f"\n   THUNDERBIRD REVENUE:")
    print(f"      Customer pays: ${customer_cost:.2f} ({segments_gsm7} segments)")
    print(f"      Twilio cost: ${twilio_cost:.4f}")
    print(f"      Gross margin: ${margin:.4f} ({margin_pct:.1f}%)")

    # Competitor comparison
    print(f"\n   COMPETITOR PRICING:")
    for provider, cost_per_seg in COMPETITORS.items():
        provider_cost = segments_gsm7 * cost_per_seg
        savings = twilio_cost - provider_cost
        savings_pct = (savings / twilio_cost) * 100 if twilio_cost > 0 else 0
        new_margin = customer_cost - provider_cost
        new_margin_pct = (new_margin / customer_cost) * 100 if customer_cost > 0 else 0

        if provider == "Twilio":
            print(f"      {provider:20s} ${provider_cost:.4f} (current)")
        else:
            print(f"      {provider:20s} ${provider_cost:.4f} (save ${savings:.4f} / {savings_pct:.0f}%) → {new_margin_pct:.1f}% margin")

    # Usage projections
    print(f"\n📈 USAGE PROJECTIONS (per user/trip)")
    typical_casts = {
        "CAST7": 1,   # One 7-day overview at trip start
        "CAST12": 14,  # Twice daily for 7 days
        "CAST24": 7,   # Once daily for 7 days
    }

    if command_name in typical_casts:
        casts_per_trip = typical_casts[command_name]
        trip_segments = segments_gsm7 * casts_per_trip
        trip_twilio_cost = twilio_cost * casts_per_trip
        trip_customer_cost = customer_cost * casts_per_trip
        trip_margin = trip_customer_cost - trip_twilio_cost

        print(f"   Typical usage: {casts_per_trip}× {command_name} per 7-day trip")
        print(f"   Total segments: {trip_segments}")
        print(f"   Twilio cost: ${trip_twilio_cost:.2f}")
        print(f"   Customer cost: ${trip_customer_cost:.2f}")
        print(f"   Trip margin: ${trip_margin:.2f}")

    return {
        "command": command_name,
        "chars": char_count,
        "lines": line_count,
        "segments": segments_gsm7,
        "twilio_cost": twilio_cost,
        "customer_cost": customer_cost,
        "margin": margin,
        "margin_pct": margin_pct,
    }


def main():
    print("\n" + "="*70)
    print("THUNDERBIRD US COST STRUCTURE ANALYSIS")
    print("Single GPS Point Forecasts")
    print("="*70)

    print(f"\n⚙️  CONFIGURATION")
    print(f"   GSM-7 Encoding: 160 chars (single) / 153 chars (multi)")
    print(f"   Twilio US Rate: ${TWILIO_US_COST_PER_SEGMENT}/segment")
    print(f"   Customer Rate: ${THUNDERBIRD_US_COST_PER_SEGMENT}/segment")

    # Analyze each command
    results = []

    cast7_sample = generate_cast7_sample()
    results.append(analyze_command("CAST7", cast7_sample))

    cast12_sample = generate_cast12_sample()
    results.append(analyze_command("CAST12", cast12_sample))

    cast24_sample = generate_cast24_sample()
    results.append(analyze_command("CAST24", cast24_sample))

    # Summary comparison
    print(f"\n{'='*70}")
    print("SUMMARY COMPARISON")
    print(f"{'='*70}")

    print(f"\n{'Command':<10} {'Chars':<8} {'Segments':<10} {'Twilio':<12} {'Customer':<12} {'Margin':<10}")
    print("-" * 70)
    for r in results:
        print(f"{r['command']:<10} {r['chars']:<8} {r['segments']:<10} "
              f"${r['twilio_cost']:<11.4f} ${r['customer_cost']:<11.2f} {r['margin_pct']:<9.1f}%")

    # Best provider recommendation
    print(f"\n{'='*70}")
    print("COST OPTIMIZATION RECOMMENDATIONS")
    print(f"{'='*70}")

    best_provider = min((p for p in COMPETITORS.items() if p[0] != "Twilio"),
                       key=lambda x: x[1])

    print(f"\n🏆 BEST ALTERNATIVE: {best_provider[0]}")
    print(f"   Rate: ${best_provider[1]}/segment")

    # Calculate total savings
    for r in results:
        twilio_cost = r['segments'] * TWILIO_US_COST_PER_SEGMENT
        best_cost = r['segments'] * best_provider[1]
        savings = twilio_cost - best_cost
        new_margin = r['customer_cost'] - best_cost
        new_margin_pct = (new_margin / r['customer_cost']) * 100

        print(f"\n   {r['command']}:")
        print(f"      Current cost: ${twilio_cost:.4f}")
        print(f"      New cost: ${best_cost:.4f}")
        print(f"      Savings per CAST: ${savings:.4f} ({(savings/twilio_cost)*100:.0f}%)")
        print(f"      New margin: {new_margin_pct:.1f}% (was {r['margin_pct']:.1f}%)")

    # 7-day trip projection
    print(f"\n📊 7-DAY TRIP PROJECTION (1× CAST7 + 7× CAST24 + 14× CAST12)")
    trip_segments = (results[0]['segments'] * 1 +
                    results[2]['segments'] * 7 +
                    results[1]['segments'] * 14)
    trip_twilio = (results[0]['twilio_cost'] * 1 +
                   results[2]['twilio_cost'] * 7 +
                   results[1]['twilio_cost'] * 14)
    trip_best = trip_segments * best_provider[1]
    trip_customer = (results[0]['customer_cost'] * 1 +
                     results[2]['customer_cost'] * 7 +
                     results[1]['customer_cost'] * 14)

    print(f"   Total segments: {trip_segments}")
    print(f"   Twilio cost: ${trip_twilio:.2f}")
    print(f"   {best_provider[0]} cost: ${trip_best:.2f}")
    print(f"   Savings per trip: ${trip_twilio - trip_best:.2f}")
    print(f"   Customer pays: ${trip_customer:.2f}")
    print(f"   Margin with Twilio: ${trip_customer - trip_twilio:.2f}")
    print(f"   Margin with {best_provider[0]}: ${trip_customer - trip_best:.2f}")

    print(f"\n{'='*70}\n")


if __name__ == "__main__":
    main()
