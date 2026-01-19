# Codebase Structure

**Analysis Date:** 2026-01-19

## Directory Layout

```
thunderbird-web/
├── app/                     # Next.js frontend (App Router)
│   ├── layout.tsx           # Root layout with nav/footer
│   ├── page.tsx             # Landing page
│   ├── globals.css          # Tailwind global styles
│   ├── trails/              # Trail info pages
│   │   ├── western-arthurs/
│   │   └── overland-track/
│   ├── contact/
│   ├── faq/
│   ├── how-it-works/
│   ├── pricing/
│   ├── privacy/
│   ├── register/
│   ├── safety/
│   └── terms/
├── backend/                 # FastAPI backend
│   ├── app/                 # Application code
│   │   ├── main.py          # FastAPI app, endpoints, scheduled jobs
│   │   ├── models/          # Data models
│   │   │   └── database.py  # SQLite store, User model
│   │   └── services/        # Business logic
│   │       ├── admin.py     # Admin interface rendering
│   │       ├── bom.py       # Weather API client
│   │       ├── commands.py  # SMS command parser
│   │       ├── danger.py    # Danger rating calculator
│   │       ├── forecast.py  # Forecast generation
│   │       ├── formatter.py # SMS message formatting
│   │       ├── onboarding.py# User registration flow
│   │       ├── pricing.py   # SMS cost calculations
│   │       ├── routes.py    # Route/waypoint loader
│   │       ├── safecheck.py # Emergency contact alerts
│   │       ├── sms.py       # Twilio SMS service
│   │       └── user.py      # User service helpers
│   ├── config/              # Configuration
│   │   ├── settings.py      # Pydantic settings, env vars
│   │   └── routes/          # Route JSON definitions
│   │       ├── western_arthurs_ak.json
│   │       ├── western_arthurs_full.json
│   │       ├── overland_track.json
│   │       ├── eastern_arthurs.json
│   │       ├── federation_peak.json
│   │       └── combined_arthurs.json
│   ├── scripts/             # Standalone utility scripts
│   │   ├── cost_monitor.py  # SMS cost tracking
│   │   ├── forecast_7day.py # Manual forecast generation
│   │   ├── init_db.py       # Database initialization
│   │   ├── push_morning.py  # Manual morning push
│   │   ├── push_evening.py  # Manual evening push
│   │   └── send_checkins.py # Test check-in notifications
│   ├── tests/               # Backend tests
│   │   ├── conftest.py      # Pytest fixtures
│   │   ├── test_validation.py
│   │   ├── test_services.py
│   │   ├── test_spec_alignment.py
│   │   ├── test_v3_*.py     # v3 feature tests
│   │   └── smoke_test_server.py
│   ├── deploy/              # Deployment configs
│   │   ├── setup-droplet.sh # Digital Ocean setup
│   │   ├── thunderbird.service # systemd service
│   │   └── update.sh        # Deployment update script
│   ├── requirements.txt     # Python dependencies
│   ├── Procfile             # Heroku/DO App Platform
│   ├── runtime.txt          # Python version
│   └── thunderbird.db       # SQLite database (local)
├── .github/
│   └── workflows/
│       └── deploy.yml       # GitHub Actions deployment
├── package.json             # Frontend dependencies
├── tsconfig.json            # TypeScript config
├── tailwind.config.js       # Tailwind CSS config
├── next.config.js           # Next.js config
└── README.md                # Frontend documentation
```

## Directory Purposes

**`/app/` (Frontend):**
- Purpose: Next.js App Router pages for marketing website
- Contains: Page components (page.tsx), layout (layout.tsx), CSS
- Key files: `layout.tsx` (nav/footer), `page.tsx` (landing)

**`/backend/app/` (Backend Application):**
- Purpose: FastAPI application core
- Contains: Main app entry, models, services
- Key files: `main.py` (1685 lines - endpoints + scheduled jobs)

**`/backend/app/services/`:**
- Purpose: Domain services encapsulating business logic
- Contains: One file per domain concern
- Key files: `bom.py` (weather), `sms.py` (Twilio), `commands.py` (parser), `formatter.py` (SMS formatting)

**`/backend/app/models/`:**
- Purpose: Data models and database access
- Contains: SQLite user store, model definitions
- Key files: `database.py` (User, SafeCheckContact, SQLiteUserStore)

**`/backend/config/`:**
- Purpose: Application configuration and route definitions
- Contains: Pydantic settings, route JSON files
- Key files: `settings.py`, `routes/*.json`

**`/backend/tests/`:**
- Purpose: Backend pytest test suite
- Contains: Unit tests, integration tests, smoke tests
- Key files: `test_validation.py`, `test_v3_cast_commands.py`

**`/backend/scripts/`:**
- Purpose: Standalone utility scripts for operations
- Contains: Manual trigger scripts, monitoring tools
- Key files: `cost_monitor.py`, `push_morning.py`

**`/backend/deploy/`:**
- Purpose: Production deployment configuration
- Contains: systemd service, setup scripts
- Key files: `thunderbird.service`, `setup-droplet.sh`

## Key File Locations

