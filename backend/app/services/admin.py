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
        .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; }}
        .card {{ background: #16213e; padding: 24px; border-radius: 12px; }}
        h2 {{ margin: 0 0 20px; color: #e94560; font-size: 18px; }}
        label {{ display: block; margin-bottom: 6px; color: #aaa; font-size: 14px; }}
        input, select {{ width: 100%; padding: 12px; margin-bottom: 16px; border: 1px solid #333; border-radius: 6px; background: #0f0f23; color: #eee; font-size: 14px; }}
        input:focus, select:focus {{ outline: none; border-color: #e94560; }}
        button {{ padding: 12px 24px; background: #e94560; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }}
        button:hover {{ background: #ff6b6b; }}
        .btn-secondary {{ background: #333; }}
        .btn-secondary:hover {{ background: #444; }}
        .btn-danger {{ background: #c0392b; }}
        .btn-danger:hover {{ background: #e74c3c; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 10px; }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #333; }}
        th {{ color: #aaa; font-weight: 500; font-size: 12px; text-transform: uppercase; }}
        .status {{ padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }}
        .status-active {{ background: #27ae60; }}
        .status-registered {{ background: #3498db; }}
        .status-completed {{ background: #666; }}
        .success {{ background: #27ae60; color: white; padding: 12px; border-radius: 8px; margin-bottom: 20px; }}
        .error {{ background: #c0392b; color: white; padding: 12px; border-radius: 8px; margin-bottom: 20px; }}
        .actions {{ display: flex; gap: 8px; }}
        .actions button {{ padding: 6px 12px; font-size: 12px; }}
        .empty {{ color: #666; text-align: center; padding: 40px; }}
        .stats {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px; }}
        .stat {{ background: #0f0f23; padding: 16px; border-radius: 8px; text-align: center; }}
        .stat-value {{ font-size: 32px; font-weight: 700; color: #e94560; }}
        .stat-label {{ font-size: 12px; color: #666; margin-top: 4px; }}
        .grouping-stats table {{ font-size: 14px; }}
        .grouping-stats th {{ background: #0f0f23; }}
        .grouping-stats .reduction {{ color: #27ae60; font-weight: 600; }}
        .grouping-stats .saving {{ color: #27ae60; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>⚡ Thunderbird Admin</h1>
        <a href="/admin/logout" class="logout">Logout</a>
    </div>
    
    {message}
    
    <div class="stats">
        <div class="stat">
            <div class="stat-value">{total_users}</div>
            <div class="stat-label">Total Users</div>
        </div>
        <div class="stat">
            <div class="stat-value">{active_users}</div>
            <div class="stat-label">Active Today</div>
        </div>
        <div class="stat">
            <div class="stat-value">{forecasts_sent}</div>
            <div class="stat-label">Forecasts Sent</div>
        </div>
    </div>
    
    <div class="grid">
        <div class="card">
            <h2>Register Beta User</h2>
            <form method="POST" action="/admin/register">
                <label>Phone Number</label>
                <input type="tel" name="phone" placeholder="+61400123456" required>
                
                <label>Route</label>
                <select name="route_id" required>
                    <option value="western_arthurs_ak">Western Arthurs (A-K)</option>
                    <option value="western_arthurs_full">Western Arthurs (Full)</option>
                    <option value="overland_track">Overland Track</option>
                </select>
                
                <label>Start Date</label>
                <input type="date" name="start_date" required>
                
                <label>Duration (days)</label>
                <input type="number" name="duration_days" value="7" min="1" max="14" required>
                
                <label>Direction</label>
                <select name="direction">
                    <option value="standard">Standard (Scotts→Kappa / Ronny→Cynthia)</option>
                    <option value="reverse">Reverse</option>
                </select>
                
                <button type="submit">Register User</button>
            </form>
        </div>
        
        <div class="card">
            <h2>Registered Users</h2>
            {users_table}
        </div>
    </div>
    
    <div class="card" style="margin-top: 20px;">
        <h2>Dynamic Grouping Stats (v3.2)</h2>
        <div class="grouping-stats">
            {grouping_stats}
        </div>
    </div>

    <div class="card" style="margin-top: 20px;">
        <h2>Quick Actions</h2>
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
            <form method="POST" action="/admin/push-all" style="margin: 0;">
                <button type="submit" class="btn-secondary">📤 Push All Forecasts Now</button>
            </form>
            <form method="POST" action="/admin/test-sms" style="margin: 0;">
                <input type="tel" name="phone" placeholder="+61400123456" style="width: 180px; margin: 0;">
                <button type="submit" class="btn-secondary">📱 Send Test SMS</button>
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
    """Render admin dashboard."""
    # Build users table
    if users:
        rows = ""
        for u in sorted(users, key=lambda x: x.start_date, reverse=True):
            # Handle both admin.User (enum status) and database.User (string status)
            status_val = u.status.value if hasattr(u.status, 'value') else u.status
            status_class = f"status-{status_val}"
            # Calculate duration from end_date if no duration_days
            if hasattr(u, 'duration_days'):
                duration = u.duration_days
            else:
                duration = (u.end_date - u.start_date).days + 1
            rows += f"""
            <tr>
                <td>{u.phone}</td>
                <td>{u.route_id}</td>
                <td>{u.start_date.strftime('%d %b')}</td>
                <td>{duration}d</td>
                <td>{u.current_position or '-'}</td>
                <td><span class="status {status_class}">{status_val}</span></td>
                <td class="actions">
                    <form method="POST" action="/admin/push/{u.phone}" style="margin:0;">
                        <button type="submit" class="btn-secondary">Push</button>
                    </form>
                    <form method="POST" action="/admin/delete/{u.phone}" style="margin:0;">
                        <button type="submit" class="btn-danger">Delete</button>
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
                <th>Days</th>
                <th>Position</th>
                <th>Status</th>
                <th>Actions</th>
            </tr>
            {rows}
        </table>
        """
    else:
        users_table = '<div class="empty">No users registered yet</div>'

    # Message
    if message:
        if "error" in message.lower():
            msg_html = f'<div class="error">{message}</div>'
        else:
            msg_html = f'<div class="success">{message}</div>'
    else:
        msg_html = ""

    # Stats
    active = len([u for u in users if u.status in (UserStatus.REGISTERED, UserStatus.ACTIVE)])

    # Grouping stats
    grouping_stats = render_grouping_stats()

    return ADMIN_PAGE.format(
        message=msg_html,
        total_users=len(users),
        active_users=active,
        forecasts_sent=0,  # TODO: Track this
        users_table=users_table,
        grouping_stats=grouping_stats
    )
