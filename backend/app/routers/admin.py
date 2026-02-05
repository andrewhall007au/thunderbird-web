"""
Admin interface routes - Password protected.
"""

import logging
from datetime import datetime, date
from typing import Optional

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse

from config.settings import settings, TZ_HOBART
from app.services.sms import get_sms_service, PhoneUtils
from app.services.admin import (
    user_store, User, UserStatus,
    create_session, validate_session, clear_session, check_password,
    render_login, render_admin, render_affiliate_admin, render_affiliate_edit, render_affiliate_stats
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


def get_session_token(request: Request) -> Optional[str]:
    """Extract session token from cookie."""
    return request.cookies.get("thunderbird_session")


def require_admin(request: Request) -> bool:
    """Check if request has valid admin session."""
    token = get_session_token(request)
    return token and validate_session(token)


@router.get("", response_class=HTMLResponse)
@router.get("/", response_class=HTMLResponse)
async def admin_page(request: Request):
    """Admin dashboard - requires login."""
    if not require_admin(request):
        return RedirectResponse("/admin/login", status_code=302)

    # Use SQLite database instead of in-memory store
    from app.models.database import user_store as db_user_store
    users = db_user_store.list_users()
    message = request.query_params.get("msg", "")
    return render_admin(users, message)


@router.get("/login", response_class=HTMLResponse)
async def admin_login_page():
    """Admin login page."""
    return render_login()


@router.post("/login", response_class=HTMLResponse)
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
            secure=not settings.DEBUG,
            max_age=86400,  # 24 hours
            samesite="strict"
        )
        return response

    return render_login("Invalid password")


@router.get("/logout")
async def admin_logout(request: Request):
    """Logout and clear session."""
    token = get_session_token(request)
    if token:
        clear_session(token)
    response = RedirectResponse("/admin/login", status_code=302)
    response.delete_cookie("thunderbird_session")
    return response


@router.post("/register")
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


@router.post("/delete/{phone:path}")
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


@router.post("/push/{phone:path}")
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
            f"/admin?msg=Sent {forecast_type} forecast to {phone} ({sent_count} messages)",
            status_code=302
        )

    except Exception as e:
        logger.error(f"Error pushing forecast: {e}", exc_info=True)
        return RedirectResponse("/admin?msg=Error pushing forecast. Check logs.", status_code=302)


@router.post("/push-all")
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
        f"/admin?msg=Sent to {sent} users ({errors} errors)",
        status_code=302
    )


@router.post("/test-sms")
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


@router.get("/api/grouping-stats")
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
# Affiliate Management Routes (AFFL-01, AFFL-02, AFFL-03)
# ============================================================================

@router.get("/affiliates", response_class=HTMLResponse)
async def admin_affiliates(request: Request):
    """Affiliate management page - requires admin login. AFFL-01."""
    if not require_admin(request):
        return RedirectResponse("/admin/login", status_code=302)

    from app.models.affiliates import affiliate_store
    affiliates = affiliate_store.list_all(active_only=False)
    message = request.query_params.get("msg", "")
    return render_affiliate_admin(affiliates, message)


@router.post("/affiliates/create")
async def admin_create_affiliate(request: Request):
    """Create new affiliate and auto-create linked discount code. AFFL-01, AFFL-02, AFFL-03."""
    if not require_admin(request):
        return RedirectResponse("/admin/login", status_code=302)

    form = await request.form()

    try:
        code = form.get("code", "").strip().upper()
        name = form.get("name", "").strip()
        email = form.get("email", "").strip()
        discount_percent = int(form.get("discount_percent", 10))
        commission_percent = int(form.get("commission_percent", 20))
        trailing_months_str = form.get("trailing_months", "")
        trailing_months = int(trailing_months_str) if trailing_months_str and trailing_months_str != "forever" else None
        payout_method = form.get("payout_method", "").strip() or None
        payout_details = form.get("payout_details", "").strip() or None

        # Validate required fields
        if not code or not name or not email:
            return RedirectResponse("/admin/affiliates?msg=Error: Code, name, and email are required", status_code=302)

        from app.models.affiliates import affiliate_store
        from app.models.payments import discount_code_store

        # Validate code doesn't exist
        if affiliate_store.get_by_code(code):
            return RedirectResponse(f"/admin/affiliates?msg=Error: Code {code} already exists", status_code=302)

        # Create affiliate
        affiliate = affiliate_store.create(
            code=code,
            name=name,
            email=email,
            discount_percent=discount_percent,
            commission_percent=commission_percent,
            trailing_months=trailing_months,
            payout_method=payout_method,
            payout_details=payout_details
        )

        # Auto-create linked discount code (AFFL-03)
        if discount_percent > 0:
            discount_code_store.create(
                code=code,
                discount_type="percent",
                discount_value=discount_percent,
                affiliate_id=affiliate.id
            )

        return RedirectResponse(
            f"/admin/affiliates?msg=Created affiliate {code} with {discount_percent}% discount code",
            status_code=302
        )

    except Exception as e:
        logger.error(f"Error creating affiliate: {e}")
        return RedirectResponse(
            f"/admin/affiliates?msg=Error: {str(e)}",
            status_code=302
        )


