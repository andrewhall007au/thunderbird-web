// Batch fetch Tasmanian trails using LIST Tasmania as primary source
// Falls back to Waymarked Trails / OSM if LIST doesn't have the trail
// Full-resolution coordinates — no simplification (real GPX-quality data)
// Side tracks (to huts, summits, lookouts) are INCLUDED — these are valuable
// Usage: npx tsx scripts/trail-curation/fetch-tasmania-batch.ts

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { fetchLISTTrail, extractLISTCoordinates } from './list-tasmania.js';
import { fetchFromWaymarkedTrails } from './waymarked-trails.js';
import { calculateTrailDistance } from './validate-trails.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface TrailInput {
  name: string;
  searchName: string;
  altSearchNames?: string[];
  region: string;
  country: string;
  officialDistanceKm: number;
  typicalDays: string;
}

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

function generateId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_');
}

async function tryLIST(searchName: string): Promise<{ coordinates: [number, number, number][]; segmentCount: number } | null> {
  const features = await fetchLISTTrail(searchName);
  if (features.length === 0) return null;
  const coordinates = extractLISTCoordinates(features);
  // Require at least 50 points for meaningful trail data
  if (coordinates.length < 50) return null;
  return { coordinates, segmentCount: features.length };
}

async function tryWaymarked(searchName: string): Promise<{ coordinates: [number, number, number][] } | null> {
  const result = await fetchFromWaymarkedTrails(searchName);
  if (!result.coordinates || result.coordinates.length <= 5) return null;
  return { coordinates: result.coordinates };
}

