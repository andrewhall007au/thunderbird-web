// Export trail data as CSV for Google Sheets
// Usage: npx tsx scripts/trail-curation/export-csv.ts

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

function haversineDistance(c1: [number, number], c2: [number, number]): number {
  const R = 6371;
  const [lon1, lat1] = c1;
  const [lon2, lat2] = c2;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcDistance(coords: [number, number, number][]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineDistance([coords[i - 1][0], coords[i - 1][1]], [coords[i][0], coords[i][1]]);
  }
  return total;
}

const SOURCE_NAMES: Record<string, string> = {
  osm: 'OpenStreetMap (Overpass API)',
  waymarked_trails: 'OpenStreetMap (Waymarked Trails API)',
  nps_trails: 'National Park Service (US)',
  usfs_trails: 'USDA Forest Service (US)',
  doc_tracks: 'Dept of Conservation (NZ)',
  parks_canada: 'Parks Canada',
  old_data: 'Unverified (pre-existing data)',
};

const COUNTRIES: Record<string, string> = {
  AU: 'Australia', CA: 'Canada', CH: 'Switzerland', DE: 'Germany',
  FR: 'France', GB: 'United Kingdom', IT: 'Italy', JP: 'Japan',
  NZ: 'New Zealand', ZA: 'South Africa', US: 'United States',
};

// Parse popularTrails.ts
const trailsFile = readFileSync(join(__dirname, '../../app/data/popularTrails.ts'), 'utf8');
const arrayMatch = trailsFile.match(/export const popularTrails: TrailData\[\] = \[([\s\S]*)\];/);
if (!arrayMatch) { console.error('Could not parse'); process.exit(1); }
const trails: TrailData[] = new Function(`return [${arrayMatch[1]}]`)();

// Load source map
const sourceMap = new Map<string, string>();
try {
  const merged: TrailData[] = JSON.parse(readFileSync(join(__dirname, 'results', 'all-trails-merged.json'), 'utf8'));
  for (const t of merged) sourceMap.set(t.id, t.dataSource || 'unknown');
} catch {}

// Build CSV
const rows: string[] = [];
rows.push('Trail Name,Country,Status,GPX Source,Trail Length (GPX km),Trail Length (Official km),Elevation Low (m),Elevation High (m)');

for (const trail of trails) {
  const source = sourceMap.get(trail.id) || 'old_data';
  const sourceName = SOURCE_NAMES[source] || source;
  const verified = source !== 'old_data' ? 'Verified' : 'Unverified';
  const gpxLength = calcDistance(trail.coordinates);
  const elevations = trail.coordinates.map(c => c[2]);
  const hasElevation = elevations.some(e => e !== 0);
  const elevLow = hasElevation ? Math.min(...elevations) : '';
  const elevHigh = hasElevation ? Math.max(...elevations) : '';

  const esc = (s: string) => s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;

  rows.push([
    esc(trail.name),
    COUNTRIES[trail.country] || trail.country,
    verified,
    sourceName,
    gpxLength.toFixed(1),
    trail.distance_km,
    elevLow,
    elevHigh,
  ].join(','));
}

const csvPath = join(__dirname, '../../trail-data-export.csv');
writeFileSync(csvPath, rows.join('\n'));
console.log(`CSV exported: ${csvPath}`);
console.log(`${trails.length} trails (${rows.length - 1} rows)`);
const verifiedCount = rows.filter(r => r.includes(',Verified,')).length;
const unverifiedCount = rows.filter(r => r.includes(',Unverified,')).length;
console.log(`Verified: ${verifiedCount}, Unverified: ${unverifiedCount}`);
