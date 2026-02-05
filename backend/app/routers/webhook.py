"""
Webhook handlers for Twilio SMS and Stripe payments.
Based on THUNDERBIRD_SPEC_v2.4 Section 12.4
"""

import logging
import asyncio
import html
import json
from typing import Optional

from fastapi import APIRouter, Request, HTTPException, Header
from fastapi.responses import Response
from pydantic import BaseModel

from config.settings import settings

# Stripe import - only initialize if configured
stripe = None
try:
    import stripe as stripe_module
    stripe = stripe_module
except ImportError:
    pass  # Will log warning when used
from app.services.sms import get_sms_service, PhoneUtils, SMSCostCalculator
from app.services.commands import CommandParser, CommandType, ResponseGenerator
from app.services.onboarding import onboarding_manager, OnboardingState
from app.services.routes import get_route
from app.services.affiliates import get_affiliate_service
from app.services.trail_selection import get_trail_selection_service

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

    # Validate Twilio signature (mandatory — only skipped in test suite)
    import os
    if os.environ.get("TESTING") != "true":
        if not x_twilio_signature:
            logger.warning("Missing Twilio signature - rejecting request")
            raise HTTPException(status_code=403, detail="Missing signature")
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

    # Log command keyword only, not full SMS body (may contain sensitive data)
    command_word = body.strip().split()[0].upper() if body.strip() else "EMPTY"
    logger.info(f"SMS received from {PhoneUtils.mask(from_phone)}: {command_word}")

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

    # Beta gate: ALL commands require phone linked to an approved account
    from app.models.account import account_store
    account = account_store.get_by_phone(from_phone)
    if not account:
        # Exceptions: allow STOP (compliance), HELP, and KEY (informational commands)
        if text_upper in ["STOP", "HELP", "KEY"]:
            pass  # Fall through to normal command processing below
        else:
            reject_msg = "This phone number is not linked to a Thunderbird account. Apply at thunderbird.bot"
            log_twiml_response(from_phone, reject_msg, "BETA_GATE", "gate_reject")
            twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>{html.escape(reject_msg)}</Message>
</Response>"""
            return Response(content=twiml, media_type="application/xml")

    # Handle FIELDTEST command (automated field testing)
    if text_upper.startswith("FIELDTEST"):
        from app.routers.field_test import handle_fieldtest_sms
        response_text = handle_fieldtest_sms(from_phone, body)
        if response_text:
            log_twiml_response(from_phone, response_text, "FIELDTEST", "field_test")
            twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>{html.escape(response_text)}</Message>
</Response>"""
            return Response(content=twiml, media_type="application/xml")

    # Check if user is in trail selection flow FIRST
    trail_selection_service = get_trail_selection_service()
    if trail_selection_service.has_active_session(from_phone):
        # Process input through trail selection
        response_text, is_complete = trail_selection_service.process_input(
            from_phone, body, account
        )
        log_twiml_response(from_phone, response_text, "TRAIL_SELECTION", "trail_selection")
        twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>{html.escape(response_text)}</Message>
</Response>"""
        return Response(content=twiml, media_type="application/xml")

    # Check if user is in onboarding flow NEXT
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

    # START command routing - distinguish registered vs unregistered
    is_start_command = text_upper in ["START", "REGISTER"]

    if is_start_command:
        # Registered user -> trail selection
        if account:
            response_text = trail_selection_service.start_selection(from_phone, account)
            log_twiml_response(from_phone, response_text, "START", "trail_selection")
            twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>{html.escape(response_text)}</Message>
</Response>"""
            return Response(content=twiml, media_type="application/xml")
        # else: fall through to onboarding for unregistered users

    # Only handle onboarding if:
    # 1. User sends START/REGISTER AND is NOT registered, OR
    # 2. User has an active (non-complete) onboarding session
    is_active_onboarding = session and session.state != OnboardingState.COMPLETE

    if (is_start_command and not account) or is_active_onboarding:
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
    """Save the completed registration to database. v3.5: Includes unit_system preference."""
    from app.models.database import user_store

    try:
        user_store.create_user(
            phone=session.phone,
            route_id=session.route_id,
            direction=session.direction or "standard",
            trail_name=session.trail_name,
            unit_system=session.unit_system or "metric"
        )
        logger.info(f"User registered: {PhoneUtils.mask(session.phone)} ({session.trail_name}) on {session.route_name} [{session.unit_system or 'metric'}]")

        # Notify admin of new registration
        await notify_admin_new_registration(session.trail_name, session.route_name)
    except Exception as e:
        logger.error(f"Failed to save user registration: {e}")


