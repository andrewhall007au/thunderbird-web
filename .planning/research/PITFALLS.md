# Domain Pitfalls

**Domain:** Global hiking weather SMS platform with e-commerce, GPX route editor, affiliate program, and international weather APIs
**Researched:** 2026-01-19
**Confidence:** MEDIUM (based on domain expertise; WebSearch unavailable for verification)

## Critical Pitfalls

Mistakes that cause rewrites, revenue loss, or major operational issues.

---

### Pitfall 1: International SMS Margin Erosion

**What goes wrong:** SMS costs vary 8x between countries (e.g., USA ~$0.0075 vs South Africa ~$0.06 per segment via Twilio). A flat "$10 top-up = X segments" model means margins collapse in expensive countries. Users in South Africa get 80% fewer segments than US users for the same $10, but the marketing says "$10 top-up" globally.

**Why it happens:** Teams often:
- Hardcode segment counts from their home market
- Test only in one country during development
- Assume Twilio pricing is uniform globally
- Forget that outbound AND inbound SMS have different rates per country

**Consequences:**
- 80% margin target impossible in expensive markets
- Either lose money or deliver poor value to international users
- Pricing becomes confusing ("$10 gives you 80-180 segments depending on country")
- Affiliate commissions calculated wrong if based on segment value not dollars

**Prevention:**
1. Build country-specific SMS cost tables from Day 1:
   ```python
   SMS_COSTS = {
       "US": {"outbound": 0.0079, "inbound": 0.0075},
       "UK": {"outbound": 0.042, "inbound": 0.0075},
       "ZA": {"outbound": 0.058, "inbound": 0.0075},
       # ... all 8 countries
   }
   ```
2. Calculate segments-per-$10 dynamically per country at purchase time
3. Display country-specific segment counts in UI ("$10 = ~120 forecasts in USA, ~40 in South Africa")
4. Store `country_code` on every user for cost calculations
5. Build margin monitoring dashboard with per-country breakdown

**Detection (warning signs):**
- No country field in user/purchase database schema
- Single SMS cost constant in code
- Pricing page shows fixed segment counts globally
- No margin calculation in purchase flow

**Phase to address:** E-commerce/Payments phase - must be solved before any international purchases

---

### Pitfall 2: Affiliate Code Stacking Exploitation

**What goes wrong:** Allowing affiliate discount codes to stack with launch pricing creates arbitrage. Launch price ($29.99) + 20% affiliate discount ($23.99) + potential referral credit = product sold below cost. Affiliates self-refer using burner accounts. Trailing commissions compound losses.

**Why it happens:**
- Generous affiliate terms designed for growth
- "Stack with launch pricing" intentionally chosen for incentive
- Didn't model extreme stacking scenarios
- Trailing commissions forgotten in stacking math

**Consequences:**
- Revenue per customer negative in extreme cases
- Affiliates game the system (self-referral, code sharing)
- Trailing commissions on top-ups compound losses over years
- LTV calculations completely wrong

**Prevention:**
1. Model the worst-case stacking scenario before launch:
   ```
   Minimum price: $29.99 launch
   - 25% affiliate discount: $22.49
   - Affiliate commission (15% of $22.49): $3.37
   - Trailing commission on $10 top-ups (15% for 2 years): $X
   - Net revenue after 2 years: Calculate this
   ```
2. Implement commission basis rules:
   - Commission on purchase price AFTER discount
   - Cap total discount at X% of RRP
   - Or: affiliate codes don't stack with launch pricing
3. Fraud detection:
   - Flag same-IP/device for referrer and referred
   - Limit referrals per affiliate per day
   - Delayed commission payout (30 days) to detect fraud

**Detection (warning signs):**
- No stacking limits in affiliate configuration
- Commission calculated on RRP not actual paid price
- No fraud detection in affiliate tracking
- Trailing commission duration unbounded

**Phase to address:** Affiliate Program phase - design must prevent exploitation before going live

---

### Pitfall 3: Weather API Resolution Mismatch

**What goes wrong:** Different national weather services provide wildly different resolutions. BOM (Australia) gives 3km grid cells. Met Office (UK) might give 5km. Open-Meteo gives variable resolution. Your SMS format assumes specific precision. Users notice forecasts are wrong for their exact location.

