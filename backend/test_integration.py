#!/usr/bin/env python3
"""
Integration Test Script
Tests real API calls and data formatting
"""
import sys
import asyncio
from datetime import datetime
from zoneinfo import ZoneInfo

TZ_HOBART = ZoneInfo("Australia/Hobart")

def test_route_loading():
    """Test 1: Load routes and verify structure."""
    print("\n" + "="*50)
    print("TEST 1: Route Loading")
    print("="*50)
    
    from app.services.routes import get_route, RouteLoader
    
    routes = RouteLoader.list_routes()
    print(f"✓ Found {len(routes)} routes: {routes}")
    
    # Load Western Arthurs Full
    route = get_route("western_arthurs_full")
    print(f"✓ Loaded: {route.name}")
    print(f"  - {len(route.camps)} camps")
    print(f"  - {len(route.peaks)} peaks")
    
    # Get specific camp
    camp = route.get_camp("LAKEO")
    print(f"✓ Lake Oberon: {camp.lat}, {camp.lon}, {camp.elevation}m")
    
    return True


async def test_weather_api():
    """Test 2: Fetch real weather data from Open-Meteo."""
    print("\n" + "="*50)
    print("TEST 2: Weather API (Open-Meteo)")
    print("="*50)
    
    from app.services.bom import BOMService
    from app.services.routes import get_route
    
    route = get_route("western_arthurs_full")
    camp = route.get_camp("LAKEO")
    
    print(f"Fetching forecast for {camp.name}...")
    
    try:
        service = BOMService()
        forecast = await service.get_forecast(camp.lat, camp.lon)
        
        if forecast and forecast.periods:
            print(f"✓ Got {len(forecast.periods)} forecast periods")
            p = forecast.periods[0]
            print(f"  First period:")
            print(f"    - DateTime: {p.datetime}")
            print(f"    - Temp: {p.temp_min}-{p.temp_max}°C")
            print(f"    - Wind: {p.wind_avg}-{p.wind_max} km/h")
            print(f"    - Rain: {p.rain_chance}% ({p.rain_min}-{p.rain_max}mm)")
            return forecast
        else:
            print("✗ No forecast periods returned")
            return None
    except Exception as e:
        print(f"✗ API Error: {e}")
        import traceback
        traceback.print_exc()
        return None


