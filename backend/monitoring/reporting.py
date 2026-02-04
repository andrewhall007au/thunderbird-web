"""
Reporting Module
Generate daily, weekly, and monthly health reports.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)


def generate_daily_summary(storage, date: Optional[datetime] = None) -> dict:
    """
    Generate daily health summary for a specific date.

    Args:
        storage: Storage module
        date: Date to summarize (default: yesterday)

    Returns:
        Dictionary with daily stats
    """
    if date is None:
        date = datetime.utcnow() - timedelta(days=1)

    # Get 24-hour period for the specified date
    start_dt = datetime(date.year, date.month, date.day, 0, 0, 0)
    end_dt = start_dt + timedelta(days=1)
    start_ms = int(start_dt.timestamp() * 1000)
    end_ms = int(end_dt.timestamp() * 1000)

    conn = storage.get_connection()

    # Get all unique checks
    cursor = conn.execute("""
        SELECT DISTINCT check_name
        FROM metrics
        WHERE timestamp_ms >= ? AND timestamp_ms < ?
    """, (start_ms, end_ms))
    check_names = [row['check_name'] for row in cursor.fetchall()]

    # Calculate per-check stats
    per_check_stats = []
    for check_name in check_names:
        cursor = conn.execute("""
            SELECT
                COUNT(*) as total_checks,
                SUM(CASE WHEN status = 'pass' THEN 1 ELSE 0 END) as pass_count,
                AVG(duration_ms) as avg_duration_ms
            FROM metrics
            WHERE check_name = ? AND timestamp_ms >= ? AND timestamp_ms < ?
        """, (check_name, start_ms, end_ms))

        row = cursor.fetchone()
        if row and row['total_checks'] > 0:
            uptime_percent = (row['pass_count'] / row['total_checks']) * 100
            per_check_stats.append({
                'check_name': check_name,
                'total_checks': row['total_checks'],
                'pass_count': row['pass_count'],
                'fail_count': row['total_checks'] - row['pass_count'],
                'uptime_percent': uptime_percent,
                'avg_duration_ms': row['avg_duration_ms']
            })

    # Calculate overall stats
    cursor = conn.execute("""
        SELECT
            COUNT(*) as total_checks,
            SUM(CASE WHEN status = 'pass' THEN 1 ELSE 0 END) as pass_count
        FROM metrics
        WHERE timestamp_ms >= ? AND timestamp_ms < ?
    """, (start_ms, end_ms))

    overall_row = cursor.fetchone()
    if overall_row and overall_row['total_checks'] > 0:
        overall_uptime = (overall_row['pass_count'] / overall_row['total_checks']) * 100
    else:
        overall_uptime = 0

    # Count incidents during the period
    cursor = conn.execute("""
        SELECT COUNT(*) as incident_count
        FROM incidents
        WHERE first_seen_ms >= ? AND first_seen_ms < ?
    """, (start_ms, end_ms))
    incident_count = cursor.fetchone()['incident_count']

    # Get incidents
    cursor = conn.execute("""
        SELECT
            id,
            check_name,
            severity,
            status,
            first_seen_ms,
            last_seen_ms,
            resolved_ms,
            failure_count,
            message
        FROM incidents
        WHERE first_seen_ms >= ? AND first_seen_ms < ?
        ORDER BY first_seen_ms DESC
    """, (start_ms, end_ms))
    incidents = [dict(row) for row in cursor.fetchall()]

    conn.close()

    return {
        'date': date.strftime('%Y-%m-%d'),
        'overall_stats': {
            'total_checks': overall_row['total_checks'] if overall_row else 0,
            'pass_count': overall_row['pass_count'] if overall_row else 0,
            'fail_count': (overall_row['total_checks'] - overall_row['pass_count']) if overall_row else 0,
            'overall_uptime': overall_uptime
        },
        'per_check_stats': per_check_stats,
        'incident_count': incident_count,
        'incidents': incidents
    }


def generate_weekly_report(storage, week_ending: Optional[datetime] = None) -> dict:
    """
    Generate weekly health report.

    Args:
        storage: Storage module
        week_ending: End date of week (default: yesterday)

    Returns:
        Dictionary with weekly stats
    """
    if week_ending is None:
        week_ending = datetime.utcnow() - timedelta(days=1)

    # Get 7-day period ending on the specified date
    end_dt = datetime(week_ending.year, week_ending.month, week_ending.day, 23, 59, 59)
    start_dt = end_dt - timedelta(days=6, hours=23, minutes=59, seconds=59)
    start_ms = int(start_dt.timestamp() * 1000)
    end_ms = int(end_dt.timestamp() * 1000)

    # Previous week for comparison
    prev_start_ms = int((start_dt - timedelta(days=7)).timestamp() * 1000)
    prev_end_ms = int((end_dt - timedelta(days=7)).timestamp() * 1000)

    conn = storage.get_connection()

    # Get all unique checks
    cursor = conn.execute("""
        SELECT DISTINCT check_name
        FROM metrics
        WHERE timestamp_ms >= ? AND timestamp_ms <= ?
    """, (start_ms, end_ms))
    check_names = [row['check_name'] for row in cursor.fetchall()]

    # Calculate per-check stats with trends
    per_check_stats = []
    for check_name in check_names:
        # Current week
        cursor = conn.execute("""
            SELECT
                COUNT(*) as total_checks,
                SUM(CASE WHEN status = 'pass' THEN 1 ELSE 0 END) as pass_count,
                AVG(duration_ms) as avg_duration_ms
            FROM metrics
            WHERE check_name = ? AND timestamp_ms >= ? AND timestamp_ms <= ?
        """, (check_name, start_ms, end_ms))

        row = cursor.fetchone()
        current_uptime = (row['pass_count'] / row['total_checks'] * 100) if row and row['total_checks'] > 0 else 0

        # Previous week
        cursor = conn.execute("""
            SELECT
                COUNT(*) as total_checks,
                SUM(CASE WHEN status = 'pass' THEN 1 ELSE 0 END) as pass_count
            FROM metrics
            WHERE check_name = ? AND timestamp_ms >= ? AND timestamp_ms <= ?
        """, (check_name, prev_start_ms, prev_end_ms))

        prev_row = cursor.fetchone()
        prev_uptime = (prev_row['pass_count'] / prev_row['total_checks'] * 100) if prev_row and prev_row['total_checks'] > 0 else 0

        # Trend
        if prev_uptime == 0:
            trend = "new"
        elif current_uptime > prev_uptime + 0.1:
            trend = "improving"
        elif current_uptime < prev_uptime - 0.1:
            trend = "degrading"
        else:
            trend = "stable"

        if row and row['total_checks'] > 0:
            per_check_stats.append({
                'check_name': check_name,
                'total_checks': row['total_checks'],
                'pass_count': row['pass_count'],
                'fail_count': row['total_checks'] - row['pass_count'],
                'uptime_percent': current_uptime,
                'avg_duration_ms': row['avg_duration_ms'],
                'trend': trend,
                'prev_uptime': prev_uptime
            })

    # Find worst performing check
    worst_check = min(per_check_stats, key=lambda x: x['uptime_percent']) if per_check_stats else None

    # Calculate overall stats
    cursor = conn.execute("""
        SELECT
            COUNT(*) as total_checks,
            SUM(CASE WHEN status = 'pass' THEN 1 ELSE 0 END) as pass_count
        FROM metrics
        WHERE timestamp_ms >= ? AND timestamp_ms <= ?
    """, (start_ms, end_ms))

    overall_row = cursor.fetchone()
    overall_uptime = (overall_row['pass_count'] / overall_row['total_checks'] * 100) if overall_row and overall_row['total_checks'] > 0 else 0

    # Previous week overall
    cursor = conn.execute("""
        SELECT
            COUNT(*) as total_checks,
            SUM(CASE WHEN status = 'pass' THEN 1 ELSE 0 END) as pass_count
        FROM metrics
        WHERE timestamp_ms >= ? AND timestamp_ms <= ?
    """, (prev_start_ms, prev_end_ms))

    prev_overall_row = cursor.fetchone()
    prev_overall_uptime = (prev_overall_row['pass_count'] / prev_overall_row['total_checks'] * 100) if prev_overall_row and prev_overall_row['total_checks'] > 0 else 0

    # Trend
    if prev_overall_uptime == 0:
        overall_trend = "new"
    elif overall_uptime > prev_overall_uptime + 0.1:
        overall_trend = "improving"
    elif overall_uptime < prev_overall_uptime - 0.1:
        overall_trend = "degrading"
    else:
        overall_trend = "stable"

    # Get incidents
    cursor = conn.execute("""
        SELECT
            id,
            check_name,
            severity,
            status,
            first_seen_ms,
            last_seen_ms,
            resolved_ms,
            failure_count,
            message
        FROM incidents
        WHERE first_seen_ms >= ? AND first_seen_ms <= ?
        ORDER BY first_seen_ms DESC
    """, (start_ms, end_ms))
    incidents = [dict(row) for row in cursor.fetchall()]

    conn.close()

    return {
        'week_ending': week_ending.strftime('%Y-%m-%d'),
        'start_date': start_dt.strftime('%Y-%m-%d'),
        'overall_stats': {
            'total_checks': overall_row['total_checks'] if overall_row else 0,
            'pass_count': overall_row['pass_count'] if overall_row else 0,
            'fail_count': (overall_row['total_checks'] - overall_row['pass_count']) if overall_row else 0,
            'overall_uptime': overall_uptime,
            'trend': overall_trend,
            'prev_uptime': prev_overall_uptime
        },
        'per_check_stats': per_check_stats,
        'worst_check': worst_check,
        'incidents': incidents
    }


def generate_monthly_report(storage, month: Optional[datetime] = None) -> dict:
    """
    Generate monthly health report with SLA compliance.

    Args:
        storage: Storage module
        month: Month to report on (default: previous month)

    Returns:
        Dictionary with monthly stats
    """
    if month is None:
        # Default to previous month
        today = datetime.utcnow()
        if today.month == 1:
            month = datetime(today.year - 1, 12, 1)
        else:
            month = datetime(today.year, today.month - 1, 1)

    # Get full month
    start_dt = datetime(month.year, month.month, 1, 0, 0, 0)
    if month.month == 12:
        end_dt = datetime(month.year + 1, 1, 1, 0, 0, 0)
    else:
        end_dt = datetime(month.year, month.month + 1, 1, 0, 0, 0)

    start_ms = int(start_dt.timestamp() * 1000)
    end_ms = int(end_dt.timestamp() * 1000)

    # Previous month for comparison
    if month.month == 1:
        prev_start_dt = datetime(month.year - 1, 12, 1, 0, 0, 0)
        prev_end_dt = datetime(month.year, 1, 1, 0, 0, 0)
    else:
        prev_start_dt = datetime(month.year, month.month - 1, 1, 0, 0, 0)
        prev_end_dt = datetime(month.year, month.month, 1, 0, 0, 0)

    prev_start_ms = int(prev_start_dt.timestamp() * 1000)
    prev_end_ms = int(prev_end_dt.timestamp() * 1000)

    conn = storage.get_connection()

    # Get all unique checks
    cursor = conn.execute("""
        SELECT DISTINCT check_name
        FROM metrics
        WHERE timestamp_ms >= ? AND timestamp_ms < ?
    """, (start_ms, end_ms))
    check_names = [row['check_name'] for row in cursor.fetchall()]

    # Calculate per-check stats
    per_check_stats = []
    for check_name in check_names:
        # Current month
        cursor = conn.execute("""
            SELECT
                COUNT(*) as total_checks,
                SUM(CASE WHEN status = 'pass' THEN 1 ELSE 0 END) as pass_count,
                AVG(duration_ms) as avg_duration_ms
            FROM metrics
            WHERE check_name = ? AND timestamp_ms >= ? AND timestamp_ms < ?
        """, (check_name, start_ms, end_ms))

        row = cursor.fetchone()
        current_uptime = (row['pass_count'] / row['total_checks'] * 100) if row and row['total_checks'] > 0 else 0

        # Previous month
        cursor = conn.execute("""
            SELECT
                COUNT(*) as total_checks,
                SUM(CASE WHEN status = 'pass' THEN 1 ELSE 0 END) as pass_count
            FROM metrics
            WHERE check_name = ? AND timestamp_ms >= ? AND timestamp_ms < ?
        """, (check_name, prev_start_ms, prev_end_ms))

        prev_row = cursor.fetchone()
        prev_uptime = (prev_row['pass_count'] / prev_row['total_checks'] * 100) if prev_row and prev_row['total_checks'] > 0 else 0

        # Trend
        if prev_uptime == 0:
            trend = "new"
        elif current_uptime > prev_uptime + 0.1:
            trend = "improving"
        elif current_uptime < prev_uptime - 0.1:
            trend = "degrading"
        else:
            trend = "stable"

        if row and row['total_checks'] > 0:
            per_check_stats.append({
                'check_name': check_name,
                'total_checks': row['total_checks'],
                'pass_count': row['pass_count'],
                'fail_count': row['total_checks'] - row['pass_count'],
                'uptime_percent': current_uptime,
                'avg_duration_ms': row['avg_duration_ms'],
                'trend': trend,
                'prev_uptime': prev_uptime
            })

    # Calculate overall stats
    cursor = conn.execute("""
        SELECT
            COUNT(*) as total_checks,
            SUM(CASE WHEN status = 'pass' THEN 1 ELSE 0 END) as pass_count
        FROM metrics
        WHERE timestamp_ms >= ? AND timestamp_ms < ?
    """, (start_ms, end_ms))

    overall_row = cursor.fetchone()
    overall_uptime = (overall_row['pass_count'] / overall_row['total_checks'] * 100) if overall_row and overall_row['total_checks'] > 0 else 0

    # SLA compliance (99.9% target)
    sla_target = 99.9
    sla_met = overall_uptime >= sla_target

    # Get incidents
    cursor = conn.execute("""
        SELECT
            id,
            check_name,
            severity,
            status,
            first_seen_ms,
            last_seen_ms,
            resolved_ms,
            failure_count,
            message
        FROM incidents
        WHERE first_seen_ms >= ? AND first_seen_ms < ?
        ORDER BY first_seen_ms DESC
    """, (start_ms, end_ms))
    incidents = [dict(row) for row in cursor.fetchall()]

    # Previous month overall
    cursor = conn.execute("""
        SELECT
            COUNT(*) as total_checks,
            SUM(CASE WHEN status = 'pass' THEN 1 ELSE 0 END) as pass_count
        FROM metrics
        WHERE timestamp_ms >= ? AND timestamp_ms < ?
    """, (prev_start_ms, prev_end_ms))

    prev_overall_row = cursor.fetchone()
    prev_overall_uptime = (prev_overall_row['pass_count'] / prev_overall_row['total_checks'] * 100) if prev_overall_row and prev_overall_row['total_checks'] > 0 else 0

    # Trend
    if prev_overall_uptime == 0:
        overall_trend = "new"
    elif overall_uptime > prev_overall_uptime + 0.1:
        overall_trend = "improving"
    elif overall_uptime < prev_overall_uptime - 0.1:
        overall_trend = "degrading"
    else:
        overall_trend = "stable"

    conn.close()

    return {
        'month': month.strftime('%Y-%m'),
        'month_name': month.strftime('%B %Y'),
        'overall_stats': {
            'total_checks': overall_row['total_checks'] if overall_row else 0,
            'pass_count': overall_row['pass_count'] if overall_row else 0,
            'fail_count': (overall_row['total_checks'] - overall_row['pass_count']) if overall_row else 0,
            'overall_uptime': overall_uptime,
            'trend': overall_trend,
            'prev_uptime': prev_overall_uptime
        },
        'sla_compliance': {
            'target': sla_target,
            'actual': overall_uptime,
            'met': sla_met
        },
        'per_check_stats': per_check_stats,
        'incidents': incidents
    }


def format_daily_report_html(summary: dict) -> str:
    """Format daily summary as HTML email."""
    date = summary['date']
    overall = summary['overall_stats']
    per_check = summary['per_check_stats']
    incidents = summary['incidents']

    # Overall status badge
    if overall['overall_uptime'] >= 99.9:
        badge_color = "#16a34a"
        badge_text = "Excellent"
    elif overall['overall_uptime'] >= 99.0:
        badge_color = "#ea580c"
        badge_text = "Good"
    else:
        badge_color = "#dc2626"
        badge_text = "Poor"

    # Build checks table
    checks_rows = ""
    for check in per_check:
        uptime_class = "good" if check['uptime_percent'] >= 99.5 else "warning" if check['uptime_percent'] >= 99.0 else "bad"
        uptime_color = "#16a34a" if check['uptime_percent'] >= 99.5 else "#ea580c" if check['uptime_percent'] >= 99.0 else "#dc2626"

        checks_rows += f"""
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{check['check_name']}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: {uptime_color}; font-weight: 600;">{check['uptime_percent']:.2f}%</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{check['total_checks']}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{check['fail_count']}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{check['avg_duration_ms']:.0f}ms</td>
        </tr>
        """

    # Build incidents section
    incidents_html = ""
    if incidents:
        for incident in incidents:
            severity_color = "#dc2626" if incident['severity'] == 'critical' else "#ea580c"
            first_seen = datetime.fromtimestamp(incident['first_seen_ms'] / 1000).strftime('%H:%M UTC')
            resolved = ""
            if incident['resolved_ms']:
                resolved_time = datetime.fromtimestamp(incident['resolved_ms'] / 1000).strftime('%H:%M UTC')
                duration = (incident['resolved_ms'] - incident['first_seen_ms']) / 60000
                resolved = f"Resolved at {resolved_time} ({duration:.0f}min downtime)"
            else:
                resolved = "Still active"

            incidents_html += f"""
            <div style="background-color: #fef2f2; border-left: 4px solid {severity_color}; padding: 15px; margin-bottom: 15px;">
                <strong style="color: {severity_color};">{incident['check_name']}</strong> - {incident['severity'].upper()}<br>
                <span style="color: #6b7280; font-size: 14px;">Started: {first_seen} | {resolved}</span><br>
                <span style="color: #991b1b; font-family: monospace; font-size: 13px;">{incident['message']}</span>
            </div>
            """
    else:
        incidents_html = "<p style='color: #16a34a;'>No incidents reported today ✓</p>"

    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; background-color: #f9fafb; margin: 0; padding: 0;">
    <div style="max-width: 700px; margin: 0 auto; padding: 20px;">
        <div style="background-color: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
            <div style="background-color: #2563eb; color: white; padding: 30px 20px;">
                <h1 style="margin: 0; font-size: 28px; font-weight: 600;">Thunderbird Daily Health Report</h1>
                <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">{date}</p>
            </div>
            <div style="padding: 30px 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <div style="display: inline-block; background-color: {badge_color}; color: white; padding: 15px 30px; border-radius: 8px; font-size: 24px; font-weight: 600;">
                        {overall['overall_uptime']:.2f}% Uptime
                    </div>
                    <div style="margin-top: 10px; color: #6b7280; font-size: 14px;">{badge_text} Performance</div>
                </div>

                <h2 style="margin: 30px 0 15px 0; font-size: 20px; font-weight: 600; color: #111827;">Check Statistics</h2>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                    <thead>
                        <tr style="background-color: #f9fafb;">
                            <th style="padding: 12px 10px; text-align: left; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Check Name</th>
                            <th style="padding: 12px 10px; text-align: left; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Uptime</th>
                            <th style="padding: 12px 10px; text-align: left; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Total</th>
                            <th style="padding: 12px 10px; text-align: left; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Failures</th>
                            <th style="padding: 12px 10px; text-align: left; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Avg Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {checks_rows}
                    </tbody>
                </table>

                <h2 style="margin: 30px 0 15px 0; font-size: 20px; font-weight: 600; color: #111827;">Incidents</h2>
                {incidents_html}

                <div style="text-align: center; margin-top: 30px;">
                    <a href="https://thunderbird.bot/monitoring" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                        View Monitoring Dashboard
                    </a>
                </div>
            </div>
            <div style="background-color: #f9fafb; padding: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
                <p style="margin: 0;">
                    Thunderbird Monitoring Service<br>
                    Automated daily report
                </p>
            </div>
        </div>
    </div>
</body>
</html>
"""
    return html


