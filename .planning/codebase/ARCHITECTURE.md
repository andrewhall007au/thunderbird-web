# Architecture

**Analysis Date:** 2026-01-19

## Pattern Overview

**Overall:** Monorepo with separate Frontend (Next.js) and Backend (FastAPI) applications

**Key Characteristics:**
- SMS-first architecture: Backend processes SMS webhooks from Twilio as primary interface
- Pull-based forecast delivery: Users request weather forecasts via SMS commands
- Service-oriented backend: Domain services handle specific concerns (BOM, SMS, routes, onboarding)
- Static marketing frontend: Next.js App Router for public website, backend handles all business logic

## Layers

**Frontend (Marketing Website):**
- Purpose: Public-facing marketing website for trail information and user registration
- Location: `/Users/andrewhall/thunderbird-web/app/`
- Contains: Next.js App Router pages (TSX), static content pages
- Depends on: React, Tailwind CSS, lucide-react icons
- Used by: End users browsing trail info before registering via SMS

**Backend API Layer:**
- Purpose: FastAPI application handling all business logic and external integrations
- Location: `/Users/andrewhall/thunderbird-web/backend/app/main.py`
- Contains: HTTP endpoints, webhook handlers, scheduled tasks, admin interface
- Depends on: Services layer, Models layer, Config
- Used by: Twilio webhooks, Admin web interface, scheduled jobs

**Services Layer:**
- Purpose: Domain-specific business logic encapsulated in service classes
- Location: `/Users/andrewhall/thunderbird-web/backend/app/services/`
- Contains: BOM weather service, SMS service, command parser, onboarding manager, route loader, forecast formatter
- Depends on: Config, external APIs (BOM, Twilio)
- Used by: API layer (main.py endpoints)

**Models Layer:**
- Purpose: Data models and database access (SQLite persistence)
- Location: `/Users/andrewhall/thunderbird-web/backend/app/models/`
- Contains: User model, SQLiteUserStore, message logging
- Depends on: SQLite database file
- Used by: Services layer, API layer

**Configuration Layer:**
- Purpose: Application settings, route definitions, environment configuration
- Location: `/Users/andrewhall/thunderbird-web/backend/config/`
- Contains: Pydantic settings, route JSON files, weather zone config
- Depends on: Environment variables, JSON route files
- Used by: All backend layers

## Data Flow

**Inbound SMS Command Flow:**

1. Twilio receives SMS from user's satellite device
2. Twilio POSTs to `/webhook/sms/inbound` with form data (From, Body, MessageSid)
3. `handle_inbound_sms()` validates Twilio signature, normalizes phone
4. `CommandParser.parse()` identifies command type (CAST, HELP, START, etc.)
5. `process_command()` routes to appropriate handler
6. Handler calls services (BOM for weather, route loader for waypoint data)
7. `ForecastFormatter` generates SMS-optimized text response
8. TwiML response returned to Twilio for delivery

**Scheduled Push Flow (6AM/6PM forecasts):**

1. APScheduler triggers `push_morning_forecasts()` or `push_evening_forecasts()`
2. `user_store.list_users()` retrieves all registered users
3. Filter to users with active trips (start_date <= today <= end_date)
4. For each user: `push_forecast_to_user()` generates personalized forecast
5. `sms_service.send_message()` sends via Twilio API

**Onboarding Flow:**

1. User sends "START" SMS
2. `OnboardingManager.process_input()` creates session, returns name prompt
3. User replies with trail name
4. Manager prompts for route selection (1-6)
5. User selects route number
6. Registration saved to SQLite, quick start guide sent asynchronously

**State Management:**
- User state: SQLite database (`/Users/andrewhall/thunderbird-web/backend/thunderbird.db`)
- Onboarding sessions: In-memory dict in `OnboardingManager`
- Route configurations: Cached in `RouteLoader._cache` after first load from JSON

## Key Abstractions

**Route:**
- Purpose: Represents a hiking route with camps, peaks, and metadata
- Examples: `/Users/andrewhall/thunderbird-web/backend/config/routes/western_arthurs_ak.json`
- Pattern: Dataclass loaded from JSON, cached in RouteLoader

**Waypoint (Camp/Peak):**
- Purpose: Geographic point on a route with coordinates, elevation, weather zone
- Examples: LAKEO (Lake Oberon), SCOTT (Scotts Peak)
- Pattern: Dataclass with lat/lon, elevation, bom_cell identifier

**CellForecast / ForecastPeriod:**
- Purpose: Weather forecast data from BOM API grouped by time period
- Examples: Hourly temps, wind, precipitation, freezing level
- Pattern: Dataclass with typed forecast fields, list of periods

**ParsedCommand:**
- Purpose: Result of parsing raw SMS text into structured command
- Examples: CAST LAKEO -> CommandType.CAST with args["location_code"]="LAKEO"
- Pattern: Dataclass with command_type enum, args dict, validation status

**User:**
- Purpose: Registered hiker with route, position, SafeCheck contacts
- Examples: +61412345678 on western_arthurs_ak
- Pattern: Dataclass persisted to SQLite via SQLiteUserStore

## Entry Points

**Backend API Server:**
- Location: `/Users/andrewhall/thunderbird-web/backend/app/main.py`
- Triggers: uvicorn startup, Procfile for deployment
- Responsibilities: Initialize FastAPI app, register routes, start scheduler

**Twilio Webhook:**
- Location: `/Users/andrewhall/thunderbird-web/backend/app/main.py` line 476 (`/webhook/sms/inbound`)
- Triggers: Twilio POST on incoming SMS
- Responsibilities: Validate signature, parse command, generate response

**Admin Interface:**
- Location: `/Users/andrewhall/thunderbird-web/backend/app/main.py` line 1368 (`/admin`)
- Triggers: Browser navigation with session cookie
- Responsibilities: User management, manual forecast push, SMS testing

**Scheduled Jobs:**
- Location: `/Users/andrewhall/thunderbird-web/backend/app/main.py` line 341 (lifespan)
- Triggers: APScheduler cron at 6AM, 6PM, hourly
- Responsibilities: Morning/evening forecast push, overdue user check

**Frontend Website:**
- Location: `/Users/andrewhall/thunderbird-web/app/page.tsx`
- Triggers: HTTP requests to Next.js server
- Responsibilities: Marketing pages, trail information

## Error Handling

**Strategy:** Try/except with logging at service boundaries, graceful degradation for external APIs

**Patterns:**
- BOM API failures: Fall back to Open-Meteo API (configured in `/Users/andrewhall/thunderbird-web/backend/app/services/bom.py`)
- Twilio failures: Log error, retry up to 3 times with exponential backoff
- Invalid commands: Return helpful error message via TwiML
- Database errors: Log and propagate, let FastAPI return 500
- Scheduled job failures: Log per-user errors, continue processing remaining users

## Cross-Cutting Concerns

**Logging:**
- JSON structured logging via Python logging module
- Log level from settings.LOG_LEVEL environment variable
- Phone numbers masked in logs via `PhoneUtils.mask()`

**Validation:**
- Pydantic models for request/response validation in API layer
- `PhoneUtils.normalize()` for phone number validation
- `CommandParser.parse()` validates command syntax and returns error messages

**Authentication:**
- Admin interface: Session-based with password check against ADMIN_PASSWORD env var
- Twilio webhook: Signature validation in production mode
- API endpoints: No authentication (public routes for health/info)

---

*Architecture analysis: 2026-01-19*
