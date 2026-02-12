// Fix way ordering v2: Re-query Overpass to get proper way structure,
// chain by nearest endpoint, carry over existing elevation data.
// Usage: npx tsx scripts/trail-curation/fix-way-ordering-v2.ts

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const TRAIL_DATA_DIR = join(process.cwd(), 'public', 'trail-data');
const OVERPASS_API = 'https://overpass-api.de/api/interpreter';
const ERROR_THRESHOLD = 0.05; // Fix trails >5% off

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

function coordDist(a: [number, number, number], b: [number, number, number]): number {
  return haversine(a[1], a[0], b[1], b[0]);
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// Build spatial lookup from existing elevation data
// Key: rounded lng,lat → elevation
function buildElevationLookup(coords: [number, number, number][]): Map<string, number> {
  const map = new Map<string, number>();
  for (const c of coords) {
    // Round to 6 decimal places (~0.1m precision)
    const key = `${c[0].toFixed(6)},${c[1].toFixed(6)}`;
    map.set(key, c[2]);
  }
  return map;
}

function lookupElevation(
  lng: number, lat: number,
  lookup: Map<string, number>,
  coords: [number, number, number][]
): number {
  // Try exact match first
  const key = `${lng.toFixed(6)},${lat.toFixed(6)}`;
  const exact = lookup.get(key);
  if (exact !== undefined) return exact;

  // Nearest neighbor fallback
  let bestDist = Infinity;
  let bestElev = 0;
  for (const c of coords) {
    const d = (c[0] - lng) ** 2 + (c[1] - lat) ** 2;
    if (d < bestDist) {
      bestDist = d;
      bestElev = c[2];
    }
  }
  return bestElev;
}

// Query Overpass for a hiking relation, returning ways as separate segments
// Handles sub-relations (sections) by recursing into them
async function queryOverpassWays(searchName: string, retries = 2): Promise<[number, number][][] | null> {
  // First find the relation
  const findQuery = `[out:json][timeout:30];
    relation["route"="hiking"]["name"~"${searchName}",i];
    out ids;`;

  const findRes = await fetch(OVERPASS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(findQuery)}`,
  });
  if (!findRes.ok) {
    console.log(`     Find query HTTP ${findRes.status}`);
    if (retries > 0) {
      console.log(`     Retrying in 10s...`);
      await sleep(10000);
      return queryOverpassWays(searchName, retries - 1);
    }
    return null;
  }
  const findData = await findRes.json();
  const relations = (findData.elements || []).filter((e: any) => e.type === 'relation');
  if (relations.length === 0) return null;

  const relId = relations[0].id;
  console.log(`     Relation ID: ${relId}`);

  await sleep(5000);

  // Get all ways: direct ways + ways from sub-relations (recursive)
  const wayQuery = `[out:json][timeout:180];
    relation(${relId})->.main;
    (
      way(r.main);
      relation(r.main);
      way(r);
    );
    out body;
    >;
    out skel qt;`;

  const wayRes = await fetch(OVERPASS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(wayQuery)}`,
  });
  if (!wayRes.ok) {
    console.log(`     Ways query HTTP ${wayRes.status}`);
    if (retries > 0) {
      console.log(`     Retrying in 15s...`);
      await sleep(15000);
      return queryOverpassWays(searchName, retries - 1);
    }
    return null;
  }
  const wayData = await wayRes.json();
  const elements = wayData.elements || [];

  const nodes = new Map<number, { lat: number; lon: number }>();
  const ways: { id: number; nodeIds: number[] }[] = [];

  for (const e of elements) {
    if (e.type === 'node') nodes.set(e.id, { lat: e.lat, lon: e.lon });
    if (e.type === 'way') ways.push({ id: e.id, nodeIds: e.nodes || [] });
  }

  console.log(`     ${ways.length} ways, ${nodes.size} nodes`);

  // Convert each way to coordinate array
  const segments: [number, number][][] = [];
  for (const way of ways) {
    const seg: [number, number][] = [];
    for (const nid of way.nodeIds) {
      const n = nodes.get(nid);
      if (n) seg.push([n.lon, n.lat]);
    }
    if (seg.length >= 2) segments.push(seg);
  }

  return segments.length > 0 ? segments : null;
}

// Chain segments by nearest endpoint
function chainSegments(segments: [number, number][][]): [number, number][] {
  if (segments.length <= 1) return segments[0] || [];

  const ordered: [number, number][][] = [segments[0]];
  const used = new Set<number>([0]);

  while (used.size < segments.length) {
    const lastSeg = ordered[ordered.length - 1];
    const lastPt = lastSeg[lastSeg.length - 1];

    let bestIdx = -1;
    let bestDist = Infinity;
    let bestReverse = false;

    for (let i = 0; i < segments.length; i++) {
      if (used.has(i)) continue;
      const seg = segments[i];
      const startDist = haversine(lastPt[1], lastPt[0], seg[0][1], seg[0][0]);
      const endDist = haversine(lastPt[1], lastPt[0], seg[seg.length - 1][1], seg[seg.length - 1][0]);

      if (startDist < bestDist) {
        bestDist = startDist;
        bestIdx = i;
        bestReverse = false;
      }
      if (endDist < bestDist) {
        bestDist = endDist;
        bestIdx = i;
        bestReverse = true;
      }
    }

    if (bestIdx === -1) break;
    used.add(bestIdx);
    ordered.push(bestReverse ? [...segments[bestIdx]].reverse() : segments[bestIdx]);
  }

  return ordered.flat();
}

