// Second retry - use Waymarked Trails API and alternative Overpass mirror
// Usage: npx tsx scripts/trail-curation/retry2-au-phase13.ts

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const WAYMARKED_API = 'https://hiking.waymarkedtrails.org/api/v1';
const TOPO_API = 'https://api.opentopodata.org/v1/srtm30m';
// Use alternative Overpass server
const OVERPASS_API = 'https://overpass.kumi.systems/api/interpreter';

interface RetryTrail {
  name: string;
  id: string;
  region: string;
  country: string;
  officialDistanceKm: number;
  typicalDays: string;
  waymarkedSearches: string[];
  overpassQueries: string[];
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

async function sleep(ms: number) { await new Promise(r => setTimeout(r, ms)); }

async function fetchWaymarked(searchName: string): Promise<{ coords: [number, number][]; source: string } | null> {
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

    return coords.length >= 5 ? { coords, source: 'waymarked_trails' } : null;
  } catch (err) {
    console.log(`    Waymarked error: ${err}`);
    return null;
  }
}

async function queryOverpass(query: string): Promise<{ coords: [number, number][]; source: string } | null> {
  try {
    const res = await fetch(OVERPASS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!res.ok) {
      console.log(`    Overpass mirror: HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    const elements = data.elements || [];
    const nodes = elements.filter((e: any) => e.type === 'node');
    const ways = elements.filter((e: any) => e.type === 'way');

    if (ways.length === 0) return null;

    const nodeMap = new Map<number, { lat: number; lon: number }>();
    for (const n of nodes) {
      if (n.lat !== undefined) nodeMap.set(n.id, { lat: n.lat, lon: n.lon });
    }

    const coords: [number, number][] = [];
    for (const way of ways) {
      for (const nid of (way.nodes || [])) {
        const n = nodeMap.get(nid);
        if (n) coords.push([n.lon, n.lat]);
      }
    }

    console.log(`    Overpass mirror: ${ways.length} ways, ${coords.length} pts`);
    return coords.length >= 5 ? { coords, source: 'osm_overpass' } : null;
  } catch (err) {
    console.log(`    Overpass mirror error: ${err}`);
    return null;
  }
}

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
    await sleep(1100);
  }
  return result;
}

const failedTrails: RetryTrail[] = [
  {
    name: 'Mt Feathertop',
    id: 'mt_feathertop',
    region: 'Alpine NP, VIC',
    country: 'AU',
    officialDistanceKm: 22,
    typicalDays: '1-2',
    waymarkedSearches: ['Bungalow Spur', 'Mount Feathertop', 'Razorback Feathertop'],
    overpassQueries: [
      `[out:json][timeout:90];way["highway"~"path|track|footway"]["name"~"Bungalow Spur|Feathertop",i](-37.00,147.10,-36.85,147.22);out body;>;out skel qt;`,
    ]
  },
  {
    name: 'Grand Canyon Track',
    id: 'grand_canyon_track',
    region: 'Blue Mountains, NSW',
    country: 'AU',
    officialDistanceKm: 6,
    typicalDays: '1',
    waymarkedSearches: ['Grand Canyon Track Blackheath', 'Grand Canyon Walk Blue Mountains'],
    overpassQueries: [
      `[out:json][timeout:90];way["highway"~"path|track|footway|steps"]["name"~"Grand Canyon",i](-33.72,150.30,-33.66,150.38);out body;>;out skel qt;`,
    ]
  },
  {
    name: 'Whitsunday Ngaro Sea Trail',
    id: 'whitsunday_ngaro_sea_trail',
    region: 'Whitsundays, QLD',
    country: 'AU',
    officialDistanceKm: 14,
    typicalDays: '2-3',
    waymarkedSearches: ['Ngaro Sea Trail', 'Whitsunday Walk'],
    overpassQueries: [
      `[out:json][timeout:90];way["highway"~"path|track|footway"](-20.28,148.82,-20.20,148.95);out body;>;out skel qt;`,
    ]
  },
  {
    name: 'Mt Magog',
    id: 'mt_magog',
    region: 'Stirling Range, WA',
    country: 'AU',
    officialDistanceKm: 4,
    typicalDays: '1',
    waymarkedSearches: ['Mount Magog', 'Magog Stirling'],
    overpassQueries: [
      `[out:json][timeout:90];way["highway"~"path|track|footway"](-34.385,118.075,-34.370,118.095);out body;>;out skel qt;`,
    ]
  },
  {
    name: 'Mt Talyuberlup',
    id: 'mt_talyuberlup',
    region: 'Stirling Range, WA',
    country: 'AU',
    officialDistanceKm: 3,
    typicalDays: '1',
    waymarkedSearches: ['Talyuberlup', 'Mount Talyuberlup'],
    overpassQueries: [
      `[out:json][timeout:90];way["highway"~"path|track|footway"](-34.385,118.020,-34.370,118.045);out body;>;out skel qt;`,
    ]
  },
  {
    name: 'Stirling Ridge Walk',
    id: 'stirling_ridge_walk',
    region: 'Stirling Range, WA',
    country: 'AU',
    officialDistanceKm: 12,
    typicalDays: '1-2',
    waymarkedSearches: ['Stirling Ridge Walk', 'Stirling Range Ridge'],
    overpassQueries: [
      `[out:json][timeout:90];relation["route"="hiking"]["name"~"Stirling",i](-34.42,117.90,-34.34,118.30);out body;>;out skel qt;`,
    ]
  },
  {
    name: 'Hakea Trail',
    id: 'hakea_trail',
    region: 'Stirling Range, WA',
    country: 'AU',
    officialDistanceKm: 8,
    typicalDays: '1',
    waymarkedSearches: ['Hakea Trail Stirling', 'Hakea Walk'],
    overpassQueries: [
      `[out:json][timeout:90];way["highway"~"path|track|footway"]["name"~"Hakea",i](-34.42,118.00,-34.36,118.10);out body;>;out skel qt;`,
    ]
  },
  {
    name: 'Nancy Peak and Devils Slide',
    id: 'nancy_peak_and_devils_slide',
    region: 'Porongurup Range, WA',
    country: 'AU',
    officialDistanceKm: 5,
    typicalDays: '1',
    waymarkedSearches: ['Nancy Peak', 'Devils Slide Porongurup'],
    overpassQueries: [
      `[out:json][timeout:90];way["highway"~"path|track|footway"](-34.695,117.870,-34.670,117.905);out body;>;out skel qt;`,
    ]
  },
  {
    name: 'Castle Rock Granite Skywalk',
    id: 'castle_rock_granite_skywalk',
    region: 'Porongurup Range, WA',
    country: 'AU',
    officialDistanceKm: 4,
    typicalDays: '1',
    waymarkedSearches: ['Castle Rock Porongurup', 'Granite Skywalk'],
    overpassQueries: [
      `[out:json][timeout:90];way["highway"~"path|track|footway"](-34.695,117.875,-34.670,117.900);out body;>;out skel qt;`,
    ]
  },
  {
    name: 'Tree in the Rock',
    id: 'tree_in_the_rock',
    region: 'Porongurup Range, WA',
    country: 'AU',
    officialDistanceKm: 3,
    typicalDays: '1',
    waymarkedSearches: ['Tree in the Rock Porongurup'],
    overpassQueries: [
      `[out:json][timeout:90];way["highway"~"path|track|footway"](-34.695,117.855,-34.672,117.885);out body;>;out skel qt;`,
    ]
  }
];

async function main() {
  const trailDataDir = join(process.cwd(), 'public', 'trail-data');
  const resultsDir = join(process.cwd(), 'scripts', 'trail-curation', 'results');
  mkdirSync(resultsDir, { recursive: true });

  console.log(`=== RETRY #2: WAYMARKED + OVERPASS MIRROR ===`);
  console.log(`${failedTrails.length} trails to retry\n`);

  const successes: string[] = [];
  const failures: string[] = [];

  for (let i = 0; i < failedTrails.length; i++) {
    const trail = failedTrails[i];
    console.log(`\n[${i + 1}/${failedTrails.length}] ${trail.name} (${trail.officialDistanceKm}km)`);

    const targetPath = join(trailDataDir, `${trail.id}.json`);
    if (existsSync(targetPath)) {
      console.log(`  SKIP: already exists`);
      successes.push(trail.name);
      continue;
    }

    let result: { coords: [number, number][]; source: string } | null = null;

    // Try Waymarked Trails first
    for (const search of trail.waymarkedSearches) {
      console.log(`  Waymarked: "${search}"...`);
      result = await fetchWaymarked(search);
      if (result) break;
      await sleep(1500);
    }

    // Try Overpass mirror
    if (!result) {
      for (const query of trail.overpassQueries) {
        console.log(`  Overpass mirror...`);
        result = await queryOverpass(query);
        if (result) break;
        await sleep(5000);
      }
    }

    if (result) {
      const km = totalDistance(result.coords);
      console.log(`  Found: ${result.coords.length} pts, ${km.toFixed(1)} km [${result.source}]`);

      console.log(`  Enriching elevation...`);
      const coords3d = await enrichElevation(result.coords);
      const elevations = coords3d.map(c => c[2]);
      console.log(`  Elevation: ${Math.min(...elevations)}m - ${Math.max(...elevations)}m`);

      writeFileSync(targetPath, JSON.stringify({
        id: trail.id,
        name: trail.name,
        region: trail.region,
        country: trail.country,
        distance_km: trail.officialDistanceKm,
        typical_days: trail.typicalDays,
        coordinates: coords3d,
        dataSource: result.source,
        calculatedKm: km,
      }));
      console.log(`  SUCCESS`);
      successes.push(trail.name);
    } else {
      failures.push(trail.name);
      console.log(`  FAILED`);
    }

    writeFileSync(
      join(resultsDir, 'au-phase13-retry2-progress.json'),
      JSON.stringify({ successes, failures, lastIndex: i }, null, 2)
    );

    await sleep(3000);
  }

  console.log(`\n=== RESULTS ===`);
  console.log(`Success: ${successes.length}`);
  console.log(`Failed: ${failures.length}`);
  if (failures.length > 0) console.log(`Still failed: ${failures.join(', ')}`);
}

main().catch(console.error);
