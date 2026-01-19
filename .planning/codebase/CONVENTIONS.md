# Coding Conventions

**Analysis Date:** 2026-01-19

## Naming Patterns

**Files:**
- Python: `snake_case.py` (e.g., `onboarding.py`, `forecast.py`)
- TypeScript/React: `kebab-case/page.tsx` for Next.js pages, `PascalCase` for components
- Test files: `test_*.py` prefix (e.g., `test_services.py`, `test_v3_checkin_onboarding.py`)

**Functions:**
- Python: `snake_case` (e.g., `get_session`, `process_input`, `calculate_danger`)
- TypeScript: `PascalCase` for React components, `camelCase` for utilities

**Variables:**
- Python: `snake_case` for variables and parameters
- Constants: `UPPER_SNAKE_CASE` (e.g., `TZ_HOBART`, `ROUTES_DIR`, `ROUTE_MENU`)

**Classes:**
- Python: `PascalCase` (e.g., `OnboardingManager`, `BOMService`, `CommandParser`)
- Dataclasses used extensively (e.g., `User`, `ForecastPeriod`, `ParsedCommand`)

**Enums:**
- `PascalCase` class names, `UPPER_SNAKE_CASE` members
- Example from `backend/app/services/commands.py`:
```python
class CommandType(str, Enum):
    START = "START"
    STOP = "STOP"
    CAST = "CAST"
```

## Code Style

**Formatting:**
- Black formatter (version 23.12.0+)
- No explicit configuration file found - uses defaults (88 char line length)

**Linting:**
- isort (version 5.13.0+) for import sorting
- mypy (version 1.8.0+) for type checking
- No eslint/prettier config for TypeScript (Next.js defaults)

**Type Hints:**
- Python uses extensive type hints with `typing` module
- Pattern: `Optional[Type]`, `List[Type]`, `Dict[str, Type]`, `Tuple[Type, ...]`
- Example from `backend/app/services/bom.py`:
```python
async def get_forecast(
    self,
    lat: float,
    lon: float,
    days: int = 7,
    resolution: str = "3hourly"
) -> CellForecast:
```

## Import Organization

**Order (Python):**
1. Standard library imports (e.g., `import logging`, `from datetime import datetime`)
2. Third-party imports (e.g., `from fastapi import FastAPI`, `import httpx`)
3. Local imports (e.g., `from config.settings import settings`)

**Pattern from `backend/app/main.py`:**
```python
import logging
import asyncio
import html
from datetime import datetime, date, timedelta
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config.settings import settings, TZ_HOBART, TZ_UTC
from app.services.sms import get_sms_service, InputSanitizer, PhoneUtils
```

**Path Aliases:**
- TypeScript: `@/*` maps to project root (configured in `tsconfig.json`)
- Python: uses relative imports within package, absolute for cross-package

## Error Handling

**Patterns:**
- Try/except with logging for recoverable errors
- HTTPException for API endpoint errors
- Early returns for validation failures

**Example from `backend/app/main.py`:**
```python
try:
    await push_forecast_to_user(user, forecast_type="morning")
except Exception as e:
    logger.error(f"Morning push failed for {PhoneUtils.mask(user.phone)}: {e}")
```

**Validation pattern:**
```python
if not parsed.is_valid:
    return parsed.error_message or "CAST requires a location.\n\nExample: CAST12 LAKEO"
```

## Logging

**Framework:** Python `logging` module

**Configuration from `backend/app/main.py`:**
```python
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='{"timestamp": "%(asctime)s", "level": "%(levelname)s", "message": "%(message)s"}'
)
logger = logging.getLogger(__name__)
```

**Patterns:**
- JSON-formatted logs for production
- Use `logger.info()` for normal operations
- Use `logger.warning()` for recoverable issues
- Use `logger.error()` for failures
- Mask sensitive data: `PhoneUtils.mask(user.phone)` in log messages

## Comments

**Docstrings:**
- Module-level docstrings with spec references (e.g., `"""Based on THUNDERBIRD_SPEC_v2.4 Section 12.4"""`)
- Class docstrings describing purpose
- Method docstrings with Args/Returns sections for complex functions

**Example from `backend/app/services/onboarding.py`:**
```python
def process_input(self, phone: str, text: str) -> Tuple[str, bool]:
    """
    Process user input during onboarding.

    Returns:
        (response_message, is_complete)
    """
```

**Inline Comments:**
- Used sparingly for non-obvious logic
- Version comments (e.g., `# v3.0: No start_date/end_date`)
- TODO comments for future work

## Function Design

**Size:** Functions tend to be focused, 20-50 lines typical

**Parameters:**
- Required parameters first, optional with defaults last
- Use keyword arguments for clarity in calls
- Pydantic models for complex input validation (e.g., `TwilioInboundSMS`)

**Return Values:**
- Tuples for multiple returns: `Tuple[str, bool]`
- Optional for nullable returns: `Optional[User]`
- Dataclasses for structured returns

## Module Design

**Exports:**
- No `__all__` declarations - import by name
- Service classes are singletons via module-level instances
- Factory functions for service instantiation (e.g., `get_sms_service()`, `get_bom_service()`)

**Service Pattern from `backend/app/services/bom.py`:**
```python
# Singleton pattern
_bom_service: Optional[BOMService] = None

def get_bom_service() -> BOMService:
    global _bom_service
    if _bom_service is None:
        _bom_service = BOMService()
    return _bom_service
```

## Configuration Pattern

**Environment Variables:**
- Pydantic Settings class in `backend/config/settings.py`
- All caps with underscores (e.g., `TWILIO_ACCOUNT_SID`)
- Type-validated with defaults

**Pattern:**
```python
class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True
    )

    APP_NAME: str = "Thunderbird"
    DEBUG: bool = False
    TWILIO_ACCOUNT_SID: str = ""
```

## Dataclass Usage

**Extensively used for:**
- Data transfer objects (DTOs)
- Configuration containers
- Parsed command results
- Forecast periods

**Pattern from `backend/app/services/commands.py`:**
```python
@dataclass
class ParsedCommand:
    command_type: CommandType
    raw_input: str
    args: Dict[str, Any]
    is_valid: bool
    error_message: Optional[str] = None

    @property
    def location_code(self) -> Optional[str]:
        """Computed property for convenience."""
        return self.args.get("camp_code")
```

## Async Patterns

**FastAPI async handlers:**
```python
@app.post("/webhook/sms/inbound")
async def handle_inbound_sms(
    request: Request,
    x_twilio_signature: Optional[str] = Header(None)
):
```

**Async service methods:**
```python
async def get_forecast(self, lat: float, lon: float) -> CellForecast:
    client = await self.get_client()
    response = await client.get(url, params=params)
```

## React/Next.js Patterns

**Component Structure:**
- Function components only (no class components)
- Props destructured inline or via interface
- Tailwind CSS for styling

**Pattern from `app/page.tsx`:**
```typescript
function Hero() {
  return (
    <section className="relative py-20 lg:py-32 overflow-hidden">
      {/* JSX content */}
    </section>
  )
}

export default function Home() {
  return (
    <>
      <Hero />
      <Features />
    </>
  )
}
```

---

*Convention analysis: 2026-01-19*
