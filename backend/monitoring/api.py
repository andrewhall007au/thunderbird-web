"""
Monitoring Dashboard API
Endpoints for the status dashboard to fetch metrics, uptime stats, incidents, and timelines.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from .storage import (
    get_all_latest_statuses,
    get_recent_metrics,
    get_uptime_stats,
    get_active_incidents,
    get_incident_timeline,
    acknowledge_incident,
)

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/monitoring", tags=["monitoring"])

# Display name mapping
DISPLAY_NAMES = {
    "health_check": "Backend Health",
    "frontend_check": "Frontend",
    "beta_signup_flow": "Beta Signup",
    "api_response_time": "API Response",
    "weather_api_check": "Weather API",
    "db_query_performance": "Database Queries",
    "external_api_latency": "External APIs",
    "synthetic_login": "Login Flow",
    "synthetic_sms_webhook": "SMS Webhook",
}


def get_display_name(check_name: str) -> str:
    """Get human-readable display name for a check."""
    return DISPLAY_NAMES.get(check_name, check_name.replace("_", " ").title())


def calculate_overall_status(checks: list[dict]) -> str:
    """
    Calculate overall system status from check results.

    Returns:
        "healthy" if all pass, "degraded" if any warning/degraded, "down" if any fail
    """
    if not checks:
        return "unknown"

    has_failures = any(c["status"] == "fail" for c in checks)
    has_degraded = any(c["status"] in ["degraded", "warning"] for c in checks)

    if has_failures:
        return "down"
    elif has_degraded:
        return "degraded"
    else:
        return "healthy"


# ============================================================================
# Dashboard Endpoints
# ============================================================================

@router.get("/status")
async def get_status():
    """
    Overall system status with latest check results.

    Returns:
        JSON with overall_status, checks array, active_incidents count, timestamp
    """
    try:
        statuses = get_all_latest_statuses()
        active_incidents = get_active_incidents()

        # Format check data
        checks = []
        for status in statuses:
            checks.append({
                "name": status["check_name"],
                "display_name": get_display_name(status["check_name"]),
                "status": status["status"],
                "last_check_ms": status["timestamp_ms"],
                "duration_ms": status.get("duration_ms"),
                "error": status.get("error_message"),
                "metadata": status.get("metadata")
            })

        overall = calculate_overall_status(statuses)

        return {
            "overall_status": overall,
            "checks": checks,
            "active_incidents": len(active_incidents),
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
    except Exception as e:
        logger.error(f"Error fetching status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/uptime")
async def get_uptime(hours: int = Query(24, ge=1, le=720)):
    """
    Uptime statistics for all checks.

    Args:
        hours: Number of hours to calculate uptime over (default: 24, max: 720 = 30 days)

    Returns:
        JSON with period_hours and checks array with uptime percentages
    """
    try:
        # Get all unique check names from latest statuses
        latest = get_all_latest_statuses()
        check_names = [m["check_name"] for m in latest]

        uptime_data = []
        for check_name in check_names:
            stats = get_uptime_stats(check_name, hours=hours)
            uptime_data.append({
                "name": check_name,
                "display_name": get_display_name(check_name),
                "total_checks": stats["total_checks"],
                "successful_checks": stats["pass_count"],
                "uptime_percent": round(stats["uptime_percent"], 2),
                "avg_duration_ms": round(stats["avg_duration_ms"], 1) if stats["avg_duration_ms"] else None
            })

        return {
            "period_hours": hours,
            "checks": uptime_data
        }
    except Exception as e:
        logger.error(f"Error calculating uptime: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics/{check_name}")
async def get_check_metrics(
    check_name: str,
    hours: int = Query(1, ge=1, le=168)
):
    """
    Time series metrics for a specific check.

    Args:
        check_name: Name of the check
        hours: Number of hours to look back (default: 1, max: 168 = 7 days)

    Returns:
        JSON with check_name, period_hours, and data_points array
    """
    try:
        metrics = get_recent_metrics(check_name, hours=hours)

        # Limit to 1000 data points
        if len(metrics) > 1000:
            # Sample evenly
            step = len(metrics) // 1000
            metrics = metrics[::step]

        # Format data points
        data_points = []
        for metric in metrics:
            data_points.append({
                "timestamp_ms": metric["timestamp_ms"],
                "status": metric["status"],
                "duration_ms": metric.get("duration_ms")
            })

        return {
            "check_name": check_name,
            "period_hours": hours,
            "data_points": data_points
        }
    except Exception as e:
        logger.error(f"Error fetching metrics for {check_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/incidents")
async def get_incidents():
    """
    Active and recently resolved incidents.

    Returns:
        JSON with active incidents and recent_resolved incidents
    """
    try:
        incidents = get_active_incidents()

        # Split into active and acknowledged
        active = []
        for incident in incidents:
            formatted = {
                "id": incident["id"],
                "check_name": incident["check_name"],
                "display_name": get_display_name(incident["check_name"]),
                "severity": incident["severity"],
                "status": incident["status"],
                "first_seen": datetime.fromtimestamp(incident["first_seen_ms"] / 1000).isoformat() + "Z",
                "last_seen": datetime.fromtimestamp(incident["last_seen_ms"] / 1000).isoformat() + "Z",
                "failure_count": incident["failure_count"],
                "message": incident["message"]
            }
            active.append(formatted)

        # TODO: Add recently resolved incidents (last 24 hours)
        # For now, return empty array
        recent_resolved = []

        return {
            "active": active,
            "recent_resolved": recent_resolved
        }
    except Exception as e:
        logger.error(f"Error fetching incidents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class AcknowledgeRequest(BaseModel):
    """Request body for acknowledging an incident."""
    acknowledged_by: Optional[str] = "admin"


@router.post("/incidents/{incident_id}/acknowledge")
async def acknowledge_incident_endpoint(
    incident_id: str,
    body: Optional[AcknowledgeRequest] = None
):
    """
    Acknowledge an incident to stop escalation.

    Args:
        incident_id: Incident UUID
        body: Optional request body with acknowledged_by field

    Returns:
        JSON with id, status, acknowledged_at
    """
    try:
        # Check if incident exists first
        timeline = get_incident_timeline(incident_id)
        if not timeline:
            raise HTTPException(status_code=404, detail="Incident not found")

        # Check if already resolved
        if timeline["status"] == "resolved":
            raise HTTPException(status_code=400, detail="Cannot acknowledge resolved incident")

        # Acknowledge the incident
        acknowledge_incident(incident_id)

        return {
            "id": incident_id,
            "status": "acknowledged",
            "acknowledged_at": datetime.utcnow().isoformat() + "Z",
            "acknowledged_by": body.acknowledged_by if body else "admin"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error acknowledging incident {incident_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/incidents/{incident_id}/timeline")
async def get_incident_timeline_endpoint(incident_id: str):
    """
    Get incident details with full timeline of events.

    Args:
        incident_id: Incident UUID

    Returns:
        JSON with incident details and timeline array
    """
    try:
        data = get_incident_timeline(incident_id)

        if not data:
            raise HTTPException(status_code=404, detail="Incident not found")

        # Format incident
        incident = {
            "id": data["id"],
            "check_name": data["check_name"],
            "display_name": get_display_name(data["check_name"]),
            "severity": data["severity"],
            "status": data["status"],
            "first_seen": datetime.fromtimestamp(data["first_seen_ms"] / 1000).isoformat() + "Z",
            "last_seen": datetime.fromtimestamp(data["last_seen_ms"] / 1000).isoformat() + "Z",
            "failure_count": data["failure_count"],
            "message": data.get("message")
        }

        # Build timeline from metrics
        timeline = []

        # First failure
        if data.get("metrics"):
            first_metric = data["metrics"][0]
            timeline.append({
                "timestamp": datetime.fromtimestamp(first_metric["timestamp_ms"] / 1000).isoformat() + "Z",
                "event": "first_failure",
                "details": first_metric.get("error_message") or data.get("message") or "Check failed"
            })

            # Consecutive failures
            failure_count = 1
            for metric in data["metrics"][1:]:
                if metric["status"] == "fail":
                    failure_count += 1
                    if failure_count in [2, 3, 5, 10]:  # Log specific milestones
                        timeline.append({
                            "timestamp": datetime.fromtimestamp(metric["timestamp_ms"] / 1000).isoformat() + "Z",
                            "event": "consecutive_failure",
                            "details": f"{failure_count} consecutive failures"
                        })

        # Acknowledged event (if status is acknowledged)
        if data["status"] == "acknowledged":
            timeline.append({
                "timestamp": datetime.utcnow().isoformat() + "Z",  # Approximate
                "event": "acknowledged",
                "details": "Incident acknowledged by admin"
            })

        # Resolved event (if resolved)
        if data.get("resolved_ms"):
            timeline.append({
                "timestamp": datetime.fromtimestamp(data["resolved_ms"] / 1000).isoformat() + "Z",
                "event": "resolved",
                "details": "Incident resolved - check passing"
            })

        return {
            "incident": incident,
            "timeline": timeline
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching timeline for {incident_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary")
async def get_daily_summary(date: Optional[str] = None):
    """
    Daily summary statistics for reporting.

    Args:
        date: Date in YYYY-MM-DD format (default: today)

    Returns:
        JSON with date, total_checks_run, failures, uptime_percent, incidents, etc.
    """
    try:
        # Parse date or use today
        if date:
            target_date = datetime.strptime(date, "%Y-%m-%d").date()
        else:
            target_date = datetime.utcnow().date()

        # Calculate stats for the day (last 24 hours from now for simplicity)
        # In production, this should query for the specific date range

        latest = get_all_latest_statuses()
        check_names = [m["check_name"] for m in latest]

        total_checks = 0
        total_failures = 0
        total_duration = 0

        for check_name in check_names:
            stats = get_uptime_stats(check_name, hours=24)
            total_checks += stats["total_checks"]
            total_failures += stats["fail_count"]
            if stats["avg_duration_ms"]:
                total_duration += stats["avg_duration_ms"]

        uptime_percent = ((total_checks - total_failures) / total_checks * 100) if total_checks > 0 else 0
        avg_response_ms = total_duration / len(check_names) if check_names else 0

        # Get incidents for the day
        incidents = get_active_incidents()
        incidents_today = len(incidents)  # Simplified - should filter by date

        return {
            "date": target_date.isoformat(),
            "total_checks_run": total_checks,
            "total_failures": total_failures,
            "uptime_percent": round(uptime_percent, 2),
            "avg_response_ms": round(avg_response_ms, 1),
            "incidents_today": incidents_today,
            "alerts_sent": 0  # TODO: Track alert sends in alerting plan
        }
    except Exception as e:
        logger.error(f"Error generating daily summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))
