// Sync manifest.json with individual trail data files
// Updates calculatedKm, pointCount, elevationLow/High from trail JSON files
// Usage: npx tsx scripts/trail-curation/sync-manifest.ts [trail_id1 trail_id2 ...]

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const TRAIL_DATA_DIR = join(process.cwd(), 'public', 'trail-data');

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

function main() {
  const trailIds = process.argv.slice(2);
  const manifestPath = join(TRAIL_DATA_DIR, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

  const idsToSync = trailIds.length > 0
    ? trailIds
    : manifest.map((m: any) => m.id);

  let updated = 0;
  for (const id of idsToSync) {
    const entry = manifest.find((m: any) => m.id === id);
    if (!entry) continue;

    try {
      const trail = JSON.parse(readFileSync(join(TRAIL_DATA_DIR, `${id}.json`), 'utf-8'));
      const coords = trail.coordinates || [];
      const elevs = coords.map((c: number[]) => c[2]).filter((e: number) => e !== 0);
      // Use stored calculatedKm if available (may be gap-corrected), otherwise recalculate
      const calcKm = trail.calculatedKm ?? totalDist(coords);

      const oldKm = entry.calculatedKm;
      entry.calculatedKm = calcKm;
      entry.pointCount = coords.length;
      entry.dataSource = trail.dataSource;
      if (elevs.length > 0) {
        let lo = Infinity, hi = -Infinity;
        for (const e of elevs) { if (e < lo) lo = e; if (e > hi) hi = e; }
        entry.elevationLow = lo;
        entry.elevationHigh = hi;
      }

      if (Math.abs((oldKm || 0) - calcKm) > 0.01) {
        console.log(`${id}: ${(oldKm || 0).toFixed(1)}km → ${calcKm.toFixed(1)}km`);
        updated++;
      }
    } catch {}
  }

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nSynced ${updated} entries in manifest`);
}

main();
