# Testing Strategy: US/Canada SMS Validation

**Created:** 2026-02-02
**Status:** Infrastructure complete, testing not yet run

## Overview

This document describes the comprehensive testing strategy for validating Thunderbird's SMS functionality in the US and Canadian markets, including satellite SMS compatibility.

## Key Insight: Satellite SMS = Regular SMS (at Twilio)

**Critical understanding:** From Thunderbird's perspective, satellite SMS is identical to regular cellular SMS. The satellite routing happens entirely on Apple's side:

```
┌─────────────────────────────────────────────────────────────────┐
│                    APPLE'S DOMAIN                                │
│  iPhone (no cell) → Globalstar → Apple Servers → Carrier        │
└──────────────────────────────────────┬──────────────────────────┘
                                       │
                                       ▼ (Standard SMS from here)
┌─────────────────────────────────────────────────────────────────┐
│                    THUNDERBIRD'S DOMAIN                          │
│  Twilio → Webhook → Weather API → Response Format → SMS Back    │
└─────────────────────────────────────────────────────────────────┘
```

This means **Twilio-to-Twilio automated testing validates 100% of Thunderbird's code**. Field testing with actual satellite is a one-time validation of Apple's infrastructure, not Thunderbird's.

---

## Testing Layers

### Layer 1: Unit & Integration Tests (Automated, CI)

**Location:** `backend/tests/`

```bash
# GPS routing tests (58 tests)
pytest tests/test_gps_international.py -v

# Weather provider tests
pytest tests/test_weather_providers.py -v

# Weather routing tests
pytest tests/test_weather_router.py -v

# SMS pricing tests
pytest tests/test_sms_pricing.py -v
```

**What these validate:**
- US coordinates → NWS provider routing
- CA coordinates → Environment Canada routing
- Phone number parsing (+1 area codes → US vs CA)
- GPS command parsing (`CAST7 40.71,-74.00`)
- Normalized forecast → CellForecast conversion
- SMS segment calculations for US/CA pricing

### Layer 2: E2E SMS Tests (Automated, Twilio-to-Twilio)

**Location:** `backend/tests/e2e_sms/`

**Setup required:**
1. Purchase US Twilio number (~$1.15/month)
2. Purchase CA Twilio number (~$1.30/month)
3. Configure webhook on test numbers
4. Set environment variables

**Run tests:**
```bash
# All tests
python -m tests.e2e_sms.runner --all

# US tests only
python -m tests.e2e_sms.runner --country US

# Canada tests only
python -m tests.e2e_sms.runner --country CA

# Dry run (validate config)
python -m tests.e2e_sms.runner --dry-run

# CI mode (exit code reflects status)
python -m tests.e2e_sms.runner --all --ci
```

**What these validate:**
- Real SMS delivery via Twilio
- Full webhook processing
- Live weather API responses (NWS, EnvCanada)
- Response formatting and segment counts
- Complete round-trip timing

**Test cases included:**

| Test ID | Country | Command | Location |
|---------|---------|---------|----------|
| us_yosemite_cast7 | US | CAST7 37.7459,-119.5332 | Yosemite |
| us_rainier_cast7 | US | CAST7 46.8523,-121.7603 | Mt Rainier |
| us_grandcanyon_cast7 | US | CAST7 36.0544,-112.1401 | Grand Canyon |
| ca_banff_cast7 | CA | CAST7 51.4254,-116.1773 | Banff |
| ca_whistler_cast7 | CA | CAST7 50.1163,-122.9574 | Whistler |
| ca_grosmorne_cast7 | CA | CAST7 49.5810,-57.7517 | Gros Morne |

### Layer 3: Field Test (Manual, One-Time)

**Location:** `docs/SATELLITE_FIELD_TEST_PROTOCOL.md`

**Purpose:** Validate Apple's satellite SMS pathway works end-to-end. This is a one-time pre-launch validation, not ongoing regression testing.

**Requirements:**
- iPhone 14+ with iOS 18+
- Location with NO cellular coverage
- Thunderbird account with balance

