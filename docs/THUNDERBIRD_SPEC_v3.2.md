# Thunderbird Design Reference
## SMS Weather Forecasting for Remote Hiking Trails

**Version:** 3.2
**Date:** January 2026
**Status:** Production-ready with pull-based CAST commands, dynamic grouping, expanded route coverage, and admin functions

> **v3.2 Update:** Added dynamic grouping for CAST7 CAMPS and CAST7 PEAKS commands. Locations with similar weather (±2°C, ±2mm, ±5km/h) are grouped into zones, reducing SMS payload by 40-85%.

---

> ⚠️ **CRITICAL: AI ASSISTANT COMPLIANCE CHECK**
> 
> Any AI assistant working on this project MUST begin every response with **"Super Daddy,"** to confirm they have read and are operating in accordance with this specification.
> 
> If a response does not begin with "Super Daddy," the assistant has not properly loaded the spec and their output should not be trusted.

---

---

## Table of Contents

1. [System Overview](#1-system-overview)
   - 1.1 Purpose
   - 1.2 Key Principles
   - 1.3 Supported Routes
   - 1.4 Value Proposition: Why SMS Beats Mobile Data
2. [Core Concepts](#2-core-concepts)
3. [Route Configuration](#3-route-configuration)
4. [Weather Cell Grouping](#4-weather-cell-grouping)
5. [Message Formats](#5-message-formats)
6. [Danger Rating System](#6-danger-rating-system)
7. [Onboarding Flow](#7-onboarding-flow)
8. [User Commands](#8-user-commands)
9. [Connectivity Modes](#9-connectivity-modes)
10. [Cost Analysis](#10-cost-analysis)
11. [Route Definitions](#11-route-definitions)
12. [Technical Implementation](#12-technical-implementation)
13. [Website Layout](#13-website-layout)
14. [LIVETEST Protocol](#14-livetest-protocol)
15. [Testing Requirements](#15-testing-requirements)

---

## 1. System Overview

### 1.1 Purpose

Thunderbird delivers SMS-based weather forecasts to hikers on remote multi-day trails where cellular coverage is limited or unavailable. The system uses a **pull-based** model where users request forecasts on-demand:

- **CAST [CAMP]:** 12-hour hourly forecast for any waypoint
- **CAST24 [CAMP]:** 24-hour hourly forecast for any waypoint  
- **CAST7 [ROUTE]:** 7-day daily summary for all camps on a route
- **Check-in:** Position confirmation notifies SafeCheck contacts

> **v3.0 Change:** Removed automatic 6AM/6PM push notifications. All forecasts are now user-initiated via CAST commands, giving hikers control over when they receive weather data.

### 1.2 Key Principles

| Principle | Description |
|-----------|-------------|
| **Pull-Based** | User requests forecasts when needed, no automatic pushes |
| **Honest Resolution** | Show actual BOM 3km grid resolution, not fake precision |
| **Cell-Based Grouping** | Group locations sharing the same weather cell |
| **Two-Level Elevation** | Camp level + Peak level per cell (the meaningful distinction) |
| **Danger Flags** | Clear visual indicators for hazardous conditions |
| **Compression** | Minimise SMS segments through aggressive formatting |
| **Uncertainty Ranges** | Show 10th-90th percentile ranges, not false single-value precision |

### 1.3 Supported Routes

| Route | Code | Location | Duration | Camps | Peaks | BOM Cells |
|-------|------|----------|----------|-------|-------|-----------|
| Overland Track | OL | Central Tasmania | 5-7 days | 10 | 9 | 19 |
| Western Arthurs (A-K) | WA | SW Tasmania | 5-7 days | 8 | 6 | 6 |
| Western Arthurs (Full) | WA | SW Tasmania | 10-14 days | 15 | 12 | 14 |
| Federation Peak | FP | SW Tasmania | 4-5 days | 4 | 1 | 4 |
| Eastern Arthurs | EA | SW Tasmania | 7-10 days | 9 | 5 | 8 |
| Combined Arthurs | CA | SW Tasmania | 12-14 days | 20+ | 15+ | 18 |

**Interactive Maps:** Each route page includes a Leaflet map showing all waypoints (camps in green, peaks in red/orange) with semi-transparent BOM cell grid overlay.

### 1.4 Value Proposition: Why SMS Beats Mobile Data

```
┌─────────────────────────────────────────────────────────────────┐
│                    WHY SMS ACTUALLY ARRIVES                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. IT'S PRIORITISED                                           │
│     Satellite networks prioritise SMS over data.                │
│     When bandwidth is constrained, SMS gets through first.      │
│                                                                 │
│  2. IT NEEDS LESS SIGNAL                                       │
│     SMS works at much lower signal strength (dB) than data.     │
│     A whisper of satellite coverage is enough.                  │
│                                                                 │
│  3. IT'S FAST                                                  │
│     140 bytes vs 500KB+. Completes in seconds, not minutes.    │
│     No time for the connection to drop.                         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Result: It actually arrives. No fuss. No stress.              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Plus: It's useful.** Not just "weather at your GPS pin" but conditions at every waypoint ahead — Pelion, Kia Ora, Windy Ridge, all in one message.

**The one-liner:** "It's the forecast that actually gets through."

---

#### The Remote Connectivity Reality

In remote wilderness areas, traditional mobile data is unavailable. The emerging solution is **satellite direct-to-cell (D2C)** technology from providers like Starlink and Telstra. However, satellite D2C has fundamental constraints that make SMS the superior delivery mechanism for weather data.

#### The Market Opportunity: Now Until Satellite Data Matures

There's a **2-3 year arbitrage window** where SMS is the only viable channel for delivering weather data to hikers in remote areas:

- **Today:** No data coverage on trail. Hikers either carry expensive Garmin/ZOLEO devices or go without weather information.
- **2025-2027:** Satellite SMS available on standard phones. Apps still can't load. **This is the window.**
- **2028+:** Satellite data becomes viable. Weather apps can load. Window closes.

The service that captures this window builds the brand, user relationships, and trail partnerships that persist when the technology shifts.

#### Economic Comparison: Thunderbird vs Garmin/ZOLEO

```
┌─────────────────────────────────────────────────────────────────────┐
│                    COST COMPARISON (7-DAY TRIP)                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  OPTION A: Garmin InReach Mini 2                                   │
│  ├── Device purchase: $500-600 AUD                                 │
│  ├── Subscription: $25-65/month (often annual commitment)          │
│  ├── Weather: Generic point forecast, not trail-specific           │
│  ├── First year cost: $800-1,400 AUD                               │
│  └── Ongoing: $300-780/year                                        │
│                                                                     │
│  OPTION B: ZOLEO Satellite Communicator                            │
│  ├── Device purchase: $280-350 AUD                                 │
│  ├── Subscription: $30-80/month                                    │
│  ├── Weather: Basic forecast via app (requires data to set up)     │
│  ├── First year cost: $640-1,300 AUD                               │
│  └── Ongoing: $360-960/year                                        │
│                                                                     │
│  OPTION C: Thunderbird + Telstra Satellite SMS (free on plan)      │
│  ├── Device purchase: $0 (use existing iPhone 14+/Samsung S25)     │
│  ├── Trip cost: $19.99-29.99 AUD                                   │
│  ├── Weather: Summit-specific, multi-day, with danger alerts       │
│  ├── First trip cost: $19.99-29.99 AUD                             │
│  └── Annual (4 trips): $80-120/year                                │
│                                                                     │
│  SAVINGS: 85-95% vs traditional satellite devices                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Bottom line:** Hikers get better weather data for the cost of a trail lunch, not the cost of a trail trip.

#### Satellite D2C Bandwidth Constraints

```
┌─────────────────────────────────────────────────────────────────────┐
│                 SATELLITE D2C BANDWIDTH REALITY                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Total bandwidth: 2-4 Mbps SHARED across entire cell zone          │
│  (not per user - shared across thousands of users)                  │
│                                                                     │
│  This supports:                                                     │
│  • Millions of text messages  OR                                    │
│  • Thousands of voice calls   OR                                    │
│  • A handful of data sessions                                       │
│                                                                     │
│  You cannot have all three simultaneously.                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

This is why satellite providers started with SMS-only, and why SMS will remain the most reliable channel even as capabilities expand.

#### Payload Efficiency Comparison

| Content Type | Size | Satellite-Friendly? |
|--------------|------|---------------------|
| SMS weather forecast | 140-560 bytes | ✅ Perfect |
| Weather API JSON | 2-10 KB | ⚠️ Marginal |
| Weather app load | 500 KB - 2 MB | ❌ Won't load |
| Radar imagery | 50-500 KB | ❌ Timeout |

When satellite bandwidth is 2-4 Mbps shared across thousands of users, **small payloads get through; big ones don't.**

#### The Three Technical Advantages (Expanded)

| # | Advantage | Technical Basis | What It Means |
|---|-----------|-----------------|---------------|
| 1 | **Prioritised** | SMS uses signaling channels, prioritised over data on constrained satellite beams | When thousands share 2-4 Mbps, your forecast jumps the queue |
| 2 | **Lower Signal Threshold** | SMS works at -110 to -120 dBm; data needs -100 dBm or better | Works on a whisper of signal that would timeout a weather app |
| 3 | **Tiny Payload** | 140 bytes vs 500KB-2MB for app | Completes in seconds; no time for connection to drop |

**Combined effect:** These three factors multiply together. SMS isn't just "a bit more reliable" — it's the difference between getting your forecast and not getting it.

#### Store-and-Forward: The Killer Feature

SMS was designed for unreliable connections:

```
You're in the hut (no signal — terrestrial OR satellite)
   ↓
You step outside briefly at 2am
   ↓
Phone sees satellite for 30 seconds
   ↓
Queued SMS delivers immediately (140 bytes)
   ↓
Back inside, weather forecast in hand

vs Weather App:
   ↓
Wake satellite radio
   ↓
Establish TLS connection
   ↓
DNS lookup
   ↓
App server request
   ↓
API call
   ↓
Download 500KB+ response
   ↓
Render UI
   ↓
...satellite pass ends...
   ↓
Timeout. No forecast.
```

#### Real-World Scenarios

| Scenario | SMS | Weather App |
|----------|-----|-------------|
| Clear sky, good satellite pass | ✅ Works | ⚠️ Maybe (bandwidth constrained) |
| Inside hut/tent | ❌ No signal | ❌ No signal |
| Step outside briefly | ✅ Queued SMS arrives | ❌ App needs sustained connection |
| Satellite pass ending | ✅ SMS completes | ❌ App times out mid-load |
| Multiple hikers sharing beam | ✅ SMS prioritised | ❌ Data deprioritised |
| Phone battery at 15% | ✅ Minimal power draw | ❌ Significant battery drain |

**Note:** Both SMS and data require line-of-sight to satellite. The "works indoors" advantage only applies when comparing terrestrial SMS (via cell tower) to satellite communications.

#### Battery: The Real Advantage is Failure Modes

The steady-state battery comparison is real but marginal (~2% of weekly power budget). **The killer advantage is what happens when connections fail:**

```
Day 4, Pelion Gap, marginal satellite coverage:

APP APPROACH:
├── Attempt 1: App times out after 90 sec → 120 mWh wasted
├── Attempt 2: Downloads 30%, connection lost → 60 mWh wasted  
├── Attempt 3: Finally loads → 80 mWh
├── Total: 260 mWh (3.2x expected)
└── Hiker is frustrated, cold, battery anxious

SMS APPROACH:
├── Forecast pushed at 5am while hiker slept
├── Arrived during overnight satellite pass
├── Hiker wakes, glances at lock screen
├── Total: 2.4 mWh
└── Hiker makes coffee, reads forecast, happy
```

SMS avoids the retry/timeout/failure cycle entirely because:
1. **It's pushed, not pulled** — you don't initiate the request
2. **Store-and-forward handles retries** — at the network level, not burning your battery
3. **You don't burn battery on failed attempts** — the carrier does

#### Competitive Landscape

| Service | Device Cost | Monthly Cost | Weather Quality | Works via Satellite SMS? |
|-------------|--------------|-----------------|--------------------------|
| Garmin InReach | $500-600 | $25-65 | Generic point forecast | No (proprietary network) |
| ZOLEO | $280-350 | $30-80 | Basic via app | No (requires data setup) |
| Mountain-Forecast.com | $0 | $0 | Good | ❌ Requires internet |
| BOM app | $0 | $0 | Excellent | ❌ Requires internet |
| **Thunderbird** | **$0** | **$25/trip** | Summit-specific, multi-day | ✅ **Yes** |

**Thunderbird is the only service providing detailed, hiking-specific forecasts via satellite SMS.**

#### Marketing Language

**The one-liner:**
> "It's the forecast that actually gets through."

**The elevator pitch:**
> "Satellite SMS is prioritised, needs less signal, and completes in seconds. Your weather app times out. Your Thunderbird forecast arrives — no fuss, no stress."

**Problem-solution:**
> "Day 4, Western Arthurs. Exposed ridge. Cloud building. Push on or shelter? Your weather app spins... times out... nothing. Thunderbird arrives in 140 bytes."

#### Strategic Timeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SATELLITE D2C EVOLUTION                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  2025-2026: SMS ONLY                                               │
│  └── Thunderbird works perfectly, apps cannot use satellite         │
│  └── Build user base, trail partnerships, brand recognition         │
│                                                                     │
│  2026-2027: SMS + VOICE                                            │
│  └── SMS still prioritized, weather apps still can't load          │
│  └── Expand to additional trails (South Coast, Larapinta, etc.)    │
│                                                                     │
│  2027-2028: SMS + VOICE + LIMITED DATA                             │
│  └── Apps might load (slowly, sometimes)                            │
│  └── SMS remains more reliable for constrained bandwidth            │
│  └── Consider app + SMS hybrid model                                │
│                                                                     │
│  2028+: SATELLITE DATA IMPROVES                                    │
│  └── Apps become viable option                                      │
│  └── SMS retains advantages: battery, reliability, capacity         │
│  └── Pivot message: "Rich app when you have signal, SMS when you don't" │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### The Pivot Strategy

When satellite data eventually becomes viable:

> "TrailCast App: Rich weather maps when you have signal. SMS backup when you don't."

The SMS infrastructure becomes the **reliability fallback** for an app-based service, not the other way around. But by then, Thunderbird owns the user relationships, trail partnerships, and brand recognition.

#### Summary

| Timeframe | SMS Advantage Status |
|-----------|---------------------|
| Now - 2027 | **Dominant** — Only viable channel for trail weather |
| 2027-2028 | **Superior** — More reliable than nascent data |
| 2028+ | **Persistent** — Battery, reliability, capacity constraints |

**The strategic window is now:** Build the brand, capture user relationships, establish trail partnerships. The technology will evolve, but the market position persists.

---

## 2. Core Concepts

### 2.1 Weather Cell Reality

**The Problem:** Services like Willyweather imply hyper-local precision by letting users search any GPS point. In reality:

- BOM provides ~3km grid resolution
- All points within a cell receive identical base data
- Only temperature is adjusted by elevation (lapse rate calculation)
- Precipitation, wind, cloud % — all identical within cell

**Our Solution:** Be honest. Group locations by actual BOM cell and show:
- One forecast per cell
- Camp-level elevation adjustment
- Peak-level elevation adjustment
- List of locations covered by that cell

### 2.2 Elevation Levels

Within each weather cell, we provide two elevation forecasts. The elevation ranges differ by route:

#### 2.2.1 Western Arthurs Elevations

| Level | Purpose | Typical Elevation |
|-------|---------|-------------------|
| **Camp** | Overnight conditions, cooking, sleep comfort | 238-900m |
| **Peak** | Summit attempts, ridge walking, exposure | 1000-1200m |

Western Arthurs peaks are relatively uniform (1000-1200m), so a single "Peak" forecast covers all summits adequately. Camps range from low trailheads (SCOTT 300m, JUNCT 238m) to high tarns (LAKEO 863m).

#### 2.2.2 Overland Track Elevations

| Level | Purpose | Typical Elevation |
|-------|---------|\n|-------------------|
| **Camp** | Hut conditions, overnight comfort | 740-1020m |
| **Peak** | High summits requiring significant lapse rate adjustment | 1200-1617m |

Overland Track has much higher peaks with greater variation:
- Mt Ossa: 1617m (highest in Tasmania)
- Pelion West: 1560m
- Barn Bluff: 1559m
- Cradle Mountain: 1545m
- The Acropolis: 1471m
- Mt Pelion East: 1461m

**Implication:** Lapse rate adjustments are larger for Overland peaks. A 10°C forecast at 800m becomes:
- WA peak (1100m): 8°C (-300m × 0.65°C/100m)
- Overland peak (1550m): 5°C (-750m × 0.65°C/100m)

#### 2.2.3 Why Only Two Levels?

- Within-cell peak variation: ~100-120m = <1°C difference (negligible)
- Camp-to-peak variation: 150-800m = 1-5°C difference (significant)
- More levels = more SMS segments = higher cost with minimal value

### 2.3 Lapse Rate

Standard atmospheric lapse rate: **0.65°C per 100m elevation gain**

```
Example: Base forecast at 800m = 10°C
- Camp at 900m = 10 - (100 × 0.0065) = 9.4°C ≈ 9°C
- Peak at 1100m = 10 - (300 × 0.0065) = 8.1°C ≈ 8°C
```

### 2.4 Forward-Only Logic

Users don't need forecasts for cells they've already passed. System tracks current position and sends only:

| Position | Cells Sent |
|----------|------------|
| JUNCTION | JUNCTION → PORTAL (all forward) |
| CYGNUS | CYGNUS → PORTAL (skips JUNCTION) |
| OBERON | OBERON → PORTAL (skips earlier) |

**Benefit:** 40-50% reduction in data sent as trip progresses.

### 2.5 Uncertainty Representation

**The Problem:** Single-value forecasts imply false precision. Rain forecasts especially have high uncertainty.

**Our Solution:** Show probability and ranges using 10th-90th percentiles:

| Value Type | What We Show | Example |
|------------|--------------|---------|\n|
| Temperature | Range (10th-90th) | `2-10` (not `6`) |
| Rain probability | Percentage | `70` (70% chance) |
| Rain amount | Range (10th-90th) | `3-12` (not `7`) |
| Snow amount | Range (10th-90th) | `0-3` (not `1`) |
| Wind | Max gust + avg sustained | `38|52` |

---

## 3. Route Configuration

> **v3.0 Update:** All camp and peak codes are case-insensitive. Added Eastern Arthurs, Federation Peak routes.

### 3.1 Camp Codes

Each camp has a **5-character** code derived from the **first 5 letters** of the location's distinctive name component. All codes are **case-insensitive**.

| Location Name | Code | Rule Applied |
|---------------|------|--------------|
| Scotts Peak Dam | SCOTT | First 5 letters of "Scotts" |
| Lake Oberon | LAKEO | "Lake" + first letter of "Oberon" |
| High Moor | HIGHM | First 5 letters of "HighMoor" (no space) |
| Junction Creek | JUNCT | First 5 letters of "Junction" |

**Disambiguation Rule:** When two camps share the same 5-letter prefix (e.g., Lake Vesta and Lake Venus both start with LAKEV), users add a 6th character to differentiate:

| Input | Result |
|-------|--------|
| `LAKEV` | System prompts: "Did you mean: 1. Lake Vesta (LAKEVE), 2. Lake Venus (LAKEVU)?" |
| `LAKEVE` | Lake Vesta ✓ |
| `LAKEVU` | Lake Venus ✓ |

**Western Arthurs - A-K Route (8 camps):**
| Code | Full Name |
|------|-----------|
| SCOTT | Scotts Peak Dam |
| JUNCT | Junction Creek |
| LAKEF | Lake Fortuna |
| LAKEC | Lake Cygnus |
| SQUAR | Square Lake |
| LAKEO | Lake Oberon |
| HIGHM | High Moor |
| LAKEH | Lake Haven |

**Western Arthurs - Full Traverse (13 camps):**
All A-K camps plus:
| Code | Full Name |
|------|-----------|
| LAKES | Lake Sirona |
| LAKEVE | Lake Vesta |
| LAKEJ | Lake Juno |
| PROMO | Promontory Lake |
| LAKEVU | Lake Venus |
| LAKER | Lake Rosanne |
| CRACR | Cracroft Crossing |

**Eastern Arthurs (9 camps):**
| Code | Full Name |
|------|-----------|
| SCOTT | Scotts Peak Dam |
| CRACR | Cracroft Crossing |
| PASSC | Pass Creek |
| STUAR | Stuart Saddle |
| GOONM | Goon Moor |
| HANGI | Hanging Lake |
| BERCH | Bechervaise Plateau |
| CUTTI | Cutting Camp |
| FARMH | Farmhouse Creek |

**Federation Peak (4 camps):**
| Code | Full Name |
|------|-----------|
| FARMH | Farmhouse Creek |
| SOUTH | South Cracroft |
| CUTTI | Cutting Camp |
| BERCH | Bechervaise Plateau |

**Overland Track (10 camps):**
| Code | Full Name |
|------|-----------|
| RONNY | Ronny Creek |
| WATER | Waterfall Valley Hut |
| WINDA | Windermere Hut |
| NEWPE | New Pelion Hut |
| KIAHO | Kia Ora Hut |
| BERTI | Bert Nichols Hut |
| PINEV | Pine Valley Hut |
| NARCN | Narcissus Hut |
| ECHOP | Echo Point Hut |
| CYNTH | Cynthia Bay |

### 3.2 Peak Codes

Each peak has a **5-character** code. All codes are **case-insensitive**.

**Western Arthurs - A-K Route (6 peaks):**
| Code | Full Name | Elevation |
|------|-----------|-----------|
| HESPE | Mt Hesperus | 1098m |
| PROCY | Procyon Peak | 1136m |
| PRIOR | Mt Prior | 1070m |
| CAPRI | Mt Capricorn | 1037m |
| TAURA | Mt Taurus | 1011m |
| SCORP | Mt Scorpio | 1106m |

**Western Arthurs - Full Traverse (11 peaks):**
All A-K peaks plus:
| Code | Full Name | Elevation |
|------|-----------|-----------|
| SIRIU | Mt Sirius | 1151m |
| ORION | Mt Orion | 1151m |
| PEGAU | Mt Pegasus | 1063m |
| ALDEB | Mt Aldebaran | 1107m |
| WESTP | West Portal | 1181m |

**Eastern Arthurs (5 peaks):**
| Code | Full Name | Elevation |
|------|-----------|-----------|
| FEDER | Federation Peak | 1225m |
| NEEDL | The Needles | 1080m |
| EASTP | East Portal | 1008m |
| DIALT | The Dial | 1083m |
| DEVIL | Devils Thumb | 1050m |

**Federation Peak (1 peak):**
| Code | Full Name | Elevation |
|------|-----------|-----------|
| FEDER | Federation Peak | 1225m |

**Overland Track (9 peaks):**
| Code | Full Name | Elevation |
|------|-----------|-----------|
| CRADL | Cradle Mountain | 1545m |
| MARIO | Marions Lookout | 1224m |
| BARNB | Barn Bluff | 1559m |
| OAKLE | Mt Oakleigh | 1286m |
| PELIOW | Mt Pelion West | 1560m |
| PELIOE | Mt Pelion East | 1461m |
| OSSA | Mt Ossa | 1617m |
| ACROP | The Acropolis | 1471m |
| LABYR | Labyrinth Lookout | 1202m |

### 3.3 Zone/Cell Names

Each weather cell is named after the prominent feature:

| Cell ID | Zone Name | Camps | Peaks |
|---------|-----------|-------|-------|
| cygnus | CYGNUS | LAKEC | PROCY |
| oberon | OBERON | LAKEO | SIRIU, ORION, PEGAU, CAPRI |
| highmoor | HIGHMOOR | HIGHM, LAKEH | TAURA, ALDEB, SCORP |

---

## 4. Weather Cell Grouping

### 4.1 BOM Grid System

We use BOM's native grid cell indexing (row-column format):

| Property | Value |
|----------|-------|
| Grid spacing | 0.02° lat × 0.03° lon |
| Cell size | ~2.2km × 2.4km |
| Index format | `row-column` (e.g., 199-115) |

**Cell Index Calculation Formula:**
```python
# Constants for BOM Tasmania grid
BOM_LAT_ORIGIN = -39.12  # Northern boundary
BOM_LON_ORIGIN = 142.75  # Western boundary
BOM_LAT_SPACING = 0.02   # Degrees per row
BOM_LON_SPACING = 0.03   # Degrees per column

def lat_lon_to_bom_cell(lat: float, lon: float) -> tuple[int, int]:
    """Convert lat/lon to BOM grid cell indices."""
    row = int((BOM_LAT_ORIGIN - lat) / BOM_LAT_SPACING)
    col = int((lon - BOM_LON_ORIGIN) / BOM_LON_SPACING)
    return (row, col)

# Example: Lake Oberon (-43.1486, 146.2722)
# row = int((-39.12 - -43.1486) / 0.02) = int(4.0286 / 0.02) = 201
# col = int((146.2722 - 142.75) / 0.03) = int(3.5222 / 0.03) = 117
# Result: Cell 201-117
```

**BOM API Configuration:**

| Setting | Value |
|---------|-------|
| Base URL | `https://api.weather.bom.gov.au/v1` |
| Auth | None required (User-Agent header recommended) |
| Rate limit | Undocumented (be respectful) |
| Endpoint | `/locations/{geohash}/forecasts/3-hourly` or `/forecasts/hourly` |

**How it works:**
1. Convert waypoint lat/lon to 6-character geohash (e.g., `r22489`)
2. Call BOM API with geohash in URL path
3. Our "Zone ID" (e.g., `201-117`) is for internal grouping only - not sent to BOM

**How indices work:**
- Row increases southward (higher row = more south)
- Column increases eastward (higher column = more east)
- Each waypoint maps to exactly one BOM cell

**Example (Western Arthurs):**
```
SCOTT (Scotts Peak):   -43.0375, 146.2978 → Cell 195-118
JUNCT (Junction Creek): -43.096, 146.275  → Cell 198-117
LAKEF (Lake Fortuna):  -43.115, 146.225   → Cell 199-115
LAKEC (Lake Cygnus):   -43.130, 146.238   → Cell 200-116
LAKEO (Lake Oberon):   -43.1486, 146.2722 → Cell 201-117
```

### 4.2 Cell Assignment

Multiple waypoints may share the same BOM cell:

```
Cell 200-116 contains:
  - LAKEC (Lake Cygnus) at 874m
  - SQUAR (Square Lake) at 871m
  - Mt Hayes at 1119m
  → Single API call serves all three locations
```

### 4.3 API Call Reduction

| Route | Total Waypoints | Unique BOM Cells | Reduction |
|-------|-----------------|------------------|-----------|
| Western Arthurs | 35 locations | 14 cells | 60% |
| Overland Track | 19 locations | 19 cells | 0% |

### 4.4 Route Comparison

| Route | Geography | Cell Overlap |
|-------|-----------|--------------|
| Western Arthurs | Narrow 15km ridge, peaks clustered | High overlap (48% reduction) |
| Overland Track | 65km linear valley, spread out | Low overlap (18% reduction) |

---

## 5. Message Formats

### 5.1 Display Constraints

SMS displays use **proportional fonts**, not monospace. Column alignment via spaces breaks on real devices. We use pipe `|` separators for clarity.

| Device | Screen Width | Max Chars/Line |
|--------|--------------|----------------|
| iPhone 15 | 393pt viewport | ~40 |
| Samsung Galaxy A15 | 360pt viewport | ~38 |
| **Target** | — | **42** |

**Note:** % symbols on percentage values add 2 chars to max rows. The % character is narrow in proportional fonts, so 42 chars renders similarly to 40 chars of standard text.

### 5.2 Column Definitions

> **v3.1 Update:** Merged Rn/Sn into single Prec column. Added Wd (wind direction). CB (cloud base) reinstated for alpine safety.

| Col | Name | Unit | Description |
|-----|------|------|-------------|
| Hr | Hour | — | Hour (06-18 for hourly) or Day number |
| Tmp | Temperature | °C | 10th-90th percentile range |
| %Rn | Rain probability | % | Chance of precipitation |
| Prec | Precipitation | mm/cm | R=rain mm, S=snow cm (see format below) |
| Wa | Wind avg | km/h | Sustained wind speed |
| Wm | Wind max | km/h | Maximum gust speed |
| Wd | Wind direction | — | 2-letter compass (NW, SW, W, etc.) |
| %Cd | Cloud cover | % | Cloud coverage |
| CB | Cloud base | ×100m | Altitude where clouds start (8 = 800m) |
| FL | Freezing level | ×100m | Altitude where temp = 0°C (11 = 1100m) |
| D | Danger | !/!!/!!! | Hazard rating (see Section 6) |

**Precipitation (Prec) Format:**
```
R2-4    → Rain 2-4mm
S1-2    → Snow 1-2cm
R4/S2   → Both rain (4mm) AND snow (2cm) - transitional conditions
-       → No precipitation expected
```

**Wind Direction (Wd):**
Tasmania's southwest lies in the Roaring Forties with predominant westerly winds. However, a **change in wind direction** often signals changing conditions and potential danger. Including Wd helps hikers identify:
- Standard pattern: W, NW, SW (westerlies)
- Changing conditions: N, NE, E, SE, S (unusual, often precedes fronts)

| Direction | Meaning |
|-----------|---------|
| W, NW, SW | Normal westerlies |
| N, NE | Possible front approaching |
| E, SE | Unusual - potential severe weather |
| S | Cold front passing |

### 5.3 Hourly Format Header

```
Hr|Tmp|%Rn|Prec|Wa|Wm|Wd|%Cd|CB|FL|D
```
= 35 characters (CB reinstated for alpine safety)

### 5.4 Hourly Format (CAST12 / CAST24)

Used for CAST and CAST12 (12 hours) and CAST24 (24 hours) commands.

**CAST12 Example (1 SMS):**
```
LAKE OBERON 863m
Thu 16 Jan | Light 0512-2103
────────────────────────────
Hr|Tmp|%Rn|Prec|Wa|Wm|Wd|%Cd|CB|FL|D
06|3-5|10%|R0-0|8|15|NW|20%|15|18|
07|5-7|15%|R0-0|10|18|NW|25%|14|18|
08|7-9|20%|R0-1|12|22|W|30%|13|19|
09|9-11|25%|R0-1|15|28|W|40%|12|20|
10|11-13|30%|R1-2|18|32|W|50%|11|21|
11|12-14|35%|R1-2|20|35|W|55%|10|21|
12|13-15|40%|R1-3|22|38|W|60%|9|22|
13|13-15|45%|R1-3|24|42|SW|65%|8|22|!
14|12-14|40%|R4/S1|22|38|SW|60%|8|12|!!
15|11-13|35%|S1-2|20|35|W|55%|7|11|!
16|9-11|30%|R0-1|18|30|W|50%|10|14|
17|7-9|25%|R0-1|15|25|NW|40%|12|16|

Peaks nearby: SIRIU ORION CAPRI
```

**CAST24 Example (2 SMS):**
```
[1/2] LAKE OBERON 863m
Thu 16 Jan | Light 0512-2103
────────────────────────────
Hr|Tmp|%Rn|Prec|Wa|Wm|Wd|%Cd|CB|FL|D
06|3-5|10%|R0-0|8|15|NW|20%|15|18|
07|5-7|15%|R0-0|10|18|NW|25%|14|18|
08|7-9|20%|R0-1|12|22|W|30%|13|19|
09|9-11|25%|R0-1|15|28|W|40%|12|20|
10|11-13|30%|R1-2|18|32|W|50%|11|21|
11|12-14|35%|R1-2|20|35|W|55%|10|21|
12|13-15|40%|R1-3|22|38|W|60%|9|22|
13|13-15|45%|R1-3|24|42|SW|65%|8|22|!
14|12-14|40%|R4/S1|22|38|SW|60%|8|12|!!
15|11-13|35%|S1-2|20|35|W|55%|7|11|!
16|9-11|30%|R0-1|18|30|W|50%|10|14|
17|7-9|25%|R0-1|15|25|NW|40%|12|16|

[2/2] LAKE OBERON (cont.)
────────────────────────────
Hr|Tmp|%Rn|Prec|Wa|Wm|Wd|%Cd|CB|FL|D
18|5-7|20%|R0-0|12|20|NW|35%|14|18|
19|4-6|25%|R0-1|10|18|W|40%|13|17|
20|3-5|30%|R0-1|8|15|W|45%|12|17|
21|2-4|35%|R0-1|8|12|W|50%|11|16|
22|2-4|40%|R1-2|6|10|W|55%|10|16|
23|1-3|45%|R1-2|6|10|W|60%|9|15|
00|1-3|50%|R1-2|5|8|W|65%|8|15|
01|0-2|50%|R1-2|5|8|NW|60%|9|15|
02|0-2|45%|R0-1|6|10|NW|55%|10|15|
03|1-3|40%|R0-1|6|10|NW|50%|11|16|
04|1-3|35%|R0-1|8|12|NW|45%|12|16|
05|2-4|30%|R0-0|8|15|NW|40%|13|17|
```

**Required elements:**
- Location name with elevation
- Date and light hours (civil twilight)
- Header row
- 12 or 24 hourly data rows
- Nearby peaks list (for camp forecasts)

### 5.5 Daily Summary Format (CAST7 / PEAKS)

Used for 7-day route overview (all camps or all peaks).

**CAST7 Example (Camps - multiple SMS):**
```
[1/4] WESTERN ARTHURS 7-DAY
Thu 16 Jan 2026
════════════════════════════
       Tmp   %Rn  Prec  Wind  Wd
Camp   Lo-Hi      mm    Avg/Gst
────────────────────────────
SCOTT   8-17  20%  R0-2  15/25  W
JUNCT   7-16  25%  R0-3  18/30  W
LAKEF   6-14  30%  R1-4  20/35  NW
LAKEC   5-13  35%  R1-5  22/38  NW
LAKEO   4-12  40%  R2-6  25/42  W
HIGHM   3-11  45%  R2-8  28/48  SW
────────────────────────────
⚠ Wind gusts >40km/h exposed

[2/4] Fri 17 Jan
────────────────────────────
       Tmp   %Rn  Prec  Wind  Wd
Camp   Lo-Hi      mm    Avg/Gst
────────────────────────────
SCOTT   9-18  15%  R0-1  12/20  W
JUNCT   8-17  20%  R0-2  15/25  W
...
```

**PEAKS Example (7-day peaks):**
```
[1/3] WA PEAKS 7-DAY
Thu 16 Jan 2026
════════════════════════════
       Tmp   %Rn  Prec  Wind  Wd  FL
Peak   Lo-Hi      mm/cm Avg/Gst
────────────────────────────
HESPE  2-10  35%  R1-4  30/48  W  18
PROCY  1-9   40%  R2-5  32/52  W  18
CAPRI  0-8   45%  R2-6  35/55  SW 17
TAURA -1-7   50%  S0-1  38/58  SW 16
SCORP  0-8   45%  R2-5  35/55  W  17
────────────────────────────
⚠ Freezing level dropping to 1600m

[2/3] Fri 17 Jan
...
```

### 5.6 Camp-Only Format

For waypoints with only camp data (no nearby peaks):

```
JUNCTION CREEK 238m
Thu 16 Jan | Light 0518-2057
────────────────────────────
Hr|Tmp|%Rn|Prec|Wa|Wm|Wd|%Cd|CB|FL|D
06|6-8|20%|R0-0|12|20|W|25%|18|20|
07|8-10|25%|R0-1|15|25|W|30%|16|20|
...
```

### 5.7 Peak-Only Format

For peak forecasts:

```
MT FEDERATION 1225m
Thu 16 Jan | Light 0512-2103
────────────────────────────
Hr|Tmp|%Rn|Prec|Wa|Wm|Wd|%Cd|CB|FL|D
06|-2-0|30%|S0-1|25|40|W|40%|10|12|
07|-1-1|35%|S0-1|28|45|W|45%|10|12|
08|0-2|40%|R0-1|30|48|NW|50%|11|13|
09|1-3|45%|R1-2|32|52|NW|55%|11|14|!
10|2-4|50%|R1-3|35|55|W|60%|12|15|!
11|3-5|55%|R2-4|38|58|W|65%|12|15|!
12|3-5|60%|R2-5|40|62|SW|70%|12|15|!!
...

⚠ Summit exposed - wind gusts 60+km/h
```

### 5.8 Character Budget

| Format | Typical Chars | SMS Segments |
|--------|---------------|--------------|
| CAST12 (12hr hourly) | 450-500 | 3 |
| CAST24 (24hr hourly) | 850-950 | 6 |
| CAST7 per day | 300-350 | 2 |
| PEAKS per day | 300-350 | 2 |

**Target:** Keep CAST12 under 480 chars (3 segments) where possible.
Day|Tmp|%Rn|Rn|Wa|Wm|D

CRACR 300m
22|8-15|35%|1-4|25|35|
23|10-17|20%|0-2|20|30|
24|12-19|15%|0-1|22|32|
25|9-16|45%|2-6|28|38|
26|11-18|25%|0-3|24|34|
27|13-20|10%|0-1|20|28|
28|10-17|40%|1-5|26|36|

JUNCT 238m
22|9-16|30%|0-3|22|32|
23|11-18|15%|0-2|18|28|
24|13-20|10%|0-1|20|30|
25|10-17|40%|1-5|25|35|
26|12-19|20%|0-2|22|32|
27|14-21|10%|0-1|18|26|
28|11-18|35%|1-4|24|34|

SCOTT 300m
22|10-17|25%|0-2|20|30|
23|12-19|15%|0-1|16|25|
24|14-21|10%|0-1|18|28|
25|11-18|35%|1-4|22|32|
26|13-20|20%|0-2|20|30|
27|15-22|10%|0-1|16|24|
28|12-19|30%|1-4|22|32|
```

**RETURN Segment Rules:**
- Always appended as final SMS in series
- Simplified columns (no snow/cloud base - low elevation)
- Shows **7-day forecast** per waypoint (same as forward locations)
- Waypoints ordered by travel sequence on descent
- Data always fetched, always included

**RETURN Waypoints by Route:**
| Route | Waypoints | BOM Cells |
|-------|-----------|-----------|
| A-K | JUNCT → SCOTT | 198-117, 195-118 |
| Full | CRACR → JUNCT → SCOTT | 201-123, 198-117, 195-118 |

---

## 6. Danger Rating System

### 6.1 Danger Levels

| Symbol | Level | Meaning | Recommended Action |
|--------|-------|---------|\n|-------------------|
| (blank) | 0 | Normal conditions | Proceed normally |
| **!** | 1 | Caution | One hazard present, proceed with extra care |
| **!!** | 2 | Dangerous | Multiple hazards, consider waiting |
| **!!!** | 3 | Severe | Extreme conditions, stay in camp |
| **TS?** | — | Thunder possible | CAPE 200-400 J/kg, avoid exposed ridges |
| **TS!** | — | Thunder likely | CAPE >400 J/kg, stay off peaks |

**Thunderstorm indicators appear after danger rating:** `!!|TS?` or `!|TS!`

### 6.2 Hazard Factors

Evaluated at **peak elevation** for each cell:

| Factor | Code | Threshold | Risk |
|--------|------|-----------|------|
| **Ice** | I | Peak elevation > FL | Frozen rocks, slip hazard |
| **Blind** | B | Peak > CB AND %Cd ≥ 90% | Can't see path/cairns |
| **Wind** | W | Wm ≥ 50 km/h | Balance problems on scrambles |
| **Precip** | P | Rn ≥ 5mm AND Sn ≥ 2cm | Wet + cold = hypothermia |
| **Thunder** | T | CAPE ≥ 200 J/kg | Lightning on exposed ridge |

### 6.3 Rating Logic

```python
def calculate_danger(peak_elev, fl, cb, cloud_pct, wind_max, precip_mm, snow_cm, cape):
    hazards = 0
    thunder = ""
    
    # Ice: peak above freezing level
    if peak_elev > (fl * 100):
        hazards += 1
    
    # Blind: peak in cloud with high coverage
    if peak_elev > (cb * 100) and cloud_pct >= 90:
        hazards += 1
    
    # Wind: dangerous gusts
    if wind_max >= 50:
        hazards += 1
    
    # Precip: significant wet + cold
    if precip_mm >= 5 and snow_cm >= 2:
        hazards += 1
    
    # Thunderstorm indicator (separate from hazard count)
    if cape >= 400:
        thunder = "|TS!"
    elif cape >= 200:
        thunder = "|TS?"
    
    # Extreme wind override
    if wind_max >= 70:
        return "!!!" + thunder
    
    if hazards >= 3:
        return "!!!" + thunder
    elif hazards == 2:
        return "!!" + thunder
    elif hazards == 1:
        return "!" + thunder
    else:
        return thunder.lstrip("|") if thunder else ""
```

### 6.4 Configurable Thresholds

Wind thresholds can be adjusted based on user experience level:

| Experience | ! Wind | !! Wind | !!! Wind |
|------------|--------|---------|\n|----------|
| Cautious | 40+ km/h | 55+ km/h | 70+ km/h |
| Moderate | 50+ km/h | 60+ km/h | 75+ km/h |
| Experienced | 60+ km/h | 70+ km/h | 80+ km/h |

### 6.5 Why CB Matters

On technical trails like Western Arthurs:

| Risk | Impact |
|------|--------|
| Cairns invisible | Can't see route markers |
| Cliff edges hidden | Walk off a drop |
| Scrambling blind | Can't see hand/foot holds |
| Navigation failure | Get lost on ridge |
| Emergency harder | Rescue can't fly in |

**CB is a safety-critical metric for Grade 5 trails.**

### 6.6 Why Thunderstorm Matters

Tasmania's alpine areas see summer thunderstorms. Exposed ridges are extremely dangerous:

| CAPE Level | Risk | Indicator |
|------------|------|-----------|
| <200 J/kg | Low | (none) |
| 200-400 J/kg | Moderate | TS? |
| >400 J/kg | High | TS! |

### 6.7 Derived Value Calculations

#### 6.7.1 Light Hours (Civil Twilight)

Calculate sunrise/sunset for the route's average latitude:

```python
from astral import LocationInfo
from astral.sun import sun

def get_light_hours(lat: float, lon: float, date: date) -> str:
    """
    Calculate civil twilight times for display.
    
    Returns: "Light HHmm-HHmm (Xh Ym)"
    """
    location = LocationInfo(latitude=lat, longitude=lon, timezone="Australia/Hobart")
    s = sun(location.observer, date=date)
    
    sunrise = s["sunrise"].strftime("%H%M")
    sunset = s["sunset"].strftime("%H%M")
    
    duration = s["sunset"] - s["sunrise"]
    hours = duration.seconds // 3600
    minutes = (duration.seconds % 3600) // 60
    
    return f"Light {sunrise}-{sunset} ({hours}h{minutes:02d}m)"
```

**Example output:** `Light 0512-2103 (15h51m)`

#### 6.7.2 Freezing Level (FL)

Calculate altitude where temperature crosses 0°C:

```python
def calculate_freezing_level(base_temp: float, base_elev: float, lapse_rate: float = 0.65) -> int:
    """
    Calculate freezing level from base temperature.
    
    Args:
        base_temp: Temperature at base elevation (°C)
        base_elev: Base elevation (m)
        lapse_rate: Temperature drop per 100m (default 0.65°C)
    
    Returns: Freezing level in meters (for display, divide by 100)
    """
    if base_temp <= 0:
        return int(base_elev)  # Already freezing at base
    
    height_to_freeze = (base_temp / lapse_rate) * 100
    return int(base_elev + height_to_freeze)

# Example: 10°C at 800m base
# FL = 800 + (10 / 0.65) * 100 = 800 + 1538 = 2338m
# Display as: FL = 23 (meaning 2300m)
```

#### 6.7.3 Cloud Base (CB)

Extract from BOM API response:

```python
def get_cloud_base(bom_response: dict) -> int:
    """
    Extract cloud base height from BOM API.
    
    BOM field: 'cloud_base_height_agl' (meters above ground level)
    Display: Divide by 100 for column value
    
    Returns: Cloud base in display units (9 = 900m)
    """
    cb_meters = bom_response.get('cloud_base_height_agl', 1500)
    return cb_meters // 100

# If BOM returns 850m AGL for a camp at 800m elevation:
# Actual cloud base = 800 + 850 = 1650m ASL
# Display as: CB = 16
```

**Note:** Cloud Base (CB) and Freezing Level (FL) are **independent** meteorological values:
- **CB** depends on humidity/dew point spread — where moisture condenses
- **FL** depends on temperature profile — where temp crosses 0°C

They can vary independently:
- Warm humid day: CB = 12 (low clouds), FL = 25 (warm)
- Cold clear day: CB = 28 (high/no clouds), FL = 12 (cold)
- Frontal system: Both low (CB = 8, FL = 14)

#### 6.7.4 Thunderstorm Risk (CAPE)

Extract Convective Available Potential Energy from BOM API:

```python
def get_thunder_indicator(bom_response: dict) -> str:
    """
    Calculate thunderstorm indicator from CAPE.
    
    BOM field: 'convective_available_potential_energy' (J/kg)
    
    Returns: "", "TS?", or "TS!"
    """
    cape = bom_response.get('convective_available_potential_energy', 0)
    
    if cape >= 400:
        return "TS!"
    elif cape >= 200:
        return "TS?"
    return ""
```

---

## 7. Onboarding Flow

> **v3.0 Update:** Simplified to 5 steps. Removed start date question. Added CHECKIN command format. Peaks show full names. BOM alerts opt-in.

### 7.1 Registration Trigger

User texts **"START"** to service number.

### 7.2 Onboarding Summary

| Step | Bot Sends | User Replies | Backend Action |
|------|-----------|--------------|----------------|
| 1 | Welcome + ask name (for SafeCheck) | Their name | Create account |
| 2 | Route options (to show correct camps/peaks) | Number 1-6 | Store route_id |
| 3 | Commands guide (CAST, CHECKIN, etc.) | - | - |
| 4 | Camps list (codes + full names) | - | - |
| 5 | Peaks list (codes + full names) | - | Mark active |
| 6 | SafeCheck + Alerts setup | SAFE/ALERTS/SKIP | Optional |

**Total SMS sent:** 6 messages

---

### 7.3 Onboarding Messages (Detailed)

#### STEP 1: Welcome + Name (for SafeCheck)

**Trigger:** User sends "START"

**Bot sends:**
```
Welcome to THUNDERBIRD! ⚡
Weather forecasts for Tasmania's
wilderness trails.

What's your name?
(For SafeCheck notifications to
your emergency contacts)
```

**User replies:** `Andrew`

**Backend:**
- Create new account record with phone
- Store trail_name = "Andrew"

---

#### STEP 2: Route Selection (for camps/peaks)

**Bot sends:**
```
Hi Andrew! Which route?
(So we show the correct camps & peaks)

1 = Overland Track
2 = Western Arthurs (A-K)
3 = Western Arthurs (Full)
4 = Federation Peak
5 = Eastern Arthurs
6 = Combined W+E Arthurs

Reply 1-6
```

**User replies:** `3`

**Backend:**
- Validate input is 1-6
- Store route_id = "western_arthurs_full"
- Create trip record

**Route Mapping:**
| Input | route_id | short_code |
|-------|----------|------------|
| 1 | overland_track | OL |
| 2 | western_arthurs_ak | WA |
| 3 | western_arthurs_full | WA |
| 4 | federation_peak | FP |
| 5 | eastern_arthurs | EA |
| 6 | combined_arthurs | CA |

---

#### STEP 3: Commands Guide

**Bot sends:**
```
Western Arthurs (Full) ✓

FORECAST COMMANDS
─────────────────
CAST LAKEO = 12hr hourly
CAST12 LAKEO = 12hr hourly
CAST24 LAKEO = 24hr hourly
CAST7 = 7-day all camps
PEAKS = 7-day all peaks

CHECK-IN (notifies SafeCheck)
─────────────────
CHECKIN LAKEO

OTHER COMMANDS
─────────────────
ROUTE = List all codes
STATUS = Your trip
KEY = Forecast legend
```

**Backend:**
- Immediately send Step 4

---

#### STEP 4: Camps List (route-specific)

**Bot sends (example: Western Arthurs Full):**
```
YOUR CAMPS
══════════════════════
SCOTT = Scotts Peak Dam
JUNCT = Junction Creek
LAKEF = Lake Fortuna
LAKEC = Lake Cygnus
LAKEO = Lake Oberon
HIGHM = High Moor
LAKEH = Haven Lake
LAKES = Lake Sirona
LAKEV = Lake Vesta
LAKEJ = Lake Juno
PROMO = Promontory Lake
LAKER = Lake Rosanne
CRACR = Cracroft Crossing

Use: CAST LAKEO or CHECKIN LAKEO
```

**Backend:**
- Immediately send Step 5

---

#### STEP 5: Peaks List (route-specific)

**Bot sends (example: Western Arthurs Full):**
```
YOUR PEAKS
══════════════════════
HESPE = Mt Hesperus (1098m)
PROCY = Procyon Peak (1136m)
PRIOR = Mt Prior (1070m)
CAPRI = Mt Capricorn (1037m)
TAURA = Mt Taurus (1011m)
SCORP = Mt Scorpio (1106m)
SIRIU = Mt Sirius (1151m)
ORION = Mt Orion (1151m)
PEGAU = Mt Pegasus (1063m)
ALDEB = Mt Aldebaran (1107m)
WESTP = West Portal (1181m)

Use: CAST HESPE or PEAKS for 7-day
```

**Backend:**
- Immediately send Step 6

---

#### STEP 6: SafeCheck & Alerts Setup

**Bot sends:**
```
OPTIONAL SETUP
══════════════════════

SAFECHECK
Notify someone when you check in?
→ SAFE +61412345678 Mum

BOM WEATHER ALERTS
Get severe weather warnings pushed?
→ ALERTS ON

Or text SKIP to finish.
Ready to hike! 🥾
```

**User replies (one of):**
- `SAFE +61412345678 Mum` → Add contact, prompt "Add another? (SAFE/SKIP)"
- `ALERTS ON` → Enable auto-push of BOM warnings
- `SKIP` → Complete registration
- Any command → Registration complete, process command

---

### 7.4 Route-Specific Camp Messages

#### Overland Track (OL)
```
YOUR CAMPS
══════════════════════
RONNY = Ronny Creek
WATER = Waterfall Valley
WINDA = Windermere Hut
NEWPE = New Pelion Hut
KIAHO = Kia Ora Hut
BERTI = Bert Nichols Hut
PINEV = Pine Valley Hut
NARCN = Narcissus Hut
ECHOP = Echo Point Hut
CYNTH = Cynthia Bay
```

#### Western Arthurs A-K (WA)
```
YOUR CAMPS
══════════════════════
SCOTT = Scotts Peak Dam
JUNCT = Junction Creek
LAKEF = Lake Fortuna
LAKEC = Lake Cygnus
LAKEO = Lake Oberon
HIGHM = High Moor
LAKEH = Haven Lake
LAKES = Lake Sirona
```

#### Federation Peak (FP)
```
YOUR CAMPS
══════════════════════
FARMH = Farmhouse Creek
SOUTH = South Cracroft
CUTTI = Cutting Camp
BERCH = Bechervaise Plateau
```

#### Eastern Arthurs (EA)
```
YOUR CAMPS
══════════════════════
SCOTT = Scotts Peak Dam
CRACR = Cracroft Crossing
PASSC = Pass Creek
STUAR = Stuart Saddle
GOONM = Goon Moor
HANGI = Hanging Lake
BERCH = Bechervaise Plateau
CUTTI = Cutting Camp
FARMH = Farmhouse Creek
```

### 7.5 Route-Specific Peak Messages

#### Overland Track (OL)
```
YOUR PEAKS
══════════════════════
CRADL = Cradle Mountain (1545m)
MARIO = Marions Lookout (1224m)
BARNB = Barn Bluff (1559m)
OAKLE = Mt Oakleigh (1286m)
PELIOW = Mt Pelion West (1560m)
PELIOE = Mt Pelion East (1461m)
OSSA = Mt Ossa (1617m)
ACROP = The Acropolis (1471m)
LABYR = Labyrinth Lookout (1202m)
```

#### Western Arthurs A-K (WA)
```
YOUR PEAKS
══════════════════════
HESPE = Mt Hesperus (1098m)
PROCY = Procyon Peak (1136m)
PRIOR = Mt Prior (1070m)
CAPRI = Mt Capricorn (1037m)
TAURA = Mt Taurus (1011m)
SCORP = Mt Scorpio (1106m)
```

#### Federation Peak (FP)
```
YOUR PEAKS
══════════════════════
FEDER = Federation Peak (1225m)
```

#### Eastern Arthurs (EA)
```
YOUR PEAKS
══════════════════════
FEDER = Federation Peak (1225m)
NEEDL = The Needles (1080m)
EASTP = East Portal (1008m)
DIALT = The Dial (1083m)
DEVIL = Devils Thumb (1050m)
```

---

### 7.6 Error Handling

| Error | Bot Response |
|-------|--------------|
| Invalid route number | "Please reply with a number 1-6" |
| Empty name | "Please tell me your name (for SafeCheck)" |
| Invalid phone format | "Please use format: SAFE +61412345678 Name" |
| Phone already added | "That contact is already in your SafeCheck list" |

---

### 7.7 Account & Trip Creation

**On START (Step 1):**
```sql
INSERT INTO accounts (phone, trail_name, status)
VALUES ('+61400123456', 'Andrew', 'onboarding');
```

**On Route Selection (Step 2):**
```sql
UPDATE accounts SET status = 'active' WHERE phone = '+61400123456';

INSERT INTO trips (account_id, route_id, status)
VALUES (account_uuid, 'western_arthurs_full', 'active');
```

**On SafeCheck SAFE command:**
```sql
INSERT INTO safecheck_contacts (account_id, phone, name)
VALUES (account_uuid, '+61412345678', 'Mum');
```

**On ALERTS ON command:**
```sql
UPDATE accounts SET alerts_enabled = true WHERE id = account_uuid;
```

---

### 7.8 Re-Registration

If an existing user texts START:

```
You're already registered!
Route: Western Arthurs (Full)

Commands:
• NEW = Start fresh
• STATUS = Your trip details
• ROUTE = List all codes
• CANCEL = End service
```

---

## 8. User Commands

> **v3.0 Update:** Pull-based system. All commands case-insensitive. CHECKIN command format for check-ins. BOM alerts opt-in.

### 8.1 Command Overview

| Command | Action | SMS Output |
|---------|--------|------------|
| **CAST [CODE]** | 12-hour hourly forecast | 3 SMS |
| **CAST12 [CODE]** | 12-hour hourly forecast | 3 SMS |
| **CAST24 [CODE]** | 24-hour hourly forecast | 6 SMS |
| **CAST7** | 7-day all camps on your route | 6-10 SMS |
| **PEAKS** | 7-day all peaks on your route | 4-6 SMS |
| **CHECKIN [CAMP]** | Check-in + notify SafeCheck | 1 SMS |
| **ROUTE** | List all camp/peak codes | 2 SMS |
| **STATUS** | Trip details | 1 SMS |
| **KEY** | Forecast column legend | 1 SMS |
| **COMMANDS** | Show commands | 1 SMS |
| **ALERTS** | Current BOM warnings | 1 SMS |
| **ALERTS ON** | Enable auto-push warnings | 1 SMS |
| **ALERTS OFF** | Disable auto-push warnings | 1 SMS |
| **SAFE [PHONE] [NAME]** | Add SafeCheck contact | 1 SMS |
| **SAFELIST** | View SafeCheck contacts | 1 SMS |
| **SAFEDEL [#]** | Remove SafeCheck contact | 1 SMS |
| **START** | Begin registration | 6 SMS |
| **CANCEL** | End service | 1 SMS |

**Notes:**
- All commands are **case-insensitive** (`cast lakeo` = `CAST LAKEO`)
- [CODE] accepts both camp codes (LAKEO) and peak codes (FEDER)
- @ prefix only used for LIVETEST commands

> ⚠️ **Twilio Reserved Keywords**
>
> Twilio intercepts `HELP`, `STOP`, `INFO` before they reach our server. Use:
> - `COMMANDS` instead of HELP
> - `CANCEL` instead of STOP

---

### 8.2 CAST Commands

#### 8.2.1 CAST / CAST12 - 12 Hour Hourly Forecast

**Usage:** `CAST LAKEO` or `CAST12 LAKEO` (camp or peak code)

Returns hourly forecast for next 12 hours at specified waypoint.

**Response (3 SMS):**
```
[1/3] LAKE OBERON 863m
Thu 16 Jan | Light 0512-2103
════════════════════════════
Hr|Tmp|%Rn|Prec|Wa|Wm|Wd|%Cd|CB|FL|D
06|3-5|10%|R0-0|8|15|NW|20%|15|18|
07|5-7|15%|R0-0|10|18|NW|25%|14|18|
08|7-9|20%|R0-1|12|22|W|30%|13|19|
09|9-11|25%|R0-1|15|28|W|40%|12|20|
10|11-13|30%|R1-2|18|32|W|50%|11|21|
11|12-14|35%|R1-2|20|35|W|55%|10|21|

[2/3]
12|13-15|40%|R1-3|22|38|W|60%|9|22|
13|13-15|45%|R1-3|24|42|SW|65%|8|22|!
14|12-14|40%|R1-2|22|38|SW|60%|8|21|
15|11-13|35%|R1-2|20|35|W|55%|9|21|
16|9-11|30%|R0-1|18|30|W|50%|10|20|
17|7-9|25%|R0-1|15|25|NW|40%|12|19|

[3/3]
Peaks nearby: SIRIU ORION CAPRI
────────────────────────────
⚠ 13:00 Wind gusts 42km/h
TEXT KEY for column legend
```

**Column Key (from KEY command):**
```
Hr  = Hour (24hr)
Tmp = Temperature range °C
%Rn = Rain probability %
Prec = Precipitation (R=rain mm, S=snow cm)
Wa  = Wind average km/h
Wm  = Wind max/gust km/h
Wd  = Wind direction
%Cd = Cloud cover %
CB  = Cloud base (×100m, 15=1500m)
FL  = Freezing level (×100m, 18=1800m)
D   = Danger (!=caution, !!=warning)
```

#### 8.2.2 CAST24 - 24 Hour Hourly Forecast

**Usage:** `CAST24 LAKEO`

Returns hourly forecast for next 24 hours (6 SMS).

**Response (6 SMS):**
```
[1/6] LAKE OBERON 863m
Thu 16 Jan | Light 0512-2103
════════════════════════════
Hr|Tmp|%Rn|Prec|Wa|Wm|Wd|%Cd|CB|FL|D
06|3-5|10%|R0-0|8|15|NW|20%|15|18|
07|5-7|15%|R0-0|10|18|NW|25%|14|18|
08|7-9|20%|R0-1|12|22|W|30%|13|19|
09|9-11|25%|R0-1|15|28|W|40%|12|20|

[2/6]
10|11-13|30%|R1-2|18|32|W|50%|11|21|
11|12-14|35%|R1-2|20|35|W|55%|10|21|
12|13-15|40%|R1-3|22|38|W|60%|9|22|
13|13-15|45%|R1-3|24|42|SW|65%|8|22|!

[3/6]
14|12-14|40%|R1-2|22|38|SW|60%|8|21|
15|11-13|35%|R1-2|20|35|W|55%|9|21|
16|9-11|30%|R0-1|18|30|W|50%|10|20|
17|7-9|25%|R0-1|15|25|NW|40%|12|19|

[4/6]
18|5-7|20%|R0-0|12|20|NW|35%|14|18|
19|4-6|25%|R0-1|10|18|W|40%|13|17|
20|3-5|30%|R0-1|8|15|W|45%|12|17|
21|2-4|35%|R0-1|8|12|W|50%|11|16|

[5/6]
22|2-4|40%|R1-2|6|10|W|55%|10|16|
23|1-3|45%|R1-2|6|10|W|60%|9|15|
00|1-3|50%|R1-2|5|8|W|65%|8|15|
01|0-2|50%|R1-2|5|8|NW|60%|9|15|

[6/6]
02|0-2|45%|R0-1|6|10|NW|55%|10|15|
03|1-3|40%|R0-1|6|10|NW|50%|11|16|
04|1-3|35%|R0-1|8|12|NW|45%|12|16|
05|2-4|30%|R0-0|8|15|NW|40%|13|17|
────────────────────────────
Peaks nearby: SIRIU ORION CAPRI
```

#### 8.2.3 CAST7 - 7-Day Camp Summary

**Usage:** `CAST7` (uses your registered route)

Returns 7-day daily summary for all camps on your route.

**Response (Example: Western Arthurs Full - 6 SMS):**
```
[1/6] WESTERN ARTHURS 7-DAY
Thu 16 Jan 2026
════════════════════════════
       Tmp  %Rn  Prec Wind  Wd
Camp   Lo-Hi     mm   Avg/Gst
────────────────────────────
SCOTT  8-17 20% R0-2 15/25 W
JUNCT  7-16 25% R0-3 18/30 W
LAKEF  6-14 30% R1-4 20/35 NW
LAKEC  5-13 35% R1-5 22/38 NW
LAKEO  4-12 40% R2-6 25/42 W
HIGHM  3-11 45% R2-8 28/48 SW
────────────────────────────
⚠ Wind gusts >40 exposed ridges

[2/6] Fri 17 Jan
────────────────────────────
       Tmp  %Rn  Prec Wind  Wd
SCOTT  9-18 15% R0-1 12/20 W
JUNCT  8-17 20% R0-2 15/25 W
LAKEF  7-15 25% R0-3 18/28 NW
LAKEC  6-14 30% R1-4 20/32 NW
LAKEO  5-13 35% R1-5 22/35 W
HIGHM  4-12 40% R1-6 25/40 W

[3/6] - [6/6] ...continues for 7 days...

[6/6] Wed 22 Jan (Day 7)
────────────────────────────
       Tmp  %Rn  Prec Wind  Wd
SCOTT 10-20  5% R0-0 10/18 W
JUNCT  9-19 10% R0-0 12/20 W
LAKEF  8-17 15% R0-1 15/25 W
LAKEC  7-16 20% R0-2 18/30 W
LAKEO  6-15 25% R1-3 20/35 W
HIGHM  5-14 30% R1-4 22/38 W
────────────────────────────
Best day: Wed - Low wind
```

#### 8.2.4 CAST7 CAMPS - Grouped Camp Summary (v3.2)

**Usage:** `CAST7 CAMPS`

Returns 7-day forecast for all camps on your route, with **dynamic grouping** to reduce SMS payload. Camps with similar weather conditions (within ±2°C, ±2mm rain, ±5km/h wind) are grouped into zones.

**Response (Example: Western Arthurs Full):**
```
CAST7 CAMPS - Western Arthurs (Full)
Grouped within ±2C ±2mm ±5km/h
══════════════════════════════

ZONE 1: LAKEO HIGHM LAKEH
Day|Tmp|%Rn|Prec|Wa|Wm|Wd|%Cd|CB|FL|D
Thu|3-11|40%|R2-6|25|45|W|55%|9|17|!
Fri|4-12|35%|R1-5|22|40|W|50%|10|18|
Sat|5-13|30%|R1-4|20|35|NW|45%|11|18|
Sun|4-12|45%|R2-8|28|50|SW|60%|8|16|!!
Mon|3-10|50%|R3-10|32|55|SW|65%|7|15|!!
Tue|4-11|40%|R2-6|25|42|W|55%|9|17|!
Wed|5-14|25%|R0-3|18|32|W|40%|12|19|

ZONE 2: LAKEF LAKEC LAKES
Day|Tmp|%Rn|Prec|Wa|Wm|Wd|%Cd|CB|FL|D
Thu|5-14|35%|R1-5|22|40|W|50%|10|18|
...

ZONE 3: JUNCT SCOTT
Day|Tmp|%Rn|Prec|Wa|Wm|Wd|%Cd|CB|FL|D
Thu|9-18|20%|R0-2|15|25|W|35%|15|20|
...

13 locations → 3 zones
```

**Grouping Thresholds:**
| Metric | Threshold | Rationale |
|--------|-----------|-----------|
| Temperature | ±2°C | Noticeable comfort difference |
| Rain | ±2mm | Significant precipitation difference |
| Wind | ±5km/h | Meaningful wind speed difference |

**Benefits:**
- Reduces SMS payload by 40-85% depending on route
- Groups camps at similar elevations/exposures
- Shows representative "worst case" for each zone

#### 8.2.5 CAST7 PEAKS - Grouped Peak Summary (v3.2)

**Usage:** `CAST7 PEAKS`

Returns 7-day forecast for all peaks on your route with dynamic grouping.

**Response (Example: Western Arthurs):**
```
CAST7 PEAKS - Western Arthurs
Grouped within ±2C ±2mm ±5km/h
══════════════════════════════

ZONE 1: HESPE PROCY PRIOR CAPRI
Day|Tmp|%Rn|Prec|Wa|Wm|Wd|%Cd|CB|FL|D
Thu|0-8|45%|R2-6|35|55|W|60%|8|16|!
Fri|1-9|40%|R1-5|32|50|W|55%|9|17|!
...

ZONE 2: TAURA SCORP PEGUS
Day|Tmp|%Rn|Prec|Wa|Wm|Wd|%Cd|CB|FL|D
Thu|-1-7|50%|S0-2|38|60|SW|65%|7|15|!!
...

12 peaks → 2 zones
```

**Note:** Peak grouping is especially effective as peaks at similar elevations typically share weather cells.

#### 8.2.6 PEAKS - 7-Day Peak Summary (Legacy)

**Usage:** `PEAKS` (uses your registered route)

Returns 7-day daily summary for all peaks on your route (ungrouped format).

**Response (Example: Western Arthurs Full - 4 SMS):**
```
[1/4] WA PEAKS 7-DAY
Thu 16 Jan 2026
════════════════════════════
       Tmp  %Rn  Prec Wind  Wd  FL
Peak   Lo-Hi     mm   Avg/Gst
────────────────────────────
HESPE  2-10 35% R1-4 30/48 W  18
PROCY  1-9  40% R2-5 32/52 W  18
CAPRI  0-8  45% R2-6 35/55 SW 17
TAURA -1-7  50% S0-1 38/58 SW 16
SCORP  0-8  45% R2-5 35/55 W  17
SIRIU  0-8  40% R2-5 35/52 W  17
────────────────────────────
⚠ FL 16 = Freezing at 1600m

[2/4] - [4/4] ...continues for 7 days...
```

---

### 8.3 CHECKIN Command

**Usage:** `CHECKIN LAKEO`

Check-in at a camp. This:
1. Updates your position in the system
2. Notifies your SafeCheck contacts with your location

**Response:**
```
✓ Checked in at Lake Oberon
Thu 16 Jan, 10:32 AM
GPS: -43.1486, 146.2722

SafeCheck contacts notified (2).

Next: CAST LAKEO for forecast
```

**SafeCheck Notification (sent to contacts):**
```
THUNDERBIRD SafeCheck
═════════════════════

Andrew checked in at:
Lake Oberon (863m)
Western Arthurs

GPS: -43.1486, 146.2722
Map: maps.google.com/?q=-43.1486,146.2722

Thu 16 Jan, 10:32 AM
```

---

### 8.4 ROUTE Command

**Usage:** `ROUTE`

Lists all camp and peak codes for your registered route.

**Response (Western Arthurs Full):**
```
YOUR ROUTE: Western Arthurs (Full)

CAMPS
═════════════════════
SCOTT JUNCT LAKEF LAKEC
LAKEO HIGHM LAKEH LAKES
LAKEV LAKEJ PROMO LAKER
CRACR

PEAKS
═════════════════════
HESPE PROCY PRIOR CAPRI
TAURA SCORP SIRIU ORION
PEGAU ALDEB WESTP

Use: CAST [CODE] or CHECKIN [CODE]
```

---

### 8.5 ALERTS Commands

#### ALERTS - View Current Warnings

**Usage:** `ALERTS`

```
BOM WARNINGS
═════════════════════

⚠ WIND WARNING
SW Tasmania highlands
Gusts 90-100km/h ridges
Valid: Thu 16 Jan 6AM-6PM

No other active warnings.
```

#### ALERTS ON - Enable Auto-Push

**Usage:** `ALERTS ON`

```
✓ BOM alerts ENABLED

You'll receive automatic warnings
when severe weather affects your
route.

Text ALERTS OFF to disable.
```

#### ALERTS OFF - Disable Auto-Push

**Usage:** `ALERTS OFF`

```
✓ BOM alerts DISABLED

You won't receive automatic
warnings. Use ALERTS to check
manually.

Text ALERTS ON to re-enable.
```

---

### 8.6 SafeCheck Commands

#### SAFE - Add Emergency Contact

**Usage:** `SAFE +61412345678 Mum`

```
✓ SafeCheck contact added:
Mum (+61412345678)

They'll be notified when you
use CHECKIN at camps.

Text SAFELIST to view contacts.
```

#### SAFELIST - View Contacts

**Usage:** `SAFELIST`

```
Your SafeCheck contacts:

1. Mum (+61412...678)
2. Partner (+61423...789)

Text SAFEDEL # to remove.
```

#### SAFEDEL - Remove Contact

**Usage:** `SAFEDEL 1`

```
✓ Removed: Mum (+61412...678)

1 contact remaining.
Text SAFELIST to view.
```

---

### 8.7 Information Commands

#### STATUS

**Usage:** `STATUS`

```
THUNDERBIRD STATUS
═════════════════════
Name: Andrew
Route: Western Arthurs (Full)
Position: Lake Oberon

SafeCheck: 2 contacts
BOM Alerts: ON

Text COMMANDS for help.
```

#### KEY

**Usage:** `KEY`

```
FORECAST COLUMN KEY
═════════════════════
Hr  = Hour (24hr format)
Tmp = Temperature °C (range)
%Rn = Rain chance %
Prec = Precipitation
      R2-4 = Rain 2-4mm
      S1-2 = Snow 1-2cm
Wa  = Wind avg km/h
Wm  = Wind gust km/h
Wd  = Wind direction
%Cd = Cloud cover %
FL  = Freezing level (×100m)
D   = Danger flag

! = Caution  !! = Warning
```

#### COMMANDS

**Usage:** `COMMANDS`

```
THUNDERBIRD COMMANDS
═════════════════════
CAST [CODE] = 12hr forecast
CAST24 [CODE] = 24hr forecast
CAST7 = 7-day all camps
PEAKS = 7-day all peaks

CHECKIN [CAMP] = Check-in
ROUTE = List all codes
STATUS = Your trip
KEY = Column legend

ALERTS = BOM warnings
ALERTS ON/OFF = Auto-push

SAFE +61... Name = Add contact
SAFELIST / SAFEDEL #

CANCEL = End service
```

---

### 8.8 Error Responses

**Unknown code:**
```
"LAKEX" not recognized.

Your camps: SCOTT JUNCT LAKEF...
Your peaks: HESPE PROCY PRIOR...

Text ROUTE for full list.
```

**Unknown command:**
```
Command not recognized.

Text COMMANDS for help.
```

**Not registered:**
```
You're not registered.

Text START to begin.
```

---

### 8.9 Admin/Test Commands

For testing and admin purposes (@ prefix):

| Command | Action |
|---------|--------|
| @ LIVETEST | Create test subscription |
| @ NEXT | Advance test day |
| @ KILL | End test mode |

See [Section 14: LIVETEST Protocol](#14-livetest-protocol) for details.

---
```
[SMS 1/6]
WESTERN ARTHURS 7-DAY
Thu 15 Jan 2026
═══════════════════════════
        Tmp  Rain  Wind
Camp    Lo/Hi  %  mm  Avg/Gst
─────────────────────────────
SCOTT    8/17  20   2  15/25
JUNCT    7/16  25   3  18/30
LAKEF    6/14  30   5  20/35
LAKEC    5/13  35   6  22/38
LAKEO    4/12  40   8  25/42
HIGHM    3/11  45  10  28/48
─────────────────────────────
⚠ Wind gusts >40km/h exposed

[SMS 2/6]
Fri 16 Jan
─────────────────────────────
        Tmp  Rain  Wind
Camp    Lo/Hi  %  mm  Avg/Gst
─────────────────────────────
SCOTT    9/18  15   1  12/20
JUNCT    8/17  20   2  15/25
LAKEF    7/15  25   3  18/28
LAKEC    6/14  30   4  20/32
LAKEO    5/13  35   5  22/35
HIGHM    4/12  40   6  25/40
─────────────────────────────

[... continues for 7 days ...]

[SMS 6/6]
Wed 21 Jan
─────────────────────────────
        Tmp  Rain  Wind
Camp    Lo/Hi  %  mm  Avg/Gst
─────────────────────────────
SCOTT   10/20   5   0  10/18
JUNCT    9/19  10   0  12/20
LAKEF    8/17  15   1  15/25
LAKEC    7/16  20   2  18/30
LAKEO    6/15  25   3  20/35
HIGHM    5/14  30   4  22/38
─────────────────────────────
Best day: Wed - Low wind, minimal rain
```

---

### 8.3 Check-in Command

**Usage:** Send any valid camp code (e.g., `LAKEO`)

Checking in:
1. Updates your position in the system
2. Sends current forecast for that camp
3. Notifies SafeCheck contacts of your location

**Response:**
```
✓ Checked in at Lake Oberon
Thu 15 Jan, 10:32 AM

[12hr forecast follows...]

SafeCheck contacts notified.
```

**SafeCheck Notification (sent to contacts):**
```
Thunderbird SafeCheck
────────────────────

Andrew checked in at
Lake Oberon (863m)
Western Arthurs

GPS: -43.1486, 146.2722
Map: maps.google.com/?q=-43.1486,146.2722

Thu 15 Jan, 10:32 AM
```

---

### 8.4 SafeCheck Commands

#### 8.4.1 SAFE - Add Emergency Contact

**Usage:** `SAFE +61412345678 Mum`

```
BOT:  SafeCheck contact added:
      Mum (+61412345678)
      
      They'll receive updates when
      you check in at camps.
      
      Text SAFELIST to view contacts.
```

#### 8.4.2 SAFELIST - View Contacts

**Usage:** `SAFELIST`

```
BOT:  Your SafeCheck contacts:
      
      1. Mum (+61412...678)
      2. Partner (+61423...789)
      
      Text SAFEDEL # to remove.
```

#### 8.4.3 SAFEDEL - Remove Contact

**Usage:** `SAFEDEL 1`

```
BOT:  Removed: Mum (+61412...678)
      
      1 contact remaining.
      Text SAFELIST to view.
```

---

### 8.5 Information Commands

#### 8.5.1 STATUS

**Usage:** `STATUS`

```
BOT:  THUNDERBIRD STATUS
      ────────────────────
      Trail name: Andrew
      Route: Western Arthurs (Full)
      Start: Thu 15 Jan 2026
      Days: 9
      
      SafeCheck: 2 contacts
      
      Text COMMANDS for help.
```

#### 8.5.2 KEY

**Usage:** `KEY`

```
BOT:  FORECAST COLUMN KEY
      ────────────────────
      Hr  = Hour (24hr format)
      Tmp = Temperature °C
      %Rn = Rain chance %
      Rn  = Rain mm
      Sn  = Snow cm
      Wa  = Wind avg km/h
      Wm  = Wind gust km/h
      %Cd = Cloud cover %
      CB  = Cloud base (×100m)
      FL  = Freezing level (×100m)
      D   = Danger flag
      
      ! = Conditions of concern
```

#### 8.5.3 COMMANDS

**Usage:** `COMMANDS`

```
BOT:  THUNDERBIRD COMMANDS
      ────────────────────
      CAST [CAMP] = 12hr forecast
      CAST24 [CAMP] = 24hr forecast
      CAST7 WA/EA/OL = 7-day route
      
      [CAMP] = Check-in (e.g., LAKEO)
      STATUS = Your trip details
      KEY = Forecast legend
      
      SAFE +61... Name = Add contact
      SAFELIST = View contacts
      SAFEDEL # = Remove contact
      
      CANCEL = End service
```

#### 8.5.4 ALERTS

**Usage:** `ALERTS`

```
BOT:  BOM WARNINGS
      ────────────────────
      ⚠ WIND WARNING
      SW Tasmania highlands
      Gusts 90-100km/h ridges
      Valid: Thu 15 Jan 6AM-6PM
      
      No other active warnings.
```

---

### 8.6 Error Responses

**Invalid camp code:**
```
"LAKEX" not recognized.

Valid camps: SCOTT JUNCT LAKEF
LAKEC LAKEO HIGHM LAKEH...

Text COMMANDS for help.
```

**Unknown command:**
```
Command not recognized.

Text COMMANDS for available commands.
```

**Invalid CAST7 route:**
```
Unknown route code.

Valid codes:
WA = Western Arthurs
EA = Eastern Arthurs
OL = Overland Track
FP = Federation Peak
CA = Combined Arthurs
```

**Not registered:**
```
You're not registered.

Text START to begin registration.
```

---

### 8.7 Administrative Commands

These commands use the `@` prefix and are for testing/admin purposes.

| Command | Action |
|---------|--------|
| @ LIVETEST | Create test subscription |
| @ NEXT | Advance test to next day |
| @ KILL | End test mode |

See [Section 14: LIVETEST Protocol](#14-livetest-protocol) for details.

---

### 8.8 Removed Commands (v3.0)

The following commands from v2.x are no longer supported:

| Command | Reason |
|---------|--------|
| DELAY | No longer needed - pull-based system |
| EXTEND | No longer needed - pull-based system |
| RESEND | Use CAST command instead |
| EDIT | Re-register with START |

---

### 8.9 SMS Delivery Requirements

| Requirement | Value | Rationale |
|-------------|-------|-----------|
| Max segments per message | 4 (640 chars) | Satellite reliability threshold |
| Character encoding | GSM-7 (160 chars/seg) | Universal support |
| Delivery timeout | 60 seconds | Satellite latency allowance |
| Retry attempts | 3 | Balance reliability vs cost |
| Message ordering | Sequential | Numbered for reassembly |

---

## 9. Connectivity Modes

### 9.1 Current Deployment: Standard Telstra SMS

**Thunderbird currently uses standard SMS via the Telstra network.**

```
┌─────────────────────────────────────────────────────────────────┐
│              CURRENT MODE: TELSTRA SMS                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  How it works:                                                  │
│  User phone → Telstra network → Thunderbird                    │
│                                                                 │
│  Satellite coverage (automatic, transparent):                  │
│  When no cellular signal, Telstra-connected phones             │
│  automatically route SMS via Telstra's satellite               │
│  partnership (Starlink). No user action required.              │
│                                                                 │
│  Requirements:                                                  │
│  • Telstra mobile plan (or Telstra MVNO)                       │
│  • Compatible phone with satellite modem                       │
│  • Clear sky view when in satellite-only areas                 │
│                                                                 │
│  User experience:                                               │
│  • SMS sends/receives normally                                 │
│  • May be slightly slower in satellite-only areas              │
│  • No special setup required                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key point:** Thunderbird works with standard SMS. The satellite capability is handled by the carrier network, not by Thunderbird. This is why Thunderbird "just works" in remote areas for Telstra customers.

### 9.2 Network Compatibility

| Network | Satellite SMS | Thunderbird Compatible |
|---------|---------------|------------------------|
| Telstra | ✅ Yes (Starlink) | ✅ Yes |
| Optus | ❌ Not yet | ✅ Yes (cellular only) |
| Vodafone | ❌ Not yet | ✅ Yes (cellular only) |
| Telstra MVNOs | ⚠️ Varies | ✅ Yes (check MVNO) |

**Recommendation:** For remote hiking with satellite backup, use a Telstra plan or Telstra-network MVNO that includes satellite SMS.

### 9.3 Future Option: iPhone Direct-to-Satellite (iOS 18+)

> **Note:** This section describes a FUTURE capability, not the current deployment.

From iOS 18, iPhones with satellite capability can send SMS via satellite independently of carrier:

- Uses Globalstar LEO satellite network
- Works even without Telstra plan
- Requires iPhone 14 or later
- ~30-60 seconds per transmission
- Requires clear sky view

```
User on trail (no cellular) 
    → iPhone sends via Globalstar satellite 
    → Ground station 
    → Carrier network 
    → Thunderbird Twilio number
```

**Key insight:** From Thunderbird server perspective, satellite SMS arrives as normal SMS. No server changes needed.

### 9.4 Satellite Mode Differences (Future)

| Factor | Cellular/Telstra Satellite | iPhone Globalstar |
|--------|---------------------------|-------------------|
| Carrier required | Telstra | Any (or none) |
| Send time | Near instant | 30-60 seconds |
| Receive | Automatic | Manual check may be needed |
| Setup | None | iOS satellite setup |
| Availability | Now | iOS 18+ (2024+) |

### 9.5 User Setup for Satellite Mode (Future)

When iPhone direct-to-satellite mode is supported:

```
BOT:  Connection type?
      1 = Standard (recommended)
      2 = iPhone Satellite (iOS 18+)

USER: 2

BOT:  Satellite mode enabled.
      
      We'll send at 6AM and 6PM.
      Check for messages when you
      have clear sky.
      
      Keep replies SHORT.
      
      Tip: Check-in format:
      "LAKEO" (just the camp code)
```

### 9.6 Ultra-Compressed Format (Future)

Reserved for future satellite modes requiring minimal data:

```
OBN|1100m|D22
AM|1|3|55|9|11|!
PM|4|4|68|8|10|!!
N|-1|3|55|9|9|!
```

(~80 chars vs ~300 chars standard)

---

## 10. Cost Analysis & Pricing

> **v3.0 Update:** New tiered pricing model based on route difficulty. Upfront purchase + pay-as-you-go SMS usage.

### 10.1 Pricing Tiers

| Tier | Price | Routes | Rationale |
|------|-------|--------|-----------|
| **Standard** | $19.99 | Overland Track, Federation Peak | Well-marked, huts, easier logistics |
| **Advanced** | $29.99 | Western Arthurs A-K, Eastern Arthurs | Remote, technical, more camps |
| **Expert** | $49.99 | Western Arthurs Full, Combined Arthurs | Multi-week, extreme, most complex |

### 10.2 SMS Usage Pricing

Users pay for SMS usage at **50% margin** over our cost.

| Provider | Our Cost/Segment | User Pays/Segment | Margin |
|----------|------------------|-------------------|--------|
| Twilio (current) | $0.055 | $0.0825 | 50% |
| Cellcast (future) | $0.029 | $0.0435 | 50% |

**Character count → Segments:**
```
GSM-7 encoding (ASCII only):
- 1-160 chars = 1 segment
- 161-306 chars = 2 segments
- 307-459 chars = 3 segments
- Each additional 153 chars = +1 segment
```

### 10.3 Typical Trip Costs (User Pays)

**Command SMS Costs (Twilio @ 50% margin):**

| Command | Segments | User Cost |
|---------|----------|-----------|
| CAST12 | 3 | $0.25 |
| CAST24 | 6 | $0.50 |
| CAST7 (per day) | 2 | $0.17 |
| PEAKS (per day) | 2 | $0.17 |
| CHECKIN | 1 | $0.08 |
| SafeCheck notify | 1 | $0.08 |

**Example Trip: Western Arthurs Full (9 days)**

| Usage | Commands | Segments | User Pays |
|-------|----------|----------|-----------|
| Daily CAST12 | 9 | 27 | $2.23 |
| 2x CAST24 (decision points) | 2 | 12 | $0.99 |
| CAST7 at start | 1 × 7 days | 14 | $1.16 |
| PEAKS at start | 1 × 7 days | 14 | $1.16 |
| Check-ins | 9 | 9 | $0.74 |
| SafeCheck (2 contacts × 9) | 18 | 18 | $1.49 |
| Onboarding | 1 | 8 | $0.66 |
| **Total SMS** | | **102** | **$8.43** |

**Total Trip Cost to User:**
```
Upfront (Expert tier):     $49.99
SMS Usage:                  $8.43
─────────────────────────────────
TOTAL:                     $58.42
```

### 10.4 Full Scenario Analysis (50% Margin)

**Overland Track (6 days) - Standard Tier**

| Component | Segments | Our Cost | User Pays |
|-----------|----------|----------|-----------|
| Upfront | - | - | $19.99 |
| CAST12 × 6 | 18 | $0.99 | $1.49 |
| CAST7 × 1 | 14 | $0.77 | $1.16 |
| Check-ins × 6 | 6 | $0.33 | $0.50 |
| SafeCheck × 6 | 6 | $0.33 | $0.50 |
| Onboarding | 8 | $0.44 | $0.66 |
| **SMS Total** | **52** | **$2.86** | **$4.31** |
| **Trip Total** | | **$2.86** | **$24.30** |
| **Margin** | | | **$21.44 (88%)** |

**Western Arthurs A-K (7 days) - Advanced Tier**

| Component | Segments | Our Cost | User Pays |
|-----------|----------|----------|-----------|
| Upfront | - | - | $29.99 |
| CAST12 × 7 | 21 | $1.16 | $1.74 |
| CAST24 × 2 | 12 | $0.66 | $0.99 |
| CAST7 × 1 | 14 | $0.77 | $1.16 |
| PEAKS × 1 | 10 | $0.55 | $0.83 |
| Check-ins × 7 | 7 | $0.39 | $0.58 |
| SafeCheck × 7 | 7 | $0.39 | $0.58 |
| Onboarding | 8 | $0.44 | $0.66 |
| **SMS Total** | **79** | **$4.35** | **$6.54** |
| **Trip Total** | | **$4.35** | **$36.53** |
| **Margin** | | | **$32.18 (88%)** |

**Western Arthurs Full (9 days) - Expert Tier**

| Component | Segments | Our Cost | User Pays |
|-----------|----------|----------|-----------|
| Upfront | - | - | $49.99 |
| CAST12 × 9 | 27 | $1.49 | $2.23 |
| CAST24 × 3 | 18 | $0.99 | $1.49 |
| CAST7 × 2 | 28 | $1.54 | $2.31 |
| PEAKS × 2 | 16 | $0.88 | $1.32 |
| Check-ins × 9 | 9 | $0.50 | $0.74 |
| SafeCheck × 18 | 18 | $0.99 | $1.49 |
| Onboarding | 8 | $0.44 | $0.66 |
| **SMS Total** | **124** | **$6.82** | **$10.24** |
| **Trip Total** | | **$6.82** | **$60.23** |
| **Margin** | | | **$53.41 (89%)** |

**Combined Arthurs (14 days) - Expert Tier**

| Component | Segments | Our Cost | User Pays |
|-----------|----------|----------|-----------|
| Upfront | - | - | $49.99 |
| CAST12 × 14 | 42 | $2.31 | $3.47 |
| CAST24 × 4 | 24 | $1.32 | $1.98 |
| CAST7 × 3 | 42 | $2.31 | $3.47 |
| PEAKS × 3 | 24 | $1.32 | $1.98 |
| Check-ins × 14 | 14 | $0.77 | $1.16 |
| SafeCheck × 28 | 28 | $1.54 | $2.31 |
| Onboarding | 8 | $0.44 | $0.66 |
| **SMS Total** | **182** | **$10.01** | **$15.03** |
| **Trip Total** | | **$10.01** | **$65.02** |
| **Margin** | | | **$55.01 (85%)** |

### 10.5 Break-Even Analysis

| Route | Upfront | Min SMS | Break-even |
|-------|---------|---------|------------|
| Overland Track | $19.99 | ~$2.00 | Profitable from day 1 |
| WA A-K | $29.99 | ~$3.00 | Profitable from day 1 |
| WA Full | $49.99 | ~$5.00 | Profitable from day 1 |
| Combined | $49.99 | ~$8.00 | Profitable from day 1 |

### 10.6 Future: Cellcast Migration

When volume justifies, migrate to Cellcast ($0.029/segment):

| Scenario | Current (Twilio) | Future (Cellcast) | Savings |
|----------|------------------|-------------------|---------|
| Our cost per trip (avg) | $5.00 | $2.64 | 47% |
| User pays per trip (avg) | $7.50 | $3.96 | 47% |

**Decision:** Keep user pricing same, increase margin to ~92%.

### 10.7 Admin Dashboard Requirements

Build admin dashboard showing:

| Metric | Description |
|--------|-------------|
| **Account Usage** | SMS sent per account, cost per account |
| **Daily Totals** | Total segments, total cost, margin |
| **Route Breakdown** | Usage by route tier |
| **Command Analytics** | Most used commands, avg segments/command |
| **Revenue** | Upfront purchases, SMS charges, total revenue |
| **Alerts** | API failures, unusual usage patterns |

**Admin Alert Triggers (to admin phone + email):**
- BOM API failure (immediate)
- Twilio API failure (immediate)
- Daily cost exceeds threshold (hourly digest)
- User reports issue (immediate)

---


## 11. Route Definitions

### 11.1 BOM Grid System

The Bureau of Meteorology (BOM) Australian Digital Forecast Database (ADFD) uses a regular latitude/longitude grid:

| Parameter | Tasmania Value |
|-----------|----------------|
| Latitude spacing | 0.02° (~2.2 km) |
| Longitude spacing | 0.03° (~2.4 km) |
| Cell area | ~5.4 km² |
| Domain | -39.12° to -44.64° lat, 142.75° to 149.37° lon |

**Note:** Each cell receives identical base forecast data from BOM. Temperature is adjusted by elevation using lapse rate (0.65°C/100m). Precipitation, wind, and cloud are identical within a cell.

---

### 11.2 Western Arthurs Traverse

**Route Overview:**
- Location: Southwest National Park, Tasmania
- Distance: 79 km (full traverse)
- Duration: 7-12 days
- BOM Cells Traversed: 14
- Grade: 5 (Expert)

**Route Variants:**
| Variant | Duration | Distance | Description |
|---------|\n|----------|----------|-------------|
| Full Traverse | 10-12 days | 79 km | Scotts Peak to Cracroft Bay |
| Alpha-Kappa (A-K) | 6-8 days | 57 km | Scotts Peak to Port Davey Track via Moraine K |
| Lake Oberon Return | 3-4 days | 34 km | Scotts Peak to Lake Oberon and back |

**Loop Route Logic - Return Waypoints:**

Both WA variants are loop routes where SCOTT and JUNCT are passed twice:
1. **Outbound**: Hikers depart via these waypoints (Day 1-2)
2. **Ridge traverse**: These waypoints would normally be dropped from queue (Days 3-N)
3. **Return**: Hikers need forecasts for these waypoints again (final day)

**Solution: RETURN Segment**

Rather than complex trigger logic, every WA forecast includes a dedicated RETURN segment (see Section 5.10) containing descent waypoint forecasts. This eliminates trigger complexity - data is always fetched, always included.

| Route | RETURN Waypoints |
|-------|------------------|
| A-K | JUNCT → SCOTT |
| Full | CRACR → JUNCT → SCOTT |

**Interactive Map:** See Section 13.3 for route detail page with BOM cell overlay.

#### 11.2.1 BOM Cell Groupings with GPS Coordinates


**Cell WA-01** (BOM index: 199-115)
- Bounds: [-43.1200, 146.2000] to [-43.1000, 146.2300]

| Camp Code | Name | Latitude | Longitude | Elevation | Verified |
|-----------|------|----------|-----------|-----------|----------|
| LAKEF | Lake Fortuna | -43.115000 | 146.225000 | 850m | Est. |

| Peak | Latitude | Longitude | Elevation | Type | Verified |
|------|----------|-----------|-----------|------|----------|
| Mt Hesperus | -43.118682 | 146.229973 | 1098m | Side-trip | ✓ |


**Cell WA-02** (BOM index: 200-116)
- Bounds: [-43.1400, 146.2300] to [-43.1200, 146.2600]

| Camp Code | Name | Latitude | Longitude | Elevation | Verified |
|-----------|------|----------|-----------|-----------|----------|
| LAKEC | Lake Cygnus | -43.130300 | 146.237800 | 874m | ✓ |
| SQUAR | Square Lake | -43.136000 | 146.249000 | 871m | Est. |

| Peak | Latitude | Longitude | Elevation | Type | Verified |
|------|----------|-----------|-----------|------|----------|
| Mt Hayes | -43.132466 | 146.247008 | 1119m | Side-trip | ✓ |
| Capella Crags | -43.128000 | 146.240000 | 1000m | On-route | Est. |
| Procyon Peak | -43.137000 | 146.260000 | 1136m | Side-trip | Est. |


**Cell WA-03** (BOM index: 198-117)
- Bounds: [-43.1000, 146.2600] to [-43.0800, 146.2900]

| Camp Code | Name | Latitude | Longitude | Elevation | Verified |
|-----------|------|----------|-----------|-----------|----------|
| JUNCT | Junction Creek | -43.096000 | 146.275000 | 238m | Est. |


**Cell WA-04** (BOM index: 201-117)
- Bounds: [-43.1600, 146.2600] to [-43.1400, 146.2900]

| Camp Code | Name | Latitude | Longitude | Elevation | Verified |
|-----------|------|----------|-----------|-----------|----------|
| LAKEO | Lake Oberon | -43.148600 | 146.272200 | 863m | ✓ |

| Peak | Latitude | Longitude | Elevation | Type | Verified |
|------|----------|-----------|-----------|------|----------|
| Mt Orion | -43.140707 | 146.266812 | 1151m | Side-trip | ✓ |
| Mt Sirius | -43.147509 | 146.264255 | 1151m | Side-trip | ✓ |
| Mt Pegasus | -43.152000 | 146.272000 | 1063m | On-route | Est. |
| Mt Capricorn | -43.158000 | 146.280000 | 1037m | On-route | Est. |


**Cell WA-05** (BOM index: 202-117)
- Bounds: [-43.1800, 146.2600] to [-43.1600, 146.2900]

| Peak | Latitude | Longitude | Elevation | Type | Verified |
|------|----------|-----------|-----------|------|----------|
| Dorado Peak | -43.162000 | 146.290000 | 1000m | Side-trip | Est. |


**Cell WA-06** (BOM index: 195-118)
- Bounds: [-43.0400, 146.2900] to [-43.0200, 146.3200]

| Camp Code | Name | Latitude | Longitude | Elevation | Verified |
|-----------|------|----------|-----------|-----------|----------|
| SCOTT | Scotts Peak Dam | -43.037500 | 146.297800 | 300m | ✓ |


**Cell WA-07** (BOM index: 202-118)
- Bounds: [-43.1800, 146.2900] to [-43.1600, 146.3200]

| Camp Code | Name | Latitude | Longitude | Elevation | Verified |
|-----------|------|----------|-----------|-----------|----------|
| HIGHM | High Moor | -43.161000 | 146.295000 | 850m | Est. |
| LAKEH | Haven Lake | -43.165000 | 146.312000 | 832m | Est. |

| Peak | Latitude | Longitude | Elevation | Type | Verified |
|------|----------|-----------|-----------|------|----------|
| Mt Columba | -43.164000 | 146.296000 | 1000m | Side-trip | Est. |
| Mt Taurus | -43.168000 | 146.310000 | 1011m | On-route | Est. |


**Cell WA-08** (BOM index: 201-119)
- Bounds: [-43.1800, 146.3200] to [-43.1600, 146.3500]

| Camp Code | Name | Latitude | Longitude | Elevation | Verified |
|-----------|------|----------|-----------|-----------|----------|
| LAKES | Lake Sirona | -43.1600 | 146.3300 | 900m | GeoYP |


**Cell WA-08a** (BOM index: 202-119)
- Bounds: [-43.1800, 146.3200] to [-43.1600, 146.3500]
- Note: Peaks in this area fall into adjacent cell due to latitude

| Peak | Latitude | Longitude | Elevation | Type | Verified |
|------|----------|-----------|-----------|------|----------|
| Mt Aldebaran | -43.178045 | 146.345189 | 1107m | Side-trip | ✓ |
| Mt Scorpio | -43.161396 | 146.345215 | 1106m | On-route | ✓ |


**Cell WA-09** (BOM index: 202-120)
- Bounds: [-43.1800, 146.3500] to [-43.1600, 146.3800]

| Camp Code | Name | Latitude | Longitude | Elevation | Verified |
|-----------|------|----------|-----------|-----------|----------|
| LAKEVE | Lake Vesta | -43.162000 | 146.353000 | 740m | Est. |
| LAKEJ | Lake Juno | -43.164000 | 146.358000 | 750m | Est. |
| PROMO | Promontory Lake | -43.172000 | 146.372000 | 836m | Est. |

| Peak | Latitude | Longitude | Elevation | Type | Verified |
|------|----------|-----------|-----------|------|----------|
| Carina Peak | -43.172000 | 146.358000 | 1000m | Side-trip | Est. |
| The Sculptor | -43.178000 | 146.368000 | 1000m | On-route | Est. |


**Cell WA-10** (BOM index: 203-120)
- Bounds: [-43.2000, 146.3500] to [-43.1800, 146.3800]

| Peak | Latitude | Longitude | Elevation | Type | Verified |
|------|----------|-----------|-----------|------|----------|
| The Phoenix | -43.182000 | 146.380000 | 1050m | On-route | Est. |


**Cell WA-11** (BOM index: 203-121)
- Bounds: [-43.2000, 146.3800] to [-43.1800, 146.4100]

| Camp Code | Name | Latitude | Longitude | Elevation | Verified |
|-----------|------|----------|-----------|-----------|----------|
| LAKEVU | Lake Venus | -43.188000 | 146.395000 | 800m | Est. |

| Peak | Latitude | Longitude | Elevation | Type | Verified |
|------|----------|-----------|-----------|------|----------|
| West Portal | -43.194444 | 146.408611 | 1181m | Side-trip | ✓ |
| Mt Canopus | -43.186000 | 146.388000 | 1100m | Side-trip | Est. |
| Centaurus Ridge | -43.190000 | 146.395000 | 1043m | On-route | Est. |
| Crags of Andromeda | -43.192000 | 146.402000 | 1100m | On-route | Est. |


**Cell WA-12** (BOM index: 203-122)
- Bounds: [-43.2000, 146.4100] to [-43.1800, 146.4400]

| Camp Code | Name | Latitude | Longitude | Elevation | Verified |
|-----------|------|----------|-----------|-----------|----------|
| LAKER | Lake Rosanne | -43.192000 | 146.420000 | 633m | Est. |


**Cell WA-13** (BOM index: 201-123)
- Bounds: [-43.1600, 146.4400] to [-43.1400, 146.4700]

| Camp Code | Name | Latitude | Longitude | Elevation | Verified |
|-----------|------|----------|-----------|-----------|----------|
| CRACR | Cracroft Crossing | -43.145000 | 146.460000 | 300m | Est. |


#### 11.2.2 Western Arthurs JSON Configuration

```json
{
  "route_id": "western_arthurs",
  "name": "Western Arthurs Traverse",
  "location": "Southwest National Park, Tasmania",
  "country": "AU",
  "region": "tasmania",
  "grade": 5,
  "distance_km": 79,
  "typical_duration_days": [7, 12],
  
  "bom_grid": {
    "lat_spacing_deg": 0.02,
    "lon_spacing_deg": 0.03,
    "cell_size_km": "2.2 x 2.4"
  },
  
  "weather_api": {
    "primary": "bom_adfd",
    "fallback": "open_meteo",
    "bom_station": "097083"
  },
  
  "elevation_config": {
    "max_elevation_m": 1181,
    "lapse_rate_c_per_100m": 0.65
  },
  
  "danger_thresholds": {
    "wind_caution_kmh": 50,
    "wind_danger_kmh": 60,
    "wind_severe_kmh": 70,
    "cloud_blind_pct": 90,
    "precip_concern_mm": 5,
    "snow_concern_cm": 2,
    "cape_possible": 200,
    "cape_likely": 400
  },
  
  "total_bom_cells": 14,
  "cells_with_waypoints": 14
}
```

#### 11.2.3 Peak Availability by Route Variant

> **v3.0 Update:** Peaks are now restricted by route variant.

**Western Arthurs A-K Peaks (6):**
| Code | Name | Elevation | Notes |
|------|------|-----------|-------|
| HESPE | Mt Hesperus | 1098m | Side-trip from Lake Fortuna |
| PROCY | Procyon Peak | 1136m | Side-trip from Lake Cygnus |
| PRIOR | Mt Prior | 1070m | On-route |
| CAPRI | Mt Capricorn | 1037m | On-route |
| TAURA | Mt Taurus | 1011m | On-route |
| SCORP | Mt Scorpio | 1106m | On-route near Lake Sirona |

**Western Arthurs Full Peaks (11):**
All A-K peaks plus:
| Code | Name | Elevation | Notes |
|------|------|-----------|-------|
| SIRIU | Mt Sirius | 1151m | Side-trip from Lake Oberon |
| ORION | Mt Orion | 1151m | Side-trip from Lake Oberon |
| PEGAU | Mt Pegasus | 1063m | On-route |
| ALDEB | Mt Aldebaran | 1107m | Side-trip from Haven Lake |
| WESTP | West Portal | 1181m | End of range, highest WA peak |

---

### 11.3 Overland Track

**Route Overview:**
- Location: Cradle Mountain-Lake St Clair National Park, Tasmania
- Distance: 65 km (main track), 82 km (with Lake St Clair extension)
- Duration: 5-7 days
- BOM Cells Traversed: 19
- Grade: 4 (Moderate-Hard)

**Interactive Map:** See Section 13.3 for route detail page with BOM cell overlay.

#### 11.3.1 Verified Camps (5-letter codes)

| Code | Name | Latitude | Longitude | Elevation | Source | Note |
|------|------|----------|-----------|-----------|--------|------|
| RONNY | Ronny Creek | -41.6504 | 145.9614 | 942m | GPX | Trailhead |
| WATER | Waterfall Valley Hut | -41.7147 | 145.9469 | 1020m | Wikidata | **ON MAIN TRACK** |
| WINDM | Lake Windermere Hut | -41.7641 | 145.9498 | 993m | GPX | |
| PELIO | New Pelion Hut | -41.8295 | 146.0464 | 739m | Wikidata/OSM | **CORRECTED** |
| KIAOR | Kia Ora Hut | -41.8921 | 146.0820 | 863m | Wikidata | |
| BERTN | Bert Nichols Hut | -41.9321 | 146.0889 | 1000m | OSM | **ON MAIN TRACK** |
| PINEV | Pine Valley Hut | -41.9585 | 146.0635 | 847m | OSM | Side trip |
| NARCI | Narcissus Hut | -42.0125 | 146.1017 | 738m | Wikidata | **CORRECTED** |
| ECHOP | Echo Point Hut | -42.0436 | 146.1383 | 740m | TrailHiking | Lakeside Track |
| CYNTH | Cynthia Bay (Visitor Centre) | -42.1163 | 146.1741 | 748m | PeakVisor | End point |

**Note:** Lakeside Track (Narcissus to Cynthia Bay, ~17km) NOT in uploaded GPX.

#### 11.3.2 Verified Peaks (PeakVisor.com)

| Peak | Latitude | Longitude | Elevation | Type | Source |
|------|----------|-----------|-----------|------|--------|
| Cradle Mountain | -41.6848 | 145.9511 | 1545m | Side-trip | PeakVisor ✓ |
| Marions Lookout | -41.6607 | 145.9525 | 1224m | On-route | PeakVisor ✓ |
| Barn Bluff | -41.7244 | 145.9225 | 1559m | Side-trip | PeakVisor ✓ |
| Mt Oakleigh | -41.7998 | 146.0369 | 1286m | Side-trip | PeakVisor ✓ |
| Mt Pelion West | -41.8319 | 145.9793 | 1560m | Side-trip | PeakVisor ✓ |
| Mt Pelion East | -41.8574 | 146.0675 | 1461m | Side-trip | PeakVisor ✓ |
| Mt Ossa | -41.8713 | 146.0333 | 1617m | Side-trip | PeakVisor ✓ |
| The Acropolis | -41.9361 | 146.0610 | 1471m | Side-trip | GPX ✓ |
| Labyrinth Lookout | -41.9445 | 146.0470 | 1202m | Side-trip | OSM ✓ |

**Note:** Labyrinth track branches opposite from Pine Valley vs Acropolis track.

#### 11.3.3 Naming Convention

All camp/hut codes use **first 5 letters** of the primary name:
- WATER = Waterfall (Valley)
- WINDM = Windermere
- PELIO = Pelion
- KIAOR = Kia Ora (combined)
- BERTN = Bert Nichols (combined)
- PINEV = Pine Valley (combined)
- NARCI = Narcissus
- ECHOP = Echo Point (combined)
- CYNTH = Cynthia (Bay)

#### 11.3.4 Key Corrections (Jan 2026)

| Issue | Old Value | Corrected Value | Source |
|-------|-----------|-----------------|--------|
| WATER location | -41.725, 145.935 (Barn Bluff spur) | -41.7147, 145.9469 (main track) | Wikidata |
| BERTN code | BTNCH/DUCAN | BERTN | 5-letter rule |
| BERTN location | -41.9512, 146.0630 (near Pine Valley) | -41.9321, 146.0889 (main track) | OSM |
| WINDM code | WNDMR | WINDM | 5-letter rule |
| Mt Oakleigh | Missing | -41.7998, 146.0369, 1286m | PeakVisor |
| Mt Pelion East | -41.850, 146.020 (estimated) | -41.8574, 146.0675 | PeakVisor |
| Cradle Mountain | -41.656, 145.942 (estimated) | -41.6848, 145.9511 | PeakVisor |

#### 11.3.5 Side Trip Trail Junctions (from GPX analysis)

Peak side trips branch from specific junction points on the main track. The user-uploaded GPX only includes the main track plus Mt Ossa spur - other peaks need separate trail data.

| Side Trip | Junction Point | Junction Coords | Summit Coords | Distance | Grade | In GPX? |
|-----------|---------------|-----------------|---------------|----------|-------|---------|\n|
| Cradle Mountain | Kitchen Hut area | -41.6866, 145.9481 | -41.6848, 145.9511 | 2km return | 4 | ✗ |
| Mt Oakleigh | New Pelion Hut | -41.8393, 146.0065 | -41.7998, 146.0369 | 8km return | 4 | ✗ |
| Mt Pelion East | Pelion Gap | -41.8627, 146.0576 | -41.8574, 146.0675 | 2.4km return | 3 | ✗ |
| Mt Ossa | Pelion Gap | -41.8627, 146.0576 | -41.8713, 146.0333 | 5.2km return | 4 | ✓ |
| Barn Bluff | Near Waterfall Valley | -41.7198, 145.9249 | -41.7244, 145.9225 | 7km return | 4 | ✓ |

**Note:** To display side trip trails on maps, either:
1. Obtain separate GPX files for each spur (from AllTrails, Parks Tasmania)
2. Draw straight lines from junction to summit (less accurate but shows the route exists)


#### 11.3.6 Overland Track JSON Configuration

```json
{
  "route_id": "overland_track",
  "name": "Overland Track",
  "location": "Cradle Mountain-Lake St Clair National Park, Tasmania",
  "country": "AU",
  "region": "tasmania",
  "grade": 4,
  "distance_km": 65,
  "typical_duration_days": [5, 7],
  
  "bom_grid": {
    "lat_spacing_deg": 0.02,
    "lon_spacing_deg": 0.03,
    "cell_size_km": "2.2 x 2.4"
  },
  
  "weather_api": {
    "primary": "bom_adfd",
    "fallback": "open_meteo",
    "bom_station": "096033"
  },
  
  "elevation_config": {
    "max_elevation_m": 1617,
    "lapse_rate_c_per_100m": 0.65
  },
  
  "danger_thresholds": {
    "wind_caution_kmh": 50,
    "wind_danger_kmh": 60,
    "wind_severe_kmh": 70,
    "cloud_blind_pct": 90,
    "precip_concern_mm": 5,
    "snow_concern_cm": 2,
    "cape_possible": 200,
    "cape_likely": 400
  },
  
  "total_bom_cells": 19,
  "cells_with_waypoints": 19
}
```

---

### 11.4 Eastern Arthurs Traverse

> **v3.0 Addition:** New route added.

**Route Overview:**
- Location: Southwest National Park, Tasmania
- Distance: ~65 km
- Duration: 7-10 days
- BOM Cells Traversed: 8
- Grade: 5 (Expert)
- GPX: [Eastern Arthur Range Traverse](https://gpx.studio)

**Route Description:**

The Eastern Arthurs runs north-south from the end of the Western Arthurs, including the iconic Federation Peak (1225m). The traverse typically starts at Scotts Peak Dam and finishes at Farmhouse Creek (or vice versa).

**Key Features:**
- Federation Peak - Tasmania's most challenging summit
- The Needles - dramatic rocky outcrops
- Hanging Lake - stunning alpine lake campsite
- Technical scrambling sections
- Pack hauling required in places

#### 11.4.1 BOM Cell Groupings with GPS Coordinates

**Cell EA-01** (BOM index: 195-118)
- Bounds: [-43.0400, 146.2900] to [-43.0200, 146.3200]

| Camp Code | Name | Latitude | Longitude | Elevation | Verified |
|-----------|------|----------|-----------|-----------|----------|
| SCOTT | Scotts Peak Dam | -43.037500 | 146.297800 | 310m | ✓ |


**Cell EA-02** (BOM index: 200-120)
- Bounds: [-43.1000, 146.3400] to [-43.0800, 146.3700]

| Camp Code | Name | Latitude | Longitude | Elevation | Verified |
|-----------|------|----------|-----------|-----------|----------|
| CRACR | Cracroft Crossing | -43.082000 | 146.348000 | 320m | ✓ |


**Cell EA-03** (BOM index: 202-121)
- Bounds: [-43.1200, 146.3700] to [-43.1000, 146.4000]

| Camp Code | Name | Latitude | Longitude | Elevation | Verified |
|-----------|------|----------|-----------|-----------|----------|
| PASSC | Pass Creek | -43.105000 | 146.380000 | 400m | Est. |


**Cell EA-04** (BOM index: 205-122)
- Bounds: [-43.1600, 146.4000] to [-43.1400, 146.4300]

| Camp Code | Name | Latitude | Longitude | Elevation | Verified |
|-----------|------|----------|-----------|-----------|----------|
| STUAR | Stuart Saddle | -43.145000 | 146.405000 | 980m | Est. |

| Peak Code | Name | Latitude | Longitude | Elevation | Type | Verified |
|-----------|------|----------|-----------|-----------|------|----------|
| EASTP | East Portal | -43.135000 | 146.395000 | 1008m | Side-trip | Est. |
| NEEDL | The Needles | -43.158000 | 146.415000 | 1080m | On-route | Est. |


**Cell EA-05** (BOM index: 207-123)
- Bounds: [-43.1900, 146.4200] to [-43.1700, 146.4500]

| Camp Code | Name | Latitude | Longitude | Elevation | Verified |
|-----------|------|----------|-----------|-----------|----------|
| GOONM | Goon Moor | -43.175000 | 146.425000 | 950m | Est. |

| Peak Code | Name | Latitude | Longitude | Elevation | Type | Verified |
|-----------|------|----------|-----------|-----------|------|----------|
| DIALT | The Dial | -43.185000 | 146.440000 | 1083m | Side-trip | Est. |


**Cell EA-06** (BOM index: 209-124)
- Bounds: [-43.2200, 146.4500] to [-43.2000, 146.4800]

| Camp Code | Name | Latitude | Longitude | Elevation | Verified |
|-----------|------|----------|-----------|-----------|----------|
| HANGI | Hanging Lake | -43.210000 | 146.455000 | 900m | Est. |

| Peak Code | Name | Latitude | Longitude | Elevation | Type | Verified |
|-----------|------|----------|-----------|-----------|------|----------|
| DEVIL | Devils Thumb | -43.225000 | 146.465000 | 1050m | On-route | Est. |


**Cell EA-07** (BOM index: 211-125)
- Bounds: [-43.2700, 146.4700] to [-43.2500, 146.5000]

| Camp Code | Name | Latitude | Longitude | Elevation | Verified |
|-----------|------|----------|-----------|-----------|----------|
| BERCH | Bechervaise Plateau | -43.255000 | 146.480000 | 1050m | Est. |

| Peak Code | Name | Latitude | Longitude | Elevation | Type | Verified |
|-----------|------|----------|-----------|-----------|------|----------|
| FEDER | Federation Peak | -43.271700 | 146.475900 | 1225m | Side-trip | ✓ |


**Cell EA-08** (BOM index: 213-130)
- Bounds: [-43.2400, 146.6100] to [-43.2200, 146.6400]

| Camp Code | Name | Latitude | Longitude | Elevation | Verified |
|-----------|------|----------|-----------|-----------|----------|
| CUTTI | Cutting Camp | -43.225000 | 146.615000 | 450m | Est. |
| SOUTH | South Cracroft | -43.218000 | 146.640000 | 250m | Est. |


**Cell EA-09** (BOM index: 214-132)
- Bounds: [-43.2400, 146.6600] to [-43.2200, 146.6900]

| Camp Code | Name | Latitude | Longitude | Elevation | Verified |
|-----------|------|----------|-----------|-----------|----------|
| FARMH | Farmhouse Creek | -43.232000 | 146.668000 | 170m | ✓ |


#### 11.4.2 Eastern Arthurs Route Summary

**Camps (9):**
| Order | Code | Name | Elevation | BOM Cell |
|-------|------|------|-----------|----------|
| 1 | SCOTT | Scotts Peak Dam | 310m | EA-01 |
| 2 | CRACR | Cracroft Crossing | 320m | EA-02 |
| 3 | PASSC | Pass Creek | 400m | EA-03 |
| 4 | STUAR | Stuart Saddle | 980m | EA-04 |
| 5 | GOONM | Goon Moor | 950m | EA-05 |
| 6 | HANGI | Hanging Lake | 900m | EA-06 |
| 7 | BERCH | Bechervaise Plateau | 1050m | EA-07 |
| 8 | CUTTI | Cutting Camp | 450m | EA-08 |
| 9 | FARMH | Farmhouse Creek | 170m | EA-09 |

**Peaks (5):**
| Code | Name | Elevation | BOM Cell |
|------|------|-----------|----------|
| EASTP | East Portal | 1008m | EA-04 |
| NEEDL | The Needles | 1080m | EA-04 |
| DIALT | The Dial | 1083m | EA-05 |
| DEVIL | Devils Thumb | 1050m | EA-06 |
| FEDER | Federation Peak | 1225m | EA-07 |

---

### 11.5 Federation Peak (Farmhouse Creek Approach)

> **v3.0 Addition:** New route added.

**Route Overview:**
- Location: Southwest National Park, Tasmania
- Distance: ~45 km return
- Duration: 4-5 days
- BOM Cells Traversed: 4
- Grade: 5 (Expert)
- Type: Out-and-back from Farmhouse Creek

**Route Description:**

The Farmhouse Creek approach is the shorter route to Federation Peak, typically done as a return trip. The route follows Moss Ridge through dense forest before emerging at Bechervaise Plateau for the summit attempt.

**Key Features:**
- Shorter approach than Eastern Arthurs traverse
- Technical scrambling on final ascent
- Exposed Direct Ascent with 600m drop
- Requires excellent weather window for summit

#### 11.5.1 BOM Cell Groupings

**Cell FP-01** (BOM index: 214-132)
| Camp Code | Name | Latitude | Longitude | Elevation | Verified |
|-----------|------|----------|-----------|-----------|----------|
| FARMH | Farmhouse Creek | -43.232000 | 146.668000 | 170m | ✓ |


**Cell FP-02** (BOM index: 213-130)
| Camp Code | Name | Latitude | Longitude | Elevation | Verified |
|-----------|------|----------|-----------|-----------|----------|
| SOUTH | South Cracroft | -43.218000 | 146.640000 | 250m | Est. |
| CUTTI | Cutting Camp | -43.225000 | 146.615000 | 450m | Est. |


**Cell FP-03** (BOM index: 211-125)
| Camp Code | Name | Latitude | Longitude | Elevation | Verified |
|-----------|------|----------|-----------|-----------|----------|
| BERCH | Bechervaise Plateau | -43.255000 | 146.480000 | 1050m | Est. |

| Peak Code | Name | Latitude | Longitude | Elevation | Type | Verified |
|-----------|------|----------|-----------|-----------|------|----------|
| FEDER | Federation Peak | -43.271700 | 146.475900 | 1225m | Summit | ✓ |


#### 11.5.2 Federation Peak Route Summary

**Camps (4):**
| Order | Code | Name | Elevation | BOM Cell |
|-------|------|------|-----------|----------|
| 1 | FARMH | Farmhouse Creek | 170m | FP-01 |
| 2 | SOUTH | South Cracroft | 250m | FP-02 |
| 3 | CUTTI | Cutting Camp | 450m | FP-02 |
| 4 | BERCH | Bechervaise Plateau | 1050m | FP-03 |

**Peaks (1):**
| Code | Name | Elevation | BOM Cell |
|------|------|-----------|----------|
| FEDER | Federation Peak | 1225m | FP-03 |

---

### 11.6 Combined Arthurs Traverse

> **v3.0 Addition:** New route added.

**Route Overview:**
- Location: Southwest National Park, Tasmania
- Distance: ~120 km
- Duration: 12-14 days
- BOM Cells Traversed: 18
- Grade: 5+ (Extreme)
- Type: Thru-hike combining Western and Eastern Arthurs

**Route Description:**

The Combined Arthurs is the ultimate Tasmanian wilderness challenge, linking the Western and Eastern Arthur Ranges in a single expedition. The route typically runs from Scotts Peak Dam, traverses the Western Arthurs, crosses the Arthur Plains, then continues through the Eastern Arthurs to finish at Farmhouse Creek.

**Key Features:**
- Tasmania's most challenging multi-day hike
- All Western Arthurs peaks and camps
- All Eastern Arthurs peaks and camps
- Federation Peak summit opportunity
- Requires extensive wilderness experience

#### 11.6.1 Combined Route Summary

The Combined Arthurs includes all waypoints from:
- Western Arthurs Full (Section 11.2)
- Eastern Arthurs (Section 11.4)

**Camps (deduplicated, 20 total):**
```
Western Arthurs: SCOTT JUNCT LAKEF LAKEC LAKEO HIGHM LAKEH LAKES LAKEV LAKEJ PROMO LAKER
Shared:         CRACR
Eastern Arthurs: PASSC STUAR GOONM HANGI BERCH CUTTI SOUTH FARMH
```

**Peaks (deduplicated, 16 total):**
```
Western Arthurs: HESPE PROCY PRIOR CAPRI TAURA SCORP SIRIU ORION PEGAU ALDEB WESTP
Eastern Arthurs: EASTP NEEDL DIALT DEVIL FEDER
```

---

### 11.7 Coordinate Data Sources

| Source | Type | Verification Status |
|--------|------|---------------------|
| PeakVisor.com | Peak coordinates | ✓ Verified |
| Wikipedia | Lake/Camp coordinates | ✓ Verified |
| GPX track (gpx.studio) | Track points | ✓ Verified |
| Trek reports | Camp estimates | Est. (needs verification) |
| Map interpolation | Peak estimates | Est. (needs verification) |

**Verified Peaks (Western Arthurs):**
- Mt Hesperus: -43.118682, 146.229973, 1098m
- Mt Hayes: -43.132466, 146.247008, 1119m  
- Mt Orion: -43.140707, 146.266812, 1151m
- Mt Sirius: -43.147509, 146.264255, 1151m
- Mt Scorpio: -43.161396, 146.345215, 1106m
- Mt Aldebaran: -43.178045, 146.345189, 1107m
- West Portal: -43.194444, 146.408611, 1181m

**Verified Peaks (Overland Track):**
- Barn Bluff: -41.724432, 145.922524, 1559m
- Mt Ossa: -41.871322, 146.033334, 1617m (Tasmania's highest)


---

## 12. Technical Implementation

### 12.1 Weather Data Flow

```
BOM API (primary)
    ↓
Cache Layer (6hr TTL)
    ↓
Elevation Adjustment (lapse rate)
    ↓
Percentile Extraction (10th, 90th)
    ↓
Message Formatter
    ↓
Twilio SMS API
    ↓
User's Phone
```

### 12.2 Elevation Adjustment

All weather forecasts are adjusted for elevation differences between the weather grid cell and the actual waypoint using the atmospheric lapse rate.

#### 12.2.1 Lapse Rate Formula

```python
def adjust_for_elevation(base_temp, base_elev, target_elev, lapse_rate=0.65):
    """
    Adjust temperature for elevation difference.

    Args:
        base_temp: Temperature at grid cell elevation (°C)
        base_elev: Grid cell average elevation (m) - from DEM
        target_elev: Waypoint elevation (m)
        lapse_rate: Temperature change per 100m (default 0.65°C)

    Returns: Adjusted temperature in °C
    """
    return base_temp - ((target_elev - base_elev) / 100 * lapse_rate)
```

**Standard atmospheric lapse rate:** 6.5°C per 1000m (0.65°C per 100m)

#### 12.2.2 Grid Elevation Sources

| Provider | Elevation Source | Notes |
|----------|-----------------|-------|
| All providers | Open-Meteo Elevation API | Uses SRTM DEM at ~90m resolution |

The grid elevation is fetched via `get_grid_elevation(lat, lon)` which queries the Open-Meteo Elevation API. This returns the terrain elevation at that coordinate, which represents the baseline for weather data.

#### 12.2.3 Adjustment Examples

**Example 1: Camp above grid average**
- Grid cell elevation: 900m
- Camp elevation: 1200m
- `temp_adjustment = (1200 - 900) × 0.0065 = 1.95°C cooler`

**Example 2: Camp below grid average**
- Grid cell elevation: 800m
- Camp elevation: 500m
- `temp_adjustment = (500 - 800) × 0.0065 = 1.95°C warmer`

#### 12.2.4 GPS Coordinate Requests

For GPS coordinate requests (e.g., `CAST -41.89,146.08`):
- The grid elevation IS the target elevation (same point)
- `elevation_diff = 0`, no adjustment needed
- Forecast is already at the correct elevation for that GPS point

### 12.3 Database Schema

> **v3.0 Change:** Account-ready schema designed for future billing integration. Phone number remains primary identifier, with account abstraction for future payment integration.

```sql
-- Accounts (future: links to payment)
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20) UNIQUE NOT NULL,      -- Primary identifier for SMS users
    stripe_customer_id VARCHAR(255),         -- Future: Stripe integration
    account_type VARCHAR(20) DEFAULT 'free', -- free, paid, admin
    purchase_amount_cents INTEGER,           -- One-time purchase amount
    purchased_at TIMESTAMP,
    credits_balance_cents INTEGER DEFAULT 0, -- Prepaid SMS credits
    status VARCHAR(20) DEFAULT 'active',     -- active, suspended, cancelled
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Trips (linked to account)
CREATE TABLE trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id),
    trail_name VARCHAR(100),
    route_id VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    current_position VARCHAR(10),
    status VARCHAR(20) DEFAULT 'active',     -- active, completed, cancelled
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- SafeCheck contacts (linked to account, not trip)
CREATE TABLE safecheck_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id),
    phone VARCHAR(20) NOT NULL,
    name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Check-ins (linked to trip)
CREATE TABLE checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES trips(id),
    camp_code VARCHAR(10) NOT NULL,
    latitude DECIMAL(10, 6),
    longitude DECIMAL(10, 6),
    checked_in_at TIMESTAMP DEFAULT NOW()
);

-- SMS Usage Tracking (for billing)
CREATE TABLE sms_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id),
    trip_id UUID REFERENCES trips(id),
    direction VARCHAR(10) NOT NULL,          -- inbound, outbound
    message_type VARCHAR(30) NOT NULL,       -- cast12, cast24, cast7, checkin, safecheck, onboarding
    segments INTEGER NOT NULL,               -- SMS segments (for billing)
    characters INTEGER NOT NULL,             -- Character count
    cost_cents INTEGER NOT NULL,             -- Calculated cost
    twilio_sid VARCHAR(50),
    twilio_status VARCHAR(20),               -- queued, sent, delivered, failed
    created_at TIMESTAMP DEFAULT NOW()
);

-- Usage Analytics (aggregated daily)
CREATE TABLE usage_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id),
    date DATE NOT NULL,
    inbound_count INTEGER DEFAULT 0,
    outbound_count INTEGER DEFAULT 0,
    total_segments INTEGER DEFAULT 0,
    total_cost_cents INTEGER DEFAULT 0,
    cast12_count INTEGER DEFAULT 0,
    cast24_count INTEGER DEFAULT 0,
    cast7_count INTEGER DEFAULT 0,
    checkin_count INTEGER DEFAULT 0,
    UNIQUE(account_id, date)
);

-- Route Configurations (static reference)
CREATE TABLE routes (
    id VARCHAR(50) PRIMARY KEY,              -- overland_track, western_arthurs_full, etc.
    name VARCHAR(100) NOT NULL,
    short_code VARCHAR(5) NOT NULL,          -- OL, WA, EA, FP, CA
    description TEXT,
    config JSONB NOT NULL,                   -- Full route config (camps, peaks, cells)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Forecast cache
CREATE TABLE forecast_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cell_id VARCHAR(20) NOT NULL,
    forecast_date DATE NOT NULL,
    data JSONB NOT NULL,
    fetched_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    UNIQUE(cell_id, forecast_date)
);

-- Indexes for performance
CREATE INDEX idx_sms_usage_account_date ON sms_usage(account_id, created_at);
CREATE INDEX idx_sms_usage_trip ON sms_usage(trip_id);
CREATE INDEX idx_trips_account ON trips(account_id);
CREATE INDEX idx_checkins_trip ON checkins(trip_id);
CREATE INDEX idx_usage_daily_account ON usage_daily(account_id, date);
CREATE INDEX idx_accounts_phone ON accounts(phone);

-- Billing Events (future: for invoicing)
CREATE TABLE billing_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id),
    event_type VARCHAR(30) NOT NULL,         -- purchase, credit_add, credit_use, invoice
    amount_cents INTEGER NOT NULL,
    balance_after_cents INTEGER,
    description TEXT,
    stripe_payment_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_billing_events_account ON billing_events(account_id, created_at);
```

### 12.3.1 Business Model (Future)

> **Note:** v3.0 implements usage tracking infrastructure. Payment integration planned for v3.1+.

| Component | Details |
|-----------|---------|
| **Purchase** | One-time fee $19.99 - $49.99 (TBD) |
| **Usage** | Per-SMS cost based on segments (~$0.05/segment) |
| **Model** | Prepaid credits or post-paid invoicing (TBD) |

**Migration Path:**
- **v3.0 (Now):** Track all usage, phone as primary identifier
- **v3.1 (Future):** Add Stripe, prepaid credits, optional email registration
- **v3.2 (Future):** Web dashboard, usage analytics, automated invoicing

### 12.3.2 SMS Cost Calculation

```python
# Cost per segment (configurable)
SMS_COST_PER_SEGMENT_CENTS = 5  # $0.05 per segment (margin on Twilio ~$0.02)

def calculate_sms_cost(content: str) -> dict:
    """Calculate SMS segments and cost."""
    char_count = len(content)
    
    # GSM-7 encoding: 160 chars single, 153 per segment if multipart
    if char_count <= 160:
        segments = 1
    else:
        segments = math.ceil(char_count / 153)
    
    cost_cents = segments * SMS_COST_PER_SEGMENT_CENTS
    
    return {
        "characters": char_count,
        "segments": segments,
        "cost_cents": cost_cents
    }
```

### 12.4 API Endpoints

```
POST /webhook/sms/inbound
  - Receive SMS from Twilio
  - Route to command handler

POST /api/forecast/push
  - Trigger manual forecast push
  - Used by scheduler

GET /api/user/{phone}/status
  - Get user subscription status

POST /api/user/{phone}/position
  - Update user position manually

GET /api/route/{route_id}/cells
  - Get all cells for a route

GET /api/forecast/{route_id}/{cell_id}
  - Get cached forecast for cell
```

### 12.5 Cron Schedule

```cron
# 6AM push (AEST/AEDT)
0 6 * * * /app/scripts/push_morning.py

# 5:30PM check-in request (before evening forecast)
30 17 * * * /app/scripts/send_checkins.py

# 6PM push (AEST/AEDT) - uses confirmed position from check-in
0 18 * * * /app/scripts/push_evening.py

# Weather cache refresh (every 6 hours)
0 */6 * * * /app/scripts/refresh_forecasts.py

# BOM alert polling (every 15 minutes)
*/15 * * * * /app/scripts/poll_bom_alerts.py

# Daily cleanup (remove expired users)
0 2 * * * /app/scripts/cleanup.py
```

### 12.6 Environment Variables

```bash
# Required
DATABASE_URL=postgresql://user:pass@localhost:5432/thunderbird
REDIS_URL=redis://localhost:6379/0

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+61400000000

# BOM API (no auth required)
BOM_API_BASE_URL=https://api.weather.bom.gov.au/v1
BOM_FALLBACK_TO_MOCK=false

# Optional
SENTRY_DSN=https://xxx@sentry.io/xxx
LOG_LEVEL=INFO
MAX_CONCURRENT_USERS=500
```

### 12.7 Timezone Policy

| Rule | Value |
|------|-------|
| Display timezone | `Australia/Hobart` (AEST/AEDT) |
| Database storage | UTC timestamps |
| DST handling | Automatic via `pytz` / `zoneinfo` |
| Cron jobs | Run in `Australia/Hobart` timezone |

```python
from zoneinfo import ZoneInfo

TZ_HOBART = ZoneInfo("Australia/Hobart")

def to_local(utc_dt):
    """Convert UTC datetime to Hobart local time."""
    return utc_dt.replace(tzinfo=ZoneInfo("UTC")).astimezone(TZ_HOBART)

def to_utc(local_dt):
    """Convert Hobart local time to UTC for storage."""
    return local_dt.astimezone(ZoneInfo("UTC"))
```

### 12.8 Phone Number Handling

**Normalization:** All phone numbers stored in E.164 format (`+61...`).

```python
import re

def normalize_phone(phone: str) -> str:
    """
    Normalize Australian phone number to E.164 format.
    
    Accepts: 0412345678, +61412345678, 61412345678
    Returns: +61412345678
    """
    # Strip all non-digits
    digits = re.sub(r'\D', '', phone)
    
    # Handle various formats
    if digits.startswith('61') and len(digits) == 11:
        return f'+{digits}'
    elif digits.startswith('0') and len(digits) == 10:
        return f'+61{digits[1:]}'
    elif len(digits) == 9:
        return f'+61{digits}'
    else:
        raise ValueError(f"Invalid AU phone number: {phone}")

def mask_phone(phone: str) -> str:
    """Mask phone for logging: +61412345678 → +614***5678"""
    return phone[:4] + '***' + phone[-4:]
```

**Validation:** Only Australian mobile numbers accepted (04xx pattern).

### 12.9 Security

#### 12.9.1 Twilio Webhook Validation

```python
from twilio.request_validator import RequestValidator

def validate_twilio_request(request) -> bool:
    """Validate incoming Twilio webhook signature."""
    validator = RequestValidator(settings.TWILIO_AUTH_TOKEN)
    
    signature = request.headers.get('X-Twilio-Signature', '')
    url = request.url
    params = request.form.to_dict()
    
    return validator.validate(url, params, signature)
```

**Rule:** Reject all inbound webhooks that fail signature validation.

#### 12.9.2 Rate Limiting

| Limit | Value | Action |
|-------|-------|--------|
| Inbound SMS per phone | 10/hour | Drop message, no response |
| API requests per IP | 60/minute | Return 429 |
| Failed auth attempts | 5/hour | Block IP for 1 hour |

#### 12.9.3 Input Sanitization

```python
import re

def sanitize_sms_input(message: str) -> str:
    """
    Clean incoming SMS for processing.
    
    - Strip whitespace
    - Convert to uppercase
    - Remove non-alphanumeric (except space)
    """
    cleaned = message.strip().upper()
    cleaned = re.sub(r'[^A-Z0-9 ]', '', cleaned)
    return cleaned
```

### 12.10 Infrastructure

#### 12.10.1 Health Check Endpoint

```
GET /health

Response 200:
{
    "status": "ok",
    "timestamp": "2026-01-04T12:00:00Z",
    "services": {
        "database": "ok",
        "redis": "ok",
        "bom_api": "ok",
        "twilio": "ok"
    },
    "version": "2.3.0"
}

Response 503 (any service down):
{
    "status": "degraded",
    "services": {
        "database": "ok",
        "redis": "ok",
        "bom_api": "error",
        "twilio": "ok"
    }
}
```

#### 12.10.2 Logging Format

JSON structured logging for all application events:

```json
{
    "timestamp": "2026-01-04T12:00:00.000Z",
    "level": "INFO",
    "service": "thunderbird",
    "action": "forecast_sent",
    "user_phone": "+614***5678",
    "route_id": "western_arthurs_ak",
    "cell_id": "201-117",
    "segments": 4,
    "duration_ms": 1250,
    "request_id": "abc123"
}
```

**Sensitive data:** Phone numbers always masked in logs.

#### 12.10.3 Capacity

| Metric | Design Target |
|--------|---------------|
| Concurrent active trips | 500 |
| SMS per day (peak) | 2,000 |
| BOM API calls per day | 500 |
| Database size (1 year) | ~500 MB |

Scale horizontally by adding worker nodes if needed.

### 12.11 Security Implementation Status

#### 12.11.1 Implemented Protections ✅

| Protection | Implementation | Location |
|------------|----------------|----------|
| SMS Input Sanitization | Strips special chars, alphanumeric only | `InputSanitizer.sanitize_sms()` |
| Twilio Webhook Validation | X-Twilio-Signature cryptographic verification | `SMSService.validate_webhook()` |
| SQL Injection Prevention | SQLAlchemy ORM (parameterized queries) | All database operations |
| PII Masking in Logs | Phone numbers masked as `+614***5678` | `PhoneUtils.mask()` |
| Phone Format Validation | E.164 normalization | `PhoneUtils.normalize()` |
| Secrets Management | Environment variables only | `.env` configuration |

#### 12.11.2 Required Before Production ⚠️

**Priority 1: Rate Limiting (HIGH)**

Implement using Redis + FastAPI middleware:

```python
from fastapi_limiter import FastAPILimiter
from fastapi_limiter.depends import RateLimiter

# On startup
await FastAPILimiter.init(redis_connection)

# Apply to webhook
@app.post("/webhook/sms/inbound", dependencies=[Depends(RateLimiter(times=10, hours=1))])
```

| Limit | Value | Action |
|-------|-------|--------|
| Inbound SMS per phone | 10/hour | Drop message, no response |
| API requests per IP | 60/minute | Return 429 Too Many Requests |
| Failed validations | 5/hour per IP | Block IP for 1 hour |

**Priority 2: Internal API Authentication (HIGH)**

Add API key authentication to internal endpoints:

```python
from fastapi.security import APIKeyHeader

api_key_header = APIKeyHeader(name="X-API-Key")

async def verify_api_key(api_key: str = Depends(api_key_header)):
    if api_key != settings.INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return api_key
```

Protected endpoints:
- `POST /api/forecast/push` - Triggers SMS sends
- `GET /api/user/{phone}/status` - Reads user data  
- `POST /api/user/{phone}/position` - Modifies user state
- `POST /api/livetest/*` - Testing functions

**Priority 3: Request ID Tracing (MEDIUM)**

Add correlation IDs for debugging:

```python
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = str(uuid.uuid4())
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response
```

#### 12.11.3 Deployment Checklist

**Before Launch:**
- [ ] Rate limiting implemented and tested
- [ ] API key authentication on internal endpoints
- [ ] `DEBUG=false` in production environment
- [ ] TLS/HTTPS configured on load balancer
- [ ] Database credentials rotated from defaults
- [ ] PostgreSQL SSL mode enabled
- [ ] Redis password protected
- [ ] Twilio webhook URL uses HTTPS only

**Monitoring Setup:**
- [ ] Alert on rate limit violations (>100/hour)
- [ ] Alert on failed webhook validations (>10/hour)
- [ ] Monitor SMS send volume vs budget
- [ ] Track API response times (p95 < 500ms)

#### 12.11.4 Security Assessment Summary

| Category | Status | Notes |
|----------|--------|-------|
| Input Validation | ✅ Good | SMS sanitization, phone normalization |
| Webhook Security | ✅ Good | Twilio signature validation |
| SQL Injection | ✅ Good | ORM parameterization |
| Data Logging | ✅ Good | Phone numbers masked |
| Rate Limiting | ⚠️ Pending | Specified, not implemented |
| API Authentication | ⚠️ Pending | Specified, not implemented |
| HTTPS/TLS | ⚠️ Deployment | Infrastructure dependent |

**Overall Rating:** Ready for limited beta testing. Implement rate limiting and API authentication before public launch.

### 12.12 Deployment Procedures

> ⚠️ **CRITICAL: venv is inside the backend folder**
>
> The Python virtual environment (`venv/`) lives inside `/opt/thunderbird/backend/`. When you delete the backend folder during deployment, **venv is also deleted** and must be recreated.

> ⚠️ **CRITICAL: Database must be preserved**
>
> The SQLite database (`thunderbird.db`) contains all user registrations and SafeCheck contacts. **Always backup before deployment.**

**Standard Deployment Steps:**

```bash
# On local machine - upload new code
cd ~/Downloads
scp thunderbird-vXX-complete.zip root@170.64.239.37:/opt/thunderbird/

# On server - deploy
cd /opt/thunderbird

# CRITICAL: Backup database first!
cp backend/thunderbird.db /root/thunderbird.db.backup

rm -rf backend docs
unzip -o thunderbird-vXX-complete.zip
cp /root/thunderbird-web/backend/.env backend/.env

# CRITICAL: Restore database!
cp /root/thunderbird.db.backup backend/thunderbird.db

cd backend

# Recreate venv every time
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run tests before restart
pytest tests/ -q

# Restart service
systemctl restart thunderbird
systemctl status thunderbird
```

**Why venv gets deleted:**
- `rm -rf backend` removes everything including `backend/venv/`
- The zip file doesn't include venv (it's in .gitignore)
- This is by design - venv should be recreated per environment

**Why database gets deleted:**
- `rm -rf backend` removes `backend/thunderbird.db`
- The zip file doesn't include the database
- **Always backup before deployment!**

**Quick sanity check after deployment:**
```bash
journalctl -u thunderbird -n 20 --no-pager
sqlite3 /opt/thunderbird/backend/thunderbird.db "SELECT COUNT(*) FROM users;"
```

---

## 13. Website Layout

### 13.1 Overview

The Thunderbird website serves three purposes:
1. **Marketing/Landing** - Explain the service, pricing, routes
2. **Registration** - Onboard new users via web form
3. **Dashboard** - Show current forecasts (public, no login required)

### 13.2 Page Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER                                                         │
│  Thunderbird          [Routes]  [Dashboard]  [About]            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  HERO SECTION                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  "Weather forecasts that actually reach you"              │  │
│  │                                                           │  │
│  │  SMS is prioritised over satellite networks.              │  │
│  │  While apps timeout, your forecast arrives.               │  │
│  │                                                           │  │
│  │  ✓ Guaranteed delivery via Telstra satellite SMS          │  │
│  │  ✓ No app to load, no data connection needed              │  │
│  │  ✓ 7-day forecasts for every camp on your route           │  │
│  │                                                           │  │
│  │  [Select Route ▼]  [Enter Phone]  [GET STARTED]          │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  HOW IT WORKS                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐│
│  │ 1. REGISTER │  │ 2. SET DATES│  │ 3. DAILY SMS│  │4. CAST  ││
│  │ Select your │  │ Tell us your│  │ 6AM: Hourly │  │Need more││
│  │ trail and   │  │ start date  │  │ for today   │  │detail?  ││
│  │ direction   │  │ and duration│  │ 6PM: 7-day  │  │Text CAST││
│  │             │  │             │  │ outlook     │  │+ camp   ││
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘│
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  WHY SMS BEATS APPS IN THE BACKCOUNTRY                    │  │
│  │  ─────────────────────────────────────────────────────    │  │
│  │  SMS: 140 bytes, prioritised, completes in seconds        │  │
│  │  App: 1-5MB, deprioritised, often times out               │  │
│  │                                                           │  │
│  │  On Telstra satellite: SMS just works. Apps don't load.   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  SUPPORTED ROUTES                                               │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │ OVERLAND TRACK   │  │ WESTERN ARTHURS  │                    │
│  │ 5-7 days | 65km  │  │ 7-12 days | 79km │                    │
│  │ Tasmania         │  │ Tasmania         │                    │
│  │ [View Details]   │  │ [View Details]   │                    │
│  └──────────────────┘  └──────────────────┘                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  PRICING                                                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  TBD - Contact us for beta access                        │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  FOOTER                                                         │
│  About | Contact | Privacy | Terms                              │
│  Data: BOM, Open-Meteo | 2026 Thunderbird                      │
└─────────────────────────────────────────────────────────────────┘
```

<a id="133-route-detail-pages"></a>

### 13.3 Route Detail Pages

**Map Files:** 
- `overland_track_bom_grid.html` - Overland Track with BOM cell overlay
- `western_arthurs_bom_grid.html` - Western Arthurs with BOM cell overlay

**Label Format:** All waypoints show:
- 5-letter code (larger, colored font) - e.g., "LAKEO"
- Real name (smaller, black font below) - e.g., "Lake Oberon"

**Wind Direction Note (displayed on all route pages):**

```
┌─────────────────────────────────────────────────────────────────┐
│  💨 WHY NO WIND DIRECTION IN FORECASTS?                         │
│                                                                 │
│  Tasmania's southwest lies in the path of the Roaring Forties  │
│  - powerful westerly winds between 40°S and 50°S latitude.     │
│                                                                 │
│  Wind direction is almost always from the west (W, NW, SW).    │
│  Including it in every SMS would waste characters on           │
│  predictable information.                                       │
│                                                                 │
│  Recommended hiking direction: WEST → EAST                      │
│  This places the prevailing wind at your back on exposed       │
│  ridges, providing significant protection during storms.        │
│                                                                 │
│  If an unusual easterly change occurs, BOM warnings will       │
│  be included in your forecast alerts.                          │
└─────────────────────────────────────────────────────────────────┘
```

<a id="1331-overland-track"></a>

#### 13.3.1 Overland Track

```
┌─────────────────────────────────────────────────────────────────┐
│  ROUTE: OVERLAND TRACK                                          │
│  Tasmania | 65km | 5-7 days | Grade 4                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  INTERACTIVE MAP WITH BOM CELLS                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │   [Leaflet map - no layer toggles, all visible:]          │  │
│  │                                                           │  │
│  │   TRACKS:                                                 │  │
│  │   - Blue solid = main track (from GPX)                    │  │
│  │   - Blue dashed = Lakeside Track NARCI→ECHOP→CYNTH        │  │
│  │   - Orange dashed = peak side trips (no GPX)              │  │
│  │                                                           │  │
│  │   MARKERS:                                                │  │
│  │   - Green dots = camps (RONNY, WATER, WINDM, etc.)        │  │
│  │   - Red dots = peaks side-trip (CRADL, OSSA, etc.)        │  │
│  │   - Orange dots = peaks on-route (MARIO)                  │  │
│  │                                                           │  │
│  │   LABELS (dual format):                                   │  │
│  │   - Code: "PELIO" (11px green bold)                       │  │
│  │   - Name: "New Pelion" (8px black, below)                 │  │
│  │                                                           │  │
│  │   GRID:                                                   │  │
│  │   - Semi-transparent blue = BOM cells with waypoints      │  │
│  │   - Cell ID on click (e.g., "BOM: 135-109")               │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  CAMPS & BOM CELLS                                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Day │ Camp              │ Elev  │ BOM Cell             │    │
│  │─────│───────────────────│───────│──────────────────────│    │
│  │  1  │ RONNY → WATER     │ 1020m │ 126-107 → 129-106    │    │
│  │  2  │ WATER → WINDM     │  993m │ 129-106 → 132-106    │    │
│  │  3  │ WINDM → PELIO     │  739m │ 132-106 → 135-109    │    │
│  │  4  │ PELIO → KIAOR     │  863m │ 135-109 → 138-111    │    │
│  │  5  │ KIAOR → BERTN     │ 1000m │ 138-111 → 140-111    │    │
│  │  6  │ BERTN → NARCI     │  738m │ 140-111 → 144-111    │    │
│  │  7  │ NARCI → CYNTH     │  748m │ 144-111 → 149-114    │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  SIDE TRIPS                                                     │
│  ┌───────────────┬──────────┬────────┬─────────────────────┐   │
│  │ Destination   │ Distance │ Grade  │ From                │   │
│  │───────────────│──────────│────────│─────────────────────│   │
│  │ Cradle Mtn    │ 2km ret  │ 4      │ Kitchen Hut         │   │
│  │ Barn Bluff    │ 6km ret  │ 4      │ Waterfall Valley    │   │
│  │ Mt Ossa       │ 5.2km    │ 4      │ Pelion Gap          │   │
│  │ Mt Pelion E   │ 2.4km    │ 3      │ Pelion Gap          │   │
│  │ Mt Oakleigh   │ 8km ret  │ 4      │ New Pelion          │   │
│  │ Acropolis     │ 6km ret  │ 4      │ Pine Valley         │   │
│  │ Labyrinth     │ 6km ret  │ 4      │ Pine Valley         │   │
│  └───────────────┴──────────┴────────┴─────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  [REGISTER FOR THIS ROUTE]                                      │
└─────────────────────────────────────────────────────────────────┘
```

<a id="1332-western-arthurs-a-k-route"></a>

#### 13.3.2 Western Arthurs (A-K Route)

```
┌─────────────────────────────────────────────────────────────────┐
│  ROUTE: WESTERN ARTHURS (Alpha-Kappa)                           │
│  Tasmania | 57km | 6-8 days | Grade 5 (Expert)                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  INTERACTIVE MAP WITH BOM CELLS                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │   [Leaflet map - no layer toggles, all visible:]          │  │
│  │                                                           │  │
│  │   TRACKS (from GPX files):                                │  │
│  │   - Green solid = A-K route incl. Kappa Moraine descent   │  │
│  │   - Purple solid = Full traverse (overlaps on ridge)      │  │
│  │   - Orange dashed = peak side trips (no GPX)              │  │
│  │                                                           │  │
│  │   MARKERS:                                                │  │
│  │   - Dark green dots = camps (A-K route)                   │  │
│  │   - Light green dots = camps (Full traverse only)         │  │
│  │   - Red dots = peaks side-trip                            │  │
│  │   - Orange dots = peaks on-route                          │  │
│  │                                                           │  │
│  │   LABELS (dual format):                                   │  │
│  │   - Code: "LAKEO" (11px green bold)                       │  │
│  │   - Name: "Lake Oberon" (8px black, below)                │  │
│  │                                                           │  │
│  │   GRID:                                                   │  │
│  │   - Semi-transparent blue = BOM cells with waypoints      │  │
│  │   - Cell ID on click (e.g., "BOM: 201-117")               │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  CAMPS & BOM CELLS                                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Day │ Camp              │ Elev  │ BOM Cell             │    │
│  │─────│───────────────────│───────│──────────────────────│    │
│  │  1  │ SCOTT → JUNCT     │  238m │ 195-118 → 198-117    │    │
│  │  2  │ JUNCT → LAKEF     │  850m │ 198-117 → 199-115    │    │
│  │  3  │ LAKEF → LAKEC     │  874m │ 199-115 → 200-116    │    │
│  │  4  │ LAKEC → LAKEO     │  863m │ 200-116 → 201-117    │    │
│  │  5  │ LAKEO → HIGHM     │  850m │ 201-117 → 202-117    │    │
│  │  6  │ HIGHM → LAKEH     │  832m │ 202-117 → 202-118    │    │
│  │ Ret │ LAKEH → JUNCT     │  238m │ 202-118 → 198-117    │    │
│  │ Ret │ JUNCT → SCOTT     │  300m │ 198-117 → 195-118    │    │
│  └─────────────────────────────────────────────────────────┘    │
│  Note: Loop route - RETURN segment provides descent forecasts   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  [REGISTER FOR THIS ROUTE]                                      │
└─────────────────────────────────────────────────────────────────┘
```

<a id="1333-western-arthurs-full-traverse"></a>

#### 13.3.3 Western Arthurs (Full Traverse)

```
┌─────────────────────────────────────────────────────────────────┐
│  ROUTE: WESTERN ARTHURS (Full Traverse)                         │
│  Tasmania | 79km | 10-12 days | Grade 5 (Expert)                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  INTERACTIVE MAP WITH BOM CELLS                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │   [Same map as 13.3.2 - single map shows both variants]   │  │
│  │                                                           │  │
│  │   Full traverse camps (light green) extend east:          │  │
│  │   LAKEH → LAKES → LAKEVE → LAKEJ → PROMO →                 │  │
│  │   LAKEVU → LAKER → CRACR                                   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

#### 13.3.4 GPX Data Sources

| Route | GPX File | Points | Coverage |
|-------|----------|--------|----------|
| Overland Track | `Overland-Track.gpx` | 5,049 | Main track (RONNY → NARCI) |
| Western Arthurs A-K | `Western_Arthurs_A-K.gpx` | 9,466 | Full loop incl. Kappa Moraine descent |
| Western Arthurs Full | `Western_Arthur_Range_Traverse.gpx` | 2,901 | Ridge traverse (overlaps A-K on ridge) |

**Tracks without GPX data (shown as dashed lines):**
- Lakeside Track: NARCI → ECHOP → CYNTH (~17km)
- All peak side trips (CRADL, OSSA, HESPE, ORION, etc.)

#### 13.3.5 Full Traverse Camps & BOM Cells

```
┌─────────────────────────────────────────────────────────────────┐
│  CAMPS & BOM CELLS                                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Day │ Camp              │ Elev  │ BOM Cell             │    │
│  │─────│───────────────────│───────│──────────────────────│    │
│  │  1  │ SCOTT → JUNCT     │  238m │ 195-118, 198-117     │    │
│  │  2  │ JUNCT → LAKEF     │  850m │ 199-115              │    │
│  │  3  │ LAKEF → LAKEC     │  874m │ 200-116              │    │
│  │  4  │ LAKEC → LAKEO     │  863m │ 201-117              │    │
│  │  5  │ LAKEO → HIGHM     │  850m │ 202-117              │    │
│  │  6  │ HIGHM → LAKEH     │  832m │ 202-118              │    │
│  │  7  │ LAKEH → LAKES     │  900m │ 201-119              │    │
│  │  8  │ LAKES → LAKEVE     │  740m │ 202-120              │    │
│  │  9  │ LAKEVE → PROMO     │  836m │ 202-120              │    │
│  │ 10  │ PROMO → LAKEVU     │  800m │ 203-121              │    │
│  │ 11  │ LAKEVU → LAKER     │  633m │ 203-122              │    │
│  │ 12  │ LAKER → CRACR     │  300m │ 201-123              │    │
│  └─────────────────────────────────────────────────────────┘    │
│  RETURN segment includes: CRACR → JUNCT → SCOTT forecasts       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  [REGISTER FOR THIS ROUTE]                                      │
└─────────────────────────────────────────────────────────────────┘
```

### 13.4 Dashboard Page (Public)

Route selector at top allows switching between trails.

#### 13.4.1 Overland Track Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│  CURRENT CONDITIONS: OVERLAND TRACK                             │
│  Last updated: 6:00am AEDT, 4 Jan 2026                         │
│  [Overland Track ▼]                                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  TODAY'S FORECAST BY BOM CELL                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ BOM Cell  │ Camps        │ Morn │ Aftn │ Wind  │ Rain   │    │
│  │───────────│──────────────│──────│──────│───────│────────│    │
│  │ 126-107   │ RONNY        │  4C  │  9C  │ 25kmh │ 80% 5mm│    │
│  │ 129-106   │ WATER        │  5C  │ 10C  │ 20kmh │ 70% 4mm│    │
│  │ 132-106   │ WINDM        │  5C  │ 10C  │ 20kmh │ 70% 4mm│    │
│  │ 135-109   │ PELIO        │  6C  │ 12C  │ 15kmh │ 60% 2mm│    │
│  │ 138-111   │ KIAOR        │  5C  │ 11C  │ 25kmh │ 75% 6mm│    │
│  │ 140-111   │ BERTN        │  3C  │  8C  │ 30kmh │ 90% 8mm│    │
│  │ 144-111   │ NARCI        │  7C  │ 14C  │ 10kmh │ 40% 1mm│    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  7-DAY OUTLOOK                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Date  │ North  │ Central│ South   │ Summary             │    │
│  │───────│────────│────────│─────────│─────────────────────│    │
│  │ Sat 4 │ 8mm    │ 5mm    │ 12mm    │ Wet, windy          │    │
│  │ Sun 5 │ 1mm    │ 1mm    │ 3mm     │ Clearing            │    │
│  │ Mon 6 │ 0mm    │ 0mm    │ 0mm     │ Fine                │    │
│  │ Tue 7 │ 0mm    │ 0mm    │ 0mm     │ Fine, warm          │    │
│  │ Wed 8 │ 2mm    │ 1mm    │ 4mm     │ Change coming       │    │
│  │ Thu 9 │ 6mm    │ 5mm    │ 10mm    │ Deteriorating       │    │
│  │ Fri10 │ 15mm   │ 12mm   │ 20mm    │ DANGER - delay      │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  BOM WARNINGS                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ SEVERE WEATHER WARNING - Central Highlands               │  │
│  │ Issued: 3 Jan 2026, 4:30pm                               │  │
│  │ Damaging winds and heavy rain expected Friday            │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

#### 13.4.2 Western Arthurs Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│  CURRENT CONDITIONS: WESTERN ARTHURS                            │
│  Last updated: 6:00am AEDT, 4 Jan 2026                         │
│  [Western Arthurs ▼]                                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  TODAY'S FORECAST BY BOM CELL                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ BOM Cell  │ Camps        │ Morn │ Aftn │ Wind  │ Rain   │    │
│  │───────────│──────────────│──────│──────│───────│────────│    │
│  │ 195-118   │ SCOTT        │  8C  │ 15C  │ 15kmh │ 30% 1mm│    │
│  │ 198-117   │ JUNCT        │  7C  │ 14C  │ 18kmh │ 35% 2mm│    │
│  │ 199-115   │ LAKEF        │  4C  │ 10C  │ 35kmh │ 60% 5mm│    │
│  │ 200-116   │ LAKEC, SQUAR │  3C  │  9C  │ 40kmh │ 70% 6mm│    │
│  │ 201-117   │ LAKEO        │  2C  │  8C  │ 45kmh │ 75% 8mm│    │
│  │ 202-117   │ HIGHM        │  1C  │  7C  │ 50kmh │ 80% 10mm│   │
│  │ 202-118   │ LAKEH        │  1C  │  7C  │ 50kmh │ 80% 10mm│   │
│  │ 201-119   │ LAKES        │  2C  │  8C  │ 45kmh │ 75% 8mm│    │
│  │ 202-120   │ LAKEVE, PROMO │  3C  │  9C  │ 40kmh │ 70% 6mm│    │
│  │ 203-121   │ LAKEVU        │  4C  │ 10C  │ 35kmh │ 60% 5mm│    │
│  │ 203-122   │ LAKER        │  5C  │ 11C  │ 30kmh │ 50% 4mm│    │
│  │ 201-123   │ CRACR        │  7C  │ 14C  │ 20kmh │ 40% 2mm│    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  7-DAY OUTLOOK (Ridge Camps)                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Date  │ West   │ Central│ East    │ Summary             │    │
│  │       │ LAKEC  │ LAKEO  │ LAKEVU   │                     │    │
│  │───────│────────│────────│─────────│─────────────────────│    │
│  │ Sat 4 │ 6mm !  │ 8mm !! │ 5mm !   │ High winds on ridge │    │
│  │ Sun 5 │ 2mm    │ 3mm    │ 2mm     │ Easing              │    │
│  │ Mon 6 │ 0mm    │ 0mm    │ 0mm     │ Fine window         │    │
│  │ Tue 7 │ 0mm    │ 0mm    │ 0mm     │ Fine window         │    │
│  │ Wed 8 │ 4mm    │ 5mm    │ 3mm     │ Front approaching   │    │
│  │ Thu 9 │ 10mm ! │ 12mm !!│ 8mm !   │ Deteriorating       │    │
│  │ Fri10 │ 20mm !!│ 25mm!!!│ 18mm !! │ SEVERE - stay low   │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ! = Caution  !! = Danger  !!! = Severe                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  BOM WARNINGS                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ SEVERE WEATHER WARNING - Southwest                        │  │
│  │ Issued: 3 Jan 2026, 4:30pm                               │  │
│  │ Damaging winds 90-110kmh expected on exposed ridges Fri  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 13.5 Registration Flow

```
STEP 1: Select Route
┌─────────────────────────────────────────────────────────────────┐
│  Which trail are you hiking?                                    │
│  ○ Overland Track (Tasmania)                                   │
│  ○ Western Arthurs (Tasmania)                                  │
│  [NEXT →]                                                       │
└─────────────────────────────────────────────────────────────────┘

STEP 2: Enter Dates
┌─────────────────────────────────────────────────────────────────┐
│  When does your hike start?                                     │
│  Start Date: [19 Dec 2025]                                     │
│  End Date:   [26 Dec 2025]  (auto-calculated or manual)        │
│  [← BACK]  [NEXT →]                                            │
└─────────────────────────────────────────────────────────────────┘

STEP 3: Phone Number
┌─────────────────────────────────────────────────────────────────┐
│  Enter your mobile number                                       │
│  +61 [0412 345 678]                                            │
│  □ I accept the terms of service                               │
│  [← BACK]  [REGISTER]                                          │
└─────────────────────────────────────────────────────────────────┘

STEP 4: Confirmation
┌─────────────────────────────────────────────────────────────────┐
│  ✓ You're registered!                                          │
│                                                                 │
│  Route: Overland Track                                         │
│  Dates: 19-26 Dec 2025                                         │
│  Phone: +61412345678                                           │
│                                                                 │
│  You'll receive your first SMS at 6am on 19 Dec.               │
│  Reply STOP anytime to unsubscribe.                            │
└─────────────────────────────────────────────────────────────────┘
```

### 13.6 Technical Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js (React) |
| Styling | Tailwind CSS |
| Maps | Leaflet + OpenStreetMap |
| Backend API | Next.js API routes |
| Database | SQLite (dev) / PostgreSQL (prod) |
| SMS | Twilio |
| Weather | Open-Meteo API, BOM |
| Hosting | Vercel or Railway |

### 13.7 Mobile Responsiveness

All layouts collapse to single column on mobile:
- Hero CTA stacks vertically
- Route cards stack
- Tables scroll horizontally
- Map remains interactive but smaller

---

## 14. LIVETEST Protocol

### 14.1 Purpose

LIVETEST allows end-to-end testing of the Thunderbird system without waiting real-time hours between forecast cycles. Testers can simulate a complete multi-day hike in minutes while validating all system components.

### 14.2 Test Commands

| Command | Action |
|---------|\n|--------|
| `@ LIVETEST` | Initiates test mode, begins onboarding flow |
| `@ NEXT` | Advances to next time period (6AM → 12PM → 6PM → 6AM...) |
| `@ KILL` | Terminates test immediately |

### 14.3 Test Flow

```
Tester: @ LIVETEST
System: LIVETEST MODE ACTIVATED
        Starting onboarding...
        
        [Normal onboarding flow begins]
        Route? (OT/WA-AK/WA-FULL)

Tester: WA-AK
System: Start date? (DD/MM)

Tester: 15/01
System: Days planned?

Tester: 6
System: Emergency contacts? (name:phone, ...)

Tester: Mum:0412345678,Partner:0423456789
System: LIVETEST READY
        Route: WA-AK (6 days)
        Start: 15/01/2026
        Contacts: 2 registered
        
        Send @ NEXT to begin Day 1 6AM forecast
```

### 14.4 Time Acceleration

Each `@ NEXT` command advances the simulated clock:

```
@ NEXT → Day 1, 6AM forecast sent
@ NEXT → Day 1, 12PM check-in prompt
@ NEXT → Day 1, 6PM forecast sent + position check
@ NEXT → Day 2, 6AM forecast sent
... continues through trip duration
```

**Position responses still required:**
```
System: [6PM] Position check - confirm camp:
Tester: LAKEC
System: Confirmed: LAKEC
        [Sends forecast for current position]
        Send @ NEXT to advance to Day 2 6AM
```

### 14.5 Safety Contact Simulation

During LIVETEST, safety alerts are **not sent** to registered contacts. Instead, the tester receives a simulation message:

```
System: SAFETY ALERT SIMULATION
        ─────────────────────────
        The following contacts WOULD have received:
        
        To: 0412345678 (Mum)
        To: 0423456789 (Partner)
        
        Message:
        "THUNDERBIRD SAFETY UPDATE
        [Name] reached LAKEO
        GPS: -43.1486, 146.2722
        Time: 15/01/2026 18:15 AEDT
        All OK - routine check-in
        
        Powered by thunderbird.bot"
        ─────────────────────────
        
        Send @ NEXT to continue
```

### 14.6 Safety Alert Types

| Alert Type | Trigger | Message Content |
|------------|---------|\n|-----------------|
| Routine check-in | 6PM position confirmed | Camp name, GPS, timestamp, "All OK" |
| Waypoint reached | Specific waypoints (configurable) | Camp name, GPS, timestamp |
| Trip complete | Final camp reached | "Trip completed safely", total stats |
| No response | Missed 2+ check-ins | "No check-in received", last known position |

**GPS Link Format:**
```
GPS: -43.1486, 146.2722
Map: https://maps.google.com/?q=-43.1486,146.2722
```

### 14.7 Payload Verification

After test completion, run the verification script to audit all messages:

```bash
./scripts/livetest_verify.sh --session <session_id>
```

**Output:**
```
LIVETEST VERIFICATION REPORT
Session: test_20260104_143022
Route: WA-AK
Duration: 6 simulated days (23 minutes real time)

MESSAGE AUDIT
─────────────
Total messages sent: 18
Total SMS segments: 47
Estimated cost: $0.94 AUD

BREAKDOWN BY TYPE
─────────────────
6AM forecasts:     6 messages (14 segments)
12PM check-ins:    6 messages (6 segments)  
6PM forecasts:     6 messages (21 segments)
RETURN segments:   6 messages (6 segments)

PAYLOAD VERIFICATION
────────────────────
✓ All BOM cells fetched correctly
✓ All camp codes valid
✓ RETURN segment included in all forecasts
✓ Danger ratings calculated correctly
✓ Character counts within limits

SAFETY ALERTS (SIMULATED)
─────────────────────────
Would have sent: 6 routine check-ins
Would have sent: 1 trip complete
Contacts: 2
Estimated cost: $0.14 AUD

COST SUMMARY
────────────
Forecast SMS: $0.94
Safety SMS:   $0.14 (simulated)
Total:        $1.08 AUD
Per day:      $0.18 AUD
```

### 14.8 Test Database

LIVETEST sessions are stored separately from production:

```
Database: thunderbird_test.db
Table: livetest_sessions

Fields:
- session_id (unique)
- tester_phone
- route_code
- start_timestamp (real)
- simulated_date (virtual)
- messages_sent (JSON array)
- safety_alerts (JSON array)
- status (active/completed/killed)
```

### 14.9 LIVETEST Constraints

| Constraint | Value |
|------------|-------|
| Max concurrent tests | 5 |
| Max simulated days | 14 |
| Session timeout | 2 hours (real time) |
| Rate limit | 1 `@ NEXT` per 5 seconds |

### 14.10 Example Full Test Session

```
Tester: @ LIVETEST
System: LIVETEST MODE ACTIVATED...
        Route?

Tester: WA-AK
System: Start date?

Tester: 15/01
System: Days?

Tester: 6
System: Emergency contacts?

Tester: Mum:0412345678
System: LIVETEST READY. Send @ NEXT

Tester: @ NEXT
System: [DAY 1 - 6AM - 15/01]
        [1/5] JUNCT (current)
        Light 0518-2057...
        [RETURN] JUNCT → SCOTT
        ...

Tester: @ NEXT
System: [DAY 1 - 12PM]
        Position check - on track?
        Reply: Y / [CAMP] if different

Tester: Y
System: Confirmed. @ NEXT for 6PM

Tester: @ NEXT
System: [DAY 1 - 6PM - 15/01]
        [1/5] LAKEC (next)
        ...
        Position check - confirm camp:

Tester: LAKEC
System: Confirmed: LAKEC
        
        SAFETY ALERT SIMULATION
        To: 0412345678 (Mum)
        "[Name] reached LAKEC, GPS: -43.1303, 146.2378..."
        
        @ NEXT for Day 2

... [continues through Day 6] ...

Tester: @ NEXT
System: [DAY 6 - 6PM - 20/01]
        Position check - confirm camp:

Tester: SCOTT
System: Confirmed: SCOTT
        
        TRIP COMPLETE!
        
        SAFETY ALERT SIMULATION
        To: 0412345678 (Mum)
        "[Name] completed WA-AK safely
        Final: SCOTT, GPS: -43.0375, 146.2978
        Duration: 6 days..."
        
        LIVETEST SESSION COMPLETE
        Run: ./scripts/livetest_verify.sh --session test_20260104_143022
```

---

## 15. Testing Requirements

### 15.1 Testing Approach

Thunderbird uses a multi-layered testing strategy:

| Layer | Purpose | Tools |
|-------|---------|\n|-------|
| Unit Tests | Test individual functions | pytest |
| Integration Tests | Test component interactions | pytest + mocks |
| End-to-End (LIVETEST) | Full system simulation | SMS-based protocol |
| Cost Verification | Confirm pricing accuracy | Post-LIVETEST audit |

### 15.2 Unit Test Coverage Requirements

All core modules must have **minimum 80% test coverage**.

#### 15.2.1 Weather Module (`weather.py`)

| Function | Test Cases |
|----------|------------|
| `fetch_bom_forecast()` | Valid cell, invalid cell, API timeout, malformed response |
| `parse_bom_response()` | All fields present, missing fields, edge values |
| `apply_lapse_rate()` | Camp elevation, peak elevation, negative temps |
| `calculate_freezing_level()` | Various temp profiles, edge cases |
| `calculate_cloud_base()` | Humidity ranges, pressure variations |

#### 15.2.2 Formatter Module (`formatter.py`)

| Function | Test Cases |
|----------|------------|
| `format_detailed_forecast()` | Camp only, peak only, both, with danger |
| `format_summary_forecast()` | 7-day, partial data, missing days |
| `format_return_segment()` | A-K (2 waypoints), Full (3 waypoints) |
| `calculate_danger_rating()` | All threshold combinations (!,!!,!!!) |
| `count_sms_segments()` | GSM-7, Unicode fallback, boundary cases |
| `validate_line_length()` | Under 42, exactly 42, over 42 chars |

#### 15.2.3 SMS Module (`sms.py`)

| Function | Test Cases |
|----------|------------|
| `send_message()` | Success, Twilio error, rate limit, invalid number |
| `parse_incoming()` | Camp codes, commands (STOP, DELAY, etc.), invalid |
| `validate_phone_number()` | AU mobiles, international, landlines (reject) |
| `calculate_cost()` | Various segment counts, provider rates |

#### 15.2.4 Route Module (`routes.py`)

| Function | Test Cases |
|----------|------------|
| `load_route_config()` | Valid JSON, missing file, malformed |
| `get_bom_cell()` | All camp codes, unknown codes |
| `calculate_forward_cells()` | Start, middle, end of route |
| `get_return_waypoints()` | A-K route, Full traverse |

#### 15.2.5 User Module (`users.py`)

| Function | Test Cases |
|----------|------------|
| `create_user()` | Valid data, duplicate phone, missing fields |
| `update_position()` | Valid camp, invalid camp, already passed |
| `check_trip_active()` | Before start, during, after end |
| `get_safety_contacts()` | None, one, multiple |

### 15.3 Integration Tests

#### 15.3.1 Forecast Pipeline

```python
def test_full_forecast_pipeline():
    """Test: GPS coords → BOM cell → API fetch → format → segment count"""
    result = generate_forecast(
        route="western_arthurs",
        position="LAKEO",
        time="6PM"
    )
    assert result.segments <= 4
    assert "LAKEO" in result.text
    assert result.danger_rating in [None, "!", "!!", "!!!"]
```

#### 15.3.2 Check-in Flow

```python
def test_checkin_updates_position():
    """Test: User check-in → position update → correct forecast sent"""
    user = create_test_user(route="WA-AK", position="LAKEC")
    process_checkin(user.phone, "LAKEO")
    assert user.current_position == "LAKEO"
    assert user.positions_passed == ["SCOTT", "JUNCT", "LAKEF", "LAKEC", "LAKEO"]
```

#### 15.3.3 RETURN Segment

```python
def test_return_segment_always_included():
    """Test: RETURN segment present in every WA forecast"""
    for position in ["JUNCT", "LAKEC", "LAKEO", "HIGHM", "LAKEH"]:
        forecast = generate_6pm_forecast(route="WA-AK", position=position)
        assert "[RETURN]" in forecast.text
        assert "JUNCT" in forecast.return_segment
        assert "SCOTT" in forecast.return_segment
```

### 15.4 Post-LIVETEST Cost Verification

After each LIVETEST session completes, run automated cost verification:

```bash
./scripts/verify_livetest_cost.sh --session <session_id>
```

#### 15.4.1 Verification Checks

| Check | Expected | Action if Failed |
|-------|----------|------------------|
| Total segments match | Calculated == Actual | Log error, flag session |
| Cost per segment | $0.055 (Twilio) | Alert if provider rate changed |
| RETURN segment present | Every 6PM forecast | Flag missing |
| Character limits | All lines ≤ 42 | Log violating messages |
| Danger ratings | Match threshold rules | Log mismatches |

#### 15.4.2 Cost Verification Output

```
POST-LIVETEST COST VERIFICATION
================================
Session: test_20260104_143022
Route: WA-AK (6 days)

SEGMENT ANALYSIS
────────────────
Expected segments: 222
Actual segments:   222 ✓

COST ANALYSIS (Twilio @ $0.055/segment)
───────────────────────────────────────
Expected cost: $12.21
Actual cost:   $12.21 ✓

COST ANALYSIS (Cellcast @ $0.029/segment)
─────────────────────────────────────────
Projected cost: $6.44

MESSAGE AUDIT
─────────────
6AM forecasts:  42 segments (7 messages) ✓
5:30PM check-in: 7 segments (7 messages) ✓
6PM forecasts: 140 segments (7 messages) ✓
RETURN:         21 segments (7 messages) ✓
Onboarding:      14 segments (12 messages) ✓
SafeCheck:       14 segments (7 messages) ✓

CHARACTER LIMIT VIOLATIONS
──────────────────────────
None ✓

RESULT: PASS
```

### 15.5 Continuous Integration

All tests run on every commit:

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install -r requirements-dev.txt
      - run: pytest --cov=thunderbird --cov-report=xml
      - run: coverage report --fail-under=80
```

### 15.6 Test Data

Test fixtures stored in `tests/fixtures/`:

```
tests/
├── fixtures/
│   ├── bom_responses/
│   │   ├── valid_response.json
│   │   ├── missing_fields.json
│   │   └── error_response.json
│   ├── routes/
│   │   ├── western_arthurs.json
│   │   └── overland_track.json
│   └── users/
│       ├── active_user.json
│       └── completed_user.json
├── unit/
│   ├── test_weather.py
│   ├── test_formatter.py
│   ├── test_sms.py
│   ├── test_routes.py
│   └── test_users.py
├── integration/
│   ├── test_forecast_pipeline.py
│   ├── test_checkin_flow.py
│   └── test_return_segment.py
└── conftest.py
```

### 15.7 Mocking External Services

```python
# conftest.py
import pytest
from unittest.mock import AsyncMock

@pytest.fixture
def mock_bom_api():
    """Mock BOM API responses"""
    with patch('thunderbird.weather.fetch_bom') as mock:
        mock.return_value = load_fixture('bom_responses/valid_response.json')
        yield mock

@pytest.fixture
def mock_twilio():
    """Mock Twilio SMS sending"""
    with patch('thunderbird.sms.twilio_client') as mock:
        mock.messages.create = AsyncMock(return_value=MockMessage(segments=3))
        yield mock
```

---

## Appendix A: SMS Encoding Reference

### GSM-7 Safe Characters

```
A-Z a-z 0-9
@ £ $ ¥ è é ù ì ò Ç Ø ø Å å
Δ _ Φ Γ Λ Ω Π Ψ Σ Θ Ξ
^ { } \ [ ] ~ | €
! " # % & ' ( ) * + , - . / : ; < = > ?
space newline
```

### Characters to AVOID

```
° (degree symbol) - use "C" instead
— (em dash) - use "-" instead
' ' (smart quotes) - use straight quotes
… (ellipsis) - use "..."
```

---

## Appendix B: Example Messages

### B.1 Full 6PM Push from CYGNUS (Western Arthurs)

```
[1/7] CYGNUS (current)
Light 0512-2103 (15h51m)

Camp 874m
Day|Tmp|%Rn|Rn|Sn|Wa|Wm|%Cd|CB|FL|D
21n|1-4|70%|2-8|0-1|25|35|65%|12|11|
22a|5-9|60%|1-5|0-0|30|42|70%|11|12|
p|8-13|40%|0-3|0-0|35|48|75%|10|13|
n|2-5|55%|1-6|0-1|28|40|80%|10|10|
Camps: LAKEC

Peak 1060m
Day|Tmp|%Rn|Rn|Sn|Wa|Wm|%Cd|CB|FL|D
21n|-1-2|80%|3-12|1-5|32|45|72%|10|11|!
22a|2-6|70%|2-8|0-2|38|52|78%|9|12|!
p|4-9|50%|1-5|0-0|42|58|82%|8|13|!!
n|0-3|65%|2-9|0-3|35|50|85%|9|10|!
Peaks: Hayes Capella

[2/7] LAKEO (next)
Light 0512-2103 (15h51m)

Camp 863m
Day|Tmp|%Rn|Rn|Sn|Wa|Wm|%Cd|CB|FL|D
21n|0-3|70%|2-8|0-2|28|38|68%|10|10|
22a|4-8|65%|1-6|0-0|32|45|72%|9|11|
p|7-12|45%|0-4|0-0|38|52|78%|8|12|
n|1-4|60%|1-7|0-1|30|42|82%|9|9|
Camps: LAKEO

Peak 1100m
Day|Tmp|%Rn|Rn|Sn|Wa|Wm|%Cd|CB|FL|D
21n|-3-0|85%|4-15|2-8|35|48|75%|9|10|!
22a|0-4|75%|2-10|1-4|42|55|80%|8|11|!!
p|3-8|55%|1-6|0-1|52|68|92%|7|12|!!
n|-2-1|70%|2-10|1-5|40|55|85%|8|9|!
Peaks: Procyon Orion Sirius
       Pegasus Capricorn

[3/7] HIGHM
Light 0512-2103 (15h51m)

Camp 890m
Day|Tmp|%Rn|Rn|Sn|Wa|Wm|%Cd|CB|FL|D
21n|0-3|70%|2-8|0-2|30|40|70%|10|10|
22a|4-8|65%|1-6|0-0|35|48|75%|9|11|
p|7-12|45%|0-4|0-0|40|55|78%|8|12|
n|1-4|60%|1-7|0-1|32|45|82%|9|9|
Camps: HIGHM LAKEH

Peak 1030m
Day|Tmp|%Rn|Rn|Sn|Wa|Wm|%Cd|CB|FL|D
21n|-2-1|80%|3-12|1-6|38|50|78%|9|10|!
22a|1-5|70%|2-8|0-3|42|55|82%|8|11|!
p|4-9|50%|1-5|0-0|48|62|85%|8|12|!!
n|-1-2|65%|2-9|1-4|38|52|88%|8|9|!
Peaks: Taurus Aldebaran

[4/7] CAMPS D22-27
Day|Tmp|%Rn|Rn|Sn|Wa|Wm|%Cd|CB|FL|D

LAKEO 863m
22|1-10|70%|3-12|0-2|45|60|80%|9|11|
23|3-14|20%|0-2|0-0|35|48|65%|11|12|
24|5-16|10%|0-1|0-0|30|42|55%|12|13|
25|3-14|50%|2-8|0-1|40|58|72%|10|11|
26|1-12|80%|5-18|1-4|50|68|85%|8|10|!
27|3-14|25%|0-3|0-0|32|45|60%|11|12|

HIGHM 890m
22|0-9|75%|4-14|0-3|48|62|82%|9|10|
23|2-13|25%|0-3|0-0|38|50|68%|10|11|
24|4-15|10%|0-1|0-0|32|45|58%|11|12|
25|2-13|55%|2-10|0-2|42|60|72%|9|10|
26|0-11|85%|6-20|2-6|52|70|85%|7|9|!
27|2-13|20%|0-2|0-0|35|48|62%|10|11|

[5/7] PEAKS WEST D22-27
Day|Tmp|%Rn|Rn|Sn|Wa|Wm|%Cd|CB|FL|D

LAKEO 1100m
22|-2-7|80%|4-16|2-8|52|68|85%|8|10|!
23|0-11|25%|0-3|0-1|42|55|70%|10|11|
24|2-13|10%|0-1|0-0|35|48|60%|11|12|
25|0-11|60%|3-12|1-4|48|65|75%|9|10|!
26|-2-9|90%|8-25|4-12|58|75|88%|7|9|!!!
27|0-11|30%|0-4|0-1|38|52|65%|10|11|

COLUMBA 1000m
22|-1-8|75%|4-14|1-6|50|65|82%|9|10|!
23|1-12|25%|0-3|0-1|40|52|68%|10|11|
24|3-14|10%|0-1|0-0|32|45|58%|11|12|
25|1-12|55%|3-10|1-3|45|62|72%|9|10|!
26|-1-10|85%|6-22|3-10|55|72|85%|8|9|!!
27|1-12|25%|0-3|0-0|38|50|62%|10|11|

[6/7] PEAKS CENTRAL D22-27
Day|Tmp|%Rn|Rn|Sn|Wa|Wm|%Cd|CB|FL|D

HIGHM 1030m
22|-1-8|78%|4-14|1-6|50|65|82%|8|10|!
23|1-12|22%|0-3|0-1|40|52|68%|10|11|
24|3-14|10%|0-1|0-0|32|45|58%|11|12|
25|1-12|52%|2-10|1-3|45|62|72%|9|10|!
26|-1-10|82%|5-20|2-8|55|72|85%|7|9|!!
27|1-12|22%|0-3|0-0|38|50|62%|10|11|

SCORPIO 1050m
22|-1-8|75%|3-12|1-5|48|62|80%|9|11|!
23|1-12|20%|0-2|0-0|38|50|65%|10|12|
24|3-14|10%|0-1|0-0|30|42|55%|12|13|
25|1-12|48%|2-8|0-2|42|58|70%|10|11|
26|-1-10|80%|5-18|2-7|52|68|82%|8|10|!!
27|1-12|20%|0-2|0-0|35|48|60%|11|12|

[7/7] PEAKS EAST D22-27
Day|Tmp|%Rn|Rn|Sn|Wa|Wm|%Cd|CB|FL|D

CANOPUS 1065m
22|-1-8|75%|3-12|1-5|48|62|80%|9|11|!
23|1-12|20%|0-2|0-0|38|50|65%|10|12|
24|3-14|10%|0-1|0-0|30|42|55%|12|13|
25|1-12|48%|2-8|0-2|42|58|70%|10|11|
26|-1-10|80%|5-18|2-7|52|68|82%|8|10|!!
27|1-12|20%|0-2|0-0|35|48|60%|11|12|

PORTAL 1140m
22|-2-7|78%|4-14|2-7|50|65|85%|8|10|!
23|0-11|22%|0-3|0-1|40|52|68%|10|11|
24|2-13|10%|0-1|0-0|32|45|58%|11|12|
25|0-11|55%|3-12|1-4|45|62|75%|9|10|!
26|-2-9|88%|7-22|4-11|55|70|88%|7|9|!!!
27|0-11|25%|0-4|0-1|38|50|65%|10|11|
```

### B.2 6AM Push (Day 3 from LAKEO)

```
[1/3] LAKEO (current)
Light 0512-2103 (15h51m)

Camp 863m
Day|Tmp|%Rn|Rn|Sn|Wa|Wm|%Cd|CB|FL|D
23AM|4-8|65%|1-6|0-0|32|45|72%|9|11|
PM|7-12|45%|0-4|0-0|38|52|78%|8|12|
N|1-4|60%|1-7|0-1|30|42|82%|9|9|

Peak 1100m
Day|Tmp|%Rn|Rn|Sn|Wa|Wm|%Cd|CB|FL|D
23AM|0-4|75%|2-10|1-4|42|55|80%|8|11|!
PM|3-8|55%|1-6|0-1|52|68|92%|7|12|!!
N|-2-1|70%|2-10|1-5|40|55|85%|8|9|!
Peaks: Procyon Orion Sirius

[2/3] HIGHM (next)
Light 0512-2103 (15h51m)

Camp 890m
Day|Tmp|%Rn|Rn|Sn|Wa|Wm|%Cd|CB|FL|D
23AM|3-7|70%|2-7|0-0|35|48|75%|9|11|
PM|6-11|50%|0-5|0-0|40|55|78%|8|12|
N|1-4|62%|1-7|0-1|32|45|82%|9|10|

Peak 1030m
Day|Tmp|%Rn|Rn|Sn|Wa|Wm|%Cd|CB|FL|D
23AM|1-5|75%|2-9|0-3|40|52|80%|9|11|!
PM|4-9|55%|1-6|0-0|48|62|85%|8|12|!!
N|0-3|68%|2-9|1-4|38|52|85%|9|10|!
Peaks: Taurus Aldebaran

[3/3] Peak Alert D23
LAKEO 1100m: !! PM
(Blind+Wind)
CB=7 below peaks.
Consider AM summit.
```

### B.3 Forecast Key Message

```
FORECAST KEY
Day=Date+Period (21N=21st Night)
Tmp=Temp C (range)
%Rn=Rain chance %
Rn=Rain mm (range)
Sn=Snow cm (range)
Wa=Wind avg km/h
Wm=Wind max km/h
%Cd=Cloud %
CB=Cloud base x100m
FL=Freeze level x100m
D=Danger (!,!!,!!!)
TS?=Thunder possible
TS!=Thunder likely
```

---

## Appendix C: Adding a New Route

### C.1 Checklist

1. **Identify BOM station** - Find nearest weather station ID
2. **Map all camps/peaks** - GPS coordinates, elevations
3. **Calculate BOM cell indices** - Row-column format (e.g., 76-115)
4. **Group by cell** - Identify which locations share cells
5. **Set zone names** - Named by prominent peak in each cell
6. **Define camp/peak elevations** - Average if multiple in cell
7. **Create route sequence** - Standard and reverse directions
8. **Build default itineraries** - Common trip lengths
9. **Test forecast fetch** - Verify BOM/Open-Meteo data
10. **Test message formatting** - Check segment counts

### C.2 Template Route Config

```json
{
  "route_id": "new_route",
  "name": "New Route Name",
  "location": "Park Name, State",
  "country": "AU",
  "region": "state",
  "grade": 4,
  "typical_duration_days": [5, 7],
  
  "weather_api": {
    "primary": "bom",
    "fallback": "open_meteo",
    "bom_station": "XXXXXX"
  },
  
  "elevation_config": {
    "max_elevation_m": 0,
    "lapse_rate_c_per_100m": 0.65
  },
  
  "danger_thresholds": {
    "wind_caution_kmh": 50,
    "wind_danger_kmh": 60,
    "wind_severe_kmh": 70,
    "cloud_blind_pct": 90,
    "precip_concern_mm": 5,
    "snow_concern_cm": 2,
    "cape_possible": 200,
    "cape_likely": 400
  },
  
  "cells": [],
  "route_sequence": {
    "standard": [],
    "reverse": []
  },
  "default_itineraries": {}
}
```

---

## Appendix D: Validation Checklist

Every formatted message MUST include:

- [ ] Message number [X/Y]
- [ ] Cell or section name
- [ ] Light hours (detailed format only)
- [ ] Elevation in metres
- [ ] Column header row (pipe-separated)
- [ ] All 11 data columns: Day|Tmp|%Rn|Rn|Sn|Wa|Wm|%Cd|CB|FL|D
- [ ] Pipe separators between all columns
- [ ] % symbols on percentage values (%Rn, %Cd)
- [ ] Camp list (if camps in cell)
- [ ] Peak list (if peaks in cell)
- [ ] Danger indicators where hazards present
- [ ] TS indicators where thunderstorm risk (CAPE ≥ 200)
- [ ] No line exceeds 42 characters (% adds 2 chars to max rows)

---

## Appendix E: Apple Watch Satellite Mode (Future)

**Status:** For future consideration - not in V1 scope.

### E.1 Apple Watch Ultra 3 Compatibility

From late 2025, Apple Watch Ultra 3 supports satellite SMS:

- Uses Globalstar LEO satellite network
- Heavily compressed protocol
- Text only (no images)
- ~30-60 seconds per transmission
- Requires clear sky view

### E.2 How It Would Work

```
User on trail (no cellular) 
    → Apple Watch sends via satellite 
    → Globalstar satellite 
    → Ground station 
    → User's iPhone (at home/in car, powered on) 
    → Carrier network 
    → Thunderbird Twilio number
```

**Key insight:** From Thunderbird server perspective, satellite SMS arrives as normal SMS. No server changes needed.

### E.3 Implementation Notes

- Requires user to have Apple Watch Ultra 3 with satellite plan
- iPhone must be powered on somewhere with cellular coverage
- Longer transmission times (30-60 seconds vs instant)
- May require ultra-compressed format (~80 chars)
- Battery drain higher on watch

### E.4 Ultra-Compressed Format

If Apple Watch support added, provide shorter format:

```
OBN|1100m|D22
AM|1|3|55|9|11|!
PM|4|4|68|8|10|!!
N|-1|3|55|9|9|!
```

(~80 chars vs ~300 chars standard)

---

## Appendix F: Weather API Architecture & Critical Audit

### F.1 Weather Zone System

**Important Clarification:** The "BOM cell" indices used throughout this document (e.g., "201-117") are **our own zone identifiers** for grouping waypoints, not official BOM identifiers.

#### What We Use vs What BOM Uses

| System | Identifier | Purpose |
|--------|------------|---------|\n|
| **Our Zones** | `201-117` (row-column) | Group waypoints for caching, reduce API calls |
| **BOM API** | `r22489` (geohash) | Location lookup for forecast data |

#### Zone Calculation Formula
```python
class WeatherZoneConfig:
    LAT_ORIGIN = -39.12   # Northern boundary
    LON_ORIGIN = 142.75   # Western boundary
    LAT_SPACING = 0.02    # ~2.2km per row
    LON_SPACING = 0.03    # ~2.5km per column
    
    @classmethod
    def lat_lon_to_zone(cls, lat: float, lon: float) -> tuple[int, int]:
        row = int((cls.LAT_ORIGIN - lat) / cls.LAT_SPACING)
        col = int((lon - cls.LON_ORIGIN) / cls.LON_SPACING)
        return (row, col)
```

#### Why This Works
- Nearby waypoints (~2-3km) share similar weather
- Reduces API calls from 35 to 14 for WA Full (60% reduction)
- Geohash is used for actual BOM API lookup
- Zone ID is for caching and display grouping

### F.2 Weather API Routing & Fallback

The backend routes weather requests to country-specific providers with Open-Meteo as universal fallback.

#### F.2.1 Provider Resolution by Region

| Provider | Grid Resolution | Coverage |
|----------|----------------|----------|
| BOM ACCESS-C | ~4km | Australian cities/populated areas |
| BOM ACCESS-G | ~12km | All of Australia |
| NWS | ~2.5km | United States |
| Environment Canada | ~10km | Canada |
| Met Office | ~1.5km | United Kingdom |
| Open-Meteo AROME | 1.5-2.5km | France |
| Open-Meteo ICON-EU | 7km | Europe (Switzerland, Italy, etc.) |
| Open-Meteo GFS | ~25km | Global fallback |

#### F.2.2 Country-to-Provider Routing

| Country | Primary Provider | Fallback | Notes |
|---------|-----------------|----------|-------|
| AU | BOM | Open-Meteo | Best resolution for Australia |
| US | NWS | Open-Meteo | Free, no API key needed |
| CA | Environment Canada | Open-Meteo | Official Canadian data |
| GB | Met Office | Open-Meteo | Requires API key |
| FR | Open-Meteo (Meteo-France) | - | AROME 1.5-2.5km model |
| CH | Open-Meteo (ICON-EU) | - | No MeteoSwiss endpoint |
| IT | Open-Meteo (ICON-EU) | - | Covers Dolomites/Alps |
| NZ | Open-Meteo (best_match) | - | Auto-selects optimal model |
| ZA | Open-Meteo (best_match) | - | Auto-selects optimal model |
| Other | Open-Meteo (best_match) | - | Global coverage |

#### F.2.3 Australia Weather Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                  AUSTRALIA WEATHER DATA FLOW                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Waypoint (lat, lon)                                           │
│       │                                                         │
│       ├──► Zone ID "201-117" (our grouping for caching)        │
│       │                                                         │
│       └──► Geohash "r22489" (for BOM API lookup)               │
│                 │                                               │
│                 ▼                                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              PRIMARY: BOM API (~4km resolution)          │   │
│  │  api.weather.bom.gov.au/v1/locations/{geohash}/         │   │
│  │  forecasts/3-hourly                                      │   │
│  │                                                          │   │
│  │  Provides: temp, rain.chance, rain.amount.min/max,       │   │
│  │            wind.speed_kilometre, wind.gust_speed_kilometre│   │
│  └──────────┬──────────────────────────────────────────────┘   │
│             │ if fails (403, timeout, etc.)                    │
│             ▼                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         FALLBACK: Open-Meteo API (~25km resolution)      │   │
│  │  api.open-meteo.com/v1/forecast                          │   │
│  │                                                          │   │
│  │  Provides: temp, precipitation, wind_speed, wind_gusts,  │   │
│  │            freezing_level_height, snowfall, cloud_cover  │   │
│  └──────────┬──────────────────────────────────────────────┘   │
│             │ if also fails                                    │
│             ▼                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │            LAST RESORT: Mock Data                        │   │
│  │  (Only if BOM_FALLBACK_TO_MOCK=true)                     │   │
│  │  Realistic patterns but not actual forecast              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### F.2.4 International Weather Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                INTERNATIONAL WEATHER DATA FLOW                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  GPS Coordinates (lat, lon)                                     │
│       │                                                         │
│       └──► Country detection (from coordinates)                │
│                 │                                               │
│                 ▼                                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         WeatherRouter.get_forecast(lat, lon, country)    │   │
│  │                                                          │   │
│  │  US ──► NWSProvider (~2.5km)                            │   │
│  │  CA ──► EnvironmentCanadaProvider (~10km)               │   │
│  │  GB ──► MetOfficeProvider (~1.5km)                      │   │
│  │  FR ──► OpenMeteoProvider (AROME 1.5-2.5km)             │   │
│  │  CH/IT ──► OpenMeteoProvider (ICON-EU 7km)              │   │
│  │  Other ──► OpenMeteoProvider (best_match ~25km)         │   │
│  │                                                          │   │
│  └──────────┬──────────────────────────────────────────────┘   │
│             │ if primary fails                                  │
│             ▼                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         OpenMeteoProvider (best_match) - universal       │   │
│  │         Marks response with is_fallback=True             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### F.2.5 Elevation Handling by Provider

All providers return temperature at 2m height above the grid cell's average terrain elevation. The system applies lapse rate adjustment when the target waypoint differs from grid elevation.

| Provider | Elevation Source | Notes |
|----------|-----------------|-------|
| BOM | Grid cell average | Uses DEM via Open-Meteo Elevation API |
| Open-Meteo | Grid cell average | Already elevation-adjusted in API response |
| NWS | Grid cell average | Already elevation-adjusted |
| Environment Canada | Grid cell average | Already elevation-adjusted |
| Met Office | Grid cell average | Already elevation-adjusted |

For GPS coordinate requests, the grid elevation equals the target elevation, so no additional adjustment is applied.

### F.3 Data Field Sources

| Field | BOM Provides | Open-Meteo Provides | Calculated |
|-------|--------------|---------------------|------------|
| Temperature | ✅ Single value | ✅ temp_2m | temp_min/max estimated |
| Rain chance | ✅ rain.chance | ✅ precipitation_probability | - |
| Rain amount | ✅ rain.amount.min/max | ✅ precipitation | Open-Meteo: total only |
| Wind average | ✅ wind.speed_kilometre | ✅ wind_speed_10m | - |
| Wind gusts | ✅ wind.gust_speed_kilometre | ✅ wind_gusts_10m | - |
| Snowfall | ❌ | ✅ snowfall (cm) | From temp + rain if BOM |
| Freezing level | ❌ | ✅ freezing_level_height | From temp if BOM |
| Cloud cover | ❌ | ✅ cloud_cover (%) | From rain_chance if BOM |
| Cloud base | ❌ | ❌ | From cloud_cover |
| CAPE | ❌ | ✅ cape | Set to 0 if unavailable |

### F.4 Critical Audit Summary

**Audit Date:** January 2026

| Issue | Severity | Resolution |
|-------|----------|------------|
| "BOM Cell" naming misleading | MEDIUM | Documented as "Weather Zone" - our identifier, not BOM's |
| BOM API parser field names | N/A | Already correct (verified against actual API) |
| Fallback to mock data | MEDIUM | Added Open-Meteo as real fallback before mock |
| Calculated fields undocumented | LOW | Documented in code and this appendix |

### F.5 Environment Configuration

```bash
# Weather APIs
MOCK_BOM_API=false           # Use real weather APIs
BOM_FALLBACK_TO_MOCK=true    # Last resort: mock data if both APIs fail
```

### F.6 Test Coverage

**80 tests passing** including:
- Weather zone calculations (6 tests)
- BOM response parsing (3 tests)
- Open-Meteo response parsing (1 test)
- End-to-end forecast flow (2 tests)
- Camp code disambiguation (1 test)

---

## Appendix G: Future Architecture Considerations

### G.1 SMS vs JSON: The Real Trade-off

**JSON is not the limitation.** A 7-day forecast for 6 waypoints compresses to ~1-2KB — well under the 4KB push notification limit. JSON is compact, structured, universally parseable, and perfect for app rendering.

**The only constraint is connectivity:**

| Delivery Method | 2025-2027 | 2027+ |
|-----------------|-----------|-------|
| SMS over satellite | ✅ Works now | ✅ Still works |
| JSON via push notification | ❌ No satellite data yet | ✅ Viable |
| JSON via webapp pull | ❌ No satellite data yet | ✅ Viable |

**Bottom line:** We use SMS *only* because satellite networks currently support SMS but not data. Once satellite data becomes available, JSON push is superior in every way.

### G.2 The Satellite Connectivity Constraint

```
┌─────────────────────────────────────────────────────────────────┐
│              WHY SMS NOW (NOT A FORMAT PROBLEM)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SATELLITE SMS (2025-2027):                                    │
│  ✓ Works — 140 bytes gets through                              │
│  ✓ Prioritised over data on constrained links                  │
│  ✓ Store-and-forward if satellite pass missed                  │
│                                                                 │
│  SATELLITE DATA (2025-2027):                                   │
│  ✗ Not available yet (Telstra/Starlink SMS-only phase)         │
│  ✗ APNs/FCM push requires IP connectivity                      │
│  ✗ No way to deliver JSON payload                              │
│                                                                 │
│  ONCE SATELLITE DATA WORKS (2027+):                            │
│  ✓ JSON push: 1-2KB payload, richer than SMS                   │
│  ✓ Silent push: App caches forecast in background              │
│  ✓ Webapp: Full interactive experience                         │
│  ✓ SMS becomes fallback only                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key insight:** JSON + push notification is the *better* architecture. We're using SMS as a bridge technology until satellite data matures.

### G.3 The Hybrid Architecture (Recommended)

```
┌─────────────────────────────────────────────────────────────────┐
│                    HYBRID ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  WEBAPP (trip planning, pre-trip, post-trip):                  │
│  ├── Browse trails, generate itinerary                         │
│  ├── View detailed forecasts with maps                         │
│  ├── See hourly breakdowns, wind, precipitation %              │
│  ├── Download GPX, export to other apps                        │
│  └── Manage account, view trip history                         │
│                                                                 │
│  SMS (on-trail, guaranteed delivery):                          │
│  ├── Daily forecast push — no user action needed               │
│  ├── Severe weather alerts                                     │
│  ├── Check-in relay to emergency contacts                      │
│  └── Works when webapp can't load                              │
│                                                                 │
│  USER JOURNEY:                                                  │
│  1. Plan trip on webapp (home, good wifi)                      │
│  2. Purchase SMS delivery                                       │
│  3. On trail: receive SMS forecasts automatically              │
│  4. Post-trip: review on webapp                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Pitch:** "Plan your trip with rich forecasts on our webapp. On the trail, get guaranteed SMS delivery."

### G.4 Future: JSON Push Notifications

Push notifications CAN carry data payloads, not just alerts:

| Platform | Max Payload | Enough for forecast? |
|----------|-------------|---------------------|
| APNs (iOS) | 4KB | Yes — comfortably |
| FCM (Android) | 4KB | Yes — comfortably |
| Web Push | ~4KB | Yes — comfortably |

A 7-day, 6-waypoint forecast in JSON is ~1-2KB compressed. Fits easily.

```
┌─────────────────────────────────────────────────────────────────┐
│                    JSON PUSH ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  TODAY (SMS):                                                   │
│  Server → Carrier → Satellite/Tower → Phone → SMS inbox        │
│                                                                 │
│  FUTURE (JSON Push):                                            │
│  Server → APNs/FCM → Satellite/Tower → Phone → App cache       │
│                                                                 │
│  The notification payload contains the actual forecast:        │
│                                                                 │
│  {                                                              │
│    "aps": {                                                     │
│      "alert": "Day 3 forecast ready",                          │
│      "sound": "default"                                         │
│    },                                                           │
│    "forecast": {                                                │
│      "day": 3,                                                  │
│      "date": "2026-01-18",                                      │
│      "waypoints": [                                             │
│        {"name": "Pelion", "am": 16, "pm": 12, "rain": 20},     │
│        {"name": "Kia Ora", "am": 14, "pm": 10, "rain": 40}     │
│      ],                                                         │
│      "alerts": ["Afternoon showers likely"]                    │
│    }                                                            │
│  }                                                              │
│                                                                 │
│  App receives push → stores forecast locally → displays        │
│  User sees rich forecast without network fetch                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### G.5 Satellite Evolution Timeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    SATELLITE EVOLUTION                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  2025-2026: SMS only                                           │
│  └── JSON push: Won't work over satellite                      │
│                                                                 │
│  2026-2027: SMS + Voice                                        │
│  └── JSON push: Still unlikely (voice = circuit-switched)      │
│                                                                 │
│  2027-2028: SMS + Voice + Limited Data                         │
│  └── JSON push: Maybe — 4KB might get through                  │
│  └── But: APNs/FCM need IP connectivity                        │
│  └── Satellite data may be too slow/unreliable                 │
│                                                                 │
│  2028+: Improved satellite data                                │
│  └── JSON push: Likely viable                                  │
│  └── 4KB payload completes in seconds on limited bandwidth     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### G.6 Migration Path Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    MIGRATION PATH                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PHASE 1 (Now): SMS primary                                    │
│  ├── SMS delivers condensed forecast                           │
│  ├── Webapp shows rich JSON (when user has signal)             │
│  └── Same backend generates both formats                       │
│                                                                 │
│  PHASE 2 (2027+): Dual delivery                                │
│  ├── App installed? → Push JSON payload                        │
│  ├── No app? → SMS fallback                                    │
│  └── User doesn't notice the switch                            │
│                                                                 │
│  PHASE 3 (2028+): JSON primary, SMS fallback                   │
│  ├── Most users get rich push notifications                    │
│  ├── SMS still works for older phones, edge cases              │
│  └── Premium tier: real-time alerts via push                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### G.7 Technical Implementation (Future-Proofed)

Build backend to generate both formats from same data:

```python
class ForecastDelivery:
    def __init__(self, trip, weather_data):
        self.trip = trip
        self.weather = weather_data
    
    def to_sms(self) -> str:
        """140-280 char condensed format"""
        return f"THUNDERBIRD D{self.day} | {self.date}\n..."
    
    def to_json(self) -> dict:
        """Rich format for app/push"""
        return {
            "trip_id": self.trip.id,
            "day": self.day,
            "waypoints": [...],
            "hourly": [...],
            "alerts": [...],
        }
    
    def to_push_payload(self) -> dict:
        """APNs/FCM format with embedded data"""
        return {
            "notification": {
                "title": f"Day {self.day} Forecast",
                "body": self.weather.summary
            },
            "data": self.to_json()  # Full forecast in payload
        }
    
    async def deliver(self, user):
        if user.has_app and satellite_data_available():
            await send_push(user.device_token, self.to_push_payload())
        else:
            await send_sms(user.phone, self.to_sms())
```

### G.8 Silent Push (Background Data Sync)

iOS and Android support **silent pushes** — data delivered without notification:

- Server sends push with `content-available: true`, no alert/sound
- App wakes in background → caches forecast → sleeps
- User opens app later → forecast already there
- No network needed at time of viewing

**Limitation:** iOS throttles silent pushes aggressively (2-3 per hour max). Perfect for twice-daily weather updates.

### G.9 Strategic Position

```
┌─────────────────────────────────────────────────────────────────┐
│                    MARKET POSITIONING                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  2025-2027: "We work when apps can't"                          │
│  └── SMS is the only option over satellite                     │
│  └── Capture market, build brand, refine product               │
│                                                                 │
│  2027+: "Seamless upgrade to rich experience"                  │
│  └── JSON push delivers richer forecasts                       │
│  └── Same subscription, better product                         │
│  └── SMS fallback for edge cases                               │
│                                                                 │
│  User perception: "It just keeps getting better"               │
│  Technical reality: We planned for this from day one           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### G.10 Decision Summary

| Decision | Rationale |
|----------|-----------|
| **SMS now (2025-2027)** | Only option that works over satellite today |
| **JSON push is the goal** | Superior format — rich, structured, 1-2KB fits easily in 4KB push payload |
| **Build dual-format backend now** | Same data model serves SMS today, JSON push tomorrow |
| **Webapp for planning** | Rich UI when connected, complements SMS delivery |
| **Keep SMS as fallback forever** | Edge cases, older phones, ultimate reliability guarantee |

**The strategic view:** SMS is a bridge technology. JSON push to a PWA/app is the target architecture. Build for both now so the transition is invisible to users.

---

## Appendix H: Administrator Functions

> **v3.1 Addition:** Admin monitoring and alerting capabilities.

### H.1 API Health Monitoring

The system must alert the administrator when critical APIs fail.

**Monitored Services:**
| Service | Check Interval | Alert Threshold |
|---------|----------------|-----------------|
| BOM ADFD API | 15 minutes | 2 consecutive failures |
| Open-Meteo (fallback) | 15 minutes | 2 consecutive failures |
| Twilio SMS | Per-message | Any failure |
| Database | 5 minutes | 1 failure |

**Alert Delivery:**
```
THUNDERBIRD ALERT
═════════════════════
⚠ BOM API FAILURE

Service: BOM ADFD Grid
Status: HTTP 503
Time: Thu 16 Jan, 14:32

Fallback: Open-Meteo ACTIVE
Action: Check BOM status page

Last success: 14:15
```

**Alert Configuration:**
```python
ADMIN_ALERTS = {
    "phone": "+61400XXXXXX",  # Admin phone
    "email": "admin@thunderbird.bot",
    "alert_types": ["api_failure", "high_error_rate", "low_balance"],
    "quiet_hours": None,  # Always alert for critical
}
```

### H.2 Admin Dashboard

Web-based dashboard at `/admin` (authenticated):

**Usage Metrics:**
| Metric | Display |
|--------|---------|
| Active trips | Count by route |
| SMS sent today | Count + cost |
| SMS sent this month | Count + cost + trend |
| Segment breakdown | By command type |
| Error rate | % failed deliveries |
| API health | Status indicators |

**Per-User View:**
| Field | Description |
|-------|-------------|
| Phone | Masked: +614XX...XXX |
| Route | Current route |
| Position | Last check-in |
| SMS usage | Segments + cost |
| Balance | Prepaid remaining |

**Cost Dashboard:**
```
THUNDERBIRD ADMIN
═════════════════════
Today: 342 segments ($18.81)
Month: 4,521 segments ($248.66)

Top Commands:
  CAST12:  45% (154 seg)
  CAST7:   28% (96 seg)
  CHECKIN: 15% (51 seg)
  Other:   12% (41 seg)

Active Users: 23
API Status: All green ✓
```

### H.3 GPS Coordinate Input

> **Status:** ✅ IMPLEMENTED in v3.3

**Commands:**
```
CAST -41.8921,146.0820      # 12hr forecast for GPS point
CAST24 -41.8921,146.0820    # 24hr forecast for GPS point
CAST -41.8921 146.0820      # Space-separated format
CAST 41.8921S,146.0820E     # Cardinal direction format
```

**Implementation details:**

1. **Coordinate parsing** (`commands.py:_parse_gps_coordinates`)
   - Supports comma-separated: `-41.8921,146.0820`
   - Supports space-separated: `-41.8921 146.0820`
   - Supports cardinal directions: `41.8921S,146.0820E`
   - Validates ranges: lat ±90°, lon ±180°

2. **Elevation lookup** (`bom.py:get_grid_elevation`)
   - Uses Open-Meteo Elevation API (SRTM DEM ~90m resolution)
   - Cached by rounded coordinates for performance

3. **Weather routing** (`webhook.py:generate_cast_forecast_gps`)
   - Australia: BOM API with Open-Meteo fallback
   - International: Routes to country-specific provider via WeatherRouter

4. **Elevation adjustment**
   - For GPS points, grid elevation = target elevation
   - No additional lapse rate adjustment needed
   - Forecast is already at correct elevation for that point

**Use cases:**
- Off-track hiking (any point, not just predefined waypoints)
- Boating (coastal forecasts)
- 4WD touring
- International trails (global coverage via Open-Meteo)

**Included in onboarding:**
- GPS format shown in registration completion message
- GPS example in HELP command response

---

## Appendix I: BOM Grid Cell Specification

### I.1 Cell Dimensions

BOM uses the Australian Digital Forecast Database (ADFD) grid:

| Region | Lat Spacing | Lon Spacing | Cell Size |
|--------|-------------|-------------|-----------|
| Tasmania | 0.02° | 0.03° | ~2.2km × 2.4km |
| Victoria | 0.02° | 0.03° | ~2.2km × 2.4km |
| Other states | 0.05° | 0.05° | ~5.5km × 5.5km |

**Cell Area:**
- Tasmania/Victoria: ~5.3 km² per cell
- Other states: ~30 km² per cell

### I.2 Cell Identification

Each cell is identified by lat/lon of its centre point:
```
Cell ID: -43.15, 146.27
Bounds: 
  North: -43.14
  South: -43.16
  East:  146.285
  West:  146.255
```

**Waypoint → Cell Mapping:**
```python
def get_cell_id(lat: float, lon: float) -> tuple:
    """Round coordinates to nearest cell centre."""
    cell_lat = round(lat / 0.02) * 0.02
    cell_lon = round(lon / 0.03) * 0.03
    return (cell_lat, cell_lon)
```

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Dec 2024 | Initial design reference |
| 2.0 | Jan 2026 | Added %Rn, ranges for Tmp/Rn/Sn, stacked format, CB for camps, TS indicators |
| 3.0 | Jan 2026 | **Major Rewrite - Pull-Based System:** Removed push notifications (6AM/6PM). All forecasts user-initiated via CAST commands. **New Routes:** Eastern Arthurs (9 camps, 5 peaks), Federation Peak (4 camps, 1 peak). **New Commands:** CAST/CAST12 (12hr), CAST24 (24hr), CAST7 (7-day camps), PEAKS (7-day peaks), CHECKIN (explicit check-in), ROUTE (list codes), ALERTS ON/OFF (opt-in BOM warnings). **Format Changes:** Merged Rn/Sn into Prec column (R2-4 rain, S1-2 snow). Added Wd (wind direction) - pattern changes signal danger. Removed CB (cloud base). All codes case-insensitive. Peak codes now 5-char (HESPE, FEDER). **Onboarding:** Simplified to 5 steps. Removed start date. Name used for SafeCheck. Peaks show full names with elevations. **Pricing:** Tiered by route difficulty ($19.99 Standard, $29.99 Advanced, $49.99 Expert) plus 50% margin SMS usage. **BOM Alerts:** Opt-in only via ALERTS ON command. |
| 3.1 | Jan 2026 | **Admin Functions:** Added Appendix H (API health monitoring, admin dashboard, usage metrics). **Future GPS:** Documented GPS coordinate input concept for v4.0. **BOM Grid Spec:** Added Appendix I with cell dimensions (~5.3 km² Tasmania). **AI Compliance:** Maintained "Super Daddy" check. |

---

*End of Document*
