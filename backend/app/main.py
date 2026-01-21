"""
Thunderbird API Server
Based on THUNDERBIRD_SPEC_v2.4 Section 12.4

Modular FastAPI application with routers for webhook, admin, and API endpoints.
"""

import logging
from datetime import datetime, date
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config.settings import settings, TZ_HOBART, TZ_UTC
from app.services.sms import get_sms_service, PhoneUtils
from app.services.bom import get_bom_service
from app.services.routes import get_route
from app.services.formatter import ForecastFormatter

# Import routers
from app.routers import webhook, admin, api, auth, payments, routes, library, analytics, affiliates, affiliate_landing

# Try to import APScheduler (optional dependency)
try:
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.triggers.cron import CronTrigger
    SCHEDULER_AVAILABLE = True
except ImportError:
    SCHEDULER_AVAILABLE = False

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='{"timestamp": "%(asctime)s", "level": "%(levelname)s", "message": "%(message)s"}'
)
logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler = None


# ============================================================================
# Scheduled Jobs
# ============================================================================

async def push_morning_forecasts():
    """Push 6AM morning forecasts to all active users."""
    logger.info("Starting 6AM morning forecast push")

    from app.models.database import user_store

    users = user_store.list_users()
    today = datetime.now(TZ_HOBART).date()

    for user in users:
        # Check if user's trip is active
        if user.start_date <= today <= user.end_date:
            try:
                await push_forecast_to_user(user, forecast_type="morning")
            except Exception as e:
                logger.error(f"Morning push failed for {PhoneUtils.mask(user.phone)}: {e}")

    logger.info(f"Morning forecast push complete: {len(users)} users checked")


async def push_evening_forecasts():
    """Push 6PM evening forecasts to all active users."""
    logger.info("Starting 6PM evening forecast push")

    from app.models.database import user_store

    users = user_store.list_users()
    today = datetime.now(TZ_HOBART).date()

    for user in users:
        # Check if user's trip is active
        if user.start_date <= today <= user.end_date:
            try:
                await push_forecast_to_user(user, forecast_type="evening")
            except Exception as e:
                logger.error(f"Evening push failed for {PhoneUtils.mask(user.phone)}: {e}")

    logger.info(f"Evening forecast push complete: {len(users)} users checked")


async def push_forecast_to_user(user, forecast_type: str = "morning"):
    """
    Push forecast to a single user based on their current position.

    Args:
        user: User object from user_store
        forecast_type: "morning" (6AM hourly) or "evening" (6PM 7-day)
    """
    from app.services.forecast import ForecastGenerator

    # Get user's route
    route = get_route(user.route_id)
    if not route:
        logger.warning(f"Route {user.route_id} not found for user {PhoneUtils.mask(user.phone)}")
        return

    # Get current position (default to first camp if none)
    current_pos = user.current_position
    if not current_pos:
        camps = route.camps if user.direction == "standard" else list(reversed(route.camps))
        current_pos = camps[0].code if camps else None

    if not current_pos:
        logger.warning(f"No position for user {PhoneUtils.mask(user.phone)}")
        return

    # Get camp info
    camp = route.get_camp(current_pos)
    if not camp:
        logger.warning(f"Camp {current_pos} not found on route {user.route_id}")
        return

    # Get camps/peaks ahead of current position
    camps_ahead, peaks_ahead = get_waypoints_ahead(route, current_pos, user.direction)

    # Generate forecast
    try:
        generator = ForecastGenerator()
        bom_service = get_bom_service()
        formatter = ForecastFormatter()

        # Get forecast data
        forecast = await bom_service.get_hourly_forecast(camp.lat, camp.lon, hours=24)

        if forecast_type == "morning":
            # Morning: hourly for today
            message = formatter.format_hourly_today(
                forecast=forecast,
                cell_name=current_pos,
                cell_status="active",
                camp_elevation=camp.elevation,
                peak_elevation=peaks_ahead[0].elevation if peaks_ahead else camp.elevation,
                camp_names=[c.code for c in camps_ahead[:4]],
                peak_names=[p.code for p in peaks_ahead[:4]],
                message_num=1,
                total_messages=1,
                start_hour=6,
                end_hour=18
            )
        else:
            # Evening: 3-hourly for tomorrow
            message = formatter.format_3hourly_tomorrow(
                forecast=forecast,
                cell_name=current_pos,
                cell_status="active",
                camp_elevation=camp.elevation,
                peak_elevation=peaks_ahead[0].elevation if peaks_ahead else camp.elevation,
                camp_names=[c.code for c in camps_ahead[:4]],
                peak_names=[p.code for p in peaks_ahead[:4]],
                message_num=1,
                total_messages=1
            )

        # Send SMS
        sms_service = get_sms_service()
        cmd = "PUSH_AM" if forecast_type == "morning" else "PUSH_PM"
        await sms_service.send_message(user.phone, message, command_type=cmd, message_type="scheduled_push")
        logger.info(f"Pushed {forecast_type} forecast to {PhoneUtils.mask(user.phone)}")

    except Exception as e:
        logger.error(f"Forecast generation failed: {e}")
        raise


