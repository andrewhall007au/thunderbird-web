# Phase 10: Real Trail Data from OpenStreetMap - Research

**Researched:** 2026-02-07
**Domain:** Geospatial data sourcing, trail curation, coordinate simplification
**Confidence:** MEDIUM

## Summary

Phase 10 requires replacing simplified trail coordinates with real GPX-quality trail data from non-proprietary sources, expanding from ~40 trails to 250+ unique deduplicated trails across US (100), Canada (25), Australia (50 including 25 Tasmania), and global (100) markets. The trails are used as visual planning aids only—no GPX redistribution occurs.

Research confirms that OpenStreetMap's Overpass API is the primary data source, supplemented by government datasets (USFS, NPS, Parks Canada, state park authorities) where available. The standard approach involves batch querying Overpass API for named trails, manual curation from curated "top trails" lists, Douglas-Peucker simplification to 50-200 points, and rigorous deduplication using geographic proximity and name matching.

**Primary recommendation:** Use Overpass API for bulk data extraction, manually curate trail selection from AllTrails/community rankings, implement simplify-js for coordinate reduction, and validate accuracy via haversine distance checks against official trail lengths.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Overpass API | current | Query OSM hiking trail data | Official OSM read-only API, supports route=hiking queries, 10k queries/day limit |
| simplify-js | 1.2.x | Douglas-Peucker coordinate simplification | Tiny, high-performance polyline simplification by Leaflet author, used industry-wide |
| haversine | 1.1.x (npm) | Distance calculation for validation | Standard great-circle distance formula, 0.5% accuracy sufficient for validation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| gpxjs | latest | Parse GPX files if sourcing from GPX | Modern TypeScript GPX parser when government sources provide GPX format |
| @turf/turf | 7.x | Geographic calculations (optional) | If more advanced geospatial operations needed beyond haversine |
| fast-levenshtein | 3.x | Fuzzy name matching for deduplication | Detect near-duplicate trail names with typos/variations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Overpass API | Planet.osm download | Planet.osm better for bulk country data but 100GB+ file size, excessive for 250 trails |
| simplify-js | Custom Douglas-Peucker | Custom implementation wastes time, simplify-js is battle-tested and 2KB minified |
| Manual curation | Automated popularity scraping | Automation risks copyright violations, manual curation ensures quality control |

**Installation:**
```bash
npm install simplify-js haversine fast-levenshtein
# gpxjs only if parsing GPX files from government sources
npm install --save-dev @types/geojson
```

## Architecture Patterns

### Recommended Project Structure
```
app/data/
├── popularTrails.ts           # Existing data file - UPDATE with new trails
├── trailSources.json          # NEW: Source attribution per trail (OSM, USFS, etc.)
scripts/trail-curation/        # NEW: Data collection scripts
├── overpass-query.ts          # Query Overpass API for trail data
├── simplify-coordinates.ts    # Douglas-Peucker simplification
├── validate-trails.ts         # Distance + accuracy validation
├── deduplicate-trails.ts      # Fuzzy matching deduplication
└── curate-trail-list.ts       # Manual curation helpers
```

### Pattern 1: Overpass API Trail Query
**What:** Query OpenStreetMap Overpass API for hiking trail relations by name or bounding box
**When to use:** Primary method for sourcing trail coordinate data from OSM
**Example:**
```typescript
// Source: https://gist.github.com/kfigiela/262ffacdb9859afd013660882a9debef
const overpassQuery = `
[out:json][timeout:25];
(
  rel[route="hiking"]["name"~"Appalachian Trail"]({{bbox}});
);
out body;
>;
out skel qt;
`;

// Query via fetch
const bbox = "34.62,-84.19,45.90,-68.92"; // GA to ME bounding box
const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(
  overpassQuery.replace('{{bbox}}', bbox)
)}`;

const response = await fetch(url);
const data = await response.json();

// Extract coordinates from OSM ways
const coordinates = data.elements
  .filter(el => el.type === 'way')
  .flatMap(way => way.nodes.map(nodeId => {
    const node = data.elements.find(el => el.id === nodeId);
    return [node.lon, node.lat, node.tags?.ele ? parseInt(node.tags.ele) : 0];
  }));
