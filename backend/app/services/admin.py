"""
Thunderbird Admin Interface
Password-protected admin pages for beta user management.
"""

import hashlib
import secrets
from datetime import datetime, date, timedelta
from typing import Optional, Dict, List
from dataclasses import dataclass, field, asdict
from enum import Enum

from config.settings import settings, TZ_HOBART


# ============================================================================
# User Storage (In-Memory for Beta)
# ============================================================================

class UserStatus(str, Enum):
    """User subscription status."""
    REGISTERED = "registered"
    ACTIVE = "active"  # On trail
    COMPLETED = "completed"
    STOPPED = "stopped"


@dataclass
class User:
    """User registration data."""
    phone: str
    route_id: str
    start_date: date
    duration_days: int
    direction: str = "standard"
    current_position: Optional[str] = None
    current_day: int = 0
    status: UserStatus = UserStatus.REGISTERED
    wind_threshold: str = "moderate"
    safecheck_contacts: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(TZ_HOBART))
    
    @property
    def end_date(self) -> date:
        return self.start_date + timedelta(days=self.duration_days - 1)
    
    @property
    def expires_at(self) -> date:
        """Trip expires 3 days after end date."""
        return self.end_date + timedelta(days=settings.TRIP_BUFFER_DAYS)
    
    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "phone": self.phone,
            "route_id": self.route_id,
            "start_date": self.start_date.isoformat(),
            "duration_days": self.duration_days,
            "direction": self.direction,
            "current_position": self.current_position,
            "current_day": self.current_day,
            "status": self.status.value,
            "wind_threshold": self.wind_threshold,
            "safecheck_contacts": self.safecheck_contacts,
            "created_at": self.created_at.isoformat(),
            "end_date": self.end_date.isoformat(),
            "expires_at": self.expires_at.isoformat(),
        }


class UserStore:
    """In-memory user storage for beta testing."""
    
    def __init__(self):
        self._users: Dict[str, User] = {}
    
    def add(self, user: User) -> bool:
        """Add or update user."""
        self._users[user.phone] = user
        return True
    
    def get(self, phone: str) -> Optional[User]:
        """Get user by phone."""
        return self._users.get(phone)
    
    def delete(self, phone: str) -> bool:
        """Delete user."""
        if phone in self._users:
            del self._users[phone]
            return True
        return False
    
    def list_all(self) -> List[User]:
        """List all users."""
        return list(self._users.values())
    
    def list_active(self) -> List[User]:
        """List users with active trips (on trail today)."""
        today = date.today()
        return [
            u for u in self._users.values()
            if u.start_date <= today <= u.expires_at
            and u.status in (UserStatus.REGISTERED, UserStatus.ACTIVE)
        ]
    
    def update_position(self, phone: str, position: str, day: int) -> bool:
        """Update user's current position."""
        user = self.get(phone)
        if user:
            user.current_position = position
            user.current_day = day
            user.status = UserStatus.ACTIVE
            return True
        return False


# Global user store instance
user_store = UserStore()


# ============================================================================
# Session Management
# ============================================================================

# Active sessions (token -> expiry)
_sessions: Dict[str, datetime] = {}


def create_session() -> str:
    """Create a new admin session token."""
    token = secrets.token_urlsafe(32)
    _sessions[token] = datetime.now(TZ_HOBART) + timedelta(hours=24)
    return token


def validate_session(token: str) -> bool:
    """Check if session token is valid."""
    if token not in _sessions:
        return False
    if datetime.now(TZ_HOBART) > _sessions[token]:
        del _sessions[token]
        return False
    return True


def clear_session(token: str):
    """Remove session token."""
    _sessions.pop(token, None)


def check_password(password: str) -> bool:
    """Verify admin password."""
    return secrets.compare_digest(password, settings.ADMIN_PASSWORD)


# ============================================================================
# HTML Templates
# ============================================================================

LOGIN_PAGE = """
<!DOCTYPE html>
<html>
<head>
    <title>Thunderbird Admin</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        body { background: #1a1a2e; color: #eee; margin: 0; padding: 20px; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
        .container { background: #16213e; padding: 40px; border-radius: 12px; width: 100%; max-width: 400px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
        h1 { margin: 0 0 30px; color: #e94560; text-align: center; font-size: 24px; }
        .logo { text-align: center; font-size: 48px; margin-bottom: 20px; }
        input { width: 100%; padding: 14px; margin-bottom: 20px; border: 1px solid #333; border-radius: 8px; background: #0f0f23; color: #eee; font-size: 16px; }
        input:focus { outline: none; border-color: #e94560; }
        button { width: 100%; padding: 14px; background: #e94560; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; font-weight: 600; }
        button:hover { background: #ff6b6b; }
        .error { background: #ff4444; color: white; padding: 12px; border-radius: 8px; margin-bottom: 20px; text-align: center; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">⚡</div>
        <h1>Thunderbird Admin</h1>
        {error}
        <form method="POST">
            <input type="password" name="password" placeholder="Admin Password" required autofocus>
            <button type="submit">Login</button>
        </form>
        <div class="footer">Beta Testing Console</div>
    </div>
</body>
</html>
"""

