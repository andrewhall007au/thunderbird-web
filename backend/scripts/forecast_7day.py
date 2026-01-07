#!/usr/bin/env python3
"""
7-Day Forecast Script for Western Arthurs
Run from backend directory: python3 scripts/forecast_7day.py

Shows temperature (adjusted for elevation), rain, and wind for key waypoints.
"""

import sys
from pathlib import Path

# Add parent directory to path so we can import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
import httpx
import pygeohash as pgh
from collections import defaultdict
from app.services.routes import RouteLoader

# Waypoints to check - edit this list as needed
WAYPOINTS = ["LAKEO", "HIGHM", "PROMO", "CRACR", "PEGAS", "ALDEB", "WESTP"]


async def get_7day_forecast():
    routes = [
        RouteLoader.load("western_arthurs_ak"),
        RouteLoader.load("western_arthurs_full"),
    ]
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        for code in WAYPOINTS:
            # Find waypoint in routes
            wp = None
            for r in routes:
                wp = r.get_camp(code) or r.get_peak(code)
                if wp:
                    break
            
            if not wp:
                print(f"\n{code}: NOT FOUND")
                continue
            
            geohash = pgh.encode(wp.lat, wp.lon, precision=6)
            
            # Get grid elevation for temperature adjustment
            try:
                elev_url = f"https://api.open-meteo.com/v1/elevation?latitude={wp.lat}&longitude={wp.lon}"
                elev_resp = await client.get(elev_url)
                grid_elev = elev_resp.json().get('elevation', [500])[0]
            except:
                grid_elev = 500
            
            adj = (wp.elevation - grid_elev) * 6.5 / 1000
            
            print(f"\n{'='*65}")
            print(f"{code} - {wp.name} ({wp.elevation}m, grid {grid_elev:.0f}m, adj {adj:+.1f}°C)")
            print(f"Geohash: {geohash} | Coords: {wp.lat:.4f}, {wp.lon:.4f}")
            print("="*65)
            print(f"{'Date':<12} {'Lo-Hi':>10} {'Rain mm':>12} {'Wind avg/max':>14}")
            print("-"*65)
            
            try:
                # Get daily forecast for temps/rain
                daily_url = f"https://api.weather.bom.gov.au/v1/locations/{geohash}/forecasts/daily"
                daily_resp = await client.get(daily_url)
                daily_data = daily_resp.json().get('data', [])
                
                # Get hourly forecast for wind
                hourly_url = f"https://api.weather.bom.gov.au/v1/locations/{geohash}/forecasts/hourly"
                hourly_resp = await client.get(hourly_url)
                hourly_data = hourly_resp.json().get('data', [])
                
                # Aggregate wind by day
                wind_by_day = defaultdict(lambda: {'speeds': [], 'gusts': []})
                for h in hourly_data:
                    date = h.get('time', '')[:10]
                    wind_spd = h.get('wind', {}).get('speed_kilometre', 0) or 0
                    wind_gust = h.get('wind', {}).get('gust_speed_kilometre') or h.get('gust', {}).get('speed_kilometre', 0) or 0
                    wind_by_day[date]['speeds'].append(wind_spd)
                    wind_by_day[date]['gusts'].append(wind_gust)
                
                for day in daily_data[:7]:
                    date = day.get('date', '')[:10]
                    temp_min = day.get('temp_min')
                    temp_max = day.get('temp_max')
                    rain_min = day.get('rain', {}).get('amount', {}).get('min', 0) or 0
                    rain_max = day.get('rain', {}).get('amount', {}).get('max', 0) or 0
                    
                    # Get wind for this day
                    w = wind_by_day.get(date, {'speeds': [0], 'gusts': [0]})
                    wind_avg = sum(w['speeds']) / len(w['speeds']) if w['speeds'] else 0
                    wind_max = max(w['speeds']) if w['speeds'] else 0  # Max of avg speeds as proxy
                    
                    if temp_min is not None and temp_max is not None:
                        t_lo = temp_min - adj
                        t_hi = temp_max - adj
                        print(f"{date:<12} {t_lo:>4.0f}-{t_hi:<4.0f}°C  {rain_min:>3.0f}-{rain_max:<4.0f}mm   {wind_avg:>4.0f}/{wind_max:<4.0f} km/h")
                        
            except Exception as e:
                print(f"  Error: {e}")


async def check_grid_cells():
    """Show grid cell info for each waypoint"""
    routes = [
        RouteLoader.load("western_arthurs_ak"),
        RouteLoader.load("western_arthurs_full"),
    ]
    
    print("\n" + "="*65)
    print("GRID CELL INFORMATION")
    print("="*65)
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        for code in WAYPOINTS:
            wp = None
            for r in routes:
                wp = r.get_camp(code) or r.get_peak(code)
                if wp:
                    break
            
            if not wp:
                continue
            
            geohash = pgh.encode(wp.lat, wp.lon, precision=6)
            
            try:
                elev_url = f"https://api.open-meteo.com/v1/elevation?latitude={wp.lat}&longitude={wp.lon}"
                elev_resp = await client.get(elev_url)
                grid_elev = elev_resp.json().get('elevation', [500])[0]
            except:
                grid_elev = 500
            
            adj = (wp.elevation - grid_elev) * 6.5 / 1000
            
            print(f"{code}: {wp.name}")
            print(f"  Coords: {wp.lat:.4f}, {wp.lon:.4f}")
            print(f"  Geohash: {geohash}")
            print(f"  Waypoint elev: {wp.elevation}m")
            print(f"  Grid elev: {grid_elev:.0f}m")
            print(f"  Adjustment: {adj:+.1f}°C")
            print()


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--grid":
        asyncio.run(check_grid_cells())
    else:
        asyncio.run(get_7day_forecast())
        print("\n" + "-"*65)
        print("Tip: Run with --grid to see grid cell details")
