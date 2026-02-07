# Monitoring System Deployment - v1.0

**Date:** 2026-02-04
**Target:** thunderbird.bot production server
**Purpose:** Deploy comprehensive monitoring system with health checks, alerting, and dashboard

---

## Pre-Deployment Checklist

- [x] All monitoring code committed (commit: b75c8f4)
- [x] Monitoring requirements.txt ready
- [x] Systemd service file ready
- [x] Setup script ready
- [ ] Production server SSH access confirmed
- [ ] Alert phone numbers ready
- [ ] Alert email addresses ready
- [ ] Twilio credentials available
- [ ] Resend API key available

---

## Deployment Steps

### Step 1: Push Code to Production

**On local machine:**

```bash
# Ensure latest code is pushed
git push origin main

# Verify tag is pushed
git push origin v1.0
```

**On production server (SSH as root):**

```bash
# Pull latest code
cd /root/overland-weather
git pull origin main
git checkout v1.0
```

---

### Step 2: Run Setup Script

**On production server:**

```bash
# Make script executable if needed
chmod +x /root/overland-weather/backend/monitoring/deploy/setup_monitoring.sh

# Run setup script
sudo bash /root/overland-weather/backend/monitoring/deploy/setup_monitoring.sh
```

**Expected output:**
- ✓ Dependencies installed
- ✓ Playwright chromium installed
- ✓ Environment file created at `/etc/default/thunderbird-monitoring`
- ✓ Database initialized
- ✓ Systemd service installed and started

---

### Step 3: Configure Alert Recipients

**Edit the environment file:**

```bash
sudo vim /etc/default/thunderbird-monitoring
```

**Replace placeholders with real values:**

```bash
# Thunderbird Monitoring Configuration
MONITOR_PRODUCTION_URL=https://thunderbird.bot
MONITOR_ALERT_PHONE_NUMBERS=+61468092783,+12345678900  # Comma-separated
MONITOR_ALERT_EMAIL_ADDRESSES=andrew@example.com,alerts@thunderbird.bot

# Copy from main app .env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+18662801940
RESEND_API_KEY=re_JRfCGwt1_PxbunopDTYFrYTPdv967qjez
```

**Restart service to load new config:**

```bash
sudo systemctl restart thunderbird-monitoring
```

---

### Step 4: Verify Service is Running

**Check service status:**

```bash
sudo systemctl status thunderbird-monitoring
```

**Expected output:**
```
● thunderbird-monitoring.service - Thunderbird Monitoring Service
   Loaded: loaded
   Active: active (running)
```

**Check logs:**

```bash
sudo journalctl -u thunderbird-monitoring -f
```

**Expected output:**
```
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8001
Scheduler started with 18 jobs
```

**Test health endpoint:**

```bash
curl http://localhost:8001/health
```

**Expected response:**
```json
{"status": "healthy", "timestamp": "2026-02-04T..."}
```

---

### Step 5: Verify Monitoring Dashboard

**Access dashboard:**

Open browser: `https://thunderbird.bot/monitoring`

**Expected:**
- System status overview (all checks green)
- Uptime charts showing recent data
- No active incidents
- Empty or minimal incident log

---

### Step 6: Test Alert Delivery

**Trigger a test alert manually:**

```bash
# SSH to production
cd /root/overland-weather/backend

# Run Python test script
/root/overland-weather/venv/bin/python << 'EOF'
from monitoring.alerts.channels import TwilioSMSChannel, ResendEmailChannel
import os

# Test SMS alert
sms = TwilioSMSChannel()
result = sms.send(
    to_numbers=[os.getenv("MONITOR_ALERT_PHONE_NUMBERS").split(",")[0]],
    message="🔔 Test alert from Thunderbird Monitoring\n\nThis is a test. System is operational."
)
print(f"SMS sent: {result}")

# Test email alert
email = ResendEmailChannel()
result = email.send(
    to_addresses=[os.getenv("MONITOR_ALERT_EMAIL_ADDRESSES").split(",")[0]],
    subject="Test Alert - Thunderbird Monitoring",
    body="<p>This is a test alert. System is operational.</p>"
)
print(f"Email sent: {result}")
EOF
```

**Verify:**
- [ ] SMS received on configured phone number
- [ ] Email received on configured email address

---

### Step 7: Run Smoke Tests

**Run synthetic E2E tests:**

```bash
cd /root/overland-weather
npx playwright test --config=e2e/monitoring.config.ts
```

**Expected:**
- Beta signup test: ✓ PASS
- Checkout test: ✓ PASS
- Create-first test: ✓ PASS

**Check monitoring recorded the synthetic test results:**

```bash
curl http://localhost:8001/api/monitoring/status | jq
```

---

## Post-Deployment Verification

### Health Checks Running

**Verify all checks are scheduled:**

```bash
# Check logs for scheduler confirmation
sudo journalctl -u thunderbird-monitoring | grep "Scheduler started"
```

