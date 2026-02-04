# Phase 9: Monitoring & Alerting - Research

**Researched:** 2026-02-04
**Domain:** Application monitoring, synthetic testing, alerting systems
**Confidence:** HIGH

## Summary

Monitoring and alerting for production applications has matured significantly by 2026, with clear best practices emerging around synthetic monitoring with Playwright, push-based metrics collection, and AI-powered alert management. The key insight is that for small-to-medium scale applications like Thunderbird, a **custom monitoring solution** is more cost-effective and maintainable than SaaS platforms (Checkly, Better Uptime) while providing equivalent functionality.

The standard approach combines:
- **Synthetic monitoring**: Playwright E2E tests running on schedule (5-10 min intervals for critical flows)
- **Push-based metrics**: FastAPI health endpoints pushing data to SQLite time series storage
- **Multi-channel alerting**: Twilio SMS for critical, Resend email for warnings
- **Real-time dashboard**: React with WebSocket updates showing live system health

The Thunderbird project already has all necessary building blocks in place (Playwright E2E tests, Twilio/Resend integrations, FastAPI backend), making a custom solution straightforward to implement.

**Primary recommendation:** Build a custom monitoring service as a separate FastAPI application with SQLite storage, reusing existing Playwright tests for synthetic monitoring and leveraging current Twilio/Resend integrations for alerts. This provides 90% cost savings vs SaaS platforms while maintaining full control.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Playwright | 1.41+ | Synthetic monitoring (E2E tests) | Industry standard for browser automation, already in project, excellent for production testing |
| FastAPI | Latest | Monitoring service backend | Already project's backend framework, perfect for health check endpoints and monitoring APIs |
| SQLite | 3.x | Time series metric storage | Lightweight, zero-config, excellent for small-scale time series data with proper schema design |
| @playwright/test | 1.41+ | Test runner for synthetic checks | Built-in retry logic, parallel execution, rich assertions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fastapi-health | Latest | Health check endpoints | Structured health checks with dependency testing (database, external APIs) |
| Recharts | 2.x | Dashboard visualization | Most reliable React chart library, lightweight, real-time capable |
| Twilio SDK | Latest | SMS alerting | Already integrated, $0.0083/SMS, reliable delivery |
| Resend SDK | Latest | Email alerting | Already integrated, 3000 emails/month free, 2 req/sec limit |
| node-cron (Node) / APScheduler (Python) | Latest | Scheduled monitoring runs | Reliable task scheduling for periodic synthetic tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom solution | Checkly | $40/month for 6,000 browser runs (vs ~$5/month self-hosted), less control, simpler setup |
| Custom solution | Better Uptime | 3-min checks (vs 1-min custom), expensive at scale, managed infrastructure |
| Custom solution | UptimeRobot | $8/month for 10 monitors at 60-sec intervals, limited to HTTP/ping (no Playwright), basic features |
| SQLite | PostgreSQL TimescaleDB | More complex setup, overkill for this scale (< 1M metrics/month) |
| SQLite | InfluxDB | Separate service, higher memory footprint, unnecessary for this volume |
| Recharts | ApexCharts | More features but heavier bundle, slower initial render |
| Push metrics | Pull (Prometheus) | More complex (requires exposing metrics endpoints), better for distributed systems |

**Installation:**
```bash
# Monitoring service (Python)
pip install fastapi fastapi-health uvicorn apscheduler twilio resend playwright

# Dashboard (React/Next.js) - already in project
npm install recharts ws  # WebSocket for real-time updates
```

## Architecture Patterns

### Recommended Project Structure
```
monitoring/
├── service/                    # Monitoring service (FastAPI)
│   ├── app/
│   │   ├── main.py            # FastAPI app with health endpoints
│   │   ├── scheduler.py       # APScheduler for periodic checks
│   │   ├── checks/            # Health check implementations
│   │   │   ├── synthetic.py   # Playwright test runner
│   │   │   ├── backend.py     # Backend health checks
│   │   │   ├── database.py    # Database connectivity
│   │   │   └── external.py    # External API checks (Stripe, Twilio, weather)
│   │   ├── storage/           # Metrics storage
│   │   │   ├── db.py          # SQLite connection
│   │   │   └── models.py      # Time series schema
│   │   ├── alerts/            # Alert management
│   │   │   ├── manager.py     # Deduplication, escalation logic
│   │   │   ├── channels.py    # SMS, email, webhook channels
│   │   │   └── policies.py    # Alert severity and routing
│   │   └── api/               # Monitoring API endpoints
│   │       ├── metrics.py     # Query metrics
│   │       ├── status.py      # Current status
│   │       └── incidents.py   # Incident management
│   ├── monitoring.db          # SQLite database
│   └── requirements.txt
├── dashboard/                  # Status dashboard (Next.js page)
│   └── app/monitoring/page.tsx
└── config/
    ├── checks.yaml            # Check definitions and schedules
    └── alerts.yaml            # Alert policies and channels
```

