"""
APScheduler Configuration
Schedules health checks at configured intervals.
"""

import logging
import shutil
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger
from apscheduler.events import EVENT_JOB_ERROR

from .config import settings
from .checks import (
    check_backend_health,
    check_frontend_loads,
    check_api_response_time,
    check_beta_signup_endpoint,
    check_weather_api,
    check_database_query_performance,
    check_external_api_latency,
)
from .storage import cleanup_old_metrics, store_metric
from .logs.collector import collect_from_systemd_journal, collect_recent_errors
from .logs.analyzer import check_error_rate, detect_error_patterns
from .logs.storage import cleanup_old_logs

# Import synthetic checks
from .checks_synthetic import (
    check_beta_signup_synthetic,
    check_buy_now_synthetic,
    check_create_first_synthetic,
    check_login_synthetic,
    check_sms_webhook_synthetic,
)

logger = logging.getLogger(__name__)

# Check if Playwright is available for browser-based synthetic tests
PLAYWRIGHT_AVAILABLE = shutil.which('npx') is not None


def run_health_check_job():
    """Run basic health checks (backend, frontend, API response time)."""
    checks = [
        check_backend_health,
        check_frontend_loads,
        check_api_response_time,
    ]

    for check_func in checks:
        try:
            result = check_func()
            store_metric(
                check_name=result.check_name,
                status=result.status,
                duration_ms=result.duration_ms,
                error_message=result.error_message,
                metadata=result.metadata
            )
            logger.info(f"{result.check_name}: {result.status} ({result.duration_ms:.0f}ms)")
        except Exception as e:
            logger.error(f"Check {check_func.__name__} failed: {e}")


def run_beta_signup_check():
    """Run beta signup flow check."""
    try:
        result = check_beta_signup_endpoint()
        store_metric(
            check_name=result.check_name,
            status=result.status,
            duration_ms=result.duration_ms,
            error_message=result.error_message,
            metadata=result.metadata
        )
        logger.info(f"{result.check_name}: {result.status} ({result.duration_ms:.0f}ms)")
    except Exception as e:
        logger.error(f"Beta signup check failed: {e}")


def run_weather_api_check():
    """Run weather API check."""
    try:
        result = check_weather_api()
        store_metric(
            check_name=result.check_name,
            status=result.status,
            duration_ms=result.duration_ms,
            error_message=result.error_message,
            metadata=result.metadata
        )
        logger.info(f"{result.check_name}: {result.status} ({result.duration_ms:.0f}ms)")
    except Exception as e:
        logger.error(f"Weather API check failed: {e}")


def run_db_query_performance_check():
    """Run database query performance check."""
    try:
        result = check_database_query_performance()
        store_metric(
            check_name=result.check_name,
            status=result.status,
            duration_ms=result.duration_ms,
            error_message=result.error_message,
            metadata=result.metadata
        )
        logger.info(f"{result.check_name}: {result.status} ({result.duration_ms:.0f}ms)")
    except Exception as e:
        logger.error(f"DB query performance check failed: {e}")


def run_external_api_latency_check():
    """Run external API latency check."""
    try:
        result = check_external_api_latency()
        store_metric(
            check_name=result.check_name,
            status=result.status,
            duration_ms=result.duration_ms,
            error_message=result.error_message,
            metadata=result.metadata
        )
        logger.info(f"{result.check_name}: {result.status} ({result.duration_ms:.0f}ms)")
    except Exception as e:
        logger.error(f"External API latency check failed: {e}")


def run_cleanup_job():
    """Run metrics cleanup (delete old metrics)."""
    try:
        deleted = cleanup_old_metrics(settings.METRICS_RETENTION_DAYS)
        logger.info(f"Cleanup: deleted {deleted} old metrics")
    except Exception as e:
        logger.error(f"Cleanup job failed: {e}")


def run_log_collection_job():
    """Collect error logs from systemd journal or log files."""
    try:
        # Try systemd journal first (production environment)
        entries = collect_from_systemd_journal(
            service_name=getattr(settings, 'SYSTEMD_SERVICE_NAME', 'thunderbird-backend'),
            since_minutes=2
        )

        if entries:
            logger.info(f"Log collection: collected {len(entries)} entries from systemd journal")
        else:
            # Fallback to log file scraping if journal not available
            log_file = getattr(settings, 'LOG_FILE_PATH', None)
            if log_file:
                entries = collect_recent_errors(log_file)
                if entries:
                    logger.info(f"Log collection: collected {len(entries)} entries from log file")
            else:
                logger.debug("Log collection: no systemd journal or log file configured, skipping")

    except Exception as e:
        logger.error(f"Log collection job failed: {e}")


