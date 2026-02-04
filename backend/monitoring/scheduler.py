"""
APScheduler Configuration
Schedules health checks at configured intervals.
"""

import logging
import shutil
import asyncio
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
from .storage import cleanup_old_metrics
from . import storage as storage_module
from .alerts.manager import create_alert_manager
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

# Import self-monitoring and reporting
from .self_monitor import send_heartbeat
from .reporting import send_daily_report, send_weekly_report, send_monthly_report

logger = logging.getLogger(__name__)

# Check if Playwright is available for browser-based synthetic tests
PLAYWRIGHT_AVAILABLE = shutil.which('npx') is not None

# Global alert manager instance
alert_manager = None

# Global scheduler instance for self-monitoring
_scheduler = None


def get_or_create_alert_manager():
    """Get or create the global alert manager instance."""
    global alert_manager
    if alert_manager is None:
        alert_manager = create_alert_manager(settings, storage_module)
    return alert_manager


def run_health_check_job():
    """Run basic health checks (backend, frontend, API response time)."""
    checks = [
        check_backend_health,
        check_frontend_loads,
        check_api_response_time,
    ]

    alert_mgr = get_or_create_alert_manager()

    for check_func in checks:
        try:
            result = check_func()
            # Alert manager handles both storing metric and evaluating for alerts
            asyncio.create_task(alert_mgr.evaluate_and_alert(result))
            logger.info(f"{result.check_name}: {result.status} ({result.duration_ms:.0f}ms)")
        except Exception as e:
            logger.error(f"Check {check_func.__name__} failed: {e}")


def run_beta_signup_check():
    """Run beta signup flow check."""
    alert_mgr = get_or_create_alert_manager()
    try:
        result = check_beta_signup_endpoint()
        asyncio.create_task(alert_mgr.evaluate_and_alert(result))
        logger.info(f"{result.check_name}: {result.status} ({result.duration_ms:.0f}ms)")
    except Exception as e:
        logger.error(f"Beta signup check failed: {e}")


def run_weather_api_check():
    """Run weather API check."""
    alert_mgr = get_or_create_alert_manager()
    try:
        result = check_weather_api()
        asyncio.create_task(alert_mgr.evaluate_and_alert(result))
        logger.info(f"{result.check_name}: {result.status} ({result.duration_ms:.0f}ms)")
    except Exception as e:
        logger.error(f"Weather API check failed: {e}")


def run_db_query_performance_check():
    """Run database query performance check."""
    alert_mgr = get_or_create_alert_manager()
    try:
        result = check_database_query_performance()
        asyncio.create_task(alert_mgr.evaluate_and_alert(result))
        logger.info(f"{result.check_name}: {result.status} ({result.duration_ms:.0f}ms)")
    except Exception as e:
        logger.error(f"DB query performance check failed: {e}")


def run_external_api_latency_check():
    """Run external API latency check."""
    alert_mgr = get_or_create_alert_manager()
    try:
        result = check_external_api_latency()
        asyncio.create_task(alert_mgr.evaluate_and_alert(result))
        logger.info(f"{result.check_name}: {result.status} ({result.duration_ms:.0f}ms)")
    except Exception as e:
        logger.error(f"External API latency check failed: {e}")


def run_cleanup_job():
    """Run metrics cleanup (delete old metrics)."""
    try:
        deleted = cleanup_old_metrics(settings.METRICS_RETENTION_DAYS)
        logger.info(f"Cleanup: deleted {deleted} old metrics")

        # Also cleanup old logs
        from .logs.storage import cleanup_old_logs
        deleted_logs = cleanup_old_logs(settings.METRICS_RETENTION_DAYS)
        logger.info(f"Cleanup: deleted {deleted_logs} old log entries")
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
    alert_mgr = get_or_create_alert_manager()
    try:
        result = check_error_rate()

        # Alert manager handles storing metric and evaluating for alerts
        asyncio.create_task(alert_mgr.evaluate_and_alert(result))

        logger.info(f"{result.check_name}: {result.status} ({result.metadata.get('errors_per_minute', 0):.2f} errors/min)")

    except Exception as e:
        logger.error(f"Error rate check job failed: {e}")


