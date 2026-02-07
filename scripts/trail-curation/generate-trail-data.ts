// Generate popularTrails.ts from merged results + old data as fallback
// Usage: npx tsx scripts/trail-curation/generate-trail-data.ts

import { readFileSync, writeFileSync } from 'fs';
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

const COUNTRY_NAMES: Record<string, string> = {
  AU: 'Australia',
  CA: 'Canada',
  CH: 'Switzerland',
  DE: 'Germany',
  FR: 'France',
  GB: 'United Kingdom',
  IT: 'Italy',
  JP: 'Japan',
  NZ: 'New Zealand',
  ZA: 'South Africa',
  US: 'United States',
};

// Read merged results
const mergedPath = join(__dirname, 'results', 'all-trails-merged.json');
const newTrails: TrailData[] = JSON.parse(readFileSync(mergedPath, 'utf8'));
console.log(`Loaded ${newTrails.length} new trails from merged results`);

// Parse old popularTrails.ts to extract existing trail data as fallback
const oldFilePath = join(__dirname, '../../app/data/popularTrails.ts');
const oldFileContent = readFileSync(oldFilePath, 'utf8');

// Extract array content between "export const popularTrails: TrailData[] = [" and the final "];"
const arrayMatch = oldFileContent.match(/export const popularTrails: TrailData\[\] = \[([\s\S]*)\];/);
if (!arrayMatch) {
  console.error('Could not parse old popularTrails.ts');
  process.exit(1);
}

// Use a simpler approach: eval the array (safe since we control the file)
const oldTrailsStr = `[${arrayMatch[1]}]`;
// Replace single quotes with double quotes for JSON compatibility isn't reliable
// Instead, use Function constructor to evaluate as JS
const evalTrails = new Function(`return ${oldTrailsStr}`)();
const oldTrails: TrailData[] = evalTrails;
console.log(`Loaded ${oldTrails.length} old trails as fallback`);

// Build set of new trail IDs
const newTrailIds = new Set(newTrails.map(t => t.id));

// Find old trails not in new set (these are fallbacks)
const fallbackTrails = oldTrails.filter(t => !newTrailIds.has(t.id));
console.log(`${fallbackTrails.length} old trails will be kept as fallback (not in new data)`);

// Combine: new trails + fallback old trails
const allTrails = [...newTrails, ...fallbackTrails];

// Sort by country (in display order), then by name
const countryOrder = Object.keys(COUNTRY_NAMES).sort((a, b) =>
  COUNTRY_NAMES[a].localeCompare(COUNTRY_NAMES[b])
);

allTrails.sort((a, b) => {
  const aIdx = countryOrder.indexOf(a.country);
  const bIdx = countryOrder.indexOf(b.country);
  if (aIdx !== bIdx) return aIdx - bIdx;
  return a.name.localeCompare(b.name);
});

// Final dedup check
const seenIds = new Set<string>();
const finalTrails: TrailData[] = [];
for (const trail of allTrails) {
  if (!seenIds.has(trail.id)) {
    seenIds.add(trail.id);
    finalTrails.push(trail);
  }
}

// Count by country
const byCountry = new Map<string, number>();
for (const trail of finalTrails) {
  byCountry.set(trail.country, (byCountry.get(trail.country) || 0) + 1);
}

console.log(`\nFinal trail count: ${finalTrails.length}`);
console.log('By country:');
for (const code of countryOrder) {
  console.log(`  ${COUNTRY_NAMES[code]} (${code}): ${byCountry.get(code) || 0}`);
}

// Generate TypeScript source
function formatCoord(coord: [number, number, number]): string {
  const lng = Number(coord[0].toFixed(3));
  const lat = Number(coord[1].toFixed(3));
  const ele = Math.round(coord[2]);
  return `[${lng}, ${lat}, ${ele}]`;
}

function formatTrail(trail: TrailData): string {
  const lines: string[] = [];
  lines.push('  {');
  lines.push(`    id: '${trail.id}',`);
  lines.push(`    name: '${trail.name.replace(/'/g, "\\'")}',`);
  lines.push(`    region: '${trail.region.replace(/'/g, "\\'")}',`);
  lines.push(`    country: '${trail.country}',`);
  lines.push(`    distance_km: ${trail.distance_km},`);
  lines.push(`    typical_days: '${trail.typical_days}',`);

  // Format coordinates - 3 per line
  lines.push('    coordinates: [');
  const coordStrs = trail.coordinates.map(formatCoord);
  for (let i = 0; i < coordStrs.length; i += 3) {
    const chunk = coordStrs.slice(i, i + 3).join(', ');
    const comma = i + 3 < coordStrs.length ? ',' : '';
    lines.push(`      ${chunk}${comma}`);
  }
  lines.push('    ]');
  lines.push('  }');
  return lines.join('\n');
}

// Build the file content
const outputLines: string[] = [];

outputLines.push('// Trail coordinate data sourced from:');
outputLines.push('// - OpenStreetMap (openstreetmap.org) - Data (c) OpenStreetMap contributors, licensed under ODbL');
outputLines.push('// - Waymarked Trails (waymarkedtrails.org) - OSM data with trail-level search');
outputLines.push('// - USDA Forest Service (fs.usda.gov) - Public domain');
outputLines.push('// - National Park Service (nps.gov) - Public domain');
outputLines.push('// - Department of Conservation NZ (doc.govt.nz) - CC BY 4.0');
outputLines.push('// - Parks Canada (parks.canada.ca) - Open Government Licence');
outputLines.push('// Coordinates simplified for use as visual planning aids only');
outputLines.push('');
outputLines.push('export interface TrailData {');
outputLines.push('  id: string;');
outputLines.push('  name: string;');
outputLines.push('  region: string;');
outputLines.push('  country: string;');
outputLines.push('  distance_km: number;');
outputLines.push('  typical_days: string;');
outputLines.push('  coordinates: [number, number, number][]; // [lng, lat, elevation]');
outputLines.push('}');
outputLines.push('');
outputLines.push('export const popularTrails: TrailData[] = [');

let currentCountry = '';
const trailStrings: string[] = [];

for (const trail of finalTrails) {
  if (trail.country !== currentCountry) {
    currentCountry = trail.country;
    const countryName = COUNTRY_NAMES[currentCountry] || currentCountry;
    trailStrings.push(`  // ============================================`);
    trailStrings.push(`  // ${countryName.toUpperCase()}`);
    trailStrings.push(`  // ============================================`);
  }
  trailStrings.push(formatTrail(trail));
}

outputLines.push(trailStrings.join(',\n'));
outputLines.push('];');
outputLines.push('');

const outputPath = join(__dirname, '../../app/data/popularTrails.ts');
writeFileSync(outputPath, outputLines.join('\n'));
console.log(`\nGenerated: ${outputPath}`);
console.log(`Total trails: ${finalTrails.length}`);