def format_weekly_report_html(report: dict) -> str:
    """Format weekly report as HTML email."""
    overall = report['overall_stats']
    per_check = report['per_check_stats']
    incidents = report['incidents']
    start_date = report['start_date']
    end_date = report['week_ending']
    worst_check = report['worst_check']

    # Overall status badge with trend
    if overall['overall_uptime'] >= 99.9:
        badge_color = "#16a34a"
        badge_text = "Excellent"
    elif overall['overall_uptime'] >= 99.0:
        badge_color = "#ea580c"
        badge_text = "Good"
    else:
        badge_color = "#dc2626"
        badge_text = "Poor"

    # Trend arrow
    trend_arrow = ""
    if overall['trend'] == "improving":
        trend_arrow = "↑"
    elif overall['trend'] == "degrading":
        trend_arrow = "↓"
    else:
        trend_arrow = "→"

    # Build checks table
    checks_rows = ""
    for check in per_check:
        uptime_color = "#16a34a" if check['uptime_percent'] >= 99.5 else "#ea580c" if check['uptime_percent'] >= 99.0 else "#dc2626"
        trend_icon = "↑" if check['trend'] == "improving" else "↓" if check['trend'] == "degrading" else "→"

        checks_rows += f"""
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{check['check_name']}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: {uptime_color}; font-weight: 600;">{check['uptime_percent']:.2f}%</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{trend_icon} {check['trend']}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{check['total_checks']}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{check['fail_count']}</td>
        </tr>
        """

    # Worst check highlight
    worst_html = ""
    if worst_check:
        worst_html = f"""
        <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin-bottom: 20px;">
            <strong>Worst Performing Check:</strong> {worst_check['check_name']}<br>
            <span style="color: #dc2626; font-weight: 600;">{worst_check['uptime_percent']:.2f}% uptime</span> with {worst_check['fail_count']} failures
        </div>
        """

    # Incidents summary
    incidents_html = ""
    if incidents:
        incidents_html = f"<p>{len(incidents)} incidents occurred this week:</p>"
        for incident in incidents[:5]:  # Show top 5
            severity_color = "#dc2626" if incident['severity'] == 'critical' else "#ea580c"
            first_seen = datetime.fromtimestamp(incident['first_seen_ms'] / 1000).strftime('%b %d %H:%M')
            incidents_html += f"<li><strong>{incident['check_name']}</strong> - {incident['severity']} (started {first_seen})</li>"
        if len(incidents) > 5:
            incidents_html += f"<li>... and {len(incidents) - 5} more</li>"
    else:
        incidents_html = "<p style='color: #16a34a;'>No incidents this week ✓</p>"

    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; background-color: #f9fafb; margin: 0; padding: 0;">
    <div style="max-width: 700px; margin: 0 auto; padding: 20px;">
        <div style="background-color: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
            <div style="background-color: #2563eb; color: white; padding: 30px 20px;">
                <h1 style="margin: 0; font-size: 28px; font-weight: 600;">Thunderbird Weekly Health Report</h1>
                <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Week of {start_date} to {end_date}</p>
            </div>
            <div style="padding: 30px 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <div style="display: inline-block; background-color: {badge_color}; color: white; padding: 15px 30px; border-radius: 8px; font-size: 24px; font-weight: 600;">
                        {overall['overall_uptime']:.2f}% Uptime {trend_arrow}
                    </div>
                    <div style="margin-top: 10px; color: #6b7280; font-size: 14px;">{badge_text} Performance | Trend: {overall['trend']}</div>
                </div>

                {worst_html}

                <h2 style="margin: 30px 0 15px 0; font-size: 20px; font-weight: 600; color: #111827;">Check Statistics</h2>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                    <thead>
                        <tr style="background-color: #f9fafb;">
                            <th style="padding: 12px 10px; text-align: left; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Check Name</th>
                            <th style="padding: 12px 10px; text-align: left; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Uptime</th>
                            <th style="padding: 12px 10px; text-align: left; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Trend</th>
                            <th style="padding: 12px 10px; text-align: left; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Total</th>
                            <th style="padding: 12px 10px; text-align: left; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Failures</th>
                        </tr>
                    </thead>
                    <tbody>
                        {checks_rows}
                    </tbody>
                </table>

                <h2 style="margin: 30px 0 15px 0; font-size: 20px; font-weight: 600; color: #111827;">Incidents Summary</h2>
                {incidents_html}

                <div style="text-align: center; margin-top: 30px;">
                    <a href="https://thunderbird.bot/monitoring" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                        View Monitoring Dashboard
                    </a>
                </div>
            </div>
            <div style="background-color: #f9fafb; padding: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
                <p style="margin: 0;">
                    Thunderbird Monitoring Service<br>
                    Automated weekly report
                </p>
            </div>
        </div>
    </div>