async def notify_admin_new_registration(trail_name: str, route_name: str):
    """Send SMS to admin when a new user registers."""
    import os
    admin_phone = os.environ.get("ADMIN_PHONE", "")
    if not admin_phone:
        logger.warning("ADMIN_PHONE not configured - skipping admin notification")
        return

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

        # Check for GPS coordinates
        if parsed.args.get("is_gps"):
            lat = parsed.args.get("gps_lat")
            lon = parsed.args.get("gps_lon")
            return await generate_cast_forecast_gps(lat, lon, hours=12, phone=phone)

        camp_code = parsed.args.get("location_code") or parsed.args.get("camp_code", "")
        return await generate_cast_forecast(camp_code, hours=12, phone=phone)

    elif parsed.command_type == CommandType.CAST24:
        # 24hr hourly forecast
        if not parsed.is_valid:
            return parsed.error_message or "CAST24 requires a location.\n\nExample: CAST24 LAKEO"

        # Check for GPS coordinates
        if parsed.args.get("is_gps"):
            lat = parsed.args.get("gps_lat")
            lon = parsed.args.get("gps_lon")
            return await generate_cast_forecast_gps(lat, lon, hours=24, phone=phone)

        camp_code = parsed.args.get("location_code") or parsed.args.get("camp_code", "")
        return await generate_cast_forecast(camp_code, hours=24, phone=phone)

    elif parsed.command_type == CommandType.CAST7:
        # 7-day forecast - location, CAMPS, PEAKS, or GPS coordinates
        if not parsed.is_valid:
            return parsed.error_message or "CAST7 requires location.\n\nExample: CAST7 LAKEO, CAST7 CAMPS, or CAST7 PEAKS"

        if parsed.args.get("all_camps"):
            return await generate_cast7_all_camps(phone)
        elif parsed.args.get("all_peaks"):
            return await generate_cast7_all_peaks(phone)
        elif parsed.args.get("is_gps"):
            # GPS coordinates
            lat = parsed.args.get("gps_lat")
            lon = parsed.args.get("gps_lon")
            return await generate_cast7_forecast_gps(lat, lon, phone=phone)
        else:
            camp_code = parsed.args.get("location_code", "")
            return await generate_cast7_forecast(camp_code, phone=phone)

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
            forecast_msg = await generate_cast_forecast(camp_code, phone=phone)
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
            return "Invalid phone number format.\n\nUse format: +61400123456"

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
            return "Invalid phone number format."

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

    elif parsed.command_type == CommandType.BUY:
        # Process BUY $10 top-up via stored card
        from app.models.account import account_store
        from app.services.payments import get_payment_service
        from app.services.balance import get_balance_service

        if not parsed.is_valid:
            return parsed.error_message or "BUY requires an amount.\n\nExample: BUY $10"

        amount = parsed.args.get("amount", 10)
        if amount != 10:
            return "Only $10 top-ups are available via SMS.\n\nText: BUY $10"

        # Look up account by phone
        account = account_store.get_by_phone(phone)
        if not account:
            return "No account linked to this phone number.\n\nVisit thunderbird.bot to link your account."

        if not account.stripe_customer_id:
            return "No payment method on file.\n\nVisit thunderbird.bot to add a card for one-click top-ups."

        # Attempt to charge stored card
        try:
            payment_service = get_payment_service()
            result = await payment_service.charge_stored_card(
                account_id=account.id,
                amount_cents=1000,  # $10.00
                description="SMS top-up via BUY command"
            )

            if result.success:
                balance_service = get_balance_service()
                new_balance = balance_service.get_balance(account.id)
                balance_dollars = new_balance / 100 if new_balance else 0
                return f"$10 top-up successful!\n\nNew balance: ${balance_dollars:.2f}"
            elif result.error and "authentication" in result.error.lower():
                return "Card requires verification.\n\nVisit thunderbird.bot to complete the top-up."
            else:
                error = result.error or "Payment failed"
                return f"Top-up failed: {error}\n\nVisit thunderbird.bot to retry."
        except Exception as e:
            logger.error(f"BUY command failed for {PhoneUtils.mask(phone)}: {e}")
            return "Top-up failed. Please try again or visit thunderbird.bot."

    elif parsed.command_type == CommandType.TOPUP:
        # Process YES$10/YES$25/YES$50 top-up confirmation via stored card
        from app.models.account import account_store
        from app.services.payments import get_payment_service
        from app.services.balance import get_balance_service

        if not parsed.is_valid:
            return parsed.error_message or "Valid amounts: YES$10, YES$25, or YES$50"

        amount = parsed.args.get("amount")
        amount_cents = parsed.args.get("amount_cents")

        # Look up account by phone
        account = account_store.get_by_phone(phone)
        if not account:
            return "No account linked to this phone.\n\nVisit thunderbird.bot to set up your account."

        if not account.stripe_customer_id:
            return "No card on file.\n\nVisit thunderbird.bot to add a payment method first."

        # Attempt to charge stored card
        try:
            payment_service = get_payment_service()
            result = await payment_service.charge_stored_card(
                account_id=account.id,
                amount_cents=amount_cents,
                description=f"SMS top-up ${amount} via YES command"
            )

            if result.success:
                balance_service = get_balance_service()
                new_balance = balance_service.get_balance(account.id)
                balance_dollars = new_balance / 100 if new_balance else 0
                return f"${amount} top-up successful!\n\nNew balance: ${balance_dollars:.2f}\n\nText CAST [location] for forecast."
            elif result.error and "authentication" in result.error.lower():
                return "Card requires verification.\n\nVisit thunderbird.bot to complete."
            else:
                error = result.error or "Payment failed"
                return f"Top-up failed: {error}\n\nTry again or visit thunderbird.bot"
        except Exception as e:
            logger.error(f"TOPUP command failed for {PhoneUtils.mask(phone)}: {e}")
            return "Top-up failed. Please try again."

    elif parsed.command_type == CommandType.UNITS:
        # Handle UNITS command - change unit preference
        # v3.5: Check both Account and User models
        from app.models.account import account_store
        from app.models.database import user_store

        # Try account first (web users), fall back to user (SMS-only users)
        account = account_store.get_by_phone(phone)
        user = user_store.get_user(phone)

        if not account and not user:
            return "You're not registered. Send START to begin."

        # Get current unit system from user or account
        current = "metric"
        if user:
            current = user.unit_system or "metric"
        elif account:
            current = account.unit_system or "metric"

        # Check if status request (bare UNITS command)
        if parsed.args.get("action") == "status":
            if current == "metric":
                return "Current units: METRIC (Celsius, meters)\n\nTo change: UNITS IMPERIAL"
            else:
                return "Current units: IMPERIAL (Fahrenheit, feet)\n\nTo change: UNITS METRIC"

        if not parsed.is_valid:
            return parsed.error_message or "Invalid unit system.\n\nText UNITS METRIC or UNITS IMPERIAL"

        new_unit_system = parsed.args.get("unit_system")
        if not new_unit_system:
            return "Please specify: UNITS METRIC or UNITS IMPERIAL"

        # Update unit preference in both stores if applicable
        success = False
        if user:
            success = user_store.update_unit_system(phone, new_unit_system)
        if account:
            success = account_store.update_unit_system(account.id, new_unit_system) or success

        if success:
            if new_unit_system == "metric":
                return "Units updated: METRIC\n\nForecasts now show Celsius and meters."
            else:
                return "Units updated: IMPERIAL\n\nForecasts now show Fahrenheit and feet."
        else:
            return "Failed to update units. Please try again."

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


