"""
Thunderbird API Server
Based on THUNDERBIRD_SPEC_v2.4 Section 12.4
"""

import logging
import asyncio
import html
from datetime import datetime, date, timedelta
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from config.settings import settings, TZ_HOBART, TZ_UTC
from app.services.sms import get_sms_service, InputSanitizer, PhoneUtils
from app.services.bom import get_bom_service
from app.services.commands import CommandParser, CommandType, ResponseGenerator
from app.services.routes import RouteLoader, get_route
from app.services.onboarding import onboarding_manager, OnboardingState
from app.services.formatter import ForecastFormatter

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


async def notify_safecheck_contacts(user, camp, notification_type: str = "checkin"):
    """
    Notify SafeCheck contacts about user status.
    
    Args:
        user: User object
        camp: Camp object (current location)
        notification_type: "checkin" or "overdue"
    """
    from app.models.database import user_store
    
    contacts = user_store.get_safecheck_contacts(user.phone)
    if not contacts:
        return
    
    sms_service = get_sms_service()
    
    # Get route for context
    route = get_route(user.route_id)
    route_name = route.name if route else user.route_id
    
    # Get region context for the route (helps contacts understand location)
    region_map = {
        "western_arthurs_ak": "Western Arthurs, Tasmania",
        "western_arthurs_full": "Western Arthurs, Tasmania",
        "overland_track": "Overland Track, Tasmania",
    }
    region = region_map.get(user.route_id, "Tasmania")
    
    # Use trail name if set, otherwise masked phone
    hiker_id = user.trail_name if user.trail_name else PhoneUtils.mask(user.phone)
    
    # Build message based on type
    now = datetime.now(TZ_HOBART)
    time_str = now.strftime("%I:%M%p").lower()
    
    if notification_type == "checkin":
        # Get GPS coordinates for camp
        lat, lon = camp.lat, camp.lon
        maps_url = f"https://maps.google.com/?q={lat},{lon}"
        
        # Normal check-in notification
        message = (
            f"SafeCheck: All OK\n"
            f"From: {hiker_id}\n"
            f"Location: {camp.name} ({region})\n"
            f"Time: {time_str}\n"
            f"Map: {maps_url}"
        )
    elif notification_type == "overdue":
        # Overdue alert
        last_checkin = user.last_checkin_at
        if last_checkin:
            hours_ago = (now - last_checkin).total_seconds() / 3600
            last_str = last_checkin.strftime("%I:%M%p %a").lower()
        else:
            hours_ago = 0
            last_str = "unknown"
        
        # Get GPS coordinates for camp
        lat, lon = camp.lat, camp.lon
        maps_url = f"https://maps.google.com/?q={lat},{lon}"
        
        message = (
            f"SafeCheck ALERT\n"
            f"From: {hiker_id}\n"
            f"No check-in received.\n"
            f"Last known: {camp.name} ({region})\n"
            f"Last contact: {last_str}\n"
            f"GPS: {lat:.4f}, {lon:.4f}\n"
            f"Map: {maps_url}"
        )
    else:
        return
    
    # Send to all contacts
    for contact in contacts:
        try:
            await sms_service.send_message(contact.phone, message, command_type="SAFECHECK", message_type="safecheck_notify")
            logger.info(f"SafeCheck {notification_type} sent to {PhoneUtils.mask(contact.phone)}")
        except Exception as e:
            logger.error(f"SafeCheck notification failed to {PhoneUtils.mask(contact.phone)}: {e}")


async def check_overdue_users():
    """
    Check for users who haven't checked in and are overdue.
    Runs periodically (e.g., every hour) to detect overdue hikers.
    """
    logger.info("Checking for overdue users")
    
    from app.models.database import user_store
    
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


