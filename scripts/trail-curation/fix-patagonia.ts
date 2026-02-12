// Fix Patagonia trail data — bbox cropping for GPT sections, cleanup
// Usage: npx tsx scripts/trail-curation/fix-patagonia.ts [--dry-run]

import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';

const trailDataDir = join(process.cwd(), 'public', 'trail-data');

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

function toId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// Find longest contiguous section within bbox
function longestContiguousInBBox(
  coords: [number, number, number][],
  bbox: [number, number, number, number]
): [number, number, number][] {
  const inBox = (c: number[]) =>
    c[1] >= bbox[0] && c[1] <= bbox[2] && c[0] >= bbox[1] && c[0] <= bbox[3];

  let bestStart = 0, bestLen = 0, curStart = 0, curLen = 0;
  for (let i = 0; i < coords.length; i++) {
    if (inBox(coords[i])) {
      if (curLen === 0) curStart = i;
      curLen++;
      if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
    } else { curLen = 0; }
  }
  return coords.slice(bestStart, bestStart + bestLen);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`=== FIX PATAGONIA TRAILS ===${dryRun ? ' (DRY RUN)' : ''}`);

  const trailListPath = join(process.cwd(), 'scripts', 'trail-curation', 'trail-lists', 'patagonia-trails.json');
  const trails = JSON.parse(readFileSync(trailListPath, 'utf-8'));

  // Fix Cerro Castillo: Got GPT Section 32 (107km), need just the circuit (~54km)
  // Cerro Castillo Circuit bbox: [-46.15, -72.35, -45.95, -72.10]
  const cerroFile = join(trailDataDir, 'cerro_castillo_circuit.json');
  if (existsSync(cerroFile)) {
    console.log(`\nFIX: Cerro Castillo Circuit`);
    const data = JSON.parse(readFileSync(cerroFile, 'utf-8'));
    const origKm = totalDistance(data.coordinates);
    console.log(`  Before: ${data.coordinates.length} pts, ${origKm.toFixed(1)}km`);

    // Wider bbox to capture full circuit (trail extends to -45.753 N, original bbox too tight)
    const cropped = longestContiguousInBBox(data.coordinates, [-46.15, -72.50, -45.90, -72.00]);
    const croppedKm = totalDistance(cropped);
    console.log(`  After bbox crop: ${cropped.length} pts, ${croppedKm.toFixed(1)}km`);

    const pctOff = Math.abs(croppedKm - 54) / 54 * 100;
    const status = pctOff <= 5 ? 'OK' : pctOff <= 25 ? 'FAIR' : 'HIGH';
    console.log(`  ${status} | ${pctOff.toFixed(1)}% off (official: 54km)`);

    if (!dryRun && cropped.length >= 10 && Math.abs(croppedKm - 54) < Math.abs(origKm - 54)) {
      data.coordinates = cropped;
      data.calculatedKm = croppedKm;
      data.dataSource += '_bbox_cropped';
      writeFileSync(cerroFile, JSON.stringify(data));
      console.log(`  Saved.`);
    }

    // If still > 50% off, delete
    if (pctOff > 50) {
      console.log(`  Still ${pctOff.toFixed(1)}% off — deleting`);
      if (!dryRun) {
        unlinkSync(cerroFile);
        const manifestPath = join(trailDataDir, 'manifest.json');
        if (existsSync(manifestPath)) {
          const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
          const filtered = manifest.filter((m: any) => m.id !== 'cerro_castillo_circuit');
          writeFileSync(manifestPath, JSON.stringify(filtered, null, 2));
        }
      }
    }
  }

  // Fix Cochamo: Got GPT Section 22 (195km), need just the valley trail (~22km)
  // Cochamo Valley bbox: [-41.60, -72.40, -41.45, -72.25]
  const cochamoFile = join(trailDataDir, 'cochamo_valley.json');
  if (existsSync(cochamoFile)) {
    console.log(`\nFIX: Cochamo Valley`);
    const data = JSON.parse(readFileSync(cochamoFile, 'utf-8'));
    const origKm = totalDistance(data.coordinates);
    console.log(`  Before: ${data.coordinates.length} pts, ${origKm.toFixed(1)}km`);

    const cropped = longestContiguousInBBox(data.coordinates, [-41.60, -72.40, -41.45, -72.25]);
    const croppedKm = totalDistance(cropped);
    console.log(`  After bbox crop: ${cropped.length} pts, ${croppedKm.toFixed(1)}km`);

    const pctOff = Math.abs(croppedKm - 22) / 22 * 100;
    const status = pctOff <= 5 ? 'OK' : pctOff <= 25 ? 'FAIR' : 'HIGH';
    console.log(`  ${status} | ${pctOff.toFixed(1)}% off (official: 22km)`);

    if (!dryRun && cropped.length >= 10 && Math.abs(croppedKm - 22) < Math.abs(origKm - 22)) {
      data.coordinates = cropped;
      data.calculatedKm = croppedKm;
      data.dataSource += '_bbox_cropped';
      writeFileSync(cochamoFile, JSON.stringify(data));
      console.log(`  Saved.`);
    }

    if (pctOff > 50) {
      console.log(`  Still ${pctOff.toFixed(1)}% off — deleting`);
      if (!dryRun) {
        unlinkSync(cochamoFile);
        const manifestPath = join(trailDataDir, 'manifest.json');
        if (existsSync(manifestPath)) {
          const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
          const filtered = manifest.filter((m: any) => m.id !== 'cochamo_valley');
          writeFileSync(manifestPath, JSON.stringify(filtered, null, 2));
        }
      }
    }
  }

  // Summary
  console.log(`\n=== PATAGONIA FIX SUMMARY ===`);
  for (const trail of trails) {
    const id = toId(trail.name);
    const file = join(trailDataDir, `${id}.json`);
    if (existsSync(file)) {
      const data = JSON.parse(readFileSync(file, 'utf-8'));
      const calcKm = totalDistance(data.coordinates);
      const pctOff = Math.abs(calcKm - trail.officialDistanceKm) / trail.officialDistanceKm * 100;
      const status = pctOff <= 5 ? 'OK' : pctOff <= 25 ? 'FAIR' : 'HIGH';
      console.log(`  ${status} | ${trail.name} | ${calcKm.toFixed(1)}km / ${trail.officialDistanceKm}km | ${pctOff.toFixed(1)}% off | ${data.coordinates.length} pts`);
    } else {
      console.log(`  --- | ${trail.name} | DELETED/FAILED`);
    }
  }
}

main().catch(console.error);
