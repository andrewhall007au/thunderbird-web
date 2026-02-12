# Trail Curation Handoff — Resume Prompt

Copy everything below into a new session:

---

## Context

I'm working on trail data quality for Thunderbird Web (`~/thunderbird-web/`). We've been auditing and fixing trail coordinate data across 264 trails globally. The trail data lives in `public/trail-data/{id}.json` as `[lng, lat, elevation][]` arrays.

## What's been done

### Australia (COMPLETE)
- **88 AU trails** audited, cleaned, and reviewed via `http://localhost:3000/review-au-trails.html`
- **Cleanup logic applied to ALL AU trails:** gap-splitting (split polylines at >1km gaps) and bbox cleanup (select best segments when calc distance >> official)
- **5 GPX imports:** Freycinet Peninsula Circuit, Frenchmans Cap, Walls of Jerusalem, Fraser Island Great Walk, Heysen Trail
- **5 trails removed** (unusable data): Point Lesueur Walk, Mount Maria Walk, Haunted Bay Walk, Wilpena Pound, Cradle Mountain Summit
- **2 trails removed** (wrong data): Hakea Trail, Tree in the Rock
- **Name corrections:** Mt Magog → Mt Hassell, Eastern Arthurs ↔ Federation Peak coordinate swap
- **3 trails added:** Mt Trio, Sunshine Coast Hinterland Great Walk, Kangaroo Island Wilderness Trail

### Global trails (CLEANED — 2025-02-12)
- **Gap-split cleanup** run on all 68 fixable non-AU trails via `scripts/trail-curation/clean-global-gaps.ts`
- **7 trails removed** (unusable, <30% coverage): Ben Macdui, Glyndwr's Way, Skye Trail, Half Dome, Mt Washington, Sentinel Dome, Crib Goch
- **5 GPX/Waymarked imports:**
  - St Cuthbert's Way: 31%→104% (Waymarked Trails relation 4515009)
  - Coast to Coast Walk: 62%→93% (FKT GPX from Damian Hall's attempt, no elevation)
  - Kumano Kodo Nakahechi: 64%→135% (Waymarked Trails relation 17094646)
  - Mount Whitney Trail: 64%→48% one-way (Waymarked Trails relation 3289187, 17km one-way, official 35.4km is round-trip)
  - Makalu Base Camp Trek: 65%→80% (Waymarked Trails relation 9387979)
- **2 bbox-polluted trails trimmed** (summit extraction):
  - Mount Adams South Climb: 319%→92% (start-to-summit, 14.8km)
  - Mount San Jacinto: 347%→67% (start-to-summit, 14.0km)
- All 23 tests passing, 264 trailheads
- Backups in `scripts/trail-curation/backups-global/`
- Full triage doc: `scripts/trail-curation/GLOBAL-TRIAGE.md`

## What needs doing NOW

### 1. Remaining bbox-polluted trails (3)
These have too much data (>250%) and no gaps to split. Need manual curation or Gaia GPS:
- **Highline Trail Glacier NP** (257%, gpx_user, 10508pts) — not on Waymarked Trails
- **Buckskin Gulch** (279%, gpx_user, 32632pts) — not on Waymarked Trails
- **Yosemite Valley Loop** (283%, osm_overpass, 1263pts) — OSM relation includes all valley paths, Waymarked data is same

### 2. Cactus to Clouds Trail (65% coverage)
Only community GPX sources available (Modern Hiker, Stav is Lost, Wikiloc). Unmaintained trail, not in OSM. Needs manual download.

### 3. Data provenance cleanup
Some JSON files contain metadata revealing sources:
- `dataSource` field on all trails (e.g. `"fkt_gpx"`, `"gpx_user"`, `"osm_overpass"`, `"waymarked_trails_NNNNN"`)
- `fktSource` and `fktLicense` on some FKT trails
- `source` field on ~20 Wikiloc trails
- Decision needed: strip `dataSource`/`fktSource`/`source` fields before deployment?

### 4. Optional: GPX-improve more trails
60 trails have gaps (65-150% coverage) that are usable but could be improved. Not blocking.
See `GLOBAL-TRIAGE.md` for the full list sorted by coverage.

## Key files

- `app/data/popularTrails.ts` — trail definitions, `lazyTrailIds` Set (line 23), trail entries array
- `app/lib/trailMatch.ts` — trailhead coordinates `[id, lat, lng]` array (alphabetically sorted)
- `app/lib/trailMatch.test.ts` — tests, count assertion currently 264
- `public/trail-data/{id}.json` — coordinate data files
- `public/review-au-trails.html` — visual review page (AU only, could be adapted for other regions)
- `scripts/trail-curation/clean-au-gaps.ts` — AU cleanup logic reference
- `scripts/trail-curation/clean-global-gaps.ts` — global cleanup script
- `scripts/trail-curation/import-gpx.ts` — GPX import script
- `scripts/trail-curation/GLOBAL-TRIAGE.md` — full triage of all 78 original problem trails
- `scripts/trail-curation/backups-global/` — pre-cleanup backups

## Remaining problem trails (66)

Run this to get the current state:
```bash
node -e "
const fs = require('fs'); const path = require('path');
const dir = 'public/trail-data';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'manifest.json');
for (const f of files) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
    const coords = d.coordinates || [];
    if (coords.length === 0) continue;
    let maxGap = 0, gapCount = 0, totalDist = 0;
    for (let i = 1; i < coords.length; i++) {
      const dlat = (coords[i][1]-coords[i-1][1])*111;
      const dlng = (coords[i][0]-coords[i-1][0])*111*Math.cos(coords[i-1][1]*Math.PI/180);
      const dist = Math.sqrt(dlat*dlat + dlng*dlng);
      totalDist += dist; if (dist > maxGap) maxGap = dist; if (dist > 1) gapCount++;
    }
    const coverage = d.distance_km > 0 ? totalDist / d.distance_km : 1;
    if (maxGap > 5 || gapCount > 3 || (coverage < 0.3 && d.distance_km > 5) || (coverage > 2.5 && d.distance_km > 5))
      console.log(d.country + ' | ' + d.name + ' | ' + coords.length + 'pts | gap:' + maxGap.toFixed(1) + 'km | ' + gapCount + ' gaps | cov:' + (coverage*100).toFixed(0) + '%');
  } catch(e) {}
}
"
```
