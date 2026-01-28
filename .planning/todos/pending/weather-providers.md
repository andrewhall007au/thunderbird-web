# Weather Provider Upgrades

## Overview

Research completed 2026-01-28. Three markets have higher-resolution options available.

## Priority 1: New Zealand (MetService 4km)

**Why:** "Massive market" per user. Currently worst resolution (9km) among developed hiking markets.

### Provider Details
- **API:** https://data.metservice.com/
- **Model:** 4km WRF (tuned for NZ terrain)
- **Pricing:**
  - Plus: $75/mo for 1.5M calls ($0.00005/call)
  - Pro: $500/mo with 10-day forecasts
- **Free tier:** Personal use only, not commercial

### Technical Integration
- REST API with OpenAPI docs
- Response includes atmospheric variables (wind, temp, humidity, cloud cover/base)
- Temperature at 2m above model surface
- **Elevation handling:** Check if API returns model orography. If not, use existing Open Topo Data 49-point sampling with 4km grid size.

### Action Items
- [ ] Sign up for MetService account
- [ ] Test free tier to verify API response schema
- [ ] Create `backend/app/services/weather/providers/metservice.py`
- [ ] Add NZ to router with MetService as primary
- [ ] Update website resolution to 4km
- [ ] Evaluate $75/mo Plus tier for commercial use

---

## Priority 2: South Africa (AfriGIS/SAWS 4.4km)

**Why:** Free 60-day pilot available. 2x better than current ECMWF (9km).

### Provider Details
- **API:** https://developers.afrigis.co.za/
- **Model:** 4.4km Unified Model (same as UK Met Office)
- **Pricing:**
  - Pilot: 50 credits/day for 60 days (FREE)
  - Commercial: Contact sales@afrigis.co.za
- **Data source:** South African Weather Service (SAWS)

### Technical Integration
- OAuth2 authentication
- Forecast API returns daily and 6-hourly data
- Includes lightning and storm data (bonus!)
- **Elevation handling:** Unified Model same as UK Met Office. Check for model orography in response, else use 4.4km grid sampling.

### Action Items
- [ ] Email sales@afrigis.co.za for pilot access
- [ ] Test pilot API with SA coordinates
- [ ] Document response schema and elevation fields
- [ ] Create provider based on Met Office pattern
- [ ] Get commercial pricing quote
- [ ] Evaluate ROI vs ECMWF fallback

---

## Priority 3: Japan (JWA 1km) - Future

**Why:** 5x better resolution than current JMA 5km. But current 5km is already good for hiking.

### Provider Details
- **API:** https://weather-jwa.jp/
- **Model:** 1km mesh
- **Pricing:**
  - Setup: ¥15,000 (~$100 USD)
  - Monthly: ¥32,000 (~$210 USD)
- **No free tier**

### Technical Integration
- API returns elevation field in response
- Verify if elevation is model orography or point DEM
- At 1km resolution, elevation adjustments are smaller

### Decision Criteria
- Wait until Japan becomes significant market
- Current 5km JMA via Open-Meteo is free and adequate
- $210/mo only justified if Japan revenue > $500/mo

### Action Items (Future)
- [ ] Monitor Japan user signups
- [ ] Re-evaluate when Japan revenue > $500/mo
- [ ] Contact JWA for API documentation
- [ ] Test if 1km provides meaningful accuracy improvement for hiking

---

## Current State (10 Countries)

| Country | Provider | Resolution | Status |
|---------|----------|------------|--------|
| Australia | BOM | 2.2km | Live |
| USA | NWS + HRRR | 2.5km | Live |
| Canada | EC + GEM | 2.5km | Live |
| UK | Met Office | 1.5km | Live |
| France | Météo-France | 1.5km | Live |
| Switzerland | MeteoSwiss | 2.0km | Live |
| Italy | ICON-EU | 7.0km | Live |
| Japan | JMA | 5.0km | **NEW** |
| New Zealand | ECMWF | 9.0km | Upgrade available |
| South Africa | ECMWF | 9.0km | Upgrade available |

---

## Elevation Handling Reference

All providers need temperature adjustment for mountainous terrain:

```python
# Existing system in backend/app/services/elevation.py
# Works for any new provider

1. Get model_elevation from provider (if available)
2. If not available, sample 49 points via Open Topo Data
3. Apply lapse rate: temp_adjusted = temp - (user_elev - model_elev) * 0.0065
```

Lapse rate: 6.5°C per 1000m (standard atmosphere)

---

*Created: 2026-01-28*
