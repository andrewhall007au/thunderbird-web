// Fetch missing US trail data from OSM using WAY queries (not relations)
// For trails where no route=hiking relation exists, query individual ways by name + bbox
// Usage: npx tsx scripts/trail-curation/fetch-us-ways.ts [--resume] [--dry-run] [--only trailId]
//
// Pipeline:
// 1. Query OSM for ways by trail name + bbox (highway=path|footway|track|steps)
// 2. Chain way segments by nearest endpoint
// 3. Enrich elevation via SRTM 30m
// 4. Write trail JSON + update manifest

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const OVERPASS_API = 'https://overpass.kumi.systems/api/interpreter';
const OVERPASS_API_FALLBACK = 'https://overpass-api.de/api/interpreter';
const TOPO_API = 'https://api.opentopodata.org/v1/srtm30m';
const TRAIL_DATA_DIR = join(process.cwd(), 'public', 'trail-data');

interface MissingTrail {
  id: string;
  name: string;
  searchNames: string[];   // OSM name variants to try
  region: string;
  officialKm: number;
  typicalDays: string;
  bbox: [number, number, number, number]; // [south, west, north, east]
}

// 24 missing US trails with search names and bboxes
const MISSING_TRAILS: MissingTrail[] = [
  // California
  { id: 'alamere_falls_via_coast_trail', name: 'Alamere Falls via Coast Trail', searchNames: ['Coast Trail', 'Alamere Falls Trail'], region: 'CA', officialKm: 20.9, typicalDays: '1 day', bbox: [37.95, -122.88, 38.10, -122.70] },
  { id: 'cactus_to_clouds_trail', name: 'Cactus to Clouds Trail', searchNames: ['Skyline Trail', 'Cactus to Clouds', 'Lykken Trail'], region: 'CA', officialKm: 32.2, typicalDays: '1-2 days', bbox: [33.75, -116.65, 33.90, -116.45] },
  { id: 'cucamonga_peak_trail', name: 'Cucamonga Peak Trail', searchNames: ['Icehouse Canyon Trail', 'Cucamonga Peak'], region: 'CA', officialKm: 19.3, typicalDays: '1 day', bbox: [34.15, -117.65, 34.30, -117.50] },
  { id: 'lassen_peak_trail', name: 'Lassen Peak Trail', searchNames: ['Lassen Peak Trail', 'Lassen Peak'], region: 'CA', officialKm: 8.0, typicalDays: '1 day', bbox: [40.45, -121.55, 40.52, -121.48] },
  { id: 'moro_rock_trail', name: 'Moro Rock Trail', searchNames: ['Moro Rock Trail', 'Moro Rock'], region: 'CA', officialKm: 0.8, typicalDays: '1 day', bbox: [36.53, -118.79, 36.57, -118.75] },
  { id: 'mount_dana_trail', name: 'Mount Dana Trail', searchNames: ['Mount Dana Trail', 'Mount Dana', 'Dana Plateau Trail'], region: 'CA', officialKm: 9.7, typicalDays: '1 day', bbox: [37.86, -119.26, 37.93, -119.18] },
  { id: 'mount_tallac_trail', name: 'Mount Tallac Trail', searchNames: ['Mount Tallac Trail', 'Mt. Tallac Trail', 'Tallac Trail'], region: 'CA', officialKm: 15.4, typicalDays: '1 day', bbox: [38.85, -120.15, 38.96, -120.04] },
  { id: 'north_dome_via_indian_rock', name: 'North Dome via Indian Rock', searchNames: ['North Dome Trail', 'Porcupine Creek Trail', 'Indian Rock'], region: 'CA', officialKm: 14.5, typicalDays: '1 day', bbox: [37.72, -119.62, 37.82, -119.52] },
  { id: 'sentinel_dome_and_taft_point', name: 'Sentinel Dome and Taft Point', searchNames: ['Sentinel Dome Trail', 'Taft Point Trail', 'Pohono Trail'], region: 'CA', officialKm: 8.0, typicalDays: '1 day', bbox: [37.69, -119.62, 37.76, -119.55] },

  // Utah
  { id: 'delicate_arch_trail', name: 'Delicate Arch Trail', searchNames: ['Delicate Arch Trail', 'Delicate Arch'], region: 'UT', officialKm: 4.8, typicalDays: '1 day', bbox: [38.70, -109.56, 38.78, -109.47] },

  // Arizona
  { id: 'cathedral_rock_trail', name: 'Cathedral Rock Trail', searchNames: ['Cathedral Rock Trail', 'Cathedral Rock'], region: 'AZ', officialKm: 2.4, typicalDays: '1 day', bbox: [34.79, -111.82, 34.85, -111.76] },
  { id: 'west_fork_oak_creek', name: 'West Fork Oak Creek', searchNames: ['West Fork Trail', 'West Fork Oak Creek'], region: 'AZ', officialKm: 11.3, typicalDays: '1 day', bbox: [34.92, -111.80, 35.02, -111.69] },

  // Colorado
  { id: 'four_pass_loop', name: 'Four Pass Loop', searchNames: ['Maroon-Snowmass Trail', 'West Maroon Trail', 'Trail Rider Pass', 'Buckskin Pass Trail'], region: 'CO', officialKm: 45.1, typicalDays: '3-4 days', bbox: [39.00, -107.10, 39.18, -106.85] },
  { id: 'hanging_lake_trail', name: 'Hanging Lake Trail', searchNames: ['Hanging Lake Trail', 'Hanging Lake'], region: 'CO', officialKm: 4.8, typicalDays: '1 day', bbox: [39.57, -107.23, 39.63, -107.17] },
  { id: 'ice_lakes_basin', name: 'Ice Lakes Basin', searchNames: ['Ice Lake Trail', 'Ice Lakes Trail', 'South Mineral Creek'], region: 'CO', officialKm: 11.3, typicalDays: '1 day', bbox: [37.77, -107.83, 37.85, -107.75] },
  { id: 'maroon_bells_crater_lake', name: 'Maroon Bells Crater Lake', searchNames: ['Crater Lake Trail', 'Maroon-Snowmass Trail', 'West Maroon Trail'], region: 'CO', officialKm: 6.1, typicalDays: '1 day', bbox: [39.05, -107.02, 39.13, -106.91] },

  // Oregon
  { id: 'horsetail_falls_trail', name: 'Horsetail Falls Trail', searchNames: ['Horsetail Falls Trail', 'Ponytail Falls Trail', 'Horsetail Creek Trail'], region: 'OR', officialKm: 4.3, typicalDays: '1 day', bbox: [45.56, -122.11, 45.62, -122.04] },

  // Wyoming
  { id: 'cascade_canyon_to_lake_solitude', name: 'Cascade Canyon to Lake Solitude', searchNames: ['Cascade Canyon Trail', 'Lake Solitude Trail'], region: 'WY', officialKm: 30.6, typicalDays: '1-2 days', bbox: [43.70, -110.88, 43.80, -110.70] },

  // Montana
  { id: 'beartooth_traverse', name: 'Beartooth Traverse', searchNames: ['Beaten Path Trail', 'Beaten Path', 'Beartooth High Lakes'], region: 'MT', officialKm: 42.0, typicalDays: '3-4 days', bbox: [44.92, -109.70, 45.12, -109.35] },
  { id: 'scenic_point_trail', name: 'Scenic Point Trail', searchNames: ['Scenic Point Trail', 'Scenic Point'], region: 'MT', officialKm: 11.7, typicalDays: '1 day', bbox: [48.41, -113.42, 48.50, -113.30] },

  // Michigan
  { id: 'isle_royale', name: 'Isle Royale Greenstone Ridge Trail', searchNames: ['Greenstone Ridge Trail', 'Greenstone Ridge'], region: 'MI', officialKm: 68.0, typicalDays: '5-6 days', bbox: [47.85, -89.25, 48.10, -88.40] },

  // Maine
  { id: 'mount_katahdin_via_hunt_trail', name: 'Mount Katahdin via Hunt Trail', searchNames: ['Hunt Trail', 'Appalachian Trail'], region: 'ME', officialKm: 16.7, typicalDays: '1 day', bbox: [45.85, -68.98, 45.95, -68.85] },

  // Hawaii
  { id: 'haleakala_sliding_sands_trail', name: 'Haleakala Sliding Sands Trail', searchNames: ['Sliding Sands Trail', 'Keoneheehee Trail', 'Halemau\'u Trail'], region: 'HI', officialKm: 17.7, typicalDays: '1 day', bbox: [20.68, -156.22, 20.77, -156.12] },
  { id: 'kalepa_ridge_trail', name: 'Kalepa Ridge Trail', searchNames: ['Kalepa Ridge Trail', 'Kalepa Ridge'], region: 'HI', officialKm: 3.2, typicalDays: '1 day', bbox: [22.10, -159.39, 22.16, -159.32] },
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

let useMainApi = true; // kumi mirror is rate-limited, use main API first

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
        continue;
      }
    }
    if (attempt < retries - 1) {
      const delay = (attempt + 1) * 10000;
      console.log(`    All APIs failed, retrying in ${delay / 1000}s...`);
      await sleep(delay);
    }
  }
  throw new Error('Overpass API failed after retries');
}

