# Thunderbird Backend

SMS-based weather forecast service for multi-day hiking trails in Tasmania.

**Version:** 3.0.0
**Spec:** [THUNDERBIRD_SPEC_v2.4.md](../docs/THUNDERBIRD_SPEC_v2.4.md)

## Features

- BOM weather forecasts with elevation adjustment
- SMS delivery via Twilio (or Cellcast)
- Route-specific forecasts (Western Arthurs, Overland Track, + 4 more)
- Danger rating system (ice, wind, cloud, precip, thunder)
- Daily position check-ins with SafeCheck alerts
- LIVETEST mode for accelerated testing

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Copy environment config
cp .env.example .env
# Edit .env with your credentials

# Initialize database
python scripts/init_db.py

# Run development server
uvicorn app.main:app --reload
```

## Monitoring

The monitoring system is configured for beta phase with reduced check frequencies.

**Current Configuration (Beta):**
- Weather API checks: Hourly (tests BOM, NWS, Open-Meteo directly)
- Database performance: Every 15 minutes
- External APIs: Every 30 minutes
- Stripe/Twilio: Skipped when not configured

**See:**
- `.planning/MONITORING_FIXES_2026-02-07.md` - Recent configuration changes
- `.planning/FUTURE-PHASE-beta-to-retail.md` - Retail monitoring requirements
- `monitoring/config.py` - Configuration file

**⚠️ Action Required for Retail Launch:**
Review and update monitoring intervals and thresholds before going to production.

## Project Structure

```
backend/
app/
    main.py              # FastAPI application (lifecycle + scheduler)
    routers/             # API route modules
        __init__.py
        webhook.py       # /webhook/* - Twilio SMS handlers
        admin.py         # /admin/* - Admin dashboard
        api.py           # /api/* - Public API endpoints
    models/
        database.py      # SQLite user store
    services/
        # Core services
        bom.py           # BOM weather API client
        sms.py           # Twilio SMS sending
        formatter.py     # SMS message formatting
        commands.py      # SMS command parser
        routes.py        # Route configuration loader
        onboarding.py    # User registration flow
        forecast.py      # Forecast generation
        pricing.py       # SMS cost calculations
        danger.py        # Danger rating calculator
        admin.py         # Admin interface rendering
        safecheck.py     # Emergency contact alerts

        # Future phase stubs
        payments.py      # Phase 2: Stripe integration
        route_builder.py # Phase 3: Custom route creation
        affiliates.py    # Phase 5: Partner program
        weather_intl.py  # Phase 6: Multi-country weather
config/
    settings.py          # Pydantic application settings
    routes/              # Route JSON configurations
        western_arthurs_ak.json
        western_arthurs_full.json
        overland_track.json
        eastern_arthurs.json
        federation_peak.json
        combined_arthurs.json
scripts/
    init_db.py           # Database setup
    push_morning.py      # 6 AM forecast push
    push_evening.py      # 6 PM forecast push
    cost_monitor.py      # SMS cost tracking
tests/
    conftest.py          # Pytest fixtures
    test_validation.py   # Main validation tests (100 tests)
    test_services.py     # Service unit tests
    test_v3_*.py         # v3 feature tests
```

## API Endpoints

### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service health check |

### Webhook (Twilio)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/webhook/sms/inbound` | Twilio SMS webhook |

### Admin (Password Protected)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin` | Admin dashboard |
| POST | `/admin/login` | Admin login |
| POST | `/admin/register` | Register beta user |
| POST | `/admin/delete/{phone}` | Delete user |
| POST | `/admin/push/{phone}` | Push forecast to user |
| POST | `/admin/test-sms` | Send test SMS |
| GET | `/admin/api/grouping-stats` | Grouping statistics JSON |