def run_pattern_detection_job():
    """Detect error patterns from recent logs."""
    try:
        patterns = detect_error_patterns(hours=0.5)  # Last 30 minutes

        # Count new patterns (first seen in last 30 min)
        from datetime import timedelta
        cutoff_ms = int((datetime.utcnow() - timedelta(minutes=30)).timestamp() * 1000)
        new_patterns = [p for p in patterns if p['first_seen_ms'] > cutoff_ms]

        if new_patterns:
            logger.info(f"Pattern detection: found {len(new_patterns)} new patterns")
        else:
            logger.debug(f"Pattern detection: analyzed {len(patterns)} patterns, no new patterns")

    except Exception as e:
        logger.error(f"Pattern detection job failed: {e}")


def run_synthetic_beta_signup_job():
    """Run beta signup synthetic test (Playwright browser test)."""
    alert_mgr = get_or_create_alert_manager()
    try:
        logger.info("Starting synthetic beta signup test")
        result = check_beta_signup_synthetic()
        asyncio.create_task(alert_mgr.evaluate_and_alert(result))
        logger.info(f"{result.check_name}: {result.status} ({result.duration_ms:.0f}ms)")
    except Exception as e:
        logger.error(f"Synthetic beta signup test failed: {e}")


def run_synthetic_checkout_job():
    """Run checkout flow synthetic test (Playwright browser test)."""
    alert_mgr = get_or_create_alert_manager()
    try:
        logger.info("Starting synthetic checkout test")
        result = check_buy_now_synthetic()
        asyncio.create_task(alert_mgr.evaluate_and_alert(result))
        logger.info(f"{result.check_name}: {result.status} ({result.duration_ms:.0f}ms)")
    except Exception as e:
        logger.error(f"Synthetic checkout test failed: {e}")


def run_synthetic_create_first_job():
    """Run create-first route flow synthetic test (Playwright browser test)."""
    alert_mgr = get_or_create_alert_manager()
    try:
        logger.info("Starting synthetic create-first test")
        result = check_create_first_synthetic()
        asyncio.create_task(alert_mgr.evaluate_and_alert(result))
        logger.info(f"{result.check_name}: {result.status} ({result.duration_ms:.0f}ms)")
    except Exception as e:
        logger.error(f"Synthetic create-first test failed: {e}")


def run_synthetic_login_job():
    """Run login synthetic test (HTTP-based check)."""
    alert_mgr = get_or_create_alert_manager()
    try:
        logger.info("Starting synthetic login test")
        result = check_login_synthetic()
        asyncio.create_task(alert_mgr.evaluate_and_alert(result))
        logger.info(f"{result.check_name}: {result.status} ({result.duration_ms:.0f}ms)")
    except Exception as e:
        logger.error(f"Synthetic login test failed: {e}")


def run_synthetic_sms_webhook_job():
    """Run SMS webhook synthetic test (HTTP-based check)."""
    alert_mgr = get_or_create_alert_manager()
    try:
        logger.info("Starting synthetic SMS webhook test")
        result = check_sms_webhook_synthetic()
        asyncio.create_task(alert_mgr.evaluate_and_alert(result))
        logger.info(f"{result.check_name}: {result.status} ({result.duration_ms:.0f}ms)")
    except Exception as e:
        logger.error(f"Synthetic SMS webhook test failed: {e}")


def run_heartbeat_job():
    """Run self-monitoring heartbeat."""
    try:
        # Get alert channels for direct alerting (bypass dedup for meta-monitoring)
        alert_mgr = get_or_create_alert_manager()
        alert_channels = {
            'sms': alert_mgr.sms_channel if hasattr(alert_mgr, 'sms_channel') else None,
            'email': alert_mgr.email_channel if hasattr(alert_mgr, 'email_channel') else None,
        }

        send_heartbeat(settings, storage_module, _scheduler, alert_channels)
    except Exception as e:
        logger.error(f"Heartbeat job failed: {e}")


def run_daily_report_job():
    """Send daily health report."""
    try:
        send_daily_report(settings, storage_module)
    except Exception as e:
        logger.error(f"Daily report job failed: {e}")


def run_weekly_report_job():
    """Send weekly health report."""
    try:
        send_weekly_report(settings, storage_module)
    except Exception as e:
        logger.error(f"Weekly report job failed: {e}")