# Lifespan management
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle."""
    global scheduler
    
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


# Create app
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


# ============================================================================
# Health Check - Section 12.10.1
# ============================================================================

class HealthStatus(BaseModel):
    status: str
    timestamp: str
    services: dict
    version: str


@app.get("/health", response_model=HealthStatus)
async def health_check():
    """
    Health check endpoint.
    Returns service status for monitoring.
    """
    services = {
        "database": "ok",  # TODO: Check actual connection
        "redis": "ok",  # TODO: Check actual connection
        "bom_api": "ok",  # TODO: Check actual availability
        "twilio": "ok" if settings.TWILIO_ACCOUNT_SID else "not_configured"
    }
    
    # Overall status
    status = "ok" if all(v == "ok" for v in services.values()) else "degraded"
    
    return HealthStatus(
        status=status,
        timestamp=datetime.now(TZ_UTC).isoformat(),
        services=services,
        version=settings.APP_VERSION
    )


# ============================================================================
# Twilio Webhook - Section 12.4
# ============================================================================

class TwilioInboundSMS(BaseModel):
    """Model for Twilio inbound SMS webhook."""
    From: str
    To: str
    Body: str
    MessageSid: Optional[str] = None
    NumMedia: Optional[str] = "0"


def log_twiml_response(phone: str, response_text: str, command_type: str, message_type: str = "response"):
    """Log a TwiML response for analytics."""
    try:
        from app.models.database import user_store as db_store
        from app.services.sms import SMSCostCalculator
        segments = SMSCostCalculator.count_segments(response_text)
        cost_aud = segments * 0.055
        db_store.log_message(
            user_phone=phone,
            direction="outbound",
            message_type=message_type,
            command_type=command_type,
            content=response_text[:500],
            segments=segments,
            cost_aud=cost_aud,
            success=True
        )
    except Exception as e:
        logger.warning(f"Failed to log TwiML response: {e}")


@app.post("/webhook/sms/inbound")
async def handle_inbound_sms(
    request: Request,
    x_twilio_signature: Optional[str] = Header(None)
):
    """
    Handle incoming SMS from Twilio.
    Section 12.9.1 - Validates Twilio signature.
    """
    # Get form data
    form_data = await request.form()
    params = dict(form_data)
    
    # Validate Twilio signature in production
    if not settings.DEBUG and x_twilio_signature:
        sms_service = get_sms_service()
        url = str(request.url)
        if not sms_service.validate_webhook(url, params, x_twilio_signature):
            logger.warning("Invalid Twilio signature rejected")
            raise HTTPException(status_code=403, detail="Invalid signature")
    
    # Extract message details
    from_phone_raw = params.get("From", "")
    body = params.get("Body", "")
    message_sid = params.get("MessageSid", "")

    # Normalize phone number for consistent session lookup
    try:
        from_phone = PhoneUtils.normalize(from_phone_raw)
    except ValueError:
        from_phone = from_phone_raw.strip()  # Fallback to stripped version

    logger.info(f"SMS received from {PhoneUtils.mask(from_phone)}: {body[:50]}...")

    # Parse command for logging
    text_upper = body.strip().upper()
    cmd_word = text_upper.split()[0] if text_upper else "EMPTY"

    # Log inbound message
    from app.models.database import user_store as db_store
    db_store.log_message(
        user_phone=from_phone,
        direction="inbound",
        message_type="command",
        command_type=cmd_word,
        content=body[:500],
        segments=1,
        cost_aud=0,
        success=True
    )

    # Check if user is in onboarding flow FIRST
    session = onboarding_manager.get_session(from_phone)
    
    # CAST and other critical commands should ALWAYS work, even during onboarding
    # Check for these BEFORE checking onboarding state
    if text_upper.startswith("CAST ") or text_upper.startswith("SAFE ") or text_upper.startswith("SAFEDEL ") or text_upper in ["HELP", "KEY", "STATUS", "STOP", "SAFELIST"]:
        # Process as normal command, bypass onboarding
        parser = CommandParser()
        parsed = parser.parse(body)
        response_text = await process_command(from_phone, parsed)

        # Log outbound response
        log_twiml_response(from_phone, response_text, cmd_word, "response")

        twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>{html.escape(response_text)}</Message>
</Response>"""
        from fastapi.responses import Response
        return Response(content=twiml, media_type="application/xml")

    # Only handle onboarding if:
    # 1. User sends START/REGISTER, OR
    # 2. User has an active (non-complete) onboarding session
    is_start_command = text_upper in ["START", "REGISTER"]
    is_active_onboarding = session and session.state != OnboardingState.COMPLETE
    
    if is_start_command or is_active_onboarding:
        # Handle onboarding
        response_text, is_complete = onboarding_manager.process_input(from_phone, body)

        if response_text:
            # Log outbound response
            log_twiml_response(from_phone, response_text, "ONBOARDING", "onboarding")

            # Return immediate response
            twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>{html.escape(response_text)}</Message>
</Response>"""

            # If onboarding complete, send quick start guide asynchronously
            if is_complete:
                import asyncio
                asyncio.create_task(send_quick_start_guide(from_phone))

            from fastapi.responses import Response
            return Response(content=twiml, media_type="application/xml")
    
    # Not in onboarding - parse as normal command
    parser = CommandParser()
    parsed = parser.parse(body)

    # Generate response based on command
    response_text = await process_command(from_phone, parsed)

    # Log outbound response
    log_twiml_response(from_phone, response_text, cmd_word, "response")

    # Return TwiML response (XML-escape to handle & and < characters)
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>{html.escape(response_text)}</Message>
</Response>"""

    from fastapi.responses import Response
    return Response(
        content=twiml,
        media_type="application/xml"
    )


async def send_quick_start_guide(phone: str):
    """Send the quick start guide messages after onboarding completion."""
    import asyncio
    
    session = onboarding_manager.get_session(phone)
    if not session or session.state != OnboardingState.COMPLETE:
        return
    
    # Save user to database FIRST (before guide is sent)
    # This ensures SAFE command works immediately after "All set!"
    await complete_user_registration(session)
    
    # Get quick start guide messages
    messages = onboarding_manager.get_quick_start_guide(session)
    
    # Get SMS service
    sms_service = get_sms_service()
    
    # Send each message with delay (per spec: 2.5s inter-message delay)
    for i, message in enumerate(messages):
        try:
            await asyncio.sleep(2.5)  # Delay between messages
            await sms_service.send_message(phone, message, command_type="ONBOARDING", message_type="quick_start")
            logger.info(f"Sent quick start [{i+1}/{len(messages)}] to {PhoneUtils.mask(phone)}")
        except Exception as e:
            logger.error(f"Failed to send quick start message: {e}")
    
    # Clear the onboarding session
    onboarding_manager.clear_session(phone)


