// Fix way ordering v3: Role-aware Overpass queries
// Filters out alternate/excursion sub-relations and way roles
// Usage: npx tsx scripts/trail-curation/fix-way-ordering-v3.ts

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const TRAIL_DATA_DIR = join(process.cwd(), 'public', 'trail-data');
// Use alternative Overpass server to avoid rate limiting
const OVERPASS_API = 'https://overpass.kumi.systems/api/interpreter';
const TOPO_API = 'https://api.opentopodata.org/v1/srtm30m';

interface TrailData {
  id: string;
  name: string;
  region: string;
  country: string;
  distance_km: number;
  typical_days: string;
  coordinates: [number, number, number][];
  dataSource: string;
  calculatedKm: number;
}

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

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function overpassQuery(query: string): Promise<any> {
  const res = await fetch(OVERPASS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  return res.json();
}

// Get relation members with roles
async function getRelationStructure(relId: number): Promise<{
  directWays: { id: number; role: string }[];
  subRelations: { id: number; role: string }[];
}> {
  const data = await overpassQuery(`[out:json][timeout:30];relation(${relId});out body;`);
  const rel = data.elements?.find((e: any) => e.type === 'relation');
  if (!rel) return { directWays: [], subRelations: [] };

  const directWays: { id: number; role: string }[] = [];
  const subRelations: { id: number; role: string }[] = [];

  for (const m of rel.members || []) {
    const role = m.role || '';
    if (m.type === 'way') directWays.push({ id: m.ref, role });
    if (m.type === 'relation') subRelations.push({ id: m.ref, role });
  }
  return { directWays, subRelations };
}

// Excluded roles for sub-relations and ways
const EXCLUDED_ROLES = new Set([
  'alternate', 'alternative', 'excursion', 'approach',
  'disused:alternate', 'connection', 'link',
]);

function isMainRole(role: string): boolean {
  return !EXCLUDED_ROLES.has(role);
}

// Fetch ways as segments from a set of way IDs
async function fetchWaySegments(wayIds: number[]): Promise<[number, number][][]> {
  if (wayIds.length === 0) return [];

  // Batch into groups of 200 to avoid query size limits
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

    if (i + 200 < wayIds.length) await sleep(2000);
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
  }

  return ordered.flat();
}

// Elevation: carry over from existing + SRTM for missing
async function addElevation(coords: [number, number][], existing: [number, number, number][]): Promise<[number, number, number][]> {
  const lookup = new Map<string, number>();
  for (const c of existing) {
    lookup.set(`${c[0].toFixed(6)},${c[1].toFixed(6)}`, c[2]);
  }

  const result: [number, number, number][] = [];
  const needFetch: number[] = [];

  for (let i = 0; i < coords.length; i++) {
    const key = `${coords[i][0].toFixed(6)},${coords[i][1].toFixed(6)}`;
    const elev = lookup.get(key);
    if (elev !== undefined) {
      result.push([coords[i][0], coords[i][1], elev]);
    } else {
      result.push([coords[i][0], coords[i][1], 0]);
      needFetch.push(i);
    }
  }

  if (needFetch.length > 0) {
    console.log(`     Fetching elevation for ${needFetch.length} new points...`);
    for (let batch = 0; batch < needFetch.length; batch += 100) {
      const batchIndices = needFetch.slice(batch, batch + 100);
      const locations = batchIndices.map(i => `${coords[i][1]},${coords[i][0]}`).join('|');
      try {
        const res = await fetch(`${TOPO_API}?locations=${locations}`);
        if (res.ok) {
          const data = await res.json();
          for (let j = 0; j < batchIndices.length; j++) {
            result[batchIndices[j]][2] = Math.round(data.results?.[j]?.elevation ?? 0);
          }
        }
      } catch {}
      await sleep(1100);
    }
  }

  return result;
}

