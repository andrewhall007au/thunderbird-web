# Thunderbird Backend

SMS-based weather forecast service for multi-day hiking trails in Tasmania.

**Version:** 2.4.0  
**Spec:** [THUNDERBIRD_SPEC_v2.4.md](../docs/THUNDERBIRD_SPEC_v2.4.md)

## Features

- 🌤️ BOM weather forecasts with elevation adjustment
- 📱 SMS delivery via Twilio (or Cellcast)
- 🏔️ Route-specific forecasts (Western Arthurs, Overland Track)
- ⚡ Danger rating system (ice, wind, cloud, precip, thunder)
- 📍 Daily position check-ins with SafeCheck alerts
- 🧪 LIVETEST mode for accelerated testing

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

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI application
│   ├── models/
│   │   └── database.py      # SQLAlchemy models
│   └── services/
│       ├── bom.py           # BOM weather API
│       ├── sms.py           # Twilio SMS
│       ├── formatter.py     # SMS message formatting
│       ├── commands.py      # SMS command parser
│       └── routes.py        # Route configuration loader
├── config/
│   ├── settings.py          # Application settings
│   └── routes/              # Route JSON configs
│       ├── western_arthurs_ak.json
│       └── overland_track.json
├── scripts/
│   ├── init_db.py           # Database setup
│   ├── push_morning.py      # 6 AM forecast push
│   ├── send_checkins.py     # 5:30 PM check-in requests
│   └── push_evening.py      # 6 PM forecast push
├── tests/
│   └── test_services.py     # Pytest tests (32 passing)
├── requirements.txt
└── .env.example
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service health check |
| POST | `/webhook/sms/inbound` | Twilio SMS webhook |
| POST | `/api/forecast/push` | Trigger forecast push |
| GET | `/api/user/{phone}/status` | User subscription status |
| POST | `/api/user/{phone}/position` | Update user position |
| GET | `/api/routes` | List available routes |
| GET | `/api/routes/{route_id}` | Route details |
| GET | `/api/route/{route_id}/cells` | BOM cells for route |
| GET | `/api/forecast/{route_id}/{cell_id}` | Cell forecast |

## SMS Commands

| Command | Action |
|---------|--------|
| START | Begin registration |
| STOP | Cancel service |
| HELP | Show commands |
| STATUS | Subscription details |
| DELAY | Weather delay (+1 day) |
| EXTEND | Extend trip (+1 day) |
| RESEND | Resend last forecast |
| KEY | Column legend |
| ALERTS | BOM warnings |
| [CAMP] | Check in (e.g., LAKEO) |

## Cron Schedule (AEST/AEDT)

```cron
# Morning forecast
0 6 * * * python scripts/push_morning.py

# Check-in request
30 17 * * * python scripts/send_checkins.py

# Evening forecast
0 18 * * * python scripts/push_evening.py
```

## Testing

```bash
# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ -v --cov=app --cov-report=term-missing
```

## BOM Grid System

BOM cells are calculated from coordinates:

```python
row = int((-39.12 - lat) / 0.02)
col = int((lon - 142.75) / 0.03)
# Example: Lake Oberon (-43.1486, 146.2722) → Cell 201-117
```

## Environment Variables

See `.env.example` for all required variables:

- `DATABASE_URL` - PostgreSQL connection string
- `TWILIO_*` - Twilio credentials
- `BOM_API_KEY` - BOM API key
- `MOCK_BOM_API` - Use mock forecasts for testing

## License

TBD