async def complete_user_registration(session):
    """Save the completed registration to database. v3.0: No start_date/end_date."""
    from app.models.database import user_store

    try:
        user_store.create_user(
            phone=session.phone,
            route_id=session.route_id,
            direction=session.direction or "standard",
            trail_name=session.trail_name
        )
        logger.info(f"User registered: {PhoneUtils.mask(session.phone)} ({session.trail_name}) on {session.route_name}")

        # Notify admin of new registration
        await notify_admin_new_registration(session.trail_name, session.route_name)
    except Exception as e:
        logger.error(f"Failed to save user registration: {e}")


async def notify_admin_new_registration(trail_name: str, route_name: str):
    """Send SMS to admin when a new user registers."""
    import os
    admin_phone = os.environ.get("ADMIN_PHONE", "+61410663673")

    try:
        sms_service = get_sms_service()
        await sms_service.send_message(
            to=admin_phone,
            body=f"{trail_name} just registered for Thunderbird on {route_name}",
            command_type="ADMIN",
            message_type="admin_notification"
        )
        logger.info(f"Admin notified of new registration: {trail_name}")
    except Exception as e:
        logger.error(f"Failed to notify admin of registration: {e}")


async def process_command(phone: str, parsed) -> str:
    """Process parsed command and return response text."""
    
    if parsed.command_type == CommandType.HELP:
        return ResponseGenerator.help_message()
    
    elif parsed.command_type == CommandType.KEY:
        return ResponseGenerator.key_message()
    
    elif parsed.command_type in (CommandType.CAST, CommandType.CAST12):
        # CAST and CAST12 are aliases - 12hr hourly forecast
        if not parsed.is_valid:
            return parsed.error_message or "CAST requires a location.\n\nExample: CAST12 LAKEO"

        camp_code = parsed.args.get("location_code") or parsed.args.get("camp_code", "")
        return await generate_cast_forecast(camp_code, hours=12)

    elif parsed.command_type == CommandType.CAST24:
        # 24hr hourly forecast
        if not parsed.is_valid:
            return parsed.error_message or "CAST24 requires a location.\n\nExample: CAST24 LAKEO"

        camp_code = parsed.args.get("location_code") or parsed.args.get("camp_code", "")
        return await generate_cast_forecast(camp_code, hours=24)

    elif parsed.command_type == CommandType.CAST7:
        # 7-day forecast - location, CAMPS, or PEAKS
        if not parsed.is_valid:
            return parsed.error_message or "CAST7 requires location.\n\nExample: CAST7 LAKEO, CAST7 CAMPS, or CAST7 PEAKS"

        if parsed.args.get("all_camps"):
            return await generate_cast7_all_camps(phone)
        elif parsed.args.get("all_peaks"):
            return await generate_cast7_all_peaks(phone)
        else:
            camp_code = parsed.args.get("location_code", "")
            return await generate_cast7_forecast(camp_code)

    elif parsed.command_type == CommandType.UNKNOWN:
        if not parsed.is_valid:
            return ResponseGenerator.unknown_command()
        return "Processing your input..."
    
    elif parsed.command_type == CommandType.CAMP_CODE:
        camp_code = parsed.args.get("camp_code", "").upper()
        
        # Get user from store
        from app.models.database import user_store
        user = user_store.get_user(phone)
        
        if not user:
            return "You're not registered. Send START to begin."
        
        # Validate camp code is on user's route
        route = get_route(user.route_id)
        if not route:
            return "Route configuration error. Please contact support."
        
        camp = route.get_camp(camp_code)
        if not camp:
            valid_camps = [c.code for c in route.camps]
            return ResponseGenerator.invalid_camp(camp_code, valid_camps)
        
        # Update position
        user_store.update_position(phone, camp_code)
        logger.info(f"Check-in: {PhoneUtils.mask(phone)} at {camp_code}")
        
        # Notify SafeCheck contacts
        await notify_safecheck_contacts(user, camp, "checkin")
        
        # Generate forecast for this location
        try:
            forecast_msg = await generate_cast_forecast(camp_code)
            return f"Checked in at {camp.name}\n\n{forecast_msg}"
        except Exception as e:
            logger.error(f"Forecast error on check-in: {e}")
            return f"Checked in at {camp.name}\n\nForecast unavailable - try CAST {camp_code} later."
    
    elif parsed.command_type == CommandType.SAFE:
        if not parsed.is_valid:
            return parsed.error_message
        
        from app.models.database import user_store
        user = user_store.get_user(phone)
        
        if not user:
            return "You're not registered. Send START to begin."
        
        contact_phone = parsed.args.get("contact_phone", "")
        contact_name = parsed.args.get("contact_name", "Contact")
        
        # Normalize phone number
        try:
            normalized_contact = PhoneUtils.normalize(contact_phone)
        except ValueError:
            return f"Invalid phone number: {contact_phone}\n\nUse format: +61400123456"
        
        # Add contact
        if user_store.add_safecheck_contact(phone, normalized_contact, contact_name):
            contacts = user_store.get_safecheck_contacts(phone)
            return f"SafeCheck contact added:\n{contact_name}: {PhoneUtils.mask(normalized_contact)}\n\nTotal contacts: {len(contacts)}/10\n\nThey'll be notified when you check in."
        else:
            return "Could not add contact. Maximum 10 contacts allowed."
    
    elif parsed.command_type == CommandType.SAFEDEL:
        if not parsed.is_valid:
            return parsed.error_message
        
        from app.models.database import user_store
        user = user_store.get_user(phone)
        
        if not user:
            return "You're not registered. Send START to begin."
        
        contact_phone = parsed.args.get("contact_phone", "")
        
        try:
            normalized_contact = PhoneUtils.normalize(contact_phone)
        except ValueError:
            return f"Invalid phone number: {contact_phone}"
        
        if user_store.remove_safecheck_contact(phone, normalized_contact):
            return f"SafeCheck contact removed: {PhoneUtils.mask(normalized_contact)}"
        else:
            return "Contact not found."
    
    elif parsed.command_type == CommandType.SAFELIST:
        from app.models.database import user_store
        user = user_store.get_user(phone)
        
        if not user:
            return "You're not registered. Send START to begin."
        
        contacts = user_store.get_safecheck_contacts(phone)
        
        if not contacts:
            return "No SafeCheck contacts.\n\nAdd one with:\nSAFE +61400123456 Kate"
        
        lines = ["SafeCheck contacts:"]
        for c in contacts:
            lines.append(f"- {c.name}: {PhoneUtils.mask(c.phone)}")
        lines.append(f"\nTotal: {len(contacts)}/10")
        return "\n".join(lines)
    
    elif parsed.command_type == CommandType.STOP:
        return ResponseGenerator.stop_confirmed()
    
    elif parsed.command_type == CommandType.START:
        # START is now handled by onboarding manager above
        # This is a fallback if somehow reached
        response, _ = onboarding_manager.process_input(phone, "START")
        return response or "Text START to begin registration."
    
    # Default response
    return "Command received. Processing..."