ADMIN_PAGE = """
<!DOCTYPE html>
<html>
<head>
    <title>Thunderbird Admin</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * {{ box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }}
        body {{ background: #1a1a2e; color: #eee; margin: 0; padding: 20px; }}
        .header {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #333; }}
        h1 {{ margin: 0; color: #e94560; }}
        .logout {{ color: #888; text-decoration: none; padding: 8px 16px; border: 1px solid #444; border-radius: 6px; }}
        .logout:hover {{ border-color: #e94560; color: #e94560; }}
        .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px; }}
        .card {{ background: #16213e; padding: 24px; border-radius: 12px; }}
        h2 {{ margin: 0 0 20px; color: #e94560; font-size: 18px; }}
        h3 {{ margin: 0 0 12px; color: #aaa; font-size: 14px; }}
        label {{ display: block; margin-bottom: 6px; color: #aaa; font-size: 14px; }}
        input, select {{ width: 100%; padding: 12px; margin-bottom: 16px; border: 1px solid #333; border-radius: 6px; background: #0f0f23; color: #eee; font-size: 14px; }}
        input:focus, select:focus {{ outline: none; border-color: #e94560; }}
        button {{ padding: 12px 24px; background: #e94560; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }}
        button:hover {{ background: #ff6b6b; }}
        .btn-secondary {{ background: #333; }}
        .btn-secondary:hover {{ background: #444; }}
        .btn-danger {{ background: #c0392b; }}
        .btn-danger:hover {{ background: #e74c3c; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; }}
        th, td {{ padding: 10px; text-align: left; border-bottom: 1px solid #333; }}
        th {{ color: #aaa; font-weight: 500; font-size: 11px; text-transform: uppercase; }}
        .status {{ padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }}
        .status-active {{ background: #27ae60; }}
        .status-registered {{ background: #3498db; }}
        .status-completed {{ background: #666; }}
        .success {{ background: #27ae60; color: white; padding: 12px; border-radius: 8px; margin-bottom: 20px; }}
        .error {{ background: #c0392b; color: white; padding: 12px; border-radius: 8px; margin-bottom: 20px; }}
        .actions {{ display: flex; gap: 8px; }}
        .actions button {{ padding: 6px 12px; font-size: 12px; }}
        .empty {{ color: #666; text-align: center; padding: 40px; }}
        .stats-row {{ display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin-bottom: 20px; }}
        .stat {{ background: #0f0f23; padding: 16px; border-radius: 8px; text-align: center; }}
        .stat-value {{ font-size: 24px; font-weight: 700; color: #e94560; }}
        .stat-value.green {{ color: #27ae60; }}
        .stat-label {{ font-size: 11px; color: #666; margin-top: 4px; text-transform: uppercase; }}
        .api-status {{ display: flex; align-items: center; gap: 8px; }}
        .api-dot {{ width: 10px; height: 10px; border-radius: 50%; }}
        .api-dot.green {{ background: #27ae60; }}
        .api-dot.red {{ background: #e74c3c; }}
        .cmd-bar {{ display: flex; align-items: center; gap: 8px; margin: 8px 0; }}
        .cmd-bar-fill {{ height: 8px; border-radius: 4px; background: #3498db; }}
        .cmd-name {{ width: 80px; font-size: 12px; color: #aaa; }}
        .cmd-pct {{ font-size: 12px; color: #888; width: 40px; text-align: right; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Thunderbird Admin</h1>
        <a href="/admin/logout" class="logout">Logout</a>
    </div>

    {message}

    <div class="stats-row">
        <div class="stat">
            <div class="stat-value">{today_segments}</div>
            <div class="stat-label">Today Segments</div>
        </div>
        <div class="stat">
            <div class="stat-value green">${today_cost}</div>
            <div class="stat-label">Today Cost</div>
        </div>
        <div class="stat">
            <div class="stat-value">{month_segments}</div>
            <div class="stat-label">Month Segments</div>
        </div>
        <div class="stat">
            <div class="stat-value green">${month_cost}</div>
            <div class="stat-label">Month Cost</div>
        </div>
        <div class="stat">
            <div class="stat-value">{total_users}</div>
            <div class="stat-label">Users</div>
        </div>
        <div class="stat">
            <div class="stat-value">{active_users}</div>
            <div class="stat-label">Active</div>
        </div>
    </div>

    <div class="grid">
        <div class="card">
            <h2>Command Breakdown (30d)</h2>
            {command_breakdown}
        </div>

        <div class="card">
            <h2>API Health</h2>
            <div style="display: grid; gap: 12px;">
                <div class="api-status">
                    <span class="api-dot green"></span>
                    <span>BOM API</span>
                    <span style="margin-left: auto; color: #27ae60;">OK</span>
                </div>
                <div class="api-status">
                    <span class="api-dot green"></span>
                    <span>Twilio SMS</span>
                    <span style="margin-left: auto; color: #27ae60;">OK</span>
                </div>
                <div class="api-status">
                    <span class="api-dot green"></span>
                    <span>Open-Meteo</span>
                    <span style="margin-left: auto; color: #27ae60;">OK</span>
                </div>
            </div>
            <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #333;">
                <h3>Error Rate</h3>
                <div style="font-size: 24px; color: #27ae60;">{error_rate}%</div>
                <div style="font-size: 12px; color: #666;">{failed_count} failed / {total_sent} sent</div>
            </div>
        </div>
    </div>

    <div class="card" style="margin-top: 20px;">
        <h2>User Analytics</h2>
        {users_table}
    </div>

    <div class="grid" style="margin-top: 20px;">
        <div class="card">
            <h2>Daily Trend (7d)</h2>
            {daily_trend}
        </div>

        <div class="card">
            <h2>Quick Actions</h2>
            <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 20px;">
                <form method="POST" action="/admin/push-all" style="margin: 0;">
                    <button type="submit" class="btn-secondary">Push All Now</button>
                </form>
                <form method="POST" action="/admin/test-sms" style="margin: 0; display: flex; gap: 8px;">
                    <input type="tel" name="phone" placeholder="+61400123456" style="width: 150px; margin: 0;">
                    <button type="submit" class="btn-secondary">Test SMS</button>
                </form>
            </div>
            <h3>Manual Register</h3>
            <form method="POST" action="/admin/register">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <input type="tel" name="phone" placeholder="Phone" required style="margin: 0;">
                    <select name="route_id" required style="margin: 0;">
                        <option value="overland_track">Overland Track</option>
                        <option value="western_arthurs_ak">Western Arthurs (A-K)</option>
                        <option value="western_arthurs_full">Western Arthurs (Full)</option>
                        <option value="eastern_arthurs">Eastern Arthurs</option>
                        <option value="combined_arthurs">Combined Arthurs</option>
                        <option value="south_coast_track">South Coast Track</option>
                    </select>
                    <input type="date" name="start_date" required style="margin: 0;">
                    <input type="number" name="duration_days" value="7" min="1" max="30" required style="margin: 0;" placeholder="Days">
                </div>
                <input type="hidden" name="direction" value="standard">
                <button type="submit" style="margin-top: 12px;">Register</button>
            </form>
        </div>
    </div>
</body>
</html>
"""


