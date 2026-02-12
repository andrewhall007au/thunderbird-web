// Fetch the 9 remaining Australia mainland trails with way-ordering built in
// Pipeline: Find relation → get structure → filter roles → fetch ways → chain → elevation → save
// Usage: npx tsx scripts/trail-curation/fetch-remaining-9.ts

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const TRAIL_DATA_DIR = join(process.cwd(), 'public', 'trail-data');
const OVERPASS_API = 'https://overpass-api.de/api/interpreter';
const TOPO_API = 'https://api.opentopodata.org/v1/srtm30m';

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function totalDistance(coords: [number, number, number][]): number {
  let d = 0;
  for (let i = 1; i < coords.length; i++) {
    d += haversine(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
  }
  return d;
}

function toId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

const EXCLUDED_ROLES = new Set([
  'alternate', 'alternative', 'excursion', 'approach',
  'disused:alternate', 'connection', 'link',
]);

async function overpassQuery(query: string, retries = 2): Promise<any> {
  const res = await fetch(OVERPASS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) {
    if (retries > 0) {
      console.log(`    Overpass ${res.status}, retrying in 15s...`);
      await sleep(15000);
      return overpassQuery(query, retries - 1);
    }
    throw new Error(`Overpass HTTP ${res.status}`);
  }
  return res.json();
}

// Find hiking relation by name
async function findRelation(searchNames: string[]): Promise<{ id: number; name: string } | null> {
  for (const searchName of searchNames) {
    console.log(`    Searching: "${searchName}"...`);
    const query = `[out:json][timeout:30];relation["route"="hiking"]["name"~"${searchName}",i];out body;`;
    const data = await overpassQuery(query);
    const relations = (data.elements || []).filter((e: any) => e.type === 'relation');

    // Find the top-level relation (one that isn't a sub-relation of another)
    // Prefer relations with sub-relations or many ways (more likely to be the parent)
    let best: any = null;
    let bestScore = -1;
    for (const rel of relations) {
      const members = rel.members || [];
      const wayCount = members.filter((m: any) => m.type === 'way').length;
      const relCount = members.filter((m: any) => m.type === 'relation').length;
      // Check if name is a close match (not a section)
      const name = rel.tags?.name || '';
      const isSection = /section|stage|day|leg/i.test(name) && !new RegExp(searchName, 'i').test(name);
      if (isSection) continue;
      const score = wayCount + relCount * 10; // Prefer relations with sub-relations
      if (score > bestScore) {
        bestScore = score;
        best = rel;
      }
    }

    if (best) {
      console.log(`    Found: "${best.tags?.name}" (rel ${best.id})`);
      return { id: best.id, name: best.tags?.name || searchName };
    }
    await sleep(3000);
  }
  return null;
}

// Get main-route way IDs from a relation (recursing into main sub-relations)
async function getMainWayIds(relId: number): Promise<number[]> {
  const query = `[out:json][timeout:30];relation(${relId});out body;`;
  const data = await overpassQuery(query);
  const rel = data.elements?.find((e: any) => e.type === 'relation');
  if (!rel) return [];

  const wayIds: number[] = [];
  const subRelIds: number[] = [];

  for (const m of rel.members || []) {
    const role = m.role || '';
    if (m.type === 'way' && !EXCLUDED_ROLES.has(role)) {
      wayIds.push(m.ref);
    }
    if (m.type === 'relation' && !EXCLUDED_ROLES.has(role)) {
      subRelIds.push(m.ref);
    }
  }

  // Recurse into main sub-relations
  for (const subId of subRelIds) {
    await sleep(2000);
    const subWayIds = await getMainWayIds(subId);
    wayIds.push(...subWayIds);
  }

  return wayIds;
}

// Fetch way geometry in batches
async function fetchWayGeometry(wayIds: number[]): Promise<[number, number][][]> {
  const segments: [number, number][][] = [];
  for (let i = 0; i < wayIds.length; i += 200) {
    const batch = wayIds.slice(i, i + 200);
    const idList = batch.join(',');
    const query = `[out:json][timeout:120];way(id:${idList});out body;>;out skel qt;`;
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

    if (i + 200 < wayIds.length) await sleep(3000);
  }
  return segments;
}

// Chain segments by nearest endpoint
function chainSegments(segments: [number, number][][]): [number, number][] {
  if (segments.length <= 1) return segments[0] || [];
  const ordered: [number, number][][] = [segments[0]];
  const used = new Set<number>([0]);
  while (used.size < segments.length) {
    const lastSeg = ordered[ordered.length - 1];
    const lastPt = lastSeg[lastSeg.length - 1];
    let bi = -1, bd = Infinity, br = false;
    for (let i = 0; i < segments.length; i++) {
      if (used.has(i)) continue;
      const s = segments[i];
      const sd = haversine(lastPt[1], lastPt[0], s[0][1], s[0][0]);
      const ed = haversine(lastPt[1], lastPt[0], s[s.length - 1][1], s[s.length - 1][0]);
      if (sd < bd) { bd = sd; bi = i; br = false; }
      if (ed < bd) { bd = ed; bi = i; br = true; }
    }
    if (bi === -1) break;
    used.add(bi);
    ordered.push(br ? [...segments[bi]].reverse() : segments[bi]);
  }
  return ordered.flat();
}

// Elevation enrichment via SRTM 30m
async function enrichElevation(coords: [number, number][]): Promise<[number, number, number][]> {
  const result: [number, number, number][] = [];
  const total = Math.ceil(coords.length / 100);
  for (let i = 0; i < coords.length; i += 100) {
    const batch = coords.slice(i, i + 100);
    const locations = batch.map(c => `${c[1]},${c[0]}`).join('|');
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
    if ((i / 100 + 1) % 20 === 0) {
      console.log(`    Elevation: ${Math.min(i / 100 + 1, total)}/${total} batches`);
    }
  }
  return result;
}

interface TrailInput {
  name: string;
  searchNames: string[];
  region: string;
  officialKm: number;
  typicalDays: string;
}

const TRAILS: TrailInput[] = [
  { name: 'Carnarvon Great Walk', searchNames: ['Carnarvon Great Walk', 'Carnarvon Gorge'], region: 'Queensland', officialKm: 87, typicalDays: '6-7' },
  { name: 'Gold Coast Hinterland Great Walk', searchNames: ['Gold Coast Hinterland Great Walk', 'Lamington Great Walk', 'Gold Coast Hinterland'], region: 'Queensland', officialKm: 54, typicalDays: '3' },
  { name: 'Yuraygir Coastal Walk', searchNames: ['Yuraygir Coastal Walk', 'Yuraygir'], region: 'New South Wales', officialKm: 65, typicalDays: '4-5' },
  { name: 'Coast Track', searchNames: ['Royal Coast Track', 'Coast Track Royal', 'Royal National Park Coast Track'], region: 'New South Wales', officialKm: 26, typicalDays: '2' },
  { name: 'Wilsons Promontory Southern Circuit', searchNames: ['Wilsons Promontory', 'Wilsons Prom Southern Circuit', 'Wilsons Prom'], region: 'Victoria', officialKm: 59, typicalDays: '3-5' },
  { name: 'Wilderness Coast Walk', searchNames: ['Wilderness Coast Walk', 'Croajingolong Wilderness Walk', 'Wilderness Coast'], region: 'Victoria', officialKm: 100, typicalDays: '8-10' },
  { name: 'Goldfields Track', searchNames: ['Goldfields Track', 'Great Dividing Trail Goldfields'], region: 'Victoria', officialKm: 210, typicalDays: '10-14' },
  { name: 'Canberra Centenary Trail', searchNames: ['Canberra Centenary Trail', 'Centenary Trail'], region: 'ACT', officialKm: 145, typicalDays: '7' },
  { name: 'Great Dividing Trail', searchNames: ['Great Dividing Trail'], region: 'Victoria', officialKm: 300, typicalDays: '15-20' },
];

async function main() {
  mkdirSync(TRAIL_DATA_DIR, { recursive: true });
  console.log('=== FETCH REMAINING 9 TRAILS ===\n');

  const results: { id: string; name: string; km: number; official: number; pts: number; status: string }[] = [];
  const failures: string[] = [];

  for (let ti = 0; ti < TRAILS.length; ti++) {
    const trail = TRAILS[ti];
    const id = toId(trail.name);
    console.log(`\n[${ti + 1}/${TRAILS.length}] ${trail.name} (${trail.officialKm}km, ${trail.region})`);

    try {
      // Step 1: Find relation
      const rel = await findRelation(trail.searchNames);
      if (!rel) {
        console.log('    FAILED: No relation found');
        failures.push(trail.name);
        await sleep(5000);
        continue;
      }

      await sleep(3000);

      // Step 2: Get main-route way IDs (role-aware)
      console.log('    Getting main-route ways...');
      const wayIds = await getMainWayIds(rel.id);
      if (wayIds.length === 0) {
        console.log('    FAILED: No ways found');
        failures.push(trail.name);
        await sleep(5000);
        continue;
      }
      console.log(`    ${wayIds.length} main-route ways`);

      await sleep(3000);

      // Step 3: Fetch way geometry
      console.log('    Fetching geometry...');
      const segments = await fetchWayGeometry(wayIds);
      if (segments.length === 0) {
        console.log('    FAILED: No geometry');
        failures.push(trail.name);
        await sleep(5000);
        continue;
      }

      // Step 4: Chain segments
      const chained = chainSegments(segments);
      const km2d = haversineTotal(chained);
      console.log(`    Chained: ${segments.length} segments → ${chained.length} points, ${km2d.toFixed(1)}km`);

      // Step 5: Elevation enrichment
      console.log(`    Enriching elevation (${chained.length} points, ~${Math.ceil(chained.length / 100)} batches)...`);
      const coords3d = await enrichElevation(chained);

      const km = totalDistance(coords3d);
      const errPct = Math.abs(km - trail.officialKm) / trail.officialKm * 100;
      const elevs = coords3d.map(c => c[2]);

      console.log(`    Result: ${km.toFixed(1)}km (${errPct.toFixed(1)}% off ${trail.officialKm}km official)`);
      console.log(`    Elevation: ${Math.min(...elevs)}m — ${Math.max(...elevs)}m`);

      // Step 6: Save
      const trailData = {
        id,
        name: trail.name,
        region: trail.region,
        country: 'AU',
        distance_km: trail.officialKm,
        typical_days: trail.typicalDays,
        coordinates: coords3d,
        dataSource: 'osm_overpass_ordered',
        calculatedKm: km,
      };
      writeFileSync(join(TRAIL_DATA_DIR, `${id}.json`), JSON.stringify(trailData, null, 2));
      console.log(`    SAVED ✓`);

      results.push({ id, name: trail.name, km, official: trail.officialKm, pts: chained.length, status: errPct <= 5 ? 'OK' : errPct <= 25 ? 'FAIR' : 'HIGH' });
    } catch (err) {
      console.log(`    ERROR: ${err}`);
      failures.push(trail.name);
    }

    await sleep(5000);
  }

  // Update manifest
  const manifestPath = join(TRAIL_DATA_DIR, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  for (const r of results) {
    const filePath = join(TRAIL_DATA_DIR, `${r.id}.json`);
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));
    let entry = manifest.find((m: any) => m.id === r.id);
    if (!entry) {
      entry = { id: r.id };
      manifest.push(entry);
    }
    entry.name = data.name;
    entry.region = data.region;
    entry.country = data.country;
    entry.distance_km = data.distance_km;
    entry.typical_days = data.typical_days;
    entry.dataSource = data.dataSource;
    entry.calculatedKm = data.calculatedKm;
    entry.pointCount = data.coordinates.length;
    const elevs = data.coordinates.map((c: number[]) => c[2]);
    entry.elevationLow = Math.min(...elevs);
    entry.elevationHigh = Math.max(...elevs);
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log('\n=== SUMMARY ===');
  console.log(`Succeeded: ${results.length}/${TRAILS.length}`);
  for (const r of results) {
    console.log(`  ${r.status.padEnd(5)} ${r.name.padEnd(42)} ${(r.km.toFixed(1)+'km').padStart(10)} / ${(r.official+'km').padStart(7)}  ${r.pts} pts`);
  }
  if (failures.length > 0) {
    console.log(`Failed: ${failures.join(', ')}`);
  }
}

function haversineTotal(coords: [number, number][]): number {
  let d = 0;
  for (let i = 1; i < coords.length; i++) {
    d += haversine(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
  }
  return d;
}

main().catch(console.error);
