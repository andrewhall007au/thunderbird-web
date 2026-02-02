# Field Test Guide

## For Field Testers (Super Simple!)

### Option 1: One-Tap iOS Shortcut (Recommended)

1. **Download the Shortcut**
   - Open this link on your iPhone: `[shortcut link]`
   - Tap "Add Shortcut"

2. **Add to Home Screen**
   - Open Shortcuts app
   - Long-press "Thunderbird Test"
   - Tap "Add to Home Screen"

3. **Run the Test**
   - Go to a location with NO cell service
   - Tap the shortcut icon
   - Wait for tests to complete (~15-20 min)
   - Results are logged automatically

### Option 2: Manual SMS (Also Simple)

1. **Go to satellite-only location**
2. **Open Messages**
3. **Send to Thunderbird number:**
   ```
   FIELDTEST
   ```
   Or with your coordinates:
   ```
   FIELDTEST 37.7,-122.4
   ```
4. **Wait for test sequence** (~15-20 min)
5. **Receive summary when done**

---

## iOS Shortcut Setup (Manual Creation)

If you need to create the shortcut manually:

### Step 1: Create New Shortcut
1. Open **Shortcuts** app
2. Tap **+** to create new shortcut
3. Name it "Thunderbird Test"

### Step 2: Add Actions

**Action 1: Get Current Location**
- Search for "Get Current Location"
- Add it

**Action 2: Format Message**
- Add "Text" action
- Enter: `FIELDTEST [Latitude],[Longitude]`
- Replace placeholders with location variables

**Action 3: Send Message**
- Add "Send Message" action
- Recipient: Thunderbird number (+61...)
- Message: Use the text from Action 2

**Action 4: Show Alert**
- Add "Show Alert" action
- Title: "Test Started"
- Message: "Field test running. Results in ~15 minutes."

### Step 3: Add to Home Screen
1. Tap shortcut settings (...)
2. "Add to Home Screen"
3. Choose an icon (🌩️ recommended)

---

## What Happens During the Test

When you send `FIELDTEST`, the system automatically runs 8 tests:

| # | Test | What It Does |
|---|------|--------------|
| 1 | Basic Connectivity | Sends HELP command |
| 2 | Account Status | Checks your account |
| 3 | Forecast Legend | Gets forecast key |
| 4 | GPS Forecast | 12-hour forecast at your location |
| 5 | 24-Hour Forecast | Extended forecast |
| 6 | 7-Day Forecast | Week-long summary |
| 7 | Route Listing | Lists your trail |
| 8 | Final Connectivity | Confirms connection still works |

**Each test:**
- Sends a command
- Waits for response
- Validates response format
- Records latency
- Moves to next test

**At the end, you receive:**
```
FIELD TEST COMPLETE
Session: abc123
Result: 8/8 PASSED
Avg Latency: 2.3s

✓ Basic Connectivity: 1.8s
✓ Account Status: 2.1s
✓ Forecast Legend: 1.5s
✓ GPS Forecast: 2.8s
✓ 24-Hour Forecast: 3.2s
✓ 7-Day Forecast: 4.1s
✓ Route Listing: 1.9s
✓ Final Connectivity: 1.2s

Results logged for monitoring.
```

---

## Commands Reference

| Command | Description |
|---------|-------------|
| `FIELDTEST` | Start test at current location |
| `FIELDTEST 37.7,-122.4` | Start test with specific coordinates |
| `FIELDTEST STATUS` | Check test progress |
| `FIELDTEST CANCEL` | Cancel running test |

---

## Tips for Field Testing

### Location Selection
- **Must have NO cellular signal**
- iPhone will show "Satellite" or "SOS" indicator
- Clear view of sky helps satellite connection
- Test multiple locations if possible

### Best Practices
- Charge phone to 50%+ before testing
- Enable screen recording for evidence
- Note exact coordinates and time
- Take photo of location
- Test at different times of day

### Troubleshooting

**Test times out:**
- Satellite connection may be poor
- Try moving to area with clearer sky view
- Wait a few minutes and try again

**Some tests fail:**
- Check which specific tests failed
- Report with session ID to support

**Can't start test:**
- May have existing session running
- Send `FIELDTEST CANCEL` first

---

## For Administrators

### Monitoring Dashboard

Access the live dashboard at:
```
https://api.thunderbird.app/field-test/dashboard
```

Features:
- Real-time test progress
- Pass/fail rates
- Latency statistics
- Geographic coverage
- Test history

### API Endpoints

```
GET /field-test/api/sessions      # List all sessions
GET /field-test/api/sessions/{id} # Session detail
GET /field-test/api/stats         # Aggregate statistics
```

### Sample API Response

```json
{
  "id": "abc123",
  "phone": "****0001",
  "started_at": "2026-02-02T10:00:00Z",
  "location": {
    "lat": 37.7456,
    "lon": -122.4194,
    "country": "US"
  },
  "tests": [
    {
      "id": "help",
      "name": "Basic Connectivity",
      "status": "passed",
      "latency_seconds": 1.8
    }
  ],
  "passed": 8,
  "failed": 0,
  "total": 8,
  "avg_latency_seconds": 2.3,
  "is_complete": true
}
```

---

## Test Locations by Region

### United States
| Location | Coordinates | Notes |
|----------|-------------|-------|
| Death Valley NP | 36.5054, -117.0794 | Excellent satellite visibility |
| Yosemite Backcountry | 37.7456, -119.5936 | Good coverage |
| Grand Canyon (inner) | 36.0544, -112.1401 | Canyon may limit satellite |

### Canada
| Location | Coordinates | Notes |
|----------|-------------|-------|
| Banff Backcountry | 51.1784, -115.5708 | Good coverage |
| Whistler Alpine | 50.1163, -122.9574 | Excellent |

### Australia
| Location | Coordinates | Notes |
|----------|-------------|-------|
| Western Arthurs | -43.20, 146.18 | Limited satellite (southern latitude) |
| Overland Track | -41.68, 146.04 | Moderate coverage |

---

## Version History

- **v1.0** (2026-02-02): Initial field test automation