**Why it happens:**
- Each country researched independently
- Resolution stored differently (grid size vs point forecast)
- Lapse rate calculations assume consistent base resolution
- "Fallback to Open-Meteo" doesn't preserve resolution expectations

**Consequences:**
- Forecasts feel inaccurate in some countries
- Marketing claims inconsistent accuracy
- User complaints concentrate in low-resolution countries
- Can't compare forecast quality across markets

**Prevention:**
1. Document resolution for EVERY API before integration:
   ```markdown
   | Country | Primary API | Resolution | Notes |
   |---------|-------------|------------|-------|
   | USA | NWS | 2.5km | Free, reliable |
   | UK | Met Office | 5km | Paid tier for 1.5km |
   | France | Meteociel | 3km | Undocumented |
   ```
2. Build abstraction layer that normalizes resolution:
   - Store `api_resolution_km` per weather source
   - Adjust confidence indicators based on resolution
   - Show "Resolution: ~Xkm" in admin dashboard per country
3. Marketing accuracy claims must reference worst-case resolution
4. Test forecasts against actual conditions in each country (validation set)

**Detection (warning signs):**
- Weather service abstraction has no resolution field
- Same forecast format used regardless of data source
- No per-country accuracy metrics
- Fallback to Open-Meteo loses metadata about source

**Phase to address:** Weather API Integration phase - research and document before any implementation

---

### Pitfall 4: GPX Route Editor State Management Chaos

**What goes wrong:** User creates route, adds 12 waypoints, edits names, leaves tab open overnight, comes back, makes more edits, then saves. Browser refresh mid-edit loses everything. Mobile users lose work when app backgrounds. "Save" means different things (local draft vs server-persisted vs published route).

**Why it happens:**
- Map editors feel like desktop apps (auto-save assumed)
- Browser localStorage limits hit (5MB) with large GPX files
- No distinction between "draft" and "saved" states
- Optimistic updates without offline queue

**Consequences:**
- Users lose hours of route planning work
- Support tickets about "route disappeared"
- Angry customers before they've even purchased
- Route data corruption from partial saves

**Prevention:**
1. Design state management explicitly:
   ```
   DRAFT (localStorage) -> SAVED (server, unpublished) -> ACTIVE (linked to purchase)
   ```
2. Implement aggressive auto-save:
   - Debounced save to server every 30 seconds if changes
   - Show "Saving..." / "Saved" indicator always visible
   - Store full GPX in server-side draft, not just localStorage
3. Handle browser events:
   - `beforeunload` warns if unsaved changes
   - `visibilitychange` triggers save when backgrounding
   - Periodic heartbeat detects tab abandonment
4. Conflict resolution for multi-device:
   - "This route was modified on another device. Keep which version?"

**Detection (warning signs):**
- Route data stored only in localStorage
- No `last_saved_at` timestamp visible to user
- No draft/saved/published state machine
- Save button only appears at end of flow

**Phase to address:** Route Creation phase - must be designed into architecture, not bolted on

---

### Pitfall 5: Two Purchase Paths with Untracked Attribution

**What goes wrong:** "Buy now" and "Create first" paths exist but share conversion tracking. Can't tell which path actually converts better. A/B test runs but results are polluted because users switch paths mid-funnel. Affiliate attribution breaks when user starts on affiliate link, abandons, returns via direct.

**Why it happens:**
- Conversion tracking added after initial build
- Funnel designed without explicit entry/exit points
- Session vs user-level tracking confusion
- Affiliate cookies overwrite each other

**Consequences:**
- Can't make data-driven decisions about which path to promote
- A/B test results meaningless
- Affiliate attribution disputed ("I referred them!")
- Marketing spend optimized on wrong signals

**Prevention:**
1. Track entry point at session start, persist through purchase:
   ```javascript
   // On page load
   if (!session.entry_path) {
     session.entry_path = window.location.pathname.includes('create')
       ? 'create_first' : 'buy_now';
   }
   ```
2. Affiliate attribution rules documented and enforced:
   - First-touch vs last-touch vs both (with decay)
   - Cookie lifetime explicit (30 days recommended)
   - Multiple affiliates: first wins, or split
3. Funnel stage tracking:
   - `started_create`, `completed_create`, `started_checkout`, `completed_purchase`
   - Include `entry_path` in all events
4. Build attribution dashboard before launch, not after