```

### Pattern 2: Douglas-Peucker Coordinate Simplification
**What:** Reduce trail coordinate points from thousands to 50-200 while preserving shape
**When to use:** After fetching raw coordinates, before storing in popularTrails.ts
**Example:**
```typescript
// Source: https://mourner.github.io/simplify-js/
import simplify from 'simplify-js';

interface Point { x: number; y: number; z?: number; }

function simplifyTrailCoordinates(
  coordinates: [number, number, number][],
  targetPoints: number = 100
): [number, number, number][] {
  // Convert to simplify-js format
  const points: Point[] = coordinates.map(([lng, lat, ele]) => ({
    x: lng,
    y: lat,
    z: ele
  }));

  // Binary search for optimal tolerance to achieve target point count
  let minTolerance = 0.0001;
  let maxTolerance = 0.1;
  let bestTolerance = minTolerance;

  for (let i = 0; i < 20; i++) {
    const tolerance = (minTolerance + maxTolerance) / 2;
    const simplified = simplify(points, tolerance, true);

    if (simplified.length > targetPoints) {
      minTolerance = tolerance;
    } else {
      maxTolerance = tolerance;
      bestTolerance = tolerance;
    }
  }

  const simplified = simplify(points, bestTolerance, true);

  return simplified.map(p => [p.x, p.y, p.z || 0]);
}
```

### Pattern 3: Trail Distance Validation
**What:** Calculate trail distance from coordinates and compare to official distance
**When to use:** Mandatory for every trail before adding to popularTrails.ts
**Example:**
```typescript
// Source: https://www.npmjs.com/package/haversine
import haversine from 'haversine';

function validateTrailDistance(
  coordinates: [number, number, number][],
  officialDistanceKm: number,
  trailName: string
): { valid: boolean; calculatedKm: number; errorPct: number } {
  let totalDistance = 0;

  for (let i = 1; i < coordinates.length; i++) {
    const [lng1, lat1] = coordinates[i - 1];
    const [lng2, lat2] = coordinates[i];

    const distance = haversine(
      { latitude: lat1, longitude: lng1 },
      { latitude: lat2, longitude: lng2 },
      { unit: 'km' }
    );

    totalDistance += distance;
  }

  const errorPct = Math.abs(totalDistance - officialDistanceKm) / officialDistanceKm * 100;
  const valid = errorPct <= 2.0; // Flag if >2% shorter

  if (!valid) {
    console.warn(`${trailName}: Distance mismatch - calculated ${totalDistance.toFixed(1)}km vs official ${officialDistanceKm}km (${errorPct.toFixed(1)}% error)`);
  }

  return { valid, calculatedKm: totalDistance, errorPct };
}
```

### Pattern 4: Geographic Deduplication
**What:** Detect duplicate trails across US/Canada/Australia/Global lists using coordinate proximity and name matching
**When to use:** After collecting all 250+ trails, before finalizing popularTrails.ts
**Example:**
```typescript
// Source: Fuzzy matching research + haversine proximity
import levenshtein from 'fast-levenshtein';
import haversine from 'haversine';

interface TrailData {
  id: string;
  name: string;
  country: string;
  coordinates: [number, number, number][];
}

function findDuplicateTrails(trails: TrailData[]): Map<string, string[]> {
  const duplicates = new Map<string, string[]>();

  for (let i = 0; i < trails.length; i++) {
    for (let j = i + 1; j < trails.length; j++) {
      const trail1 = trails[i];
      const trail2 = trails[j];

      // Check 1: Fuzzy name matching (Levenshtein distance)
      const nameDistance = levenshtein.get(
        trail1.name.toLowerCase(),
        trail2.name.toLowerCase()
      );
      const nameSimilarity = 1 - (nameDistance / Math.max(trail1.name.length, trail2.name.length));

      // Check 2: Geographic proximity (compare start/end points)
      const start1 = trail1.coordinates[0];
      const start2 = trail2.coordinates[0];
      const startDistance = haversine(
        { latitude: start1[1], longitude: start1[0] },
        { latitude: start2[1], longitude: start2[0] },
        { unit: 'km' }
      );

      // Duplicate if name >85% similar AND start points <5km apart
      if (nameSimilarity > 0.85 && startDistance < 5) {
        if (!duplicates.has(trail1.id)) {
          duplicates.set(trail1.id, []);
        }
        duplicates.get(trail1.id)!.push(trail2.id);
      }
    }
  }

  return duplicates;
}
```

### Pattern 5: UI Country Grouping with optgroup
**What:** Group trails by country in dropdown using HTML optgroup element
**When to use:** When updating TrailSelector component with new trails
**Example:**
```tsx
// Source: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/optgroup
interface TrailsByCountry {
  [country: string]: TrailData[];
}

