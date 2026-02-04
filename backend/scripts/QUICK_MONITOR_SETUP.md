# Quick Monitor Setup Guide

## Immediate Production Protection

This quick monitoring script provides immediate protection while we build the comprehensive monitoring system (Phase 9).

## What It Does

- Runs smoke tests every 5 minutes
- Tests: Backend health, frontend loads, beta signup endpoint, response time
- Sends SMS alert via Twilio if any test fails
- Logs all results

## Setup on Production Server

### 1. Test the Monitor Locally

```bash
# From thunderbird-web/backend directory
source venv/bin/activate
python scripts/quick_monitor.py --url https://thunderbird.bot --phone +61XXXXXXXXX --no-alert

# Should output:
# ============================================================
# Monitoring Report - 2026-02-04 14:23:45
# ============================================================
# Target: https://thunderbird.bot
# Status: ✅ ALL PASS
# Tests: 4/4 passed
# ============================================================
```

### 2. Deploy to Production Server

```bash
# SSH to server
ssh root@thunderbird.bot

# Navigate to project
cd /root/overland-weather

# Test the monitor
source venv/bin/activate
python scripts/quick_monitor.py --url https://thunderbird.bot --phone +61XXXXXXXXX --no-alert

# Should see all tests pass
```

### 3. Set Up Cron Job

```bash
# Edit crontab
crontab -e

# Add this line (replace with your phone number in E.164 format)
# Runs every 5 minutes, logs to file
*/5 * * * * cd /root/overland-weather && source venv/bin/activate && python scripts/quick_monitor.py --url https://thunderbird.bot --phone +61XXXXXXXXX >> /var/log/thunderbird-monitor.log 2>&1

# Save and exit
```

**Phone Number Format:**
- Must be in E.164 format: `+[country code][number]`
- Australia: `+61412345678`
- USA: `+12025551234`
- UK: `+447700123456`

### 4. Verify Cron is Running

```bash
# Check cron is active
systemctl status cron

# Watch logs (wait 5 minutes for first run)
tail -f /var/log/thunderbird-monitor.log

# Should see output every 5 minutes:
# [2026-02-04 14:25:00] [INFO] Starting monitoring tests...
# ✅ ALL PASS
```

### 5. Test SMS Alerts

```bash
# Trigger a failure by stopping the service temporarily
systemctl stop overland

# Run monitor manually
python scripts/quick_monitor.py --url https://thunderbird.bot --phone +61XXXXXXXXX

# Should:
# 1. Show failed tests in console
# 2. Send SMS alert to your phone
# 3. Exit with code 1

# Start service again
systemctl start overland
```

**Expected SMS:**
```
🚨 THUNDERBIRD ALERT
Test Failed: Backend Health (Connection refused)
Time: 14:25 UTC
Check: https://thunderbird.bot
```

## Customization

### Change Check Frequency

```bash
# Every 1 minute
*/1 * * * * cd /root/overland-weather && ...

# Every 10 minutes
*/10 * * * * cd /root/overland-weather && ...

# Every 15 minutes
*/15 * * * * cd /root/overland-weather && ...
```

### Add Multiple Alert Recipients

```bash
# Create a wrapper script
cat > /root/alert_multiple.sh << 'EOF'
#!/bin/bash
cd /root/overland-weather
source venv/bin/activate

# Run once, send to multiple phones on failure
python scripts/quick_monitor.py --url https://thunderbird.bot --phone +61412345678
if [ $? -ne 0 ]; then
  python scripts/quick_monitor.py --url https://thunderbird.bot --phone +61987654321 --no-alert
fi
EOF

chmod +x /root/alert_multiple.sh

# Update cron to use wrapper
*/5 * * * * /root/alert_multiple.sh >> /var/log/thunderbird-monitor.log 2>&1
```

### Disable SMS Temporarily

```bash
# Use --no-alert flag
*/5 * * * * cd /root/overland-weather && source venv/bin/activate && python scripts/quick_monitor.py --url https://thunderbird.bot --phone +61XXXXXXXXX --no-alert >> /var/log/thunderbird-monitor.log 2>&1
```

## Monitoring the Monitor

### Check if Monitor is Running

```bash
# View recent cron jobs
grep CRON /var/log/syslog | tail -20

# View monitor output
tail -50 /var/log/thunderbird-monitor.log

# Count successful runs in last hour
grep "ALL PASS" /var/log/thunderbird-monitor.log | tail -12
```

### Alert if Monitor Stops

```bash
# Add meta-monitor to cron (runs every hour, checks last monitor run)
0 * * * * if ! grep -q "$(date +%Y-%m-%d\ %H)" /var/log/thunderbird-monitor.log; then curl "https://api.twilio.com/..." -d "Body=⚠️ Thunderbird monitor not running"; fi
```

## Cost Estimate

**SMS Costs (Twilio):**
- Alert SMS: $0.0075 - $0.045 per message (varies by country)
- If no issues: $0/month
- If 1 alert/day: ~$1-2/month
- If monitoring fails: 1 SMS (meta-monitor)

**Recommendation:** Start with 5-minute checks. Adjust based on alert frequency.

## Logs

### View Logs

```bash
# Last 100 lines
tail -100 /var/log/thunderbird-monitor.log

# Follow live
tail -f /var/log/thunderbird-monitor.log

# Search for failures
grep "FAILURES" /var/log/thunderbird-monitor.log

# Count failures today
grep "$(date +%Y-%m-%d)" /var/log/thunderbird-monitor.log | grep "FAILURES" | wc -l
```

### Rotate Logs

```bash
# Create logrotate config
cat > /etc/logrotate.d/thunderbird-monitor << 'EOF'
/var/log/thunderbird-monitor.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 root root
}
EOF
```

## Troubleshooting

### No SMS Received

```bash
# Check Twilio credentials
echo $TWILIO_ACCOUNT_SID
echo $TWILIO_AUTH_TOKEN
echo $TWILIO_PHONE_NUMBER

# Test Twilio manually
python -c "from twilio.rest import Client; client = Client('AC...', 'auth...'); client.messages.create(body='Test', from_='+1...', to='+61...')"
```

### Monitor Not Running

```bash
# Check cron service
systemctl status cron

# Check cron job is installed
crontab -l

# Check for errors in syslog
grep CRON /var/log/syslog | grep thunderbird
```

### False Positives

Adjust timeout or threshold in `scripts/quick_monitor.py`:

```python
# Increase timeout from 10s to 30s
response = requests.get(f"{self.base_url}/health", timeout=30)

# Increase response time threshold from 2s to 5s
if elapsed < 5.0:  # was 2.0
```

## Next Steps

This quick monitor provides immediate protection. Phase 9 will add:
- Comprehensive synthetic testing
- Performance trending
- Status dashboard
- Smart alerting (deduplication, severity levels)
- Historical analytics

See `.planning/phases/09-monitoring-alerting/` for Phase 9 plans (coming soon).

---

**Created:** 2026-02-04
**Status:** Active - Provides immediate production protection while Phase 9 is developed