@router.get("/affiliates/{affiliate_id}/edit", response_class=HTMLResponse)
async def admin_edit_affiliate_page(affiliate_id: int, request: Request):
    """Edit affiliate page. AFFL-02."""
    if not require_admin(request):
        return RedirectResponse("/admin/login", status_code=302)

    from app.models.affiliates import affiliate_store
    affiliate = affiliate_store.get_by_id(affiliate_id)
    if not affiliate:
        return RedirectResponse("/admin/affiliates?msg=Error: Affiliate not found", status_code=302)

    message = request.query_params.get("msg", "")
    return render_affiliate_edit(affiliate, message)


@router.post("/affiliates/{affiliate_id}/edit")
async def admin_edit_affiliate(affiliate_id: int, request: Request):
    """Update affiliate details. AFFL-02."""
    if not require_admin(request):
        return RedirectResponse("/admin/login", status_code=302)

    form = await request.form()

    try:
        from app.models.affiliates import affiliate_store
        from app.models.payments import discount_code_store

        affiliate = affiliate_store.get_by_id(affiliate_id)
        if not affiliate:
            return RedirectResponse("/admin/affiliates?msg=Error: Affiliate not found", status_code=302)

        name = form.get("name", "").strip()
        email = form.get("email", "").strip()
        discount_percent = int(form.get("discount_percent", 10))
        commission_percent = int(form.get("commission_percent", 20))
        trailing_months_str = form.get("trailing_months", "")
        trailing_months = int(trailing_months_str) if trailing_months_str and trailing_months_str != "forever" else None
        payout_method = form.get("payout_method", "").strip() or None
        payout_details = form.get("payout_details", "").strip() or None

        # Update affiliate
        affiliate_store.update(
            affiliate_id,
            name=name,
            email=email,
            discount_percent=discount_percent,
            commission_percent=commission_percent,
            trailing_months=trailing_months,
            payout_method=payout_method,
            payout_details=payout_details
        )

        # Update linked discount code if discount percent changed
        discount = discount_code_store.get_by_affiliate_id(affiliate_id)
        if discount and discount.discount_value != discount_percent:
            # Note: We can't easily update discount codes in current schema
            # For now, just log this. In production, might need to create new code.
            logger.info(f"Affiliate {affiliate.code} discount changed from {discount.discount_value}% to {discount_percent}%")

        return RedirectResponse(
            f"/admin/affiliates?msg=Updated affiliate {affiliate.code}",
            status_code=302
        )

    except Exception as e:
        logger.error(f"Error updating affiliate: {e}")
        return RedirectResponse(
            f"/admin/affiliates/{affiliate_id}/edit?msg=Error: {str(e)}",
            status_code=302
        )


@router.post("/affiliates/{affiliate_id}/toggle")
async def admin_toggle_affiliate(affiliate_id: int, request: Request):
    """Toggle affiliate active status. AFFL-01."""
    if not require_admin(request):
        return RedirectResponse("/admin/login", status_code=302)

    try:
        from app.models.affiliates import affiliate_store

        affiliate = affiliate_store.get_by_id(affiliate_id)
        if not affiliate:
            return RedirectResponse("/admin/affiliates?msg=Error: Affiliate not found", status_code=302)

        new_status = not affiliate.active
        affiliate_store.update(affiliate_id, active=new_status)

        status_msg = "activated" if new_status else "deactivated"
        return RedirectResponse(
            f"/admin/affiliates?msg=Affiliate {affiliate.code} {status_msg}",
            status_code=302
        )

    except Exception as e:
        logger.error(f"Error toggling affiliate: {e}")
        return RedirectResponse(
            f"/admin/affiliates?msg=Error: {str(e)}",
            status_code=302
        )