async function fetchSingleTrail(input: TrailInput): Promise<TrailResult> {
  const searchNames = [input.searchName, ...(input.altSearchNames || [])];

  // Step 1: Try LIST Tasmania with all search name variants
  for (const searchName of searchNames) {
    console.log(`  [LIST] Searching for "${searchName}"...`);
    try {
      const listResult = await tryLIST(searchName);
      if (listResult) {
        const calcKm = calculateTrailDistance(listResult.coordinates);
        const pctDiff = ((calcKm - input.officialDistanceKm) / input.officialDistanceKm) * 100;

        console.log(`  [LIST] ${listResult.segmentCount} segments, ${listResult.coordinates.length} pts, ${calcKm.toFixed(1)}km (official: ${input.officialDistanceKm}km, diff: ${pctDiff.toFixed(1)}%)`);

        // Accept if we have meaningful data:
        // - Over official is GOOD (includes side tracks to summits, huts, lookouts)
        // - Under official by up to 60% is OK (one-way data for return trips)
        if (pctDiff >= -60) {
          return {
            success: true,
            trail: {
              id: generateId(input.name),
              name: input.name,
              region: input.region,
              country: input.country,
              distance_km: input.officialDistanceKm,
              typical_days: input.typicalDays,
              coordinates: listResult.coordinates,
            },
            dataSource: 'list_tasmania',
            totalPoints: listResult.coordinates.length,
            segmentCount: listResult.segmentCount,
            calculatedKm: calcKm,
            percentDiff: pctDiff,
          };
        } else {
          console.log(`  [LIST] Too little data (${pctDiff.toFixed(1)}% of official)`);
        }
      } else {
        console.log(`  [LIST] No data for "${searchName}"`);
      }
    } catch (err) {
      console.log(`  [LIST] Error: ${err}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  // Rate limit between sources
  await new Promise(r => setTimeout(r, 1000));

  // Step 2: Try Waymarked Trails with all search name variants
  for (const searchName of searchNames) {
    console.log(`  [WM] Searching for "${searchName}"...`);
    try {
      const wmResult = await tryWaymarked(searchName);
      if (wmResult) {
        const calcKm = calculateTrailDistance(wmResult.coordinates);
        const pctDiff = ((calcKm - input.officialDistanceKm) / input.officialDistanceKm) * 100;

        console.log(`  [WM] ${wmResult.coordinates.length} pts, ${calcKm.toFixed(1)}km (diff: ${pctDiff.toFixed(1)}%)`);

        if (pctDiff >= -60) {
          return {
            success: true,
            trail: {
              id: generateId(input.name),
              name: input.name,
              region: input.region,
              country: input.country,
              distance_km: input.officialDistanceKm,
              typical_days: input.typicalDays,
              coordinates: wmResult.coordinates,
            },
            dataSource: 'waymarked_trails',
            totalPoints: wmResult.coordinates.length,
            calculatedKm: calcKm,
            percentDiff: pctDiff,
          };
        } else {
          console.log(`  [WM] Too little data (${pctDiff.toFixed(1)}%)`);
        }
      } else {
        console.log(`  [WM] No data for "${searchName}"`);
      }
    } catch (err) {
      console.log(`  [WM] Error: ${err}`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  return {
    success: false,
    dataSource: 'none',
    error: 'No data from LIST Tasmania or Waymarked Trails',
  };
}

// Main
async function main() {
  const inputPath = join(__dirname, 'trail-lists', 'tasmania-top19.json');
  const outputPath = join(__dirname, 'results', 'tasmania-top19-fullres.json');

  const trails: TrailInput[] = JSON.parse(readFileSync(inputPath, 'utf8'));
  console.log(`=== TASMANIA TOP 19 FETCH (FULL RESOLUTION) ===`);
  console.log(`Trails: ${trails.length}`);
  console.log(`Primary source: LIST Tasmania (CC BY 3.0 AU)`);
  console.log(`Fallback: Waymarked Trails (OSM data)`);
  console.log(`Coordinates: FULL RESOLUTION (includes side tracks)\n`);

  const results: TrailResult[] = [];

  for (let i = 0; i < trails.length; i++) {
    console.log(`[${i + 1}/${trails.length}] ${trails[i].name}`);
    const result = await fetchSingleTrail(trails[i]);
    results.push(result);

    if (result.success) {
      console.log(`  ✓ ${result.dataSource} — ${result.totalPoints} pts, ${result.calculatedKm?.toFixed(1)}km (${result.percentDiff?.toFixed(1)}% diff)\n`);
    } else {
      console.log(`  ✗ FAILED: ${result.error}\n`);
    }

    // Rate limit between trails
    await new Promise(r => setTimeout(r, 1500));
  }

  writeFileSync(outputPath, JSON.stringify(results, null, 2));

  // Summary
  const succeeded = results.filter(r => r.success);
  const bySource = new Map<string, number>();
  for (const r of succeeded) {
    bySource.set(r.dataSource, (bySource.get(r.dataSource) || 0) + 1);
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Succeeded: ${succeeded.length}/${results.length}`);
  for (const [src, count] of bySource) {
    console.log(`  ${src}: ${count}`);
  }

  // Total points report
  let totalPts = 0;
  for (const r of succeeded) {
    totalPts += r.totalPoints || 0;
  }
  console.log(`\nTotal coordinate points: ${totalPts.toLocaleString()}`);

  const failed = results.filter(r => !r.success);
  if (failed.length > 0) {
    console.log(`\nFailed trails:`);
    for (let i = 0; i < trails.length; i++) {
      if (!results[i].success) {
        console.log(`  - ${trails[i].name} (searched: ${trails[i].searchName}${trails[i].altSearchNames ? ', ' + trails[i].altSearchNames?.join(', ') : ''})`);
      }
    }
  }

  // Distance report
  console.log(`\nDistance report:`);
  for (const r of succeeded) {
    const tag = (r.percentDiff || 0) > 0 ? '(+side tracks)' : '(partial)';
    console.log(`  ${r.trail?.name}: ${r.calculatedKm?.toFixed(1)}km vs ${r.trail?.distance_km}km official ${tag}`);
  }
}

main().catch(console.error);