def get_low_balance_warning(account_id: int) -> str:
    """
    Check if account has low balance and return warning message if needed.

    Returns empty string if balance is OK, warning message otherwise.
    """
    from app.services.balance import get_balance_service

    balance_service = get_balance_service()
    balance_cents = balance_service.get_balance(account_id)

    # Warn if balance <= $2.00
    if balance_cents <= 200:
        balance_dollars = balance_cents / 100
        return (
            f"\n\n---\n"
            f"Low balance: ${balance_dollars:.2f}\n"
            f"Reply: YES$10 | YES$25 | YES$50"
        )
    return ""


async def generate_cast_forecast(camp_code: str, hours: int = 12, phone: str = None) -> str:
    """Generate CAST forecast for a specific camp/peak."""
    from app.services.routes import RouteLoader, get_route, get_other_peaks_in_cell
    from app.services.bom import get_bom_service
    from app.services.formatter import FormatCastLabeled
    from app.models.account import account_store
    from app.models.database import user_store

    # Get user's unit preference - check User (SMS) first, then Account (web)
    unit_system = "metric"
    if phone:
        user = user_store.get_user(phone)
        if user and user.unit_system:
            unit_system = user.unit_system
        else:
            account = account_store.get_by_phone(phone)
            if account and account.unit_system:
                unit_system = account.unit_system

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

        # Format as CAST response using labeled format with unit support
        message = FormatCastLabeled.format(
            forecast=forecast,
            waypoint_code=camp_code.upper(),
            waypoint_name=name,
            waypoint_elevation=elevation,
            hours=hours,
            unit_system=unit_system
        )

        # For peaks, add "Also covers:" if other peaks share the same BOM cell
        if is_peak and route:
            other_peaks = get_other_peaks_in_cell(route, camp_code)
            if other_peaks:
                other_names = ", ".join(p.name for p in other_peaks[:3])  # Limit to 3
                if len(other_peaks) > 3:
                    other_names += f" +{len(other_peaks) - 3} more"
                message += f"\n\nAlso covers: {other_names}"

        # Check for low balance and append warning if needed
        if phone:
            account = account_store.get_by_phone(phone)
            if account and account.stripe_customer_id:
                message += get_low_balance_warning(account.id)

        return message

    except Exception as e:
        logger.error(f"CAST forecast error for {camp_code}: {e}")
        return f"Unable to get forecast for {camp_code}. Please try again."


