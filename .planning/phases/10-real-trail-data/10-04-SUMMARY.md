---
phase: 10-real-trail-data
plan: 04
status: complete
---

## Summary

Fetched real coordinate data for 50 Canadian and 50 Australian trails using the three-source pipeline.

### Results

- **Canada:** 25/50 succeeded (50%)
- **Australia:** 22/50 succeeded (44%)
- **Total:** 47/100 trails with real coordinate data

### Data Source Breakdown

- Canada: Mix of OSM, Waymarked Trails, and Parks Canada (1 trail)
- Australia: All 22 successes via Waymarked Trails — Overpass API returned 400 for all AU queries (likely rate limiting or query format issue)

### Failed Trails

- Canada (25 failures): Many provincial park trails not in OSM as route relations
- Australia (28 failures): Overpass 400 errors meant OSM couldn't be tried; Waymarked Trails only found ~44% of trails

### Artifacts

- `scripts/trail-curation/trail-lists/canada-trails.json` — 50 curated Canadian trails
- `scripts/trail-curation/trail-lists/australia-trails.json` — 50 curated Australian trails
- `scripts/trail-curation/results/canada-trails.json` — Results
- `scripts/trail-curation/results/australia-trails.json` — Results

### Deviations

- Australia Overpass queries all returned 400 errors. All AU successes came from Waymarked Trails API.
- Success rate below plan target. Failed trails handled in Plan 10-06 merge.
