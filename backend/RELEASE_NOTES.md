# Release Notes

## v3.0.1 (Hotfix) - 2026-02-03

### Critical Bug Fix: AU→BOM Provider Mapping

**Problem:**
- Australian coordinates were using Open-Meteo fallback (9km resolution)
- Spec documented AU→BOM but implementation was missing
- Users receiving lower-quality forecasts

**Solution:**
- Created `BOMProvider` wrapper (`app/services/weather/providers/bom.py`)
- Added AU→BOM mapping to router (line 97)
- Australian users now get native 2.2km BOM resolution

**Testing:**
- ✅ All 30 weather router tests pass
- ✅ All 8 spec alignment tests pass
- ✅ New AU-specific test validates BOM usage

**Deployment:**
- Zero downtime deployment
- No breaking changes
- All existing routes continue to work

**Impact:**
- 🇦🇺 Australian users: 2.2km → better forecast accuracy
- 🌍 International users: No change
- 🔒 Spec validation: Future drift automatically detected

**Credits:**
- Issue identified by: OpenClaw Code Review
- Fixed by: Claude Code + Human Review

**Documentation:**
- Technical analysis: `AU_BOM_FIX_SUMMARY.md`
- Deployment guide: `DEPLOYMENT_GUIDE.md`

---

## v3.0.0 - 2026-01-XX

### International Weather Support

**New Features:**
- GPS coordinate forecasts worldwide
- Country-specific weather providers
- Regional model routing
- Enhanced SafeCheck system

**Supported Countries:**
- 🇦🇺 Australia (BOM - 2.2km)
- 🇺🇸 United States (NWS - 2.5km)
- 🇨🇦 Canada (Environment Canada - 2.5km)
- 🇬🇧 United Kingdom (Met Office - 1.5km)
- 🇫🇷 France (Meteo-France AROME - 1.5km)
- 🇨🇭 Switzerland (MeteoSwiss ICON - 2km)
- 🇮🇹 Italy (DWD ICON-EU - 7km)
- 🇯🇵 Japan (JMA MSM - 5km)
- 🇳🇿 New Zealand (ECMWF - 9km)
- 🇿🇦 South Africa (ECMWF - 9km)

**Provider Architecture:**
- Automatic fallback to Open-Meteo on provider failure
- Standardized `NormalizedDailyForecast` format
- 1-hour TTL caching for performance
- Provider-specific supplementation (NWS + HRRR for precip)

**CAST Commands Enhanced:**
```
CAST -41.89,146.08      # Any GPS coordinates
CAST24 -41.89,146.08    # 24-hour forecast
CAST7 LAKEO             # 7-day forecast
CAST7 CAMPS             # All camps grouped
```

**Breaking Changes:**
- None - fully backward compatible

---

## v2.0.0 - 2025-XX-XX

### Multi-Trail System

**New Trails:**
- Eastern Arthurs
- Federation Peak
- Combined Arthurs
- South Coast Track

**Payment System:**
- Stripe integration
- $49.99 per trip
- Launch pricing: $29.99

**Admin Features:**
- User management dashboard
- Beta application system
- SMS cost monitoring

---

## v1.0.0 - 2025-XX-XX

### Initial Release

**Core Features:**
- Western Arthurs Full Traverse
- Overland Track
- BOM weather integration
- SMS delivery via Twilio
- Danger rating system
- Automated 6 AM/6 PM pushes

**Technology:**
- FastAPI backend
- SQLite database
- Twilio SMS
- BOM undocumented API
