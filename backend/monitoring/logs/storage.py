"""
Log Storage
SQLite storage for centralized error logs with search capabilities.
"""

import sqlite3
import json
import uuid
from datetime import datetime, timedelta
from typing import Optional
from pathlib import Path

from ..storage import get_connection


def init_log_tables():
    """Create log tables if they don't exist."""
    conn = get_connection()

    # Error logs table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS error_logs (
            id TEXT PRIMARY KEY,
            timestamp_ms INTEGER NOT NULL,
            level TEXT NOT NULL,
            source TEXT NOT NULL,
            message TEXT NOT NULL,
            traceback TEXT,
            request_path TEXT,
            request_method TEXT,
            metadata TEXT
        )
    """)

    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_error_logs_ts
        ON error_logs(timestamp_ms DESC)
    """)

    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_error_logs_level
        ON error_logs(level, timestamp_ms DESC)
    """)

    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_error_logs_source
        ON error_logs(source, timestamp_ms DESC)
    """)

    # Error patterns table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS error_patterns (
            id TEXT PRIMARY KEY,
            pattern_hash TEXT NOT NULL UNIQUE,
            first_seen_ms INTEGER NOT NULL,
            last_seen_ms INTEGER NOT NULL,
            occurrence_count INTEGER DEFAULT 1,
            sample_message TEXT NOT NULL,
            source TEXT NOT NULL,
            severity TEXT DEFAULT 'unknown',
            status TEXT DEFAULT 'new'
        )
    """)

    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_error_patterns_hash
        ON error_patterns(pattern_hash)
    """)

    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_error_patterns_count
        ON error_patterns(occurrence_count DESC)
    """)

    conn.commit()
    conn.close()


def store_log_entry(
    level: str,
    source: str,
    message: str,
    traceback: Optional[str] = None,
    request_path: Optional[str] = None,
    request_method: Optional[str] = None,
    metadata: Optional[dict] = None
) -> str:
    """
    Store a log entry in the database.

    Args:
        level: Log level ('ERROR', 'WARNING', 'CRITICAL')
        source: Module/file that generated the error (e.g., 'backend.app.routers.webhook')
        message: Error message
        traceback: Full traceback if available
        request_path: HTTP request path if available
        request_method: HTTP method (GET, POST, etc.)
        metadata: Additional context as JSON dict

    Returns:
        Log entry ID (UUID)
    """
    conn = get_connection()

    log_id = str(uuid.uuid4())
    timestamp_ms = int(datetime.utcnow().timestamp() * 1000)
    metadata_json = json.dumps(metadata) if metadata else None

    conn.execute("""
        INSERT INTO error_logs (
            id, timestamp_ms, level, source, message,
            traceback, request_path, request_method, metadata
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        log_id, timestamp_ms, level, source, message,
        traceback, request_path, request_method, metadata_json
    ))

    conn.commit()
    conn.close()

    return log_id


def search_logs(
    query: Optional[str] = None,
    level: Optional[str] = None,
    source: Optional[str] = None,
    start_ms: Optional[int] = None,
    end_ms: Optional[int] = None,
    limit: int = 100,
    offset: int = 0
) -> dict:
    """
    Search and filter logs.

    Args:
        query: Substring search on message and traceback
        level: Filter by level ('ERROR', 'WARNING', 'CRITICAL')
        source: Filter by source module (exact match or prefix with *)
        start_ms: Start time filter (milliseconds since epoch)
        end_ms: End time filter (milliseconds since epoch)
        limit: Max results to return
        offset: Offset for pagination

    Returns:
        Dict with total count and list of log entries
    """
    conn = get_connection()

    # Build WHERE clause
    where_clauses = []
    params = []

    if query:
        where_clauses.append("(message LIKE ? OR traceback LIKE ?)")
        params.extend([f"%{query}%", f"%{query}%"])

    if level:
        where_clauses.append("level = ?")
        params.append(level)

    if source:
        if source.endswith('*'):
            # Prefix match
            where_clauses.append("source LIKE ?")
            params.append(f"{source[:-1]}%")
        else:
            # Exact match
            where_clauses.append("source = ?")
            params.append(source)

    if start_ms:
        where_clauses.append("timestamp_ms >= ?")
        params.append(start_ms)

    if end_ms:
        where_clauses.append("timestamp_ms <= ?")
        params.append(end_ms)

    where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"

    # Get total count
    cursor = conn.execute(f"""
        SELECT COUNT(*) as total
        FROM error_logs
        WHERE {where_sql}
    """, params)
    total = cursor.fetchone()['total']

    # Get paginated results
    cursor = conn.execute(f"""
        SELECT
            id, timestamp_ms, level, source, message,
            traceback, request_path, request_method, metadata
        FROM error_logs
        WHERE {where_sql}
        ORDER BY timestamp_ms DESC
        LIMIT ? OFFSET ?
    """, params + [limit, offset])

    rows = cursor.fetchall()
    conn.close()

    logs = []
    for row in rows:
        log_entry = dict(row)
        if log_entry['metadata']:
            log_entry['metadata'] = json.loads(log_entry['metadata'])
        logs.append(log_entry)

    return {
        'total': total,
        'limit': limit,
        'offset': offset,
        'logs': logs
    }


