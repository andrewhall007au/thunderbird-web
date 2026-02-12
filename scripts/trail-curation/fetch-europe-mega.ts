// Fetch European mega trails using known OSM relation IDs
// Handles single relations, multi-stage relations, and dynamic searches
// Usage: npx tsx scripts/trail-curation/fetch-europe-mega.ts [--trail NAME] [--skip-elevation] [--resume]
//
// Examples:
//   npx tsx scripts/trail-curation/fetch-europe-mega.ts --trail "Tour du Mont Blanc"
//   npx tsx scripts/trail-curation/fetch-europe-mega.ts --resume
//   npx tsx scripts/trail-curation/fetch-europe-mega.ts --skip-elevation

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const OVERPASS_API = 'https://overpass.kumi.systems/api/interpreter';
const OVERPASS_API_FALLBACK = 'https://overpass-api.de/api/interpreter';
const TOPO_API_SRTM = 'https://api.opentopodata.org/v1/srtm30m';
const TOPO_API_ASTER = 'https://api.opentopodata.org/v1/aster30m';
const TRAIL_DATA_DIR = join(process.cwd(), 'public', 'trail-data');
const PROGRESS_DIR = join(process.cwd(), 'scripts', 'trail-curation', 'results');

interface MegaTrail {
  name: string;
  id: string;
  officialDistanceKm: number;
  region: string;
  country: string;
  typicalDays: string;
  osmRelationId?: number;
  osmRelationIds?: number[];
  searchPattern?: { namePattern: string; bbox: string; refPattern?: string; excludePattern?: string };
}

