# Monitoring Config Validation

**Priority**: High
**Effort**: Low (1-2 hours)
**Created**: 2026-02-06

## Problem
Monitoring system deployed without validating required configuration (email addresses). Service starts and runs but silently fails to send alerts/reports because `ALERT_EMAIL_ADDRESSES` wasn't configured.

## Root Cause
- No startup validation for required config variables
- No deployment checklist for environment variables
- Silent failures when config is missing

## Tasks

### 1. Add Startup Config Validation
**File**: `backend/monitoring/main.py`

Add validation at startup:
```python
# Validate required config on startup
def validate_config():
    errors = []

    if not settings.ALERT_EMAIL_ADDRESSES:
        errors.append("ALERT_EMAIL_ADDRESSES not configured")

    if not settings.RESEND_API_KEY:
        errors.append("RESEND_API_KEY not configured")

    if errors:
        for error in errors:
            logger.error(f"Config error: {error}")
        logger.error("Monitoring will run but email alerts/reports will fail!")
        # Optional: sys.exit(1) to prevent startup

    return len(errors) == 0

# Call on startup
validate_config()
```

### 2. Create .env.example Template
**File**: `backend/.env.example`

Document all required environment variables:
```bash
# === REQUIRED ===

# Resend API key for email alerts/reports
RESEND_API_KEY=re_xxxxxxxxxxxxx

# Comma-separated email addresses for alerts and daily reports
ALERT_EMAIL_ADDRESSES=admin@example.com,ops@example.com

# === OPTIONAL ===

# SMS numbers for critical alerts (comma-separated with country code)
ALERT_SMS_NUMBERS=+1234567890,+61412345678

# Production URL to monitor
MONITOR_PRODUCTION_URL=https://thunderbird.bot
```

### 3. Update Deployment Scripts
**File**: `backend/monitoring/deploy/setup_monitoring.sh`

Add validation step:
```bash
# Validate required config
echo "Validating configuration..."
if ! grep -q "ALERT_EMAIL_ADDRESSES" /root/thunderbird-web/backend/.env; then
    echo "ERROR: ALERT_EMAIL_ADDRESSES not configured in .env"
    echo "Please add: ALERT_EMAIL_ADDRESSES=your@email.com"
    exit 1
fi

if ! grep -q "RESEND_API_KEY" /root/thunderbird-web/backend/.env; then
    echo "ERROR: RESEND_API_KEY not configured in .env"
    exit 1
fi
```

### 4. Add Config Validation Test
**File**: `backend/tests/test_monitoring_config.py`

```python
def test_monitoring_config_validation():
    """Ensure required config is present for monitoring."""
    from monitoring.config import settings

    assert settings.ALERT_EMAIL_ADDRESSES, "ALERT_EMAIL_ADDRESSES must be configured"
    assert settings.RESEND_API_KEY, "RESEND_API_KEY must be configured"

    # Validate email format
    emails = settings.ALERT_EMAIL_ADDRESSES.split(',')
    for email in emails:
        assert '@' in email, f"Invalid email format: {email}"
```

### 5. Update Deployment Docs
**File**: `backend/monitoring/docs/deployment.md`

Add section on required configuration with checklist.

## Success Criteria
- [ ] Monitoring service logs clear errors if config is missing
- [ ] .env.example documents all required variables
- [ ] Deployment script validates config before starting service
- [ ] Tests fail if required config is not set
- [ ] Documentation includes configuration checklist

## Impact
Prevents silent failures and improves deployment reliability. Future deployments will catch missing config immediately rather than discovering it when alerts fail to send.
