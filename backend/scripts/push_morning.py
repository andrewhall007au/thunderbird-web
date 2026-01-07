#!/usr/bin/env python3
"""
Morning Forecast Push Script
Based on THUNDERBIRD_SPEC_v2.4 Section 8.4

Runs at 6:00 AM AEST/AEDT daily.
Sends morning forecasts to all active users.
"""

import asyncio
import sys
from datetime import datetime, date
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from config.settings import settings, TZ_HOBART
from app.services.sms import get_sms_service
from app.services.bom import get_bom_service
from app.services.formatter import ForecastFormatter
from app.services.routes import get_route

import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def get_active_users():
    """
    Get all active users for morning forecast.
    
    TODO: Implement database query
    """
    # Placeholder - would query database for users where:
    # - status = 'active'
    # - start_date <= today <= expires_at
    return []


async def generate_morning_forecast(user) -> list[str]:
    """
    Generate morning forecast messages for a user.
    
    Morning format (Section 8.4):
    - Position assumed from itinerary
    - Detailed forecast for current + next 2 cells
    - Summary for remaining cells
    """
    route = get_route(user.route_id)
    if not route:
        logger.error(f"Route not found: {user.route_id}")
        return []
    
    bom = get_bom_service()
    formatter = ForecastFormatter(user.wind_threshold)
    
    messages = []
    
    # Get current position from itinerary or last check-in
    current_camp = user.current_position or route.camps[0].code
    camp = route.get_camp(current_camp)
    
    if not camp:
        logger.error(f"Camp not found: {current_camp}")
        return []
    
    # Get forecast for current cell
    forecast = await bom.get_forecast(camp.lat, camp.lon, days=7)
    
    # Get camps and peaks in this cell
    cell_camps = route.get_camps_in_cell(camp.bom_cell)
    cell_peaks = route.get_peaks_in_cell(camp.bom_cell)
    
    # Format detailed message
    message = formatter.format_detailed(
        forecast=forecast,
        cell_name=camp.bom_cell,
        cell_status="current",
        camp_elevation=camp.elevation,
        peak_elevation=route.peak_typical_elevation,
        camp_names=[c.code for c in cell_camps],
        peak_names=[p.code for p in cell_peaks],
        message_num=1,
        total_messages=3  # Will calculate properly
    )
    messages.append(message)
    
    # Add forward camps summary
    forward_camps = route.get_forward_camps(current_camp)
    if forward_camps:
        # Get summary for forward camps
        pass  # TODO: Implement forward summary
    
    return messages


async def send_morning_forecasts():
    """Main function to send all morning forecasts."""
    logger.info("Starting morning forecast push")
    start_time = datetime.now(TZ_HOBART)
    
    users = await get_active_users()
    logger.info(f"Found {len(users)} active users")
    
    sms = get_sms_service()
    success_count = 0
    error_count = 0
    
    for user in users:
        try:
            messages = await generate_morning_forecast(user)
            
            if messages:
                results = await sms.send_batch(user.phone, messages)
                
                # Check for errors
                errors = [r for r in results if r.error]
                if errors:
                    logger.error(f"SMS errors for {user.phone}: {errors}")
                    error_count += 1
                else:
                    success_count += 1
                    logger.info(f"Sent {len(messages)} messages to {user.phone}")
            
        except Exception as e:
            logger.error(f"Error processing user {user.phone}: {e}")
            error_count += 1
    
    # Log summary
    duration = datetime.now(TZ_HOBART) - start_time
    logger.info(
        f"Morning push complete: {success_count} success, {error_count} errors, "
        f"duration: {duration.total_seconds():.1f}s"
    )


if __name__ == "__main__":
    asyncio.run(send_morning_forecasts())