### Pattern 1: Push-Based Metrics Collection
**What:** Monitoring service actively runs checks and pushes results to storage, rather than scraping metrics from targets.
**When to use:** Small-to-medium scale, centralized monitoring, when you control all components
**Why preferred for this project:** Simpler architecture, no need to expose metrics endpoints, easier to secure

**Example:**
```python
# Source: Industry best practice, validated by research on push vs pull patterns
# monitoring/service/app/scheduler.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from .checks.synthetic import run_playwright_check
from .storage.db import store_metric
from .alerts.manager import evaluate_and_alert

scheduler = AsyncIOScheduler()

@scheduler.scheduled_job('interval', minutes=5, id='beta_signup_check')
async def check_beta_signup_flow():
    """Run beta signup E2E test every 5 minutes"""
    result = await run_playwright_check('beta-signup-flow')

    # Store metric
    await store_metric({
        'check_name': 'beta_signup_flow',
        'status': result.status,  # 'pass' | 'fail'
        'duration_ms': result.duration,
        'timestamp': datetime.utcnow(),
        'error': result.error_message if result.status == 'fail' else None
    })

    # Evaluate for alerts
    if result.status == 'fail':
        await evaluate_and_alert('beta_signup_flow', result)
```

### Pattern 2: SQLite Time Series Schema with UUIDv7
**What:** Optimized schema for time series data using UUIDv7 as BLOB primary keys plus millisecond INTEGER timestamps
**When to use:** SQLite-based time series, need for high insert performance and efficient range queries
**Why:** Production-grade performance for append-heavy, read-range-heavy workloads

**Example:**
```python
# Source: https://dev.to/zanzythebar/building-high-performance-time-series-on-sqlite-with-go-uuidv7-sqlc-and-libsql-3ejb
# monitoring/service/app/storage/models.py
import sqlite3
from datetime import datetime
from uuid import uuid4

# Schema optimized for time series
CREATE_METRICS_TABLE = """
CREATE TABLE IF NOT EXISTS metrics (
    id BLOB PRIMARY KEY,           -- UUIDv7 for ordered inserts
    timestamp_ms INTEGER NOT NULL, -- Millisecond precision, indexed
    check_name TEXT NOT NULL,
    status TEXT NOT NULL,          -- 'pass', 'fail', 'degraded'
    duration_ms REAL,
    error_message TEXT,
    metadata TEXT                  -- JSON for additional context
);

CREATE INDEX idx_metrics_timestamp ON metrics(timestamp_ms DESC);
CREATE INDEX idx_metrics_check_status ON metrics(check_name, status, timestamp_ms DESC);
"""

# Efficient range query for dashboard
QUERY_RECENT_METRICS = """
SELECT
    check_name,
    status,
    timestamp_ms,
    duration_ms
FROM metrics
WHERE timestamp_ms >= ? AND timestamp_ms < ?
ORDER BY timestamp_ms DESC
LIMIT 1000;
"""

# Aggregation query for uptime calculation
QUERY_UPTIME = """
SELECT
    check_name,
    COUNT(*) as total_checks,
    SUM(CASE WHEN status = 'pass' THEN 1 ELSE 0 END) as successful_checks,
    AVG(duration_ms) as avg_duration_ms
FROM metrics
WHERE timestamp_ms >= ? AND timestamp_ms < ?
GROUP BY check_name;
"""
```

### Pattern 3: Alert Deduplication with Time Windows
**What:** Prevent alert spam by deduplicating alerts within a time window and tracking alert state
**When to use:** Any production alerting system
**Why:** Prevents alert fatigue, reduces SMS costs, improves signal-to-noise ratio

