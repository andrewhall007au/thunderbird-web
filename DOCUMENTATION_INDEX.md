# Thunderbird Documentation Index

Complete documentation for the Thunderbird Weather project.

## 📚 Quick Links

### Getting Started
- [Main README](README.md) - Project overview and quick start
- [Backend README](backend/README.md) - Backend API documentation
- [Deployment Guide](DEPLOYMENT_GUIDE.md) - How to deploy to production

### Release Information
- [CHANGELOG](CHANGELOG.md) - Version history and changes
- [Release Notes](backend/RELEASE_NOTES.md) - Detailed release information
- [Current Version](backend/.version) - Version number file

### Recent Updates
- [AU→BOM Fix Summary](AU_BOM_FIX_SUMMARY.md) - Critical provider mapping fix (2026-02-03)

## 📖 Core Documentation

### Specifications
Located in `docs/`:
- `THUNDERBIRD_SPEC_v3.2.md` - Complete system specification
- `WEATHER_API_SPEC.md` - Weather provider integration specs

### Architecture & Planning
Located in `.planning/`:
- `CONTEXT-HANDOFF.md` - Project context for onboarding
- `research/ARCHITECTURE.md` - System architecture overview
- `research/PITFALLS.md` - Common pitfalls and how to avoid them
- `phases/` - Phase-by-phase implementation plans

## 🔧 Technical Documentation

### Backend (`backend/`)

#### Core Services
- `app/services/bom.py` - BOM weather service (Australia)
- `app/services/weather/router.py` - Country-to-provider routing
- `app/services/weather/providers/` - Weather provider implementations
  - `bom.py` - BOM provider wrapper
  - `nws.py` - US National Weather Service
  - `envcanada.py` - Environment Canada
  - `metoffice.py` - UK Met Office
  - `openmeteo.py` - Open-Meteo (fallback)
- `app/services/formatter.py` - SMS message formatting
- `app/services/sms.py` - Twilio SMS integration

#### Configuration
- `config/settings.py` - Application settings and thresholds
- `config/routes/` - Route definitions (JSON)

#### Testing
- `tests/test_weather_router.py` - Weather provider routing tests
- `tests/test_spec_alignment.py` - Spec compliance validation
- `tests/test_validation.py` - Main validation suite (100 tests)
- `tests/TEST_GUIDE.md` - Testing guide

## 🚀 Deployment

### Scripts
- `backend/deploy_au_bom_fix.sh` - Deploy AU→BOM fix (automated)
- `backend/deploy_fix.sh` - General deployment script
- `backend/security_fixes.sh` - Security patches
- `backend/setup.sh` - Initial server setup

### Guides
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Complete deployment instructions
- Manual deployment steps included
- Automated script usage
- Rollback procedures

## 🧪 Testing & Quality

### Test Coverage
- Weather router tests: 30 tests
- Spec alignment tests: 8 tests
- Total validation tests: 100+ tests
- E2E SMS tests available

### Quality Assurance
- Spec validation enforced
- Provider mapping verification
- Automated test suite in CI
- Code review with OpenClaw

## 📝 Recent Changes

### v3.0.1 Hotfix (2026-02-03)
**Critical Fix: AU→BOM Provider Mapping**

- **Problem:** Australian coordinates using Open-Meteo fallback (9km) instead of BOM (2.2km)
- **Solution:** Created BOMProvider, added AU→BOM routing
- **Impact:** Australian users get higher-resolution forecasts
- **Testing:** All tests pass, spec validation added
- **Documentation:**
  - [AU_BOM_FIX_SUMMARY.md](AU_BOM_FIX_SUMMARY.md) - Technical analysis
  - [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Deployment instructions

### v3.0.0 (2026-01-XX)
**International Weather Support**

- Multi-country provider routing
- 10 countries supported with native providers
- GPS coordinate forecasts worldwide
- Enhanced CAST commands
- SafeCheck emergency contacts

## 🌍 Provider Documentation

### Supported Providers
| Country | Provider | Resolution | Status |
|---------|----------|------------|--------|
| 🇦🇺 AU | BOM | 2.2km | ✅ Production |
| 🇺🇸 US | NWS | 2.5km | ✅ Production |
| 🇨🇦 CA | Environment Canada | 2.5km | ✅ Production |
| 🇬🇧 GB | Met Office | 1.5km | ✅ Production |
| 🇫🇷 FR | Meteo-France AROME | 1.5km | ✅ Production |
| 🇨🇭 CH | MeteoSwiss ICON | 2km | ✅ Production |
| 🇮🇹 IT | DWD ICON-EU | 7km | ✅ Production |
| 🇯🇵 JP | JMA MSM | 5km | ✅ Production |
| 🇳🇿 NZ | ECMWF | 9km | ✅ Production |
| 🇿🇦 ZA | ECMWF | 9km | ✅ Production |

### Provider Implementation
Each provider implements the `WeatherProvider` interface:
- `get_forecast(lat, lon, days)` - Returns normalized forecast
- `get_alerts(lat, lon)` - Returns weather alerts (if supported)
- `provider_name` - Human-readable name
- `supports_alerts` - Boolean flag

## 🔍 Finding Documentation

### By Topic
- **Weather Providers:** `backend/app/services/weather/providers/`
- **SMS Commands:** `backend/README.md` (SMS Commands section)
- **Danger Ratings:** `config/settings.py` (DangerThresholds class)
- **Route Configuration:** `config/routes/*.json`
- **Testing:** `backend/tests/` and `TEST_GUIDE.md`
- **Deployment:** `DEPLOYMENT_GUIDE.md`

### By File Type
- **Markdown (`.md`):** Human-readable documentation
- **Python (`.py`):** Implementation with inline docs
- **JSON (`.json`):** Route and configuration data
- **Shell (`.sh`):** Deployment and utility scripts

## 🤝 Contributing

### Code Review Process
- External reviews via OpenClaw
- Spec-driven development
- Test coverage required
- Documentation updates mandatory

### Development Workflow
1. Create feature branch
2. Implement changes with tests
3. Update documentation
4. Run full test suite
5. Create pull request
6. External review
7. Merge and deploy

## 📞 Support

### Resources
- GitHub Issues: https://github.com/andrewhall007au/thunderbird-web/issues
- Documentation: This index
- Server: 170.64.229.224 (production)

### Common Tasks
- **Run tests:** `pytest backend/tests/ -v`
- **Deploy:** See `DEPLOYMENT_GUIDE.md`
- **Add provider:** See `backend/app/services/weather/providers/`
- **Check logs:** `journalctl -u thunderbird-api -f`

---

**Last Updated:** 2026-02-03
**Version:** 3.0.1
**Maintainer:** Andrew Hall (@andrewhall007au)
