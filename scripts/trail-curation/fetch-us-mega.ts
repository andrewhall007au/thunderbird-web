// Fetch mega US thru-hikes using known OSM relation IDs
// These trails are super-relations with many sub-relations (sections)
// Usage: npx tsx scripts/trail-curation/fetch-us-mega.ts [--trail NAME] [--skip-elevation] [--resume]
//
// Examples:
//   npx tsx scripts/trail-curation/fetch-us-mega.ts --trail "Colorado Trail"
//   npx tsx scripts/trail-curation/fetch-us-mega.ts --skip-elevation
//   npx tsx scripts/trail-curation/fetch-us-mega.ts --resume

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const OVERPASS_API = 'https://overpass.kumi.systems/api/interpreter';
const OVERPASS_API_FALLBACK = 'https://overpass-api.de/api/interpreter';
const TOPO_API = 'https://api.opentopodata.org/v1/srtm30m';
const TRAIL_DATA_DIR = join(process.cwd(), 'public', 'trail-data');

interface MegaTrail {
  name: string;
  id: string;
  osmRelationId: number;
  officialDistanceKm: number;
  region: string;
  typicalDays: string;
}

const MEGA_TRAILS: MegaTrail[] = [
  // Start with smaller ones first
  { name: 'Pinhoti Trail', id: 'pinhoti_trail', osmRelationId: 1642836, officialDistanceKm: 530, region: 'AL-GA', typicalDays: '4-5 weeks' },
  { name: 'Colorado Trail', id: 'colorado_trail', osmRelationId: 3445384, officialDistanceKm: 788, region: 'CO', typicalDays: '4-6 weeks' },
  { name: 'Arizona Trail', id: 'arizona_trail', osmRelationId: 2804113, officialDistanceKm: 1290, region: 'AZ', typicalDays: '6-8 weeks' },
  { name: 'Ice Age Trail', id: 'ice_age_trail', osmRelationId: 2381423, officialDistanceKm: 1900, region: 'WI', typicalDays: '8-10 weeks' },
  { name: 'Pacific Northwest Trail', id: 'pacific_northwest_trail', osmRelationId: 11225405, officialDistanceKm: 1930, region: 'MT-ID-WA', typicalDays: '8-10 weeks' },
  { name: 'Appalachian Trail', id: 'appalachian_trail', osmRelationId: 156553, officialDistanceKm: 3524, region: 'GA-ME', typicalDays: '5-7 months' },
  { name: 'Pacific Crest Trail', id: 'pacific_crest_trail', osmRelationId: 1225378, officialDistanceKm: 4265, region: 'CA-OR-WA', typicalDays: '5-6 months' },
  { name: 'Continental Divide Trail', id: 'continental_divide_trail', osmRelationId: 921198, officialDistanceKm: 5000, region: 'NM-CO-WY-MT', typicalDays: '5-6 months' },
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

// Recursively collect all main-route way IDs from a super-relation
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

  // Recurse into sub-relations
  for (const sub of subRelIds) {
    const subWays = await collectWayIds(sub.id, depth + 1, visited);
    wayIds.push(...subWays);
    await sleep(1500);
  }

  return wayIds;
}

// --- Way segment fetching + chaining ---