def get_error_rate(hours: int = 1) -> dict:
    """
    Calculate error rate over the specified time period.

    Args:
        hours: Number of hours to calculate rate over

    Returns:
        Dict with error counts, rate, and breakdowns by source and level
    """
    conn = get_connection()

    cutoff_ms = int((datetime.utcnow() - timedelta(hours=hours)).timestamp() * 1000)

    # Total errors
    cursor = conn.execute("""
        SELECT COUNT(*) as total
        FROM error_logs
        WHERE timestamp_ms > ?
    """, (cutoff_ms,))
    total_errors = cursor.fetchone()['total']

    # Errors per minute
    errors_per_minute = total_errors / (hours * 60) if hours > 0 else 0

    # Group by level
    cursor = conn.execute("""
        SELECT level, COUNT(*) as count
        FROM error_logs
        WHERE timestamp_ms > ?
        GROUP BY level
    """, (cutoff_ms,))
    by_level = {row['level']: row['count'] for row in cursor.fetchall()}

    # Group by source
    cursor = conn.execute("""
        SELECT source, COUNT(*) as count
        FROM error_logs
        WHERE timestamp_ms > ?
        GROUP BY source
        ORDER BY count DESC
        LIMIT 10
    """, (cutoff_ms,))
    by_source = {row['source']: row['count'] for row in cursor.fetchall()}

    conn.close()

    return {
        'total_errors': total_errors,
        'errors_per_minute': round(errors_per_minute, 2),
        'by_level': by_level,
        'by_source': by_source
    }


def get_error_count_by_interval(hours: int = 24, interval_minutes: int = 60) -> list[dict]:
    """
    Get time-bucketed error counts for charting.

    Args:
        hours: Number of hours to look back
        interval_minutes: Bucket size in minutes

    Returns:
        List of dicts with interval_start and count
    """
    conn = get_connection()

    cutoff_ms = int((datetime.utcnow() - timedelta(hours=hours)).timestamp() * 1000)
    interval_ms = interval_minutes * 60 * 1000

    cursor = conn.execute("""
        SELECT
            (timestamp_ms / ?) * ? as interval_start_ms,
            COUNT(*) as count
        FROM error_logs
        WHERE timestamp_ms > ?
        GROUP BY interval_start_ms
        ORDER BY interval_start_ms ASC
    """, (interval_ms, interval_ms, cutoff_ms))

    rows = cursor.fetchall()
    conn.close()

    results = []
    for row in rows:
        interval_start = datetime.utcfromtimestamp(row['interval_start_ms'] / 1000).isoformat() + 'Z'
        results.append({
            'interval_start': interval_start,
            'count': row['count']
        })

    return results


def store_error_pattern(pattern_hash: str, message: str, source: str) -> str:
    """
    Create or update an error pattern.

    Args:
        pattern_hash: Hash of normalized error message
        message: Sample error message
        source: Module that generated the error

    Returns:
        Pattern ID (UUID)
    """
    conn = get_connection()

    timestamp_ms = int(datetime.utcnow().timestamp() * 1000)

    # Check if pattern exists
    cursor = conn.execute("""
        SELECT id, occurrence_count
        FROM error_patterns
        WHERE pattern_hash = ?
    """, (pattern_hash,))

    existing = cursor.fetchone()

    if existing:
        # Update existing pattern
        pattern_id = existing['id']
        new_count = existing['occurrence_count'] + 1

        conn.execute("""
            UPDATE error_patterns
            SET last_seen_ms = ?, occurrence_count = ?
            WHERE id = ?
        """, (timestamp_ms, new_count, pattern_id))
    else:
        # Create new pattern
        pattern_id = str(uuid.uuid4())

        conn.execute("""
            INSERT INTO error_patterns (
                id, pattern_hash, first_seen_ms, last_seen_ms,
                occurrence_count, sample_message, source
            )
            VALUES (?, ?, ?, ?, 1, ?, ?)
        """, (pattern_id, pattern_hash, timestamp_ms, timestamp_ms, message, source))

    conn.commit()
    conn.close()

    return pattern_id


def get_top_patterns(limit: int = 20) -> list[dict]:
    """
    Get most frequent error patterns.

    Args:
        limit: Max number of patterns to return

    Returns:
        List of error patterns sorted by occurrence count
    """
    conn = get_connection()

    cursor = conn.execute("""
        SELECT
            id, pattern_hash, first_seen_ms, last_seen_ms,
            occurrence_count, sample_message, source, severity, status
        FROM error_patterns
        ORDER BY occurrence_count DESC
        LIMIT ?
    """, (limit,))

    rows = cursor.fetchall()
    conn.close()

    return [dict(row) for row in rows]


def update_pattern_status(pattern_id: str, status: str):
    """
    Update pattern status.

    Args:
        pattern_id: Pattern UUID
        status: New status ('new', 'known', 'resolved', 'ignored')
    """
    conn = get_connection()

    conn.execute("""
        UPDATE error_patterns
        SET status = ?
        WHERE id = ?
    """, (status, pattern_id))

    conn.commit()
    conn.close()


def cleanup_old_logs(retention_days: int = 90) -> int:
    """
    Delete logs older than retention period.

    Args:
        retention_days: Number of days to retain logs

    Returns:
        Number of logs deleted
    """
    conn = get_connection()

    cutoff_ms = int((datetime.utcnow() - timedelta(days=retention_days)).timestamp() * 1000)

    cursor = conn.execute("""
        DELETE FROM error_logs
        WHERE timestamp_ms < ?
    """, (cutoff_ms,))

    deleted_count = cursor.rowcount
    conn.commit()
    conn.close()

    return deleted_count