def test_forecast_formatting(forecast_data):
    """Test 3: Format forecast into SMS."""
    print("\n" + "="*50)
    print("TEST 3: Forecast Formatting")
    print("="*50)
    
    if not forecast_data:
        print("✗ Skipped - no forecast data")
        return False
    
    from app.services.formatter import FormatCAST12
    from app.services.routes import get_route
    
    route = get_route("western_arthurs_full")
    camp = route.get_camp("LAKEO")
    
    # Convert forecast to dict format expected by formatter
    periods = []
    for p in forecast_data.periods[:12]:
        periods.append({
            "hour": p.datetime.hour if p.datetime else 0,
            "temp": int((p.temp_min + p.temp_max) / 2),
            "rain_prob": p.rain_chance,
            "precip_mm": p.rain_max,
            "wind_avg": p.wind_avg,
            "wind_max": p.wind_max,
            "wind_dir": getattr(p, 'wind_dir', 'N'),
            "cloud_cover": getattr(p, 'cloud_cover', 50),
            "freezing_level": getattr(p, 'freezing_level', 2000)
        })
    
    forecast_dict = {"periods": periods}
    
    try:
        result = FormatCAST12.format(
            location_name=camp.name,
            elevation=camp.elevation,
            forecast_data=forecast_dict,
            date=datetime.now(TZ_HOBART)
        )
        
        print(f"✓ Formatted message ({len(result)} chars):")
        print("-"*40)
        print(result[:500])
        if len(result) > 500:
            print("...")
        print("-"*40)
        
        # Check SMS segments
        from app.services.sms import SMSCostCalculator
        segments = SMSCostCalculator.count_segments(result)
        print(f"✓ SMS segments: {segments}")
        
        return True
    except Exception as e:
        print(f"✗ Formatting error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_danger_rating():
    """Test 4: Danger rating calculation."""
    print("\n" + "="*50)
    print("TEST 4: Danger Rating")
    print("="*50)
    
    from app.services.danger import calculate_danger
    
    scenarios = [
        {"wind_max_kmh": 20, "rain_probability": 10, "precip_mm": 0, "temp_c": 15, "freezing_level": 2500},
        {"wind_max_kmh": 50, "rain_probability": 30, "precip_mm": 2, "temp_c": 10, "freezing_level": 1500},
        {"wind_max_kmh": 75, "rain_probability": 80, "precip_mm": 15, "temp_c": 2, "freezing_level": 900},
        {"wind_max_kmh": 95, "rain_probability": 90, "precip_mm": 25, "temp_c": -2, "freezing_level": 600},
    ]
    
    for i, s in enumerate(scenarios):
        rating = calculate_danger(**s)
        print(f"  Scenario {i+1}: Wind={s['wind_max_kmh']}km/h, Rain={s['precip_mm']}mm → {rating or 'OK'}")
    
    print("✓ Danger ratings calculated")
    return True


def test_command_parsing():
    """Test 5: Command parsing."""
    print("\n" + "="*50)
    print("TEST 5: Command Parsing")
    print("="*50)
    
    from app.services.commands import CommandParser
    
    parser = CommandParser(route_id="western_arthurs_full")
    
    commands = [
        "CAST LAKEO",
        "cast lakeo",
        "CHECKIN LAKEO",
        "CAST7",
        "PEAKS",
        "ALERTS ON",
        "SAFE +61400111222 Mum",
        "HELP",
        "KEY",
        "CANCEL",
    ]
    
    for cmd in commands:
        result = parser.parse(cmd)
        status = "✓" if result.is_valid else "✗"
        print(f"  {status} '{cmd}' → {result.command_type.value}")
    
    return True


def test_safecheck():
    """Test 6: SafeCheck service."""
    print("\n" + "="*50)
    print("TEST 6: SafeCheck Service")
    print("="*50)
    
    from app.services.safecheck import SafeCheckService, format_notification
    
    SafeCheckService.clear_all()
    
    user = "+61400000099"
    
    # Add contacts
    SafeCheckService.add_contact(user, "+61400111222", "Mum")
    SafeCheckService.add_contact(user, "+61400333444", "Dad")
    print(f"✓ Added 2 contacts")
    
    # Record checkin
    checkin = SafeCheckService.record_checkin(
        user_phone=user,
        camp_code="LAKEO",
        camp_name="Lake Oberon",
        gps_lat=-43.1486,
        gps_lon=146.2722
    )
    print(f"✓ Recorded check-in at {checkin.camp_name}")
    
    # Format notification
    msg = format_notification(
        user_name="Andrew",
        camp_name="Lake Oberon",
        gps_lat=-43.1486,
        gps_lon=146.2722,
        timestamp=datetime.now(TZ_HOBART)
    )
    print(f"✓ Notification ({len(msg)} chars):")
    print(msg)
    
    return True


async def run_all_tests():
    """Run all integration tests."""
    print("\n" + "="*50)
    print("THUNDERBIRD INTEGRATION TESTS")
    print(f"Time: {datetime.now(TZ_HOBART).strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*50)
    
    results = []
    
    results.append(("Route Loading", test_route_loading()))
    
    # Async test
    forecast = await test_weather_api()
    results.append(("Weather API", forecast is not None))
    
    results.append(("Forecast Formatting", test_forecast_formatting(forecast)))
    results.append(("Danger Rating", test_danger_rating()))
    results.append(("Command Parsing", test_command_parsing()))
    results.append(("SafeCheck", test_safecheck()))
    
    print("\n" + "="*50)
    print("RESULTS SUMMARY")
    print("="*50)
    
    passed = 0
    for name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"  {status}: {name}")
        if result:
            passed += 1
    
    print(f"\n{passed}/{len(results)} tests passed")
    
    return passed == len(results)


if __name__ == "__main__":
    success = asyncio.run(run_all_tests())
    sys.exit(0 if success else 1)