**Example:**
```python
# Source: https://support.squadcast.com/services/alert-deduplication-rules/alert-deduplication-rules
# monitoring/service/app/alerts/manager.py
from datetime import datetime, timedelta
from typing import Dict, Optional

class AlertManager:
    def __init__(self):
        self.active_alerts: Dict[str, Alert] = {}  # check_name -> Alert
        self.dedup_window_minutes = 15

    async def evaluate_and_alert(self, check_name: str, result: CheckResult):
        """Evaluate check result and send alerts with deduplication"""

        # Check if alert already active
        existing_alert = self.active_alerts.get(check_name)

        if result.status == 'fail':
            if existing_alert:
                # Alert already active, check if needs escalation
                if self._should_escalate(existing_alert):
                    await self._escalate_alert(existing_alert)
                # Update failure count
                existing_alert.failure_count += 1
                existing_alert.last_seen = datetime.utcnow()
            else:
                # New failure - create alert
                alert = Alert(
                    check_name=check_name,
                    severity=self._determine_severity(check_name),
                    first_seen=datetime.utcnow(),
                    last_seen=datetime.utcnow(),
                    failure_count=1,
                    message=self._format_alert_message(check_name, result)
                )
                self.active_alerts[check_name] = alert
                await self._send_alert(alert)

        elif result.status == 'pass':
            if existing_alert:
                # Issue resolved - send recovery notification
                await self._send_recovery(existing_alert)
                del self.active_alerts[check_name]

    def _should_escalate(self, alert: Alert) -> bool:
        """Escalate if unacknowledged for 15 minutes"""
        return (
            not alert.acknowledged and
            datetime.utcnow() - alert.first_seen > timedelta(minutes=15)
        )

    async def _send_alert(self, alert: Alert):
        """Route alert to appropriate channel based on severity"""
        if alert.severity == 'critical':
            # SMS + Email
            await self.sms_channel.send(alert)
            await self.email_channel.send(alert)
        elif alert.severity == 'warning':
            # Email only
            await self.email_channel.send(alert)
        else:
            # Log only
            logger.info(f"Info alert: {alert.message}")
```

### Pattern 4: Real-Time Dashboard with WebSocket Updates
**What:** Dashboard receives live metric updates via WebSocket rather than polling
**When to use:** Status dashboards showing real-time data
**Why:** Reduces server load, provides instant updates, better user experience

**Example:**
```typescript
// Source: https://levelup.gitconnected.com/how-i-built-a-real-time-dashboard-mvp-in-2-days-with-websockets-react-c083c7b7d935
// dashboard/app/monitoring/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface MetricUpdate {
  check_name: string
  status: 'pass' | 'fail'
  timestamp: number
  duration_ms: number
}

export default function MonitoringDashboard() {
  const [metrics, setMetrics] = useState<MetricUpdate[]>([])
  const [ws, setWs] = useState<WebSocket | null>(null)

  useEffect(() => {
    // Connect to monitoring service WebSocket
    const websocket = new WebSocket('ws://localhost:8001/ws/metrics')

    websocket.onmessage = (event) => {
      const update: MetricUpdate = JSON.parse(event.data)

      // Add new metric, keep last 100 points
      setMetrics(prev => [...prev, update].slice(-100))
    }

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error)
      // Implement exponential backoff retry
      setTimeout(() => {
        setWs(new WebSocket('ws://localhost:8001/ws/metrics'))
      }, 5000)
    }

    setWs(websocket)

    return () => websocket.close()
  }, [])

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">System Health</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Status cards for each check */}
        <StatusCard check="beta_signup_flow" metrics={metrics} />
        <StatusCard check="checkout_flow" metrics={metrics} />
        <StatusCard check="api_health" metrics={metrics} />
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Response Times (Last Hour)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={metrics}>
            <XAxis dataKey="timestamp" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="duration_ms" stroke="#8884d8" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
```

### Pattern 5: Synthetic Monitoring with Existing Playwright Tests
**What:** Reuse E2E tests as synthetic monitors by running them against production on schedule
**When to use:** Already have Playwright E2E tests, need production monitoring
**Why:** Zero additional test code, consistent test behavior across CI and production monitoring

**Example:**
```python
# Source: https://www.checklyhq.com/blog/synthetic-monitoring-with-checkly-and-playwright-test/
# monitoring/service/app/checks/synthetic.py
import asyncio
from playwright.async_api import async_playwright
import subprocess
import json

async def run_playwright_check(test_name: str) -> CheckResult:
    """
    Run a specific Playwright test against production

    Args:
        test_name: Name of test file (e.g., 'beta-signup-flow')

    Returns:
        CheckResult with status, duration, and error details
    """
    start_time = datetime.utcnow()

    try:
        # Run Playwright test using subprocess
        # Point to production URL via environment variable
        result = subprocess.run([
            'npx', 'playwright', 'test',
            f'e2e/{test_name}.spec.ts',
            '--reporter=json'
        ],
        capture_output=True,
        timeout=120,  # 2 minute timeout
        env={
            **os.environ,
            'BASE_URL': 'https://thunderbird.bot',  # Production URL
            'NODE_ENV': 'production'
        })

        # Parse JSON output
        output = json.loads(result.stdout)

        duration = (datetime.utcnow() - start_time).total_seconds() * 1000

        if result.returncode == 0:
            return CheckResult(
                status='pass',
                duration=duration,
                error_message=None
            )
        else:
            # Extract error from Playwright output
            error = extract_error_from_output(output)
            return CheckResult(
                status='fail',
                duration=duration,
                error_message=error
            )

    except subprocess.TimeoutExpired:
        return CheckResult(
            status='fail',
            duration=120000,  # Timeout duration
            error_message='Test execution timed out after 120 seconds'
        )
    except Exception as e:
        return CheckResult(
            status='fail',
            duration=0,
            error_message=f'Unexpected error: {str(e)}'
        )
```

