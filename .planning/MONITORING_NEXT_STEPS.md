# Monitoring System - Next Steps

**Status:** Core monitoring deployed and operational ✅
**Date:** 2026-02-04

---

## What's Currently Working

✅ **Active Monitoring (Deployed):**
- Health checks running every 1-10 minutes
- Backend, Frontend, API checks: **ALL PASSING**
- Database query performance monitoring
- External API latency tracking (Stripe, Twilio, Open-Meteo)
- Error log aggregation with pattern detection
- Self-monitoring heartbeat (every 5 minutes)

✅ **Alerts (Configured):**
- SMS alerts to: +61410663673
- Email alerts to: hello@thunderbird.bot, andrew_hall_home@icloud.com
- Requires 2 consecutive failures (reduces false positives)
- Deduplication (15-min window)
- Alert escalation for critical issues

✅ **Automated Reports (Scheduled):**
- Daily health report at 8 AM UTC
- Weekly report every Monday at 8 AM UTC
- Monthly report with 99.9% SLA tracking (1st of month)

✅ **Infrastructure:**
- Monitoring service running as systemd service
- Auto-restart on crash (10s delay)
- 18 scheduler jobs operational
- Logs: `/var/log/thunderbird-monitoring.log`

---

## Optional Enhancements (Next Steps)

### 1. Browser-Based Synthetic Tests

**Purpose:** Test complete user flows (beta signup, checkout, route creation) via browser automation

**Current Status:**
- ❌ Not enabled (server out-of-memory issues)
- Playwright installed but tests get killed
- Test files exist: `e2e/beta-signup-flow.spec.ts`, `e2e/create-first-flow.spec.ts`, etc.

**How to Enable:**

```bash
# Option A: Add swap space (required for low-memory servers)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Option B: Upgrade server to higher memory tier

# Test manually first
cd /root/thunderbird-web
npx playwright test e2e/beta-signup-flow.spec.ts --workers=1

# If passes, monitoring will auto-run these tests every 5-15 minutes
```

**Trade-offs:**
- ✅ Catches UI/form/JavaScript errors HTTP checks can't
- ✅ Tests real user workflows end-to-end
- ❌ Memory intensive (requires swap or larger droplet)
- ❌ Slower (tests take 30-120s each)
- ❌ Can produce false positives if frontend is slow

**Decision:** Skip for now (HTTP checks are sufficient). Revisit if experiencing production UI bugs.

---

### 2. Monitoring Dashboard Web UI

**Purpose:** Visual interface to view system health, incidents, and uptime charts

**Current Status:**
- ❌ Returns 404 (page not built into Next.js production build)
- API endpoints work: `http://localhost:8001/api/monitoring/status`
- Dashboard code exists: `app/monitoring/page.tsx`

**How to Enable:**

```bash
cd /root/thunderbird-web

# Rebuild Next.js with monitoring pages
npm run build

# Restart frontend service
sudo systemctl restart thunderbird-web

# Access at: https://thunderbird.bot/monitoring
```

**What it provides:**
- Real-time system status overview
- Uptime percentage charts (24-hour view)
- Incident log with acknowledgment
- Event timeline for failures
- Color-coded status (green/amber/red)

**Trade-offs:**
- ✅ Nice visual interface
- ✅ Incident acknowledgment stops alert escalation
- ❌ Requires frontend rebuild (10-15 min)
- ❌ Not critical (alerts via SMS/email are what matter)

**Decision:** Skip for now. Can be added later if visual interface desired.

---

### 3. SMS Webhook Synthetic Test

**Current Status:**
- ⚠️ Failing with HTTP 404 error
- Test tries to POST to webhook endpoint that may not exist
- Not critical for monitoring functionality

**How to Fix:**

Either:
- Create the test webhook endpoint the monitoring expects
- Disable this specific test if not needed
- Update test configuration to use correct endpoint

**Impact:** Low priority - other synthetic tests (login, API) are more important.

---

### 4. Alert Testing & Tuning

**Purpose:** Verify alerts work and tune thresholds to reduce false positives

**Tasks:**

1. **Test alert delivery:**
   ```bash
   # Manually trigger test alert (TODO: create test script)
   # Verify SMS received on +61410663673
   # Verify emails received
   ```