async def generate_cast_forecast(camp_code: str, hours: int = 12) -> str:
    """Generate CAST forecast for a specific camp/peak."""
    from app.services.routes import RouteLoader, get_route, get_other_peaks_in_cell

    # Find the waypoint across all routes
    waypoint = None
    route = None
    is_peak = False

    for route_id in RouteLoader.list_routes():
        try:
            r = get_route(route_id)
            if not r:
                continue

            # Check camps
            camp = r.get_camp(camp_code.upper())
            if camp:
                waypoint = camp
                route = r
                is_peak = False
                break

            # Check peaks
            peak = r.get_peak(camp_code.upper())
            if peak:
                waypoint = peak
                route = r
                is_peak = True
                break

        except Exception as e:
            logger.warning(f"Could not load route {route_id}: {e}")
            continue

    if not waypoint:
        return f"Unknown location: {camp_code}\n\nText ROUTE for valid codes."

    # Get forecast for this location
    lat = waypoint.lat
    lon = waypoint.lon
    elevation = waypoint.elevation
    name = waypoint.name

    try:
        bom_service = get_bom_service()
        forecast = await bom_service.get_hourly_forecast(lat, lon, hours=hours)

        # Format as CAST response using dedicated method
        formatter = ForecastFormatter()
        message = formatter.format_cast(
            forecast=forecast,
            waypoint_code=camp_code.upper(),
            waypoint_name=name,
            waypoint_elevation=elevation,
            hours=hours
        )

        # For peaks, add "Also covers:" if other peaks share the same BOM cell
        if is_peak and route:
            other_peaks = get_other_peaks_in_cell(route, camp_code)
            if other_peaks:
                other_names = ", ".join(p.name for p in other_peaks[:3])  # Limit to 3
                if len(other_peaks) > 3:
                    other_names += f" +{len(other_peaks) - 3} more"
                message += f"\n\nAlso covers: {other_names}"

        return message

    except Exception as e:
        logger.error(f"CAST forecast error for {camp_code}: {e}")
        return f"Unable to get forecast for {camp_code}. Please try again."


async def generate_cast7_forecast(location_code: str) -> str:
    """Generate 7-day forecast for a specific camp/peak."""
    from app.services.routes import RouteLoader, get_route

    # Find the waypoint
    waypoint = None
    for route_id in RouteLoader.list_routes():
        r = get_route(route_id)
        if not r:
            continue
        camp = r.get_camp(location_code.upper())
        if camp:
            waypoint = camp
            break
        peak = r.get_peak(location_code.upper())
        if peak:
            waypoint = peak
            break

    if not waypoint:
        return f"Unknown location: {location_code}\n\nText ROUTE for valid codes."

    try:
        bom_service = get_bom_service()
        forecast = await bom_service.get_daily_forecast(waypoint.lat, waypoint.lon, days=7)

        formatter = ForecastFormatter()
        return formatter.format_7day(
            forecast=forecast,
            waypoint_code=location_code.upper(),
            waypoint_name=waypoint.name,
            waypoint_elevation=waypoint.elevation
        )
    except Exception as e:
        logger.error(f"CAST7 forecast error for {location_code}: {e}")
        return f"Unable to get 7-day forecast for {location_code}. Please try again."