// --- Way-based query ---

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

function escapeOsmRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function fetchWays(searchName: string, bbox: [number, number, number, number]): Promise<{ coords: [number, number][]; wayCount: number } | null> {
  const bboxStr = `(${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]})`;
  const escaped = escapeOsmRegex(searchName);

  // Try ways with name match, broad highway types
  const query = `[out:json][timeout:60];
    (
      way["highway"~"path|footway|track|steps|bridleway"]["name"~"${escaped}",i]${bboxStr};
      way["highway"~"path|footway|track|steps|bridleway"]["alt_name"~"${escaped}",i]${bboxStr};
    );
    out body;>;out skel qt;`;

  console.log(`    Query bbox: ${bboxStr}`);
  const data = await overpassQuery(query);
  const totalElements = (data.elements || []).length;
  const wayElements = (data.elements || []).filter((e: any) => e.type === 'way').length;
  const nodeElements = (data.elements || []).filter((e: any) => e.type === 'node').length;
  console.log(`    Response: ${totalElements} elements (${wayElements} ways, ${nodeElements} nodes)`);

  // Two-pass: nodes first (they come after ways in `out body;>;out skel qt;` response)
  const nodes = new Map<number, { lat: number; lon: number }>();
  const ways: { id: number; nodeIds: number[] }[] = [];

  for (const e of data.elements || []) {
    if (e.type === 'node') nodes.set(e.id, { lat: e.lat, lon: e.lon });
    if (e.type === 'way') ways.push({ id: e.id, nodeIds: e.nodes || [] });
  }

  const segments: [number, number][][] = [];
  for (const way of ways) {
    const seg: [number, number][] = [];
    for (const nid of way.nodeIds) {
      const n = nodes.get(nid);
      if (n) seg.push([n.lon, n.lat]);
    }
    if (seg.length >= 2) segments.push(seg);
  }

  if (segments.length === 0) return null;

  const chained = chainSegments(segments);
  return { coords: chained, wayCount: segments.length };
}

