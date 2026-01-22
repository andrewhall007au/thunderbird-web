# Context Handoff - 2026-01-22 (Updated)

## Current Session: Trip Cost Simulator & Global Coverage

**Status:** Design complete, UI implemented, next steps documented

---

## What Was Done This Session

### 1. Trip Cost Simulator Design (Not Yet Built)
Designed SMS cost estimation model for users before trips:
- **Day 1 base:** CAST7 CAMPS (~6 seg) + CAST7 PEAKS (~5 seg) = ~11 segments
- **Daily usage tiers:**
  - Moderate: 1× CAST12 camp + 1× CAST12 peak = ~6 segments/day
  - High: 2× each = ~12 segments/day
- **7-day trip estimates (moderate):** AU ~$14, US ~$2.20, NZ ~$28

### 2. Weather API Research
Documented all weather providers by country:
- Created comparison tables (free vs paid, resolution, costs)
- Key findings:
  - AU, US, CA, UK, FR, CH: Excellent free options (1-3km)
  - IT: 7×7km (acceptable)
  - NZ: Upgrade to MetService $30/mo recommended (4km vs 11km free)
  - ZA: Poor 25km free - needs AfriGIS investigation

### 3. Global Coverage Section - Home Page (`app/page.tsx`)
- Added "High resolution global coverage" section
- **Desktop:** Horizontal table with 9 countries as headers
- **Mobile:** 3-column card grid
- Shows resolution (e.g., "3×3 km") for each country
- UK shows "Point" without "km" suffix

### 4. Global Coverage Section - How It Works (`app/how-it-works/page.tsx`)
- Added detailed table: Country, Resolution, Update Frequency, Source
- **Mobile:** Stacked cards with country/source left, resolution/frequency right
- **Desktop:** 4-column table

### 5. Preview Page (`app/preview/page.tsx`)
- NEW: Created `/preview` route for responsive testing
- Shows mobile (375px) and desktop side-by-side
- Note: iframes don't simulate CSS media queries - use browser DevTools for true testing

### 6. Buy Now Buttons Added
- After "Why SMS" section
- After "Global Coverage" section
- After "Simple Pricing" section

---

## Files Modified
```
app/page.tsx              - GlobalCoverage component, Buy Now buttons
app/how-it-works/page.tsx - Global Coverage table (responsive)
app/preview/page.tsx      - NEW: Preview page for testing
```

---

## Next Steps (TODO)

### Priority 1: Trip Cost Simulator Component
Location: Account dashboard (behind paywall)
```
- [ ] Create TripCostSimulator component
- [ ] Inputs: trip duration (days), usage tier (moderate/high), country
- [ ] Calculate: Day 1 base + (daily segments × days)
- [ ] Output: estimated cost, current balance, shortfall + top-up CTA
- [ ] Use SMS pricing from backend/config/sms_pricing.py
```

### Priority 2: Onboarding Email Enhancement
Update SendGrid order confirmation to include:
```
- [ ] Step 1: Log in and create your first route
- [ ] Step 2: Use the cost simulator to estimate trip costs
- [ ] Step 3: Top up balance if needed
- [ ] Step 4: SMS command quick reference
```

### Priority 3: Preview Page Enhancement
User mentioned a reference at localhost:8000/preview - investigate and improve:
```
- [ ] Check reference design for better responsive preview
- [ ] Consider actual viewport simulation if possible
```

### Priority 4: Weather Provider Upgrades (When Scaling)
```
- [ ] NZ: Integrate MetService API ($30/mo) when NZ users grow
- [ ] ZA: Contact AfriGIS for pricing
- [ ] Open-Meteo: Commercial license (€29/mo) for SLA
```

---

## Key Reference Data

### Segment Counts
| Command | Segments |
|---------|----------|
| CAST7 CAMPS (all) | ~6 |
| CAST7 PEAKS (all) | ~5 |
| CAST12 (single) | ~3 |
| CAST24 (single) | ~6 |

### SMS Pricing (per segment, USD)
| Country | Rate | Segments/$10 |
|---------|------|--------------|
| US/CA | $0.04 | 240 |
| AU/UK | $0.26 | 38 |
| FR | $0.40 | 25 |
| CH | $0.36 | 27 |
| IT | $0.46 | 21 |
| NZ | $0.53 | 19 |
| ZA | $0.54 | 18 |

### Weather Resolution (current implementation)
| Country | Resolution | Source | Cost |
|---------|------------|--------|------|
| AU | 3×3 km | BOM | FREE |
| US | 2.5×2.5 km | NWS | FREE |
| CA | 2.5×2.5 km | Environment Canada | FREE |
| UK | Point | Met Office | FREE |
| FR | 1.5×1.5 km | Météo-France (Open-Meteo) | FREE |
| CH | 1×1 km | MeteoSwiss (Open-Meteo) | FREE |
| IT | 7×7 km | DWD ICON-EU (Open-Meteo) | FREE |
| NZ | 4×4 km | MetService | $30/mo |
| ZA | 11×11 km | GFS (Open-Meteo) | FREE |

---

## Dev Server
Running on http://localhost:3000

---

*Handoff updated: 2026-01-22*
