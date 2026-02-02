# E2E SMS Testing for US/Canada

This module provides automated end-to-end SMS testing using real Twilio numbers.
It validates the complete SMS flow from user message to weather response.

## Why Twilio-to-Twilio Testing?

Satellite SMS (iPhone 14+ via Globalstar) arrives at Twilio **identically** to
regular cellular SMS. The satellite routing happens entirely on Apple's side:

```
iPhone → Globalstar Satellite → Apple Servers → Carrier → Twilio
                                                              ↓
                                            (Standard SMS from here)
```

By testing with real Twilio numbers sending to our Thunderbird number, we
validate 100% of what Thunderbird controls:

- Phone number → country detection
- Country → weather provider routing (NWS for US, EnvCanada for CA)
- Weather API integration
- Response formatting
- SMS segment optimization
- Billing/pricing calculations

## Setup

### 1. Purchase Test Numbers (~$2.50/month total)

```bash
# Via Twilio Console or API
# US Number (e.g., +1-415-XXX-XXXX) - $1.15/month
# CA Number (e.g., +1-604-XXX-XXXX) - $1.30/month
```

### 2. Configure Test Numbers

Point both test numbers to the response capture webhook:

```
Webhook URL: https://your-staging.com/test-webhook/sms
HTTP Method: POST
```

### 3. Set Environment Variables

```bash
# .env.test
TWILIO_TEST_ACCOUNT_SID=your_test_sid
TWILIO_TEST_AUTH_TOKEN=your_test_token
THUNDERBIRD_NUMBER=+1234567890
US_TEST_NUMBER=+14155551234
CA_TEST_NUMBER=+16045551234
TEST_WEBHOOK_BASE_URL=https://your-staging.com
```

### 4. Run Tests

```bash
# Run full test suite
python -m tests.e2e_sms.runner --all

# Run US tests only
python -m tests.e2e_sms.runner --country US

# Run specific test
python -m tests.e2e_sms.runner --test yosemite_cast7

# Dry run (don't send SMS, just validate config)
python -m tests.e2e_sms.runner --dry-run
```

## Test Cases

### US Tests (NWS Provider)
| Test ID | Command | Location | Validates |
|---------|---------|----------|-----------|
| us_yosemite_cast7 | CAST7 37.7459,-119.5332 | Yosemite | NWS 7-day GPS |
| us_rainier_cast7 | CAST7 46.8523,-121.7603 | Mt Rainier | NWS high altitude |
| us_grandcanyon_cast7 | CAST7 36.0544,-112.1401 | Grand Canyon | NWS desert |
| us_colorado_cast12 | CAST 39.5501,-105.7821 | Colorado | NWS 12hr GPS |
| us_help | HELP | N/A | Help from US number |

### Canada Tests (Environment Canada Provider)
| Test ID | Command | Location | Validates |
|---------|---------|----------|-----------|
| ca_banff_cast7 | CAST7 51.4254,-116.1773 | Banff | EnvCanada 7-day GPS |
| ca_whistler_cast7 | CAST7 50.1163,-122.9574 | Whistler | EnvCanada mountains |
| ca_vancouver_cast12 | CAST 49.2827,-123.1207 | Vancouver | EnvCanada 12hr GPS |
| ca_help | HELP | N/A | Help from CA number |

### Edge Cases
| Test ID | Command | Validates |
|---------|---------|-----------|
| segment_count | CAST7 37.7459,-119.5332 | Response <= 8 segments |
| invalid_coords | CAST7 999.0,999.0 | Error handling |
| empty_body | (empty) | Unknown command response |

## Response Validation

Each test validates:
1. **Response received** - SMS came back within timeout
2. **Content correct** - Contains expected elements (temp, wind, etc.)
3. **Provider correct** - Used NWS for US, EnvCanada for CA
4. **Segment count** - Within acceptable limits for satellite
5. **No errors** - No error messages in response

## CI/CD Integration

Add to your GitHub Actions workflow:

```yaml
e2e-sms-tests:
  runs-on: ubuntu-latest
  if: github.ref == 'refs/heads/main'  # Only on main
  steps:
    - uses: actions/checkout@v4
    - name: Run E2E SMS Tests
      env:
        TWILIO_TEST_ACCOUNT_SID: ${{ secrets.TWILIO_TEST_ACCOUNT_SID }}
        TWILIO_TEST_AUTH_TOKEN: ${{ secrets.TWILIO_TEST_AUTH_TOKEN }}
        # ... other env vars
      run: |
        cd backend
        python -m tests.e2e_sms.runner --all --ci
```

## Costs

- US Twilio number: ~$1.15/month
- CA Twilio number: ~$1.30/month
- SMS (send): $0.0079/segment (US), $0.0075/segment (CA)
- SMS (receive): Free on test numbers

Estimated monthly cost for daily test runs: **< $5/month**

## Field Testing

For satellite-specific validation (one-time, pre-launch), see:
`docs/SATELLITE_FIELD_TEST_PROTOCOL.md`