def render_login(error: str = "") -> str:
    """Render login page."""
    error_html = f'<div class="error">{error}</div>' if error else ""
    return LOGIN_PAGE.replace("{error}", error_html)


def render_grouping_stats() -> str:
    """Render grouping statistics table."""
    from app.services.pricing import ROUTE_GROUPING_STATS, get_trip_savings_summary

    rows = ""
    total_savings = 0

    for route_id, stats in ROUTE_GROUPING_STATS.items():
        summary = get_trip_savings_summary(route_id)
        route_name = route_id.replace("_", " ").title()

        camp_reduction = int(stats.get("camp_reduction", 0) * 100)
        peak_reduction = int(stats.get("peak_reduction", 0) * 100)
        avg_reduction = summary.get("avg_reduction_pct", 0)
        cost_saved = summary.get("cost_saved_per_trip", 0)
        total_savings += float(cost_saved)

        rows += f"""
        <tr>
            <td>{route_name}</td>
            <td>{stats.get('camps', 0)} → {stats.get('camp_zones', 0)}</td>
            <td class="reduction">{camp_reduction}%</td>
            <td>{stats.get('peaks', 0)} → {stats.get('peak_zones', 0)}</td>
            <td class="reduction">{peak_reduction}%</td>
            <td class="saving">${cost_saved:.2f}</td>
        </tr>
        """

    return f"""
    <table>
        <tr>
            <th>Route</th>
            <th>Camps → Zones</th>
            <th>Camp Reduction</th>
            <th>Peaks → Zones</th>
            <th>Peak Reduction</th>
            <th>$/Trip Saved</th>
        </tr>
        {rows}
    </table>
    <p style="margin-top: 12px; color: #888; font-size: 13px;">
        Grouping thresholds: ±2°C, ±2mm rain, ±5km/h wind
    </p>
    """