### Anti-Patterns to Avoid

- **Storing raw logs in SQLite**: Don't store verbose log messages in time series tables - store structured metrics only, keep logs separate or in external service
- **Alert on every failure**: Single failures can be transient network issues - require 2-3 consecutive failures before alerting
- **Overly complex dashboards**: Real-time dashboards with 50+ charts cause performance issues - keep it simple, focus on critical metrics
- **No alert acknowledgment**: Without ACK capability, responders get duplicate alerts and can't signal they're working on issues
- **Forgetting to monitor the monitor**: Self-monitoring is critical - if monitoring service crashes, you need to know via external heartbeat
- **Testing with production data mutations**: Synthetic tests should use read-only operations or test-specific accounts to avoid polluting production data

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Time series database | Custom table with timestamps | SQLite with optimized schema (UUIDv7 + ms timestamps) | Proven patterns for high-performance inserts and range queries, avoid common pitfalls |
| Alert deduplication | Simple "don't send if recent" check | Proper deduplication with time windows, state tracking, escalation | Edge cases: flapping alerts, auto-resolution, escalation paths, alert storms |
| Cron job scheduling | Polling loops with sleep() | APScheduler (Python) or node-cron (Node) | Handles DST transitions, concurrent execution limits, missed job handling, graceful shutdown |
| Chart visualization | Canvas drawing or SVG manipulation | Recharts or similar React chart library | Real-time updates, responsive design, accessibility, touch support, legend interaction |
| WebSocket connection management | Raw WebSocket with manual reconnect | Library with auto-reconnect and exponential backoff | Handles connection drops, ping/pong heartbeats, message buffering during reconnect |
| Health check endpoints | Custom status routes | fastapi-health or similar structured library | Standard format, dependency checking (DB, external APIs), liveness vs readiness probes |

**Key insight:** Monitoring infrastructure has well-established patterns because reliability is critical. Use proven libraries rather than building from scratch - the edge cases will bite you (alert storms, connection management, timezone handling, etc).

## Common Pitfalls

### Pitfall 1: Alert Fatigue from Poor Tuning
**What goes wrong:** Default alert thresholds generate too many false positives, teams start ignoring alerts or disable them entirely
**Why it happens:** Setting overly sensitive thresholds (alert on any failure), not accounting for transient issues, treating all alerts as equally critical
**How to avoid:**
- Require 2-3 consecutive failures before alerting (handles transient network blips)
- Use severity levels: Critical (SMS immediately), Warning (email, SMS if >15 min), Info (log only)
- Set realistic thresholds based on baseline (e.g., response time >2x baseline, not absolute numbers)
- Implement evaluation windows (5-minute average, not instantaneous)
**Warning signs:** Alert acknowledgment rate drops below 50%, responders mention "too many alerts", critical issues getting buried in noise

### Pitfall 2: Insufficient Test Timeout for Synthetic Checks
**What goes wrong:** Playwright tests timeout during normal operation due to slow page loads or network latency, causing false alerts
**Why it happens:** Using development timeouts (30 seconds) for production monitoring where real-world latency is higher
**How to avoid:**
- Set generous timeouts for production synthetic tests (120 seconds vs 30 seconds in CI)
- Monitor test duration over time to establish realistic baselines
- Alert on duration degradation (>2x baseline) separately from complete failures
**Warning signs:** Tests pass in CI but fail in monitoring, tests fail during peak traffic hours, timeout errors in Playwright logs

### Pitfall 3: Ignoring Monitoring Service Health
**What goes wrong:** Monitoring service crashes or stops running, no one notices until users report production issues
**Why it happens:** Focusing entirely on monitoring the application, forgetting to monitor the monitor itself
**How to avoid:**
- Implement "heartbeat" checks where monitoring service pings external service every 5 minutes
- Use external service (UptimeRobot free tier, Healthchecks.io) to monitor monitoring service uptime
- Include self-health metrics: last check run time, queue depth, database connectivity
- Alert if no checks have run in 10 minutes
**Warning signs:** Gap in metrics timeline, last check timestamp is stale, alert silence during known production issues

### Pitfall 4: SQLite Write Contention in High-Concurrency Scenarios
**What goes wrong:** Multiple concurrent checks trying to write metrics causes "database is locked" errors and lost data points
**Why it happens:** SQLite's default configuration uses database-level locking, concurrent writers block each other
**How to avoid:**
- Set `timeout` parameter in SQLite connection (e.g., 30 seconds) to wait for locks
- Use Write-Ahead Logging (WAL) mode: `PRAGMA journal_mode=WAL` - allows concurrent readers during writes
- Batch inserts when possible (insert 10 metrics at once vs 10 separate inserts)
- Keep transactions short - don't hold write lock while running checks
**Warning signs:** "Database is locked" errors in logs, missing data points during high-activity periods, increasing metric latency