// Also try relation search as fallback (some trails got new relations since last batch)
async function fetchRelation(searchName: string, bbox: [number, number, number, number]): Promise<{ coords: [number, number][]; relId: number } | null> {
  const bboxStr = `(${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]})`;
  const escaped = escapeOsmRegex(searchName);

  const query = `[out:json][timeout:60];
    (
      rel["route"="hiking"]["name"~"${escaped}",i]${bboxStr};
      rel["route"="foot"]["name"~"${escaped}",i]${bboxStr};
    );
    out tags;`;

  const data = await overpassQuery(query);
  const rels = (data.elements || []).filter((e: any) => e.type === 'relation');
  if (rels.length === 0) return null;

  const rel = rels[0];
  console.log(`    Found relation ${rel.id} "${rel.tags?.name}"`);

  // Fetch geometry
  const geomQuery = `[out:json][timeout:120];relation(${rel.id});way(r);out body;>;out skel qt;`;
  const geomData = await overpassQuery(geomQuery);

  // Two-pass: nodes first
  const nodes = new Map<number, { lat: number; lon: number }>();
  const relWays: { id: number; nodeIds: number[] }[] = [];

  for (const e of geomData.elements || []) {
    if (e.type === 'node') nodes.set(e.id, { lat: e.lat, lon: e.lon });
    if (e.type === 'way') relWays.push({ id: e.id, nodeIds: e.nodes || [] });
  }

  const segments: [number, number][][] = [];
  for (const way of relWays) {
    const seg: [number, number][] = [];
    for (const nid of way.nodeIds) {
      const n = nodes.get(nid);
      if (n) seg.push([n.lon, n.lat]);
    }
    if (seg.length >= 2) segments.push(seg);
  }

  if (segments.length === 0) return null;
  const chained = chainSegments(segments);
  return { coords: chained, relId: rel.id };
}