const MEGA_TRAILS: MegaTrail[] = [
  // === Single-relation re-fetches (HIGH trails needing correct IDs) ===
  { name: 'Tour du Mont Blanc', id: 'tour_du_mont_blanc', osmRelationId: 9678362,
    officialDistanceKm: 170, region: 'France / Italy / Switzerland', country: 'FR', typicalDays: '10-12' },
  { name: 'GR20 Corsica', id: 'gr20_corsica', osmRelationId: 12484370,
    officialDistanceKm: 180, region: 'Corsica', country: 'FR', typicalDays: '15' },
  { name: 'Alta Via 2 Dolomites', id: 'alta_via_2_dolomites', osmRelationId: 404914,
    officialDistanceKm: 160, region: 'Dolomites', country: 'IT', typicalDays: '10-14' },
  { name: 'Vikos Gorge', id: 'vikos_gorge', osmRelationId: 15790847,
    officialDistanceKm: 12, region: 'Epirus', country: 'GR', typicalDays: '1' },

  // === Multi-relation fetches (known stage/section IDs to combine) ===
  { name: 'Kungsleden', id: 'kungsleden', osmRelationIds: [
      6289365, 8928539, 10861495, 10861494, 17080095, 17085819, 17085818, 17085817,
      17085816, 17080115, 17085864, 17085863, 18864010, 18864487, 18864488, 18864489,
      18864490, 18864491, 18864492, 18864493, 18864494, 18864495, 18864496, 18864497,
      18864498, 18709391, 18709392, 18709393, 18709394, 18707918, 18707919,
    ], officialDistanceKm: 440, region: 'Swedish Lapland', country: 'SE', typicalDays: '20-25' },

  { name: 'E5 Alps Crossing', id: 'e5_alps_crossing', osmRelationIds: [300392, 14073053, 934999],
    officialDistanceKm: 200, region: 'Germany / Austria / Italy', country: 'DE', typicalDays: '14-18' },

  { name: 'GR10 French Pyrenees', id: 'gr10_french_pyrenees', osmRelationIds: [
      7411271, 7411270, 7411269, 7411268, 7411267, 7411266, 7411265, 7411264, 548457,
    ], officialDistanceKm: 870, region: 'French Pyrenees', country: 'FR', typicalDays: '50-55' },

  { name: 'GR11 Pyrenean Traverse', id: 'gr11_pyrenean_traverse', osmRelationIds: [
      10603082, 10603081, 10603080, 10603079, 10603078, 10603077, 10603076, 10603075,
      10603074, 10603073, 10603164, 10603163, 10603162, 10603161, 10603859, 10603858,
      10603857, 10603856, 10603855, 10603860, 10605320, 10605319, 10605318, 10605317,
      10605316, 10605315, 10605314, 10605313, 10605312, 10605311, 10605310, 10605309,
      10605308, 10605307, 10605306,
    ], officialDistanceKm: 820, region: 'Spanish Pyrenees', country: 'ES', typicalDays: '45-50' },

  // === Mega trails (new, previously skipped) ===
  { name: 'Lycian Way', id: 'lycian_way', osmRelationId: 51855,
    officialDistanceKm: 540, region: 'Mediterranean Coast', country: 'TR', typicalDays: '25-30' },

  // === Dynamic search trails ===
  { name: 'Adlerweg', id: 'adlerweg_eagle_walk',
    searchPattern: { namePattern: 'Adlerweg Etappe', bbox: '46.8,10.0,47.8,13.0', excludePattern: 'Variante' },
    officialDistanceKm: 413, region: 'Tyrol', country: 'AT', typicalDays: '24-28' },

  { name: 'Camino de Santiago Frances', id: 'camino_de_santiago_frances',
    searchPattern: { namePattern: 'Camino Franc.s', bbox: '42.0,-9.0,43.5,-1.0', excludePattern: 'Alternative' },
    officialDistanceKm: 780, region: 'Northern Spain', country: 'ES', typicalDays: '30-35' },

  // === UK mega trails (bonus — wrong relations in batch) ===
  { name: 'South West Coast Path', id: 'south_west_coast_path', osmRelationIds: [
      2191940, 2205249, 2371752, 2371849, 2372163, 2372201, 2372431, 2372555, 2372584,
      2373766, 2374165, 2374227, 2374237, 2374244, 2374261, 2374270, 2374449, 2374546,
      2374556, 2374590, 2374605, 2374612, 2374624, 2374632, 2374655, 2375676, 2375687,
      2375711, 2375724, 2375770, 2375786, 2375852, 2375882, 2375924, 2375987, 2376012,
      2376018, 2376042, 2376063, 2376077, 2376085, 2376117, 2376118, 2376119, 2376336,
      2376368, 2376377, 2376383, 2376414, 2376424, 2376430, 2376455,
    ], officialDistanceKm: 1014, region: 'South West England', country: 'GB', typicalDays: '50-60' },

  { name: 'West Highland Way', id: 'west_highland_way', osmRelationIds: [
      19772647, 19772648, 19772650, 19772651, 19772652, 19772653, 19772654, 19772655, 19772656,
    ], officialDistanceKm: 154, region: 'Scottish Highlands', country: 'GB', typicalDays: '7-8' },
];

