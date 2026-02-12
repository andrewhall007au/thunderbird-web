// Fix out-and-back US trails where OSM only has one direction
// Detects trails where calc ≈ official/2, then mirrors coordinates to create return leg
// Only applies fix if doubling brings calculated distance closer to official
//
// Usage: npx tsx scripts/trail-curation/fix-out-and-back-us.ts [--dry-run]

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const TRAIL_DATA_DIR = join(process.cwd(), 'public', 'trail-data');

interface TrailInput {
  name: string;
  officialDistanceKm: number;
  [key: string]: any;
}

interface TrailData {
  id: string;
  name: string;
  coordinates: [number, number, number][];
  dataSource: string;
  calculatedKm: number;
  distance_km: number;
  [key: string]: any;
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

function totalDist(coords: [number, number, number][]): number {
  let d = 0;
  for (let i = 1; i < coords.length; i++) {
    d += haversine(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
  }
  return d;
}

function toId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// Known loop trails that should NOT be doubled (even if ratio ≈ 0.5)
const KNOWN_LOOPS = new Set([
  'navajo_loop_and_queens_garden',
  'franconia_ridge_loop',
  'yosemite_valley_loop_trail',
]);

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`=== FIX OUT-AND-BACK TRAILS ===${dryRun ? ' (DRY RUN)' : ''}\n`);

  const trailList: TrailInput[] = JSON.parse(
    readFileSync(join(process.cwd(), 'scripts', 'trail-curation', 'trail-lists', 'us-trails.json'), 'utf-8')
  );

  const officialKm = new Map<string, number>();
  for (const t of trailList) {
    officialKm.set(toId(t.name), t.officialDistanceKm);
  }

  const results: { name: string; before: number; after: number; official: number; action: string }[] = [];
  let fixedCount = 0;

  for (const t of trailList) {
    const id = toId(t.name);
    const filePath = join(TRAIL_DATA_DIR, `${id}.json`);
    if (!existsSync(filePath)) continue;

    let trail: TrailData;
    try {
      trail = JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch { continue; }

    if (trail.country !== 'US') continue;

    const offKm = officialKm.get(id) || trail.distance_km;
    const calcKm = trail.calculatedKm ?? totalDist(trail.coordinates);
    const currentErr = Math.abs(calcKm - offKm) / offKm;
    const ratio = calcKm / offKm;

    // Skip if already good enough
    if (currentErr < 0.25) continue;

    // Skip known loops
    if (KNOWN_LOOPS.has(id)) continue;

    // Detect out-and-back pattern: calc is 35-55% of official
    if (ratio < 0.35 || ratio > 0.55) continue;

    // Verify start and end are apart (not already a loop)
    const start = trail.coordinates[0];
    const end = trail.coordinates[trail.coordinates.length - 1];
    const startEndDist = haversine(start[1], start[0], end[1], end[0]);

    // For very short trails, lower the threshold
    const minStartEnd = offKm < 10 ? 0.3 : 0.5;
    if (startEndDist < minStartEnd) {
      console.log(`SKIP ${trail.name}: start-end only ${startEndDist.toFixed(1)}km (likely a loop)`);
      continue;
    }

    // Create mirrored return leg
    const reversed = [...trail.coordinates].reverse() as [number, number, number][];
    const doubled = [...trail.coordinates, ...reversed] as [number, number, number][];
    const doubledKm = totalDist(doubled);
    const doubledErr = Math.abs(doubledKm - offKm) / offKm;

    // Only apply if it improves
    if (doubledErr >= currentErr) {
      console.log(`SKIP ${trail.name}: doubling doesn't help (${(currentErr * 100).toFixed(1)}% → ${(doubledErr * 100).toFixed(1)}%)`);
      continue;
    }

    const beforeStatus = currentErr <= 0.05 ? 'OK' : currentErr <= 0.25 ? 'FAIR' : 'HIGH';
    const afterStatus = doubledErr <= 0.05 ? 'OK' : doubledErr <= 0.25 ? 'FAIR' : 'HIGH';

    console.log(`${trail.name}:`);
    console.log(`  ${calcKm.toFixed(1)}km → ${doubledKm.toFixed(1)}km (${(currentErr * 100).toFixed(1)}% → ${(doubledErr * 100).toFixed(1)}%) [${beforeStatus} → ${afterStatus}]`);
    console.log(`  Start-end: ${startEndDist.toFixed(1)}km, pts: ${trail.coordinates.length} → ${doubled.length}`);

    if (!dryRun) {
      trail.coordinates = doubled;
      trail.calculatedKm = doubledKm;
      writeFileSync(filePath, JSON.stringify(trail, null, 2));
      console.log(`  SAVED`);
    }
    console.log();
    fixedCount++;

    results.push({
      name: trail.name,
      before: calcKm,
      after: doubledKm,
      official: offKm,
      action: `doubled out-and-back (${trail.coordinates.length / 2} → ${trail.coordinates.length} pts)`
    });
  }

  console.log(`\nFixed: ${fixedCount} trails`);

  if (results.length > 0) {
    console.log('\nSummary:');
    for (const r of results) {
      const err = Math.abs(r.after - r.official) / r.official;
      const status = err <= 0.05 ? 'OK' : err <= 0.25 ? 'FAIR' : 'HIGH';
      console.log(`  ${status.padEnd(5)} ${r.name.padEnd(40)} ${r.after.toFixed(1)}km / ${r.official}km (${(err * 100).toFixed(1)}%)`);
    }
  }
}

main().catch(console.error);
