// Wire UK trails into the app (add to lazyTrailIds, add entries to popularTrails.ts)
// Usage: npx tsx scripts/trail-curation/wire-uk-lazy.ts

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const POPULAR_TRAILS_PATH = join(process.cwd(), 'app', 'data', 'popularTrails.ts');
const TRAIL_DATA_DIR = join(process.cwd(), 'public', 'trail-data');

// Load progress to get the list of succeeded trail IDs
const progress = JSON.parse(
  readFileSync(join(process.cwd(), 'scripts', 'trail-curation', 'results', 'uk-batch-progress.json'), 'utf-8')
);

const UK_LAZY_IDS = progress.results.map((r: any) => r.id as string);
console.log(`UK trail IDs to wire: ${UK_LAZY_IDS.length}`);

// Read current popularTrails.ts
let content = readFileSync(POPULAR_TRAILS_PATH, 'utf-8');

// Add UK IDs to lazyTrailIds (after South Africa comment)
const saLine = "  // South Africa\n  'drakensberg_grand_traverse',";
const ukIds = UK_LAZY_IDS.map((id: string) => `'${id}'`).join(', ');
const ukSection = `${saLine}\n  // UK\n  ${ukIds},`;
content = content.replace(saLine, ukSection);

// Add trail entries for any that don't already exist in the file
const trailList = JSON.parse(
  readFileSync(join(process.cwd(), 'scripts', 'trail-curation', 'trail-lists', 'uk-trails.json'), 'utf-8')
);

function toId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// Build entries for UK trails
const newEntries: string[] = [];
for (const trail of trailList) {
  const id = toId(trail.name);
  if (!UK_LAZY_IDS.includes(id)) continue; // Only add trails we successfully fetched
  if (content.includes(`id: '${id}'`)) {
    console.log(`  Already exists: ${id}`);
    continue;
  }

  const entry = `  {
    id: '${id}',
    name: '${trail.name.replace(/'/g, "\\'")}',
    region: '${trail.region}',
    country: 'GB',
    distance_km: ${trail.officialDistanceKm},
    typical_days: '${trail.typicalDays} ${typeof trail.typicalDays === 'number' || /^\d+$/.test(String(trail.typicalDays)) ? (trail.typicalDays === 1 || trail.typicalDays === '1' ? 'day' : 'days') : ''}',
    coordinates: []
  }`;
  newEntries.push(entry);
}

// Find the closing bracket of the array and insert before it
if (newEntries.length > 0) {
  // Find the South Africa section we already added and insert UK after it
  const saEntryEnd = "  // --- South Africa ---";
  if (content.includes(saEntryEnd)) {
    // Find the DGT entry end, then insert UK entries after
    const dgtEnd = `    coordinates: []\n  }\n];`;
    const ukEntriesBlock = `,\n  // --- UK ---\n${newEntries.join(',\n')}`;
    // Replace the last occurrence of closing bracket
    const lastBracket = content.lastIndexOf('\n];');
    if (lastBracket >= 0) {
      content = content.substring(0, lastBracket) + ukEntriesBlock + '\n];' + content.substring(lastBracket + 3);
    }
  }
}

// Clean up typical_days formatting (remove trailing space if no days/day suffix needed)
content = content.replace(/'(\d+-\d+) '/g, "'$1'");
content = content.replace(/'(\d+-\d+\s*days?\s*) '/g, (_, m) => `'${m.trim()}'`);

writeFileSync(POPULAR_TRAILS_PATH, content);
console.log(`\nWired ${newEntries.length} new UK trail entries`);
console.log(`Total lazyTrailIds now includes ${UK_LAZY_IDS.length} UK trails`);

// Verify
const updated = readFileSync(POPULAR_TRAILS_PATH, 'utf-8');
const lazyCount = (updated.match(/\/\/ UK\n/g) || []).length;
console.log(`UK section count in lazyTrailIds: ${lazyCount}`);
