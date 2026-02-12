// Replace inline coordinates with empty arrays for NZ trails that have data files
// Also adds NZ trail IDs to lazyTrailIds, removes duplicates, adds missing entries
// Usage: npx tsx scripts/trail-curation/wire-nz-lazy.ts

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const POPULAR_TRAILS_PATH = join(process.cwd(), 'app', 'data', 'popularTrails.ts');
const TRAIL_DATA_DIR = join(process.cwd(), 'public', 'trail-data');

// IDs that have data files in public/trail-data/
const NZ_LAZY_IDS = [
  'abel_tasman_coast_track', 'ben_lomond_track', 'cape_brett_track',
  'heaphy_track', 'hollyford_track', 'hooker_valley_track',
  'kepler_track', 'key_summit_track', 'lake_waikaremoana_great_walk',
  'matemateaonga_track', 'milford_track', 'mt_holdsworth_jumbo_circuit',
  'mueller_hut_route', 'old_ghost_road', 'paparoa_track',
  'pinnacles_walk', 'queen_charlotte_track', 'rakiura_track',
  'reesdart_track', 'routeburn_track', 'tama_lakes_track',
  'tongariro_alpine_crossing', 'tongariro_northern_circuit',
];

// Duplicate IDs to remove (keeping the _track/_great_walk versions)
const DUPLICATE_IDS = ['abel_tasman', 'lake_waikaremoana'];

// New entries not yet in popularTrails.ts
const NEW_ENTRIES = [
  {
    id: 'key_summit_track',
    name: 'Key Summit Track',
    region: 'Fiordland',
    country: 'NZ',
    distance_km: 3,
    typical_days: '0.5',
  },
];

let content = readFileSync(POPULAR_TRAILS_PATH, 'utf-8');

// 1. Replace coordinates with [] for existing NZ trails
let replaced = 0;
for (const id of NZ_LAZY_IDS) {
  if (!existsSync(join(TRAIL_DATA_DIR, `${id}.json`))) {
    console.log(`WARNING: No data file for ${id}`);
    continue;
  }

  const idPattern = `id: '${id}'`;
  const idIdx = content.indexOf(idPattern);
  if (idIdx === -1) {
    // Might be a new entry (added below)
    if (!NEW_ENTRIES.find(e => e.id === id)) {
      console.log(`WARNING: Trail ID '${id}' not found in popularTrails.ts`);
    }
    continue;
  }

  const searchStart = idIdx;
  const coordStart = content.indexOf('coordinates: [', searchStart);
  if (coordStart === -1 || coordStart > searchStart + 2000) {
    console.log(`WARNING: coordinates not found near ${id}`);
    continue;
  }

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

// 2. Remove duplicate entries
for (const dupeId of DUPLICATE_IDS) {
  const dupePattern = new RegExp(`\\s*\\{\\s*id:\\s*'${dupeId}',(?:(?!\\{\\s*id:)[\\s\\S])*?coordinates:\\s*\\[[^\\]]*\\]\\s*\\},?`, 'm');
  const dupeMatch = content.match(dupePattern);
  if (dupeMatch) {
    content = content.replace(dupePattern, '');
    console.log(`REMOVED duplicate: ${dupeId} (${dupeMatch[0].length} chars)`);
  }
}

// 3. Add NZ lazy IDs to the lazyTrailIds set
const lazySetEnd = content.indexOf("]);", content.indexOf("lazyTrailIds"));
if (lazySetEnd !== -1) {
  // Find the last line before ]);
  const beforeEnd = content.lastIndexOf('\n', lazySetEnd);
  const nzIds = NZ_LAZY_IDS.map(id => `'${id}'`).join(', ');
  const nzLine = `  // NZ\n  ${nzIds},`;

  // Check if NZ section already exists
  if (!content.includes("// NZ\n")) {
    content = content.slice(0, beforeEnd + 1) + nzLine + '\n' + content.slice(beforeEnd + 1);
    console.log(`ADDED ${NZ_LAZY_IDS.length} NZ IDs to lazyTrailIds`);
  } else {
    console.log(`SKIP: NZ IDs already in lazyTrailIds`);
  }
}

// 4. Add new entries to popularTrails.ts
for (const entry of NEW_ENTRIES) {
  if (content.includes(`id: '${entry.id}'`)) {
    console.log(`SKIP: ${entry.id} already exists in popularTrails.ts`);
    continue;
  }

  // Insert before the end of the NZ section (or before closing bracket)
  // Find the last NZ entry
  const lastNzIdx = content.lastIndexOf("country: 'NZ'");
  if (lastNzIdx !== -1) {
    // Find the closing }, of that entry
    const entryEnd = content.indexOf('},', lastNzIdx);
    if (entryEnd !== -1) {
      const newEntry = `\n  {\n    id: '${entry.id}',\n    name: '${entry.name}',\n    region: '${entry.region}',\n    country: '${entry.country}',\n    distance_km: ${entry.distance_km},\n    typical_days: '${entry.typical_days}',\n    coordinates: [],\n  },`;
      content = content.slice(0, entryEnd + 2) + newEntry + content.slice(entryEnd + 2);
      console.log(`ADDED new entry: ${entry.id}`);
    }
  }
}

writeFileSync(POPULAR_TRAILS_PATH, content);
console.log(`\nDone: ${replaced} trails converted to lazy loading`);

// Verify no duplicate IDs
const idMatches = content.match(/id: '([^']+)'/g) || [];
const ids = idMatches.map(m => m.replace("id: '", '').replace("'", ''));
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length > 0) {
  console.log(`\nWARNING: Duplicate IDs found: ${[...new Set(dupes)].join(', ')}`);
} else {
  console.log(`\nAll IDs unique (${ids.length} total entries)`);
}