**Expected: 18 jobs running**

1. `health_check` - Every 1 minute
2. `beta_signup_check` - Every 1 minute
3. `db_query_performance` - Every 5 minutes
4. `external_api_latency` - Every 10 minutes
5. `synthetic_login` - Every 10 minutes
6. `synthetic_beta_signup` - Every 15 minutes (if Playwright available)
7. `synthetic_checkout` - Every 10 minutes (if Playwright available)
8. `synthetic_create_first` - Every 5 minutes (if Playwright available)
9. `synthetic_sms_webhook` - Daily at 3 AM UTC
10. `heartbeat` - Every 5 minutes
11. `daily_report` - Daily at 8 AM UTC
12. `weekly_report` - Monday at 8 AM UTC
13. `monthly_report` - 1st of month at 8 AM UTC
14. `cleanup_metrics` - Daily at 3 AM UTC
15. `log_collection` - Every 2 minutes
16. `error_rate_check` - Every 5 minutes
17. `pattern_detection` - Every 30 minutes
18. `evaluate_and_alert` - After each check (triggered dynamically)

### Monitor Dashboard

**Check dashboard at:** `https://thunderbird.bot/monitoring`

**Expected sections:**
- Overall system status
- Individual check status cards
- 24-hour uptime charts
- Incident log (should be empty initially)

### Log Aggregation

**Check error logs are being collected:**

```bash
curl "http://localhost:8001/api/monitoring/logs?hours=1" | jq
```

**Check error rate:**

```bash
curl "http://localhost:8001/api/monitoring/logs/rate?hours=1" | jq
```

---

## Troubleshooting

### Service Won't Start

**Check logs:**
```bash
sudo journalctl -u thunderbird-monitoring -n 50
```

**Common issues:**
- Missing dependencies: Re-run pip install
- Port 8001 already in use: Check with `sudo lsof -i :8001`
- Database permissions: Check `/root/overland-weather/backend/monitoring/monitoring.db`

### No Alerts Received

**Check Twilio credentials:**
```bash
grep TWILIO /etc/default/thunderbird-monitoring
```

**Test Twilio manually:**
```bash
curl -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Messages.json" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  --data-urlencode "From=$TWILIO_PHONE_NUMBER" \
  --data-urlencode "To=+61468092783" \
  --data-urlencode "Body=Test from Twilio"
```

### Synthetic Tests Failing

**Check Playwright installed:**
```bash
npx playwright --version
```

**If missing:**
```bash
cd /root/overland-weather
npx playwright install chromium --with-deps
```

### Dashboard Not Accessible

**Check nginx proxy configuration:**
```bash
sudo nginx -t
sudo systemctl reload nginx
```

**Verify monitoring API is accessible:**
```bash
curl http://localhost:8001/api/monitoring/status
```

---

## Rollback Plan

**If monitoring causes issues:**

1. Stop the service:
   ```bash
   sudo systemctl stop thunderbird-monitoring
   sudo systemctl disable thunderbird-monitoring
   ```

2. Main app continues running unaffected (monitoring is isolated)

3. Debug offline, then re-enable when ready

---

## Success Criteria

- [x] Monitoring service running (systemctl status shows active)
- [x] All scheduler jobs confirmed running (adjusted for beta - 2026-02-07)
- [x] Dashboard accessible at https://thunderbird.bot/monitoring
- [ ] Test SMS alert received
- [ ] Test email alert received
- [x] Health checks configured for beta phase
- [ ] Synthetic E2E tests passing
- [x] Error logs being collected
- [x] No errors in monitoring service logs

## Beta Configuration Update (2026-02-07)

**What Changed:**
- Reduced monitoring frequency for beta phase (hourly weather checks, 15-30 min intervals for others)
- Fixed weather API checks to test external providers directly (BOM, NWS, Open-Meteo)
- Fixed database path configuration (was pointing to wrong location)
- Stripe/Twilio checks now skip when credentials not configured
- Fixed beta signup rate limiting (reduced from 5min to 30min)

**Current State:**
- Weather API checks: 72 calls/day (24 per provider)
- All checks passing with new configuration
- No more false positive alerts for unconfigured services

**See:** `backend/MONITORING_FIXES.md` for complete details

**Action Required for Retail Launch:**
Review and update monitoring configuration per `.planning/FUTURE-PHASE-beta-to-retail.md`

---

## Next Steps After Deployment

1. **Monitor for 24 hours** - Ensure no false positive alerts
2. **Review daily report** - First report sent at 8 AM UTC tomorrow
3. **Register with healthchecks.io** (optional):
   - Create account at healthchecks.io
   - Add check: `https://thunderbird.bot:8001/health`
   - Meta-meta-monitoring for redundancy

4. **Document alert response procedures** - What to do when alerts fire

---

**Deployment checklist complete when all success criteria checked ✓**
