"""
Twilio SMS webhook handlers.
Based on THUNDERBIRD_SPEC_v2.4 Section 12.4
"""

import logging
import asyncio
import html
from typing import Optional

from fastapi import APIRouter, Request, HTTPException, Header
from fastapi.responses import Response
from pydantic import BaseModel

from config.settings import settings
from app.services.sms import get_sms_service, PhoneUtils, SMSCostCalculator
from app.services.commands import CommandParser, CommandType, ResponseGenerator
from app.services.onboarding import onboarding_manager, OnboardingState
from app.services.routes import get_route

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhook", tags=["webhook"])


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


@router.post("/sms/inbound")
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
                asyncio.create_task(send_quick_start_guide(from_phone))

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

    return Response(
        content=twiml,
        media_type="application/xml"
    )


async def send_quick_start_guide(phone: str):
    """Send the quick start guide messages after onboarding completion."""
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
    from app.services.formatter import ForecastFormatter
    from app.services.bom import get_bom_service

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


async def notify_safecheck_contacts(user, camp, notification_type: str = "checkin"):
    """
    Notify SafeCheck contacts about user status.

    Args:
        user: User object
        camp: Camp object (current location)
        notification_type: "checkin" or "overdue"
    """
    from app.models.database import user_store
    from datetime import datetime
    from config.settings import TZ_HOBART

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


async def generate_cast_forecast(camp_code: str, hours: int = 12) -> str:
    """Generate CAST forecast for a specific camp/peak."""
    from app.services.routes import RouteLoader, get_route, get_other_peaks_in_cell
    from app.services.bom import get_bom_service
    from app.services.formatter import ForecastFormatter

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
    from app.services.bom import get_bom_service
    from app.services.formatter import ForecastFormatter

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
    from app.services.bom import get_bom_service
    from datetime import datetime
    from collections import defaultdict
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
    from app.services.bom import get_bom_service
    from datetime import datetime
    from collections import defaultdict
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