def run_error_rate_check_job():
    """Check error rate and feed through alerting pipeline."""
    try:
        result = check_error_rate()

        # Store metric
        store_metric(
            check_name=result.check_name,
            status=result.status,
            duration_ms=result.duration_ms,
            error_message=result.error_message,
            metadata=result.metadata
        )

        logger.info(f"{result.check_name}: {result.status} ({result.metadata.get('errors_per_minute', 0):.2f} errors/min)")

    except Exception as e:
        logger.error(f"Error rate check job failed: {e}")


def run_pattern_detection_job():
    """Detect error patterns from recent logs."""
    try:
        patterns = detect_error_patterns(hours=0.5)  # Last 30 minutes

        # Count new patterns (first seen in last 30 min)
        from datetime import datetime, timedelta
        cutoff_ms = int((datetime.utcnow() - timedelta(minutes=30)).timestamp() * 1000)
        new_patterns = [p for p in patterns if p['first_seen_ms'] > cutoff_ms]

        if new_patterns:
            logger.info(f"Pattern detection: found {len(new_patterns)} new patterns")
        else:
            logger.debug(f"Pattern detection: analyzed {len(patterns)} patterns, no new patterns")

    except Exception as e:
        logger.error(f"Pattern detection job failed: {e}")


def job_error_listener(event):
    """Log job errors."""
    logger.error(f"Job {event.job_id} failed: {event.exception}")


def create_scheduler() -> AsyncIOScheduler:
    """
    Create and configure APScheduler with monitoring jobs.

    Returns:
        Configured AsyncIOScheduler (not started)
    """
    scheduler = AsyncIOScheduler(
        timezone="UTC",
        job_defaults={
            "coalesce": True,
            "max_instances": 1,
            "misfire_grace_time": 300
        }
    )

    # Add job error listener
    scheduler.add_listener(job_error_listener, EVENT_JOB_ERROR)

    intervals = settings.CHECK_INTERVALS

    # Health checks (backend, frontend, API response time) - 1 minute
    scheduler.add_job(
        run_health_check_job,
        trigger=IntervalTrigger(minutes=intervals["health_check"]),
        id="health_check",
        name="Health Check"
    )

    # Beta signup flow - 5 minutes
    scheduler.add_job(
        run_beta_signup_check,
        trigger=IntervalTrigger(minutes=intervals["beta_signup_flow"]),
        id="beta_signup_flow",
        name="Beta Signup Flow"
    )

    # Weather API - 10 minutes
    scheduler.add_job(
        run_weather_api_check,
        trigger=IntervalTrigger(minutes=intervals["weather_api"]),
        id="weather_api",
        name="Weather API"
    )

    # Database query performance - 5 minutes
    scheduler.add_job(
        run_db_query_performance_check,
        trigger=IntervalTrigger(minutes=intervals["db_query_performance"]),
        id="db_query_performance",
        name="Database Query Performance"
    )

    # External API latency - 10 minutes
    scheduler.add_job(
        run_external_api_latency_check,
        trigger=IntervalTrigger(minutes=intervals["external_api_latency"]),
        id="external_api_latency",
        name="External API Latency"
    )

    # Cleanup job - daily at 3 AM UTC
    scheduler.add_job(
        run_cleanup_job,
        trigger=CronTrigger(hour=3, minute=0, timezone="UTC"),
        id="cleanup",
        name="Metrics Cleanup"
    )

    # Log collection - every 2 minutes
    scheduler.add_job(
        run_log_collection_job,
        trigger=IntervalTrigger(minutes=2),
        id="log_collection",
        name="Log Collection"
    )

    # Error rate check - every 5 minutes
    scheduler.add_job(
        run_error_rate_check_job,
        trigger=IntervalTrigger(minutes=5),
        id="error_rate_check",
        name="Error Rate Check"
    )

    # Pattern detection - every 30 minutes
    scheduler.add_job(
        run_pattern_detection_job,
        trigger=IntervalTrigger(minutes=30),
        id="pattern_detection",
        name="Pattern Detection"
    )

    logger.info(f"Scheduler configured with {len(scheduler.get_jobs())} jobs")

    return scheduler