async def generate_cast7_all_camps(phone: str) -> str:
    """Generate 7-day grouped forecast for all camps on user's route."""
    from app.models.database import user_store
    from app.services.formatter import FormatCAST7Grouped
    from datetime import datetime, timedelta
    from config.settings import TZ_HOBART

    user = user_store.get_user(phone)
    if not user:
        return "You're not registered. Send START to begin."

    route = get_route(user.route_id)
    if not route:
        return "Route not found. Please contact support."

    try:
        bom_service = get_bom_service()

        # Build forecast data dict for all camps
        forecast_data = {}
        today = datetime.now(TZ_HOBART).date()

        for camp in route.camps:
            try:
                forecast = await bom_service.get_daily_forecast(camp.lat, camp.lon, days=7)

                # Convert forecast to dict format for grouping
                camp_days = []
                if hasattr(forecast, 'periods') and forecast.periods:
                    # Group hourly periods by day
                    from collections import defaultdict
                    daily = defaultdict(list)
                    for p in forecast.periods:
                        day_key = p.datetime.date()
                        daily[day_key].append(p)

                    for day_date in sorted(daily.keys())[:7]:
                        periods = daily[day_date]
                        if periods:
                            camp_days.append({
                                "day": day_date.strftime("%a"),
                                "temp": f"{int(min(p.temp_min for p in periods))}-{int(max(p.temp_max for p in periods))}",
                                "rain_chance": max(p.rain_chance for p in periods),
                                "rain_max": max(p.rain_max for p in periods),
                                "prec": f"R0-{int(max(p.rain_max for p in periods))}" if max(p.rain_max for p in periods) > 0 else "-",
                                "wind_avg": int(sum(p.wind_avg for p in periods) / len(periods)),
                                "wind_max": max(p.wind_max for p in periods),
                                "wind_dir": "W",
                                "cloud": int(sum(p.cloud_cover for p in periods) / len(periods)),
                                "cloud_base": int(sum(p.cloud_base for p in periods) / len(periods)) // 100,
                                "freezing_level": min(p.freezing_level for p in periods if p.freezing_level) // 100 if any(p.freezing_level for p in periods) else 18,
                            })

                if camp_days:
                    forecast_data[camp.code] = camp_days

            except Exception as e:
                logger.warning(f"Could not fetch forecast for {camp.code}: {e}")
                continue

        if not forecast_data:
            return "Unable to fetch forecasts. Please try again."

        # Use grouped formatter
        result = FormatCAST7Grouped.format(
            route_name=route.name,
            forecast_data=forecast_data,
            location_type="CAMPS",
            date=datetime.now(TZ_HOBART)
        )

        return result

    except Exception as e:
        logger.error(f"CAST7 CAMPS error: {e}")
        return "Unable to get forecasts. Please try again."


async def generate_cast7_all_peaks(phone: str) -> str:
    """Generate 7-day grouped forecast for all peaks on user's route."""
    from app.models.database import user_store
    from app.services.formatter import FormatCAST7Grouped
    from datetime import datetime
    from config.settings import TZ_HOBART

    user = user_store.get_user(phone)
    if not user:
        return "You're not registered. Send START to begin."

    route = get_route(user.route_id)
    if not route:
        return "Route not found. Please contact support."

    try:
        bom_service = get_bom_service()

        # Build forecast data dict for all peaks
        forecast_data = {}

        for peak in route.peaks:
            try:
                forecast = await bom_service.get_daily_forecast(peak.lat, peak.lon, days=7)

                # Convert forecast to dict format for grouping
                peak_days = []
                if hasattr(forecast, 'periods') and forecast.periods:
                    # Group hourly periods by day
                    from collections import defaultdict
                    daily = defaultdict(list)
                    for p in forecast.periods:
                        day_key = p.datetime.date()
                        daily[day_key].append(p)

                    for day_date in sorted(daily.keys())[:7]:
                        periods = daily[day_date]
                        if periods:
                            # Check for snow based on freezing level vs peak elevation
                            fl_min = min(p.freezing_level for p in periods if p.freezing_level) if any(p.freezing_level for p in periods) else 2000
                            rain_max = max(p.rain_max for p in periods)
                            snow_max = max(getattr(p, 'snow_max', 0) for p in periods)

                            # Determine precip type
                            if snow_max > 0:
                                prec = f"S0-{int(snow_max)}"
                            elif rain_max > 0:
                                prec = f"R0-{int(rain_max)}"
                            else:
                                prec = "-"

                            peak_days.append({
                                "day": day_date.strftime("%a"),
                                "temp": f"{int(min(p.temp_min for p in periods))}-{int(max(p.temp_max for p in periods))}",
                                "rain_chance": max(p.rain_chance for p in periods),
                                "rain_max": rain_max,
                                "prec": prec,
                                "wind_avg": int(sum(p.wind_avg for p in periods) / len(periods)),
                                "wind_max": max(p.wind_max for p in periods),
                                "wind_dir": "W",
                                "cloud": int(sum(p.cloud_cover for p in periods) / len(periods)),
                                "cloud_base": int(sum(p.cloud_base for p in periods) / len(periods)) // 100,
                                "freezing_level": fl_min // 100,
                            })

                if peak_days:
                    forecast_data[peak.code] = peak_days

            except Exception as e:
                logger.warning(f"Could not fetch forecast for {peak.code}: {e}")
                continue

        if not forecast_data:
            return "Unable to fetch forecasts. Please try again."

        # Use grouped formatter
        result = FormatCAST7Grouped.format(
            route_name=route.name,
            forecast_data=forecast_data,
            location_type="PEAKS",
            date=datetime.now(TZ_HOBART)
        )

        return result

    except Exception as e:
        logger.error(f"CAST7 PEAKS error: {e}")
        return "Unable to get forecasts. Please try again."


