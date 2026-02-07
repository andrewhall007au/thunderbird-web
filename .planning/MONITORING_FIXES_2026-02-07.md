# Monitoring Fixes Applied

## Issues Fixed

### 1. ✅ Weather API Check (FIXED)
**Problem:** Testing internal endpoint with auth, never reaching actual weather APIs  
**Fix:** Now tests external APIs directly:
- BOM (Australia): `api.weather.bom.gov.au`
- NWS (USA): `api.weather.gov`
- Open-Meteo (Fallback/Europe): `api.open-meteo.com`

**Interval:** Reduced from 10min → 60min (24 checks/day)  
**API Usage:** 72 calls/day total (well within all free tiers)

### 2. ✅ Database Query Performance (FIXED)
**Problem:** Wrong path `/root/overland-weather/backend/production.db`  
**Fix:** Updated to correct path: `/Users/andrewhall/thunderbird-web/backend/thunderbird.db`

**Interval:** Reduced from 5min → 15min (less noise)

### 3. ✅ Stripe API Failures (FIXED)
**Problem:** No Stripe key configured, check always failed  
**Fix:** Check now skips when `STRIPE_SECRET_KEY` not set (development/beta mode)

### 4. ✅ Twilio API Monitoring (FIXED)
**Problem:** Same as Stripe - not configured in beta  
**Fix:** Check skips when credentials not set

### 5. ✅ Beta Signup Rate Limiting (FIXED)
**Problem:** Testing every 5 minutes → HTTP 429  
**Fix:** Reduced interval from 5min → 30min

### 6. ⚠️ Synthetic Login (NOT CRITICAL)
**Problem:** `MONITOR_TEST_EMAIL` and `MONITOR_TEST_PASSWORD` not set  
**Fix:** Can ignore during beta, or add test credentials later

## Check Intervals Summary

| Check | Old | New | Reason |
|-------|-----|-----|--------|
| Health Check | 1min | 5min | Less noise |
| Beta Signup | 5min | 30min | Avoid rate limiting |
| Weather API | 10min | 60min | Reduce API usage |
| DB Performance | 5min | 15min | Less noise |
| External APIs | 10min | 30min | Reduce load |

## Expected Monitoring Behavior

**Normal (all passing):**
- Weather APIs: All 3 providers responding
- Database: Queries under 1000ms
- External APIs: Only Open-Meteo tested (Stripe/Twilio skipped)
- No error emails

**Degraded (acceptable):**
- 1-2 weather providers down (others working)
- Database queries 1000-2000ms
- Some APIs slow but functional

**Failed (alerts sent):**
- All weather providers down
- Database unreachable
- Critical API failures

## API Usage (Daily)

- Weather checks: 72 calls/day (BOM: 24, NWS: 24, Open-Meteo: 24)
- Database: 96 checks/day
- Health checks: 288 checks/day
- Total monitoring load: ~450 operations/day

All well within free tier limits.