// Main route extraction: get only main-role ways, filtering out alternates/excursions
async function extractMainRoute(relId: number, trailName: string): Promise<[number, number][] | null> {
  console.log(`     Getting relation structure...`);
  const structure = await getRelationStructure(relId);
  await sleep(3000);

  // Collect main-route way IDs
  const mainWayIds: number[] = [];

  // Direct ways with main roles
  const mainDirectWays = structure.directWays.filter(w => isMainRole(w.role));
  const excludedDirectWays = structure.directWays.filter(w => !isMainRole(w.role));
  mainWayIds.push(...mainDirectWays.map(w => w.id));

  console.log(`     Direct ways: ${mainDirectWays.length} main, ${excludedDirectWays.length} excluded`);
  if (excludedDirectWays.length > 0) {
    console.log(`       Excluded roles: ${[...new Set(excludedDirectWays.map(w => w.role))].join(', ')}`);
  }

  // Sub-relations with main roles
  const mainSubRels = structure.subRelations.filter(r => isMainRole(r.role));
  const excludedSubRels = structure.subRelations.filter(r => !isMainRole(r.role));

  console.log(`     Sub-relations: ${mainSubRels.length} main, ${excludedSubRels.length} excluded`);
  if (excludedSubRels.length > 0) {
    console.log(`       Excluded: ${excludedSubRels.map(r => `${r.id}(${r.role})`).join(', ')}`);
  }

  // Get ways from main sub-relations
  for (const subRel of mainSubRels) {
    const subStructure = await getRelationStructure(subRel.id);
    const subMainWays = subStructure.directWays.filter(w => isMainRole(w.role));
    mainWayIds.push(...subMainWays.map(w => w.id));
    console.log(`       Sub-rel ${subRel.id}: ${subMainWays.length} ways`);
    await sleep(2000);
  }

  if (mainWayIds.length === 0) {
    console.log(`     No main-route ways found!`);
    return null;
  }

  console.log(`     Total main-route ways: ${mainWayIds.length}`);

  // Fetch way geometry
  console.log(`     Fetching way geometry...`);
  const segments = await fetchWaySegments(mainWayIds);
  console.log(`     Got ${segments.length} segments`);

  if (segments.length === 0) return null;

  // Chain segments
  const chained = chainSegments(segments);
  console.log(`     Chained → ${chained.length} points`);

  return chained;
}

interface TrailConfig {
  id: string;
  relId: number;
  officialKm: number;
}

const TRAILS: TrailConfig[] = [
  { id: 'larapinta_trail', relId: 3066363, officialKm: 223 },
  { id: 'jatbula_trail', relId: 14531438, officialKm: 62 },
];

async function main() {
  console.log('=== WAY ORDERING FIX v3 (role-aware) ===\n');

  for (const trail of TRAILS) {
    const filePath = join(TRAIL_DATA_DIR, `${trail.id}.json`);
    let existing: TrailData;
    try {
      existing = JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch {
      console.log(`SKIP ${trail.id} — no file`);
      continue;
    }

    const currentError = Math.abs(existing.calculatedKm - trail.officialKm) / trail.officialKm;
    if (currentError <= 0.05) {
      console.log(`OK   ${existing.name} — ${existing.calculatedKm.toFixed(1)}km (${(currentError * 100).toFixed(1)}% off)`);
      continue;
    }

    console.log(`\nFIX  ${existing.name} — ${existing.calculatedKm.toFixed(1)}km (${(currentError * 100).toFixed(1)}% off ${trail.officialKm}km)`);

    try {
      const coords2d = await extractMainRoute(trail.relId, existing.name);
      if (!coords2d || coords2d.length < 20) {
        console.log(`     FAILED — insufficient data`);
        await sleep(5000);
        continue;
      }

      // Add elevation
      const coords3d = await addElevation(coords2d, existing.coordinates);
      const newKm = totalDistance(coords3d);
      const newError = Math.abs(newKm - trail.officialKm) / trail.officialKm;

      console.log(`     Result: ${newKm.toFixed(1)}km (${(newError * 100).toFixed(1)}% off official)`);

      if (newError < currentError) {
        existing.coordinates = coords3d;
        existing.calculatedKm = newKm;
        existing.dataSource = 'osm_overpass_ordered';
        writeFileSync(filePath, JSON.stringify(existing, null, 2));
        console.log(`     SAVED ✓`);
      } else {
        console.log(`     No improvement — keeping current`);
      }
    } catch (err) {
      console.log(`     ERROR: ${err}`);
    }

    await sleep(10000);
  }

  // Update manifest
  const manifestPath = join(TRAIL_DATA_DIR, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  for (const trail of TRAILS) {
    try {
      const data: TrailData = JSON.parse(readFileSync(join(TRAIL_DATA_DIR, `${trail.id}.json`), 'utf-8'));
      let entry = manifest.find((m: any) => m.id === trail.id);
      if (!entry) {
        entry = { id: trail.id };
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
    } catch {}
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('\nManifest updated. Done!');
}

main().catch(console.error);
