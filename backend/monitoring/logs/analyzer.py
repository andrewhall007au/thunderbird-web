"""
Error Pattern Detection and Rate Tracking
Analyze error logs for patterns and rate anomalies.
"""

import re
import hashlib
from datetime import datetime, timedelta
from typing import Optional

from .storage import (
    search_logs,
    get_error_rate,
    store_error_pattern,
    get_top_patterns
)
from ..storage import CheckResult


def normalize_error_message(message: str) -> str:
    """
    Normalize error message by replacing variable data.

    Args:
        message: Raw error message

    Returns:
        Normalized message with placeholders
    """
    # Replace UUIDs
    message = re.sub(
        r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
        '{UUID}',
        message,
        flags=re.IGNORECASE
    )

    # Replace numbers
    message = re.sub(r'\b\d+\b', '{N}', message)

    # Replace quoted strings
    message = re.sub(r'"[^"]*"', '{STR}', message)
    message = re.sub(r"'[^']*'", '{STR}', message)

    # Replace IP addresses
    message = re.sub(
        r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b',
        '{IP}',
        message
    )

    # Replace timestamps (common formats)
    message = re.sub(
        r'\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}',
        '{TIMESTAMP}',
        message
    )

    # Replace file paths
    message = re.sub(r'/[^\s]+', '{PATH}', message)

    # Replace line numbers in tracebacks
    message = re.sub(r'line \d+', 'line {N}', message)

    return message


def detect_error_patterns(hours: int = 24) -> list[dict]:
    """
    Detect error patterns by normalizing and deduplicating messages.

    Args:
        hours: Number of hours to analyze

    Returns:
        List of error patterns with occurrence counts
    """
    # Get recent errors
    start_ms = int((datetime.utcnow() - timedelta(hours=hours)).timestamp() * 1000)
    result = search_logs(
        start_ms=start_ms,
        limit=1000  # Analyze up to 1000 recent errors
    )

    # Normalize and hash messages
    patterns = {}
    for log_entry in result['logs']:
        normalized = normalize_error_message(log_entry['message'])
        pattern_hash = hashlib.md5(normalized.encode()).hexdigest()

        if pattern_hash not in patterns:
            patterns[pattern_hash] = {
                'normalized': normalized,
                'sample_message': log_entry['message'],
                'source': log_entry['source'],
                'count': 0
            }

        patterns[pattern_hash]['count'] += 1

    # Store patterns to database
    for pattern_hash, pattern_data in patterns.items():
        store_error_pattern(
            pattern_hash=pattern_hash,
            message=pattern_data['normalized'],
            source=pattern_data['source']
        )

    # Return top patterns
    return get_top_patterns(limit=20)


def check_error_rate(config: Optional[dict] = None) -> CheckResult:
    """
    Check current error rate and return CheckResult.

    Args:
        config: Optional configuration dict (unused, for compatibility)

    Returns:
        CheckResult with error rate status
    """
    import time
    start_time = time.time()

    # Calculate error rate over last 5 minutes
    rate_data = get_error_rate(hours=5/60)  # 5 minutes in hours

    errors_per_minute = rate_data['errors_per_minute']
    total_errors = rate_data['total_errors']

    # Determine status based on thresholds
    if errors_per_minute < 1.0:
        status = 'pass'
        error_message = None
    elif errors_per_minute < 5.0:
        status = 'degraded'
        error_message = f"Elevated error rate: {errors_per_minute:.2f} errors/min"
    else:
        status = 'fail'
        error_message = f"Critical error rate: {errors_per_minute:.2f} errors/min"

    duration_ms = (time.time() - start_time) * 1000

    return CheckResult(
        check_name='error_rate',
        status=status,
        duration_ms=duration_ms,
        error_message=error_message,
        metadata={
            'errors_per_minute': errors_per_minute,
            'total_errors': total_errors,
            'by_level': rate_data['by_level'],
            'by_source': rate_data['by_source']
        }
    )


def get_pattern_summary() -> dict:
    """
    Get summary of error patterns.

    Returns:
        Dict with pattern statistics
    """
    patterns = get_top_patterns(limit=100)

    # Calculate summary stats
    now_ms = int(datetime.utcnow().timestamp() * 1000)
    day_ago_ms = int((datetime.utcnow() - timedelta(days=1)).timestamp() * 1000)

    new_patterns = [p for p in patterns if p['first_seen_ms'] > day_ago_ms]

    # Find trending patterns (last_seen within 1 hour and count > 10)
    hour_ago_ms = int((datetime.utcnow() - timedelta(hours=1)).timestamp() * 1000)
    trending = [
        p for p in patterns
        if p['last_seen_ms'] > hour_ago_ms and p['occurrence_count'] > 10
    ]

    # Group by source
    by_source = {}
    for p in patterns:
        source = p['source']
        if source not in by_source:
            by_source[source] = []
        by_source[source].append(p)

    # Top patterns
    top_patterns = sorted(patterns, key=lambda x: x['occurrence_count'], reverse=True)[:20]

    return {
        'total_patterns': len(patterns),
        'new_patterns_24h': len(new_patterns),
        'trending_patterns': len(trending),
        'top_patterns': top_patterns,
        'by_source': {
            source: len(patterns)
            for source, patterns in by_source.items()
        }
    }
