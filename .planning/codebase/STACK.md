# Technology Stack

**Analysis Date:** 2026-01-19

## Languages

**Primary:**
- TypeScript ^5 - Next.js frontend (`/app/**/*.tsx`)
- Python 3.11 - FastAPI backend (`/backend/**/*.py`)

**Secondary:**
- JavaScript (ES5 target) - Compiled TypeScript output
- JSON - Route configuration files (`/backend/config/routes/*.json`)

## Runtime

**Frontend Environment:**
- Node.js (version not pinned, modern assumed)
- Next.js 14.1.0 server runtime

**Backend Environment:**
- Python 3.11 (specified in `/backend/runtime.txt`)
- Uvicorn ASGI server

**Package Managers:**
- npm (frontend) - no lockfile present
- pip (backend) - no lockfile, uses `requirements.txt`

## Frameworks

**Core:**
- Next.js 14.1.0 - React-based frontend framework with App Router
- FastAPI >=0.109.0 - Python async web framework
- React ^18 - UI component library

**Styling:**
- Tailwind CSS ^3.4.1 - Utility-first CSS framework
- PostCSS ^8 - CSS processing
- Autoprefixer ^10.0.1 - CSS vendor prefixes

**Validation/Data:**
- Pydantic >=2.5.0 - Data validation and settings management
- pydantic-settings >=2.1.0 - Environment configuration

**Testing:**
- pytest >=7.4.0 - Python test framework
- pytest-asyncio >=0.23.0 - Async test support
- pytest-cov >=4.1.0 - Coverage reporting

**Build/Dev:**
- TypeScript ^5 - Type checking
- black >=23.12.0 - Python code formatter
- isort >=5.13.0 - Python import sorter
- mypy >=1.8.0 - Python static type checker

## Key Dependencies

**Critical (Backend):**
- twilio >=8.10.0 - SMS sending/receiving via Twilio API
- httpx >=0.26.0 - Async HTTP client for BOM/Open-Meteo APIs
- geohash2 >=1.1, pygeohash >=1.2.0 - Location encoding for weather API
- astral >=3.2 - Sunrise/sunset calculations for Tasmania

**Infrastructure (Backend):**
- SQLAlchemy >=2.0.25 - ORM (configured but SQLite used directly)
- asyncpg >=0.29.0 - PostgreSQL async driver (in requirements, not active)
- alembic >=1.13.0 - Database migrations (available but SQLite used)
- redis >=5.0.0 - Caching (in requirements, not actively used)
- apscheduler >=3.10.0 - Scheduled job execution (6AM/6PM forecasts)

**Frontend:**
- lucide-react ^0.330.0 - Icon library
- react-dom ^18 - React DOM rendering

**Utility (Backend):**
- python-dateutil >=2.8.2 - Date/time parsing
- python-dotenv >=1.0.0 - Environment file loading
- python-multipart >=0.0.6 - Form data parsing
- python-json-logger >=2.0.7 - JSON log formatting

## Configuration

**Environment:**
- Backend uses `.env` files loaded via pydantic-settings
- Frontend uses Next.js environment handling
- Key config in `/backend/config/settings.py`

**Required Environment Variables:**
```
# Twilio (required for SMS)
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER

# Optional
DATABASE_URL (default: postgresql://localhost:5432/thunderbird)
REDIS_URL (default: redis://localhost:6379/0)
ADMIN_PASSWORD (default: changeme)
ADMIN_SESSION_SECRET
SENTRY_DSN (optional monitoring)
ADMIN_PHONE (for registration notifications)
THUNDERBIRD_DB_PATH (default: thunderbird.db)
```

**Build Configuration:**
- `/tsconfig.json` - TypeScript with strict mode, bundler resolution
- `/next.config.js` - React strict mode enabled
- `/tailwind.config.js` - Custom theme colors (thunder, storm, lightning, danger)
- `/postcss.config.js` - Tailwind and autoprefixer plugins

**Path Aliases:**
- `@/*` maps to `./*` (TypeScript paths)

## Platform Requirements

**Development:**
- Node.js (modern LTS recommended)
- Python 3.11+
- SQLite (bundled with Python)

**Production:**
- DigitalOcean Droplet (Ubuntu 24.04)
- nginx reverse proxy
- systemd service management
- certbot for HTTPS

**Deployment:**
- GitHub Actions CI/CD (`.github/workflows/deploy.yml`)
- SCP-based deployment to VPS
- Tests run before deploy (pytest)

## Database

**Active:**
- SQLite - File-based storage (`thunderbird.db`)
- Schema defined in `/backend/app/models/database.py`

**Tables:**
- `users` - Registered hikers
- `safecheck_contacts` - Emergency contacts per user
- `message_log` - SMS analytics and audit trail

**Configured but Unused:**
- PostgreSQL (asyncpg driver in requirements)
- Redis (caching driver in requirements)

---

*Stack analysis: 2026-01-19*
