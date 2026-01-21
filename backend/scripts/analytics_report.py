#!/usr/bin/env python3
"""
Analytics Report CLI

Generate conversion funnel and A/B variant performance reports from analytics data.

Usage:
    python backend/scripts/analytics_report.py --days 7
    python backend/scripts/analytics_report.py --start 2026-01-01 --end 2026-01-31
    python backend/scripts/analytics_report.py --format json
"""

import sys
import argparse
import json
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.models.analytics import analytics_store


def parse_date(date_str: str) -> datetime:
    """Parse date string in YYYY-MM-DD format."""
    return datetime.strptime(date_str, "%Y-%m-%d")


def format_percentage(rate: float) -> str:
    """Format a rate as a percentage string."""
    return f"{rate * 100:.1f}%"


def generate_text_report(start_date: datetime, end_date: datetime) -> str:
    """Generate human-readable text report."""
    lines = []
    date_range = f"{start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}"

    # ============================================
    # Conversion by Path
    # ============================================
    funnel = analytics_store.get_funnel_by_path(start_date=start_date, end_date=end_date)

    lines.append("")
    lines.append(f"CONVERSION BY ENTRY PATH ({date_range})")
    lines.append("=" * 60)
    lines.append(f"{'Path':<12} {'Views':>8} {'Checkouts':>11} {'Purchases':>11} {'Conv%':>8}")
    lines.append("-" * 60)

    total_views = 0
    total_checkouts = 0
    total_purchases = 0

    for path in ['create', 'buy', 'organic']:
        data = funnel.get(path, {})
        views = data.get('page_views', 0)
        checkouts = data.get('checkouts_started', 0)
        purchases = data.get('purchases_completed', 0)
        rate = data.get('conversion_rate', 0.0)

        total_views += views
        total_checkouts += checkouts
        total_purchases += purchases

        lines.append(f"{path:<12} {views:>8} {checkouts:>11} {purchases:>11} {format_percentage(rate):>8}")

    lines.append("-" * 60)
    total_rate = total_purchases / total_views if total_views > 0 else 0.0
    lines.append(f"{'TOTAL':<12} {total_views:>8} {total_checkouts:>11} {total_purchases:>11} {format_percentage(total_rate):>8}")
    lines.append("=" * 60)

    # ============================================
    # A/B Variant Performance
    # ============================================
    variants = analytics_store.get_conversion_by_variant(start_date=start_date, end_date=end_date)

    lines.append("")
    lines.append("A/B VARIANT PERFORMANCE")
    lines.append("=" * 50)
    lines.append(f"{'Variant':<10} {'Sessions':>10} {'Purchases':>12} {'Conv%':>10}")
    lines.append("-" * 50)

    variant_a = variants.get('A', {})
    variant_b = variants.get('B', {})

    for variant_name, variant_data in [('A', variant_a), ('B', variant_b)]:
        sessions = variant_data.get('sessions', 0)
        purchases = variant_data.get('purchases', 0)
        rate = variant_data.get('conversion_rate', 0.0)
        lines.append(f"{variant_name:<10} {sessions:>10} {purchases:>12} {format_percentage(rate):>10}")

    lines.append("-" * 50)

    # Calculate difference
    rate_a = variant_a.get('conversion_rate', 0.0)
    rate_b = variant_b.get('conversion_rate', 0.0)
    diff = rate_b - rate_a
    diff_pct = diff * 100

    if abs(diff_pct) < 2.0:
        significance = "not significant"
    elif diff > 0:
        significance = "B winning"
    else:
        significance = "A winning"

    lines.append(f"Difference: {diff_pct:+.1f}% ({significance})")
    lines.append("=" * 50)

    # ============================================
    # Daily Purchases Trend
    # ============================================
    daily = analytics_store.get_daily_events(start_date=start_date, end_date=end_date, event_type='purchase_completed')

    lines.append("")
    lines.append("DAILY PURCHASES")
    lines.append("=" * 40)

    if daily:
        max_count = max(count for _, count in daily)
        scale = 30 / max_count if max_count > 0 else 1

        for date_str, count in daily:
            bar = '*' * int(count * scale)
            lines.append(f"{date_str}: {bar} {count}")
    else:
        lines.append("No purchase data in this date range")

    lines.append("=" * 40)
    lines.append("")

    return "\n".join(lines)


def generate_json_report(start_date: datetime, end_date: datetime) -> str:
    """Generate JSON report for programmatic use."""
    funnel = analytics_store.get_funnel_by_path(start_date=start_date, end_date=end_date)
    variants = analytics_store.get_conversion_by_variant(start_date=start_date, end_date=end_date)
    daily = analytics_store.get_daily_events(start_date=start_date, end_date=end_date, event_type='purchase_completed')

    report = {
        'date_range': {
            'start': start_date.strftime('%Y-%m-%d'),
            'end': end_date.strftime('%Y-%m-%d')
        },
        'funnel_by_path': funnel,
        'variant_performance': variants,
        'daily_purchases': [{'date': d, 'count': c} for d, c in daily],
        'generated_at': datetime.utcnow().isoformat() + 'Z'
    }

    return json.dumps(report, indent=2)


def main():
    """Main entry point for CLI."""
    parser = argparse.ArgumentParser(
        description="Generate conversion analytics reports",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Last 7 days (default)
    python backend/scripts/analytics_report.py

    # Last 30 days
    python backend/scripts/analytics_report.py --days 30

    # Specific date range
    python backend/scripts/analytics_report.py --start 2026-01-01 --end 2026-01-31

    # JSON output for programmatic use
    python backend/scripts/analytics_report.py --format json
        """
    )

    parser.add_argument(
        '--days', '-d',
        type=int,
        default=7,
        help='Number of days to report on (default: 7)'
    )
    parser.add_argument(
        '--start', '-s',
        type=str,
        help='Start date (YYYY-MM-DD)'
    )
    parser.add_argument(
        '--end', '-e',
        type=str,
        help='End date (YYYY-MM-DD)'
    )
    parser.add_argument(
        '--format', '-f',
        choices=['text', 'json'],
        default='text',
        help='Output format (default: text)'
    )

    args = parser.parse_args()

    # Determine date range
    if args.start and args.end:
        start_date = parse_date(args.start)
        end_date = parse_date(args.end)
        # Set end_date to end of day
        end_date = end_date.replace(hour=23, minute=59, second=59)
    else:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=args.days)

    # Generate report
    if args.format == 'json':
        output = generate_json_report(start_date, end_date)
    else:
        output = generate_text_report(start_date, end_date)

    print(output)


if __name__ == "__main__":
    main()