@router.get("/affiliates/{affiliate_id}/stats", response_class=HTMLResponse)
async def admin_affiliate_stats(affiliate_id: int, request: Request):
    """View affiliate performance stats. AFFL-06 (partial)."""
    if not require_admin(request):
        return RedirectResponse("/admin/login", status_code=302)

    try:
        from app.models.affiliates import affiliate_store, commission_store, click_store

        affiliate = affiliate_store.get_by_id(affiliate_id)
        if not affiliate:
            return RedirectResponse("/admin/affiliates?msg=Error: Affiliate not found", status_code=302)

        # Get stats
        clicks = click_store.count_by_affiliate(affiliate_id)
        commissions = commission_store.get_by_affiliate_id(affiliate_id)

        # Calculate metrics
        unique_accounts = set(c.account_id for c in commissions)
        conversions = len(unique_accounts)

        stats = {
            "clicks": clicks,
            "conversions": conversions,
            "total_commission_cents": sum(c.amount_cents for c in commissions),
            "pending_cents": sum(c.amount_cents for c in commissions if c.status == "pending"),
            "available_cents": sum(c.amount_cents for c in commissions if c.status == "available"),
            "paid_cents": sum(c.amount_cents for c in commissions if c.status == "paid"),
        }

        message = request.query_params.get("msg", "")
        return render_affiliate_stats(affiliate, stats, message)

    except Exception as e:
        logger.error(f"Error getting affiliate stats: {e}")
        return RedirectResponse(
            f"/admin/affiliates?msg=Error: {str(e)}",
            status_code=302
        )


# ============================================================================
# Payout Management Routes (AFFL-07)
# ============================================================================

@router.get("/payouts", response_class=HTMLResponse)
async def admin_payouts(request: Request):
    """Admin payout management page. AFFL-07."""
    if not require_admin(request):
        return RedirectResponse("/admin/login", status_code=302)

    from app.services.affiliates import get_affiliate_service
    from app.services.admin import render_payout_admin

    affiliate_service = get_affiliate_service()
    pending_payouts = affiliate_service.get_pending_payouts()

    message = request.query_params.get("msg", "")
    return render_payout_admin(pending_payouts, message)


@router.post("/payouts/{affiliate_id}/process")
async def admin_process_payout(affiliate_id: int, request: Request):
    """
    Mark payout as processed.

    Admin has manually sent money via PayPal or bank transfer.
    """
    if not require_admin(request):
        return RedirectResponse("/admin/login", status_code=302)

    from app.services.affiliates import get_affiliate_service

    affiliate_service = get_affiliate_service()
    success, message = affiliate_service.process_payout(affiliate_id)

    if success:
        return RedirectResponse(f"/admin/payouts?msg={message}", status_code=302)
    else:
        return RedirectResponse(f"/admin/payouts?msg=Error: {message}", status_code=302)


# ============================================================================
# Beta Application Management Routes
# ============================================================================

@router.get("/beta", response_class=HTMLResponse)
async def admin_beta(request: Request):
    """Beta applications management page."""
    if not require_admin(request):
        return RedirectResponse("/admin/login", status_code=302)

    from app.models.beta_application import beta_application_store
    from app.services.admin import render_beta_admin

    applications = beta_application_store.list_all()
    message = request.query_params.get("msg", "")
    return render_beta_admin(applications, message)


@router.post("/beta/{application_id}/approve")
async def admin_approve_beta(application_id: int, request: Request):
    """Approve a beta application."""
    if not require_admin(request):
        return RedirectResponse("/admin/login", status_code=302)

    from app.services.beta import approve_application

    success, message = await approve_application(application_id)

    if success:
        return RedirectResponse(f"/admin/beta?msg={message}", status_code=302)
    else:
        return RedirectResponse(f"/admin/beta?msg=Error: {message}", status_code=302)


@router.post("/beta/{application_id}/reject")
async def admin_reject_beta(application_id: int, request: Request):
    """Reject a beta application."""
    if not require_admin(request):
        return RedirectResponse("/admin/login", status_code=302)

    form = await request.form()
    notes = form.get("notes", "").strip() or None

    from app.services.beta import reject_application

    success, message = await reject_application(application_id, notes)

    if success:
        return RedirectResponse(f"/admin/beta?msg={message}", status_code=302)
    else:
        return RedirectResponse(f"/admin/beta?msg=Error: {message}", status_code=302)


@router.get("/beta/{account_id}/activity", response_class=HTMLResponse)
async def admin_beta_activity(account_id: int, request: Request):
    """View beta user activity - all SMS messages and GPS points."""
    if not require_admin(request):
        return RedirectResponse("/admin/login", status_code=302)

    from app.models.account import account_store
    from app.models.database import user_store as db_store
    from app.services.admin import render_beta_activity

    account = account_store.get_by_id(account_id)
    if not account:
        return RedirectResponse("/admin/beta?msg=Error: Account not found", status_code=302)

    if not account.phone:
        return RedirectResponse("/admin/beta?msg=Error: Account has no phone linked", status_code=302)

    messages = db_store.get_user_messages(account.phone, limit=200)
    return render_beta_activity(account, messages)
