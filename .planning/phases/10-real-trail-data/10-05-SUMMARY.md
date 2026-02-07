---
phase: 10-real-trail-data
plan: 05
status: complete
---

## Summary

Fetched real coordinate data for 100 global trails across 7 countries (JP, GB, FR, CH, IT, ZA, DE).

### Results

- **Global batch 1:** 19/50 succeeded (38%)
- **Global batch 2:** 20/50 succeeded (40%)
- **Total:** 39/100 global trails with real coordinate data

### Per-Country Breakdown

| Country | Succeeded | Total | Rate |
|---------|-----------|-------|------|
| Japan | ~5 | ~14 | ~36% |
| UK | ~8 | ~14 | ~57% |
| France | ~4 | ~14 | ~29% |
| Switzerland | ~6 | ~14 | ~43% |
| Italy | ~8 | ~15 | ~53% |
| South Africa | ~4 | ~15 | ~27% |
| Germany | ~8 | ~14 | ~57% |

### Data Source Breakdown

- OSM (Overpass): ~20 trails
- Waymarked Trails: ~19 trails
- Government fallbacks: 0 (CAI Sentieri returns HTML not JSON, SANParks returns 403, Wanderbares Deutschland returns 404, SwissTopo returns 400)

### Key Issues

- Government fallback sources for non-English countries mostly non-functional (broken URLs, auth required, HTML responses)
- Japan trails have mixed English/Japanese names causing search mismatches
- South Africa coverage very poor — SANParks API returning 403

### Artifacts

- `scripts/trail-curation/trail-lists/global-trails-batch1.json` — Batch 1 (50 trails)
- `scripts/trail-curation/trail-lists/global-trails-batch2.json` — Batch 2 (50 trails)
- `scripts/trail-curation/results/global-trails-batch1.json` — Results
- `scripts/trail-curation/results/global-trails-batch2.json` — Results

### Deviations

- Global success rate (39%) was lowest across all regions. International government data sources proved unreliable. Failed trails will use old popularTrails.ts data in Plan 10-06 merge.
