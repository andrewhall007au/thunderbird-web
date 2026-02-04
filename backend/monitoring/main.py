"""
Monitoring Service FastAPI Application
Standalone monitoring service running on port 8001.
"""

import logging
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse

from .config import settings
from .storage import (
    init_db,
    get_all_latest_statuses,
    get_recent_metrics,
    get_uptime_stats,
    get_active_incidents,
    get_incident_timeline,
    acknowledge_incident,
)
from .scheduler import create_scheduler
from .api import router as monitoring_api_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='{"timestamp": "%(asctime)s", "level": "%(levelname)s", "message": "%(message)s"}'
)
logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler = None
start_time = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle."""
    global scheduler, start_time

    logger.info("Starting Monitoring Service")

    # Initialize database
    init_db()
    logger.info("Database initialized")

    # Create and start scheduler
    scheduler = create_scheduler()
    scheduler.start()
    logger.info("Scheduler started")

    # Record start time
    start_time = datetime.utcnow()

    yield

    # Cleanup
    if scheduler:
        scheduler.shutdown()
        logger.info("Scheduler shutdown")


# Create FastAPI app
app = FastAPI(
    title="Thunderbird Monitoring Service",
    version="1.0.0",
    lifespan=lifespan
)

# Include monitoring API router
app.include_router(monitoring_api_router)


@app.get("/")
async def root():
    """
    Monitoring service status.

    Returns:
        Service status, uptime, scheduler info
    """
    global scheduler, start_time

    uptime_seconds = (datetime.utcnow() - start_time).total_seconds() if start_time else 0
    uptime_hours = uptime_seconds / 3600

    scheduler_running = scheduler is not None and scheduler.running
    job_count = len(scheduler.get_jobs()) if scheduler else 0

    return {
        "service": "Thunderbird Monitoring",
        "status": "healthy",
        "uptime_hours": round(uptime_hours, 2),
        "scheduler": {
            "running": scheduler_running,
            "job_count": job_count,
            "jobs": [
                {
                    "id": job.id,
                    "name": job.name,
                    "next_run": job.next_run_time.isoformat() if job.next_run_time else None
                }
                for job in scheduler.get_jobs()
            ] if scheduler else []
        },
        "database": settings.MONITORING_DB_PATH,
        "production_url": settings.PRODUCTION_URL
    }


@app.get("/health")
async def health():
    """
    Health check endpoint.

    Returns:
        200 with health status
    """
    global scheduler

    scheduler_running = scheduler is not None and scheduler.running

    return {
        "status": "healthy",
        "scheduler_running": scheduler_running
    }


@app.get("/api/metrics/latest")
async def get_latest_metrics():
    """
    Get latest status for all checks.

    Returns:
        List of latest check results
    """
    try:
        statuses = get_all_latest_statuses()
        return {
            "count": len(statuses),
            "metrics": statuses
        }
    except Exception as e:
        logger.error(f"Error fetching latest metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/metrics/{check_name}")
async def get_check_metrics(check_name: str, hours: int = 24):
    """
    Get recent metrics for a specific check.

    Args:
        check_name: Name of the check
        hours: Number of hours to look back (default: 24)

    Returns:
        List of recent metrics for the check
    """
    try:
        metrics = get_recent_metrics(check_name, hours=hours)
        return {
            "check_name": check_name,
            "hours": hours,
            "count": len(metrics),
            "metrics": metrics
        }
    except Exception as e:
        logger.error(f"Error fetching metrics for {check_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/uptime")
async def get_uptime(hours: int = 24):
    """
    Get uptime statistics for all checks.

    Args:
        hours: Number of hours to calculate uptime over (default: 24)

    Returns:
        Uptime stats for all checks
    """
    try:
        # Get all unique check names from latest statuses
        latest = get_all_latest_statuses()
        check_names = [m['check_name'] for m in latest]

        uptime_stats = []
        for check_name in check_names:
            stats = get_uptime_stats(check_name, hours=hours)
            uptime_stats.append(stats)

        return {
            "hours": hours,
            "checks": uptime_stats
        }
    except Exception as e:
        logger.error(f"Error calculating uptime: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/incidents")
async def get_incidents():
    """
    Get all active incidents.

    Returns:
        List of active or acknowledged incidents
    """
    try:
        incidents = get_active_incidents()
        return {
            "count": len(incidents),
            "incidents": incidents
        }
    except Exception as e:
        logger.error(f"Error fetching incidents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/incidents/{incident_id}")
async def get_incident(incident_id: str):
    """
    Get incident details with full timeline.

    Args:
        incident_id: Incident UUID

    Returns:
        Incident with all associated metrics
    """
    try:
        incident = get_incident_timeline(incident_id)
        if not incident:
            raise HTTPException(status_code=404, detail="Incident not found")
        return incident
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching incident {incident_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/incidents/{incident_id}/acknowledge")
async def acknowledge_incident_endpoint(incident_id: str):
    """
    Acknowledge an incident.

    Args:
        incident_id: Incident UUID

    Returns:
        Success message
    """
    try:
        acknowledge_incident(incident_id)
        return {
            "success": True,
            "message": f"Incident {incident_id} acknowledged"
        }
    except Exception as e:
        logger.error(f"Error acknowledging incident {incident_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc: Exception):
    """Handle unexpected exceptions."""
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )


# Run with: python -m monitoring.main
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "monitoring.main:app",
        host="0.0.0.0",
        port=8001,
        reload=True
    )
