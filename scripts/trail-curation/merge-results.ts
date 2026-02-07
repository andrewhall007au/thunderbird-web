// Merge all regional trail result files into a single deduplicated set
// Usage: npx tsx scripts/trail-curation/merge-results.ts

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface TrailData {
  id: string;
  name: string;
  region: string;
  country: string;
  distance_km: number;
  typical_days: string;
  coordinates: [number, number, number][];
  dataSource?: string;
}

interface ResultEntry {
  success: boolean;
  trail?: TrailData;
  dataSource?: string;
  input?: { name: string };
}

const resultsDir = join(__dirname, 'results');

// Read all result files
const resultFiles = readdirSync(resultsDir).filter(f => f.endsWith('.json'));
console.log(`Found ${resultFiles.length} result files:`);

const allTrails: TrailData[] = [];
const failedTrails: { name: string; country: string }[] = [];

for (const file of resultFiles) {
  const data: ResultEntry[] = JSON.parse(readFileSync(join(resultsDir, file), 'utf8'));
  let succeeded = 0;
  let failed = 0;

  for (const entry of data) {
    if (entry.success && entry.trail) {
      const trail = { ...entry.trail };
      if (entry.dataSource) trail.dataSource = entry.dataSource;
      allTrails.push(trail);
      succeeded++;
    } else {
      failed++;
      if (entry.input) {
        failedTrails.push({ name: entry.input.name, country: (entry.input as any).country || 'unknown' });
      }
    }
  }

  console.log(`  ${file}: ${succeeded} succeeded, ${failed} failed`);
}

// Deduplicate by trail ID (keep first occurrence)
const seen = new Set<string>();
const deduplicated: TrailData[] = [];
let dupeCount = 0;

for (const trail of allTrails) {
  if (!seen.has(trail.id)) {
    seen.add(trail.id);
    deduplicated.push(trail);
  } else {
    dupeCount++;
    console.log(`  Duplicate removed: ${trail.name} (${trail.id})`);
  }
}

// Sort by country, then alphabetically by name
deduplicated.sort((a, b) => {
  if (a.country !== b.country) return a.country.localeCompare(b.country);
  return a.name.localeCompare(b.name);
});

// Summary by country
const byCountry = new Map<string, number>();
for (const trail of deduplicated) {
  byCountry.set(trail.country, (byCountry.get(trail.country) || 0) + 1);
}

// Source breakdown
const bySource = new Map<string, number>();
for (const trail of deduplicated) {
  const source = trail.dataSource || 'unknown';
  bySource.set(source, (bySource.get(source) || 0) + 1);
}

console.log(`\n=== MERGE SUMMARY ===`);
console.log(`Total successful trails: ${allTrails.length}`);
console.log(`Duplicates removed: ${dupeCount}`);
console.log(`Final unique trails: ${deduplicated.length}`);
console.log(`Failed trails: ${failedTrails.length}`);

console.log(`\nBy country:`);
for (const [country, count] of [...byCountry.entries()].sort()) {
  console.log(`  ${country}: ${count}`);
}

console.log(`\nBy data source:`);
for (const [source, count] of [...bySource.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${source}: ${count}`);
}

// Write merged output
const outputPath = join(resultsDir, 'all-trails-merged.json');
writeFileSync(outputPath, JSON.stringify(deduplicated, null, 2));
console.log(`\nMerged output: ${outputPath}`);

// Write failed trails list
const failedPath = join(resultsDir, 'failed-trails-list.json');
writeFileSync(failedPath, JSON.stringify(failedTrails, null, 2));
console.log(`Failed trails list: ${failedPath}`);