// --- Elevation enrichment ---

async function enrichElevation(coords: [number, number][]): Promise<[number, number, number][]> {
  const result: [number, number, number][] = [];

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

    await sleep(1100); // Rate limit: 1 req/sec
  }

  return result;
}

// --- Write trail data ---

function writeTrailData(trail: MissingTrail, coords3d: [number, number, number][], source: string) {
  const calcKm = totalDistance(coords3d);
  const off = Math.abs(calcKm - trail.officialKm) / trail.officialKm * 100;

  const trailData = {
    id: trail.id,
    name: trail.name,
    region: trail.region,
    country: 'US',
    distance_km: trail.officialKm,
    typical_days: trail.typicalDays,
    coordinates: coords3d,
    dataSource: source,
  };

  const filePath = join(TRAIL_DATA_DIR, `${trail.id}.json`);
  writeFileSync(filePath, JSON.stringify(trailData));

  // Elevation stats
  const eles = coords3d.map(c => c[2]).filter(e => e !== 0);
  let eleStr = 'no elevation';
  if (eles.length > 0) {
    let min = eles[0], max = eles[0];
    for (const e of eles) { if (e < min) min = e; if (e > max) max = e; }
    eleStr = `${min}m — ${max}m`;
  }

  const status = off <= 5 ? 'OK' : off <= 25 ? 'FAIR' : 'HIGH';
  console.log(`  ✓ ${status} | ${trail.name}: ${calcKm.toFixed(1)}km / ${trail.officialKm}km (${off.toFixed(1)}%) | ${coords3d.length} pts | ${eleStr}`);
  return { status, calcKm, off };
}

// --- Update manifest ---