async def generate_cast_forecast_gps(lat: float, lon: float, hours: int = 12, phone: str = None) -> str:
    """
    Generate CAST forecast for GPS coordinates.

    Uses country detection to route to appropriate weather provider:
    - AU coordinates: BOM service (legacy, backwards compatible)
    - US coordinates: NWS via WeatherRouter
    - GB coordinates: Met Office via WeatherRouter
    - Other supported: Country-specific via WeatherRouter
    - Unsupported: Open-Meteo fallback via WeatherRouter
    """
    from app.services.bom import get_bom_service
    from app.services.geo import get_country_from_coordinates
    from app.services.weather.router import get_weather_router
    from app.services.weather.converter import normalized_to_cell_forecast
    from app.services.formatter import FormatCastLabeled
    from app.models.account import account_store
    from app.models.database import user_store

    # Get user's unit preference
    unit_system = "metric"
    if phone:
        user = user_store.get_user(phone)
        if user and user.unit_system:
            unit_system = user.unit_system
        else:
            account = account_store.get_by_phone(phone)
            if account and account.unit_system:
                unit_system = account.unit_system

    try:
        # Detect country from GPS coordinates
        country_code = get_country_from_coordinates(lat, lon)
        logger.info(f"GPS forecast: ({lat:.4f}, {lon:.4f}) -> country={country_code or 'unknown'}")

        bom_service = get_bom_service()

        # Get elevation for the GPS point
        elevation = await bom_service.get_grid_elevation(lat, lon)

        if country_code == "AU":
            # Australian coordinates: use BOM service (backwards compatible)
            forecast = await bom_service.get_hourly_forecast(lat, lon, hours=hours)
        else:
            # International: use WeatherRouter
            weather_router = get_weather_router()
            normalized = await weather_router.get_forecast(
                lat, lon,
                country_code=country_code or "",
                days=2  # Need 2 days for hourly data
            )
            # Convert to CellForecast for formatter compatibility
            forecast = normalized_to_cell_forecast(
                normalized, lat, lon, elevation,
                cell_id="GPS",
                geohash=""
            )

        # Format GPS coordinates as the waypoint name
        gps_display = f"{lat:.4f},{lon:.4f}"

        # Format as CAST response
        message = FormatCastLabeled.format(
            forecast=forecast,
            waypoint_code="GPS",
            waypoint_name=gps_display,
            waypoint_elevation=elevation or 0,
            hours=hours,
            unit_system=unit_system
        )

        # Check for low balance and append warning if needed
        if phone:
            account = account_store.get_by_phone(phone)
            if account and account.stripe_customer_id:
                message += get_low_balance_warning(account.id)

        return message

    except Exception as e:
        logger.error(f"CAST GPS forecast error for {lat},{lon}: {e}")
        return f"Unable to get forecast for GPS {lat:.4f},{lon:.4f}. Please try again."


