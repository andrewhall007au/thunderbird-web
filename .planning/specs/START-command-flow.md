# START Command Flow Specification

**Version:** 1.0
**Date:** 2026-01-28
**Status:** Draft

## Overview

The START command allows users with multiple saved trails (or none) to select which trail to use for CAST forecasts. This replaces the current single-route onboarding flow with a flexible trail selection system.

## User Stories

1. As a returning user with multiple saved trails, I want to quickly switch between them via SMS
2. As a new user with no saved trails, I want to browse the trail library and select one
3. As a user on a long trip, I want to change my active trail without using the web app

## Flow Diagram

```
                              START
                                │
                                ▼
                    ┌───────────────────────┐
                    │ User has saved trails?│
                    └───────────────────────┘
                         │           │
                        YES          NO
                         │           │
                         ▼           │
              ┌──────────────────┐   │
              │ 1. My Trails (n) │   │
              │ 2. Trail Library │   │
              └──────────────────┘   │
                   │       │         │
                   1       2         │
                   │       │         │
                   ▼       └────┬────┘
          ┌─────────────┐       │
          │ List user's │       ▼
          │ trails 1-N  │  ┌─────────────┐
          │ 0. More →   │  │ List library│
          └─────────────┘  │ trails 1-5  │
                │          │ 0. More →   │
                │          └─────────────┘
                │                │
                ▼                ▼
          ┌─────────────────────────┐
          │ Set active trail        │
          │ Confirm + show commands │
          └─────────────────────────┘
```

## Message Specifications

### 1. Initial START Response (User Has Saved Trails)

**Trigger:** User sends `START`
**Condition:** User has 1+ saved trails

```
Welcome back, {name}!
1. My Trails ({count})
2. Trail Library
Reply 1 or 2
```

**Character count:** ~60 chars (1 SMS segment)

---

### 2. Initial START Response (User Has No Saved Trails)

**Trigger:** User sends `START`
**Condition:** User has 0 saved trails

```
Welcome to Thunderbird!
Trail Library:
1. Overland Track (AU)
2. Milford Track (NZ)
3. Tour du Mont Blanc (FR)
4. John Muir Trail (US)
5. West Highland Way (UK)
0. More →
Reply 1-5 or 0
```

**Character count:** ~200 chars (2 SMS segments)

**Note:** Skip the menu and go straight to library for new users.

---

### 3. My Trails List

**Trigger:** User replies `1` from main menu
**Condition:** User has saved trails

**3a. User has ≤5 trails:**
```
Your trails:
1. Milford Track
2. Overland Track
3. John Muir Trail
Reply 1-3 to select
```

**3b. User has >5 trails (paginated):**
```
Your trails:
1. Milford Track
2. Overland Track
3. John Muir Trail
4. Tour du Mont Blanc
5. Kungsleden
0. More →
Reply 1-5 or 0
```

**Character count:** ~120-150 chars (1 SMS segment)

---

### 4. Trail Library List

**Trigger:** User replies `2` from main menu, or new user START
**Display:** 5 trails per page, sorted by popularity/region

**Page 1:**
```
Trail Library:
1. Overland Track (AU)
2. Milford Track (NZ)
3. Tour du Mont Blanc (FR)
4. John Muir Trail (US)
5. West Highland Way (UK)
0. More →
Reply 1-5 or 0
```

**Page 2 (after user sends `0`):**
```
More trails:
6. Kungsleden (SE)
7. GR20 Corsica (FR)
8. Haute Route (CH)
9. Larapinta Trail (AU)
10. Drakensberg (ZA)
0. More →
Reply 6-10 or 0
```

**Final page:**
```
More trails:
46. Kumano Kodo (JP)
47. Tongariro (NZ)
48. Table Mountain (ZA)
Reply 46-48
```

**Note:** No "0. More →" on final page.

---

### 5. Trail Selection Confirmation

**Trigger:** User selects a trail number
**Action:** Set as active trail, confirm

```
Active: Overland Track
10 camps, 9 peaks, 5-7 days

Commands:
CAST12 <code> - 12hr forecast
CAST7 CAMPS - 7-day overview
ROUTE - list waypoint codes
```

