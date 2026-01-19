# Codebase Concerns

**Analysis Date:** 2026-01-19

## Tech Debt

**Incomplete Script Implementations:**
- Issue: Several push scripts have TODO placeholders returning empty arrays
- Files: `backend/scripts/push_morning.py`, `backend/scripts/push_evening.py`, `backend/scripts/send_checkins.py`
- Impact: Scheduled morning/evening forecast push functionality is incomplete
- Fix approach: Implement database queries to fetch active users, currently returns `[]` at lines 42, 41, 37 respectively

**Health Check Stubs:**
- Issue: Health endpoint returns hardcoded "ok" for all services
- Files: `backend/app/main.py` (lines 425-427)
- Impact: Monitoring cannot detect actual service failures
- Fix approach: Implement actual connection checks for database, Redis, BOM API

**Duplicate Onboarding Classes:**
- Issue: Two onboarding implementations exist (OnboardingManager and OnboardingFlow)
- Files: `backend/app/services/onboarding.py`
- Impact: Confusion about which implementation to use, potential divergence
- Fix approach: Remove legacy OnboardingFlow class (lines 473-644) if OnboardingManager is canonical

**Missing Forward Summary:**
- Issue: Forward summary for morning forecasts has `pass  # TODO`
- Files: `backend/scripts/push_morning.py` (line 97)
- Impact: Morning forecasts don't include forward camp summaries
- Fix approach: Implement forward camp weather aggregation

**In-Memory Session Storage:**
- Issue: Onboarding sessions stored in Python dict `_sessions`
- Files: `backend/app/services/onboarding.py` (line 101)
- Impact: Sessions lost on server restart, doesn't scale horizontally
- Fix approach: Move to SQLite or Redis for session persistence

## Known Bugs

**API Endpoint Stubs:**
- Symptoms: `/api/user/{phone}/status` returns 404 for all users
- Files: `backend/app/main.py` (lines 1193-1202)
- Trigger: Any call to get user status endpoint
- Workaround: None - endpoint non-functional

**Position Update Incomplete:**
- Symptoms: `/api/user/{phone}/position` returns success but doesn't validate
- Files: `backend/app/main.py` (lines 1210-1219)
- Trigger: Calling position update API
- Workaround: Use SMS check-in instead

**Bare Exception Handling:**
- Symptoms: Silent failures in `scripts/forecast_7day.py`
- Files: `backend/scripts/forecast_7day.py` (lines 51, 132)
- Trigger: Any exception during forecast generation
- Workaround: Check logs manually - errors silently swallowed

## Security Considerations

**Default Admin Credentials:**
- Risk: Default password "changeme" and weak session secret in config
- Files: `backend/config/settings.py` (lines 78-79)
- Current mitigation: Comment says "MUST change in production"
- Recommendations: Add startup check that fails if defaults unchanged in production

**CORS Wildcard:**
- Risk: `allow_origins=["*"]` accepts requests from any domain
- Files: `backend/app/main.py` (line 400)
- Current mitigation: Comment says "Configure appropriately for production"
- Recommendations: Set explicit allowed origins in production

**Twilio Signature Bypass:**
- Risk: Signature validation skipped when `DEBUG=true`
- Files: `backend/app/main.py` (line 490)
- Current mitigation: Should not run with DEBUG in production
- Recommendations: Log warning if DEBUG enabled, add env check

**No Rate Limiting Implemented:**
- Risk: Settings define rate limits but they're not enforced
- Files: `backend/config/settings.py` (lines 56-57)
- Current mitigation: None
- Recommendations: Implement rate limiting middleware using Redis

**Admin API Lacks Auth:**
- Risk: Internal endpoints like `/api/forecast/push` have no authentication
- Files: `backend/app/main.py` (lines 1114-1148)
- Current mitigation: None
- Recommendations: Add API key or JWT authentication per spec recommendations

## Performance Bottlenecks

**Synchronous Database Migrations:**
- Problem: Migration runs on every startup during table creation
- Files: `backend/app/models/database.py` (lines 105-123)
- Cause: `_migrate_message_log()` called in `__init__`
- Improvement path: Run migrations once via script, not on every import

**No Forecast Caching:**
- Problem: Every CAST request fetches fresh data from BOM/Open-Meteo
- Files: `backend/app/services/bom.py`
- Cause: Cache infrastructure defined in settings but not implemented
- Improvement path: Add Redis caching with TTL from settings (6 hours)