def render_admin(users, message: str = "") -> str:
    """Render admin dashboard with analytics."""
    from app.models.database import user_store as db_store

    # Fetch analytics data
    today_stats = db_store.get_today_stats()
    month_stats = db_store.get_month_stats()
    cmd_breakdown = db_store.get_command_breakdown(days=30)
    daily_trend = db_store.get_daily_trend(days=7)
    user_usage = db_store.get_all_users_usage()

    # Build users table with SMS usage
    if users:
        # Create lookup for user usage
        usage_lookup = {u["phone"]: u for u in user_usage}

        rows = ""
        for u in sorted(users, key=lambda x: x.start_date, reverse=True):
            status_val = u.status.value if hasattr(u.status, 'value') else u.status
            status_class = f"status-{status_val}"
            if hasattr(u, 'duration_days'):
                duration = u.duration_days
            else:
                duration = (u.end_date - u.start_date).days + 1

            # Get usage for this user
            usage = usage_lookup.get(u.phone, {})
            segments = usage.get("total_segments", 0)
            cost = usage.get("total_cost", 0)

            # Mask phone for display
            masked_phone = u.phone[:6] + "..." + u.phone[-3:] if len(u.phone) > 9 else u.phone

            rows += f"""
            <tr>
                <td>{masked_phone}</td>
                <td>{u.route_id.replace('_', ' ').title()[:15]}</td>
                <td>{u.start_date.strftime('%d %b')}</td>
                <td>{segments}</td>
                <td>${cost:.2f}</td>
                <td><span class="status {status_class}">{status_val}</span></td>
                <td class="actions">
                    <form method="POST" action="/admin/delete/{u.phone}" style="margin:0;">
                        <button type="submit" class="btn-danger">Del</button>
                    </form>
                </td>
            </tr>
            """
        users_table = f"""
        <table>
            <tr>
                <th>Phone</th>
                <th>Route</th>
                <th>Start</th>
                <th>Seg</th>
                <th>Cost</th>
                <th>Status</th>
                <th></th>
            </tr>
            {rows}
        </table>
        """
    else:
        users_table = '<div class="empty">No users registered yet</div>'

    # Build command breakdown
    if cmd_breakdown:
        total_segments = sum(c["total_segments"] for c in cmd_breakdown)
        cmd_html = ""
        for cmd in cmd_breakdown[:8]:  # Top 8 commands
            pct = (cmd["total_segments"] / total_segments * 100) if total_segments > 0 else 0
            cmd_html += f"""
            <div class="cmd-bar">
                <span class="cmd-name">{cmd['command'][:10]}</span>
                <div style="flex: 1;"><div class="cmd-bar-fill" style="width: {pct}%;"></div></div>
                <span class="cmd-pct">{pct:.0f}%</span>
            </div>
            """
    else:
        cmd_html = '<div class="empty">No data yet</div>'

    # Build daily trend table
    if daily_trend:
        trend_rows = ""
        for day in daily_trend:
            trend_rows += f"""
            <tr>
                <td>{day['day']}</td>
                <td>{day['total_segments']}</td>
                <td>${day['total_cost']:.2f}</td>
            </tr>
            """
        daily_html = f"""
        <table>
            <tr><th>Date</th><th>Segments</th><th>Cost</th></tr>
            {trend_rows}
        </table>
        """
    else:
        daily_html = '<div class="empty">No data yet</div>'

    # Message
    if message:
        if "error" in message.lower():
            msg_html = f'<div class="error">{message}</div>'
        else:
            msg_html = f'<div class="success">{message}</div>'
    else:
        msg_html = ""

    # Calculate error rate
    total_sent = today_stats["message_count"] + month_stats["message_count"]
    failed = today_stats["failed_count"] + month_stats["failed_count"]
    error_rate = (failed / total_sent * 100) if total_sent > 0 else 0

    # Active users
    active = len([u for u in users if (u.status.value if hasattr(u.status, 'value') else u.status) in ("registered", "active")])

    return ADMIN_PAGE.format(
        message=msg_html,
        today_segments=today_stats["total_segments"],
        today_cost=f"{today_stats['total_cost']:.2f}",
        month_segments=month_stats["total_segments"],
        month_cost=f"{month_stats['total_cost']:.2f}",
        total_users=len(users),
        active_users=active,
        command_breakdown=cmd_html,
        users_table=users_table,
        daily_trend=daily_html,
        error_rate=f"{error_rate:.1f}",
        failed_count=failed,
        total_sent=total_sent
    )
