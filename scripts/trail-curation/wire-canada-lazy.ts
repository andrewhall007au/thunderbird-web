// Replace inline coordinates with empty arrays for Canadian trails that have data files
// Also removes the la_cloche_silhouette duplicate entry
// Usage: npx tsx scripts/trail-curation/wire-canada-lazy.ts

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const POPULAR_TRAILS_PATH = join(process.cwd(), 'app', 'data', 'popularTrails.ts');
const TRAIL_DATA_DIR = join(process.cwd(), 'public', 'trail-data');

// IDs that have data files in public/trail-data/
const LAZY_IDS = [
  'berg_lake_trail', 'bruce_trail_bruce_peninsula', 'chilkoot_trail',
  'crypt_lake_trail', 'east_coast_trail', 'fundy_footpath',
  'garibaldi_lake_trail', 'golden_ears_trail', 'howe_sound_crest_trail',
  'joffre_lakes_trail', 'juan_de_fuca_marine_trail', 'la_cloche_silhouette_trail',
  'long_range_traverse', 'mantario_trail', 'plain_of_six_glaciers_trail',
  'sentinel_pass_trail', 'skyline_trail_jasper', 'stein_valley_traverse',
  'sunshine_coast_trail', 'tablelands_trail', 'west_coast_trail',
];

let content = readFileSync(POPULAR_TRAILS_PATH, 'utf-8');

// For each lazy ID, find its entry and replace coordinates with empty array
let replaced = 0;
for (const id of LAZY_IDS) {
  // Verify the data file exists
  if (!existsSync(join(TRAIL_DATA_DIR, `${id}.json`))) {
    console.log(`WARNING: No data file for ${id}`);
    continue;
  }

  // Match the coordinates array for this trail entry
  // The pattern: find `id: '${id}'` then find the `coordinates: [...]` within that entry
  const idPattern = `id: '${id}'`;
  const idIdx = content.indexOf(idPattern);
  if (idIdx === -1) {
    console.log(`WARNING: Trail ID '${id}' not found in popularTrails.ts`);
    continue;
  }

  // Find the coordinates: [ ... ] within the next ~500 chars (allowing for nested arrays)
  const searchStart = idIdx;
  const coordStart = content.indexOf('coordinates: [', searchStart);
  if (coordStart === -1 || coordStart > searchStart + 2000) {
    console.log(`WARNING: coordinates not found near ${id}`);
    continue;
  }

  // Find the matching closing bracket
  let depth = 0;
  let coordArrayStart = coordStart + 'coordinates: '.length;
  let coordArrayEnd = -1;
  for (let i = coordArrayStart; i < content.length; i++) {
    if (content[i] === '[') depth++;
    if (content[i] === ']') {
      depth--;
      if (depth === 0) {
        coordArrayEnd = i + 1;
        break;
      }
    }
  }

  if (coordArrayEnd === -1) {
    console.log(`WARNING: Could not find end of coordinates for ${id}`);
    continue;
  }

  const oldCoords = content.slice(coordArrayStart, coordArrayEnd);
  if (oldCoords === '[]') {
    console.log(`SKIP: ${id} already has empty coordinates`);
    continue;
  }

  content = content.slice(0, coordArrayStart) + '[]' + content.slice(coordArrayEnd);
  replaced++;
  console.log(`REPLACED: ${id} (${oldCoords.length} chars → [])`);
}

// Remove the la_cloche_silhouette duplicate (keep la_cloche_silhouette_trail)
const dupePattern = /\s*\{\s*id:\s*'la_cloche_silhouette',[\s\S]*?coordinates:\s*\[[\s\S]*?\]\s*\},?/;
const dupeMatch = content.match(dupePattern);
if (dupeMatch) {
  content = content.replace(dupePattern, '');
  console.log(`REMOVED: la_cloche_silhouette duplicate (${dupeMatch[0].length} chars)`);
}

writeFileSync(POPULAR_TRAILS_PATH, content);
console.log(`\nDone: ${replaced} trails converted to lazy loading`);
