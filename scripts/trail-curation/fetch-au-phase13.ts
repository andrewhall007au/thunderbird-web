// Fetch new Australian trails for Phase 13 (AU Launch)
// Handles: Stirling Range, Porongurup, Alpine VIC, NSW, QLD, SA
// Sources: Waymarked Trails → OSM Overpass → OSM Ways (for summit tracks)
// Usage: npx tsx scripts/trail-curation/fetch-au-phase13.ts

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const WAYMARKED_API = 'https://hiking.waymarkedtrails.org/api/v1';
const TOPO_API = 'https://api.opentopodata.org/v1/srtm30m';
const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

interface TrailInput {
  name: string;
  searchName: string;
  altSearchNames?: string[];
  region: string;
  country: string;
  officialDistanceKm: number;
  typicalDays: string;
  bbox?: [number, number, number, number];
  source?: string;
  existingJson?: string;
}

interface TrailResult {
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

function mercatorToWgs84(x: number, y: number): [number, number] {
  const lng = (x / 20037508.34) * 180;
  let lat = (y / 20037508.34) * 180;
  lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
  return [lng, lat];
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function totalDistance(coords: [number, number][]): number {
  let d = 0;
  for (let i = 1; i < coords.length; i++) {
    d += haversine(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
  }
  return d;
}

function toId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

async function sleep(ms: number) {
  await new Promise(r => setTimeout(r, ms));
}

// Source 1: Waymarked Trails
async function fetchFromWaymarked(searchName: string): Promise<{ coords: [number, number][]; source: string } | null> {
  try {
    const searchUrl = `${WAYMARKED_API}/list/search?query=${encodeURIComponent(searchName)}&limit=5`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const results = searchData.results || [];
    if (results.length === 0) return null;

    const best = results[0];
    console.log(`    Waymarked: "${best.name}" (${best.id})`);
    await sleep(500);

    const geoUrl = `${WAYMARKED_API}/details/${best.id}/geometry/geojson`;
    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) return null;
    const geoData = await geoRes.json();

    const coords: [number, number][] = [];
    if (geoData.type === 'FeatureCollection') {
      for (const feature of geoData.features || []) {
        const geom = feature.geometry;
        if (geom.type === 'LineString') {
          for (const c of geom.coordinates) coords.push(mercatorToWgs84(c[0], c[1]));
        } else if (geom.type === 'MultiLineString') {
          for (const line of geom.coordinates) {
            for (const c of line) coords.push(mercatorToWgs84(c[0], c[1]));
          }
        }
      }
    }

    return coords.length >= 10 ? { coords, source: 'waymarked_trails' } : null;
  } catch (err) {
    console.log(`    Waymarked error: ${err}`);
    return null;
  }
}

// Source 2: OSM Overpass (hiking route relations)
async function fetchFromOverpass(searchName: string, bbox?: [number, number, number, number]): Promise<{ coords: [number, number][]; source: string } | null> {
  try {
    const bboxFilter = bbox ? `(${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]})` : '';
    const query = `[out:json][timeout:60];
      relation["route"="hiking"]["name"~"${searchName}",i]${bboxFilter};
      out body;
      >>;
      out skel qt;`;

    const res = await fetch(OVERPASS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!res.ok) { console.log(`    Overpass: HTTP ${res.status}`); return null; }

    const data = await res.json();
    const elements = data.elements || [];
    const nodes = elements.filter((e: any) => e.type === 'node');
    const ways = elements.filter((e: any) => e.type === 'way');

    if (ways.length === 0) return null;

    const nodeMap = new Map<number, { lat: number; lon: number }>();
    for (const n of nodes) nodeMap.set(n.id, { lat: n.lat, lon: n.lon });

    const coords: [number, number][] = [];
    for (const way of ways) {
      for (const nid of (way.nodes || [])) {
        const n = nodeMap.get(nid);
        if (n) coords.push([n.lon, n.lat]);
      }
    }

    console.log(`    Overpass relations: ${ways.length} ways, ${coords.length} points`);
    return coords.length >= 10 ? { coords, source: 'osm_overpass' } : null;
  } catch (err) {
    console.log(`    Overpass error: ${err}`);
    return null;
  }
}

// Source 3: OSM Overpass (individual ways — for summit tracks not in route relations)
async function fetchFromOverpassWays(searchName: string, bbox?: [number, number, number, number]): Promise<{ coords: [number, number][]; source: string } | null> {
  try {
    const bboxFilter = bbox ? `(${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]})` : '';
    const query = `[out:json][timeout:60];
      way["highway"~"path|track|footway"]["name"~"${searchName}",i]${bboxFilter};
      out body;
      >>;
      out skel qt;`;

    const res = await fetch(OVERPASS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!res.ok) { console.log(`    Overpass ways: HTTP ${res.status}`); return null; }

    const data = await res.json();
    const elements = data.elements || [];
    const nodes = elements.filter((e: any) => e.type === 'node');
    const ways = elements.filter((e: any) => e.type === 'way');

    if (ways.length === 0) return null;

    const nodeMap = new Map<number, { lat: number; lon: number }>();
    for (const n of nodes) nodeMap.set(n.id, { lat: n.lat, lon: n.lon });

    const coords: [number, number][] = [];
    for (const way of ways) {
      for (const nid of (way.nodes || [])) {
        const n = nodeMap.get(nid);
        if (n) coords.push([n.lon, n.lat]);
      }
    }

    console.log(`    Overpass ways: ${ways.length} ways, ${coords.length} points`);
    return coords.length >= 10 ? { coords, source: 'osm_ways' } : null;
  } catch (err) {
    console.log(`    Overpass ways error: ${err}`);
    return null;
  }
}

// Elevation enrichment via SRTM 30m
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

async function fetchSingleTrail(input: TrailInput): Promise<TrailResult | null> {
  const searchTerms = input.searchName.split('|');
  const altNames = input.altSearchNames || [];
  const allNames = [...searchTerms, ...altNames];

  // Try Waymarked Trails first
  for (const name of allNames) {
    console.log(`  Trying Waymarked: "${name}"...`);
    const result = await fetchFromWaymarked(name);
    if (result) {
      const km = totalDistance(result.coords);
      console.log(`    Found: ${result.coords.length} pts, ${km.toFixed(1)} km`);

      console.log(`    Enriching elevation (${result.coords.length} pts)...`);
      const coords3d = await enrichElevation(result.coords);
      const elevations = coords3d.map(c => c[2]);
      console.log(`    Elevation: ${Math.min(...elevations)}m — ${Math.max(...elevations)}m`);

      return {
        id: toId(input.name),
        name: input.name,
        region: input.region,
        country: input.country,
        distance_km: input.officialDistanceKm,
        typical_days: input.typicalDays,
        coordinates: coords3d,
        dataSource: result.source,
        calculatedKm: km,
      };
    }
    await sleep(1000);
  }

  // Try OSM Overpass relations
  for (const name of allNames) {
    console.log(`  Trying Overpass relations: "${name}"...`);
    const result = await fetchFromOverpass(name, input.bbox);
    if (result) {
      const km = totalDistance(result.coords);
      console.log(`    Found: ${result.coords.length} pts, ${km.toFixed(1)} km`);

      console.log(`    Enriching elevation (${result.coords.length} pts)...`);
      const coords3d = await enrichElevation(result.coords);
      const elevations = coords3d.map(c => c[2]);
      console.log(`    Elevation: ${Math.min(...elevations)}m — ${Math.max(...elevations)}m`);

      return {
        id: toId(input.name),
        name: input.name,
        region: input.region,
        country: input.country,
        distance_km: input.officialDistanceKm,
        typical_days: input.typicalDays,
        coordinates: coords3d,
        dataSource: result.source,
        calculatedKm: km,
      };
    }
    await sleep(2000);
  }

  // Try OSM Overpass individual ways (for summit tracks)
  for (const name of allNames) {
    console.log(`  Trying Overpass ways: "${name}"...`);
    const result = await fetchFromOverpassWays(name, input.bbox);
    if (result) {
      const km = totalDistance(result.coords);
      console.log(`    Found: ${result.coords.length} pts, ${km.toFixed(1)} km`);

      console.log(`    Enriching elevation (${result.coords.length} pts)...`);
      const coords3d = await enrichElevation(result.coords);
      const elevations = coords3d.map(c => c[2]);
      console.log(`    Elevation: ${Math.min(...elevations)}m — ${Math.max(...elevations)}m`);

      return {
        id: toId(input.name),
        name: input.name,
        region: input.region,
        country: input.country,
        distance_km: input.officialDistanceKm,
        typical_days: input.typicalDays,
        coordinates: coords3d,
        dataSource: result.source,
        calculatedKm: km,
      };
    }
    await sleep(2000);
  }

  return null;
}

async function main() {
  const trails: TrailInput[] = JSON.parse(
    readFileSync(join(process.cwd(), 'scripts', 'trail-curation', 'trail-lists', 'australia-phase13-new.json'), 'utf-8')
  );

  const trailDataDir = join(process.cwd(), 'public', 'trail-data');
  mkdirSync(trailDataDir, { recursive: true });

  const resultsDir = join(process.cwd(), 'scripts', 'trail-curation', 'results');
  mkdirSync(resultsDir, { recursive: true });

  console.log(`=== FETCH AUSTRALIA PHASE 13 TRAILS ===`);
  console.log(`${trails.length} trails to process\n`);

  const results: TrailResult[] = [];
  const skipped: string[] = [];
  const failures: string[] = [];

  for (let i = 0; i < trails.length; i++) {
    const trail = trails[i];
    console.log(`\n[${i + 1}/${trails.length}] ${trail.name} (${trail.officialDistanceKm}km, ${trail.region})`);

    // Skip trails that already have JSON files
    if (trail.existingJson) {
      const jsonPath = join(trailDataDir, `${trail.existingJson}.json`);
      if (existsSync(jsonPath)) {
        console.log(`  SKIP: existing data at ${trail.existingJson}.json`);
        skipped.push(trail.name);
        continue;
      }
    }

    // Also skip if we already generated the file
    const targetPath = join(trailDataDir, `${toId(trail.name)}.json`);
    if (existsSync(targetPath)) {
      console.log(`  SKIP: already exists at ${toId(trail.name)}.json`);
      skipped.push(trail.name);
      continue;
    }

    const result = await fetchSingleTrail(trail);
    if (result) {
      results.push(result);
      writeFileSync(join(trailDataDir, `${result.id}.json`), JSON.stringify(result));
      console.log(`  SUCCESS: ${result.coordinates.length} pts, ${result.calculatedKm.toFixed(1)} km [${result.dataSource}]`);
    } else {
      failures.push(trail.name);
      console.log(`  FAILED: no data found`);
    }

    // Save progress
    writeFileSync(
      join(resultsDir, 'au-phase13-progress.json'),
      JSON.stringify({ results: results.map(r => r.name), skipped, failures, lastIndex: i }, null, 2)
    );
  }

  console.log(`\n=== RESULTS ===`);
  console.log(`Success: ${results.length}`);
  console.log(`Skipped (existing): ${skipped.length}`);
  console.log(`Failed: ${failures.length}`);
  if (failures.length > 0) console.log(`Failed trails: ${failures.join(', ')}`);
}

main().catch(console.error);