**Detection (warning signs):**
- Single "conversion" event without path context
- Affiliate tracking in URL only (no cookie)
- No funnel visualization in analytics
- A/B test system can't segment by entry path

**Phase to address:** User Flow & Conversion phase - tracking must be designed before flows are built

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or user friction.

---

### Pitfall 6: Stripe Card Storage Without Clear Top-Up UX

**What goes wrong:** Store card for "one-click top-ups" but don't make it clear when/why charges occur. User gets SMS "Low balance: $2 remaining", tops up $10, forgets. Month later, another low balance SMS, they think it's fraud. Chargebacks ensue.

**Why it happens:**
- One-click convenience prioritized over transparency
- Low balance SMS doesn't remind them they stored a card
- No charge notification sent
- Stored card feels different from manual top-up psychologically

**Consequences:**
- Chargeback rate increases (expensive with Stripe)
- Trust destroyed ("they charged me without asking")
- Support burden explaining "you stored your card"

**Prevention:**
1. Clear stored card messaging:
   - "Card ending 4242 saved. Text 'TOPUP' to auto-charge $10."
   - NOT: "Card saved for one-click top-ups"
2. Confirmation for stored card charges:
   - Either: require SMS command to confirm
   - Or: send immediate charge notification SMS
3. Low balance SMS includes context:
   - "$2 remaining. Reply TOPUP for $10 (card ending 4242) or BUY $10 for manual."
4. Allow card removal via SMS: "REMOVECARD" command

**Detection (warning signs):**
- Stored card charged without user action
- No charge notification SMS
- Can't remove stored card via SMS
- Low balance message doesn't mention stored card

**Phase to address:** E-commerce/Payments phase

---

### Pitfall 7: Weather API Failover Without Data Consistency

**What goes wrong:** Primary API (e.g., Met Office) fails, system falls back to Open-Meteo. Open-Meteo uses different field names, different units, different precision. Forecast format breaks or shows obviously wrong data. User gets "Wind: 90mph" when it should be "Wind: 90km/h".

**Why it happens:**
- Failover tested for "does it return data" not "is data correct"
- Unit conversion added in primary path, not failover
- Field mapping incomplete
- Fallback API updated, mapping not updated

**Consequences:**
- Dangerous weather information delivered
- User trust destroyed
- Potential liability if decisions made on wrong data

**Prevention:**
1. Weather data normalization layer (mandatory for all sources):
   ```python
   class NormalizedForecast:
       temp_c: float  # Always Celsius
       wind_kmh: float  # Always km/h
       rain_mm: float  # Always millimeters
       source: str  # Track which API provided this
   ```
2. Validation after normalization:
   - Temp: -40 to +50 reasonable
   - Wind: 0 to 200 km/h reasonable
   - Reject outliers, log for investigation
3. Integration tests for EACH failover scenario:
   - Primary returns, fallback not called
   - Primary fails, fallback returns
   - Both fail, graceful error message
4. Show source indicator in forecast (subtle but present)

**Detection (warning signs):**
- Different parsing code for each weather API
- No unit constants in codebase
- Failover tested with mocks only, not real API
- No validation bounds on weather values

**Phase to address:** Weather API Integration phase

---

### Pitfall 8: GPX Parsing Edge Cases

**What goes wrong:** GPX files come from Garmin, Strava, Komoot, AllTrails, hand-edited XML. Each has quirks:
- Garmin adds extensions with `<gpxx:` namespace
- Strava exports tracks, not routes
- Some files have no elevation data
- Some use `<rtept>` some use `<wpt>` some use `<trkpt>`

**Why it happens:**
- GPX "standard" is loosely followed
- Testing only done with one export source
- Validation checks existence, not correctness
- Elevation required for lapse rate but not validated early

**Consequences:**
- "Upload failed" with no helpful error
- Route displays but forecasts wrong (missing elevation)
- Support tickets for every GPX format variation

**Prevention:**
1. GPX validation library with clear error messages:
   ```python
   errors = validate_gpx(file)
   if errors:
       return {"errors": [
           "Missing elevation data on 3 waypoints",
           "Track contains 847 points - please simplify to <100 waypoints"
       ]}
   ```
2. Support common variants:
   - Tracks (trkpt) - offer to convert to waypoints
   - Routes (rtept) - primary support
   - Waypoints (wpt) - direct import
