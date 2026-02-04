"""
Metrics Storage
SQLite database for storing health check results and incidents.
"""

import sqlite3
import json
import uuid
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from typing import Optional
from pathlib import Path

from .config import settings


@dataclass
class CheckResult:
    """Result of a health check."""
    check_name: str
    status: str  # 'pass', 'fail', 'degraded'
    duration_ms: float
    error_message: Optional[str] = None
    metadata: Optional[dict] = None


def get_connection() -> sqlite3.Connection:
    """Get SQLite connection with WAL mode enabled."""
    db_path = Path(settings.MONITORING_DB_PATH)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(db_path), timeout=30)
    conn.row_factory = sqlite3.Row

    # Enable WAL mode for concurrent reads/writes
    conn.execute("PRAGMA journal_mode=WAL")

    return conn


def init_db():
    """Initialize database tables."""
    conn = get_connection()

    # Metrics table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS metrics (
            id TEXT PRIMARY KEY,
            timestamp_ms INTEGER NOT NULL,
            check_name TEXT NOT NULL,
            status TEXT NOT NULL,
            duration_ms REAL,
            error_message TEXT,
            metadata TEXT
        )
    """)

    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_metrics_ts
        ON metrics(timestamp_ms DESC)
    """)

    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_metrics_check
        ON metrics(check_name, status, timestamp_ms DESC)
    """)

    # Incidents table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS incidents (
            id TEXT PRIMARY KEY,
            check_name TEXT NOT NULL,
            severity TEXT NOT NULL,
            status TEXT NOT NULL,
            first_seen_ms INTEGER NOT NULL,
            last_seen_ms INTEGER NOT NULL,
            resolved_ms INTEGER,
            failure_count INTEGER DEFAULT 1,
            message TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    conn.close()


def store_metric(
    check_name: str,
    status: str,
    duration_ms: float,
    error_message: Optional[str] = None,
    metadata: Optional[dict] = None
) -> str:
    """
    Store a metric in the database.

    Returns:
        Metric ID (UUID)
    """
    conn = get_connection()

    metric_id = str(uuid.uuid4())
    timestamp_ms = int(datetime.utcnow().timestamp() * 1000)
    metadata_json = json.dumps(metadata) if metadata else None

    conn.execute("""
        INSERT INTO metrics (id, timestamp_ms, check_name, status, duration_ms, error_message, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (metric_id, timestamp_ms, check_name, status, duration_ms, error_message, metadata_json))

    conn.commit()
    conn.close()

    return metric_id


def get_recent_metrics(check_name: str, hours: int = 1) -> list[dict]:
    """Get recent metrics for a check."""
    conn = get_connection()

    cutoff_ms = int((datetime.utcnow() - timedelta(hours=hours)).timestamp() * 1000)

    cursor = conn.execute("""
        SELECT id, timestamp_ms, check_name, status, duration_ms, error_message, metadata
        FROM metrics
        WHERE check_name = ? AND timestamp_ms > ?
        ORDER BY timestamp_ms DESC
    """, (check_name, cutoff_ms))

    rows = cursor.fetchall()
    conn.close()

    results = []
    for row in rows:
        result = dict(row)
        if result['metadata']:
            result['metadata'] = json.loads(result['metadata'])
        results.append(result)

    return results


def get_uptime_stats(check_name: str, hours: int = 24) -> dict:
    """Calculate uptime statistics for a check."""
    conn = get_connection()

    cutoff_ms = int((datetime.utcnow() - timedelta(hours=hours)).timestamp() * 1000)

    cursor = conn.execute("""
        SELECT
            COUNT(*) as total_checks,
            SUM(CASE WHEN status = 'pass' THEN 1 ELSE 0 END) as pass_count,
            AVG(duration_ms) as avg_duration_ms
        FROM metrics
        WHERE check_name = ? AND timestamp_ms > ?
    """, (check_name, cutoff_ms))

    row = cursor.fetchone()
    conn.close()

    if row and row['total_checks'] > 0:
        return {
            'check_name': check_name,
            'total_checks': row['total_checks'],
            'pass_count': row['pass_count'],
            'fail_count': row['total_checks'] - row['pass_count'],
            'uptime_percent': (row['pass_count'] / row['total_checks']) * 100,
            'avg_duration_ms': row['avg_duration_ms']
        }

    return {
        'check_name': check_name,
        'total_checks': 0,
        'pass_count': 0,
        'fail_count': 0,
        'uptime_percent': 0,
        'avg_duration_ms': 0
    }


def get_all_latest_statuses() -> list[dict]:
    """Get the latest status for each check."""
    conn = get_connection()

    # Get latest metric per check_name using window function
    cursor = conn.execute("""
        WITH latest AS (
            SELECT
                check_name,
                MAX(timestamp_ms) as max_ts
            FROM metrics
            GROUP BY check_name
        )
        SELECT
            m.id,
            m.timestamp_ms,
            m.check_name,
            m.status,
            m.duration_ms,
            m.error_message,
            m.metadata
        FROM metrics m
        INNER JOIN latest l ON m.check_name = l.check_name AND m.timestamp_ms = l.max_ts
        ORDER BY m.check_name
    """)

    rows = cursor.fetchall()
    conn.close()

    results = []
    for row in rows:
        result = dict(row)
        if result['metadata']:
            result['metadata'] = json.loads(result['metadata'])
        results.append(result)

    return results