**Sequential SafeCheck Notifications:**
- Problem: Contacts notified one at a time with potential delays
- Files: `backend/app/main.py` (lines 281-286)
- Cause: Sequential loop over contacts
- Improvement path: Use `asyncio.gather()` for parallel sends

**Large File Complexity:**
- Problem: Several files exceed 1000 lines making maintenance difficult
- Files:
  - `backend/app/services/formatter.py` (1710 lines)
  - `backend/app/main.py` (1684 lines)
  - `backend/tests/test_validation.py` (1197 lines)
- Cause: Accumulated features without refactoring
- Improvement path: Split into modules (e.g., separate admin routes, command handlers)

## Fragile Areas

**Command Parser:**
- Files: `backend/app/services/commands.py`
- Why fragile: Complex regex parsing, many special cases
- Safe modification: Add tests for any new command patterns
- Test coverage: Good - test_services.py has command parser tests

**Forecast Formatter:**
- Files: `backend/app/services/formatter.py`
- Why fragile: SMS segment counting, character limits, complex formatting
- Safe modification: Run format tests after any changes
- Test coverage: Moderate - test_v3_format_changes.py covers some patterns

**BOM API Parsing:**
- Files: `backend/app/services/bom.py`
- Why fragile: Undocumented API may change format without notice
- Safe modification: Check BOM response structure hasn't changed
- Test coverage: Limited - relies on mock data, no integration tests

**Route Data Loading:**
- Files: `backend/app/services/routes.py`, `backend/config/routes/*.json`
- Why fragile: JSON schema not validated, missing fields cause runtime errors
- Safe modification: Add route after validating against schema
- Test coverage: Good - test_route_data_integrity.py validates structure

## Scaling Limits

**SQLite Database:**
- Current capacity: Single-user writes, ~1000 concurrent reads
- Limit: Concurrent writes will block; database file size limits
- Scaling path: Migrate to PostgreSQL (driver already in requirements.txt)

**In-Memory Onboarding Sessions:**
- Current capacity: Works on single server only
- Limit: Loses state on restart, can't load balance
- Scaling path: Use Redis for session storage

**BOM API Rate Limits:**
- Current capacity: Unknown - undocumented API
- Limit: May be throttled or blocked with high volume
- Scaling path: Implement caching, use Open-Meteo as primary if BOM unreliable

## Dependencies at Risk

**BOM Undocumented API:**
- Risk: Could break without warning, no SLA
- Impact: Primary weather data source would fail
- Migration plan: Open-Meteo fallback exists (`backend/app/services/bom.py` lines 271-283)

**Python 3.9:**
- Risk: Python 3.9 EOL October 2025, using outdated runtime
- Impact: Security patches stop, dependency compatibility issues
- Migration plan: Upgrade to Python 3.11+ (venv uses 3.9)

**Twilio Dependency:**
- Risk: Single SMS provider, pricing changes or outages
- Impact: All SMS functionality fails
- Migration plan: Cellcast integration started (`CELLCAST_API_KEY` in settings) but not implemented

## Missing Critical Features

**No Database Migrations:**
- Problem: Schema changes require manual SQL or table recreation
- Blocks: Safe production deployments with schema changes

**No Monitoring/Alerting:**
- Problem: SENTRY_DSN optional, no built-in alerting
- Blocks: Proactive issue detection, need to check logs manually

**No Redis Integration:**
- Problem: Redis URL configured but not used
- Blocks: Rate limiting, forecast caching, session scaling

**No Frontend Authentication:**
- Problem: Register page has no actual payment/auth integration
- Blocks: Public beta launch (users can't actually sign up)

## Test Coverage Gaps

**BOM/Weather Service:**
- What's not tested: Real API responses, error handling paths
- Files: `backend/app/services/bom.py`
- Risk: API changes or errors could cause silent failures
- Priority: High - critical path

**Admin Interface:**
- What's not tested: Login flow, user management, push functionality
- Files: `backend/app/services/admin.py`, `backend/app/main.py` (admin routes)
- Risk: Admin could break without detection
- Priority: Medium - internal tool

**SMS Delivery:**
- What's not tested: Actual Twilio integration, retry logic
- Files: `backend/app/services/sms.py`
- Risk: SMS failures not caught until production
- Priority: High - core functionality

**Frontend:**
- What's not tested: No frontend tests exist
- Files: All `app/*.tsx` files
- Risk: UI regressions on any change
- Priority: Low - mostly static content

---

*Concerns audit: 2026-01-19*