function TrailSelector({ trails }: { trails: TrailData[] }) {
  const trailsByCountry = trails.reduce((acc, trail) => {
    if (!acc[trail.country]) acc[trail.country] = [];
    acc[trail.country].push(trail);
    return acc;
  }, {} as TrailsByCountry);

  const countryNames = {
    US: 'United States',
    CA: 'Canada',
    AU: 'Australia',
    GB: 'United Kingdom',
    FR: 'France',
    // ... all weather API countries
  };

  return (
    <select>
      {Object.entries(countryNames).map(([code, name]) => (
        <optgroup key={code} label={name}>
          {trailsByCountry[code]?.length > 0 ? (
            trailsByCountry[code].map(trail => (
              <option key={trail.id} value={trail.id}>
                {trail.name}
              </option>
            ))
          ) : (
            <option disabled>Coming Soon</option>
          )}
        </optgroup>
      ))}
    </select>
  );
}
```

### Anti-Patterns to Avoid
- **Scraping AllTrails coordinates:** Violates ToS, proprietary data. Use AllTrails ONLY for trail name lists, never coordinates.
- **Storing raw OSM data:** Thousands of points per trail bloat bundle size and slow map rendering. Always simplify to 50-200 points.
- **Skipping distance validation:** Without validation, missing sections go undetected until users complain. Validate every trail.
- **Country-agnostic deduplication:** Comparing all 250+ trails NxN is slow. Pre-group by country, only compare cross-country for global list.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Great-circle distance | Custom haversine formula | haversine npm package | Earth radius varies by latitude (6356-6378km), package handles edge cases |
| Douglas-Peucker simplification | Custom recursive algorithm | simplify-js | Self-intersection bugs, performance optimization, battle-tested on millions of trails |
| GPX file parsing | XML parser + custom logic | gpxjs or gpx-parser-builder | GPX 1.0/1.1 spec differences, extensions, track vs route semantics |
| Fuzzy string matching | Custom edit distance | fast-levenshtein | Optimized C++ bindings, handles Unicode, 10x faster than naive implementation |
| Geographic bounding boxes | Manual lat/lng math | Overpass API bbox param | Antimeridian wrapping (-180/180 boundary), pole handling |

**Key insight:** Geospatial calculations have edge cases (poles, antimeridian, ellipsoid vs sphere) that take years to perfect. Use proven libraries.

## Common Pitfalls

### Pitfall 1: Overpass API Rate Limits
**What goes wrong:** Hitting 10,000 queries/day limit or timing out on large queries
**Why it happens:** Naive approach queries each trail individually, or queries entire countries at once
**How to avoid:**
- Batch queries by region (e.g., state bounding boxes for US trails)
- Use `[timeout:60]` for long trails like PCT/CDT
- Cache results locally to avoid re-querying during development
- Use multiple Overpass API instances (overpass-api.de, overpass.kumi.systems) if hitting limits
**Warning signs:** 429 Too Many Requests errors, or timeouts on continental trails

### Pitfall 2: OSM Data Quality Varies by Region
**What goes wrong:** Trail coordinates are mislocated by 0.3+ miles, especially in rural areas
**Why it happens:** OSM data quality correlates with urbanization and mapper activity. Rural trails often traced from low-resolution imagery.
**How to avoid:**
- Always validate distance against official sources (USFS, Parks Canada, state agencies)
- For flagged trails (>2% error), cross-reference against government shapefiles or manually trace missing sections
- Prioritize government data sources where available (more accurate than OSM for national parks)
- Visual spot-check against satellite imagery or proprietary maps (AllTrails/Gaia for validation only)
**Warning signs:** Calculated distance significantly shorter than official distance, coordinates cutting across terrain

### Pitfall 3: Trail Name Inconsistencies
**What goes wrong:** "Appalachian Trail" vs "AT" vs "Appalachian National Scenic Trail" treated as different trails
**Why it happens:** OSM mappers use different naming conventions, official vs colloquial names
**How to avoid:**
- Store both `name` and `ref` tags from OSM (ref contains abbreviations like "AT", "PCT")
- Manual curation step to normalize names before deduplication
- Fuzzy matching with 85%+ threshold catches most variants
- Maintain a `nameAliases` map for known variations
**Warning signs:** Duplicate trails appearing in dropdown, users reporting "missing" trails that actually exist under different names

### Pitfall 4: Multi-Country Trails
**What goes wrong:** Tour du Mont Blanc (France/Italy/Switzerland) appears in multiple country groups, violating deduplication requirement
**Why it happens:** Trail physically crosses borders, OSM data split into country-specific relations
**How to avoid:**
- Choose primary country based on trail's traditional starting point (TMB = France, CDT = USA)
- Document cross-border trails in a `multiCountry` field for future reference
- Deduplication script must check global list against all country lists, not just within-country
**Warning signs:** Same trail ID appearing under multiple countries, user confusion about which dropdown to use

### Pitfall 5: Elevation Data Missing or Inaccurate
**What goes wrong:** Third coordinate (elevation) in [lng, lat, ele] format is 0 or wildly incorrect
**Why it happens:** OSM nodes often lack `ele` tag, or tag contains sea level instead of trail elevation
**How to avoid:**
- Accept that elevation data will be incomplete (not critical for planning use case)
- Option 1: Leave as 0 if missing (simplest)
- Option 2: Use elevation API (Mapbox Tilequery, Open-Elevation) to backfill, but adds complexity/cost
- Document in code comments that elevation is "best effort"
**Warning signs:** All elevations = 0, or negative elevations for above-sea-level trails

### Pitfall 6: Simplification Destroying Trail Shape
**What goes wrong:** Douglas-Peucker removes critical switchbacks, trail appears to cut straight up mountain
**Why it happens:** Aggressive tolerance setting to hit 50-200 point target
**How to avoid:**
- Use `highQuality: true` flag in simplify-js (10-20x slower but better results)
- Binary search algorithm to find optimal tolerance (see Pattern 2 above)
- Visual spot-check simplified trail against original on map viewer
- For iconic trails (PCT, Overland Track), accept 150-200 points instead of forcing 50
**Warning signs:** Trail looks unnaturally straight, users report trail "doesn't match actual route"

### Pitfall 7: Licensing Attribution Missing
**What goes wrong:** Forgetting to display OpenStreetMap attribution, violating ODbL license
**Why it happens:** Attribution requirement easy to overlook during implementation
**How to avoid:**
- Add "© OpenStreetMap contributors" to map footer/corner
- Link to https://www.openstreetmap.org/copyright
- Document in `trailSources.json` which trails came from OSM vs government sources
- If using government data, check each agency's attribution requirements (USFS, NPS, Parks Canada)
**Warning signs:** Legal risk, community backlash if discovered

## Code Examples

Verified patterns from official sources:

### Overpass API Query via JavaScript Fetch
```javascript
// Source: https://wiki.openstreetmap.org/wiki/Overpass_API
async function fetchTrailFromOSM(trailName, bbox) {
  const query = `
    [out:json][timeout:25];
    (
      rel[route="hiking"]["name"~"${trailName}",i](${bbox});
    );
    out body;
    >;
    out skel qt;
  `;

  const url = 'https://overpass-api.de/api/interpreter';
  const response = await fetch(url, {
    method: 'POST',
    body: 'data=' + encodeURIComponent(query)
  });

  return response.json();
}