### Public API
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/forecast/push` | Trigger forecast push |
| POST | `/api/forecast/test-push/{phone}` | Test push to specific user |
| GET | `/api/user/{phone}/status` | User subscription status |
| POST | `/api/user/{phone}/position` | Update user position |
| GET | `/api/routes` | List available routes |
| GET | `/api/routes/{route_id}` | Route details |
| GET | `/api/route/{route_id}/cells` | BOM cells for route |
| GET | `/api/forecast/{route_id}/{cell_id}` | Cell forecast |

## SMS Commands (v3.3)

| Command | Action |
|---------|--------|
| START | Begin registration |
| STOP | Cancel service |
| HELP | Show commands |
| KEY | Column legend |
| CAST {code} | 12hr hourly forecast |
| CAST24 {code} | 24hr hourly forecast |
| CAST7 {code} | 7-day forecast for location |
| CAST7 CAMPS | 7-day all camps (grouped) |
| CAST7 PEAKS | 7-day all peaks (grouped) |
| **CAST -41.89,146.08** | **12hr forecast for any GPS point** |
| **CAST24 -41.89,146.08** | **24hr forecast for any GPS point** |
| CHECKIN {code} | Check in at camp |
| SAFE +61... Name | Add SafeCheck contact |
| SAFELIST | List contacts |
| SAFEDEL +61... | Remove contact |
| ALERTS ON/OFF | Toggle BOM alerts |
| ROUTE | Show route info |

### GPS Coordinate Formats

GPS coordinates can be specified in multiple formats:
- Comma-separated: `CAST -41.8921,146.0820`
- Space-separated: `CAST -41.8921 146.0820`
- Cardinal directions: `CAST 41.8921S,146.0820E`

## Scheduled Jobs

APScheduler runs these jobs in the FastAPI lifespan:

| Time | Job | Description |
|------|-----|-------------|
| 6:00 AM | Morning Push | Hourly forecast for today |
| 6:00 PM | Evening Push | 7-day outlook |
| :30 past hour | Overdue Check | Alert SafeCheck contacts |

## Testing

```bash
# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ -v --cov=app --cov-report=term-missing

# Current: 280 passed, 6 skipped, 1 xfailed
```

## Weather Providers

### Provider Resolution by Region

| Provider | Grid Resolution | Coverage |
|----------|----------------|----------|
| BOM ACCESS-C | ~4km | Australian cities/populated areas |
| BOM ACCESS-G | ~12km | All of Australia |
| Open-Meteo AROME | 1.5-2.5km | France |
| Open-Meteo ICON-EU | 7km | Europe (incl. Switzerland, Italy) |
| Open-Meteo GFS | ~25km | Global fallback |
| NWS | ~2.5km | United States |
| Environment Canada | ~10km | Canada |
| Met Office | ~1.5km | United Kingdom |

### International Routing

The weather router (`app/services/weather/router.py`) maps countries to providers:

| Country | Primary Provider | Fallback |
|---------|-----------------|----------|
| AU | BOM | Open-Meteo |
| US | NWS | Open-Meteo |
| CA | Environment Canada | Open-Meteo |
| GB | Met Office | Open-Meteo |
| FR | Open-Meteo (Meteo-France model) | - |
| CH, IT | Open-Meteo (ICON-EU model) | - |
| NZ, ZA | Open-Meteo (best_match) | - |
| Other | Open-Meteo (best_match) | - |

## Elevation Adjustment

All forecasts apply lapse rate adjustment to account for elevation differences between the weather grid cell and the actual waypoint.

### How It Works

1. **Get grid elevation** via Open-Meteo Elevation API - returns DEM terrain elevation
2. **Weather APIs** provide temps at 2m height above the grid cell's average terrain elevation
3. **Lapse rate adjustment** applied in formatter:
   ```python
   elevation_diff = waypoint_elevation - grid_elevation
   temp_adjustment = elevation_diff × 0.65°C per 100m
   ```

### Example

For a camp at 1200m where grid cell average is 900m:
- `elevation_diff = 1200 - 900 = 300m`
- `temp_adjustment = 300 × 0.0065 = 1.95°C cooler`

### GPS Points

For GPS coordinate requests, the grid elevation IS the target elevation, so no additional adjustment is needed - the forecast is already for that exact point's elevation.

## Weather Zone System

Weather zones are Thunderbird's internal grouping system (~2.2km × 2.5km cells) to reduce API calls by grouping nearby waypoints. BOM uses geohash for actual API lookups.

```python
row = int((-39.12 - lat) / 0.02)
col = int((lon - 142.75) / 0.03)
# Example: Lake Oberon (-43.1486, 146.2722) -> Zone 201-117
```

## Environment Variables

See `.env.example` for all required variables:

- `DATABASE_URL` - SQLite/PostgreSQL connection string
- `TWILIO_*` - Twilio credentials
- `MOCK_BOM_API` - Use mock forecasts for testing
- `ADMIN_PASSWORD` - Admin dashboard password
- `LOG_LEVEL` - Logging level (INFO, DEBUG)

## Architecture Notes

### Router Modules

Routes are organized into logical APIRouter modules:

- `webhook.py`: SMS command processing, onboarding flow, SafeCheck notifications
- `admin.py`: Dashboard, user management, manual push triggers
- `api.py`: Public route/forecast APIs, health checks

### Service Stubs

Phase 2-6 services are stubbed out with:
- Typed dataclasses for data models
- Singleton factory functions
- NotImplementedError placeholders with phase documentation

This enables parallel development and clear interface contracts.

## License

TBD
