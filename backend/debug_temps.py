#!/usr/bin/env python3
"""Debug script to check temperature data from real API."""

import asyncio
import sys
sys.path.insert(0, '.')

from app.services.bom import BOMService
from config.settings import TZ_HOBART
from datetime import datetime

async def main():
    print("=== Temperature Debug ===\n")
    
    bom = BOMService(use_mock=False)
    
    # Lake Fortuna coordinates
    lat, lon = -43.115, 146.225
    
    print(f"Location: {lat}, {lon}")
    print(f"Current time (Hobart): {datetime.now(TZ_HOBART).strftime('%Y-%m-%d %H:%M')}\n")
    
    try:
        forecast = await bom.get_hourly_forecast(lat, lon, hours=24)
        
        print(f"Source: {forecast.source}")
        print(f"Periods: {len(forecast.periods)}")
        print()
        print("Hour (local)     | Temp (raw) | Temp Range | Rain%")
        print("-" * 55)
        
        for p in forecast.periods[:18]:
            local_time = p.datetime.astimezone(TZ_HOBART)
            print(f"{local_time.strftime('%H:%M %a %d/%m')} | {p.temp_max:5.1f}°C   | {p.temp_min:.0f}-{p.temp_max:.0f}°C   | {p.rain_chance}%")
        
        print()
        print("=== Raw datetime values ===")
        for p in forecast.periods[:6]:
            print(f"  datetime: {p.datetime} | tz: {p.datetime.tzinfo}")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
