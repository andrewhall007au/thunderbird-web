# Phase 1: Foundation - Research

**Researched:** 2026-01-19
**Domain:** FastAPI modularization, Alembic migrations, JWT authentication, account systems
**Confidence:** HIGH

## Summary

Phase 1 requires refactoring a 1685-line monolithic `main.py` into service modules, setting up Alembic database migrations for SQLite, and implementing an account system with email/password authentication, JWT session persistence, and phone number linking.

The existing codebase already has a solid foundation: FastAPI with services layer, SQLite with SQLAlchemy-style raw queries, and Twilio SMS integration. The main challenges are (1) safely extracting 1600+ lines without breaking existing SMS functionality, (2) retrofitting Alembic onto an existing SQLite database, and (3) adding proper user authentication separate from the existing admin session system.

**Primary recommendation:** Use domain-driven module structure with APIRouter, PyJWT for tokens, pwdlib with Argon2 for password hashing, and Alembic batch migrations for SQLite. Prioritize test coverage before refactoring to catch regressions.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | >=0.109.0 | Web framework | Already in use, official modularization patterns |
| PyJWT | >=2.8.0 | JWT token handling | FastAPI official docs now recommend over python-jose |
| pwdlib[argon2] | >=0.2.0 | Password hashing | Replaces deprecated passlib, recommended by FastAPI |
| Alembic | >=1.13.0 | Database migrations | Already in requirements.txt, industry standard |
| SQLAlchemy | >=2.0.25 | ORM/database | Already in requirements.txt, needed for Alembic |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pydantic | >=2.5.0 | Request/response validation | Already in use, for User/Token models |
| email-validator | >=2.0.0 | Email validation | Required for Pydantic EmailStr type |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PyJWT | python-jose | python-jose was abandoned until May 2025; PyJWT is simpler and officially recommended |
| pwdlib | passlib | passlib deprecated in Python 3.13; pwdlib is maintained replacement |
| SQLite | PostgreSQL | PostgreSQL better for production but SQLite simpler for current scale; can migrate later |

**Installation:**
```bash
pip install pyjwt "pwdlib[argon2]" email-validator
```

Note: alembic and sqlalchemy already in requirements.txt.

## Architecture Patterns

### Recommended Project Structure

The existing flat structure in `backend/app/services/` is appropriate for this codebase size. Do NOT reorganize into domain folders yet - keep current conventions.

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # Slim entry point (~100 lines)
│   ├── models/
│   │   ├── __init__.py
│   │   ├── database.py      # Existing - keep as base
│   │   └── account.py       # NEW: Account/User models
│   ├── routers/             # NEW: API route modules
│   │   ├── __init__.py
│   │   ├── auth.py          # Login, register, token refresh
│   │   ├── webhook.py       # Twilio SMS webhook (extract from main.py)
│   │   ├── admin.py         # Admin endpoints (extract from main.py)
│   │   └── api.py           # Public API endpoints (extract from main.py)
│   └── services/            # Existing - add account service
│       ├── auth.py          # NEW: JWT + password handling
│       └── ...existing...
├── alembic/                 # NEW: Migration directory
│   ├── versions/
│   ├── env.py
│   └── script.py.mako
├── alembic.ini              # NEW: Alembic config
└── config/
    └── settings.py          # Add JWT_SECRET, JWT_EXPIRY settings
```

### Pattern 1: APIRouter for Route Extraction

**What:** Extract route handlers from main.py into dedicated router modules
**When to use:** Always for FastAPI modularization
**Example:**
```python
# Source: https://fastapi.tiangolo.com/tutorial/bigger-applications/
# backend/app/routers/webhook.py
from fastapi import APIRouter, Request, Header
from typing import Optional

router = APIRouter(
    prefix="/webhook",
    tags=["webhook"]
)

@router.post("/sms/inbound")
async def handle_inbound_sms(
    request: Request,
    x_twilio_signature: Optional[str] = Header(None)
):
    # Extract existing handler logic here
    ...

# backend/app/main.py
from app.routers import webhook, auth, admin, api

app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)
app.include_router(webhook.router)
app.include_router(auth.router)
app.include_router(admin.router, prefix="/admin")
app.include_router(api.router, prefix="/api")
```

### Pattern 2: JWT Authentication Dependency

**What:** Reusable dependency for protected routes
**When to use:** Any endpoint requiring authentication
**Example:**
```python
# Source: https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/
# backend/app/services/auth.py
from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pwdlib import PasswordHash

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")
password_hash = PasswordHash.recommended()

def verify_password(plain: str, hashed: str) -> bool:
    return password_hash.verify(plain, hashed)

def hash_password(password: str) -> str:
    return password_hash.hash(password)

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=30))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm="HS256")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except jwt.InvalidTokenError:
        raise credentials_exception

    user = account_store.get_by_email(email)
    if user is None:
        raise credentials_exception
    return user
```

### Pattern 3: SQLite Batch Migrations with Alembic

**What:** SQLite requires batch operations for ALTER TABLE
**When to use:** Always when using Alembic with SQLite
**Example:**
```python
# Source: https://alembic.sqlalchemy.org/en/latest/batch.html
# alembic/env.py - key configuration
def run_migrations_online():
    connectable = engine_from_config(...)
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,  # CRITICAL for SQLite
        )
        with context.begin_transaction():
            context.run_migrations()