function updateManifest(trail: MissingTrail, coords3d: [number, number, number][], source: string) {
  const manifestPath = join(TRAIL_DATA_DIR, 'manifest.json');
  const manifest: any[] = JSON.parse(readFileSync(manifestPath, 'utf8'));

  const calcKm = totalDistance(coords3d);
  const eles = coords3d.map(c => c[2]).filter(e => e !== 0);
  let minEle = 0, maxEle = 0;
  if (eles.length > 0) {
    minEle = eles[0]; maxEle = eles[0];
    for (const e of eles) { if (e < minEle) minEle = e; if (e > maxEle) maxEle = e; }
  }

  // Remove existing entry if any
  const idx = manifest.findIndex((t: any) => t.id === trail.id);
  if (idx >= 0) manifest.splice(idx, 1);

  manifest.push({
    id: trail.id,
    name: trail.name,
    region: trail.region,
    country: 'US',
    distance_km: trail.officialKm,
    typical_days: trail.typicalDays,
    pointCount: coords3d.length,
    dataSource: source,
    elevationLow: minEle,
    elevationHigh: maxEle,
  });

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

// --- Main ---

async function main() {
  const args = process.argv.slice(2);
  const resume = args.includes('--resume');
  const dryRun = args.includes('--dry-run');
  const onlyIdx = args.indexOf('--only');
  const onlyId = onlyIdx >= 0 ? args[onlyIdx + 1] : null;

  let trails = MISSING_TRAILS;
  if (onlyId) {
    trails = trails.filter(t => t.id === onlyId);
    if (trails.length === 0) {
      console.log(`Trail "${onlyId}" not found in list`);
      process.exit(1);
    }
  }

  console.log(`\n=== Fetching ${trails.length} missing US trails via OSM way queries ===\n`);

  const results: { id: string; name: string; status: string; calcKm: number; off: number }[] = [];
  const failed: string[] = [];

  for (let i = 0; i < trails.length; i++) {
    const trail = trails[i];
    console.log(`\n[${i + 1}/${trails.length}] ${trail.name} (${trail.id})`);

    // Skip if already has data
    if (resume && existsSync(join(TRAIL_DATA_DIR, `${trail.id}.json`))) {
      console.log('  Skipping (already has data file)');
      continue;
    }

    let coords2d: [number, number][] | null = null;
    let source = 'osm_ways';
    let bestResult: { coords: [number, number][]; source: string } | null = null;

    // Try each search name variant
    for (const searchName of trail.searchNames) {
      console.log(`  Trying ways: "${searchName}"...`);
      try {
        const wayResult = await fetchWays(searchName, trail.bbox);
        if (wayResult && wayResult.coords.length >= 4) {
          const km = totalDistance(wayResult.coords);
          const off = Math.abs(km - trail.officialKm) / trail.officialKm * 100;
          console.log(`    ${wayResult.wayCount} ways, ${wayResult.coords.length} pts, ${km.toFixed(1)}km (${off.toFixed(1)}% off)`);

          // Keep best result (closest to official distance)
          if (!bestResult || off < Math.abs(totalDistance(bestResult.coords) - trail.officialKm) / trail.officialKm * 100) {
            bestResult = { coords: wayResult.coords, source: 'osm_ways' };
          }
        } else {
          console.log('    No ways found');
        }
      } catch (err: any) {
        console.log(`    Error: ${err.message}`);
      }
      await sleep(5000);
    }

    // Also try relation search as fallback
    for (const searchName of trail.searchNames.slice(0, 2)) {
      console.log(`  Trying relation: "${searchName}"...`);
      try {
        const relResult = await fetchRelation(searchName, trail.bbox);
        if (relResult && relResult.coords.length >= 4) {
          const km = totalDistance(relResult.coords);
          const off = Math.abs(km - trail.officialKm) / trail.officialKm * 100;
          console.log(`    ${relResult.coords.length} pts, ${km.toFixed(1)}km (${off.toFixed(1)}% off)`);

          if (!bestResult || off < Math.abs(totalDistance(bestResult.coords) - trail.officialKm) / trail.officialKm * 100) {
            bestResult = { coords: relResult.coords, source: 'osm_relation' };
          }
        } else {
          console.log('    No relation found');
        }
      } catch (err: any) {
        console.log(`    Error: ${err.message}`);
      }
      await sleep(5000);
    }

    if (!bestResult) {
      console.log(`  ✗ FAILED — no OSM data found`);
      failed.push(trail.id);
      continue;
    }

    coords2d = bestResult.coords;
    source = bestResult.source;
    const rawKm = totalDistance(coords2d);

    // Check if result is out-and-back (calc ≈ official/2)
    const halfOff = Math.abs(rawKm - trail.officialKm / 2) / (trail.officialKm / 2) * 100;
    if (halfOff < 15) {
      console.log(`  Detected out-and-back (${rawKm.toFixed(1)}km ≈ ${(trail.officialKm / 2).toFixed(1)}km = half official). Mirroring...`);
      const reversed = [...coords2d].reverse().slice(1); // Skip duplicate point at turnaround
      coords2d = [...coords2d, ...reversed];
      source += '_mirrored';
    }

    if (dryRun) {
      console.log(`  [DRY RUN] Would write ${coords2d.length} pts, ${rawKm.toFixed(1)}km`);
      continue;
    }

    // Elevation enrichment
    console.log(`  Enriching elevation (${coords2d.length} pts, ~${Math.ceil(coords2d.length / 100)} batches)...`);
    const coords3d = await enrichElevation(coords2d);

    const { status, calcKm, off } = writeTrailData(trail, coords3d, source);
    updateManifest(trail, coords3d, source);
    results.push({ id: trail.id, name: trail.name, status, calcKm, off });

    // Pause between trails
    await sleep(3000);
  }

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Fetched: ${results.length}/${trails.length}`);
  console.log(`Failed: ${failed.length} (${failed.join(', ')})`);
  if (results.length > 0) {
    console.log('\n| Status | Trail | Calc | Official | Off |');
    console.log('|--------|-------|------|----------|-----|');
    for (const r of results) {
      const t = MISSING_TRAILS.find(t => t.id === r.id)!;
      console.log(`| ${r.status} | ${r.name} | ${r.calcKm.toFixed(1)}km | ${t.officialKm}km | ${r.off.toFixed(1)}% |`);
    }
  }
}

main().catch(console.error);
