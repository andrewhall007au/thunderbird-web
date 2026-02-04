# Changelog

All notable changes to Thunderbird Weather will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security
- **CORS Whitelisting** (2026-02-03)
  - Restricted CORS to thunderbird.bot domains only (previously wildcard `*`)
  - Prevents unauthorized domain access to API endpoints
  - Whitelist: `thunderbird.bot`, `www.thunderbird.bot`, `localhost:3000`

- **XSS Protection** (2026-02-03)
  - Added HTML escaping for user inputs in beta applications
  - Prevents script injection in admin console
  - Sanitization applied to name field before database storage

- **Rate Limiting** (2026-02-03)
  - Implemented tiered rate limiting middleware
  - Auth endpoints: 1 request/minute (prevents brute force)
  - Beta applications: 5 requests/hour (prevents spam)
  - API endpoints: 10 requests/second (prevents DDoS)

- **Nginx Security Headers** (2026-02-03)
  - HSTS: Force HTTPS connections
  - X-Frame-Options: Prevent clickjacking
  - X-Content-Type-Options: Prevent MIME sniffing
  - Content-Security-Policy: Restrict resource loading
  - Server version hidden
  - Refs: backend/deploy/nginx_complete.conf

### Fixed
- **Critical**: Added missing AU→BOM provider mapping (2026-02-03)
  - Australian coordinates now use native BOM provider (2.2km resolution)
  - Previously fell back to Open-Meteo (9km resolution)
  - Created `BOMProvider` wrapper for existing `BOMService`
  - Added comprehensive spec validation tests to prevent future drift
  - Issue identified by: OpenClaw Code Review
  - Impact: All Australian users now receive higher-resolution forecasts
  - Refs: AU_BOM_FIX_SUMMARY.md, DEPLOYMENT_GUIDE.md

### Added
- Spec validation test suite (`TestWeatherProviderSpecAlignment`)
  - Validates router provider mappings match documentation
  - Prevents specification-to-implementation drift
  - Tests all 10 documented country mappings
- Security hardening infrastructure (Phase 8)
  - Rate limiting middleware
  - Deployment scripts for security configuration
  - Nginx security configuration templates

## [3.0.0] - 2026-01-XX

### Added
- International weather support (Phase 6)
  - Multi-country provider routing
  - NWS (USA), Environment Canada, Met Office (UK)
  - Open-Meteo with regional models (FR, IT, CH, JP)
  - GPS coordinate forecasts for any location
- SafeCheck emergency contact system
- CAST commands for on-demand forecasts
- Dynamic weather grouping for SMS efficiency

### Changed
- Upgraded forecast formats with labeled spacing
- Enhanced danger rating system with CAPE/thunderstorm detection
- Improved cloud base calculations using LCL formula

## [2.0.0] - 2025-XX-XX

### Added
- Multi-trail support (6 routes)
- Admin dashboard
- Beta access system
- Stripe payment integration

## [1.0.0] - 2025-XX-XX

### Added
- Initial release
- Western Arthurs and Overland Track routes
- BOM weather integration
- SMS delivery via Twilio
- Basic danger ratings

---

## Version History

- **v3.0.0**: International expansion
- **v2.0.0**: Multi-trail and payments
- **v1.0.0**: Initial Tasmania-only release