// --- Utilities ---

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function totalDistance(coords: [number, number][] | [number, number, number][]): number {
  let d = 0;
  for (let i = 1; i < coords.length; i++) {
    d += haversine(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
  }
  return d;
}

function safeMin(arr: number[]): number {
  let m = Infinity;
  for (const v of arr) if (v < m) m = v;
  return m;
}

function safeMax(arr: number[]): number {
  let m = -Infinity;
  for (const v of arr) if (v > m) m = v;
  return m;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// --- Overpass API ---

let useMainApi = false;

async function overpassQuery(query: string, retries = 3): Promise<any> {
  const apis = useMainApi
    ? [OVERPASS_API_FALLBACK, OVERPASS_API]
    : [OVERPASS_API, OVERPASS_API_FALLBACK];

  for (let attempt = 0; attempt < retries; attempt++) {
    for (const api of apis) {
      const label = api.includes('kumi') ? 'kumi' : 'main';
      try {
        const res = await fetch(api, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(query)}`,
        });
        if (res.status === 429 || res.status >= 500) {
          console.log(`    Overpass ${label}: HTTP ${res.status}, trying next...`);
          continue;
        }
        if (!res.ok) {
          console.log(`    Overpass ${label}: HTTP ${res.status}`);
          continue;
        }
        const contentType = res.headers.get('content-type') || '';
        const text = await res.text();
        if (!contentType.includes('json') && text.startsWith('<?xml')) {
          console.log(`    Overpass ${label}: got XML instead of JSON (rate limited?), trying next...`);
          continue;
        }
        return JSON.parse(text);
      } catch (err: any) {
        console.log(`    Overpass ${label}: ${err.message}, trying next...`);
      }
    }
    if (attempt < retries - 1) {
      const delay = (attempt + 1) * 15000;
      console.log(`    All APIs failed, retrying in ${delay / 1000}s...`);
      await sleep(delay);
    }
  }
  throw new Error('Overpass API failed after retries');
}

// --- Role-aware relation extraction ---

const EXCLUDED_ROLES = new Set([
  'alternate', 'alternative', 'excursion', 'approach',
  'disused:alternate', 'connection', 'link',
]);

function isMainRole(role: string): boolean {
  return !EXCLUDED_ROLES.has(role);
}

async function collectWayIds(relId: number, depth = 0, visited = new Set<number>()): Promise<number[]> {
  if (visited.has(relId)) return [];
  visited.add(relId);

  const indent = '  '.repeat(depth + 2);
  const data = await overpassQuery(`[out:json][timeout:60];relation(${relId});out body;`);
  const rel = data.elements?.find((e: any) => e.type === 'relation');
  if (!rel) {
    console.log(`${indent}Relation ${relId}: not found`);
    return [];
  }

  const name = rel.tags?.name || `rel:${relId}`;
  const wayIds: number[] = [];
  const subRelIds: { id: number; role: string }[] = [];

  for (const m of rel.members || []) {
    const role = m.role || '';
    if (m.type === 'way' && isMainRole(role)) {
      wayIds.push(m.ref);
    }
    if (m.type === 'relation' && isMainRole(role)) {
      subRelIds.push({ id: m.ref, role });
    }
  }

  const excludedWays = (rel.members || []).filter((m: any) => m.type === 'way' && !isMainRole(m.role || ''));
  const excludedRels = (rel.members || []).filter((m: any) => m.type === 'relation' && !isMainRole(m.role || ''));

  console.log(`${indent}${name}: ${wayIds.length} ways, ${subRelIds.length} sub-rels${excludedWays.length > 0 ? ` (excluded ${excludedWays.length} alt ways)` : ''}${excludedRels.length > 0 ? ` (excluded ${excludedRels.length} alt rels)` : ''}`);

  await sleep(2000);

  for (const sub of subRelIds) {
    const subWays = await collectWayIds(sub.id, depth + 1, visited);
    wayIds.push(...subWays);
    await sleep(1500);
  }

  return wayIds;
}

// --- Dynamic search: find all matching relations ---

async function searchRelations(pattern: { namePattern: string; bbox: string; excludePattern?: string }): Promise<number[]> {
  console.log(`  Searching for relations matching "${pattern.namePattern}" in ${pattern.bbox}...`);

  const query = `[out:json][timeout:30];
    relation["route"="hiking"]["name"~"${pattern.namePattern}",i](${pattern.bbox});
    out tags;`;

  const data = await overpassQuery(query);
  const elements = data.elements || [];

  const filtered = elements.filter((el: any) => {
    if (pattern.excludePattern) {
      const name = el.tags?.name || '';
      if (new RegExp(pattern.excludePattern, 'i').test(name)) return false;
    }
    return true;
  });

  console.log(`  Found ${filtered.length} matching relations (from ${elements.length} total)`);
  for (const el of filtered) {
    console.log(`    rel:${el.id} — "${el.tags?.name}"`);
  }

  return filtered.map((el: any) => el.id);
}

// --- Way segment fetching + chaining ---

async function fetchWaySegments(wayIds: number[]): Promise<[number, number][][]> {
  if (wayIds.length === 0) return [];

  const segments: [number, number][][] = [];
  const batchSize = 150;
  const totalBatches = Math.ceil(wayIds.length / batchSize);

  for (let i = 0; i < wayIds.length; i += batchSize) {
    const batch = wayIds.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;

    console.log(`    Fetching way batch ${batchNum}/${totalBatches} (${batch.length} ways)...`);

    const idList = batch.join(',');
    const query = `[out:json][timeout:180];way(id:${idList});out body;>;out skel qt;`;
    const data = await overpassQuery(query);

    // Two-pass: collect nodes first, then resolve ways
    const nodes = new Map<number, { lat: number; lon: number }>();
    const ways: { id: number; nodeIds: number[] }[] = [];

    for (const e of data.elements || []) {
      if (e.type === 'node') nodes.set(e.id, { lat: e.lat, lon: e.lon });
      if (e.type === 'way') ways.push({ id: e.id, nodeIds: e.nodes || [] });
    }

    for (const way of ways) {
      const seg: [number, number][] = [];
      for (const nid of way.nodeIds) {
        const n = nodes.get(nid);
        if (n) seg.push([n.lon, n.lat]);
      }
      if (seg.length >= 2) segments.push(seg);
    }

    await sleep(3000);
  }

  return segments;
}

function chainSegments(segments: [number, number][][]): [number, number][] {
  if (segments.length <= 1) return segments[0] || [];

  console.log(`    Chaining ${segments.length} segments...`);
  const ordered: [number, number][][] = [segments[0]];
  const used = new Set<number>([0]);

  while (used.size < segments.length) {
    const lastSeg = ordered[ordered.length - 1];
    const lastPt = lastSeg[lastSeg.length - 1];
    let bestIdx = -1, bestDist = Infinity, bestReverse = false;

    for (let i = 0; i < segments.length; i++) {
      if (used.has(i)) continue;
      const seg = segments[i];
      const sd = haversine(lastPt[1], lastPt[0], seg[0][1], seg[0][0]);
      const ed = haversine(lastPt[1], lastPt[0], seg[seg.length - 1][1], seg[seg.length - 1][0]);
      if (sd < bestDist) { bestDist = sd; bestIdx = i; bestReverse = false; }
      if (ed < bestDist) { bestDist = ed; bestIdx = i; bestReverse = true; }
    }

    if (bestIdx === -1) break;
    used.add(bestIdx);
    ordered.push(bestReverse ? [...segments[bestIdx]].reverse() : segments[bestIdx]);

    if (used.size % 500 === 0) {
      console.log(`    Chained ${used.size}/${segments.length}...`);
    }
  }

  return ordered.flat();
}

// --- Elevation enrichment (latitude-aware: SRTM < 60°N, ASTER ≥ 60°N) ---

async function enrichElevation(coords: [number, number][]): Promise<[number, number, number][]> {
  const result: [number, number, number][] = [];
  const totalBatches = Math.ceil(coords.length / 100);

  for (let i = 0; i < coords.length; i += 100) {
    const batch = coords.slice(i, i + 100);
    const batchNum = Math.floor(i / 100) + 1;

    // Check if any points are above 60°N — use ASTER for those
    const maxLat = batch.reduce((m, c) => Math.max(m, c[1]), -Infinity);
    const api = maxLat >= 59.5 ? TOPO_API_ASTER : TOPO_API_SRTM;

    const locations = batch.map(c => `${c[1]},${c[0]}`).join('|');

    try {
      const res = await fetch(`${api}?locations=${locations}`);
      if (res.ok) {
        const data = await res.json();
        for (let j = 0; j < batch.length; j++) {
          const ele = data.results?.[j]?.elevation ?? 0;
          result.push([batch[j][0], batch[j][1], Math.round(ele)]);
        }
      } else {
        for (const c of batch) result.push([c[0], c[1], 0]);
      }
    } catch {
      for (const c of batch) result.push([c[0], c[1], 0]);
    }

    await sleep(1100);

    if (batchNum % 100 === 0 || batchNum === totalBatches) {
      const source = maxLat >= 59.5 ? 'ASTER' : 'SRTM';
      console.log(`    Elevation [${source}]: ${batchNum}/${totalBatches} batches`);
    }
  }

  return result;
}

// --- Save progress ---

interface ProgressResult {
  id: string;
  name: string;
  calcKm: number;
  pts: number;
  source: string;
  off: number;
  status: string;
  country: string;
}

function saveProgress(results: ProgressResult[]) {
  const progressPath = join(PROGRESS_DIR, 'europe-mega-progress.json');
  writeFileSync(progressPath, JSON.stringify({ results, timestamp: new Date().toISOString() }, null, 2));
}

// --- Main ---

async function main() {
  const args = process.argv.slice(2);
  const trailFilter = args.includes('--trail') ? args[args.indexOf('--trail') + 1] : null;
  const skipElevation = args.includes('--skip-elevation');
  const resume = args.includes('--resume');

  console.log('=== FETCH EUROPE MEGA TRAILS ===');
  if (skipElevation) console.log('Skipping elevation enrichment');
  if (resume) console.log('Resume mode: skipping trails with existing data');
  console.log();

  const trails = trailFilter
    ? MEGA_TRAILS.filter(t => t.name.toLowerCase().includes(trailFilter.toLowerCase()))
    : MEGA_TRAILS;

  if (trails.length === 0) {
    console.log(`No trails matching "${trailFilter}"`);
    return;
  }

  // Load existing progress for resume
  const progressPath = join(PROGRESS_DIR, 'europe-mega-progress.json');
  let progressResults: ProgressResult[] = [];
  if (resume && existsSync(progressPath)) {
    progressResults = JSON.parse(readFileSync(progressPath, 'utf-8')).results || [];
  }

  for (const trail of trails) {
    const filePath = join(TRAIL_DATA_DIR, `${trail.id}.json`);

    if (resume && progressResults.some(r => r.id === trail.id)) {
      console.log(`SKIP ${trail.name} (already in progress)`);
      continue;
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`=== ${trail.name} (${trail.officialDistanceKm}km) ===`);
    console.log(`${'='.repeat(60)}`);

    try {
      let allWayIds: number[] = [];

      if (trail.osmRelationId) {
        // Single relation
        console.log(`  Collecting ways from relation ${trail.osmRelationId}...`);
        allWayIds = await collectWayIds(trail.osmRelationId);

      } else if (trail.osmRelationIds) {
        // Multiple known relation IDs — collect ways from each
        console.log(`  Collecting ways from ${trail.osmRelationIds.length} relations...`);
        const visited = new Set<number>();
        for (let ri = 0; ri < trail.osmRelationIds.length; ri++) {
          const relId = trail.osmRelationIds[ri];
          const ways = await collectWayIds(relId, 0, visited);
          allWayIds.push(...ways);
          if ((ri + 1) % 10 === 0) {
            console.log(`  Progress: ${ri + 1}/${trail.osmRelationIds.length} relations queried`);
          }
          await sleep(1500);
        }

      } else if (trail.searchPattern) {
        // Dynamic search
        const relIds = await searchRelations(trail.searchPattern);
        if (relIds.length === 0) {
          console.log('  FAILED: no matching relations found');
          continue;
        }
        await sleep(3000);

        console.log(`  Collecting ways from ${relIds.length} found relations...`);
        const visited = new Set<number>();
        for (const relId of relIds) {
          const ways = await collectWayIds(relId, 0, visited);
          allWayIds.push(...ways);
          await sleep(1500);
        }
      }

      const uniqueWayIds = [...new Set(allWayIds)];
      console.log(`  Total: ${uniqueWayIds.length} unique ways`);

      if (uniqueWayIds.length === 0) {
        console.log('  FAILED: no ways found');
        continue;
      }

      // Fetch way geometries
      console.log('  Fetching way geometries...');
      const segments = await fetchWaySegments(uniqueWayIds);
      console.log(`  Got ${segments.length} segments`);

      if (segments.length === 0) {
        console.log('  FAILED: no segments');
        continue;
      }

      // Chain segments
      const chained = chainSegments(segments);
      const rawKm = totalDistance(chained);
      console.log(`  Chained: ${chained.length} points, ${rawKm.toFixed(1)}km`);

      // Elevation
      let coords3d: [number, number, number][];
      if (skipElevation) {
        coords3d = chained.map(c => [c[0], c[1], 0] as [number, number, number]);
        console.log('  Elevation: skipped');
      } else {
        const estMinutes = Math.ceil(chained.length / 100 * 1.1 / 60);
        console.log(`  Enriching elevation (${chained.length} pts, ~${Math.ceil(chained.length / 100)} batches, ~${estMinutes}min)...`);
        coords3d = await enrichElevation(chained);
        const elevs = coords3d.map(c => c[2]).filter(e => e !== 0);
        if (elevs.length > 0) {
          console.log(`  Elevation: ${safeMin(elevs)}m — ${safeMax(elevs)}m`);
        }
      }

      const calcKm = totalDistance(coords3d);
      const errPct = Math.abs(calcKm - trail.officialDistanceKm) / trail.officialDistanceKm * 100;

      // Save trail data
      const trailData = {
        id: trail.id,
        name: trail.name,
        region: trail.region,
        country: trail.country,
        distance_km: trail.officialDistanceKm,
        typical_days: trail.typicalDays,
        coordinates: coords3d,
        dataSource: 'osm_overpass_ordered',
        calculatedKm: calcKm,
      };

      writeFileSync(filePath, JSON.stringify(trailData));

      // Update manifest
      const manifestPath = join(TRAIL_DATA_DIR, 'manifest.json');
      const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf-8')) : [];
      const existingIdx = manifest.findIndex((m: any) => m.id === trail.id);
      if (existingIdx >= 0) manifest.splice(existingIdx, 1);

      const elevs = coords3d.map(c => c[2]).filter(e => e !== 0);
      manifest.push({
        id: trail.id,
        name: trail.name,
        region: trail.region,
        country: trail.country,
        distance_km: trail.officialDistanceKm,
        typical_days: trail.typicalDays,
        pointCount: coords3d.length,
        dataSource: 'osm_overpass_ordered',
        calculatedKm: calcKm,
        elevationLow: elevs.length > 0 ? safeMin(elevs) : 0,
        elevationHigh: elevs.length > 0 ? safeMax(elevs) : 0,
      });

      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

      const status = errPct <= 5 ? 'OK' : errPct <= 25 ? 'FAIR' : 'HIGH';
      console.log(`  SUCCESS [${status}]: ${coords3d.length} pts, ${calcKm.toFixed(1)}km (${errPct.toFixed(1)}% off ${trail.officialDistanceKm}km)`);

      // Save progress
      progressResults.push({
        id: trail.id,
        name: trail.name,
        calcKm,
        pts: coords3d.length,
        source: 'osm_overpass_ordered',
        off: errPct,
        status,
        country: trail.country,
      });
      saveProgress(progressResults);

    } catch (err: any) {
      console.log(`  ERROR: ${err.message}`);
    }

    // Longer pause between trails
    await sleep(10000);
  }

  // Final summary
  console.log('\n=== SUMMARY ===');
  console.log('| Status | Trail | Calc | Official | Off |');
  console.log('|--------|-------|------|----------|-----|');
  for (const r of progressResults.sort((a, b) => a.off - b.off)) {
    console.log(`| ${r.status} | ${r.name} | ${r.calcKm.toFixed(1)}km | ${r.off.toFixed(1)}% |`);
  }

  const ok = progressResults.filter(r => r.status === 'OK').length;
  const fair = progressResults.filter(r => r.status === 'FAIR').length;
  const high = progressResults.filter(r => r.status === 'HIGH').length;
  console.log(`\nQuality: OK=${ok}, FAIR=${fair}, HIGH=${high}`);
  console.log('\n=== DONE ===');
}

main().catch(console.error);
