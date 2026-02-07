---
phase: 10-real-trail-data
plan: 04b
status: complete
---

## Summary

Fetched real coordinate data for 50 curated New Zealand trails using the three-source pipeline.

### Results

- **NZ batch 1:** 20/25 succeeded (80%)
- **NZ batch 2:** 20/25 succeeded (80%)
- **Total:** 40/50 NZ trails with real coordinate data

### Data Source Breakdown

- OSM (Overpass): ~15 trails
- Waymarked Trails: ~16 trails
- DOC Tracks: 9 trails

### Great Walks Coverage

All 9 DOC Great Walks were included in the curated list. Most succeeded via OSM or Waymarked Trails. DOC fallback recovered several that failed primary sources.

### Failed Trails (10)

Shorter day hikes and lesser-known tracks that aren't mapped as route relations. Examples: Key Summit Track (3km), Gertrude Saddle Route, Mt Taranaki Summit Track.

### Artifacts

- `scripts/trail-curation/trail-lists/nz-trails-batch1.json` — Batch 1 (25 trails)
- `scripts/trail-curation/trail-lists/nz-trails-batch2.json` — Batch 2 (25 trails)
- `scripts/trail-curation/results/nz-trails-batch1.json` — Results for batch 1
- `scripts/trail-curation/results/nz-trails-batch2.json` — Results for batch 2

### Deviations

- NZ had the best success rate (80%) of all regions, likely due to DOC's comprehensive mapping and good OSM coverage.
