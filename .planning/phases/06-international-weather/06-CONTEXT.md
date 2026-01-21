# Phase 6: International Weather - Context

**Gathered:** 2026-01-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Weather API integrations for 8 countries (USA, Canada, UK, France, Italy, Switzerland, New Zealand, South Africa) with Open-Meteo as universal fallback. This phase adds data SOURCES only — the existing SMS format and waypoint structure remain unchanged.

**Not in scope:** Changing SMS format, adding new weather data fields, modifying how forecasts are requested.

</domain>

<decisions>
## Implementation Decisions

### SMS Forecast Content
- Forecast format is ALREADY DEFINED — use existing website spec ("weather forecast in header")
- SMS structure for multi-waypoint routes is ALREADY LIVE — no changes
- Number of forecast days: User configurable when setting up route
- Temperature units: User preference (set during route setup)
- Weather alerts: YES, include when available from APIs — prioritize alert display

### API Priority & Selection
- All 8 countries should work at launch — equal priority
- Resolution first: Prefer higher accuracy even if it costs more
- Cost threshold: Accept paid APIs if under $50/month for reasonable volume
- Native APIs preferred, but researcher should document costs AND resolution for each country
- Elevation: Use waypoint elevation for forecasts (not nearest station)

### Fallback Strategy
- Open-Meteo is universal fallback for ALL countries
- Always fall back to Open-Meteo if native API fails (temporary or otherwise)
- If ALL APIs fail (native + Open-Meteo): Alert user via SMS explaining issue, offer manual retry

### Caching & Fetching
- Cache duration: 1 hour
- Fetching strategy: Hybrid — pre-fetch for popular/active routes, on-demand for others

### Authentication
- API keys via environment variables (standard .env approach)

### Data Source Display
- Show source (NWS, Met Office, etc.) in web dashboard — NOT in SMS
- Note when fallback was used ("Fallback source used" indicator in dashboard)
- No freshness timestamp needed — system handles it
- Cross-border routes: Each waypoint uses its country's best API

### Claude's Discretion
- Specific caching implementation
- Rate limit handling per API
- Exact retry logic before fallback
- How to determine "popular" routes for pre-fetching

</decisions>

<specifics>
## Specific Ideas

- Existing deployed project already handles SMS formatting — this phase is purely about weather data sources
- Mountain weather accuracy matters — use waypoint elevation, not nearest station
- Hikers depend on this data — resolution trumps cost within the $50/month threshold

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-international-weather*
*Context gathered: 2026-01-21*
