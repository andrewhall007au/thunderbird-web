# External Integrations

**Analysis Date:** 2026-01-19

## APIs & External Services

**Weather Data (Primary):**
- Bureau of Meteorology (BOM) - Undocumented API
  - Base URL: `https://api.weather.bom.gov.au/v1`
  - Auth: None required (User-Agent header needed)
  - Client: httpx async client (`/backend/app/services/bom.py`)
  - Uses geohash for location lookups
  - Provides: temp, rain, wind (avg + gusts)

**Weather Data (Fallback):**
- Open-Meteo API
  - Forecast URL: `https://api.open-meteo.com/v1/forecast`
  - Elevation URL: `https://api.open-meteo.com/v1/elevation`
  - Auth: None required (fully open)
  - Client: httpx async client (`/backend/app/services/bom.py`)
  - Provides: freezing_level, snowfall, cloud_cover, 7-day forecasts

**SMS (Primary):**
- Twilio
  - SDK: twilio >=8.10.0
  - Client: `/backend/app/services/sms.py`
  - Auth: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
  - From Number: `TWILIO_PHONE_NUMBER`
  - Features: Send SMS, webhook validation, signature verification

**SMS (Alternative - Configured):**
- Cellcast
  - Auth: `CELLCAST_API_KEY`
  - Sender: `CELLCAST_SENDER_ID` (default: "Thunderbird")
  - Status: Configured in settings, not actively implemented

## Data Storage

**Database (Active):**
- SQLite
  - Path: `THUNDERBIRD_DB_PATH` or `thunderbird.db`
  - Client: Python sqlite3 module (direct, no ORM)
  - Schema: `/backend/app/models/database.py`

**Database (Configured, Inactive):**
- PostgreSQL
  - Connection: `DATABASE_URL` env var
  - Driver: asyncpg (in requirements)
  - Status: Not actively used, SQLite preferred

**File Storage:**
- Local filesystem only
- Route configs: JSON files in `/backend/config/routes/`
- Database: SQLite file in backend directory

**Caching:**
- Redis (configured but not implemented)
  - Connection: `REDIS_URL` (default: `redis://localhost:6379/0`)
  - Driver: redis >=5.0.0 (in requirements)
  - Status: TTL settings exist, no active cache layer
  - Planned for: BOM forecast caching (6hr TTL, 12hr max age)

## Authentication & Identity

**User Auth:**
- SMS-based registration
- Phone number as primary identifier
- No password/OAuth - commands sent via SMS

**Admin Auth:**
- Password-based session authentication
- Password: `ADMIN_PASSWORD` env var
- Session secret: `ADMIN_SESSION_SECRET` env var
- Cookie-based sessions (24hr expiry)
- Implementation: `/backend/app/services/admin.py`

**Webhook Auth:**
- Twilio signature validation
- X-Twilio-Signature header verification
- Enabled in production (bypassed when DEBUG=True)

## Monitoring & Observability

**Error Tracking:**
- Sentry (optional)
  - DSN: `SENTRY_DSN` env var
  - Status: Configured in settings, not imported/used in code

**Logs:**
- JSON-formatted structured logging
- python-json-logger for format
- Log level: `LOG_LEVEL` env var (default: INFO)
- systemd journal for production (`journalctl -u thunderbird`)

**Health Check:**
- Endpoint: `GET /health`
- Returns: service status, timestamp, version
- Checks: database, redis, bom_api, twilio (status stubs)

## CI/CD & Deployment

**Hosting:**
- DigitalOcean Droplet
- Ubuntu 24.04
- nginx reverse proxy
- systemd service: `/backend/deploy/thunderbird.service`

**CI Pipeline:**
- GitHub Actions (`.github/workflows/deploy.yml`)
- Triggers: push/PR to main branch
- Steps: pytest tests, SCP deploy, service restart, smoke tests

**Setup Scripts:**
- `/backend/deploy/setup-droplet.sh` - Initial server setup
- `/backend/deploy/update.sh` - Update deployment

## Environment Configuration

**Required env vars:**
```
TWILIO_ACCOUNT_SID      # Twilio authentication
TWILIO_AUTH_TOKEN       # Twilio authentication
TWILIO_PHONE_NUMBER     # SMS sender number
```

**Optional env vars:**
```
ADMIN_PASSWORD          # Admin panel access (default: changeme)
ADMIN_SESSION_SECRET    # Session signing key
ADMIN_PHONE             # Receives new registration alerts
DATABASE_URL            # PostgreSQL (unused, SQLite active)
REDIS_URL               # Caching (unused)
SENTRY_DSN              # Error tracking (unused)
THUNDERBIRD_DB_PATH     # SQLite file location
ENVIRONMENT             # development/staging/production
DEBUG                   # Enable debug mode
LOG_LEVEL               # Logging verbosity
MOCK_BOM_API            # Use mock weather data
LIVETEST_ENABLED        # Enable live testing mode
```

**Secrets Location:**
- `.env` file in `/backend/` directory
- GitHub Secrets for deployment:
  - `SERVER_HOST`
  - `SERVER_USER`
  - `SERVER_SSH_KEY`

## Webhooks & Callbacks

**Incoming:**
- `POST /webhook/sms/inbound` - Twilio SMS webhook
  - Receives inbound SMS from users
  - Returns TwiML XML response
  - Validates Twilio signature in production

**Outgoing:**
- None - SMS sent directly via Twilio API
- Admin notifications sent to `ADMIN_PHONE` on new registrations

## Scheduled Jobs

**APScheduler Jobs (when available):**
- `push_morning_forecasts` - 6:00 AM AEDT/AEST
- `push_evening_forecasts` - 6:00 PM AEDT/AEST
- `check_overdue_users` - Every hour at :30

**Timezone:**
- All scheduling in `Australia/Hobart` timezone
- Configured via `TIMEZONE` setting

## Rate Limits & Quotas

**Configured Limits:**
- `MAX_CONCURRENT_USERS`: 500
- `MAX_SMS_PER_DAY`: 2000
- `MAX_BOM_CALLS_PER_DAY`: 500
- `RATE_LIMIT_SMS_PER_PHONE_PER_HOUR`: 10
- `RATE_LIMIT_API_PER_IP_PER_MINUTE`: 60

**SMS Delivery:**
- Inter-message delay: 2.5 seconds
- Batch gap: 5.0 seconds
- Retry delay: 30.0 seconds
- Max retries: 3

**Costs (configured):**
- Twilio: $0.055 AUD per segment
- Cellcast: $0.029 AUD per segment

---

*Integration audit: 2026-01-19*