async def generate_cast7_forecast(location_code: str, phone: str = None) -> str:
    """Generate 7-day forecast for a specific camp/peak."""
    from app.services.routes import RouteLoader, get_route
    from app.services.bom import get_bom_service
    from app.services.formatter import ForecastFormatter
    from app.models.account import account_store
    from app.models.database import user_store

    # Get user's unit preference - check User (SMS) first, then Account (web)
    unit_system = "metric"
    if phone:
        user = user_store.get_user(phone)
        if user and user.unit_system:
            unit_system = user.unit_system
        else:
            account = account_store.get_by_phone(phone)
            if account and account.unit_system:
                unit_system = account.unit_system

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


async def generate_cast7_forecast_gps(lat: float, lon: float, phone: str = None) -> str:
    """
    Generate 7-day CAST7 forecast for GPS coordinates.

    Uses country detection to route to appropriate weather provider:
    - AU coordinates: BOM service (legacy, backwards compatible)
    - US coordinates: NWS via WeatherRouter
    - GB coordinates: Met Office via WeatherRouter
    - Other supported: Country-specific via WeatherRouter
    - Unsupported: Open-Meteo fallback via WeatherRouter
    """
    from app.services.bom import get_bom_service
    from app.services.geo import get_country_from_coordinates
    from app.services.weather.router import get_weather_router
    from app.services.weather.converter import normalized_to_cell_forecast
    from app.services.formatter import ForecastFormatter
    from app.models.account import account_store
    from app.models.database import user_store

    # Get user's unit preference
    unit_system = "metric"
    if phone:
        user = user_store.get_user(phone)
        if user and user.unit_system:
            unit_system = user.unit_system
        else:
            account = account_store.get_by_phone(phone)
            if account and account.unit_system:
                unit_system = account.unit_system

    try:
        # Detect country from GPS coordinates
        country_code = get_country_from_coordinates(lat, lon)
        logger.info(f"CAST7 GPS forecast: ({lat:.4f}, {lon:.4f}) -> country={country_code or 'unknown'}")

        bom_service = get_bom_service()

        # Get elevation for the GPS point
        elevation = await bom_service.get_grid_elevation(lat, lon)

        if country_code == "AU":
            # Australian coordinates: use BOM service (backwards compatible)
            forecast = await bom_service.get_daily_forecast(lat, lon, days=7)
        else:
            # International: use WeatherRouter
            weather_router = get_weather_router()
            normalized = await weather_router.get_forecast(
                lat, lon,
                country_code=country_code or "",
                days=7
            )
            # Convert to CellForecast for formatter compatibility
            forecast = normalized_to_cell_forecast(
                normalized, lat, lon, elevation,
                cell_id="GPS",
                geohash=""
            )

        # Format GPS coordinates as the waypoint name
        gps_display = f"{lat:.4f},{lon:.4f}"

        # Format as CAST7 response
        formatter = ForecastFormatter()
        message = formatter.format_7day(
            forecast=forecast,
            waypoint_code="GPS",
            waypoint_name=gps_display,
            waypoint_elevation=elevation or 0
        )

        # Check for low balance and append warning if needed
        if phone:
            account = account_store.get_by_phone(phone)
            if account and account.stripe_customer_id:
                message += get_low_balance_warning(account.id)

        return message

    except Exception as e:
        logger.error(f"CAST7 GPS forecast error for {lat},{lon}: {e}")
        return f"Unable to get 7-day forecast for GPS {lat:.4f},{lon:.4f}. Please try again."