3. Fallback elevation lookup via Open-Meteo elevation API
4. Show preview with warnings before accepting upload

**Detection (warning signs):**
- Single GPX parsing path with no variant handling
- No elevation validation
- Generic "Upload failed" error message
- No GPX preview before save

**Phase to address:** Route Creation phase

---

### Pitfall 9: Timezone Chaos in International Forecasts

**What goes wrong:** Server runs in UTC. Weather API returns forecasts in local time. User is a New Zealand hiker but signs up from Sydney. Forecast says "6AM" but it's New Zealand 6AM, not Sydney time, not UTC. "CAST7" shows days offset by 1 because of date boundary confusion.

**Why it happens:**
- Developers work in one timezone
- "Just use UTC" doesn't solve user-facing times
- Route has a timezone, user has a timezone, weather API has a timezone
- Daylight saving transitions create inconsistencies

**Consequences:**
- Forecasts show wrong time of day
- Day boundaries wrong (wrong date in header)
- User confusion about when weather applies
- Support tickets from confused international users

**Prevention:**
1. Explicit timezone at EVERY layer:
   ```python
   class Route:
       timezone: str  # e.g., "Pacific/Auckland"

   class Forecast:
       valid_at: datetime  # Always UTC internally
       display_timezone: str  # Route's timezone for display
   ```
2. Display times in route's timezone, always:
   - Route in NZ = NZ times in forecast
   - Server stores UTC, converts on display
3. Test daylight saving transitions:
   - UK: BST/GMT boundary
   - NZ: NZDT/NZST boundary
   - South Africa: no DST (different from neighbors)
4. Forecast header includes timezone: "Thu 16 Jan NZDT"

**Detection (warning signs):**
- No timezone field on Route model
- Times displayed without timezone indicator
- No DST-boundary test cases
- Server timezone assumed for display

**Phase to address:** Weather API Integration phase (affects display format)

---

### Pitfall 10: Trailing Commission Accounting Complexity

**What goes wrong:** User purchases via affiliate A, then tops up 3 times over 2 years. Affiliate A gets commission on each top-up. But:
- What if user disputes a charge? Commission clawback?
- What if affiliate violates TOS? Forfeit pending commissions?
- How do you report commissions for tax purposes?
- What if you change commission rates mid-stream?

**Why it happens:**
- Initial design covers happy path only
- Financial edge cases discovered during operation
- Tax reporting requirements differ by affiliate's country
- No clear commission lifecycle (pending -> approved -> paid)

**Consequences:**
- Manual accounting interventions
- Disputed commissions with no resolution process
- Tax reporting headaches
- Affiliate complaints about missing commissions

**Prevention:**
1. Commission state machine:
   ```
   PENDING (purchase detected)
   -> APPROVED (after 30-day hold period, no chargeback)
   -> PAID (payout processed)

   PENDING -> REVERSED (chargeback, refund)
   ```
2. Store commission rate at time of transaction (not current rate):
   ```python
   class Commission:
       user_id: str
       affiliate_id: str
       purchase_id: str
       amount_cents: int
       commission_rate: float  # Rate when earned, not current
       status: str
       created_at: datetime
   ```
3. Build reporting from Day 1:
   - Per-affiliate: pending, approved, paid, reversed
   - Date range filters
   - CSV export for affiliate's tax reporting
4. Document commission policies in affiliate agreement

**Detection (warning signs):**
- Commission calculated on-the-fly, not stored
- No commission state field
- No hold period before approval
- No chargeback handling for commissions

**Phase to address:** Affiliate Program phase

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable without major rework.

---

### Pitfall 11: Map Editor Pin Clustering

**What goes wrong:** User uploads GPX with 500 track points. Map shows 500 pins. Browser slows to crawl. Or: user zooms out, pins overlap completely, clicking selects wrong one.

**Prevention:**
- Implement marker clustering (Leaflet.markercluster)
- Simplify GPX tracks on upload (Douglas-Peucker algorithm)
- Limit max waypoints (e.g., 100) with helpful simplification

**Phase to address:** Route Creation phase

---

### Pitfall 12: SMS Code Generation Collisions

**What goes wrong:** User names waypoint "Lake Oberon", system generates "LAKEO". Another user names waypoint "Lake O'Brien", system generates "LAKEO". Collision. Within same route, this breaks commands.

