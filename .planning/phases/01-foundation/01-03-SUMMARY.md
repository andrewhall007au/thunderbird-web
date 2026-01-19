---
phase: 01-foundation
plan: 03
subsystem: auth
tags: [jwt, argon2, fastapi, pyjwt, pwdlib, email-validator]

# Dependency graph
requires:
  - phase: 01-02
    provides: Alembic migration framework
provides:
  - JWT authentication system
  - Account model for web users
  - Registration and login endpoints
  - Protected route middleware
affects: [foun-05-phone-linking, phase-2-payments, phase-4-user-flows]

# Tech tracking
tech-stack:
  added:
    - pyjwt>=2.8.0
    - pwdlib[argon2]>=0.2.0
    - email-validator>=2.0.0
  patterns:
    - "Argon2 password hashing (not bcrypt)"
    - "OAuth2PasswordBearer for JWT extraction"
    - "JWT_SECRET required in production (fails on startup if missing)"

key-files:
  created:
    - backend/app/models/account.py
    - backend/app/services/auth.py
    - backend/app/routers/auth.py
    - backend/alembic/versions/4fd3f14bce7e_accounts_table.py
  modified:
    - backend/requirements.txt
    - backend/config/settings.py
    - backend/app/main.py

key-decisions:
  - "Argon2 via pwdlib (recommended bcrypt replacement)"
  - "Account model separate from User (web vs SMS)"
  - "Case-insensitive email (normalized to lowercase)"
  - "JWT_SECRET required in non-DEBUG mode"

patterns-established:
  - "get_current_account dependency for protected endpoints"
  - "OAuth2 password flow at /auth/token"

# Metrics
duration: 5min
completed: 2026-01-19
---

# Phase 1 Plan 3: Account Authentication Summary

**JWT authentication with Argon2 password hashing, Account model for web users, and OAuth2-compliant registration/login endpoints**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-19T08:51:02Z
- **Completed:** 2026-01-19T08:55:39Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Account model and AccountStore for web authentication (distinct from SMS User)
- Alembic migration creating accounts table with email unique index
- JWT token generation with configurable expiry (default 30 min)
- Argon2 password hashing via pwdlib (modern bcrypt replacement)
- OAuth2 password flow endpoints (/auth/register, /auth/token, /auth/me)
- get_current_account dependency for protecting endpoints
- JWT_SECRET production validation (fails startup if not set)
- All 280 existing tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and update settings** - `b4e8ef8` (chore)
2. **Task 2: Create accounts table migration and model** - `f2eda9a` (feat)
3. **Task 3: Create auth service and router** - `6104207` (feat)

## Files Created/Modified

- `backend/requirements.txt` - Added pyjwt, pwdlib[argon2], email-validator
- `backend/config/settings.py` - Added JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRY_MINUTES
- `backend/alembic/versions/4fd3f14bce7e_accounts_table.py` - Migration for accounts table
- `backend/app/models/account.py` - Account dataclass and AccountStore
- `backend/app/services/auth.py` - JWT and password handling
- `backend/app/routers/auth.py` - Registration and login endpoints
- `backend/app/main.py` - Integrated auth router, added JWT validation

## Decisions Made

1. **Argon2 instead of bcrypt** - pwdlib with Argon2 is the recommended modern replacement. Faster and more secure than bcrypt.

2. **Account separate from User** - Account is for web login (email/password), User is for SMS hikers (phone). They will be linked via phone number in FOUN-05.

3. **Case-insensitive email** - Emails normalized to lowercase on storage. Prevents duplicate accounts for "Test@example.com" vs "test@example.com".

4. **OAuth2 password flow** - Standard /auth/token endpoint accepts username (email) and password as form data. Compatible with OAuth2 clients and FastAPI's built-in OpenAPI authentication.

5. **JWT_SECRET validation** - Production (non-DEBUG) fails on startup if JWT_SECRET is empty. Prevents accidentally running with weak/empty secret.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Python 3.9 syntax compatibility**
- **Found during:** Task 3 (auth router)
- **Issue:** Used `str | None` type hint which requires Python 3.10+
- **Fix:** Changed to `Optional[str]` with typing import
- **Files modified:** backend/app/routers/auth.py
- **Verification:** Router imports correctly
- **Committed in:** 6104207 (part of Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor syntax fix for Python 3.9 compatibility. No scope creep.

## Issues Encountered

**Database already had tables from legacy code**
- Alembic tried to run initial migration but tables existed
- Resolution: Used `alembic stamp 58ce9da45577` to mark initial migration as applied
- Then `alembic upgrade head` ran only the new accounts migration

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Authentication system complete and functional
- Ready for FOUN-05 (phone linking) to connect Account to User
- JWT tokens can be used by frontend for API access
- get_current_account dependency ready for protecting future endpoints

---
*Phase: 01-foundation*
*Completed: 2026-01-19*