### Pitfall 5: SMS Cost Explosion from Alert Storms
**What goes wrong:** A single production issue triggers hundreds of SMS alerts, generating unexpected Twilio bills ($83 for 1000 messages)
**Why it happens:** No rate limiting on SMS alerts, every check failure sends SMS, cascading failures trigger alerts for dependent systems
**How to avoid:**
- Implement alert deduplication (one SMS per incident, not per check failure)
- Rate limit SMS: max 10 SMS per hour across all alerts
- Use escalation: email first, SMS after 15 minutes if unacknowledged
- Bundle related failures: "Multiple checks failing" vs separate SMS for each
**Warning signs:** Multiple SMS for same issue, SMS arriving in rapid succession, Twilio usage spikes

### Pitfall 6: Forgetting to Clean Up Old Metrics
**What goes wrong:** SQLite database grows unbounded, queries slow down, disk space fills up
**Why it happens:** No data retention policy, all metrics kept forever
**How to avoid:**
- Implement retention policy: keep detailed metrics 30 days, aggregated data 90 days, delete older
- Schedule daily cleanup job: `DELETE FROM metrics WHERE timestamp_ms < ?`
- Monitor database size, alert if growing unexpectedly
- Consider rolling up old data: store hourly averages instead of per-minute data after 7 days
**Warning signs:** Database file size growing by >1MB/day, query performance degrading over time, disk space warnings