async def generate_cast7_all_camps(phone: str) -> str:
    """Generate 7-day grouped forecast for all camps on user's route."""
    from app.models.database import user_store
    from app.models.account import account_store
    from app.services.formatter import FormatCAST7Grouped
    from app.services.bom import get_bom_service
    from datetime import datetime
    from collections import defaultdict
    from config.settings import TZ_HOBART

    # Check for active trail first (Phase 7: multi-trail support)
    account = account_store.get_by_phone(phone)
    active_trail_id = None
    if account:
        active_trail_id = account_store.get_active_trail_id(account.id)

    # Get user for backwards compatibility (SMS registration)
    user = user_store.get_user(phone)

    # If account exists but no active trail and no legacy user.route_id
    if account and not active_trail_id and not user:
        return "No active trail. Send START to select one."

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
    from app.models.account import account_store
    from app.services.formatter import FormatCAST7Grouped
    from app.services.bom import get_bom_service
    from datetime import datetime
    from collections import defaultdict
    from config.settings import TZ_HOBART

    # Check for active trail first (Phase 7: multi-trail support)
    account = account_store.get_by_phone(phone)
    active_trail_id = None
    if account:
        active_trail_id = account_store.get_active_trail_id(account.id)

    # Get user for backwards compatibility (SMS registration)
    user = user_store.get_user(phone)

    # If account exists but no active trail and no legacy user.route_id
    if account and not active_trail_id and not user:
        return "No active trail. Send START to select one."

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


# ============================================================================
# Stripe Webhook Handler
# ============================================================================

# Track processed events for idempotency (in production, use Redis/DB)
_processed_stripe_events: set = set()


@router.post("/stripe")
async def stripe_webhook(request: Request):
    """
    Handle Stripe webhook events.

    CRITICAL: This is the ONLY place orders are fulfilled.
    Never fulfill from success page redirect.

    Events handled:
    - checkout.session.completed: Initial purchase or top-up completed
    - payment_intent.succeeded: Off-session payment (SMS top-up)
    """
    if stripe is None:
        logger.error("Stripe library not installed - webhook cannot process")
        raise HTTPException(status_code=500, detail="Stripe not configured")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    # Verify signature (skip in dev if no secret)
    if settings.STRIPE_WEBHOOK_SECRET:
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
            )
        except ValueError:
            logger.error("Invalid Stripe webhook payload")
            raise HTTPException(status_code=400, detail="Invalid payload")
        except stripe.error.SignatureVerificationError:
            logger.error("Invalid Stripe webhook signature")
            raise HTTPException(status_code=400, detail="Invalid signature")
    else:
        # Dev mode - parse without verification
        logger.warning("Processing Stripe webhook without signature verification (dev mode)")
        try:
            event = stripe.Event.construct_from(
                json.loads(payload), stripe.api_key
            )
        except Exception as e:
            logger.error(f"Failed to parse Stripe event: {e}")
            raise HTTPException(status_code=400, detail="Invalid event data")

    # Idempotency check
    try:
        event_id = event.id
    except (AttributeError, KeyError) as e:
        logger.error(f"Invalid Stripe event - missing event ID: {e}")
        raise HTTPException(status_code=400, detail="Invalid event - missing ID")
    if event_id in _processed_stripe_events:
        logger.info(f"Skipping duplicate Stripe event: {event_id}")
        return {"status": "already_processed"}

    # Handle event types
    if event.type == "checkout.session.completed":
        session = event.data.object
        await handle_checkout_completed(session)
    elif event.type == "payment_intent.succeeded":
        payment_intent = event.data.object
        await handle_payment_succeeded(payment_intent)
    elif event.type == "charge.refunded":
        charge = event.data.object
        await handle_charge_refunded(charge)
    else:
        logger.info(f"Unhandled Stripe event type: {event.type}")

    # Mark as processed
    _processed_stripe_events.add(event_id)
    # In production: store in Redis with TTL or database

    # Limit in-memory set size to prevent memory leak
    if len(_processed_stripe_events) > 10000:
        # Remove oldest entries (convert to list, take last 5000)
        _processed_stripe_events.clear()
        logger.info("Cleared processed events set (memory management)")

    return {"status": "success"}


