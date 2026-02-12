// Wire Europe trails into the app (add to lazyTrailIds, add entries to popularTrails.ts)
// Usage: npx tsx scripts/trail-curation/wire-europe-lazy.ts

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const POPULAR_TRAILS_PATH = join(process.cwd(), 'app', 'data', 'popularTrails.ts');
const TRAIL_DATA_DIR = join(process.cwd(), 'public', 'trail-data');

// Load progress to get the list of succeeded trail IDs
const progress = JSON.parse(
  readFileSync(join(process.cwd(), 'scripts', 'trail-curation', 'results', 'europe-batch-progress.json'), 'utf-8')
);

const EUROPE_IDS = progress.results.map((r: any) => r.id as string);
console.log(`Europe trail IDs to wire: ${EUROPE_IDS.length}`);

// Load trail list for metadata
const trailList = JSON.parse(
  readFileSync(join(process.cwd(), 'scripts', 'trail-curation', 'trail-lists', 'europe-trails.json'), 'utf-8')
);

function toId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// Read current popularTrails.ts
let content = readFileSync(POPULAR_TRAILS_PATH, 'utf-8');

// Add Europe IDs to lazyTrailIds (after UK comment)
const ukLine = content.match(/  \/\/ UK\n  [^\n]+/);
if (ukLine) {
  const europeIds = EUROPE_IDS.map((id: string) => `'${id}'`).join(', ');
  const europeSection = `${ukLine[0]}\n  // Europe\n  ${europeIds},`;
  content = content.replace(ukLine[0], europeSection);
  console.log(`Added ${EUROPE_IDS.length} Europe IDs to lazyTrailIds`);
} else {
  console.log('WARNING: Could not find UK section in lazyTrailIds');
}

// Build entries grouped by country
const countryNames: Record<string, string> = {
  FR: 'France', IT: 'Italy', CH: 'Switzerland', ES: 'Spain', PT: 'Portugal',
  AT: 'Austria', DE: 'Germany', SE: 'Sweden', IS: 'Iceland', NO: 'Norway',
  GR: 'Greece', TR: 'Turkey',
};

const newEntries: string[] = [];
let addedCount = 0;

for (const trail of trailList) {
  const id = toId(trail.name);
  if (!EUROPE_IDS.includes(id)) continue; // Only add trails we successfully fetched
  if (content.includes(`id: '${id}'`)) {
    console.log(`  Already exists: ${id}`);
    continue;
  }

  const entry = `  {
    id: '${id}',
    name: '${trail.name.replace(/'/g, "\\'")}',
    region: '${trail.region.replace(/'/g, "\\'")}',
    country: '${trail.country}',
    distance_km: ${trail.officialDistanceKm},
    typical_days: '${trail.typicalDays}',
    coordinates: []
  }`;
  newEntries.push(entry);
  addedCount++;
}

// Insert Europe entries before the closing bracket
if (newEntries.length > 0) {
  const lastBracket = content.lastIndexOf('\n];');
  if (lastBracket >= 0) {
    const europeEntriesBlock = `,\n  // --- Europe ---\n${newEntries.join(',\n')}`;
    content = content.substring(0, lastBracket) + europeEntriesBlock + '\n];' + content.substring(lastBracket + 3);
  }
}

writeFileSync(POPULAR_TRAILS_PATH, content);
console.log(`\nWired ${addedCount} new Europe trail entries`);
console.log(`Total lazyTrailIds now includes ${EUROPE_IDS.length} Europe trails`);

// Verify
const updated = readFileSync(POPULAR_TRAILS_PATH, 'utf-8');
const europeCount = (updated.match(/\/\/ --- Europe ---/g) || []).length;
console.log(`Europe section count in entries: ${europeCount}`);
