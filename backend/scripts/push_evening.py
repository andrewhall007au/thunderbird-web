#!/usr/bin/env python3
"""
Evening Forecast Push Script
Based on THUNDERBIRD_SPEC_v2.4 Section 8.5

Runs at 6:00 PM AEST/AEDT daily.
Sends evening forecasts based on confirmed check-in positions.
Includes RETURN segment for loop routes.
"""

import asyncio
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Tuple

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from config.settings import settings, TZ_HOBART
from app.services.sms import get_sms_service
from app.services.bom import get_bom_service, CellForecast
from app.services.formatter import ForecastFormatter
from app.services.routes import get_route, Route

import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def get_active_users():
    """
    Get all active users for evening forecast.
    
    TODO: Implement database query
    """
    return []


async def get_return_forecasts(
    route: Route,
    bom
) -> List[Tuple[str, CellForecast, int]]:
    """
    Get forecasts for RETURN segment waypoints.
    
    Returns: List of (name, forecast, elevation)
    """
    forecasts = []
    
    for wp in route.return_waypoints:
        code = wp["code"]
        camp = route.get_camp(code)
        
        if camp:
            forecast = await bom.get_forecast(camp.lat, camp.lon, days=7)
            forecasts.append((camp.name, forecast, camp.elevation))
    
    return forecasts


async def generate_evening_forecast(user) -> list[str]:
    """
    Generate evening forecast messages for a user.
    
    Evening format (Section 8.5):
    - Uses confirmed position from check-in
    - Detailed forecast for current + forward cells
    - RETURN segment for loop routes
    """
    route = get_route(user.route_id)
    if not route:
        logger.error(f"Route not found: {user.route_id}")
        return []
    
    bom = get_bom_service()
    formatter = ForecastFormatter(user.wind_threshold)
    
    messages = []
    
    # Get confirmed position (from check-in or itinerary)
    current_camp = user.current_position or route.camps[0].code
    camp = route.get_camp(current_camp)
    
    if not camp:
        logger.error(f"Camp not found: {current_camp}")
        return []
    
    # Calculate total messages
    forward_camps = route.get_forward_camps(current_camp)
    total_messages = 1 + len(forward_camps[:2])  # Current + next 2 detailed
    if forward_camps[2:]:
        total_messages += 1  # Summary for remaining
    if route.is_loop and route.return_waypoints:
        total_messages += 1  # RETURN segment
    
    msg_num = 1
    
    # Current cell - detailed
    forecast = await bom.get_forecast(camp.lat, camp.lon, days=7)
    cell_camps = route.get_camps_in_cell(camp.bom_cell)
    cell_peaks = route.get_peaks_in_cell(camp.bom_cell)
    
    message = formatter.format_detailed(
        forecast=forecast,
        cell_name=camp.bom_cell,
        cell_status="current",
        camp_elevation=camp.elevation,
        peak_elevation=route.peak_typical_elevation,
        camp_names=[c.code for c in cell_camps],
        peak_names=[p.code for p in cell_peaks],
        message_num=msg_num,
        total_messages=total_messages
    )
    messages.append(message)
    msg_num += 1
    
    # Next 2 cells - detailed
    seen_cells = {camp.bom_cell}
    for fwd_camp in forward_camps[:4]:  # Check up to 4 to get 2 new cells
        if fwd_camp.bom_cell in seen_cells:
            continue
        seen_cells.add(fwd_camp.bom_cell)
        
        if len(seen_cells) > 3:  # Current + 2 forward
            break
        
        forecast = await bom.get_forecast(fwd_camp.lat, fwd_camp.lon, days=7)
        cell_camps = route.get_camps_in_cell(fwd_camp.bom_cell)
        cell_peaks = route.get_peaks_in_cell(fwd_camp.bom_cell)
        
        message = formatter.format_detailed(
            forecast=forecast,
            cell_name=fwd_camp.bom_cell,
            cell_status="next",
            camp_elevation=fwd_camp.elevation,
            peak_elevation=route.peak_typical_elevation,
            camp_names=[c.code for c in cell_camps],
            peak_names=[p.code for p in cell_peaks],
            message_num=msg_num,
            total_messages=total_messages
        )
        messages.append(message)
        msg_num += 1
    
    # Remaining cells - summary
    remaining_camps = [c for c in forward_camps if c.bom_cell not in seen_cells]
    if remaining_camps:
        # Group by cell for summary
        remaining_cells = {}
        for c in remaining_camps:
            if c.bom_cell not in remaining_cells:
                remaining_cells[c.bom_cell] = []
            remaining_cells[c.bom_cell].append(c)
        
        # Generate summaries
        for cell_id, camps in remaining_cells.items():
            first_camp = camps[0]
            forecast = await bom.get_forecast(first_camp.lat, first_camp.lon, days=7)
            
            message = formatter.format_summary(
                forecast=forecast,
                cell_name=cell_id,
                elevation=first_camp.elevation,
                location_names=[c.code for c in camps],
                message_num=msg_num,
                total_messages=total_messages
            )
            messages.append(message)
            msg_num += 1
    
    # RETURN segment for loop routes
    if route.is_loop and route.return_waypoints:
        return_forecasts = await get_return_forecasts(route, bom)
        
        if return_forecasts:
            message = formatter.format_return_segment(
                waypoint_forecasts=return_forecasts,
                message_num=msg_num,
                total_messages=total_messages
            )
            messages.append(message)
    
    return messages


async def send_evening_forecasts():
    """Main function to send all evening forecasts."""
    logger.info("Starting evening forecast push")
    start_time = datetime.now(TZ_HOBART)
    
    users = await get_active_users()
    logger.info(f"Found {len(users)} active users")
    
    sms = get_sms_service()
    bom = get_bom_service()
    
    success_count = 0
    error_count = 0
    total_segments = 0
    
    for user in users:
        try:
            messages = await generate_evening_forecast(user)
            
            if messages:
                results = await sms.send_batch(user.phone, messages)
                
                # Count segments
                for r in results:
                    if not r.error:
                        total_segments += r.segments
                
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
    
    # Cleanup
    await bom.close()
    
    # Log summary
    duration = datetime.now(TZ_HOBART) - start_time
    logger.info(
        f"Evening push complete: {success_count} success, {error_count} errors, "
        f"{total_segments} total segments, duration: {duration.total_seconds():.1f}s"
    )


if __name__ == "__main__":
    asyncio.run(send_evening_forecasts())
