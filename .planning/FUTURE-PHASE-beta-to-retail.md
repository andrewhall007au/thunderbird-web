# Future Phase: Beta to Retail Transition

**Created:** 2026-02-06
**Status:** Planned (post-beta)
**Priority:** High (blocks retail launch)

## Goal

Evaluate and implement production-ready infrastructure for retail launch, replacing beta services with scalable commercial alternatives.

## Scope

### Map & Geocoding Services
- **Current:** Free OSM-based services
  - OpenFreeMap (street tiles) - free, no limits
  - OpenTopoMap (topo tiles) - free, rate-limited
  - Nominatim (geocoding) - free, 1 req/sec limit
- **Evaluate:**
  - Commercial providers: MapTiler, Mapbox, Google Maps
  - Self-hosted options: tile server setup, ongoing costs
  - Hybrid approach: CDN caching + fallbacks
- **Decision factors:** Cost per user, reliability, rate limits, terms of service

### Rate Limiting & Caching
- Implement API rate limiting middleware
- CDN strategy for map tiles
- Redis caching for geocoding results
- Request batching and deduplication

### Database Scalability
- Postgres optimization and indexing review
- Read replica setup for scaling
- Connection pooling tuning
- Backup and recovery strategy

### Backend Infrastructure
- Load balancer configuration
- Horizontal scaling plan (multiple instances)
- Auto-scaling triggers and limits
- Session management at scale

### Cost Analysis
- Per-user cost breakdown
- Pricing model validation
- Traffic projections (10x beta usage)
- Monthly infrastructure budget

### Migration Planning
- Service-by-service migration path
- Rollback procedures
- Feature flags for gradual rollout
- Zero-downtime deployment strategy

### Performance & Reliability
- Load testing infrastructure
- Performance benchmarking (p50, p95, p99)
- SLA requirements (target: 99.9% uptime)
- Monitoring and alerting setup
- On-call rotation and incident response

### Monitoring Configuration Review
**Status:** Configured for beta (2026-02-07)

**Current Beta Settings:**
- Check intervals optimized for low-traffic beta phase
- Weather API: Hourly checks (60 min intervals)
- Database performance: Every 15 minutes
- External APIs: Every 30 minutes
- Beta signup endpoint: Every 30 minutes
- Stripe/Twilio checks: Skipped when not configured

**Retail Requirements:**
- [ ] Review and increase monitoring frequency for production load
  - Weather API: Consider 15-30 min intervals
  - Database: Consider 5-10 min intervals for faster issue detection
  - External APIs: Consider 10-15 min intervals
- [ ] Enable Stripe monitoring (add production API key)
- [ ] Enable Twilio monitoring with production credentials
- [ ] Add synthetic login tests (requires test account credentials)
- [ ] Implement tiered alerting (critical vs warning thresholds)
- [ ] Add PagerDuty or similar for 24/7 on-call rotation
- [ ] Configure alert escalation paths
- [ ] Set up monitoring for multiple regions/data centers
- [ ] Add latency monitoring from user perspective (RUM)
- [ ] Implement detailed error tracking (Sentry or similar)

**Configuration Files to Review:**
- `backend/monitoring/config.py` - Check intervals and thresholds
- `backend/monitoring/checks.py` - Weather API providers tested
- `.env` production - Stripe/Twilio keys for external API monitoring

**See:** `backend/MONITORING_FIXES.md` for details on 2026-02-07 beta configuration

## Dependencies

- Complete beta testing phase
- Gather usage metrics from beta users
- Validate product-market fit
- Confirm pricing model works

## Success Criteria

- [ ] Production infrastructure can handle 10x beta traffic
- [ ] Map tile costs are predictable and within budget (< $X per user/month)
- [ ] All services have 99.9% uptime SLA
- [ ] Migration path documented with rollback plan
- [ ] Cost per user is within target margins
- [ ] Load testing shows system can handle target scale
- [ ] Monitoring covers all critical paths
- [ ] Zero-downtime deployment proven

## Current Beta Services (Safe for Now)

All current services are fine for beta and small-scale use:
- OpenFreeMap: Completely free, widely used
- OpenTopoMap: Free for reasonable use
- Nominatim: Free with respectful rate limits (we're compliant)

These are the standard OSM-based services used by thousands of apps. No immediate action needed.

## Timeline

Plan this phase after:
1. Beta launch complete
2. Initial user feedback collected
3. Usage patterns established
4. Scaling needs quantified

Estimated: Q2 2026 (after 2-3 months of beta operation)

## Resources

- [MapTiler Pricing](https://www.maptiler.com/cloud/pricing/)
- [Mapbox Pricing](https://www.mapbox.com/pricing)
- [Google Maps Pricing](https://mapsplatform.google.com/pricing/)
- [Self-hosting OSM tiles](https://switch2osm.org/)
- [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/)

## Notes

- Don't optimize prematurely - wait for real usage data
- Consider hybrid approach: free tier for low-usage users, paid services for heavy users
- Map tiles are cacheable - CDN can drastically reduce costs
- Geocoding is infrequent - can be heavily cached