def run_monthly_report_job():
    """Send monthly health report."""
    try:
        send_monthly_report(settings, storage_module)
    except Exception as e:
        logger.error(f"Monthly report job failed: {e}")


def job_error_listener(event):
    """Log job errors."""
    logger.error(f"Job {event.job_id} failed: {event.exception}")


def create_scheduler() -> AsyncIOScheduler:
    """
    Create and configure APScheduler with monitoring jobs.

    Returns:
        Configured AsyncIOScheduler (not started)
    """
    global _scheduler

    scheduler = AsyncIOScheduler(
        timezone="UTC",
        job_defaults={
            "coalesce": True,
            "max_instances": 1,
            "misfire_grace_time": 300
        }
    )

    # Store global reference for self-monitoring
    _scheduler = scheduler

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

    # === Synthetic Monitoring Jobs ===

    # Playwright browser-based synthetic tests (only if npx is available)
    if PLAYWRIGHT_AVAILABLE:
        # Beta signup synthetic - every 5 minutes (CRITICAL)
        scheduler.add_job(
            run_synthetic_beta_signup_job,
            trigger=IntervalTrigger(minutes=intervals.get("beta_signup_flow", 5)),
            id="synthetic_beta_signup",
            name="Synthetic: Beta Signup"
        )

        # Checkout flow synthetic - every 15 minutes (CRITICAL)
        scheduler.add_job(
            run_synthetic_checkout_job,
            trigger=IntervalTrigger(minutes=intervals.get("checkout_flow", 15)),
            id="synthetic_checkout",
            name="Synthetic: Checkout"
        )

        # Create-first route flow synthetic - every 15 minutes (WARNING)
        scheduler.add_job(
            run_synthetic_create_first_job,
            trigger=IntervalTrigger(minutes=15),
            id="synthetic_create_first",
            name="Synthetic: Create First"
        )

        logger.info("Playwright browser synthetic tests enabled")
    else:
        logger.warning("npx not found - Playwright browser synthetic tests disabled")

    # HTTP-based synthetic tests (always enabled - no Playwright dependency)

    # Login synthetic - every 10 minutes (WARNING)
    scheduler.add_job(
        run_synthetic_login_job,
        trigger=IntervalTrigger(minutes=intervals.get("login_flow", 10)),
        id="synthetic_login",
        name="Synthetic: Login"
    )

    # SMS webhook synthetic - daily at 6 AM UTC (CRITICAL)
    # Run immediately on first startup, then daily
    scheduler.add_job(
        run_synthetic_sms_webhook_job,
        trigger=IntervalTrigger(days=1),
        id="synthetic_sms_webhook",
        name="Synthetic: SMS Webhook",
        next_run_time=datetime.now()  # Run immediately on first start
    )

    # === Self-Monitoring Jobs ===

    # Self-monitoring heartbeat - every 5 minutes
    scheduler.add_job(
        run_heartbeat_job,
        trigger=IntervalTrigger(minutes=5),
        id="self_heartbeat",
        name="Self-Monitoring Heartbeat"
    )

    # === Reporting Jobs ===

    # Daily report - every day at 8:00 AM UTC
    scheduler.add_job(
        run_daily_report_job,
        trigger=CronTrigger(hour=0, minute=0, timezone="UTC"),  # 8 AM Perth (AWST = UTC+8)
        id="daily_report",
        name="Daily Health Report"
    )

    # Weekly report - every Monday at 8:00 AM UTC
    scheduler.add_job(
        run_weekly_report_job,
        trigger=CronTrigger(day_of_week='mon', hour=0, minute=0, timezone="UTC"),  # 8 AM Perth Monday
        id="weekly_report",
        name="Weekly Health Report"
    )

    # Monthly report - first of month at 8:00 AM UTC
    scheduler.add_job(
        run_monthly_report_job,
        trigger=CronTrigger(day=1, hour=0, minute=0, timezone="UTC"),  # 8 AM Perth on 1st
        id="monthly_report",
        name="Monthly Health Report"
    )

    logger.info(f"Scheduler configured with {len(scheduler.get_jobs())} jobs")

    return scheduler