// Trails still >5% off after v2 run 1
const TRAILS_TO_FIX: { id: string; searchName: string; officialKm: number }[] = [
  { id: 'larapinta_trail', searchName: 'Larapinta Trail', officialKm: 223 },
  { id: 'heysen_trail', searchName: 'Heysen Trail', officialKm: 1200 },
  { id: 'cape_to_cape_track', searchName: 'Cape to Cape Track', officialKm: 123 },
  { id: 'jatbula_trail', searchName: 'Jatbula Trail', officialKm: 62 },
  { id: 'great_north_walk', searchName: 'Great North Walk', officialKm: 250 },
  { id: 'light_to_light_walk', searchName: 'Light to Light Walk', officialKm: 32 },
  { id: 'grampians_peaks_trail', searchName: 'Grampians Peaks Trail', officialKm: 164 },
  { id: 'australian_alps_walking_track', searchName: 'Australian Alps Walking Track', officialKm: 655 },
  { id: 'great_ocean_walk', searchName: 'Great Ocean Walk', officialKm: 110 },
  { id: 'six_foot_track', searchName: 'Six Foot Track', officialKm: 45 },
];

async function main() {
  console.log('=== WAY ORDERING FIX v2 (re-query Overpass) ===\n');

  for (const trail of TRAILS_TO_FIX) {
    const filePath = join(TRAIL_DATA_DIR, `${trail.id}.json`);
    let existing: TrailData;
    try {
      existing = JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch {
      console.log(`SKIP ${trail.id} — file not found`);
      continue;
    }

    const currentError = Math.abs(existing.calculatedKm - trail.officialKm) / trail.officialKm;
    if (currentError <= ERROR_THRESHOLD) {
      console.log(`OK   ${existing.name} — ${existing.calculatedKm.toFixed(1)}km (${(currentError * 100).toFixed(1)}% off ${trail.officialKm}km official)`);
      continue;
    }

    console.log(`FIX  ${existing.name}`);
    console.log(`     Current: ${existing.calculatedKm.toFixed(1)}km (${(currentError * 100).toFixed(1)}% off ${trail.officialKm}km official)`);

    // Re-query Overpass for proper way structure
    console.log(`     Querying Overpass...`);
    const segments = await queryOverpassWays(trail.searchName);

    if (!segments) {
      console.log(`     FAILED — no Overpass data`);
      await sleep(3000);
      continue;
    }

    // Chain segments
    const ordered2d = chainSegments(segments);
    console.log(`     Chained ${segments.length} ways → ${ordered2d.length} points`);

    // Look up elevation from existing data
    const elevLookup = buildElevationLookup(existing.coordinates);
    const ordered3d: [number, number, number][] = ordered2d.map(([lng, lat]) => {
      const elev = lookupElevation(lng, lat, elevLookup, existing.coordinates);
      return [lng, lat, elev];
    });

    const newKm = totalDistance(ordered3d);
    const newError = Math.abs(newKm - trail.officialKm) / trail.officialKm;
    console.log(`     Result:  ${newKm.toFixed(1)}km (${(newError * 100).toFixed(1)}% off official)`);

    // Save if improved
    if (newKm < existing.calculatedKm) {
      existing.coordinates = ordered3d;
      existing.calculatedKm = newKm;
      existing.dataSource = 'osm_overpass_ordered';
      writeFileSync(filePath, JSON.stringify(existing, null, 2));
      console.log(`     SAVED ✓ (${existing.calculatedKm.toFixed(1)}km → ${newKm.toFixed(1)}km)\n`);
    } else {
      console.log(`     No improvement — keeping existing\n`);
    }

    // Rate limit for Overpass
    await sleep(5000);
  }

  // Update manifest
  const manifestPath = join(TRAIL_DATA_DIR, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  let updated = 0;

  for (const trail of TRAILS_TO_FIX) {
    const filePath = join(TRAIL_DATA_DIR, `${trail.id}.json`);
    try {
      const data: TrailData = JSON.parse(readFileSync(filePath, 'utf-8'));
      const entry = manifest.find((m: any) => m.id === trail.id);
      if (entry) {
        entry.dataSource = data.dataSource;
        entry.calculatedKm = data.calculatedKm;
        entry.pointCount = data.coordinates.length;
        const elevs = data.coordinates.map((c: number[]) => c[2]);
        entry.elevationLow = Math.min(...elevs);
        entry.elevationHigh = Math.max(...elevs);
        updated++;
      }
    } catch {}
  }

  if (updated > 0) {
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`Manifest: updated ${updated} entries`);
  }

  console.log('\nDone!');
}

main().catch(console.error);