### Pitfall 7: Testing Against Production Without Safeguards
**What goes wrong:** Synthetic tests create real data in production (beta signups, purchases, SMS sends), polluting analytics and costing money
**Why it happens:** Reusing E2E tests that weren't designed for production monitoring without modification
**How to avoid:**
- Use test-specific accounts/emails for synthetic monitoring (e.g., monitor@thunderbird.bot)
- Add markers to synthetic test data (e.g., `is_synthetic: true` field) for easy filtering
- Mock external services where possible (don't send real SMS/emails in tests)
- Use read-only tests for most checks, only test writes when absolutely necessary
- Clean up test data after check completes (delete test signup, refund test purchase)
**Warning signs:** Spike in beta signups at regular 5-minute intervals, analytics showing bot-like patterns, unexpected Twilio/Stripe charges

## Code Examples

Verified patterns from official sources and best practices:

### FastAPI Health Check Endpoint
```python
# Source: https://www.index.dev/blog/how-to-implement-health-check-in-python
# backend/app/routers/health.py
from fastapi import APIRouter, status
from fastapi_health import health
from datetime import datetime
import sqlite3

router = APIRouter()

def check_database():
    """Check if database is accessible"""
    try:
        conn = sqlite3.connect('production.db')
        conn.execute('SELECT 1')
        conn.close()
        return True
    except Exception as e:
        return False

def check_twilio():
    """Check if Twilio API is reachable"""
    try:
        from twilio.rest import Client
        client = Client(TWILIO_SID, TWILIO_TOKEN)
        # List account (minimal API call)
        client.api.accounts.list(limit=1)
        return True
    except Exception:
        return False

def check_weather_api():
    """Check if weather API is responding"""
    try:
        import requests
        response = requests.get(WEATHER_API_HEALTH_URL, timeout=5)
        return response.status_code == 200
    except Exception:
        return False

@router.get('/health')
async def health_check():
    """Basic health check - service is running"""
    return {
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat()
    }

@router.get('/health/detailed')
async def detailed_health_check():
    """Detailed health check with dependency status"""
    checks = {
        'database': check_database(),
        'twilio': check_twilio(),
        'weather_api': check_weather_api()
    }

    all_healthy = all(checks.values())

    return {
        'status': 'healthy' if all_healthy else 'degraded',
        'timestamp': datetime.utcnow().isoformat(),
        'dependencies': checks
    }
```

### Twilio SMS Alert Sending
```python
# Source: Twilio official documentation
# monitoring/service/app/alerts/channels.py
from twilio.rest import Client
from typing import List

class TwilioSMSChannel:
    def __init__(self, account_sid: str, auth_token: str, from_number: str):
        self.client = Client(account_sid, auth_token)
        self.from_number = from_number

    async def send(self, alert: Alert, to_numbers: List[str]):
        """Send SMS alert via Twilio

        Cost: $0.0083 per SMS in US
        Rate limit: 10 SMS per hour (configurable)
        """
        message_body = self._format_sms(alert)

        for to_number in to_numbers:
            try:
                message = self.client.messages.create(
                    body=message_body,
                    from_=self.from_number,
                    to=to_number
                )
                logger.info(f"SMS sent: {message.sid} to {to_number}")
            except Exception as e:
                logger.error(f"Failed to send SMS to {to_number}: {e}")

    def _format_sms(self, alert: Alert) -> str:
        """Format alert for SMS (160 char limit awareness)"""
        severity_emoji = {
            'critical': '🚨',
            'warning': '⚠️',
            'info': 'ℹ️'
        }

        emoji = severity_emoji.get(alert.severity, '')

        # Keep under 160 chars for single SMS
        return f"{emoji} {alert.severity.upper()}: {alert.check_name} - {alert.message[:100]}"
```

### Resend Email Alert Sending
```python
# Source: Resend official documentation
# monitoring/service/app/alerts/channels.py
import resend
from datetime import datetime

class ResendEmailChannel:
    def __init__(self, api_key: str):
        resend.api_key = api_key

    async def send(self, alert: Alert, to_emails: List[str]):
        """Send email alert via Resend

        Free tier: 3,000 emails/month
        Rate limit: 2 requests/second
        """
        params = {
            "from": "alerts@thunderbird.bot",
            "to": to_emails,
            "subject": f"[{alert.severity.upper()}] {alert.check_name}",
            "html": self._format_html(alert)
        }

        try:
            email = resend.Emails.send(params)
            logger.info(f"Email sent: {email['id']}")
        except Exception as e:
            logger.error(f"Failed to send email: {e}")

    def _format_html(self, alert: Alert) -> str:
        """Format alert as HTML email"""
        severity_colors = {
            'critical': '#dc2626',  # red
            'warning': '#f59e0b',   # orange
            'info': '#3b82f6'       # blue
        }

        color = severity_colors.get(alert.severity, '#6b7280')

        return f"""
        <html>
        <body style="font-family: sans-serif;">
            <div style="border-left: 4px solid {color}; padding-left: 16px;">
                <h2 style="color: {color};">{alert.severity.upper()}</h2>
                <p><strong>Check:</strong> {alert.check_name}</p>
                <p><strong>First seen:</strong> {alert.first_seen.isoformat()}</p>
                <p><strong>Failure count:</strong> {alert.failure_count}</p>
                <p><strong>Message:</strong> {alert.message}</p>
            </div>
            <hr>
            <p style="color: #6b7280; font-size: 12px;">
                View details: https://thunderbird.bot/monitoring
            </p>
        </body>
        </html>
        """
```

### APScheduler Setup for Periodic Checks
```python
# Source: APScheduler documentation and best practices
# monitoring/service/app/scheduler.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

def create_scheduler():
    """Create and configure monitoring scheduler"""
    scheduler = AsyncIOScheduler(
        timezone='UTC',
        job_defaults={
            'coalesce': True,  # Combine multiple pending executions
            'max_instances': 1,  # Only one instance per job at a time
            'misfire_grace_time': 300  # 5 min grace period for missed jobs
        }
    )

    # Critical checks - every 5 minutes
    scheduler.add_job(
        check_beta_signup_flow,
        trigger=IntervalTrigger(minutes=5),
        id='beta_signup_check',
        name='Beta Signup Flow',
        replace_existing=True
    )

    scheduler.add_job(
        check_api_health,
        trigger=IntervalTrigger(minutes=5),
        id='api_health_check',
        name='API Health',
        replace_existing=True
    )

    # Important checks - every 10 minutes
    scheduler.add_job(
        check_login_flow,
        trigger=IntervalTrigger(minutes=10),
        id='login_check',
        name='Login Flow',
        replace_existing=True
    )

    # Non-critical checks - every 30 minutes
    scheduler.add_job(
        check_weather_api,
        trigger=IntervalTrigger(minutes=30),
        id='weather_api_check',
        name='Weather API',
        replace_existing=True
    )

    # Daily checks
    scheduler.add_job(
        check_sms_webhook,
        trigger=IntervalTrigger(days=1),
        id='sms_webhook_check',
        name='SMS Webhook',
        replace_existing=True,
        next_run_time=datetime.now()  # Run immediately on startup
    )

    # Cleanup job - daily at 3 AM UTC
    scheduler.add_job(
        cleanup_old_metrics,
        trigger='cron',
        hour=3,
        minute=0,
        id='cleanup_metrics',
        name='Cleanup Old Metrics',
        replace_existing=True
    )

    # Self-monitoring heartbeat - every 5 minutes
    scheduler.add_job(
        send_heartbeat,
        trigger=IntervalTrigger(minutes=5),
        id='heartbeat',
        name='Monitoring Service Heartbeat',
        replace_existing=True
    )

    scheduler.add_listener(job_listener, EVENT_JOB_ERROR | EVENT_JOB_EXECUTED)

    return scheduler

def job_listener(event):
    """Log job execution for debugging"""
    if event.exception:
        logger.error(f"Job {event.job_id} failed: {event.exception}")
    else:
        logger.info(f"Job {event.job_id} completed successfully")
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pull-based (Prometheus scraping) | Push-based for small scale | ~2024 | Simpler architecture, no need to expose metrics endpoints, easier security model |
| Separate monitoring services | SaaS platforms (Checkly, Better Uptime) | ~2022-2023 | Lower operational burden but expensive at scale, custom still preferred for small teams |
| HTTP polling for uptime | Synthetic E2E tests with Playwright | ~2023-2024 | Catches real user issues, not just "server responding", validates complete flows |
| Manual alert response | AI-powered alert correlation and auto-remediation | 2025-2026 | Reduces alert fatigue, faster MTTR, automatic pattern detection |
| Dedicated time series DBs (InfluxDB, Prometheus) | SQLite with optimized schemas for small scale | ~2024 | Simpler ops, single-file storage, sufficient performance for <1M metrics/month |
| InfluxDB line protocol | OpenTelemetry Protocol (OTLP) | ~2023-2024 | Vendor-neutral, unified traces/metrics/logs, standard instrumentation |
| Separate log aggregation services | Unified observability platforms | ~2024 | Correlation across logs, metrics, traces; single query interface |

**Deprecated/outdated:**
- **StatsD + Graphite stack**: Superseded by modern time series databases with better query languages and built-in visualization
- **Nagios/Icinga**: Configuration complexity, polling-based architecture outdated for cloud-native apps
- **Pingdom HTTP checks**: Basic uptime checks insufficient, no E2E flow validation, expensive
- **Self-hosted Prometheus + Grafana for small apps**: Operational overhead not justified, SaaS or custom SQLite solution more practical
- **SMS-only alerting**: Multi-channel approach now standard (SMS + email + Slack/PagerDuty) with intelligent routing

## Open Questions

Things that couldn't be fully resolved:

1. **Optimal check frequency balance**
   - What we know: Critical flows every 5 min, important flows every 10 min is industry standard
   - What's unclear: Specific cost/benefit tradeoff for Thunderbird's scale (5 min could be overkill or insufficient)
   - Recommendation: Start with standard intervals, adjust based on observed data (false positive rate, issue detection time)

2. **Status page public vs private**
   - What we know: Public status pages build trust, but expose failure information to competitors and attackers
   - What's unclear: Whether Thunderbird benefits from public transparency (B2C product suggests yes, but early stage suggests no)
   - Recommendation: Start with private dashboard, consider public page post-launch based on user demand

3. **Exact alert severity thresholds**
   - What we know: General guidance exists (critical = immediate SMS, warning = email, info = log)
   - What's unclear: Which specific checks map to which severity for Thunderbird's business context
   - Recommendation: Start conservative (more critical alerts), tune down based on false positive rate over first 30 days

4. **Database connection pooling for SQLite**
   - What we know: SQLite performs best with single writer, WAL mode helps with concurrent readers
   - What's unclear: Whether connection pooling provides benefits or hurts performance for monitoring workload
   - Recommendation: Start with simple connection management, add pooling only if contention observed

5. **OpenTelemetry adoption timing**
   - What we know: OTLP is the modern standard, provides unified observability, good ecosystem support
   - What's unclear: Whether upfront complexity is worth it for Thunderbird's current scale vs adding later
   - Recommendation: Build with standard metrics storage now, design schema to allow OTLP bridge later if needed

## Sources

### Primary (HIGH confidence)
- [Microsoft Azure Well-Architected Framework - Monitoring and Alerting Strategy](https://learn.microsoft.com/en-us/azure/well-architected/reliability/monitoring-alerting-strategy) - Architecture patterns, alerting best practices
- [Checkly Documentation - Synthetic Monitoring](https://www.checklyhq.com/docs/learn/monitoring/synthetic-monitoring/) - Synthetic monitoring concepts, Playwright integration
- [Checkly - Organizing Tests and Monitors](https://www.checklyhq.com/docs/detect/synthetic-monitoring/playwright-checks/test-organization/) - Test organization, check frequency recommendations
- [FastAPI Health Check Implementation](https://www.index.dev/blog/how-to-implement-health-check-in-python) - Health check endpoint patterns
- [fastapi-health Documentation](https://kludex.github.io/fastapi-health/) - Structured health checks library
- [Building High-Performance Time Series on SQLite with Go](https://dev.to/zanzythebar/building-high-performance-time-series-on-sqlite-with-go-uuidv7-sqlc-and-libsql-3ejb) - SQLite time series schema optimization
- [Twilio SMS Pricing - United States](https://www.twilio.com/en-us/sms/pricing/us) - Current SMS costs ($0.0083/SMS)
- [Resend Pricing](https://resend.com/pricing) - Email API pricing and rate limits
- [Resend API Rate Limits](https://resend.com/docs/api-reference/rate-limit) - Rate limit documentation (2 req/sec)

### Secondary (MEDIUM confidence)
- [Squadcast - Alert Deduplication Rules](https://support.squadcast.com/services/alert-deduplication-rules/alert-deduplication-rules) - Deduplication patterns
- [Atlassian - What is Alert Deduplication](https://support.atlassian.com/jira-service-management-cloud/docs/what-is-alert-deduplication/) - Alert deduplication concepts
- [Grafana - Meta-monitoring](https://grafana.com/docs/grafana/latest/alerting/set-up/meta-monitoring/) - Self-monitoring patterns
- [Prometheus - Meta-Monitoring Architecture](https://training.promlabs.com/training/monitoring-and-debugging-prometheus/metrics-based-meta-monitoring/meta-monitoring-architecture/) - Meta-monitoring approach
- [Cloud Computing Patterns - Watchdog](https://www.cloudcomputingpatterns.org/watchdog/) - Watchdog pattern definition
- [How I Built a Real-Time Dashboard with WebSockets & React](https://levelup.gitconnected.com/how-i-built-a-real-time-dashboard-mvp-in-2-days-with-websockets-react-c083c7b7d935) - Real-time dashboard implementation
- [Building Real-Time Dashboard with WebSocket and Python](https://codezup.com/building-real-time-dashboard-with-websocket-and-python/) - Python WebSocket implementation
- [SigNoz - Monitor NextJS with OpenTelemetry](https://signoz.io/blog/opentelemetry-nextjs/) - Next.js monitoring patterns
- [IBM - What Is Alert Fatigue](https://www.ibm.com/think/topics/alert-fatigue) - Alert fatigue causes and prevention
- [Datadog - Preventing Alert Fatigue](https://www.datadoghq.com/blog/best-practices-to-prevent-alert-fatigue/) - Alert management best practices
- [10 Best React Chart Libraries](https://www.usedatabrain.com/blog/react-chart-libraries) - Chart library comparison
- [LogRocket - Best React Chart Libraries 2025](https://blog.logrocket.com/best-react-chart-libraries-2025/) - Recharts, ApexCharts, Nivo comparison

### Tertiary (LOW confidence - flagged for validation)
- [Alibaba Cloud - Pull or Push: How to Select Monitoring Systems](https://www.alibabacloud.com/blog/pull-or-push-how-to-select-monitoring-systems_599007) - Push vs pull tradeoffs (older article, concepts still valid)
- [Checkly Pricing Plans](https://www.checklyhq.com/pricing/) - Pricing retrieved from marketing page, may change
- [UptimeRobot Pricing](https://uptimerobot.com/pricing/) - Pricing retrieved from marketing page
- [Better Uptime vs UptimeRobot Comparison](https://odown.com/blog/Better-Uptime-vs-UpTimeRobot/) - Third-party comparison, verify specifics
- [BrowserStack - 15 Best Practices for Playwright Testing](https://www.browserstack.com/guide/playwright-best-practices) - General best practices, not monitoring-specific
- [MoldStud - Handling Time Series Data in SQLite Best Practices](https://moldstud.com/articles/p-handling-time-series-data-in-sqlite-best-practices) - Conceptual guidance, lacks code examples

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Industry consensus, multiple authoritative sources (Playwright, FastAPI, SQLite patterns well-documented)
- Architecture patterns: HIGH - Verified with official documentation (Checkly, APScheduler, Twilio, Resend), code examples from authoritative sources
- Pitfalls: MEDIUM - Based on community experience and blog posts, not official documentation, but patterns widely validated
- Build vs buy: HIGH - Pricing verified from official vendor pages as of 2026-02-04, cost comparison straightforward
- Self-monitoring: HIGH - Official Grafana and Prometheus documentation covers meta-monitoring extensively
- Time series schema: HIGH - Dev.to article with specific implementation details, approach validated by production systems
- Alert management: MEDIUM - Concepts from vendor documentation (Squadcast, Atlassian), specific implementation details less documented

**Research date:** 2026-02-04
**Valid until:** 2026-03-06 (30 days - stable domain, but pricing and tooling evolve)

**Notes:**
- Project already has Playwright E2E tests in `/e2e` directory (beta-signup-flow, buy-now-flow, etc.) which can be directly reused for synthetic monitoring
- Twilio and Resend integrations already exist in backend, can be leveraged for alerting
- FastAPI backend structure in place (`backend/app/`), monitoring service can follow same patterns
- Next.js frontend exists, status dashboard can be added as new page
- SQLite already used for application database, same approach for monitoring metrics is consistent
- Current pricing (as of 2026-02-04): Twilio $0.0083/SMS, Resend 3000 emails/month free, estimated self-hosted cost ~$5/month vs Checkly $40/month
