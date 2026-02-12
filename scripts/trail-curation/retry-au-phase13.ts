// Retry failed Australian trails from Phase 13 fetch
// Strategy: longer delays, bbox-only searches (no name filter), alternative name patterns
// Usage: npx tsx scripts/trail-curation/retry-au-phase13.ts

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const TOPO_API = 'https://api.opentopodata.org/v1/srtm30m';
const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

interface RetryTrail {
  name: string;
  id: string;
  region: string;
  country: string;
  officialDistanceKm: number;
  typicalDays: string;
  queries: string[]; // Overpass queries to try in order
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

async function queryOverpass(query: string): Promise<{ coords: [number, number][]; source: string } | null> {
  try {
    const res = await fetch(OVERPASS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!res.ok) {
      console.log(`    Overpass: HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    const elements = data.elements || [];
    const nodes = elements.filter((e: any) => e.type === 'node');
    const ways = elements.filter((e: any) => e.type === 'way');

    if (ways.length === 0 && nodes.length === 0) return null;

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

    console.log(`    Overpass: ${ways.length} ways, ${coords.length} points`);
    return coords.length >= 5 ? { coords, source: 'osm_overpass' } : null;
  } catch (err) {
    console.log(`    Overpass error: ${err}`);
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

// Define retry strategies per trail — use bbox-based searches, different name patterns, etc.
const failedTrails: RetryTrail[] = [
  {
    name: 'Mt Magog',
    id: 'mt_magog',
    region: 'Stirling Range, WA',
    country: 'AU',
    officialDistanceKm: 4,
    typicalDays: '1',
    queries: [
      // Try ways named Magog in Stirling Range bbox
      `[out:json][timeout:60];way["highway"~"path|track|footway"]["name"~"Magog",i](-34.40,118.06,-34.36,118.12);out body;>;out skel qt;`,
      // Try any hiking path in narrow bbox around Mt Magog summit
      `[out:json][timeout:60];way["highway"~"path|track|footway"](-34.385,118.075,-34.370,118.095);out body;>;out skel qt;`,
    ]
  },
  {
    name: 'Mt Talyuberlup',
    id: 'mt_talyuberlup',
    region: 'Stirling Range, WA',
    country: 'AU',
    officialDistanceKm: 3,
    typicalDays: '1',
    queries: [
      `[out:json][timeout:60];way["highway"~"path|track|footway"]["name"~"Talyuberlup",i](-34.40,118.00,-34.36,118.06);out body;>;out skel qt;`,
      // Any path near the summit
      `[out:json][timeout:60];way["highway"~"path|track|footway"](-34.385,118.020,-34.370,118.045);out body;>;out skel qt;`,
    ]
  },
  {
    name: 'Stirling Ridge Walk',
    id: 'stirling_ridge_walk',
    region: 'Stirling Range, WA',
    country: 'AU',
    officialDistanceKm: 12,
    typicalDays: '1-2',
    queries: [
      // Route relation
      `[out:json][timeout:60];relation["route"="hiking"]["name"~"Stirling",i](-34.42,117.90,-34.34,118.30);out body;>;out skel qt;`,
      // Named ways
      `[out:json][timeout:60];way["highway"~"path|track|footway"]["name"~"Stirling Ridge",i](-34.42,117.90,-34.34,118.30);out body;>;out skel qt;`,
    ]
  },
  {
    name: 'Hakea Trail',
    id: 'hakea_trail',
    region: 'Stirling Range, WA',
    country: 'AU',
    officialDistanceKm: 8,
    typicalDays: '1',
    queries: [
      `[out:json][timeout:60];way["highway"~"path|track|footway"]["name"~"Hakea",i](-34.42,118.00,-34.36,118.10);out body;>;out skel qt;`,
      `[out:json][timeout:60];relation["route"="hiking"]["name"~"Hakea",i](-34.42,118.00,-34.36,118.10);out body;>;out skel qt;`,
    ]
  },
  {
    name: 'Nancy Peak and Devils Slide',
    id: 'nancy_peak_and_devils_slide',
    region: 'Porongurup Range, WA',
    country: 'AU',
    officialDistanceKm: 5,
    typicalDays: '1',
    queries: [
      `[out:json][timeout:60];way["highway"~"path|track|footway"]["name"~"Nancy|Devil",i](-34.70,117.86,-34.66,117.92);out body;>;out skel qt;`,
      // All paths in Porongurup
      `[out:json][timeout:60];way["highway"~"path|track|footway"](-34.695,117.870,-34.670,117.905);out body;>;out skel qt;`,
    ]
  },
  {
    name: 'Castle Rock Granite Skywalk',
    id: 'castle_rock_granite_skywalk',
    region: 'Porongurup Range, WA',
    country: 'AU',
    officialDistanceKm: 4,
    typicalDays: '1',
    queries: [
      `[out:json][timeout:60];way["highway"~"path|track|footway"]["name"~"Castle Rock|Granite Skywalk",i](-34.70,117.86,-34.66,117.92);out body;>;out skel qt;`,
      // All paths in Porongurup near Castle Rock
      `[out:json][timeout:60];way["highway"~"path|track|footway"](-34.695,117.875,-34.670,117.900);out body;>;out skel qt;`,
    ]
  },
  {
    name: 'Tree in the Rock',
    id: 'tree_in_the_rock',
    region: 'Porongurup Range, WA',
    country: 'AU',
    officialDistanceKm: 3,
    typicalDays: '1',
    queries: [
      `[out:json][timeout:60];way["highway"~"path|track|footway"]["name"~"Tree in the Rock|Tree in Rock",i](-34.70,117.84,-34.66,117.90);out body;>;out skel qt;`,
      `[out:json][timeout:60];way["highway"~"path|track|footway"](-34.695,117.855,-34.672,117.885);out body;>;out skel qt;`,
    ]
  },
  {
    name: 'Mt Feathertop',
    id: 'mt_feathertop',
    region: 'Alpine NP, VIC',
    country: 'AU',
    officialDistanceKm: 22,
    typicalDays: '1-2',
    queries: [
      // Route relation with broader search
      `[out:json][timeout:90];relation["route"="hiking"]["name"~"Feathertop|Bungalow Spur",i](-37.00,147.10,-36.85,147.22);out body;>;out skel qt;`,
      // Bungalow Spur is the main trail to Feathertop
      `[out:json][timeout:90];way["highway"~"path|track|footway"]["name"~"Bungalow Spur|Feathertop",i](-37.00,147.10,-36.85,147.22);out body;>;out skel qt;`,
      // Any paths on Feathertop
      `[out:json][timeout:90];way["highway"~"path|track|footway"](-36.93,147.13,-36.88,147.18);out body;>;out skel qt;`,
    ]
  },
  {
    name: 'Royal Coast Track',
    id: 'royal_coast_track',
    region: 'Royal NP, NSW',
    country: 'AU',
    officialDistanceKm: 26,
    typicalDays: '2',
    queries: [
      `[out:json][timeout:90];relation["route"="hiking"]["name"~"Coast Track|Royal Coast",i](-34.20,151.04,-34.06,151.16);out body;>;out skel qt;`,
      `[out:json][timeout:90];way["highway"~"path|track|footway"]["name"~"Coast Track",i](-34.20,151.04,-34.06,151.16);out body;>;out skel qt;`,
    ]
  },
  {
    name: 'Blue Gum Forest Walk',
    id: 'blue_gum_forest_walk',
    region: 'Blue Mountains, NSW',
    country: 'AU',
    officialDistanceKm: 14,
    typicalDays: '1',
    queries: [
      `[out:json][timeout:90];relation["route"="hiking"]["name"~"Blue Gum|Grose Valley",i](-33.68,150.28,-33.58,150.38);out body;>;out skel qt;`,
      `[out:json][timeout:90];way["highway"~"path|track|footway"]["name"~"Blue Gum|Grand Canyon|Grose",i](-33.68,150.28,-33.58,150.38);out body;>;out skel qt;`,
    ]
  },
  {
    name: 'Grand Canyon Track',
    id: 'grand_canyon_track',
    region: 'Blue Mountains, NSW',
    country: 'AU',
    officialDistanceKm: 6,
    typicalDays: '1',
    queries: [
      // Be specific - "Grand Canyon" in Blue Mountains bbox only
      `[out:json][timeout:90];way["highway"~"path|track|footway|steps"]["name"~"Grand Canyon",i](-33.72,150.30,-33.66,150.38);out body;>;out skel qt;`,
      `[out:json][timeout:90];relation["route"="hiking"]["name"~"Grand Canyon",i](-33.72,150.30,-33.66,150.38);out body;>;out skel qt;`,
    ]
  },
  {
    name: 'Fraser Island Great Walk',
    id: 'fraser_island_great_walk',
    region: 'Fraser Island, QLD',
    country: 'AU',
    officialDistanceKm: 90,
    typicalDays: '6-8',
    queries: [
      `[out:json][timeout:90];relation["route"="hiking"]["name"~"Great Walk|K.gari",i](-25.50,153.00,-24.90,153.20);out body;>;out skel qt;`,
      `[out:json][timeout:90];way["highway"~"path|track|footway"]["name"~"Great Walk",i](-25.50,153.00,-24.90,153.20);out body;>;out skel qt;`,
      // All hiking paths on Fraser Island
      `[out:json][timeout:90];way["highway"~"path|track"](-25.40,153.02,-25.10,153.18);out body;>;out skel qt;`,
    ]
  },
  {
    name: 'Whitsunday Ngaro Sea Trail',
    id: 'whitsunday_ngaro_sea_trail',
    region: 'Whitsundays, QLD',
    country: 'AU',
    officialDistanceKm: 14,
    typicalDays: '2-3',
    queries: [
      `[out:json][timeout:90];relation["route"="hiking"]["name"~"Ngaro|Whitsunday",i](-20.30,148.85,-20.18,149.00);out body;>;out skel qt;`,
      `[out:json][timeout:90];way["highway"~"path|track|footway"]["name"~"Ngaro",i](-20.30,148.85,-20.18,149.00);out body;>;out skel qt;`,
      // All paths on South Molle / Hook islands
      `[out:json][timeout:90];way["highway"~"path|track|footway"](-20.28,148.82,-20.20,148.95);out body;>;out skel qt;`,
    ]
  }
];

async function main() {
  const trailDataDir = join(process.cwd(), 'public', 'trail-data');
  const resultsDir = join(process.cwd(), 'scripts', 'trail-curation', 'results');
  mkdirSync(resultsDir, { recursive: true });

  console.log(`=== RETRY FAILED AU PHASE 13 TRAILS ===`);
  console.log(`${failedTrails.length} trails to retry\n`);

  const successes: string[] = [];
  const failures: string[] = [];

  for (let i = 0; i < failedTrails.length; i++) {
    const trail = failedTrails[i];
    console.log(`\n[${i + 1}/${failedTrails.length}] ${trail.name} (${trail.officialDistanceKm}km, ${trail.region})`);

    // Skip if already exists
    const targetPath = join(trailDataDir, `${trail.id}.json`);
    if (existsSync(targetPath)) {
      console.log(`  SKIP: already exists`);
      successes.push(trail.name);
      continue;
    }

    let found = false;
    for (let q = 0; q < trail.queries.length; q++) {
      console.log(`  Query ${q + 1}/${trail.queries.length}...`);
      const result = await queryOverpass(trail.queries[q]);

      if (result && result.coords.length >= 5) {
        const km = totalDistance(result.coords);
        console.log(`    Found: ${result.coords.length} pts, ${km.toFixed(1)} km`);

        console.log(`    Enriching elevation...`);
        const coords3d = await enrichElevation(result.coords);
        const elevations = coords3d.map(c => c[2]);
        console.log(`    Elevation: ${Math.min(...elevations)}m - ${Math.max(...elevations)}m`);

        const trailResult = {
          id: trail.id,
          name: trail.name,
          region: trail.region,
          country: trail.country,
          distance_km: trail.officialDistanceKm,
          typical_days: trail.typicalDays,
          coordinates: coords3d,
          dataSource: result.source,
          calculatedKm: km,
        };

        writeFileSync(targetPath, JSON.stringify(trailResult));
        console.log(`  SUCCESS: ${coords3d.length} pts, ${km.toFixed(1)} km`);
        successes.push(trail.name);
        found = true;
        break;
      }

      // Long delay between queries to avoid rate limiting
      await sleep(3000);
    }

    if (!found) {
      failures.push(trail.name);
      console.log(`  FAILED: no data found after all queries`);
    }

    // Save progress
    writeFileSync(
      join(resultsDir, 'au-phase13-retry-progress.json'),
      JSON.stringify({ successes, failures, lastIndex: i }, null, 2)
    );

    // Long delay between trails
    await sleep(4000);
  }

  console.log(`\n=== RETRY RESULTS ===`);
  console.log(`Success: ${successes.length}`);
  console.log(`Failed: ${failures.length}`);
  if (failures.length > 0) console.log(`Failed trails: ${failures.join(', ')}`);
}

main().catch(console.error);