2. **Monitor for false positives:**
   - Check daily reports for alert frequency
   - Adjust consecutive failure threshold if too sensitive (currently 2)
   - Adjust deduplication window if needed (currently 15 min)

3. **Test alert escalation:**
   - Verify critical alerts send SMS
   - Verify warning alerts send email only
   - Test incident acknowledgment stops escalation

**Timeline:** Monitor for 1 week, tune as needed.

---

### 5. External Health Check (Meta-Monitoring)

**Purpose:** Monitor the monitoring system from outside (in case server itself fails)

**Recommendation:** Register with external service like healthchecks.io

**Setup:**

1. Create free account at healthchecks.io
2. Add check with URL: `https://thunderbird.bot:8001/health`
3. Set to ping every 5 minutes
4. Configure to alert if no response for 10 minutes

**Benefit:** Alerts you if entire server is down (not just app issues).

---

### 6. Monitoring Metrics Retention

**Current Status:**
- 90-day retention for metrics and logs
- Cleanup runs nightly at 3 AM UTC

**Future Consideration:**
- If disk space becomes an issue, reduce retention
- If more history needed, increase retention or export to external storage

---

## Priority Recommendations

### High Priority (Do Soon)
1. ✅ **Monitor daily reports** - Review for 1 week to tune alert sensitivity
2. ✅ **Test alert delivery** - Confirm SMS/email alerts work when issue occurs
3. **Register with healthchecks.io** - Meta-monitoring for server failures

### Medium Priority (Next Month)
4. **Add swap space** - If you want browser-based tests later
5. **Build monitoring dashboard** - If you want visual interface

### Low Priority (Nice to Have)
6. Fix SMS webhook test 404 error
7. Export metrics to external storage for longer retention

---

## Verification Checklist

Before considering monitoring "complete":

- [x] Monitoring service running as systemd service
- [x] All 18 scheduler jobs active
- [x] HTTP health checks passing (backend, frontend, API)
- [x] Alert phone numbers configured (+61410663673)
- [x] Alert emails configured (hello@thunderbird.bot, andrew_hall_home@icloud.com)
- [x] Twilio credentials configured for SMS alerts
- [x] Resend API key configured for email alerts
- [x] Daily/weekly/monthly reports scheduled
- [x] Self-monitoring heartbeat active
- [ ] Received test alert (manual test recommended)
- [ ] Dashboard accessible (optional - can skip)
- [ ] Browser tests working (optional - requires swap)
- [ ] External meta-monitoring configured (recommended)

---

## Quick Reference Commands

**Check monitoring status:**
```bash
systemctl status thunderbird-monitoring
curl http://localhost:8001/api/monitoring/status
```

**View logs:**
```bash
tail -100 /var/log/thunderbird-monitoring.log
journalctl -u thunderbird-monitoring -f
```

**Restart service:**
```bash
sudo systemctl restart thunderbird-monitoring
```

**Check scheduler jobs:**
```bash
journalctl -u thunderbird-monitoring | grep "Scheduler started" | tail -1
```

**View recent alerts:**
```bash
journalctl -u thunderbird-monitoring | grep -i alert | tail -20
```

---

## Support & Troubleshooting

**If monitoring stops:**
1. Check service status: `systemctl status thunderbird-monitoring`
2. Check logs: `journalctl -u thunderbird-monitoring -n 50`
3. Common issues:
   - Out of memory: Add swap or restart service
   - Database locked: Restart service
   - Missing credentials: Check `/etc/default/thunderbird-monitoring`

**If not receiving alerts:**
1. Check Twilio credentials: `grep TWILIO /etc/default/thunderbird-monitoring`
2. Test Twilio manually: Send test SMS via Twilio console
3. Check alert manager logs: `grep AlertManager /var/log/thunderbird-monitoring.log`

**If checks failing:**
1. Check if services are actually down: `systemctl status thunderbird-api thunderbird-web`
2. Check API endpoint directly: `curl https://thunderbird.bot/api/health`
3. Review check thresholds in monitoring code if false positives

---

**Last Updated:** 2026-02-04
**Monitoring Version:** v1.0
**Deployed By:** Phase 9 completion