def get_waypoints_ahead(route, current_position: str, direction: str):
    """
    Get camps and peaks ahead of current position.

    Returns:
        (camps_ahead, peaks_ahead) - Lists of waypoints ahead
    """
    camps = list(route.camps)
    peaks = list(route.peaks)

    # Reverse if going reverse direction
    if direction == "reverse":
        camps = list(reversed(camps))
        # Peaks don't reverse - they're always relative to camps

    # Find current position index
    current_idx = None
    for i, camp in enumerate(camps):
        if camp.code == current_position:
            current_idx = i
            break

    if current_idx is None:
        # Current position not found, return all
        return camps, peaks

    # Get camps ahead (including current)
    camps_ahead = camps[current_idx:]

    # Get peaks that are between current and end
    # (simplified: just return all peaks for now, could be refined)
    peaks_ahead = peaks

    return camps_ahead, peaks_ahead


async def check_overdue_users():
    """
    Check for users who haven't checked in and are overdue.
    Runs periodically (e.g., every hour) to detect overdue hikers.
    """
    logger.info("Checking for overdue users")

    from app.models.database import user_store
    from app.routers.webhook import notify_safecheck_contacts

    users = user_store.list_users()
    now = datetime.now(TZ_HOBART)
    today = now.date()

    for user in users:
        # Skip if trip not active
        if not (user.start_date <= today <= user.end_date):
            continue

        # Skip if no SafeCheck contacts
        contacts = user_store.get_safecheck_contacts(user.phone)
        if not contacts:
            continue

        # Check if overdue (no check-in for 24+ hours during active trip)
        if user.last_checkin_at:
            hours_since = (now - user.last_checkin_at).total_seconds() / 3600

            # Overdue if > 24 hours since last check-in
            if hours_since > 24:
                logger.warning(f"User {PhoneUtils.mask(user.phone)} overdue: {hours_since:.1f} hours")

                # Get last known camp
                route = get_route(user.route_id)
                if route and user.current_position:
                    camp = route.get_camp(user.current_position)
                    if camp:
                        await notify_safecheck_contacts(user, camp, "overdue")
        else:
            # Never checked in - if trip started > 24 hours ago, flag as overdue
            trip_start = datetime.combine(user.start_date, datetime.min.time())
            trip_start = TZ_HOBART.localize(trip_start)
            hours_since_start = (now - trip_start).total_seconds() / 3600

            if hours_since_start > 24:
                logger.warning(f"User {PhoneUtils.mask(user.phone)} never checked in, trip started {hours_since_start:.1f} hours ago")
                # Can't notify without a position - skip for now

    logger.info("Overdue check complete")


# ============================================================================
# Lifespan Management
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle."""
    global scheduler

    # Validate JWT_SECRET in production
    if not settings.DEBUG and not settings.JWT_SECRET:
        raise RuntimeError("JWT_SECRET must be set in production")

    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")

    # Initialize scheduler
    if SCHEDULER_AVAILABLE:
        scheduler = AsyncIOScheduler(timezone=TZ_HOBART)

        # 6AM morning forecast push
        scheduler.add_job(
            push_morning_forecasts,
            CronTrigger(hour=6, minute=0, timezone=TZ_HOBART),
            id="morning_push",
            name="6AM Morning Forecast Push"
        )

        # 6PM evening forecast push
        scheduler.add_job(
            push_evening_forecasts,
            CronTrigger(hour=18, minute=0, timezone=TZ_HOBART),
            id="evening_push",
            name="6PM Evening Forecast Push"
        )

        # Hourly overdue check (at :30 past each hour)
        scheduler.add_job(
            check_overdue_users,
            CronTrigger(minute=30, timezone=TZ_HOBART),
            id="overdue_check",
            name="Hourly Overdue Check"
        )

        scheduler.start()
        logger.info("Scheduler started: 6AM/6PM forecasts + hourly overdue check")
    else:
        logger.warning("APScheduler not installed - scheduled pushes disabled")

    yield

    # Cleanup
    if scheduler:
        scheduler.shutdown()
    bom_service = get_bom_service()
    await bom_service.close()
    logger.info("Shutdown complete")


# ============================================================================
# Create FastAPI Application
# ============================================================================

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(webhook.router)
app.include_router(admin.router)
app.include_router(api.router)
app.include_router(auth.router)
app.include_router(payments.router)
app.include_router(routes.router)
app.include_router(library.router)
app.include_router(analytics.router)
app.include_router(affiliates.router)
app.include_router(affiliate_landing.router)

# Root health check (kept at root for compatibility)
@app.get("/health")
async def root_health():
    """Root health check endpoint (redirects to /api/health)."""
    return await api.health_check()


# ============================================================================
# Exception Handler
# ============================================================================

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions."""
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )


# Run with: uvicorn app.main:app --reload
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
