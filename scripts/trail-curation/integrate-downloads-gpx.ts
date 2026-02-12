// Integrate GPX files from ~/Downloads into trail data
// Handles GPX with and without elevation (adds SRTM elevation if missing)
// Usage: npx tsx scripts/trail-curation/integrate-downloads-gpx.ts

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const TRAIL_DATA_DIR = join(process.cwd(), 'public', 'trail-data');
const DOWNLOADS_DIR = join(process.env.HOME || '', 'Downloads');
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

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// Parse GPX file (handles both with and without elevation)
function parseGPX(gpxContent: string, filename: string): { coords: [number, number, number][]; hasElevation: boolean; name: string } {
  const coords: [number, number, number][] = [];
  let hasElevation = true;

  // Extract name
  const nameMatch = gpxContent.match(/<name>([^<]+)<\/name>/i);
  const name = nameMatch ? nameMatch[1].trim() : filename.replace('.gpx', '');

  // Try trkpt with elevation first
  const trkptEleRegex = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>[\s\S]*?<ele>([^<]+)<\/ele>[\s\S]*?<\/trkpt>/gi;
  let match;
  while ((match = trkptEleRegex.exec(gpxContent)) !== null) {
    coords.push([parseFloat(match[2]), parseFloat(match[1]), parseFloat(match[3])]);
  }

  // If no coords with elevation, try trkpt without
  if (coords.length === 0) {
    hasElevation = false;
    const trkptRegex = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*/gi;
    while ((match = trkptRegex.exec(gpxContent)) !== null) {
      coords.push([parseFloat(match[2]), parseFloat(match[1]), 0]);
    }
  }

  // Try rtept if still empty
  if (coords.length === 0) {
    const rteptRegex = /<rtept\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>[\s\S]*?<\/rtept>/gi;
    while ((match = rteptRegex.exec(gpxContent)) !== null) {
      const eleMatch = match[0].match(/<ele>([^<]+)<\/ele>/i);
      coords.push([parseFloat(match[2]), parseFloat(match[1]), eleMatch ? parseFloat(eleMatch[1]) : 0]);
      if (!eleMatch) hasElevation = false;
    }
  }

  return { coords, hasElevation, name };
}

// Enrich elevation via SRTM 30m
async function enrichElevation(coords: [number, number, number][]): Promise<[number, number, number][]> {
  const result = [...coords];
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
          result[i + j] = [batch[j][0], batch[j][1], Math.round(ele)];
        }
      }
    } catch {}
    await sleep(1100);
    if ((i / 100 + 1) % 20 === 0) {
      console.log(`    Elevation: ${Math.min(i / 100 + 1, total)}/${total} batches`);
    }
  }
  return result;
}

// GPX file → trail ID mapping
const GPX_MAPPING: { file: string; trailId: string; officialKm: number; region: string; typicalDays: string }[] = [
  { file: 'Carnarvon Great Walk.gpx', trailId: 'carnarvon_great_walk', officialKm: 87, region: 'Queensland', typicalDays: '6-7' },
  { file: 'Cooloola-Great-Walk.gpx', trailId: 'cooloola_great_walk', officialKm: 102, region: 'Queensland', typicalDays: '5' },
  { file: 'Grampians Peaks Trail.gpx', trailId: 'grampians_peaks_trail', officialKm: 164, region: 'Victoria', typicalDays: '13' },
  { file: 'Great-North-Walk.gpx', trailId: 'great_north_walk', officialKm: 250, region: 'New South Wales', typicalDays: '8-14' },
  { file: 'Heysen_Trail_20250514.gpx', trailId: 'heysen_trail', officialKm: 1200, region: 'South Australia', typicalDays: '60' },
  { file: 'Kanangra-to-Katoomba.gpx', trailId: 'kanangra_to_katoomba', officialKm: 47, region: 'New South Wales', typicalDays: '2-3' },
  { file: 'Scenic-Rim-Trail.gpx', trailId: 'scenic_rim_trail', officialKm: 47, region: 'Queensland', typicalDays: '4' },
  { file: 'Southern-Circuit-Hike.gpx', trailId: 'wilsons_promontory_southern_circuit', officialKm: 59, region: 'Victoria', typicalDays: '3-5' },
];

