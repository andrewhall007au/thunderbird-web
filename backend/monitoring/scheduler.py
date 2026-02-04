"""
APScheduler Configuration
Schedules health checks at configured intervals.
"""

import logging
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

logger = logging.getLogger(__name__)


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

    logger.info(f"Scheduler configured with {len(scheduler.get_jobs())} jobs")

    return scheduler