**Prevention:**
- Check for collisions within route before accepting name
- Offer alternatives: "LAKEO taken, try LAKEO1 or LAKOB?"
- Case-insensitive collision detection

**Phase to address:** Route Creation phase

---

### Pitfall 13: Stripe Webhook Reliability

**What goes wrong:** Stripe sends payment_intent.succeeded webhook. Server is briefly down. Webhook fails. Stripe retries, server processes twice. User charged once but system shows two purchases. Or: webhook never arrives, user paid but not activated.

**Prevention:**
- Idempotency keys on all Stripe operations
- Webhook signature validation (reject replays)
- Store Stripe event IDs, skip duplicates
- Reconciliation job to catch missed webhooks

**Phase to address:** E-commerce/Payments phase

---

### Pitfall 14: Weather API Rate Limits Across Countries

**What goes wrong:** Free tier of NWS (USA) allows 1000 calls/day. Met Office (UK) allows 50/day on free tier. You hit UK limit quickly because all forecasts for UK users funnel through single API. But US users are fine. Inconsistent user experience by country.

**Prevention:**
- Document rate limits per API per country
- Implement caching aggressively (forecasts valid for hours)
- Monitor rate limit usage per API
- Plan upgrade paths when limits hit

**Phase to address:** Weather API Integration phase

---

### Pitfall 15: Mobile GPX Upload Friction

**What goes wrong:** User on iPhone tries to upload GPX. Safari doesn't let them browse Files easily. GPX in email attachment can't be uploaded without saving first. Android is different. Each flow has friction that loses users.

**Prevention:**
- Support multiple upload methods: file picker, drag-drop, paste URL, email-to-upload
- Test on actual mobile devices (not just simulator)
- Consider "Share to Thunderbird" integration for common hiking apps

**Phase to address:** Route Creation phase

---

## Phase-Specific Warning Matrix

| Phase | Top Pitfalls | Required Before Launch |
|-------|-------------|----------------------|
| **E-commerce/Payments** | #1 (SMS margin), #6 (card UX), #13 (webhooks) | Country-specific pricing, charge notifications, idempotency |
| **Affiliate Program** | #2 (stacking), #10 (trailing commissions) | Stacking limits, commission state machine |
| **Route Creation** | #4 (state management), #8 (GPX parsing), #11 (clustering), #12 (collisions) | Auto-save, GPX variants, collision detection |
| **Weather APIs** | #3 (resolution), #7 (failover), #9 (timezone), #14 (rate limits) | Normalization layer, timezone handling |
| **User Flow/Conversion** | #5 (attribution) | Entry path tracking, affiliate attribution rules |

---

## International SMS Cost Reference

Based on Twilio pricing (approximate, verify before implementation):

| Country | Outbound/Segment | Inbound/Segment | $10 = Segments (80% margin) |
|---------|------------------|-----------------|----------------------------|
| USA | $0.0079 | $0.0075 | ~250 segments |
| Canada | $0.0079 | $0.0075 | ~250 segments |
| UK | $0.042 | $0.0075 | ~47 segments |
| France | $0.072 | $0.0075 | ~28 segments |
| Italy | $0.058 | $0.0075 | ~35 segments |
| Switzerland | $0.062 | $0.0075 | ~32 segments |
| New Zealand | $0.048 | $0.0075 | ~42 segments |
| South Africa | $0.058 | $0.0075 | ~35 segments |

**Note:** These are estimates. Actual rates vary by number, volume, and Twilio pricing tier. Build flexibility into the pricing model.

---

## Sources

- Domain expertise in SMS-based products and international e-commerce
- Project context from `/Users/andrewhall/thunderbird-web/.planning/PROJECT.md`
- Technical architecture from `/Users/andrewhall/thunderbird-web/.planning/codebase/`
- Twilio pricing patterns (based on training data, verify with current Twilio documentation)
- Stripe webhook patterns (based on training data, verify with current Stripe documentation)

**Confidence Assessment:**
- SMS cost patterns: MEDIUM (Twilio pricing changes; verify current rates)
- E-commerce patterns: HIGH (well-established domain patterns)
- Weather API patterns: MEDIUM (varies by provider; research each)
- GPX parsing: HIGH (stable standard with known variants)
- Affiliate program: HIGH (common e-commerce pattern)

---

*Pitfalls audit: 2026-01-19*