async function main() {
  console.log('=== INTEGRATE DOWNLOADS GPX ===\n');

  const results: { name: string; km: number; official: number; pts: number; status: string }[] = [];
  const failures: string[] = [];

  for (const mapping of GPX_MAPPING) {
    const gpxPath = join(DOWNLOADS_DIR, mapping.file);
    console.log(`[${mapping.file}]`);

    let gpxContent: string;
    try {
      gpxContent = readFileSync(gpxPath, 'utf-8');
    } catch {
      console.log('  NOT FOUND — skipping\n');
      failures.push(mapping.file);
      continue;
    }

    // Parse GPX
    const { coords, hasElevation, name } = parseGPX(gpxContent, mapping.file);
    if (coords.length < 10) {
      console.log(`  Only ${coords.length} points — skipping\n`);
      failures.push(mapping.file);
      continue;
    }

    console.log(`  Parsed: ${coords.length} pts, elevation: ${hasElevation ? 'GPS' : 'MISSING'}`);

    // Enrich elevation if missing
    let finalCoords = coords;
    if (!hasElevation) {
      console.log(`  Fetching SRTM elevation for ${coords.length} points...`);
      finalCoords = await enrichElevation(coords);
    }

    const km = totalDistance(finalCoords);
    const errPct = Math.abs(km - mapping.officialKm) / mapping.officialKm * 100;
    const elevs = finalCoords.map(c => c[2]);
    const elevLow = Math.min(...elevs);
    const elevHigh = Math.max(...elevs);

    console.log(`  Distance: ${km.toFixed(1)}km (${errPct.toFixed(1)}% off ${mapping.officialKm}km official)`);
    console.log(`  Elevation: ${elevLow}m — ${elevHigh}m`);

    // Determine display name from existing file or GPX name
    let displayName = name;
    const trailPath = join(TRAIL_DATA_DIR, `${mapping.trailId}.json`);
    let existingTrail: any = null;
    try {
      existingTrail = JSON.parse(readFileSync(trailPath, 'utf-8'));
      displayName = existingTrail.name;
    } catch {}

    // Save trail data
    const trailData = {
      id: mapping.trailId,
      name: displayName || name,
      region: mapping.region,
      country: 'AU',
      distance_km: mapping.officialKm,
      typical_days: mapping.typicalDays,
      coordinates: finalCoords,
      dataSource: 'gpx_user',
      calculatedKm: km,
    };
    writeFileSync(trailPath, JSON.stringify(trailData, null, 2));
    console.log(`  SAVED ✓\n`);

    const status = errPct <= 5 ? 'OK' : errPct <= 25 ? 'FAIR' : 'HIGH';
    results.push({ name: displayName || name, km, official: mapping.officialKm, pts: finalCoords.length, status });
  }

  // Update manifest
  const manifestPath = join(TRAIL_DATA_DIR, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  for (const r of results) {
    const trailId = GPX_MAPPING.find(m => m.officialKm === r.official)?.trailId;
    if (!trailId) continue;
    const filePath = join(TRAIL_DATA_DIR, `${trailId}.json`);
    try {
      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      let entry = manifest.find((m: any) => m.id === trailId);
      if (!entry) {
        entry = { id: trailId };
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

  console.log('=== SUMMARY ===');
  console.log(`Succeeded: ${results.length}/${GPX_MAPPING.length}`);
  for (const r of results) {
    const errPct = (Math.abs(r.km - r.official) / r.official * 100).toFixed(1);
    console.log(`  ${r.status.padEnd(5)} ${r.name.padEnd(42)} ${(r.km.toFixed(1) + 'km').padStart(10)} / ${(r.official + 'km').padStart(7)}  ${r.pts} pts  ${errPct}%`);
  }
  if (failures.length > 0) {
    console.log(`Failed: ${failures.join(', ')}`);
  }
}

main().catch(console.error);
