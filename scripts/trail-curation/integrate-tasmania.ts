// Integrate Tasmania trail results into the app
// Reads the full-res result file, filters valid data, outputs for app consumption
// Usage: npx tsx scripts/trail-curation/integrate-tasmania.ts

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface TrailResult {
  success: boolean;
  trail?: {
    id: string;
    name: string;
    region: string;
    country: string;
    distance_km: number;
    typical_days: string;
    coordinates: [number, number, number][];
  };
  dataSource: string;
  totalPoints?: number;
  segmentCount?: number;
  calculatedKm?: number;
  percentDiff?: number;
  error?: string;
}

// Trails to exclude (bad data quality)
const EXCLUDE_IDS = new Set([
  'mcraes_isthmus_walk', // "Isthmus Track" matches scattered segments across Tasmania
]);

async function main() {
  const resultsPath = join(__dirname, 'results', 'tasmania-top19-fullres.json');
  const results: TrailResult[] = JSON.parse(readFileSync(resultsPath, 'utf8'));

  const valid = results.filter(r => {
    if (!r.success || !r.trail) return false;
    if (EXCLUDE_IDS.has(r.trail.id)) {
      console.log(`Excluded: ${r.trail.name} (bad data quality)`);
      return false;
    }
    return true;
  });

  console.log(`=== TASMANIA INTEGRATION ===`);
  console.log(`Total results: ${results.length}`);
  console.log(`Valid trails: ${valid.length}`);
  console.log(`Excluded: ${results.filter(r => r.success && r.trail && EXCLUDE_IDS.has(r.trail.id)).length}`);
  console.log(`Failed: ${results.filter(r => !r.success).length}\n`);

  // Output individual trail JSON files for lazy loading
  const trailDataDir = join(__dirname, '..', '..', 'public', 'trail-data');
  mkdirSync(trailDataDir, { recursive: true });

  const manifest: Array<{
    id: string;
    name: string;
    region: string;
    country: string;
    distance_km: number;
    typical_days: string;
    pointCount: number;
    dataSource: string;
    calculatedKm: number;
  }> = [];

  for (const r of valid) {
    const trail = r.trail!;

    // Write individual trail coordinate file
    const trailFile = join(trailDataDir, `${trail.id}.json`);
    writeFileSync(trailFile, JSON.stringify({
      id: trail.id,
      name: trail.name,
      region: trail.region,
      country: trail.country,
      distance_km: trail.distance_km,
      typical_days: trail.typical_days,
      coordinates: trail.coordinates,
    }));

    manifest.push({
      id: trail.id,
      name: trail.name,
      region: trail.region,
      country: trail.country,
      distance_km: trail.distance_km,
      typical_days: trail.typical_days,
      pointCount: trail.coordinates.length,
      dataSource: r.dataSource,
      calculatedKm: r.calculatedKm || 0,
    });

    const fileSize = (JSON.stringify(trail).length / 1024).toFixed(0);
    console.log(`  ${trail.name}: ${trail.coordinates.length} pts, ${fileSize}KB`);
  }

  // Write manifest (metadata without coordinates, for the trail selector)
  const manifestPath = join(trailDataDir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`\nWrote ${valid.length} trail files to public/trail-data/`);
  console.log(`Manifest: public/trail-data/manifest.json`);

  // Summary stats
  let totalPts = 0;
  let totalSize = 0;
  for (const r of valid) {
    totalPts += r.trail!.coordinates.length;
    totalSize += JSON.stringify(r.trail!).length;
  }
  console.log(`\nTotal: ${totalPts.toLocaleString()} coordinate points`);
  console.log(`Total size: ${(totalSize / 1024 / 1024).toFixed(1)}MB`);

  // Distance quality report
  console.log(`\nDistance quality:`);
  for (const r of valid) {
    const trail = r.trail!;
    const diff = r.percentDiff || 0;
    const quality = diff > 0 ? 'includes side tracks' : 'one-way data (return trip)';
    console.log(`  ${trail.name}: ${r.calculatedKm?.toFixed(1)}km GPX vs ${trail.distance_km}km official (${diff > 0 ? '+' : ''}${diff.toFixed(0)}% — ${quality})`);
  }
}

main().catch(console.error);