# Migration example with batch operations
def upgrade():
    with op.batch_alter_table('accounts') as batch_op:
        batch_op.add_column(sa.Column('phone', sa.String(20)))
```

### Anti-Patterns to Avoid

- **Endpoint logic in main.py:** Extract all handlers to routers; main.py should only wire things together
- **Direct database access in routes:** All DB operations go through services/stores
- **Storing passwords in plain text:** Always hash with Argon2 via pwdlib
- **Long-lived access tokens:** Use 30-minute expiry with optional refresh tokens
- **Hardcoded JWT secrets:** Use environment variable, generate with `openssl rand -hex 32`
- **Base.metadata.create_all in production:** Use Alembic migrations exclusively

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | MD5/SHA256 hash | pwdlib with Argon2 | GPU-resistant, timing-safe verification |
| JWT tokens | Custom base64 encoding | PyJWT | Handles signatures, expiration, validation |
| Email validation | Regex pattern | Pydantic EmailStr | RFC-compliant, handles edge cases |
| DB migrations | Manual ALTER TABLE | Alembic batch ops | SQLite limitations handled automatically |
| Session storage | Custom dict/file | JWT stateless | Scales horizontally, no session state |
| Phone normalization | String manipulation | Existing PhoneUtils | Already handles +61/0 formats |

**Key insight:** The existing codebase has solid utilities (PhoneUtils, InputSanitizer) - reuse them rather than building new.

## Common Pitfalls

### Pitfall 1: Breaking SMS Functionality During Refactor
**What goes wrong:** Moving code from main.py breaks Twilio webhook handling
**Why it happens:** Imports, circular dependencies, missing context
**How to avoid:**
1. Write comprehensive tests for SMS flow BEFORE refactoring
2. Move one section at a time, run tests after each move
3. Keep main.py working at every commit
**Warning signs:** Tests fail, webhook returns 500, Twilio signature validation fails

### Pitfall 2: SQLite Migration Failures
**What goes wrong:** Alembic migration fails with "ALTER TABLE not supported"
**Why it happens:** SQLite doesn't support most ALTER TABLE operations
**How to avoid:**
1. Always use `render_as_batch=True` in env.py
2. Test migrations on fresh database AND existing database
3. Disable foreign key checks during migrations if needed
**Warning signs:** Migration errors mentioning ALTER TABLE, constraint violations

### Pitfall 3: JWT Secret in Code
**What goes wrong:** Security vulnerability when secret is committed to repo
**Why it happens:** Copying example code that has hardcoded secrets
**How to avoid:**
1. Generate secret: `openssl rand -hex 32`
2. Store in .env file (already gitignored)
3. Add JWT_SECRET to Settings class with no default
**Warning signs:** Same JWT works across environments, secret visible in git history

### Pitfall 4: Account vs User Confusion
**What goes wrong:** Mixing existing "User" (SMS hiker) with new "Account" (web login)
**Why it happens:** Both represent people, naming collision
**How to avoid:**
1. Use distinct names: Account (web login) vs User (SMS/route data)
2. Account has email/password, User has phone/route
3. Link via account_id foreign key on users table
**Warning signs:** Wrong data returned, auth checking SMS user instead of account

### Pitfall 5: Circular Import During Modularization
**What goes wrong:** ImportError when splitting main.py
**Why it happens:** Module A imports from B, B imports from A
**How to avoid:**
1. Services don't import from routers
2. Routers import from services, not from each other
3. Use TYPE_CHECKING for type hints if needed
**Warning signs:** ImportError at startup, "cannot import name" errors

## Code Examples

Verified patterns from official sources:

### Account Registration Endpoint
```python
# backend/app/routers/auth.py
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from app.services.auth import hash_password
from app.models.account import account_store

router = APIRouter(prefix="/auth", tags=["auth"])

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str  # Minimum 8 chars enforced at Pydantic level

class AccountResponse(BaseModel):
    id: int
    email: str
    created_at: str

