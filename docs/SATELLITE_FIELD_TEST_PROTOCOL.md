# Satellite SMS Field Test Protocol

This document provides a comprehensive protocol for manually testing the iPhone satellite SMS experience with Thunderbird. This is a **one-time validation** to confirm end-to-end functionality before launch.

## Why Field Testing?

While our automated Twilio-to-Twilio tests validate 100% of Thunderbird's codebase, a field test validates the **Apple/carrier satellite pathway** which we cannot simulate:

```
┌─────────────────────────────────────────────────────────────────┐
│                    FIELD TEST VALIDATES                          │
│                                                                  │
│  iPhone    →   Globalstar   →   Apple    →   Carrier   →  Twilio │
│  (no cell)     Satellite        Servers      Network             │
│                                                                  │
│  • Satellite connection reliability                              │
│  • Real-world latency (30-60s expected)                          │
│  • Message delivery under tree cover                             │
│  • Response delivery back via satellite                          │
│  • User experience / device prompts                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Pre-Test Requirements

### Device Requirements

| Requirement | Details |
|-------------|---------|
| **Device** | iPhone 14, 14 Plus, 14 Pro, 14 Pro Max, or newer |
| **iOS Version** | iOS 18.0 or later |
| **Satellite Eligibility** | Device activated before September 2025 cutoff |
| **iMessage** | Can be enabled (satellite SMS works regardless) |
| **Battery** | > 50% charge (satellite connection uses more power) |

### Account Requirements

| Requirement | Details |
|-------------|---------|
| **Thunderbird Account** | Active account with linked phone number |
| **Balance** | Minimum $5 balance for test commands |
| **Phone Verified** | Phone number linked in account settings |

### Location Requirements

| Requirement | Details |
|-------------|---------|
| **Cellular Coverage** | **ZERO bars** - airplane mode won't work, need real no-coverage |
| **Sky Visibility** | Clear view of sky (not under dense tree canopy or buildings) |
| **Country** | United States, Canada, Mexico, or Japan |

#### Suggested US Test Locations

| Location | Coordinates | Notes |
|----------|-------------|-------|
| Yosemite backcountry | 37.7459, -119.5332 | Many areas without coverage |
| Grand Canyon inner rim | 36.0544, -112.1401 | Below rim = no cell |
| Olympic NP interior | 47.8021, -123.6044 | Wilderness areas |
| Big Bend NP | 29.2500, -103.2500 | Remote desert |

#### Suggested Canada Test Locations

| Location | Coordinates | Notes |
|----------|-------------|-------|
| Banff backcountry | 51.4254, -116.1773 | Beyond Lake Louise |
| Jasper wilderness | 52.8737, -118.0814 | Interior trails |
| Gros Morne interior | 49.5810, -57.7517 | Remote Newfoundland |

---

## Test Protocol

### Phase 1: Pre-Departure Setup (At Home)

**Time: 15 minutes**

1. **Verify Device Eligibility**
   ```
   Settings → General → About
   Confirm: iPhone 14 or newer

   Settings → General → Software Update
   Confirm: iOS 18.0 or later
   ```

2. **Test Demo Mode** (Optional familiarization)
   ```
   Settings → Emergency SOS → Try Demo
   Practice pointing phone at satellites
   ```

3. **Verify Thunderbird Account**
   - Log in to thunderbird.bot
   - Confirm phone number is linked
   - Check balance is > $5
   - Note the Thunderbird SMS number: `+1-XXX-XXX-XXXX`

4. **Prepare Test Commands**

   Save these to Notes app for easy copy-paste:
   ```
   CAST7 [YOUR_GPS_COORDS]
   CAST [YOUR_GPS_COORDS]
   HELP
   ```

5. **Download Offline Maps**
   - Download Google Maps offline for test area
   - Or use pre-downloaded hiking app (Gaia, AllTrails)

### Phase 2: At Test Location

**Time: 30-45 minutes**

#### Step 1: Confirm No Cellular Coverage

```
[ ] Phone shows "No Service" or "SOS" in status bar
[ ] Cannot make regular phone call
[ ] Cannot send regular SMS
[ ] WiFi is OFF
```

**Important:** Airplane mode does NOT enable satellite. You need actual no-coverage.

#### Step 2: Note Current GPS Coordinates

Open Maps or Compass app and record:
```
Latitude:  _____________
Longitude: _____________
Elevation: _____________ (optional)
Time:      _____________
```

#### Step 3: Open Messages App

1. Start new message to Thunderbird number
2. Type your first test command
3. **DO NOT SEND YET** - observe the interface

#### Step 4: Initiate Satellite Connection

When you tap Send with no cellular:

1. iPhone should detect satellite mode
2. You'll see "Send via Satellite" prompt
3. Follow on-screen guidance to point at satellite
4. Connection indicator will show progress

**Record:**
```
[ ] "Send via Satellite" prompt appeared: YES / NO
[ ] Time to first satellite connection: _______ seconds
[ ] Required pointing adjustment: YES / NO
```

#### Step 5: Execute Test Commands

**Test 1: CAST7 GPS Forecast (Primary Test)**
```
Command:    CAST7 [lat],[lon]
Sent at:    __:__:__
Received at: __:__:__
Round-trip:  _______ seconds