</body>
</html>
"""
    return html


def format_monthly_report_html(report: dict) -> str:
    """Format monthly report as HTML email."""
    overall = report['overall_stats']
    per_check = report['per_check_stats']
    incidents = report['incidents']
    sla = report['sla_compliance']
    month_name = report['month_name']

    # SLA badge
    if sla['met']:
        sla_color = "#16a34a"
        sla_text = f"SLA Met ({sla['actual']:.2f}%)"
    else:
        sla_color = "#dc2626"
        sla_text = f"SLA Missed ({sla['actual']:.2f}%)"

    # Trend arrow
    trend_arrow = ""
    if overall['trend'] == "improving":
        trend_arrow = "↑"
    elif overall['trend'] == "degrading":
        trend_arrow = "↓"
    else:
        trend_arrow = "→"

    # Build checks table
    checks_rows = ""
    for check in per_check:
        uptime_color = "#16a34a" if check['uptime_percent'] >= 99.5 else "#ea580c" if check['uptime_percent'] >= 99.0 else "#dc2626"
        trend_icon = "↑" if check['trend'] == "improving" else "↓" if check['trend'] == "degrading" else "→"

        checks_rows += f"""
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{check['check_name']}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: {uptime_color}; font-weight: 600;">{check['uptime_percent']:.2f}%</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{trend_icon} {check['trend']}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{check['total_checks']}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">{check['fail_count']}</td>
        </tr>
        """

    # Incident post-mortems
    postmortems_html = ""
    if incidents:
        postmortems_html = f"<p>{len(incidents)} incidents occurred this month:</p>"
        for incident in incidents:
            severity_color = "#dc2626" if incident['severity'] == 'critical' else "#ea580c"
            first_seen = datetime.fromtimestamp(incident['first_seen_ms'] / 1000).strftime('%b %d, %H:%M UTC')
            if incident['resolved_ms']:
                resolved_time = datetime.fromtimestamp(incident['resolved_ms'] / 1000).strftime('%b %d, %H:%M UTC')
                duration = (incident['resolved_ms'] - incident['first_seen_ms']) / 60000
                resolution = f"Resolved {resolved_time} ({duration:.0f}min downtime)"
            else:
                resolution = "Still active or unresolved"

            postmortems_html += f"""
            <div style="background-color: #fef2f2; border-left: 4px solid {severity_color}; padding: 15px; margin-bottom: 15px;">
                <strong style="color: {severity_color};">{incident['check_name']}</strong> - {incident['severity'].upper()}<br>
                <span style="color: #6b7280; font-size: 14px;">Started: {first_seen}</span><br>
                <span style="color: #6b7280; font-size: 14px;">{resolution}</span><br>
                <span style="color: #991b1b; font-family: monospace; font-size: 13px; margin-top: 5px; display: block;">{incident['message']}</span>
            </div>
            """
    else:
        postmortems_html = "<p style='color: #16a34a;'>No incidents this month ✓</p>"

    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; background-color: #f9fafb; margin: 0; padding: 0;">
    <div style="max-width: 700px; margin: 0 auto; padding: 20px;">
        <div style="background-color: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
            <div style="background-color: #2563eb; color: white; padding: 30px 20px;">
                <h1 style="margin: 0; font-size: 28px; font-weight: 600;">Thunderbird Monthly Health Report</h1>
                <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">{month_name}</p>
            </div>
            <div style="padding: 30px 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <div style="display: inline-block; background-color: {sla_color}; color: white; padding: 15px 30px; border-radius: 8px; font-size: 20px; font-weight: 600; margin-bottom: 15px;">
                        {sla_text}
                    </div>
                    <div style="display: block; margin-top: 15px;">
                        <span style="font-size: 24px; font-weight: 600; color: #111827;">{overall['overall_uptime']:.2f}% Uptime {trend_arrow}</span>
                    </div>
                    <div style="margin-top: 10px; color: #6b7280; font-size: 14px;">Month-over-month trend: {overall['trend']}</div>
                </div>

                <h2 style="margin: 30px 0 15px 0; font-size: 20px; font-weight: 600; color: #111827;">Check Statistics</h2>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                    <thead>
                        <tr style="background-color: #f9fafb;">
                            <th style="padding: 12px 10px; text-align: left; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Check Name</th>
                            <th style="padding: 12px 10px; text-align: left; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Uptime</th>
                            <th style="padding: 12px 10px; text-align: left; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Trend</th>
                            <th style="padding: 12px 10px; text-align: left; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Total</th>
                            <th style="padding: 12px 10px; text-align: left; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Failures</th>
                        </tr>
                    </thead>
                    <tbody>
                        {checks_rows}
                    </tbody>
                </table>

                <h2 style="margin: 30px 0 15px 0; font-size: 20px; font-weight: 600; color: #111827;">Incident Post-Mortems</h2>
                {postmortems_html}

                <div style="text-align: center; margin-top: 30px;">
                    <a href="https://thunderbird.bot/monitoring" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                        View Monitoring Dashboard
                    </a>
                </div>
            </div>
            <div style="background-color: #f9fafb; padding: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
                <p style="margin: 0;">
                    Thunderbird Monitoring Service<br>
                    Automated monthly report
                </p>
            </div>
        </div>
    </div>
</body>
</html>
"""
    return html