**What this validates:**
- Satellite connection reliability
- Real-world latency (30-60s expected)
- Response delivery back via satellite
- User experience / device prompts

---

## Test Infrastructure Files

```
backend/tests/e2e_sms/
├── __init__.py           # Module init
├── README.md             # Setup instructions
├── config.py             # Test case definitions
├── harness.py            # Core test logic
├── webhook.py            # Response capture endpoint
└── runner.py             # CLI test runner

docs/
└── SATELLITE_FIELD_TEST_PROTOCOL.md   # Field test checklist
```

---

## Environment Variables for E2E Tests

```bash
# .env.test
TWILIO_TEST_ACCOUNT_SID=your_test_sid
TWILIO_TEST_AUTH_TOKEN=your_test_token
THUNDERBIRD_NUMBER=+1234567890      # Main Thunderbird number
US_TEST_NUMBER=+14155551234         # US test number (purchased)
CA_TEST_NUMBER=+16045551234         # CA test number (purchased)
TEST_WEBHOOK_BASE_URL=https://staging.thunderbird.bot
```

---

## CI/CD Integration

Add to GitHub Actions:

```yaml
e2e-sms-tests:
  runs-on: ubuntu-latest
  if: github.ref == 'refs/heads/main'
  steps:
    - uses: actions/checkout@v4
    - name: Run E2E SMS Tests
      env:
        TWILIO_TEST_ACCOUNT_SID: ${{ secrets.TWILIO_TEST_ACCOUNT_SID }}
        TWILIO_TEST_AUTH_TOKEN: ${{ secrets.TWILIO_TEST_AUTH_TOKEN }}
        THUNDERBIRD_NUMBER: ${{ secrets.THUNDERBIRD_NUMBER }}
        US_TEST_NUMBER: ${{ secrets.US_TEST_NUMBER }}
        CA_TEST_NUMBER: ${{ secrets.CA_TEST_NUMBER }}
        TEST_WEBHOOK_BASE_URL: ${{ secrets.STAGING_URL }}
      run: |
        cd backend
        python -m tests.e2e_sms.runner --all --ci --json report.json
    - name: Upload test report
      uses: actions/upload-artifact@v4
      with:
        name: e2e-sms-report
        path: backend/report.json
```

---

## Cost Estimates

| Item | Monthly Cost |
|------|--------------|
| US Twilio number | $1.15 |
| CA Twilio number | $1.30 |
| SMS (send, ~50/month) | ~$0.50 |
| **Total** | **~$3/month** |

---

## Pre-Launch Checklist

### Automated Testing
- [ ] Run full unit test suite (pytest)
- [ ] Purchase US Twilio test number
- [ ] Purchase CA Twilio test number
- [ ] Configure test webhook endpoint
- [ ] Run E2E SMS tests for US locations
- [ ] Run E2E SMS tests for CA locations
- [ ] Verify all tests pass

### Field Testing (One-Time)
- [ ] Identify field test location (no cellular)
- [ ] Schedule field test trip
- [ ] Execute field test protocol
- [ ] Document results
- [ ] File issues for any failures

### Launch Confidence
- [ ] Unit tests: PASS
- [ ] E2E SMS tests: PASS
- [ ] Field test: PASS (or documented acceptable gaps)

---

## Confidence Levels

| Test Layer | Coverage | Confidence |
|------------|----------|------------|
| Unit/Integration | Thunderbird code | 100% |
| E2E SMS (Twilio) | Full SMS path | 95% |
| Field Test | Satellite pathway | 5% (Apple's domain) |

**Bottom line:** Twilio-to-Twilio automated testing provides extremely high confidence. Field testing is a validation of Apple's infrastructure, which is outside our control regardless.

---

## Related Documents

- `backend/tests/e2e_sms/README.md` - Detailed E2E test setup
- `docs/SATELLITE_FIELD_TEST_PROTOCOL.md` - Field test checklist
- `.planning/REQUIREMENTS.md` - v1 requirements traceability
