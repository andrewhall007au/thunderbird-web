// Fetch South African trail data from OSM Overpass with role-aware filtering + way chaining
// Usage: npx tsx scripts/trail-curation/fetch-south-africa-batch.ts [--resume]
//
// Pipeline:
// 1. Search OSM for hiking route relation by name + bbox
// 2. Filter out alternate/excursion sub-relations and ways
// 3. Fallback to standalone way queries if no relation found
// 4. Chain way segments by nearest endpoint
// 5. Enrich elevation via SRTM 30m
// 6. Auto-detect and mirror out-and-back trails
// 7. Write individual trail JSON + update manifest

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const OVERPASS_API = 'https://overpass.kumi.systems/api/interpreter';
const OVERPASS_API_FALLBACK = 'https://overpass-api.de/api/interpreter';
const TOPO_API = 'https://api.opentopodata.org/v1/srtm30m';

interface TrailInput {
  name: string;
  searchName: string;
  region: string;
  country: string;
  officialDistanceKm: number;
  typicalDays: number | string;
  bbox?: [number, number, number, number]; // [south, west, north, east]
}

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

function toId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// Safe min/max for large arrays (avoid stack overflow)
function safeMin(arr: number[]): number {
  let min = Infinity;
  for (const v of arr) if (v < min) min = v;
  return min;
}
function safeMax(arr: number[]): number {
  let max = -Infinity;
  for (const v of arr) if (v > max) max = v;
  return max;
}

// --- Overpass API ---

