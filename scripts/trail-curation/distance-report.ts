// Distance validation report for all trails in popularTrails.ts
// Usage: npx tsx scripts/trail-curation/distance-report.ts

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { calculateTrailDistance } from './validate-trails.js';

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
}

// Parse popularTrails.ts
const trailsFilePath = join(__dirname, '../../app/data/popularTrails.ts');
const fileContent = readFileSync(trailsFilePath, 'utf8');

const arrayMatch = fileContent.match(/export const popularTrails: TrailData\[\] = \[([\s\S]*)\];/);
if (!arrayMatch) {
  console.error('Could not parse popularTrails.ts');
  process.exit(1);
}

const trails: TrailData[] = new Function(`return [${arrayMatch[1]}]`)();
console.log(`Loaded ${trails.length} trails from popularTrails.ts`);

// Load merged results for data source info
const mergedPath = join(__dirname, 'results', 'all-trails-merged.json');
let sourceMap = new Map<string, string>();
try {
  const merged = JSON.parse(readFileSync(mergedPath, 'utf8'));
  for (const t of merged) {
    sourceMap.set(t.id, t.dataSource || 'unknown');
  }
} catch {
  console.log('No merged results found, sources will show as unknown');
}

const COUNTRY_NAMES: Record<string, string> = {
  AU: 'Australia', CA: 'Canada', CH: 'Switzerland', DE: 'Germany',
  FR: 'France', GB: 'United Kingdom', IT: 'Italy', JP: 'Japan',
  NZ: 'New Zealand', ZA: 'South Africa', US: 'United States',
};

interface TrailReport {
  name: string;
  country: string;
  officialKm: number;
  calculatedKm: number;
  percentDiff: number;
  source: string;
  status: 'PASS' | 'FLAG' | 'WARN';
  points: number;
}

const reports: TrailReport[] = [];

for (const trail of trails) {
  const calculatedKm = calculateTrailDistance(trail.coordinates);
  const percentDiff = trail.distance_km > 0
    ? ((calculatedKm - trail.distance_km) / trail.distance_km) * 100
    : 0;

  const source = sourceMap.get(trail.id) || 'old_data';

  let status: 'PASS' | 'FLAG' | 'WARN' = 'PASS';
  if (percentDiff < -2) status = 'FLAG'; // too short
  if (percentDiff > 20) status = 'WARN'; // too long

  reports.push({
    name: trail.name,
    country: trail.country,
    officialKm: trail.distance_km,
    calculatedKm,
    percentDiff,
    source,
    status,
    points: trail.coordinates.length,
  });
}

// Summary
const passed = reports.filter(r => r.status === 'PASS').length;
const flagged = reports.filter(r => r.status === 'FLAG').length;
const warned = reports.filter(r => r.status === 'WARN').length;

// Source breakdown
const sourceCounts = new Map<string, number>();
for (const r of reports) {
  sourceCounts.set(r.source, (sourceCounts.get(r.source) || 0) + 1);
}

// Generate markdown report
const lines: string[] = [];
lines.push('# Trail Distance Validation Report');
lines.push('');
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push(`Total trails: ${reports.length}`);
lines.push('');

lines.push('## Summary');
lines.push('');
lines.push(`| Metric | Count | Percentage |`);
lines.push(`|--------|-------|------------|`);
lines.push(`| Passed (within 2%) | ${passed} | ${(100 * passed / reports.length).toFixed(1)}% |`);
lines.push(`| Flagged (>2% short) | ${flagged} | ${(100 * flagged / reports.length).toFixed(1)}% |`);
lines.push(`| Warned (>20% long) | ${warned} | ${(100 * warned / reports.length).toFixed(1)}% |`);
lines.push('');

lines.push('## Data Source Attribution');
lines.push('');
lines.push('| Source | Count | Percentage |');
lines.push('|--------|-------|------------|');
const sortedSources = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]);
for (const [source, count] of sortedSources) {
  lines.push(`| ${source} | ${count} | ${(100 * count / reports.length).toFixed(1)}% |`);
}
lines.push(`| **Total** | **${reports.length}** | **100%** |`);
lines.push('');

lines.push('## Distance Validation Table');
lines.push('');
lines.push('| Country | Trail | Official (km) | Calculated (km) | Diff (%) | Points | Source | Status |');
lines.push('|---------|-------|---------------|-----------------|----------|--------|--------|--------|');

// Sort: flagged first, then by country
const sorted = [...reports].sort((a, b) => {
  if (a.status !== b.status) {
    const order = { FLAG: 0, WARN: 1, PASS: 2 };
    return order[a.status] - order[b.status];
  }
  if (a.country !== b.country) return a.country.localeCompare(b.country);
  return a.name.localeCompare(b.name);
});

for (const r of sorted) {
  lines.push(`| ${r.country} | ${r.name} | ${r.officialKm} | ${r.calculatedKm.toFixed(1)} | ${r.percentDiff.toFixed(1)}% | ${r.points} | ${r.source} | ${r.status} |`);
}

lines.push('');

const reportPath = join(__dirname, 'VALIDATION-REPORT.md');
writeFileSync(reportPath, lines.join('\n'));

console.log(`\n=== VALIDATION SUMMARY ===`);
console.log(`Total trails: ${reports.length}`);
console.log(`Passed: ${passed} (${(100 * passed / reports.length).toFixed(1)}%)`);
console.log(`Flagged (>2% short): ${flagged} (${(100 * flagged / reports.length).toFixed(1)}%)`);
console.log(`Warned (>20% long): ${warned} (${(100 * warned / reports.length).toFixed(1)}%)`);
console.log(`\nReport written to: ${reportPath}`);