Response received: YES / NO
Response readable: YES / NO
Contains weather data: YES / NO
Segment count (estimate): _____
```

**Test 2: CAST 12-Hour Forecast**
```
Command:    CAST [lat],[lon]
Sent at:    __:__:__
Received at: __:__:__
Round-trip:  _______ seconds

Response received: YES / NO
Response readable: YES / NO
```

**Test 3: HELP Command**
```
Command:    HELP
Sent at:    __:__:__
Received at: __:__:__
Round-trip:  _______ seconds

Response received: YES / NO
Contains command list: YES / NO
```

#### Step 6: Edge Case Tests (Optional)

**Test 4: Under Light Tree Cover**
```
Location: Under sparse trees (can still see sky)
Command:  CAST7 [coords]
Result:   SUCCESS / FAILED / PARTIAL
Notes:    ___________________________
```

**Test 5: Second Message Without Reconnecting**
```
Sent second message immediately after first response
Required new satellite connection: YES / NO
Time to send: _______ seconds
```

### Phase 3: Document Results

**Complete this form before leaving test location:**

```
SATELLITE SMS FIELD TEST REPORT
================================

Tester Name: ____________________
Date:        ____________________
Location:    ____________________
GPS Coords:  ____________________

Device:
- Model:       ____________________
- iOS Version: ____________________
- Carrier:     ____________________

Test Results Summary:
- Tests Attempted:  ___
- Tests Successful: ___
- Tests Failed:     ___

Timing:
- Avg satellite connection time: _______ sec
- Avg round-trip time:           _______ sec
- Longest round-trip:            _______ sec

Issues Encountered:
_________________________________________
_________________________________________

Overall Assessment:
[ ] PASS - All critical tests successful
[ ] PARTIAL - Some tests failed, investigate
[ ] FAIL - Critical functionality broken

Screenshots Attached: YES / NO
```

---

## Success Criteria

### Must Pass (Launch Blockers)

| Test | Criteria |
|------|----------|
| CAST7 GPS | Response received within 5 minutes |
| CAST7 GPS | Response contains valid weather data |
| Response Delivery | Response arrives on same satellite session |

### Should Pass (Non-Blockers)

| Test | Criteria |
|------|----------|
| HELP command | Response received |
| Round-trip time | < 120 seconds typical |
| Multiple commands | Don't require full reconnection |

### Nice to Have

| Test | Criteria |
|------|----------|
| Light tree cover | Still works under sparse canopy |
| Response segments | Fits comfortably on screen |

---

## Troubleshooting

### "Send via Satellite" Option Doesn't Appear

1. Confirm truly no cellular (not just weak signal)
2. Check iOS version is 18.0+
3. Verify device is iPhone 14 or newer
4. Check satellite eligibility hasn't expired
5. Try moving to more open sky area

### Satellite Connection Fails

1. Ensure clear sky view (no buildings, dense trees)
2. Follow on-screen pointing guidance precisely
3. Hold phone steady during connection
4. Try different time of day (satellite positions change)

### Message Sent But No Response

1. Wait full 5 minutes (satellite can be slow)
2. Check Thunderbird account is active
3. Verify phone number is linked correctly
4. Check account has balance

### Response Appears Truncated

1. This is expected for long forecasts
2. Note the segment count
3. Report in test results for format optimization

---

## Post-Test Actions

1. **Upload test report** to project documentation
2. **File issues** for any failures discovered
3. **Update STATE.md** with test completion date
4. **Share screenshots** of successful exchanges

---

## Appendix: Test Command Reference

```
# 7-day forecast for GPS coordinates
CAST7 37.7459,-119.5332

# 12-hour forecast for GPS coordinates
CAST 37.7459,-119.5332

# 24-hour forecast
CAST24 37.7459,-119.5332

# Help/command reference
HELP

# Check current units
UNITS

# Change to imperial
UNITS IMPERIAL

# Change to metric
UNITS METRIC
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-02 | Initial protocol |