async function overpassQuery(query: string, retries = 3): Promise<any> {
  const apis = [OVERPASS_API, OVERPASS_API_FALLBACK];

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

// --- Role-aware relation extraction ---

const EXCLUDED_ROLES = new Set([
  'alternate', 'alternative', 'excursion', 'approach',
  'disused:alternate', 'connection', 'link',
]);

function isMainRole(role: string): boolean {
  return !EXCLUDED_ROLES.has(role);
}

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

// --- Way segment fetching + chaining ---

async function fetchWaySegments(wayIds: number[]): Promise<[number, number][][]> {
  if (wayIds.length === 0) return [];

  const segments: [number, number][][] = [];
  for (let i = 0; i < wayIds.length; i += 200) {
    const batch = wayIds.slice(i, i + 200);
    const idList = batch.join(',');
    const query = `[out:json][timeout:120];way(id:${idList});out body;>;out skel qt;`;

    const data = await overpassQuery(query);
    // Two-pass: collect all nodes first, then resolve ways
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

// --- Main route extraction from relation ---

async function extractMainRoute(relId: number): Promise<[number, number][] | null> {
  const structure = await getRelationStructure(relId);
  await sleep(2000);

  const mainWayIds: number[] = [];

  const mainDirectWays = structure.directWays.filter(w => isMainRole(w.role));
  const excludedDirectWays = structure.directWays.filter(w => !isMainRole(w.role));
  mainWayIds.push(...mainDirectWays.map(w => w.id));

  if (excludedDirectWays.length > 0) {
    console.log(`    Excluded ${excludedDirectWays.length} ways (${[...new Set(excludedDirectWays.map(w => w.role))].join(', ')})`);
  }

  const mainSubRels = structure.subRelations.filter(r => isMainRole(r.role));
  const excludedSubRels = structure.subRelations.filter(r => !isMainRole(r.role));

  if (excludedSubRels.length > 0) {
    console.log(`    Excluded ${excludedSubRels.length} sub-relations (${[...new Set(excludedSubRels.map(r => r.role))].join(', ')})`);
  }

  for (const subRel of mainSubRels) {
    const subStructure = await getRelationStructure(subRel.id);
    const subMainWays = subStructure.directWays.filter(w => isMainRole(w.role));
    mainWayIds.push(...subMainWays.map(w => w.id));
    await sleep(1500);
  }

  if (mainWayIds.length === 0) return null;

  console.log(`    ${mainWayIds.length} main-route ways (${mainSubRels.length} sub-rels)`);

  const segments = await fetchWaySegments(mainWayIds);
  if (segments.length === 0) return null;

  const chained = chainSegments(segments);
  console.log(`    Chained: ${chained.length} points`);

  return chained;
}

// --- Search OSM for trail relation ---

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function searchVariants(searchName: string, trailName: string): string[] {
  const variants = new Set<string>();
  variants.add(escapeRegex(searchName));
  variants.add(escapeRegex(trailName));

  for (const name of [searchName, trailName]) {
    const simplified = name
      .replace(/\s+via\s+.+$/i, '')
      .replace(/\s+to\s+.+$/i, '')
      .replace(/\s*\(.*?\)\s*/g, '')
      .trim();
    if (simplified !== name) variants.add(escapeRegex(simplified));
  }

  // DGT-specific variants
  variants.add('Drakensberg Grand Traverse');
  variants.add('DGT');
  variants.add('Drakensberg Escarpment');
  variants.add('Giant.*Cup');
  variants.add('uKhahlamba');

  return [...variants];
}

async function findRelation(searchNames: string[], bbox?: [number, number, number, number]): Promise<{ relId: number; name: string } | null> {
  const bboxStr = bbox ? `(${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]})` : '';

  for (const searchName of searchNames) {
    const query = `[out:json][timeout:60];
      (
        rel["route"="hiking"]["name"~"${searchName}",i]${bboxStr};
        rel["route"="foot"]["name"~"${searchName}",i]${bboxStr};
      );
      out tags;`;

    try {
      const data = await overpassQuery(query);
      const rels = (data.elements || []).filter((e: any) => e.type === 'relation');

      if (rels.length > 0) {
        const exact = rels.find((r: any) =>
          r.tags?.name?.toLowerCase().includes(searchName.toLowerCase().replace(/\\/g, ''))
        );
        const best = exact || rels[0];
        console.log(`  Found relation: ${best.id} "${best.tags?.name}" (matched "${searchName.replace(/\\/g, '')}")`);
        return { relId: best.id, name: best.tags?.name || searchName };
      }
    } catch (err: any) {
      console.log(`  Search error for "${searchName}": ${err.message}`);
    }
    await sleep(2000);
  }

  return null;
}

// --- Fallback: fetch as standalone ways ---

async function fetchAsWays(searchName: string, bbox?: [number, number, number, number]): Promise<[number, number][] | null> {
  const bboxStr = bbox ? `(${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]})` : '';
  const escaped = escapeRegex(searchName);

  const query = `[out:json][timeout:60];
    (
      way["highway"~"path|track|footway|steps|bridleway"]["name"~"${escaped}",i]${bboxStr};
      way["highway"~"path|track|footway|steps|bridleway"]["alt_name"~"${escaped}",i]${bboxStr};
    );
    out body;>;out skel qt;`;

  const data = await overpassQuery(query);
  // Two-pass: collect nodes first
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
  return chained.length >= 10 ? chained : null;
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

// --- Fetch a single trail ---

async function fetchSingleTrail(input: TrailInput): Promise<{
  id: string;
  name: string;
  region: string;
  country: string;
  distance_km: number;
  typical_days: string;
  coordinates: [number, number, number][];
  dataSource: string;
  calculatedKm: number;
} | null> {
  const variants = searchVariants(input.searchName, input.name);
  console.log(`  Search variants: ${variants.map(v => v.replace(/\\/g, '')).join(' | ')}`);

  // Step 1: Find the relation
  const rel = await findRelation(variants, input.bbox);
  await sleep(3000);

  let coords2d: [number, number][] | null = null;
  let source = 'osm_overpass_ordered';

  if (rel) {
    coords2d = await extractMainRoute(rel.relId);
    await sleep(3000);
  }

  // Step 2: Fallback to standalone ways
  if (!coords2d || coords2d.length < 10) {
    console.log(`  Trying standalone ways...`);
    let bestWays: [number, number][] | null = null;
    let bestOff = Infinity;

    for (const variant of variants) {
      const result = await fetchAsWays(variant, input.bbox);
      if (result && result.length >= 10) {
        const km = totalDistance(result);
        const off = Math.abs(km - input.officialDistanceKm) / input.officialDistanceKm * 100;
        if (off < bestOff) {
          bestWays = result;
          bestOff = off;
        }
      }
      await sleep(2000);
    }

    if (bestWays) {
      coords2d = bestWays;
      source = 'osm_ways';
    }
    await sleep(3000);
  }

  if (!coords2d || coords2d.length < 10) {
    return null;
  }

  // Verify coordinates are in South Africa (lat between -35 and -22, lon between 16 and 33)
  const midIdx = Math.floor(coords2d.length / 2);
  const midLat = coords2d[midIdx][1];
  const midLon = coords2d[midIdx][0];
  if (midLat < -35 || midLat > -22 || midLon < 16 || midLon > 33) {
    console.log(`  WARNING: Coordinates not in South Africa (${midLat.toFixed(2)}, ${midLon.toFixed(2)}) — skipping`);
    return null;
  }

  const rawKm = totalDistance(coords2d);
  console.log(`  Raw: ${coords2d.length} pts, ${rawKm.toFixed(1)} km`);

  // Step 3: Auto-detect out-and-back (calc ≈ official/2)
  const halfOff = Math.abs(rawKm - input.officialDistanceKm / 2) / (input.officialDistanceKm / 2) * 100;
  if (halfOff < 15) {
    console.log(`  Detected out-and-back (${rawKm.toFixed(1)}km ≈ ${(input.officialDistanceKm / 2).toFixed(1)}km). Mirroring...`);
    const reversed = [...coords2d].reverse().slice(1);
    coords2d = [...coords2d, ...reversed];
    source += '_mirrored';
  }

  // Step 4: Elevation enrichment
  console.log(`  Enriching elevation (${coords2d.length} pts, ~${Math.ceil(coords2d.length / 100)} batches)...`);
  const coords3d = await enrichElevation(coords2d);

  const elevations = coords3d.map(c => c[2]).filter(e => e !== 0);
  if (elevations.length > 0) {
    console.log(`  Elevation: ${safeMin(elevations)}m — ${safeMax(elevations)}m`);
  }

  return {
    id: toId(input.name),
    name: input.name,
    region: input.region,
    country: input.country,
    distance_km: input.officialDistanceKm,
    typical_days: String(input.typicalDays),
    coordinates: coords3d,
    dataSource: source,
    calculatedKm: totalDistance(coords3d),
  };
}

// --- Main ---

async function main() {
  const resume = process.argv.includes('--resume');

  const trails: TrailInput[] = JSON.parse(
    readFileSync(join(process.cwd(), 'scripts', 'trail-curation', 'trail-lists', 'south-africa-trails.json'), 'utf-8')
  );

  const resultsDir = join(process.cwd(), 'scripts', 'trail-curation', 'results');
  mkdirSync(resultsDir, { recursive: true });

  const trailDataDir = join(process.cwd(), 'public', 'trail-data');
  mkdirSync(trailDataDir, { recursive: true });

  console.log(`=== FETCH SOUTH AFRICA TRAILS ===`);
  console.log(`Total in list: ${trails.length}`);
  if (resume) console.log(`Resume mode: skipping trails with existing data files`);
  console.log();

  const results: any[] = [];
  const failures: string[] = [];
  const skipped: string[] = [];

  for (let i = 0; i < trails.length; i++) {
    const trail = trails[i];
    const trailId = toId(trail.name);
    const trailFile = join(trailDataDir, `${trailId}.json`);

    if (resume && existsSync(trailFile)) {
      skipped.push(trail.name);
      console.log(`[${i + 1}/${trails.length}] SKIP ${trail.name} (exists)`);
      continue;
    }

    console.log(`\n[${i + 1}/${trails.length}] ${trail.name} (${trail.officialDistanceKm}km, ${trail.region})`);

    try {
      const result = await fetchSingleTrail(trail);
      if (result) {
        // Write individual trail file (compact JSON)
        writeFileSync(trailFile, JSON.stringify(result));

        const pctOff = Math.abs(result.calculatedKm - trail.officialDistanceKm) / trail.officialDistanceKm * 100;
        const status = pctOff <= 5 ? 'OK' : pctOff <= 25 ? 'FAIR' : 'HIGH';
        console.log(`  SUCCESS: ${status} | ${result.coordinates.length} pts, ${result.calculatedKm.toFixed(1)}km (${pctOff.toFixed(1)}% off) [${result.dataSource}]`);
        results.push({ id: trailId, name: trail.name, calcKm: result.calculatedKm, pts: result.coordinates.length, source: result.dataSource, off: pctOff, status });
      } else {
        failures.push(trail.name);
        console.log(`  FAILED: no data found`);
      }
    } catch (err: any) {
      failures.push(trail.name);
      console.log(`  ERROR: ${err.message}`);
    }

    // Save progress
    writeFileSync(
      join(resultsDir, 'sa-batch-progress.json'),
      JSON.stringify({ results, failures, skipped, lastIndex: i, timestamp: new Date().toISOString() }, null, 2)
    );

    await sleep(5000);
  }

  // Update manifest
  const manifestPath = join(trailDataDir, 'manifest.json');
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf-8')) : [];

  for (const r of results) {
    const trailFile = join(trailDataDir, `${r.id}.json`);
    if (!existsSync(trailFile)) continue;
    const trailData = JSON.parse(readFileSync(trailFile, 'utf-8'));
    const coords = trailData.coordinates || [];
    const elevs = coords.map((c: number[]) => c[2]).filter((e: number) => e !== 0);

    const existingIdx = manifest.findIndex((m: any) => m.id === r.id);
    if (existingIdx >= 0) manifest.splice(existingIdx, 1);

    manifest.push({
      id: r.id,
      name: r.name,
      region: trailData.region,
      country: 'ZA',
      distance_km: trailData.distance_km,
      typical_days: trailData.typical_days,
      pointCount: coords.length,
      dataSource: trailData.dataSource,
      calculatedKm: r.calcKm,
      ...(elevs.length > 0 ? { elevationLow: safeMin(elevs), elevationHigh: safeMax(elevs) } : {}),
    });
  }

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // Summary
  console.log(`\n=== SUMMARY ===`);
  console.log(`Succeeded: ${results.length}`);
  console.log(`Failed: ${failures.length}${failures.length > 0 ? ' — ' + failures.join(', ') : ''}`);
  console.log(`Skipped: ${skipped.length}`);
  console.log(`Manifest: ${manifest.length} total trails`);

  if (results.length > 0) {
    console.log(`\n| Status | Trail | Calc | Official | Off% | Pts | Source |`);
    console.log(`|--------|-------|------|----------|------|-----|--------|`);
    for (const r of results) {
      const trail = trails.find(t => toId(t.name) === r.id);
      console.log(`| ${r.status} | ${r.name} | ${r.calcKm.toFixed(1)}km | ${trail?.officialDistanceKm}km | ${r.off.toFixed(1)}% | ${r.pts} | ${r.source} |`);
    }
  }
}

main().catch(console.error);