async def handle_checkout_completed(session):
    """
    Handle successful checkout session.

    1. Update order status to completed
    2. Save Stripe customer ID to account (for future charges)
    3. Add credits to balance
    4. Send confirmation email (PAY-05)
    """
    from app.services.balance import get_balance_service
    from app.services.email import send_order_confirmation
    from app.models.payments import order_store
    from app.models.account import account_store
    from config.sms_pricing import get_segments_for_topup, get_country_from_phone

    metadata = session.get("metadata", {}) or {}
    account_id_str = metadata.get("account_id")
    order_id_str = metadata.get("order_id")
    purchase_type = metadata.get("purchase_type", "unknown")

    if not account_id_str or not order_id_str:
        logger.error(f"Checkout session missing metadata: {session.get('id')}")
        return

    account_id = int(account_id_str)
    order_id = int(order_id_str)
    stripe_customer_id = session.get("customer")

    logger.info(f"Checkout completed: order={order_id}, account={account_id}, type={purchase_type}")

    # 1. Get and validate order
    order = order_store.get_by_id(order_id)
    if not order:
        logger.error(f"Order not found: {order_id}")
        return

    if order.status == "completed":
        logger.info(f"Order already completed: {order_id}")
        return

    # 2. Update order status
    order_store.update_status(order_id, "completed")

    # 3. Save Stripe customer ID for future stored card payments
    if stripe_customer_id:
        account_store.update_stripe_customer_id(account_id, stripe_customer_id)
        logger.info(f"Saved Stripe customer ID for account {account_id}")

    # 4. Add credits to balance (BEFORE email - payment fulfillment is critical)
    balance_service = get_balance_service()
    description = "Initial purchase" if purchase_type == "initial_access" else "Top-up"
    balance_service.add_credits(
        account_id=account_id,
        amount_cents=order.amount_cents,
        description=description,
        order_id=order_id
    )

    logger.info(f"Credits added: {order.amount_cents} cents to account {account_id}")

    # 5. Create affiliate commission if applicable (AFFL-04: post-discount amount)
    affiliate_id_str = metadata.get("affiliate_id")
    sub_id = metadata.get("sub_id")

    if affiliate_id_str:
        try:
            affiliate_id = int(affiliate_id_str)
            affiliate_service = get_affiliate_service()

            # Calculate commission on actual paid amount (post-discount)
            commission = affiliate_service.calculate_commission(
                affiliate_id=affiliate_id,
                account_id=account_id,
                order_id=order_id,
                amount_cents=order.amount_cents,
                sub_id=sub_id,
                is_initial=(purchase_type == "initial_access")
            )

            if commission:
                logger.info(
                    f"Commission created: ${commission.amount_cents/100:.2f} for affiliate {affiliate_id}"
                )

                # For initial purchases, also create trailing attribution
                if purchase_type == "initial_access":
                    attribution = affiliate_service.create_attribution(
                        affiliate_id=affiliate_id,
                        account_id=account_id,
                        order_id=order_id,
                        sub_id=sub_id
                    )
                    if attribution:
                        logger.info(f"Trailing attribution created for account {account_id}")

                # Check for milestone achievement and send celebration email
                milestone = affiliate_service.check_milestones(affiliate_id)
                if milestone:
                    try:
                        await affiliate_service.send_milestone_email(affiliate_id, milestone)
                        logger.info(f"Milestone ${milestone/100:.0f} reached for affiliate {affiliate_id}")
                    except Exception as e:
                        # Don't fail commission creation if email fails
                        logger.warning(f"Failed to send milestone email: {e}")

        except (ValueError, Exception) as e:
            logger.error(f"Failed to create affiliate commission: {e}")

    # 6. Send confirmation email (PAY-05)
    # Email failure does NOT affect payment success - logged but not raised
    account = account_store.get_by_id(account_id)
    if account and account.email:
        try:
            # Get SMS number (the Twilio number users text)
            sms_number = settings.TWILIO_PHONE_NUMBER or "+1234567890"

            # Estimate segments based on country (default to US)
            country = get_country_from_phone(account.phone) if account.phone else "US"
            # For initial purchase, estimate based on amount paid
            # $10 top-up gives segments_per_topup, scale accordingly
            segments = int((order.amount_cents / 1000) * get_segments_for_topup(country, 10))

            email_result = await send_order_confirmation(
                to_email=account.email,
                sms_number=sms_number,
                amount_paid_cents=order.amount_cents,
                segments_received=segments
            )

            if email_result.success:
                logger.info(f"Confirmation email sent to {account.email}")
            else:
                # Log but don't fail - payment already succeeded
                logger.warning(f"Confirmation email failed: {email_result.error}")
        except Exception as e:
            # Catch-all to ensure email issues never break payment flow
            logger.error(f"Email send error (non-fatal): {e}")