def get_consecutive_failures(check_name: str) -> int:
    """Count consecutive recent failures for a check."""
    conn = get_connection()

    # Get last 10 metrics for this check
    cursor = conn.execute("""
        SELECT status
        FROM metrics
        WHERE check_name = ?
        ORDER BY timestamp_ms DESC
        LIMIT 10
    """, (check_name,))

    rows = cursor.fetchall()
    conn.close()

    # Count consecutive failures from most recent
    consecutive = 0
    for row in rows:
        if row['status'] == 'fail':
            consecutive += 1
        else:
            break

    return consecutive


def cleanup_old_metrics(retention_days: int = 90):
    """Delete metrics older than retention period."""
    conn = get_connection()

    cutoff_ms = int((datetime.utcnow() - timedelta(days=retention_days)).timestamp() * 1000)

    cursor = conn.execute("""
        DELETE FROM metrics
        WHERE timestamp_ms < ?
    """, (cutoff_ms,))

    deleted_count = cursor.rowcount
    conn.commit()
    conn.close()

    return deleted_count


def store_incident(check_name: str, severity: str, message: str) -> str:
    """
    Create or update active incident.

    Returns:
        Incident ID (UUID)
    """
    conn = get_connection()

    # Check if there's already an active incident for this check
    cursor = conn.execute("""
        SELECT id, failure_count
        FROM incidents
        WHERE check_name = ? AND status = 'active'
        ORDER BY first_seen_ms DESC
        LIMIT 1
    """, (check_name,))

    existing = cursor.fetchone()
    timestamp_ms = int(datetime.utcnow().timestamp() * 1000)

    if existing:
        # Update existing incident
        incident_id = existing['id']
        failure_count = existing['failure_count'] + 1

        conn.execute("""
            UPDATE incidents
            SET last_seen_ms = ?, failure_count = ?, message = ?
            WHERE id = ?
        """, (timestamp_ms, failure_count, message, incident_id))
    else:
        # Create new incident
        incident_id = str(uuid.uuid4())

        conn.execute("""
            INSERT INTO incidents (id, check_name, severity, status, first_seen_ms, last_seen_ms, message)
            VALUES (?, ?, ?, 'active', ?, ?, ?)
        """, (incident_id, check_name, severity, timestamp_ms, timestamp_ms, message))

    conn.commit()
    conn.close()

    return incident_id


def resolve_incident(check_name: str):
    """Mark incident as resolved."""
    conn = get_connection()

    timestamp_ms = int(datetime.utcnow().timestamp() * 1000)

    conn.execute("""
        UPDATE incidents
        SET status = 'resolved', resolved_ms = ?
        WHERE check_name = ? AND status IN ('active', 'acknowledged')
    """, (timestamp_ms, check_name))

    conn.commit()
    conn.close()


def acknowledge_incident(incident_id: str):
    """Mark incident as acknowledged."""
    conn = get_connection()

    conn.execute("""
        UPDATE incidents
        SET status = 'acknowledged'
        WHERE id = ? AND status = 'active'
    """, (incident_id,))

    conn.commit()
    conn.close()


def get_active_incidents() -> list[dict]:
    """Get all active or acknowledged incidents."""
    conn = get_connection()

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
            message,
            created_at
        FROM incidents
        WHERE status IN ('active', 'acknowledged')
        ORDER BY first_seen_ms DESC
    """)

    rows = cursor.fetchall()
    conn.close()

    return [dict(row) for row in rows]


def get_incident_timeline(incident_id: str) -> dict:
    """Get incident with all associated metrics during its duration."""
    conn = get_connection()

    # Get incident details
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
            message,
            created_at
        FROM incidents
        WHERE id = ?
    """, (incident_id,))

    incident_row = cursor.fetchone()

    if not incident_row:
        conn.close()
        return None

    incident = dict(incident_row)

    # Get all metrics during incident duration
    end_time = incident['resolved_ms'] if incident['resolved_ms'] else int(datetime.utcnow().timestamp() * 1000)

    cursor = conn.execute("""
        SELECT
            id,
            timestamp_ms,
            check_name,
            status,
            duration_ms,
            error_message,
            metadata
        FROM metrics
        WHERE check_name = ?
          AND timestamp_ms >= ?
          AND timestamp_ms <= ?
        ORDER BY timestamp_ms ASC
    """, (incident['check_name'], incident['first_seen_ms'], end_time))

    metrics = []
    for row in cursor.fetchall():
        metric = dict(row)
        if metric['metadata']:
            metric['metadata'] = json.loads(metric['metadata'])
        metrics.append(metric)

    conn.close()

    incident['metrics'] = metrics
    return incident
