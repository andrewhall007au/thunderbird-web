"""
Log Collector
Collect errors from Python logging and log files.
"""

import logging
import re
import hashlib
import subprocess
import json
from datetime import datetime, timedelta
from typing import Optional
from pathlib import Path

from .storage import store_log_entry


class MonitoringLogHandler(logging.Handler):
    """
    Custom logging handler that stores ERROR and above to monitoring database.
    """

    def __init__(self, level=logging.ERROR):
        """
        Initialize handler.

        Args:
            level: Minimum log level to capture (default: ERROR)
        """
        super().__init__(level=level)
        self.last_seen = {}  # Deduplication: content hash -> timestamp

    def emit(self, record: logging.LogRecord):
        """
        Store log record to monitoring database.

        Args:
            record: LogRecord from Python logging
        """
        try:
            # Extract basic info
            level = record.levelname
            source = record.name
            message = record.getMessage()

            # Extract traceback if available
            traceback = None
            if record.exc_info:
                import traceback as tb_module
                traceback = ''.join(tb_module.format_exception(*record.exc_info))

            # Extract request context if available
            request_path = getattr(record, 'request_path', None)
            request_method = getattr(record, 'request_method', None)

            # Build metadata
            metadata = {
                'pathname': record.pathname,
                'lineno': record.lineno,
                'funcName': record.funcName,
            }

            # Add any custom attributes
            for key in ['user_id', 'request_id', 'account_id']:
                if hasattr(record, key):
                    metadata[key] = getattr(record, key)

            # Deduplication: skip if same error seen within 1 second
            content_hash = hashlib.md5(
                f"{source}:{message}".encode()
            ).hexdigest()

            now = datetime.utcnow()
            if content_hash in self.last_seen:
                last_time = self.last_seen[content_hash]
                if (now - last_time).total_seconds() < 1.0:
                    return  # Skip duplicate

            self.last_seen[content_hash] = now

            # Store to database
            store_log_entry(
                level=level,
                source=source,
                message=message,
                traceback=traceback,
                request_path=request_path,
                request_method=request_method,
                metadata=metadata
            )

        except Exception as e:
            # Don't raise exceptions from logging handler
            # (would cause infinite loop if logger also logs errors)
            print(f"MonitoringLogHandler error: {e}")


# Track last scrape position to avoid re-processing
_last_scrape_ms = {}


def collect_recent_errors(log_file_path: str, since_ms: Optional[int] = None) -> list[dict]:
    """
    Parse log file and extract error entries.

    Args:
        log_file_path: Path to log file to scrape
        since_ms: Only collect entries after this timestamp (milliseconds since epoch)

    Returns:
        List of parsed log entries
    """
    global _last_scrape_ms

    if not Path(log_file_path).exists():
        return []

    # Use last scrape time if since_ms not provided
    if since_ms is None:
        since_ms = _last_scrape_ms.get(log_file_path, 0)

    try:
        with open(log_file_path, 'r') as f:
            lines = f.readlines()
    except (IOError, PermissionError) as e:
        print(f"Error reading log file {log_file_path}: {e}")
        return []

    entries = []
    current_entry = None
    traceback_lines = []

    # Pattern to match log lines (adjust to match your log format)
    # Example: {"timestamp": "2026-02-04T12:00:00", "level": "ERROR", "message": "..."}
    log_pattern = re.compile(r'\{"timestamp":\s*"([^"]+)",\s*"level":\s*"([^"]+)",\s*"message":\s*"(.*)"\}')

    # Pattern for Python tracebacks
    traceback_start = re.compile(r'^Traceback \(most recent call last\):')
    traceback_line = re.compile(r'^\s+(File|.*Error:)')

    for line in lines:
        # Try to match structured JSON log line
        match = log_pattern.match(line.strip())
        if match:
            # Finish previous entry if collecting traceback
            if current_entry and traceback_lines:
                current_entry['traceback'] = '\n'.join(traceback_lines)
                entries.append(current_entry)
                traceback_lines = []
                current_entry = None

            timestamp_str, level, message = match.groups()

            # Filter by level (only ERROR, CRITICAL, WARNING)
            if level not in ['ERROR', 'CRITICAL', 'WARNING']:
                continue

            # Parse timestamp
            try:
                dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                timestamp_ms = int(dt.timestamp() * 1000)
            except ValueError:
                # Skip if can't parse timestamp
                continue

            # Filter by time
            if timestamp_ms <= since_ms:
                continue

            # Extract source from message if possible (e.g., "backend.app.routers.webhook")
            source_match = re.search(r'(\w+\.)+\w+', message)
            source = source_match.group(0) if source_match else 'unknown'

            current_entry = {
                'timestamp_ms': timestamp_ms,
                'level': level,
                'source': source,
                'message': message,
                'traceback': None,
                'request_path': None,
                'request_method': None,
                'metadata': {}
            }

            # If no traceback follows, store immediately
            entries.append(current_entry)
            current_entry = None

        elif traceback_start.match(line):
            # Start of traceback
            traceback_lines = [line.strip()]

        elif traceback_line.match(line) and traceback_lines:
            # Continuation of traceback
            traceback_lines.append(line.strip())

        elif traceback_lines:
            # End of traceback
            if current_entry:
                current_entry['traceback'] = '\n'.join(traceback_lines)
            traceback_lines = []

    # Store entries to database
    for entry in entries:
        store_log_entry(
            level=entry['level'],
            source=entry['source'],
            message=entry['message'],
            traceback=entry['traceback'],
            request_path=entry['request_path'],
            request_method=entry['request_method'],
            metadata=entry['metadata']
        )

    # Update last scrape time
    if entries:
        _last_scrape_ms[log_file_path] = max(e['timestamp_ms'] for e in entries)

    return entries


