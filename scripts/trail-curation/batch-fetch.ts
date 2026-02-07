// Batch trail fetcher with progress tracking and source attribution

import { fetchTrail, TrailInput, TrailResult } from './fetch-trail.js';
import * as fs from 'fs/promises';

interface BatchSummary {
  total: number;
  succeeded: number;
  succeededViaOSM: number;
  succeededViaFallback: Record<string, number>;
  failed: number;
  flagged: number;
}

/**
 * Process a batch of trails with rate limiting and progress tracking
 * @param inputPath Path to JSON file containing TrailInput[]
 * @param outputPath Path for output JSON file (optional)
 */
export async function batchFetch(inputPath: string, outputPath?: string): Promise<void> {
  // Read input file
  const inputData = await fs.readFile(inputPath, 'utf-8');
  const trails: TrailInput[] = JSON.parse(inputData);

  console.log(`\n=== BATCH TRAIL FETCH ===`);
  console.log(`Input: ${inputPath}`);
  console.log(`Total trails: ${trails.length}\n`);

  const results: TrailResult[] = [];
  const failedTrails: Array<{ input: TrailInput; result: TrailResult }> = [];

  const summary: BatchSummary = {
    total: trails.length,
    succeeded: 0,
    succeededViaOSM: 0,
    succeededViaFallback: {},
    failed: 0,
    flagged: 0,
  };

  // Process trails sequentially with delay
  for (let i = 0; i < trails.length; i++) {
    const trail = trails[i];
    const num = i + 1;

    console.log(`\n[${num}/${trails.length}] Fetching: ${trail.name}...`);

    try {
      const result = await fetchTrail(trail);
      results.push(result);

      if (result.success && result.trail) {
        summary.succeeded++;

        const source = result.dataSource === 'osm' ? 'OSM' : result.dataSource;
        if (result.dataSource === 'osm') {
          summary.succeededViaOSM++;
        } else {
          summary.succeededViaFallback[result.dataSource] =
            (summary.succeededViaFallback[result.dataSource] || 0) + 1;
        }

        const lowEle = result.elevationWaypoints?.trailLow.coordinates[2] || 0;
        const highEle = result.elevationWaypoints?.trailHigh.coordinates[2] || 0;

        console.log(
          `  OK via ${source} (${result.simplifiedPointCount} points, ${result.validation?.calculatedKm.toFixed(0)}km calculated vs ${trail.officialDistanceKm}km official, trailLow: ${lowEle}m, trailHigh: ${highEle}m)`
        );

        if (result.flags.length > 0) {
          summary.flagged++;
          console.log(`  Flags: ${result.flags.join(', ')}`);
        }
      } else {
        summary.failed++;
        failedTrails.push({ input: trail, result });
        console.log(`  FAILED: ${result.error || 'Unknown error'}`);
        if (result.flags.length > 0) {
          console.log(`  Flags: ${result.flags.join(', ')}`);
        }
      }
    } catch (error) {
      summary.failed++;
      const errorResult: TrailResult = {
        success: false,
        flags: ['exception'],
        error: String(error),
        dataSource: 'none',
      };
      results.push(errorResult);
      failedTrails.push({ input: trail, result: errorResult });
      console.log(`  EXCEPTION: ${error}`);
    }

    // Rate limiting: 2-second delay between requests
    if (i < trails.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  // Write output files
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const defaultOutputPath = `trail-results-${timestamp}.json`;
  const actualOutputPath = outputPath || defaultOutputPath;

  await fs.writeFile(actualOutputPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\nResults written to: ${actualOutputPath}`);

  // Write failed trails to separate file
  if (failedTrails.length > 0) {
    const failedOutputPath = `failed-trails-${timestamp}.json`;
    await fs.writeFile(
      failedOutputPath,
      JSON.stringify(failedTrails, null, 2),
      'utf-8'
    );
    console.log(`Failed trails written to: ${failedOutputPath}`);
  }

  // Print summary
  console.log('\n=== BATCH SUMMARY ===');
  console.log(`Total: ${summary.total}`);
  console.log(`Succeeded via OSM: ${summary.succeededViaOSM}`);

  const fallbackCount = Object.values(summary.succeededViaFallback).reduce(
    (a, b) => a + b,
    0
  );
  if (fallbackCount > 0) {
    console.log(`Succeeded via fallback: ${fallbackCount}`);
    for (const [source, count] of Object.entries(summary.succeededViaFallback)) {
      console.log(`  - ${source}: ${count}`);
    }
  }

  console.log(`Failed (all sources exhausted): ${summary.failed}`);
  console.log(`Flagged for validation: ${summary.flagged}`);
}

// CLI support
if (import.meta.url === `file://${process.argv[1]}`) {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];

  if (!inputPath) {
    console.error('Usage: npx tsx batch-fetch.ts <input.json> [output.json]');
    process.exit(1);
  }

  batchFetch(inputPath, outputPath).catch((error) => {
    console.error(`Fatal error: ${error}`);
    process.exit(1);
  });
}
