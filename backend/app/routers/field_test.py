"""
Field Test API Routes

Provides endpoints for:
1. Dashboard - real-time monitoring of field tests
2. API - JSON data for external integrations
3. Webhook - receive test responses
"""

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from typing import Optional
from datetime import datetime

from app.services.field_test import (
    get_orchestrator,
    get_session,
    get_session_by_phone,
    get_all_sessions,
    parse_fieldtest_command,
)

router = APIRouter(prefix="/field-test", tags=["field-test"])


# =============================================================================
# API Endpoints
# =============================================================================

@router.get("/api/sessions")
async def list_sessions(limit: int = 50):
    """List recent field test sessions."""
    sessions = get_all_sessions(limit)
    return {
        "sessions": [s.to_dict() for s in sessions],
        "count": len(sessions)
    }


@router.get("/api/sessions/{session_id}")
async def get_session_detail(session_id: str):
    """Get detailed session info."""
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session.to_dict()


@router.get("/api/stats")
async def get_stats():
    """Get aggregate field test statistics."""
    sessions = get_all_sessions(1000)

    total_sessions = len(sessions)
    completed_sessions = sum(1 for s in sessions if s.is_complete)
    total_tests = sum(len(s.tests) for s in sessions)
    passed_tests = sum(s.passed_count for s in sessions)

    latencies = []
    for s in sessions:
        for t in s.tests:
            if t.latency_seconds:
                latencies.append(t.latency_seconds)

    avg_latency = sum(latencies) / len(latencies) if latencies else None
    max_latency = max(latencies) if latencies else None
    min_latency = min(latencies) if latencies else None

    # By country
    by_country = {}
    for s in sessions:
        country = s.country or "UNKNOWN"
        if country not in by_country:
            by_country[country] = {"sessions": 0, "passed": 0, "failed": 0}
        by_country[country]["sessions"] += 1
        by_country[country]["passed"] += s.passed_count
        by_country[country]["failed"] += s.failed_count

    return {
        "total_sessions": total_sessions,
        "completed_sessions": completed_sessions,
        "total_tests": total_tests,
        "passed_tests": passed_tests,
        "pass_rate": passed_tests / total_tests if total_tests > 0 else None,
        "latency": {
            "avg_seconds": avg_latency,
            "min_seconds": min_latency,
            "max_seconds": max_latency
        },
        "by_country": by_country
    }


# =============================================================================
# Dashboard (HTML)
# =============================================================================

