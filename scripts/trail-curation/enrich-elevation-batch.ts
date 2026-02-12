// Enrich elevation for trail data files that have elevation=0
// Usage: npx tsx scripts/trail-curation/enrich-elevation-batch.ts [trail_id1 trail_id2 ...]
// Without args, finds all trails with missing elevation and enriches them.

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const TRAIL_DATA_DIR = join(process.cwd(), 'public', 'trail-data');
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

function totalDist(coords: [number, number, number][]): number {
  let d = 0;
  for (let i = 1; i < coords.length; i++) {
    d += haversine(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
  }
  return d;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function enrichElevation(coords: [number, number, number][]): Promise<[number, number, number][]> {
  const result: [number, number, number][] = [];
  const totalBatches = Math.ceil(coords.length / 100);

  for (let i = 0; i < coords.length; i += 100) {
    const batch = coords.slice(i, i + 100);
    const locations = batch.map(c => `${c[1]},${c[0]}`).join('|');
    const batchNum = Math.floor(i / 100) + 1;

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

    if (batchNum % 100 === 0 || batchNum === totalBatches) {
      console.log(`    ${batchNum}/${totalBatches} batches`);
    }
  }

  return result;
}

async function main() {
  const args = process.argv.slice(2);

  // Find trails needing elevation
  const manifestPath = join(TRAIL_DATA_DIR, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

  let trailIds: string[];
  if (args.length > 0) {
    trailIds = args;
  } else {
    // Find all trails with elevation 0 in manifest
    trailIds = manifest
      .filter((m: any) => m.elevationLow === 0 && m.elevationHigh === 0)
      .map((m: any) => m.id);
  }

  console.log(`=== ELEVATION ENRICHMENT ===`);
  console.log(`Trails to enrich: ${trailIds.length}\n`);

  for (const id of trailIds) {
    const filePath = join(TRAIL_DATA_DIR, `${id}.json`);
    if (!existsSync(filePath)) {
      console.log(`${id}: file not found, skipping`);
      continue;
    }

    const trail = JSON.parse(readFileSync(filePath, 'utf-8'));
    const coords = trail.coordinates as [number, number, number][];
    const zeroCount = coords.filter(c => c[2] === 0).length;

    if (zeroCount < coords.length * 0.5) {
      console.log(`${id}: ${zeroCount}/${coords.length} pts at 0m — already has elevation, skipping`);
      continue;
    }

    const estMinutes = Math.ceil(coords.length / 100 * 1.1 / 60);
    console.log(`${trail.name}: ${coords.length} pts, ~${estMinutes}min`);

    const enriched = await enrichElevation(coords);
    const elevs = enriched.map(c => c[2]).filter(e => e !== 0);

    trail.coordinates = enriched;
    trail.calculatedKm = totalDist(enriched);
    writeFileSync(filePath, JSON.stringify(trail, null, 2));

    // Compute min/max without spread (avoids stack overflow on large arrays)
    let elevLow = Infinity, elevHigh = -Infinity;
    for (const e of elevs) {
      if (e < elevLow) elevLow = e;
      if (e > elevHigh) elevHigh = e;
    }

    // Update manifest
    const entry = manifest.find((m: any) => m.id === id);
    if (entry) {
      entry.calculatedKm = trail.calculatedKm;
      entry.pointCount = enriched.length;
      if (elevs.length > 0) {
        entry.elevationLow = elevLow;
        entry.elevationHigh = elevHigh;
      }
    }

    console.log(`  Elevation: ${elevs.length > 0 ? elevLow + 'm — ' + elevHigh + 'm' : 'no data'}`);
    console.log(`  SAVED\n`);
  }

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('Done. Manifest updated.');
}

main().catch(console.error);
