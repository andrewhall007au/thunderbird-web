# Synthetic Monitoring Setup Guide

## What Synthetic Monitoring Tests

These checks test **critical user flows** end-to-end in production:
- Beta signup (revenue blocker)
- Buy now/checkout (revenue blocker)
- Create first route (core product)
- Login (returning users)
- SMS webhook (entire SMS product)

## Required Setup on Production Server

### 1. Install Playwright

SSH into production server and run:

```bash
cd /root/thunderbird-web

# Install Playwright npm package
npm install -D @playwright/test

# Install Chromium browser with system dependencies
npx playwright install chromium --with-deps
```

**Note:** This will install system packages (chromium dependencies). On Ubuntu, it will use `apt-get`.

### 2. Create Test Account

You need a test account for login checks. Either:

**Option A: Create via Beta Signup**
```bash
# Use the production site to create test account
# Visit: https://thunderbird.bot/beta
# Email: monitoring-test@thunderbird.app (or your choice)
# Save the password you create
```

**Option B: Create via Database**
```bash
# If you have direct database access
# Create account programmatically
```

### 3. Configure Environment Variables

Add these to `/root/thunderbird-web/backend/.env`:

```bash
# Monitoring Test Credentials
MONITOR_TEST_EMAIL="monitoring-test@thunderbird.app"
MONITOR_TEST_PASSWORD="<your-secure-test-password>"
MONITOR_TEST_PHONE="+15555551234"  # Use a real test phone number for SMS webhook tests
```

**Security Notes:**
- Use a unique password for the test account
- The test phone number will receive webhook test pings (use a disposable number if possible)
- These credentials are ONLY for synthetic monitoring, not production user data

### 4. Deploy and Restart

```bash
cd /root/thunderbird-web

# Pull latest code (includes SMS webhook fix)
git pull origin main

# Restart monitoring service
systemctl restart thunderbird-monitoring

# Verify Playwright is available
npx playwright --version
```

### 5. Verify Setup

Wait 5-10 minutes for checks to run, then query results:

```bash
sqlite3 /root/thunderbird-web/backend/backend/monitoring/monitoring.db "
SELECT
    check_name,
    status,
    error_message,
    datetime(timestamp_ms/1000, 'unixepoch') as timestamp
FROM metrics
WHERE check_name LIKE 'synthetic_%'
ORDER BY timestamp_ms DESC
LIMIT 10;
"
```

Expected results after setup:
- ✅ `synthetic_beta_signup_flow` - pass (if Playwright installed)
- ✅ `synthetic_buy_now_flow` - pass (if Playwright installed)
- ✅ `synthetic_create_first_flow` - pass (if Playwright installed)
- ✅ `synthetic_login` - pass (if test credentials set)
- ✅ `synthetic_sms_webhook` - pass (webhook path fixed)

## Troubleshooting

### "Cannot find module '@playwright/test'"

Playwright not installed. Run:
```bash
cd /root/thunderbird-web
npm install -D @playwright/test
npx playwright install chromium --with-deps
```

### "MONITOR_TEST_EMAIL or MONITOR_TEST_PASSWORD not set"

Add credentials to `.env` file and restart monitoring service.

### "HTTP 404" on SMS webhook

Make sure you've pulled the latest code with the webhook path fix:
```bash
git pull origin main
systemctl restart thunderbird-monitoring
```

### Playwright browser crashes

System dependencies missing. Re-run:
```bash
npx playwright install chromium --with-deps
```

## Maintenance

### Rotating Test Credentials

If you need to change test credentials:
1. Update `.env` file
2. Restart monitoring: `systemctl restart thunderbird-monitoring`
3. No code changes needed

### Disabling Specific Checks

To disable a synthetic check temporarily, edit `backend/monitoring/config.py`:
```python
MONITOR_CHECK_INTERVALS: dict = Field(default={
    "login_flow": 1440,  # Set to daily instead of 10 min
    # Or comment out the check entirely
})
```

Then restart: `systemctl restart thunderbird-monitoring`

## Security Considerations

- Test account should have minimal privileges
- Test phone number receives synthetic webhook pings daily
- Credentials are stored in `.env` (not in git)
- Monitor for suspicious activity on test account
- Rotate credentials quarterly

## Cost Impact

**Playwright Tests:**
- Runs in headless browser on server
- No external API costs
- Minimal CPU/memory impact (~100MB per test run)

**SMS Webhook Test:**
- Runs daily (not per-minute)
- Sends test payload to webhook (no actual SMS sent)
- No Twilio costs

**Login Test:**
- HTTP-only (no browser)
- Runs every 10 minutes
- No API costs

Total estimated cost: **$0/month** (all synthetic, no external services)