async function fetchWaySegments(wayIds: number[]): Promise<[number, number][][]> {
  if (wayIds.length === 0) return [];

  const segments: [number, number][][] = [];
  const batchSize = 150; // Smaller batches for mega trails
  const totalBatches = Math.ceil(wayIds.length / batchSize);

  for (let i = 0; i < wayIds.length; i += batchSize) {
    const batch = wayIds.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const idList = batch.join(',');

    console.log(`    Fetching way batch ${batchNum}/${totalBatches} (${batch.length} ways)...`);

    const query = `[out:json][timeout:180];way(id:${idList});out body;>;out skel qt;`;
    const data = await overpassQuery(query);

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

// --- Elevation enrichment ---

async function enrichElevation(coords: [number, number][]): Promise<[number, number, number][]> {
  const result: [number, number, number][] = [];
  const totalBatches = Math.ceil(coords.length / 100);

  for (let i = 0; i < coords.length; i += 100) {
    const batch = coords.slice(i, i + 100);
    const locations = batch.map(c => `${c[1]},${c[0]}`).join('|');
    const batchNum = Math.floor(i / 100) + 1;

    try {
      const res = await fetch(`${TOPO_API}?locations=${locations}`);
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
      console.log(`    Elevation: ${batchNum}/${totalBatches} batches`);
    }
  }

  return result;
}

// --- Main ---

async function main() {
  const args = process.argv.slice(2);
  const trailFilter = args.includes('--trail') ? args[args.indexOf('--trail') + 1] : null;
  const skipElevation = args.includes('--skip-elevation');
  const resume = args.includes('--resume');

  console.log('=== FETCH US MEGA THRU-HIKES ===');
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

  for (const trail of trails) {
    const filePath = join(TRAIL_DATA_DIR, `${trail.id}.json`);

    if (resume && existsSync(filePath)) {
      console.log(`SKIP ${trail.name} (exists)`);
      continue;
    }

    console.log(`\n=== ${trail.name} (${trail.officialDistanceKm}km, rel:${trail.osmRelationId}) ===`);

    try {
      // Step 1: Collect all way IDs from the super-relation
      console.log('  Collecting way IDs from relation tree...');
      const wayIds = await collectWayIds(trail.osmRelationId);
      const uniqueWayIds = [...new Set(wayIds)];
      console.log(`  Total: ${uniqueWayIds.length} unique ways`);

      if (uniqueWayIds.length === 0) {
        console.log('  FAILED: no ways found');
        continue;
      }

      // Step 2: Fetch way geometries
      console.log('  Fetching way geometries...');
      const segments = await fetchWaySegments(uniqueWayIds);
      console.log(`  Got ${segments.length} segments`);

      if (segments.length === 0) {
        console.log('  FAILED: no segments');
        continue;
      }

      // Step 3: Chain segments
      const chained = chainSegments(segments);
      const rawKm = totalDistance(chained);
      console.log(`  Chained: ${chained.length} points, ${rawKm.toFixed(1)}km`);

      // Step 4: Elevation (optional)
      let coords3d: [number, number, number][];
      if (skipElevation) {
        coords3d = chained.map(c => [c[0], c[1], 0] as [number, number, number]);
        console.log('  Elevation: skipped');
      } else {
        console.log(`  Enriching elevation (${chained.length} pts, ~${Math.ceil(chained.length / 100)} batches, ~${Math.ceil(chained.length / 100 * 1.1 / 60)}min)...`);
        coords3d = await enrichElevation(chained);
        const elevs = coords3d.map(c => c[2]).filter(e => e !== 0);
        if (elevs.length > 0) {
          console.log(`  Elevation: ${Math.min(...elevs)}m — ${Math.max(...elevs)}m`);
        }
      }

      const calcKm = totalDistance(coords3d);
      const errPct = Math.abs(calcKm - trail.officialDistanceKm) / trail.officialDistanceKm * 100;

      // Step 5: Save
      const trailData = {
        id: trail.id,
        name: trail.name,
        region: trail.region,
        country: 'US',
        distance_km: trail.officialDistanceKm,
        typical_days: trail.typicalDays,
        coordinates: coords3d,
        dataSource: 'osm_overpass_ordered',
        calculatedKm: calcKm,
      };

      writeFileSync(filePath, JSON.stringify(trailData, null, 2));

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
        country: 'US',
        distance_km: trail.officialDistanceKm,
        typical_days: trail.typicalDays,
        pointCount: coords3d.length,
        dataSource: 'osm_overpass_ordered',
        calculatedKm: calcKm,
        elevationLow: elevs.length > 0 ? Math.min(...elevs) : 0,
        elevationHigh: elevs.length > 0 ? Math.max(...elevs) : 0,
      });

      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

      const status = errPct <= 5 ? 'OK' : errPct <= 25 ? 'FAIR' : 'HIGH';
      console.log(`  SUCCESS [${status}]: ${coords3d.length} pts, ${calcKm.toFixed(1)}km (${errPct.toFixed(1)}% off ${trail.officialDistanceKm}km)`);

    } catch (err: any) {
      console.log(`  ERROR: ${err.message}`);
    }

    // Longer pause between mega trails
    await sleep(10000);
  }

  console.log('\n=== DONE ===');
}

main().catch(console.error);