# ============================================================================
# API Endpoints - Section 12.4
# ============================================================================

class ForecastPushRequest(BaseModel):
    """Request to trigger forecast push."""
    forecast_type: str = "morning"  # "morning" or "evening"
    phone: Optional[str] = None  # If provided, push to single user


@app.post("/api/forecast/push")
async def trigger_forecast_push(request: ForecastPushRequest):
    """
    Trigger manual forecast push.
    
    - If phone provided: Push to that user only
    - If no phone: Push to all active users
    """
    from app.models.database import user_store
    
    if request.phone:
        # Push to single user
        try:
            normalized = PhoneUtils.normalize(request.phone)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid phone number")
        
        user = user_store.get_user(normalized)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        try:
            await push_forecast_to_user(user, forecast_type=request.forecast_type)
            return {"status": "sent", "phone": PhoneUtils.mask(normalized), "type": request.forecast_type}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    else:
        # Push to all users
        if request.forecast_type == "morning":
            await push_morning_forecasts()
        else:
            await push_evening_forecasts()
        
        return {"status": "complete", "type": request.forecast_type}


@app.post("/api/forecast/test-push/{phone}")
async def test_push_to_user(phone: str, forecast_type: str = "morning"):
    """
    Quick test endpoint to push forecast to a specific phone.
    Use: POST /api/forecast/test-push/+61400123456?forecast_type=morning
    """
    from app.models.database import user_store
    
    try:
        normalized = PhoneUtils.normalize(phone)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid phone number")
    
    user = user_store.get_user(normalized)
    if not user:
        raise HTTPException(status_code=404, detail=f"User not found. Registered users: {len(user_store.list_users())}")
    
    try:
        await push_forecast_to_user(user, forecast_type=forecast_type)
        return {
            "status": "sent",
            "phone": PhoneUtils.mask(normalized),
            "position": user.current_position,
            "type": forecast_type
        }
    except Exception as e:
        logger.error(f"Test push failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class UserStatus(BaseModel):
    """User subscription status response."""
    phone: str
    route_id: str
    route_name: str
    current_position: Optional[str]
    current_day: int
    total_days: int
    status: str
    expires_at: str


@app.get("/api/user/{phone}/status", response_model=UserStatus)
async def get_user_status(phone: str):
    """Get user subscription status."""
    try:
        normalized = PhoneUtils.normalize(phone)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid phone number")
    
    # TODO: Fetch from database
    raise HTTPException(status_code=404, detail="User not found")


class PositionUpdate(BaseModel):
    """Position update request."""
    camp_code: str


@app.post("/api/user/{phone}/position")
async def update_user_position(phone: str, update: PositionUpdate):
    """Update user position manually."""
    try:
        normalized = PhoneUtils.normalize(phone)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid phone number")
    
    # TODO: Validate and update position
    return {"status": "updated", "position": update.camp_code}


class RouteCells(BaseModel):
    """Route BOM cells response."""
    route_id: str
    cells: list


@app.get("/api/route/{route_id}/cells", response_model=RouteCells)
async def get_route_cells(route_id: str):
    """Get all BOM cells for a route."""
    route = get_route(route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    return RouteCells(
        route_id=route_id,
        cells=route.bom_cells
    )


class CellForecastResponse(BaseModel):
    """Cell forecast response."""
    route_id: str
    cell_id: str
    forecast_date: str
    data: dict
    cached: bool
    cache_age_hours: float


@app.get("/api/forecast/{route_id}/{cell_id}")
async def get_cell_forecast(route_id: str, cell_id: str):
    """Get cached forecast for a cell."""
    route = get_route(route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    if cell_id not in route.bom_cells:
        raise HTTPException(status_code=400, detail="Cell not on route")
    
    # TODO: Fetch from cache or BOM API
    bom = get_bom_service()
    
    # For now, return mock data
    return {
        "route_id": route_id,
        "cell_id": cell_id,
        "forecast_date": date.today().isoformat(),
        "data": {},
        "cached": False,
        "cache_age_hours": 0
    }


# ============================================================================
# Route Information
# ============================================================================

@app.get("/api/routes")
async def list_routes():
    """List available routes."""
    route_ids = RouteLoader.list_routes()
    routes = []
    
    for route_id in route_ids:
        route = get_route(route_id)
        if route:
            routes.append({
                "route_id": route.route_id,
                "name": route.name,
                "short_name": route.short_name,
                "region": route.region,
                "distance_km": route.distance_km,
                "typical_days": route.typical_days,
                "grade": route.grade,
                "is_loop": route.is_loop
            })
    
    return {"routes": routes}


@app.get("/api/routes/{route_id}")
async def get_route_info(route_id: str):
    """Get detailed route information."""
    route = get_route(route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    return {
        "route_id": route.route_id,
        "name": route.name,
        "short_name": route.short_name,
        "region": route.region,
        "distance_km": route.distance_km,
        "typical_days": route.typical_days,
        "grade": route.grade,
        "grade_description": route.grade_description,
        "is_loop": route.is_loop,
        "camps": [
            {
                "code": c.code,
                "name": c.name,
                "elevation": c.elevation,
                "bom_cell": c.bom_cell
            }
            for c in route.camps
        ],
        "peaks": [
            {
                "code": p.code,
                "name": p.name,
                "elevation": p.elevation,
                "type": p.type
            }
            for p in route.peaks
        ],
        "bom_cells": route.bom_cells
    }


# ============================================================================
# Error Handlers
# ============================================================================

# ============================================================================
# Admin Interface - Password Protected
# ============================================================================

from fastapi.responses import HTMLResponse, RedirectResponse
from app.services.admin import (
    user_store, User, UserStatus,
    create_session, validate_session, clear_session, check_password,
    render_login, render_admin
)


def get_session_token(request: Request) -> Optional[str]:
    """Extract session token from cookie."""
    return request.cookies.get("thunderbird_session")


def require_admin(request: Request) -> bool:
    """Check if request has valid admin session."""
    token = get_session_token(request)
    return token and validate_session(token)


@app.get("/admin", response_class=HTMLResponse)
@app.get("/admin/", response_class=HTMLResponse)
async def admin_page(request: Request):
    """Admin dashboard - requires login."""
    if not require_admin(request):
        return RedirectResponse("/admin/login", status_code=302)

    # Use SQLite database instead of in-memory store
    from app.models.database import user_store as db_user_store
    users = db_user_store.list_users()
    message = request.query_params.get("msg", "")
    return render_admin(users, message)


@app.get("/admin/login", response_class=HTMLResponse)
async def admin_login_page():
    """Admin login page."""
    return render_login()


@app.post("/admin/login", response_class=HTMLResponse)
async def admin_login_submit(request: Request):
    """Handle login form submission."""
    form = await request.form()
    password = form.get("password", "")
    
    if check_password(password):
        token = create_session()
        response = RedirectResponse("/admin", status_code=302)
        response.set_cookie(
            "thunderbird_session", 
            token, 
            httponly=True,
            max_age=86400,  # 24 hours
            samesite="strict"
        )
        return response
    
    return render_login("Invalid password")


@app.get("/admin/logout")
async def admin_logout(request: Request):
    """Logout and clear session."""
    token = get_session_token(request)
    if token:
        clear_session(token)
    response = RedirectResponse("/admin/login", status_code=302)
    response.delete_cookie("thunderbird_session")
    return response


@app.post("/admin/register")
async def admin_register_user(request: Request):
    """Register a new beta user. v3.0: No start_date required."""
    if not require_admin(request):
        return RedirectResponse("/admin/login", status_code=302)

    form = await request.form()

    try:
        # Parse form data
        phone = form.get("phone", "").strip()
        if not phone.startswith("+"):
            phone = "+61" + phone.lstrip("0")

        route_id = form.get("route_id", "western_arthurs_ak")
        trail_name = form.get("trail_name", "").strip() or None

        # Create user in SQLite database
        from app.models.database import user_store as db_user_store
        db_user_store.create_user(
            phone=phone,
            route_id=route_id,
            trail_name=trail_name
        )

        return RedirectResponse(
            f"/admin?msg=Registered {phone} for {route_id}",
            status_code=302
        )

    except Exception as e:
        return RedirectResponse(
            f"/admin?msg=Error: {str(e)}",
            status_code=302
        )


@app.post("/admin/delete/{phone:path}")
async def admin_delete_user(phone: str, request: Request):
    """Delete a user."""
    if not require_admin(request):
        return RedirectResponse("/admin/login", status_code=302)

    # URL decode phone number
    phone = phone.replace("%2B", "+")

    from app.models.database import user_store as db_user_store
    if db_user_store.delete_user(phone):
        return RedirectResponse(f"/admin?msg=Deleted {phone}", status_code=302)
    return RedirectResponse(f"/admin?msg=Error: User not found", status_code=302)


@app.post("/admin/push/{phone:path}")
async def admin_push_forecast(phone: str, request: Request):
    """Push forecast to specific user."""
    if not require_admin(request):
        return RedirectResponse("/admin/login", status_code=302)

    phone = phone.replace("%2B", "+")
    from app.models.database import user_store as db_user_store
    user = db_user_store.get_user(phone)
    
    if not user:
        return RedirectResponse(f"/admin?msg=Error: User not found", status_code=302)
    
    try:
        from app.services.forecast import get_forecast_generator

        # Determine forecast type based on time of day
        now = datetime.now(TZ_HOBART)
        is_morning = now.hour < 12

        # Calculate fields from database User
        duration_days = (user.end_date - user.start_date).days + 1
        current_day = max(0, (date.today() - user.start_date).days)
        wind_threshold = "moderate"  # Default

        generator = get_forecast_generator()

        if is_morning:
            # Morning: hourly forecast
            messages = await generator.generate_morning_forecast(
                route_id=user.route_id,
                current_position=user.current_position,
                current_day=current_day,
                duration_days=duration_days,
                wind_threshold=wind_threshold
            )
        else:
            # Evening: 7-day summary
            messages = await generator.generate_evening_forecast(
                route_id=user.route_id,
                current_position=user.current_position,
                current_day=current_day,
                duration_days=duration_days,
                wind_threshold=wind_threshold
            )
        
        # Send all messages
        sms_service = get_sms_service()
        sent_count = 0
        errors = []
        
        cmd_type = "ADMIN_PUSH_AM" if is_morning else "ADMIN_PUSH_PM"
        for msg in messages:
            result = await sms_service.send_message(to=phone, body=msg.content, command_type=cmd_type, message_type="admin_push")
            if result.error:
                errors.append(result.error)
            else:
                sent_count += 1

        if errors:
            return RedirectResponse(
                f"/admin?msg=Sent {sent_count}/{len(messages)} messages. Errors: {'; '.join(errors[:2])}",
                status_code=302
            )

        forecast_type = "morning (hourly)" if is_morning else "evening (7-day)"
        return RedirectResponse(
            f"/admin?msg=✓ {forecast_type} forecast sent to {phone} ({sent_count} messages)",
            status_code=302
        )
        
    except Exception as e:
        logger.error(f"Error pushing forecast: {e}")
        return RedirectResponse(f"/admin?msg=Error: {str(e)}", status_code=302)


@app.post("/admin/push-all")
async def admin_push_all(request: Request):
    """Push forecasts to all active users."""
    if not require_admin(request):
        return RedirectResponse("/admin/login", status_code=302)

    from app.models.database import user_store as db_user_store
    active = db_user_store.get_active_users()
    
    if not active:
        return RedirectResponse("/admin?msg=No active users to push to", status_code=302)
    
    # Send to all active users
    sms_service = get_sms_service()
    sent = 0
    errors = 0
    
    for user in active:
        try:
            result = await sms_service.send_message(
                to=user.phone,
                body=f"THUNDERBIRD: Batch forecast test for {user.route_id}",
                command_type="ADMIN_BATCH",
                message_type="admin_push"
            )
            if result.error:
                errors += 1
            else:
                sent += 1
        except Exception:
            errors += 1
    
    return RedirectResponse(
        f"/admin?msg=✓ Sent to {sent} users ({errors} errors)",
        status_code=302
    )


@app.post("/admin/test-sms")
async def admin_test_sms(request: Request):
    """Send test SMS to a phone number."""
    if not require_admin(request):
        return RedirectResponse("/admin/login", status_code=302)
    
    form = await request.form()
    phone = form.get("phone", "").strip()
    
    if not phone:
        return RedirectResponse("/admin?msg=Error: No phone number provided", status_code=302)
    
    if not phone.startswith("+"):
        phone = "+61" + phone.lstrip("0")
    
    try:
        sms_service = get_sms_service()
        result = await sms_service.send_message(
            to=phone,
            body="THUNDERBIRD test message. If you received this, SMS delivery is working!",
            command_type="ADMIN_TEST",
            message_type="admin_test"
        )

        if result.error:
            return RedirectResponse(f"/admin?msg=Error: {result.error}", status_code=302)

        return RedirectResponse(f"/admin?msg=Test SMS sent to {phone}", status_code=302)
    except Exception as e:
        return RedirectResponse(f"/admin?msg=Error: {str(e)}", status_code=302)


@app.get("/admin/api/grouping-stats")
async def admin_grouping_stats_api(request: Request):
    """Get dynamic grouping statistics as JSON."""
    if not require_admin(request):
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})

    from app.services.pricing import (
        ROUTE_GROUPING_STATS,
        get_trip_savings_summary,
        COMMAND_SEGMENTS,
        COMMAND_SEGMENTS_UNGROUPED
    )

    routes = []
    for route_id, stats in ROUTE_GROUPING_STATS.items():
        summary = get_trip_savings_summary(route_id)
        routes.append({
            "route_id": route_id,
            "route_name": route_id.replace("_", " ").title(),
            "camps": stats.get("camps", 0),
            "camp_zones": stats.get("camp_zones", 0),
            "camp_reduction_pct": int(stats.get("camp_reduction", 0) * 100),
            "peaks": stats.get("peaks", 0),
            "peak_zones": stats.get("peak_zones", 0),
            "peak_reduction_pct": int(stats.get("peak_reduction", 0) * 100),
            "segments_saved_per_trip": summary.get("segments_saved_per_trip", 0),
            "cost_saved_per_trip": float(summary.get("cost_saved_per_trip", 0)),
        })

    return JSONResponse(content={
        "grouping_thresholds": {
            "temperature_c": 2,
            "rain_mm": 2,
            "wind_kmh": 5,
        },
        "segment_estimates": {
            "grouped": {
                "CAST7_CAMPS": COMMAND_SEGMENTS["CAST7_CAMPS"],
                "CAST7_PEAKS": COMMAND_SEGMENTS["CAST7_PEAKS"],
            },
            "ungrouped": {
                "CAST7_CAMPS": COMMAND_SEGMENTS_UNGROUPED["CAST7_CAMPS"],
                "CAST7_PEAKS": COMMAND_SEGMENTS_UNGROUPED["CAST7_PEAKS"],
            },
        },
        "routes": routes,
    })


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