async def handle_payment_succeeded(payment_intent):
    """
    Handle successful off-session payment (SMS BUY command).
    Similar to checkout but uses payment_intent metadata.
    """
    from app.services.balance import get_balance_service
    from app.models.payments import order_store

    metadata = payment_intent.get("metadata", {}) or {}
    if not metadata.get("account_id"):
        logger.debug("Payment intent without account_id metadata - not our payment")
        return  # Not our payment

    account_id = int(metadata.get("account_id"))
    order_id_str = metadata.get("order_id")

    if order_id_str:
        order_id = int(order_id_str)

        # Get order to verify it exists
        order = order_store.get_by_id(order_id)
        if not order:
            logger.error(f"Order not found for payment intent: {order_id}")
            return

        if order.status == "completed":
            logger.info(f"Order already completed: {order_id}")
            return

        order_store.update_status(order_id, "completed")

        balance_service = get_balance_service()
        amount_cents = payment_intent.get("amount", 0)
        balance_service.add_credits(
            account_id=account_id,
            amount_cents=amount_cents,
            description="SMS top-up",
            order_id=order_id
        )
        logger.info(f"SMS top-up completed: {amount_cents} cents for account {account_id}")

        # Check for trailing attribution (AFFL-05: recurring commissions)
        affiliate_service = get_affiliate_service()
        attribution = affiliate_service.get_active_attribution(account_id)

        if attribution:
            # Create trailing commission
            commission = affiliate_service.calculate_commission(
                affiliate_id=attribution.affiliate_id,
                account_id=account_id,
                order_id=order_id,
                amount_cents=amount_cents,
                sub_id=attribution.sub_id,
                is_initial=False
            )
            if commission:
                logger.info(
                    f"Trailing commission created: ${commission.amount_cents/100:.2f} "
                    f"for affiliate {attribution.affiliate_id} on top-up"
                )

                # Check for milestone achievement on trailing commissions too
                milestone = affiliate_service.check_milestones(attribution.affiliate_id)
                if milestone:
                    try:
                        await affiliate_service.send_milestone_email(attribution.affiliate_id, milestone)
                        logger.info(f"Milestone ${milestone/100:.0f} reached for affiliate {attribution.affiliate_id}")
                    except Exception as e:
                        logger.warning(f"Failed to send milestone email: {e}")


async def handle_charge_refunded(charge):
    """
    Handle refunded charge.

    Clawback affiliate commission(s) for the refunded order.
    """
    from app.models.payments import order_store

    # Get payment intent from charge
    payment_intent_id = charge.get("payment_intent")
    if not payment_intent_id:
        logger.debug("Charge refund without payment_intent - not our charge")
        return

    # Look up order by payment intent
    order = order_store.get_by_payment_intent(payment_intent_id)
    if not order:
        logger.warning(f"Order not found for refunded payment_intent: {payment_intent_id}")
        return

    logger.info(f"Charge refunded: order={order.id}, payment_intent={payment_intent_id}")

    # Update order status
    order_store.update_status(order.id, "refunded")

    # Clawback any commissions for this order
    affiliate_service = get_affiliate_service()
    clawed_back = affiliate_service.clawback_commission(order.id)

    if clawed_back:
        logger.info(f"Commissions clawed back for refunded order {order.id}")
    else:
        logger.debug(f"No commissions to clawback for order {order.id}")