@router.get("/dashboard", response_class=HTMLResponse)
async def dashboard():
    """Real-time field test monitoring dashboard."""
    return """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Thunderbird Field Test Monitor</title>
    <style>
        :root {
            --bg: #0f172a;
            --card: #1e293b;
            --border: #334155;
            --text: #f1f5f9;
            --text-dim: #94a3b8;
            --success: #22c55e;
            --error: #ef4444;
            --warning: #f59e0b;
            --primary: #3b82f6;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            background: var(--bg);
            color: var(--text);
            min-height: 100vh;
            padding: 20px;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
        }

        h1 {
            font-size: 1.5rem;
            font-weight: 600;
        }

        .status-badge {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            background: var(--card);
            border-radius: 20px;
            font-size: 0.875rem;
        }

        .status-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: var(--success);
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }

        .stat-card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 20px;
        }

        .stat-label {
            font-size: 0.75rem;
            color: var(--text-dim);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 8px;
        }

        .stat-value {
            font-size: 2rem;
            font-weight: 700;
        }

        .stat-value.success { color: var(--success); }
        .stat-value.error { color: var(--error); }
        .stat-value.warning { color: var(--warning); }

        .sessions-container {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 12px;
            overflow: hidden;
        }

        .sessions-header {
            padding: 16px 20px;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .sessions-header h2 {
            font-size: 1rem;
            font-weight: 600;
        }

        .refresh-btn {
            background: var(--primary);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.875rem;
        }

        .refresh-btn:hover {
            filter: brightness(1.1);
        }

        .sessions-list {
            max-height: 600px;
            overflow-y: auto;
        }

        .session-item {
            padding: 16px 20px;
            border-bottom: 1px solid var(--border);
            cursor: pointer;
            transition: background 0.2s;
        }

        .session-item:hover {
            background: rgba(255,255,255,0.05);
        }

        .session-item:last-child {
            border-bottom: none;
        }

        .session-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }

        .session-id {
            font-family: monospace;
            font-size: 0.875rem;
            color: var(--primary);
        }

        .session-time {
            font-size: 0.75rem;
            color: var(--text-dim);
        }

        .session-progress {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .progress-bar {
            flex-grow: 1;
            height: 8px;
            background: var(--border);
            border-radius: 4px;
            overflow: hidden;
        }

        .progress-fill {
            height: 100%;
            border-radius: 4px;
            transition: width 0.3s;
        }

        .progress-fill.success { background: var(--success); }
        .progress-fill.error { background: var(--error); }
        .progress-fill.running { background: var(--warning); }

        .progress-text {
            font-size: 0.875rem;
            min-width: 80px;
            text-align: right;
        }

        .session-meta {
            display: flex;
            gap: 16px;
            margin-top: 8px;
            font-size: 0.75rem;
            color: var(--text-dim);
        }

        .test-list {
            margin-top: 12px;
            display: none;
        }

        .session-item.expanded .test-list {
            display: block;
        }

        .test-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 8px 0;
            font-size: 0.875rem;
        }

        .test-status {
            width: 20px;
            text-align: center;
        }

        .test-status.passed { color: var(--success); }
        .test-status.failed { color: var(--error); }
        .test-status.running { color: var(--warning); }
        .test-status.pending { color: var(--text-dim); }

        .test-name { flex-grow: 1; }
        .test-latency { color: var(--text-dim); }

        .empty-state {
            padding: 60px 20px;
            text-align: center;
            color: var(--text-dim);
        }

        .empty-state h3 {
            margin-bottom: 8px;
            color: var(--text);
        }

        /* Map placeholder */
        .map-container {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 12px;
            height: 300px;
            margin-top: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-dim);
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🌩️ Field Test Monitor</h1>
        <div class="status-badge">
            <div class="status-dot"></div>
            <span>Live</span>
        </div>
    </div>

    <div class="stats-grid" id="stats">
        <div class="stat-card">
            <div class="stat-label">Total Sessions</div>
            <div class="stat-value" id="stat-total">-</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Pass Rate</div>
            <div class="stat-value success" id="stat-pass-rate">-</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Avg Latency</div>
            <div class="stat-value" id="stat-latency">-</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Active Tests</div>
            <div class="stat-value warning" id="stat-active">-</div>
        </div>
    </div>

    <div class="sessions-container">
        <div class="sessions-header">
            <h2>Test Sessions</h2>
            <button class="refresh-btn" onclick="refresh()">Refresh</button>
        </div>
        <div class="sessions-list" id="sessions">
            <div class="empty-state">
                <h3>No field tests yet</h3>
                <p>Tests will appear here when field testers send FIELDTEST command</p>
            </div>
        </div>
    </div>

    <div class="map-container">
        <span>📍 Test locations map (coming soon)</span>
    </div>

    <script>
        let sessionsData = [];

        async function fetchStats() {
            try {
                const res = await fetch('/field-test/api/stats');
                const data = await res.json();

                document.getElementById('stat-total').textContent = data.total_sessions;
                document.getElementById('stat-pass-rate').textContent =
                    data.pass_rate ? `${(data.pass_rate * 100).toFixed(1)}%` : '-';
                document.getElementById('stat-latency').textContent =
                    data.latency.avg_seconds ? `${data.latency.avg_seconds.toFixed(1)}s` : '-';

            } catch (err) {
                console.error('Error fetching stats:', err);
            }
        }

        async function fetchSessions() {
            try {
                const res = await fetch('/field-test/api/sessions?limit=50');
                const data = await res.json();
                sessionsData = data.sessions;

                const activeCount = sessionsData.filter(s => !s.is_complete).length;
                document.getElementById('stat-active').textContent = activeCount;

                renderSessions();
            } catch (err) {
                console.error('Error fetching sessions:', err);
            }
        }

        function renderSessions() {
            const container = document.getElementById('sessions');

            if (sessionsData.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <h3>No field tests yet</h3>
                        <p>Tests will appear here when field testers send FIELDTEST command</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = sessionsData.map(session => {
                const progress = session.current_test_index / session.total * 100;
                const passRate = session.passed / Math.max(session.current_test_index, 1) * 100;

                let progressClass = 'running';
                if (session.is_complete) {
                    progressClass = session.failed === 0 ? 'success' : 'error';
                }

                const statusText = session.is_complete
                    ? `${session.passed}/${session.total} passed`
                    : `${session.current_test_index}/${session.total} running`;

                const timeAgo = formatTimeAgo(new Date(session.started_at));
                const location = session.location
                    ? `${session.location.country || ''} (${session.location.lat?.toFixed(2)}, ${session.location.lon?.toFixed(2)})`
                    : 'Unknown location';

                const testList = session.tests.map(test => {
                    let statusIcon = '○';
                    let statusClass = 'pending';
                    if (test.status === 'passed') { statusIcon = '✓'; statusClass = 'passed'; }
                    else if (test.status === 'failed') { statusIcon = '✗'; statusClass = 'failed'; }
                    else if (test.status === 'running') { statusIcon = '●'; statusClass = 'running'; }
                    else if (test.status === 'timeout') { statusIcon = '⏱'; statusClass = 'failed'; }

                    const latency = test.latency_seconds ? `${test.latency_seconds.toFixed(1)}s` : '-';

                    return `
                        <div class="test-item">
                            <span class="test-status ${statusClass}">${statusIcon}</span>
                            <span class="test-name">${test.name}</span>
                            <span class="test-latency">${latency}</span>
                        </div>
                    `;
                }).join('');

                return `
                    <div class="session-item" onclick="this.classList.toggle('expanded')">
                        <div class="session-header">
                            <span class="session-id">${session.id}</span>
                            <span class="session-time">${timeAgo}</span>
                        </div>
                        <div class="session-progress">
                            <div class="progress-bar">
                                <div class="progress-fill ${progressClass}" style="width: ${progress}%"></div>
                            </div>
                            <span class="progress-text">${statusText}</span>
                        </div>
                        <div class="session-meta">
                            <span>📍 ${location}</span>
                            <span>⏱ ${session.avg_latency_seconds ? session.avg_latency_seconds.toFixed(1) + 's avg' : '-'}</span>
                            <span>📱 ${session.phone}</span>
                        </div>
                        <div class="test-list">
                            ${testList}
                        </div>
                    </div>
                `;
            }).join('');
        }

        function formatTimeAgo(date) {
            const seconds = Math.floor((new Date() - date) / 1000);
            if (seconds < 60) return 'just now';
            if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
            if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
            return `${Math.floor(seconds / 86400)}d ago`;
        }

        function refresh() {
            fetchStats();
            fetchSessions();
        }

        // Initial load
        refresh();

        // Auto-refresh every 10 seconds
        setInterval(refresh, 10000);
    </script>
</body>
</html>
"""


# =============================================================================
# Integration with SMS Webhook
# =============================================================================

def handle_fieldtest_sms(phone: str, body: str) -> Optional[str]:
    """
    Handle FIELDTEST command from SMS webhook.
    Returns response message or None if not a field test command.
    """
    parsed = parse_fieldtest_command(body)

    if not parsed.get("valid"):
        return None

    orchestrator = get_orchestrator()

    action = parsed.get("action")

    if action == "cancel":
        return orchestrator.cancel_test(phone)

    if action == "status":
        session = get_session_by_phone(phone)
        if not session:
            return "No active field test. Send FIELDTEST to start."
        return (
            f"Field Test {session.id}\n"
            f"Progress: {session.current_test_index}/{len(session.tests)}\n"
            f"Passed: {session.passed_count}\n"
            f"Failed: {session.failed_count}"
        )

    if action == "start":
        lat = parsed.get("lat")
        lon = parsed.get("lon")
        return orchestrator.start_test(phone, lat, lon)

    return None
