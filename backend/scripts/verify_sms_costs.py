#!/usr/bin/env python3
"""
SMS Cost Verification Script.

Compares stored SMS rates against Twilio Pricing API.
Run manually or via cron to detect rate changes.

Usage:
    python scripts/verify_sms_costs.py
    python scripts/verify_sms_costs.py --json  # Output as JSON
    python scripts/verify_sms_costs.py --alert-only  # Only show alerts
"""
import asyncio
import argparse
import json
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.cost_verification import verify_all_countries, VerificationReport


def format_report(report: VerificationReport, alert_only: bool = False) -> str:
    """Format verification report for display."""
    lines = []

    lines.append("=" * 60)
    lines.append("SMS COST VERIFICATION REPORT")
    lines.append(f"Timestamp: {report.timestamp}")
    lines.append("=" * 60)
    lines.append("")

    lines.append(f"Countries checked: {report.countries_checked}")
    lines.append(f"Countries OK: {report.countries_ok}")
    lines.append(f"Countries with issues: {report.countries_with_issues}")
    lines.append("")

    # Alerts
    if report.margin_alerts:
        lines.append("MARGIN ALERTS (below 75%):")
        for alert in report.margin_alerts:
            lines.append(f"  ! {alert}")
        lines.append("")

    if report.rate_drift_alerts:
        lines.append("RATE DRIFT ALERTS (>10% change):")
        for alert in report.rate_drift_alerts:
            lines.append(f"  ! {alert}")
        lines.append("")

    if report.api_errors:
        lines.append("API ERRORS:")
        for error in report.api_errors:
            lines.append(f"  ? {error}")
        lines.append("")

    # Details (skip if alert_only)
    if not alert_only:
        lines.append("-" * 60)
        lines.append("DETAILS BY COUNTRY:")
        lines.append("-" * 60)

        for detail in report.details:
            status = "OK" if detail.is_margin_ok and not detail.is_rate_drifted else "!!"
            lines.append(f"[{status}] {detail.country_code} ({detail.country_name})")
            lines.append(f"    Stored Twilio rate: {detail.stored_twilio_rate_cents}c")
            if detail.actual_twilio_rate_cents:
                lines.append(f"    Actual Twilio rate: {detail.actual_twilio_rate_cents}c")
            lines.append(f"    Customer rate: {detail.stored_customer_rate_cents}c")
            lines.append(f"    Margin: {detail.calculated_margin:.1%}")
            if detail.rate_drift_percent:
                lines.append(f"    Rate drift: {detail.rate_drift_percent:.1%}")
            if detail.error:
                lines.append(f"    Error: {detail.error}")
            lines.append("")

    # Summary
    lines.append("=" * 60)
    if report.countries_with_issues == 0:
        lines.append("STATUS: ALL OK")
    else:
        lines.append(f"STATUS: {report.countries_with_issues} ISSUE(S) FOUND")
    lines.append("=" * 60)

    return "\n".join(lines)


def report_to_dict(report: VerificationReport) -> dict:
    """Convert report to JSON-serializable dict."""
    return {
        "timestamp": report.timestamp,
        "countries_checked": report.countries_checked,
        "countries_ok": report.countries_ok,
        "countries_with_issues": report.countries_with_issues,
        "margin_alerts": report.margin_alerts,
        "rate_drift_alerts": report.rate_drift_alerts,
        "api_errors": report.api_errors,
        "details": [
            {
                "country_code": d.country_code,
                "country_name": d.country_name,
                "stored_twilio_rate_cents": d.stored_twilio_rate_cents,
                "actual_twilio_rate_cents": d.actual_twilio_rate_cents,
                "stored_customer_rate_cents": d.stored_customer_rate_cents,
                "calculated_margin": str(d.calculated_margin),
                "is_margin_ok": d.is_margin_ok,
                "rate_drift_percent": str(d.rate_drift_percent) if d.rate_drift_percent else None,
                "is_rate_drifted": d.is_rate_drifted,
                "error": d.error,
            }
            for d in report.details
        ]
    }


async def main():
    parser = argparse.ArgumentParser(description="Verify SMS costs against Twilio")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--alert-only", action="store_true", help="Only show alerts")
    args = parser.parse_args()

    print("Fetching Twilio rates...", file=sys.stderr)
    report = await verify_all_countries()

    if args.json:
        print(json.dumps(report_to_dict(report), indent=2))
    else:
        print(format_report(report, alert_only=args.alert_only))

    # Exit with error code if issues found
    sys.exit(1 if report.countries_with_issues > 0 else 0)


if __name__ == "__main__":
    asyncio.run(main())