**Character count:** ~150 chars (1 SMS segment)

---

### 6. Error Handling

**Invalid number:**
```
Reply {valid_range} to select a trail, or 0 for more options.
```

**Trail not found:**
```
Trail not found. Send START to see options.
```

**Session timeout (>30 min between messages):**
```
Session expired. Send START to begin again.
```

---

## State Management

### Session Data Structure

```python
@dataclass
class TrailSelectionSession:
    phone: str
    state: SelectionState  # MAIN_MENU, MY_TRAILS, LIBRARY
    page: int = 0          # Current pagination offset
    created_at: datetime
    expires_at: datetime   # 30 min timeout
```

### States

| State | Description | Valid Inputs |
|-------|-------------|--------------|
| `MAIN_MENU` | Showing "1. My Trails, 2. Library" | `1`, `2` |
| `MY_TRAILS` | Showing user's saved trails | `1-N`, `0` (more) |
| `LIBRARY` | Showing library trails | `1-N`, `0` (more) |

### Transitions

```
START → MAIN_MENU (if has trails)
START → LIBRARY (if no trails)
MAIN_MENU + "1" → MY_TRAILS
MAIN_MENU + "2" → LIBRARY
MY_TRAILS + number → COMPLETE (set active trail)
MY_TRAILS + "0" → MY_TRAILS (next page)
LIBRARY + number → COMPLETE (set active trail)
LIBRARY + "0" → LIBRARY (next page)
```

---

## Database Changes

### User Table

Add column:
```sql
ALTER TABLE users ADD COLUMN active_trail_id UUID REFERENCES trails(id);
```

### Trail Selection Updates

When user selects a trail:
1. Update `users.active_trail_id`
2. If selecting from library (not already saved), optionally add to user's saved trails

---

## API Endpoints (for web app sync)

```
GET  /api/user/trails          # List user's saved trails
GET  /api/library/trails       # List library trails (paginated)
POST /api/user/active-trail    # Set active trail
```

---

## Sorting & Ordering

### My Trails
- Sort by: Last used (most recent first)
- Secondary: Alphabetical

### Trail Library
- Default sort: Popularity (usage count)
- Group by region for display:
  1. User's country first (based on phone number)
  2. Then by popularity globally

### Country Codes in Library Display

| Code | Region |
|------|--------|
| AU | Australia |
| NZ | New Zealand |
| US | United States |
| CA | Canada |
| UK | United Kingdom |
| FR | France |
| CH | Switzerland |
| IT | Italy |
| JP | Japan |
| ZA | South Africa |

---

## SMS Character Limits

| Message Type | Target | Max |
|--------------|--------|-----|
| Main menu | 1 segment (160) | 160 |
| Trail list (5 items) | 1 segment | 160 |
| Confirmation | 1 segment | 160 |
| Error | 1 segment | 160 |

**Truncation rules:**
- Trail names > 20 chars: truncate with "..."
- Country codes always shown for library trails
- Never truncate waypoint counts

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| User sends START mid-session | Restart session from beginning |
| User sends CAST without active trail | "No active trail. Send START to select one." |
| User's active trail deleted | Clear active_trail_id, prompt on next CAST |
| Library is empty | "No trails available. Create one at {url}" |
| User has 100+ saved trails | Paginate 5 per page (20 pages max) |

---

## Future Enhancements (v2)

1. **Fuzzy search:** User types "milford" → matches "Milford Track"
2. **Region filter:** "START AU" → show only Australian trails
3. **Recent trails:** Show last 3 used trails at top of My Trails
4. **Quick switch:** "USE MILFORD" → set active trail by name
5. **Favorites:** Star trails for quick access

---

## Implementation Checklist

- [ ] Add `active_trail_id` column to users table
- [ ] Create `TrailSelectionSession` model
- [ ] Implement session state machine
- [ ] Add START command handler in `commands.py`
- [ ] Create trail library table/data
- [ ] Add pagination logic
- [ ] Update CAST commands to check active trail
- [ ] Add "No active trail" error handling
- [ ] Write tests for all state transitions
- [ ] Update THUNDERBIRD_SPEC with new flow

---

*Created: 2026-01-28*
