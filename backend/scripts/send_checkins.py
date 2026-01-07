#!/usr/bin/env python3
"""
Check-in Request Script
Based on THUNDERBIRD_SPEC_v2.4 Section 8.2

Runs at 5:30 PM AEST/AEDT daily.
Sends check-in requests to all active users.
"""

import asyncio
import sys
from datetime import datetime
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from config.settings import settings, TZ_HOBART
from app.services.sms import get_sms_service
from app.services.routes import get_route

import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def get_active_users():
    """
    Get all active users for check-in.
    
    TODO: Implement database query
    """
    return []


def generate_checkin_message(user, route) -> str:
    """
    Generate check-in request message.
    
    Section 8.2 format:
    ```
    Where are you tonight?
    
    Reply with camp code:
    LAKEF LAKEC LAKEO HIGHM LAKEH
    
    Or text DELAY if staying put.
    ```
    """
    # Get expected camp from itinerary
    expected_camp = None
    for day in route.standard_itinerary:
        if day.day == user.current_day:
            expected_camp = day.to_code
            break
    
    # Get valid camps (current and forward)
    current_position = user.current_position or route.camps[0].code
    valid_camps = [current_position]
    
    forward = route.get_forward_camps(current_position)
    valid_camps.extend([c.code for c in forward[:5]])  # Next 5 camps
    
    camps_str = ' '.join(valid_camps)
    
    return (
        f"Where are you tonight?\n\n"
        f"Reply with camp code:\n"
        f"{camps_str}\n\n"
        f"Or text DELAY if staying put."
    )


async def send_checkin_requests():
    """Main function to send all check-in requests."""
    logger.info("Starting check-in request push")
    start_time = datetime.now(TZ_HOBART)
    
    users = await get_active_users()
    logger.info(f"Found {len(users)} active users")
    
    sms = get_sms_service()
    success_count = 0
    error_count = 0
    
    for user in users:
        try:
            route = get_route(user.route_id)
            if not route:
                logger.error(f"Route not found: {user.route_id}")
                continue
            
            message = generate_checkin_message(user, route)
            result = await sms.send_message(user.phone, message)
            
            if result.error:
                logger.error(f"SMS error for {user.phone}: {result.error}")
                error_count += 1
            else:
                success_count += 1
                logger.info(f"Sent check-in request to {user.phone}")
            
        except Exception as e:
            logger.error(f"Error processing user {user.phone}: {e}")
            error_count += 1
    
    # Log summary
    duration = datetime.now(TZ_HOBART) - start_time
    logger.info(
        f"Check-in push complete: {success_count} success, {error_count} errors, "
        f"duration: {duration.total_seconds():.1f}s"
    )


if __name__ == "__main__":
    asyncio.run(send_checkin_requests())