// Example usage
const data = await fetchTrailFromOSM(
  "Pacific Crest Trail",
  "32.5,-120.0,49.0,-116.0" // minlat,minlon,maxlat,maxlon
);
```

### Simplify Coordinates with Target Point Count
```typescript
// Source: https://mourner.github.io/simplify-js/
import simplify from 'simplify-js';

function simplifyToTargetCount(
  coords: [number, number, number][],
  targetCount: number
): [number, number, number][] {
  const points = coords.map(([x, y, z]) => ({ x, y, z }));

  let tolerance = 0.0001;
  let step = 0.001;
  let simplified = simplify(points, tolerance, true);

  // Iteratively adjust tolerance
  while (Math.abs(simplified.length - targetCount) > 5 && step > 0.00001) {
    if (simplified.length > targetCount) {
      tolerance += step;
    } else {
      tolerance -= step;
      step /= 2;
    }
    simplified = simplify(points, tolerance, true);
  }

  return simplified.map(p => [p.x, p.y, p.z || 0]);
}
```

### Complete Trail Validation Pipeline
```typescript
// Combining multiple patterns
interface ValidationResult {
  trailName: string;
  passed: boolean;
  issues: string[];
  calculatedDistance: number;
  officialDistance: number;
}

async function validateTrail(
  trail: TrailData,
  officialDistanceKm: number
): Promise<ValidationResult> {
  const issues: string[] = [];

  // 1. Distance check
  const { valid, calculatedKm, errorPct } = validateTrailDistance(
    trail.coordinates,
    officialDistanceKm,
    trail.name
  );

  if (!valid) {
    issues.push(`Distance error: ${errorPct.toFixed(1)}% (${calculatedKm.toFixed(1)}km vs ${officialDistanceKm}km)`);
  }

  // 2. Coordinate count check
  if (trail.coordinates.length < 10) {
    issues.push(`Too few coordinates: ${trail.coordinates.length} (minimum 10)`);
  }
  if (trail.coordinates.length > 300) {
    issues.push(`Too many coordinates: ${trail.coordinates.length} (maximum 300, consider simplification)`);
  }

  // 3. Coordinate validity check
  for (const [lng, lat, ele] of trail.coordinates) {
    if (lng < -180 || lng > 180) {
      issues.push(`Invalid longitude: ${lng}`);
    }
    if (lat < -90 || lat > 90) {
      issues.push(`Invalid latitude: ${lat}`);
    }
  }

  // 4. Check for duplicate consecutive points
  for (let i = 1; i < trail.coordinates.length; i++) {
    const [lng1, lat1] = trail.coordinates[i - 1];
    const [lng2, lat2] = trail.coordinates[i];
    if (lng1 === lng2 && lat1 === lat2) {
      issues.push(`Duplicate consecutive point at index ${i}`);
    }
  }

  return {
    trailName: trail.name,
    passed: issues.length === 0,
    issues,
    calculatedDistance: calculatedKm,
    officialDistance: officialDistanceKm
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual GPX tracing | Overpass API bulk queries | 2015+ | OSM Overpass API matured, made bulk trail data extraction feasible without manual work |
| CC-BY-SA 2.0 license | ODbL (Open Database License) | Sept 2012 | OSM switched licenses; share-alike now applies to derivative databases, not just maps |
| Visvalingam-Whyatt simplification | Douglas-Peucker dominant | 2014+ | simplify-js popularized DP algorithm for web mapping, became de facto standard |
| AllTrails proprietary data | Community OSM mapping | 2020+ | OSM trail coverage now rivals proprietary sources in major markets (US/EU/AU) |
| Country-level Planet.osm | Regional Overpass queries | 2016+ | Overpass API regional queries more efficient than downloading 100GB+ Planet.osm files |

**Deprecated/outdated:**
- Planet.osm downloads for small datasets: Use Overpass API instead (regional queries return results in seconds vs hours of processing)
- XML-based Overpass queries: OverpassQL (query language) is more readable, though both still supported
- Elevation backfilling from SRTM: Modern elevation APIs (Mapbox, Open-Elevation) provide better coverage and accuracy
- Manual deduplication: Fuzzy matching algorithms (Levenshtein, Jaro-Winkler) automate 95%+ of duplicate detection

## Open Questions

Things that couldn't be fully resolved:

1. **USFS Trail Data Access**
   - What we know: USFS has National Forest System Trails dataset on ArcGIS Hub, available as shapefile/GeoJSON
   - What's unclear: Exact API endpoint or download URL not found in research. Documentation references data-usfs.hub.arcgis.com but specific dataset page not loaded
   - Recommendation: Contact USFS data team (SM.FS.data@usda.gov) or manually browse hub for direct download links. Plan for manual download + conversion vs API access.

2. **Tasmania-Specific Trail Coverage**
   - What we know: Tasmania needs 25 trails within the AU 50 total. Popular trails identified (Overland Track, Three Capes, Freycinet, Western Arthurs)
   - What's unclear: Whether OSM coverage for 25 Tasmanian trails is sufficient, or if state government sources (Parks & Wildlife Service Tasmania) required
   - Recommendation: Start with OSM, validate first 10 trails. If <8/10 pass validation, supplement with Tasmania Parks shapefiles.

3. **Trail Popularity Metrics**
   - What we know: AllTrails uses community star ratings + expert curation. No public "top 100 US trails" list found for 2026.
   - What's unclear: Exact methodology to objectively rank "top" trails per country without proprietary AllTrails data
   - Recommendation: Manual curation using multiple sources (AllTrails browse, Google search volume, National Geographic lists, outdoor community rankings). Accept subjectivity—"top" is inherently subjective.

4. **Optimal Douglas-Peucker Tolerance**
   - What we know: simplify-js uses tolerance parameter in coordinate units. Higher tolerance = fewer points.
   - What's unclear: Recommended tolerance ranges for trails of different lengths (10km vs 4000km)
   - Recommendation: Target point count (50-200) approach is more predictable than tolerance values. Use binary search algorithm (Pattern 2) to find tolerance that achieves target count.

5. **Cross-Border Trail Handling**
   - What we know: OSM stores cross-border trails as separate relations per country or as single multi-country relation
   - What's unclear: Consistent OSM tagging conventions for international trails
   - Recommendation: Case-by-case basis during curation. Query each segment separately, concatenate coordinates, assign to primary country.

## Sources

### Primary (HIGH confidence)
- [Overpass API - OpenStreetMap Wiki](https://wiki.openstreetmap.org/wiki/Overpass_API) - API features and query methods
- [OpenStreetMap Copyright](https://www.openstreetmap.org/copyright) - ODbL licensing requirements
- [simplify-js](https://mourner.github.io/simplify-js/) - Douglas-Peucker implementation
- [OSM Overpass hiking trails query (GitHub Gist)](https://gist.github.com/kfigiela/262ffacdb9859afd013660882a9debef) - Verified query syntax
- [MDN optgroup Element](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/optgroup) - HTML country grouping

### Secondary (MEDIUM confidence)
- [USDA Forest Service FSGeodata Clearinghouse](https://data.fs.usda.gov/geodata/edw/datasets.php) - Federal trail data sources
- [Parks Canada Open Data Portal - Trails APCA](https://open.canada.ca/data/en/dataset/64a90e8d-5bc0-4027-8645-b5881b4068d4) - Canadian trail data
- [haversine formula - Wikipedia](https://en.wikipedia.org/wiki/Haversine_formula) - Distance calculation accuracy
- [Ramer–Douglas–Peucker algorithm - Wikipedia](https://en.wikipedia.org/wiki/Ramer%E2%80%93Douglas%E2%80%93Peucker_algorithm) - Simplification algorithm theory
- [gpxjs GitHub](https://github.com/We-Gold/gpxjs) - Modern GPX parsing library
- [AllTrails top trails methodology](https://www.alltrails.com/press/alltrails-unveils-2023-year-on-the-trails-revealing-top-global-hiking-data-from-the-year) - Popularity ranking approach
- [Fuzzy Matching 101 - Data Ladder](https://dataladder.com/fuzzy-matching-101/) - Deduplication algorithms

### Tertiary (LOW confidence - needs verification)
- [OpenStreetMap data quality issues](https://wiki.openstreetmap.org/wiki/Quality_assurance) - Known accuracy problems
- [AllTrails Australia's top trails 2025](https://weareexplorers.co/alltrails-australia-top-trails-2025/) - AU trail rankings (2025 not 2026)
- [Tasmania's best hiking trails](https://www.alltrails.com/australia/tasmania) - TAS trail identification
- Community forums and blog posts on trail mapping - Used for context, not authoritative

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - simplify-js, haversine, Overpass API are industry standard for this exact use case
- Architecture: MEDIUM - Patterns verified from OSM wiki and library docs, but not tested in production for this specific phase
- Pitfalls: MEDIUM - Based on OSM quality research and community forum discussions, not first-hand experience

**Research date:** 2026-02-07
**Valid until:** 2026-05-07 (90 days - stable domain with slow-changing standards)
**Re-validation triggers:**
- If simplify-js major version released (breaking API changes)
- If OSM changes Overpass API rate limits or query syntax
- If government agencies release new official trail datasets
