// Try to fix remaining bad trails by fetching from Waymarked Trails API
// Waymarked curates main routes only (no alternatives/side trails)
// Usage: npx tsx scripts/trail-curation/fix-from-waymarked.ts

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const TRAIL_DATA_DIR = join(process.cwd(), 'public', 'trail-data');
const WAYMARKED_API = 'https://hiking.waymarkedtrails.org/api/v1';
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
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function totalDistance(coords: [number, number][]): number {
  let d = 0;
  for (let i = 1; i < coords.length; i++) {
    d += haversine(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
  }
  return d;
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// Search Waymarked Trails and extract coordinates
async function fetchWaymarked(searchName: string): Promise<{ coords: [number, number][]; wmId: number; wmName: string } | null> {
  const searchUrl = `${WAYMARKED_API}/list/search?query=${encodeURIComponent(searchName)}&limit=10`;
  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) return null;
  const searchData = await searchRes.json();
  const results = searchData.results || [];

  for (const result of results) {
    console.log(`     Result: "${result.name}" (id=${result.id})`);
  }

  if (results.length === 0) return null;
  const best = results[0];

  await sleep(500);

  const geoUrl = `${WAYMARKED_API}/details/${best.id}/geometry/geojson`;
  const geoRes = await fetch(geoUrl);
  if (!geoRes.ok) return null;
  const geoData = await geoRes.json();

  // Extract as segments (preserve feature order) then chain
  const segments: [number, number][][] = [];
  if (geoData.type === 'FeatureCollection') {
    for (const feature of geoData.features || []) {
      const geom = feature.geometry;
      if (geom.type === 'LineString') {
        segments.push(geom.coordinates.map((c: number[]) => mercatorToWgs84(c[0], c[1])));
      } else if (geom.type === 'MultiLineString') {
        for (const line of geom.coordinates) {
          segments.push((line as number[][]).map(c => mercatorToWgs84(c[0], c[1])));
        }
      }
    }
  }

  // Chain segments by nearest endpoint
  if (segments.length > 1) {
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
    const flat = ordered.flat();
    return { coords: flat, wmId: best.id, wmName: best.name };
  }

  const flat = segments.flat();
  return flat.length >= 20 ? { coords: flat, wmId: best.id, wmName: best.name } : null;
}

// Elevation enrichment via SRTM 30m
async function enrichElevation(coords: [number, number][], existingCoords?: [number, number, number][]): Promise<[number, number, number][]> {
  // First try to carry over from existing data
  const lookup = new Map<string, number>();
  if (existingCoords) {
    for (const c of existingCoords) {
      lookup.set(`${c[0].toFixed(5)},${c[1].toFixed(5)}`, c[2]);
    }
  }

  // Count how many we can carry over
  let carried = 0;
  const needFetch: number[] = [];
  for (let i = 0; i < coords.length; i++) {
    const key = `${coords[i][0].toFixed(5)},${coords[i][1].toFixed(5)}`;
    if (lookup.has(key)) { carried++; } else { needFetch.push(i); }
  }
  console.log(`     Elevation: ${carried} carried over, ${needFetch.length} need SRTM fetch`);

  // Fetch missing elevation from SRTM
  const result: [number, number, number][] = coords.map(c => {
    const key = `${c[0].toFixed(5)},${c[1].toFixed(5)}`;
    return [c[0], c[1], lookup.get(key) ?? 0];
  });

  if (needFetch.length > 0) {
    console.log(`     Fetching elevation for ${needFetch.length} points (~${Math.ceil(needFetch.length / 100)} SRTM batches)...`);
    for (let batch = 0; batch < needFetch.length; batch += 100) {
      const batchIndices = needFetch.slice(batch, batch + 100);
      const locations = batchIndices.map(i => `${coords[i][1]},${coords[i][0]}`).join('|');
      try {
        const res = await fetch(`${TOPO_API}?locations=${locations}`);
        if (res.ok) {
          const data = await res.json();
          for (let j = 0; j < batchIndices.length; j++) {
            const ele = data.results?.[j]?.elevation ?? 0;
            result[batchIndices[j]][2] = Math.round(ele);
          }
        }
      } catch {}
      await sleep(1100);
    }
  }

  return result;
}

const TRAILS: { id: string; searches: string[]; officialKm: number }[] = [
  { id: 'larapinta_trail', searches: ['Larapinta Trail', 'Larapinta'], officialKm: 223 },
  { id: 'heysen_trail', searches: ['Heysen Trail', 'Heysen'], officialKm: 1200 },
  { id: 'jatbula_trail', searches: ['Jatbula Trail', 'Jatbula'], officialKm: 62 },
  { id: 'great_north_walk', searches: ['Great North Walk'], officialKm: 250 },
  { id: 'grampians_peaks_trail', searches: ['Grampians Peaks Trail', 'Grampians Peaks'], officialKm: 164 },
  { id: 'six_foot_track', searches: ['Six Foot Track'], officialKm: 45 },
  { id: 'light_to_light_walk', searches: ['Light to Light Walk', 'Light to Light'], officialKm: 32 },
  { id: 'great_ocean_walk', searches: ['Great Ocean Walk'], officialKm: 110 },
  { id: 'australian_alps_walking_track', searches: ['Australian Alps Walking Track', 'Australian Alps Walk'], officialKm: 655 },
];

async function main() {
  console.log('=== WAYMARKED TRAILS FIX ===\n');

  for (const trail of TRAILS) {
    const filePath = join(TRAIL_DATA_DIR, `${trail.id}.json`);
    let existing: TrailData;
    try {
      existing = JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch {
      console.log(`SKIP ${trail.id} — no existing file`);
      continue;
    }

    const currentError = Math.abs(existing.calculatedKm - trail.officialKm) / trail.officialKm;
    if (currentError <= 0.05) {
      console.log(`OK   ${existing.name} — ${existing.calculatedKm.toFixed(1)}km (${(currentError * 100).toFixed(1)}% off)`);
      continue;
    }

    console.log(`\nTRY  ${existing.name} — currently ${existing.calculatedKm.toFixed(1)}km (${(currentError * 100).toFixed(1)}% off ${trail.officialKm}km official)`);

    let found = false;
    for (const searchName of trail.searches) {
      console.log(`     Searching Waymarked: "${searchName}"...`);
      const result = await fetchWaymarked(searchName);
      if (!result) {
        console.log(`     Not found`);
        await sleep(1000);
        continue;
      }

      const km = totalDistance(result.coords);
      const newError = Math.abs(km - trail.officialKm) / trail.officialKm;
      console.log(`     Waymarked "${result.wmName}" (id=${result.wmId}): ${result.coords.length} pts, ${km.toFixed(1)}km (${(newError * 100).toFixed(1)}% off)`);

      // Only use if better than current
      if (newError < currentError && result.coords.length >= 50) {
        console.log(`     Enriching elevation...`);
        const coords3d = await enrichElevation(result.coords, existing.coordinates);
        existing.coordinates = coords3d;
        existing.calculatedKm = km;
        existing.dataSource = 'waymarked_trails_ordered';
        writeFileSync(filePath, JSON.stringify(existing, null, 2));
        console.log(`     SAVED ✓ — ${km.toFixed(1)}km (${(newError * 100).toFixed(1)}% off)`);
        found = true;
        break;
      } else {
        console.log(`     Not better than current (${(currentError * 100).toFixed(1)}% → ${(newError * 100).toFixed(1)}%)`);
      }
      await sleep(1000);
    }

    if (!found) {
      console.log(`     No improvement from Waymarked — keeping current`);
    }

    await sleep(1500);
  }

  // Update manifest
  const manifestPath = join(TRAIL_DATA_DIR, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  for (const trail of TRAILS) {
    try {
      const data: TrailData = JSON.parse(readFileSync(join(TRAIL_DATA_DIR, `${trail.id}.json`), 'utf-8'));
      const entry = manifest.find((m: any) => m.id === trail.id);
      if (entry) {
        entry.dataSource = data.dataSource;
        entry.calculatedKm = data.calculatedKm;
        entry.pointCount = data.coordinates.length;
        const elevs = data.coordinates.map((c: number[]) => c[2]);
        entry.elevationLow = Math.min(...elevs);
        entry.elevationHigh = Math.max(...elevs);
      }
    } catch {}
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('\nManifest updated. Done!');
}

main().catch(console.error);