def send_daily_report(config, storage):
    """Send daily health report via email."""
    try:
        # Generate summary for yesterday
        summary = generate_daily_summary(storage)

        # Format as HTML
        html = format_daily_report_html(summary)

        # Send via Resend
        from .alerts.channels import ResendEmailChannel

        if not config.RESEND_API_KEY:
            logger.warning("Resend API key not configured, skipping daily report")
            return False

        email_channel = ResendEmailChannel(config.RESEND_API_KEY)

        subject = f"[Thunderbird] Daily Health Report - {summary['date']} - {summary['overall_stats']['overall_uptime']:.1f}% uptime"

        success = email_channel.send(subject, html, config.ALERT_EMAIL_ADDRESSES)

        if success:
            logger.info(f"Daily report sent for {summary['date']}")
        else:
            logger.error("Failed to send daily report")

        return success

    except Exception as e:
        logger.error(f"Failed to send daily report: {e}")
        return False


def send_weekly_report(config, storage):
    """Send weekly health report via email."""
    try:
        # Generate weekly report
        report = generate_weekly_report(storage)

        # Format as HTML
        html = format_weekly_report_html(report)

        # Send via Resend
        from .alerts.channels import ResendEmailChannel

        if not config.RESEND_API_KEY:
            logger.warning("Resend API key not configured, skipping weekly report")
            return False

        email_channel = ResendEmailChannel(config.RESEND_API_KEY)

        subject = f"[Thunderbird] Weekly Health Report - Week of {report['start_date']} - {report['overall_stats']['overall_uptime']:.1f}% uptime"

        success = email_channel.send(subject, html, config.ALERT_EMAIL_ADDRESSES)

        if success:
            logger.info(f"Weekly report sent for week ending {report['week_ending']}")
        else:
            logger.error("Failed to send weekly report")

        return success

    except Exception as e:
        logger.error(f"Failed to send weekly report: {e}")
        return False


def send_monthly_report(config, storage):
    """Send monthly health report via email."""
    try:
        # Generate monthly report
        report = generate_monthly_report(storage)

        # Format as HTML
        html = format_monthly_report_html(report)

        # Send via Resend
        from .alerts.channels import ResendEmailChannel

        if not config.RESEND_API_KEY:
            logger.warning("Resend API key not configured, skipping monthly report")
            return False

        email_channel = ResendEmailChannel(config.RESEND_API_KEY)

        sla_status = "met" if report['sla_compliance']['met'] else "missed"
        subject = f"[Thunderbird] Monthly Health Report - {report['month_name']} - {report['overall_stats']['overall_uptime']:.1f}% uptime - SLA {sla_status}"

        success = email_channel.send(subject, html, config.ALERT_EMAIL_ADDRESSES)

        if success:
            logger.info(f"Monthly report sent for {report['month_name']}")
        else:
            logger.error("Failed to send monthly report")

        return success

    except Exception as e:
        logger.error(f"Failed to send monthly report: {e}")
        return False