def collect_from_systemd_journal(
    service_name: str = "thunderbird-backend",
    since_minutes: int = 5
) -> list[dict]:
    """
    Collect errors from systemd journal.

    Args:
        service_name: Systemd service name
        since_minutes: Collect entries from the last N minutes

    Returns:
        List of parsed log entries
    """
    try:
        # Run journalctl command
        cmd = [
            'journalctl',
            '-u', service_name,
            '--since', f"{since_minutes} min ago",
            '-p', 'err',  # priority: error and above
            '--no-pager',
            '-o', 'json'
        ]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)

        if result.returncode != 0:
            print(f"journalctl error: {result.stderr}")
            return []

        entries = []
        for line in result.stdout.strip().split('\n'):
            if not line:
                continue

            try:
                data = json.loads(line)

                # Extract fields
                message = data.get('MESSAGE', '')
                priority = int(data.get('PRIORITY', 6))  # 6 = info
                timestamp_us = int(data.get('__REALTIME_TIMESTAMP', 0))
                timestamp_ms = timestamp_us // 1000

                # Map priority to level
                # 0-2: CRITICAL, 3: ERROR, 4: WARNING
                if priority <= 2:
                    level = 'CRITICAL'
                elif priority == 3:
                    level = 'ERROR'
                elif priority == 4:
                    level = 'WARNING'
                else:
                    continue  # Skip info and below

                # Extract source (try SYSLOG_IDENTIFIER or default)
                source = data.get('SYSLOG_IDENTIFIER', service_name)

                # Store entry
                store_log_entry(
                    level=level,
                    source=source,
                    message=message,
                    traceback=None,
                    request_path=None,
                    request_method=None,
                    metadata={
                        'priority': priority,
                        'unit': data.get('_SYSTEMD_UNIT', ''),
                        'pid': data.get('_PID', '')
                    }
                )

                entries.append({
                    'timestamp_ms': timestamp_ms,
                    'level': level,
                    'source': source,
                    'message': message
                })

            except (json.JSONDecodeError, ValueError, KeyError) as e:
                print(f"Error parsing journalctl line: {e}")
                continue

        return entries

    except subprocess.TimeoutExpired:
        print("journalctl command timed out")
        return []
    except FileNotFoundError:
        # journalctl not available (not on systemd)
        return []
    except Exception as e:
        print(f"Error collecting from systemd journal: {e}")
        return []