@router.post("/register", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest):
    # Check if email exists
    existing = account_store.get_by_email(request.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create account
    hashed = hash_password(request.password)
    account = account_store.create(email=request.email, password_hash=hashed)

    return AccountResponse(
        id=account.id,
        email=account.email,
        created_at=account.created_at.isoformat()
    )
```

### Login with JWT Token
```python
# backend/app/routers/auth.py (continued)
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta
from app.services.auth import verify_password, create_access_token

class Token(BaseModel):
    access_token: str
    token_type: str

@router.post("/token", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    account = account_store.get_by_email(form_data.username)
    if not account or not verify_password(form_data.password, account.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        data={"sub": account.email},
        expires_delta=timedelta(minutes=settings.JWT_EXPIRY_MINUTES)
    )
    return Token(access_token=access_token, token_type="bearer")
```

### Alembic Initial Setup
```python
# alembic/env.py - key sections
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import os

config = context.config

# Get database URL from environment
def get_url():
    return os.getenv("THUNDERBIRD_DB_PATH", "sqlite:///thunderbird.db")

def run_migrations_online():
    configuration = config.get_section(config.config_ini_section)
    configuration["sqlalchemy.url"] = get_url()

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,  # CRITICAL for SQLite
        )

        with context.begin_transaction():
            context.run_migrations()
```

### Account Model and Store
```python
# backend/app/models/account.py
import sqlite3
from datetime import datetime
from dataclasses import dataclass
from typing import Optional
from contextlib import contextmanager

DB_PATH = os.environ.get("THUNDERBIRD_DB_PATH", "thunderbird.db")

@dataclass
class Account:
    id: int
    email: str
    password_hash: str
    phone: Optional[str] = None
    created_at: datetime = None
    updated_at: datetime = None

class AccountStore:
    def __init__(self, db_path: str = None):
        self.db_path = db_path or DB_PATH
        self._init_db()

    def _init_db(self):
        # Table creation handled by Alembic migrations
        pass

    @contextmanager
    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def create(self, email: str, password_hash: str) -> Account:
        with self._get_connection() as conn:
            cursor = conn.execute(
                """INSERT INTO accounts (email, password_hash, created_at, updated_at)
                   VALUES (?, ?, ?, ?)""",
                (email, password_hash, datetime.now().isoformat(), datetime.now().isoformat())
            )
            conn.commit()
            return Account(
                id=cursor.lastrowid,
                email=email,
                password_hash=password_hash,
                created_at=datetime.now()
            )

    def get_by_email(self, email: str) -> Optional[Account]:
        with self._get_connection() as conn:
            cursor = conn.execute("SELECT * FROM accounts WHERE email = ?", (email,))
            row = cursor.fetchone()
            if row:
                return Account(
                    id=row["id"],
                    email=row["email"],
                    password_hash=row["password_hash"],
                    phone=row["phone"],
                    created_at=datetime.fromisoformat(row["created_at"]) if row["created_at"] else None,
                    updated_at=datetime.fromisoformat(row["updated_at"]) if row["updated_at"] else None
                )
        return None

    def link_phone(self, account_id: int, phone: str) -> bool:
        with self._get_connection() as conn:
            cursor = conn.execute(
                "UPDATE accounts SET phone = ?, updated_at = ? WHERE id = ?",
                (phone, datetime.now().isoformat(), account_id)
            )
            conn.commit()
            return cursor.rowcount > 0

account_store = AccountStore()
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| passlib/bcrypt | pwdlib/Argon2 | 2024-2025 | passlib deprecated in Python 3.13 |
| python-jose | PyJWT | 2024 | python-jose was unmaintained until 2025 |
| SQLAlchemy 1.x | SQLAlchemy 2.0 | 2023 | New async patterns, type hints |
| Manual migrations | Alembic with batch | Standard | Required for SQLite ALTER TABLE |

**Deprecated/outdated:**
- passlib: Use pwdlib instead (Python 3.13 compatibility)
- python-jose: Use PyJWT instead (now recommended by FastAPI)
- Base.metadata.create_all(): Use Alembic migrations in production

## Open Questions

Things that couldn't be fully resolved:

1. **Refresh token strategy**
   - What we know: Short-lived access tokens (30 min) are standard; refresh tokens extend sessions
   - What's unclear: Whether this project needs refresh tokens or simple re-login is acceptable
   - Recommendation: Start without refresh tokens; add later if UX requires longer sessions

2. **Email verification**
   - What we know: Production systems typically verify email addresses
   - What's unclear: Whether to require verification before allowing account use
   - Recommendation: Defer email verification to a future phase; allow immediate use

3. **Linking existing SMS users to new accounts**
   - What we know: Users table has phone numbers, accounts table will have phone numbers
   - What's unclear: How to handle users who registered via SMS before accounts existed
   - Recommendation: Allow linking during phone verification; existing SMS users continue working

## Sources

### Primary (HIGH confidence)
- [FastAPI Bigger Applications](https://fastapi.tiangolo.com/tutorial/bigger-applications/) - Official modularization patterns
- [FastAPI OAuth2 with JWT](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/) - Official JWT authentication pattern
- [Alembic Batch Migrations](https://alembic.sqlalchemy.org/en/latest/batch.html) - SQLite migration requirements

### Secondary (MEDIUM confidence)
- [FastAPI Best Practices (zhanymkanov)](https://github.com/zhanymkanov/fastapi-best-practices) - Community patterns, widely adopted
- [FastAPI JWT Discussion #11345](https://github.com/fastapi/fastapi/discussions/11345) - PyJWT vs python-jose decision
- [pwdlib Documentation](https://frankie567.github.io/pwdlib/) - Password hashing replacement for passlib

### Tertiary (LOW confidence)
- Various Medium articles on FastAPI structure - Useful for pattern validation but not authoritative

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official FastAPI docs and actively maintained libraries
- Architecture: HIGH - Official FastAPI patterns, existing codebase conventions
- Pitfalls: MEDIUM - Based on common issues reported in discussions

**Research date:** 2026-01-19
**Valid until:** 2026-02-19 (libraries stable, patterns established)