**Entry Points:**
- `/Users/andrewhall/thunderbird-web/backend/app/main.py`: Backend FastAPI application
- `/Users/andrewhall/thunderbird-web/app/page.tsx`: Frontend landing page

**Configuration:**
- `/Users/andrewhall/thunderbird-web/backend/config/settings.py`: All app settings (Pydantic)
- `/Users/andrewhall/thunderbird-web/backend/.env`: Environment secrets (not committed)
- `/Users/andrewhall/thunderbird-web/backend/config/routes/*.json`: Route definitions

**Core Logic:**
- `/Users/andrewhall/thunderbird-web/backend/app/services/bom.py`: Weather API integration
- `/Users/andrewhall/thunderbird-web/backend/app/services/sms.py`: Twilio SMS sending
- `/Users/andrewhall/thunderbird-web/backend/app/services/commands.py`: SMS command parsing
- `/Users/andrewhall/thunderbird-web/backend/app/services/formatter.py`: Forecast message formatting
- `/Users/andrewhall/thunderbird-web/backend/app/services/onboarding.py`: User registration state machine

**Data Storage:**
- `/Users/andrewhall/thunderbird-web/backend/app/models/database.py`: SQLite user store
- `/Users/andrewhall/thunderbird-web/backend/thunderbird.db`: SQLite database file

**Testing:**
- `/Users/andrewhall/thunderbird-web/backend/tests/conftest.py`: Pytest fixtures
- `/Users/andrewhall/thunderbird-web/backend/tests/test_validation.py`: Main validation tests

## Naming Conventions

**Files:**
- Python: `snake_case.py` (e.g., `forecast_formatter.py`)
- TypeScript: `page.tsx` for pages, `layout.tsx` for layouts
- JSON config: `route_name.json` (e.g., `western_arthurs_ak.json`)
- Tests: `test_*.py` prefix

**Directories:**
- Frontend routes: `kebab-case` (e.g., `how-it-works/`)
- Backend modules: `snake_case` (e.g., `app/services/`)

**Python Classes:**
- Services: `{Domain}Service` (e.g., `BOMService`, `SMSService`)
- Models: `PascalCase` (e.g., `User`, `Waypoint`, `Route`)
- Managers: `{Domain}Manager` (e.g., `OnboardingManager`)

**Route/Waypoint Codes:**
- Camp codes: 5-char uppercase (e.g., `LAKEO`, `SCOTT`, `JUNCT`)
- Peak codes: 5-char uppercase (e.g., `ALPHA`, `KAPPA`)
- Route IDs: `snake_case` (e.g., `western_arthurs_ak`)

## Where to Add New Code

**New SMS Command:**
1. Add `CommandType` enum value in `/Users/andrewhall/thunderbird-web/backend/app/services/commands.py`
2. Add parsing logic in `CommandParser.parse()` method
3. Add handler in `process_command()` in `/Users/andrewhall/thunderbird-web/backend/app/main.py`
4. Add tests in `/Users/andrewhall/thunderbird-web/backend/tests/test_v3_cast_commands.py`

**New Service:**
- Implementation: `/Users/andrewhall/thunderbird-web/backend/app/services/{service_name}.py`
- Import and use in main.py or other services

**New Route/Trail:**
1. Add JSON file: `/Users/andrewhall/thunderbird-web/backend/config/routes/{route_id}.json`
2. Add to ROUTE_MENU in `/Users/andrewhall/thunderbird-web/backend/app/services/onboarding.py`
3. Add frontend page: `/Users/andrewhall/thunderbird-web/app/trails/{trail-name}/page.tsx`

**New API Endpoint:**
- Add in `/Users/andrewhall/thunderbird-web/backend/app/main.py` with `@app.get()` or `@app.post()` decorator
- Group with related endpoints using comments (see existing sections)

**New Scheduled Job:**
- Add function in `/Users/andrewhall/thunderbird-web/backend/app/main.py`
- Register in `lifespan()` function using `scheduler.add_job()`

**New Frontend Page:**
- Create directory: `/Users/andrewhall/thunderbird-web/app/{page-name}/`
- Add `page.tsx` inside with exported default component

**Utilities/Helpers:**
- Backend: Add to relevant service file or create new service
- Scripts: `/Users/andrewhall/thunderbird-web/backend/scripts/{script_name}.py`

## Special Directories

**`/backend/venv/`:**
- Purpose: Python virtual environment
- Generated: Yes (via `python -m venv venv`)
- Committed: No (in .gitignore)

**`/node_modules/`:**
- Purpose: Frontend npm dependencies
- Generated: Yes (via `npm install`)
- Committed: No (in .gitignore)

**`/.next/`:**
- Purpose: Next.js build output
- Generated: Yes (via `npm run build`)
- Committed: No (in .gitignore)

**`/backend/__pycache__/`:**
- Purpose: Python bytecode cache
- Generated: Yes (automatic)
- Committed: No (in .gitignore)

**`/backend/thunderbird.db`:**
- Purpose: SQLite database (user data, message logs)
- Generated: Yes (on first run)
- Committed: No (contains user data)

**`/.planning/`:**
- Purpose: GSD planning and analysis documents
- Generated: Yes (by Claude Code)
- Committed: Yes (project documentation)

---

*Structure analysis: 2026-01-19*
