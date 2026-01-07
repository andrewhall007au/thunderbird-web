#!/usr/bin/env python3
"""Debug script to test forecast generation."""

import asyncio
import sys
sys.path.insert(0, '.')

from app.services.bom import get_bom_service
from app.services.forecast import get_forecast_generator
from app.services.routes import get_route

async def main():
    print("=== Thunderbird Forecast Debug ===\n")
    
    # Test 1: Route loading
    print("1. Loading route...")
    route = get_route("western_arthurs_ak")
    if route:
        print(f"   ✓ Route loaded: {route.name}")
        print(f"   ✓ Camps: {len(route.camps)}")
        if route.camps:
            camp = route.camps[0]
            print(f"   ✓ First camp: {camp.name} ({camp.lat}, {camp.lon})")
    else:
        print("   ✗ Failed to load route!")
        return
    
    # Test 2: BOM Service
    print("\n2. Testing BOM/Open-Meteo API...")
    bom = get_bom_service()
    try:
        forecast = await bom.get_hourly_forecast(
            lat=camp.lat,
            lon=camp.lon,
            hours=12
        )
        print(f"   ✓ Forecast fetched from: {forecast.source}")
        print(f"   ✓ Periods returned: {len(forecast.periods)}")
        
        if forecast.periods:
            p = forecast.periods[0]
            print(f"   ✓ First period: {p.datetime}, temp={p.temp_max}°C, rain={p.rain_chance}%")
        else:
            print("   ✗ No periods in forecast!")
            
    except Exception as e:
        print(f"   ✗ API Error: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # Test 3: Forecast Generator
    print("\n3. Testing forecast generation...")
    generator = get_forecast_generator()
    try:
        messages = await generator.generate_morning_forecast(
            route_id="western_arthurs_ak",
            current_position=None,
            current_day=1,
            duration_days=7
        )
        print(f"   ✓ Messages generated: {len(messages)}")
        
        if messages:
            print(f"\n=== Forecast Message ===")
            print(messages[0].content)
            print("========================")
        else:
            print("   ✗ No messages generated!")
            
    except Exception as e:
        print(f"   ✗ Generator Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
