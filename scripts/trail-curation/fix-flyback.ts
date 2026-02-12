// Fix flyback lines: after chaining, some trails have a straight line jumping
// back to the start (orphan segments getting chained to the end). This script
// splits at large gaps and keeps only the longest continuous section.
// Usage: npx tsx scripts/trail-curation/fix-flyback.ts

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const TRAIL_DATA_DIR = join(process.cwd(), 'public', 'trail-data');
const GAP_KM = 2; // Gaps >2km indicate flyback or disconnected segments

interface TrailData {
  id: string;
  name: string;
  region: string;
  country: string;
  distance_km: number;
  typical_days: string;
  coordinates: [number, number, number][];
  dataSource: string;
  calculatedKm: number;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function totalDistance(coords: [number, number, number][]): number {
  let d = 0;
  for (let i = 1; i < coords.length; i++) {
    d += haversine(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
  }
  return d;
}

// Split coordinates at large gaps, return sections
function splitAtGaps(coords: [number, number, number][], gapKm: number): [number, number, number][][] {
  if (coords.length === 0) return [];
  const sections: [number, number, number][][] = [];
  let current: [number, number, number][] = [coords[0]];

  for (let i = 1; i < coords.length; i++) {
    const gap = haversine(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
    if (gap > gapKm) {
      sections.push(current);
      current = [coords[i]];
    } else {
      current.push(coords[i]);
    }
  }
  if (current.length > 0) sections.push(current);
  return sections;
}

// Load official distances
function loadOfficialDistances(): Map<string, number> {
  const trailList = JSON.parse(
    readFileSync(join(process.cwd(), 'scripts', 'trail-curation', 'trail-lists', 'australia-mainland-top25.json'), 'utf-8')
  );
  const map = new Map<string, number>();
  for (const t of trailList) {
    const id = t.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    map.set(id, t.officialDistanceKm);
  }
  return map;
}

async function main() {
  const officialDistances = loadOfficialDistances();

  const tasmaniaIds = new Set([
    'overland_track', 'south_coast_track', 'western_arthur_range_traverse',
    'frenchmans_cap', 'mount_anne_circuit', 'federation_peak',
    'port_davey_track', 'three_capes_track', 'eastern_arthur_range_traverse',
    'freycinet_peninsula_circuit', 'walls_of_jerusalem', 'tasman_cape_pillar',
    'leeaberra_track', 'lake_rhona', 'point_lesueur_walk', 'mount_maria_walk',
  ]);

  const files = readdirSync(TRAIL_DATA_DIR)
    .filter(f => f.endsWith('.json') && f !== 'manifest.json');

  let fixedCount = 0;

  for (const file of files) {
    const id = file.replace('.json', '');
    if (tasmaniaIds.has(id)) continue;

    const filePath = join(TRAIL_DATA_DIR, file);
    let trail: TrailData;
    try {
      trail = JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch { continue; }
    if (!trail.coordinates || !trail.calculatedKm || !trail.name) continue;

    const officialKm = officialDistances.get(id) || trail.distance_km;
    const currentError = Math.abs(trail.calculatedKm - officialKm) / officialKm;

    // Split at gaps
    const sections = splitAtGaps(trail.coordinates, GAP_KM);
    if (sections.length <= 1) continue; // No gaps found

    // Find the longest section by distance
    let longestIdx = 0;
    let longestDist = 0;
    for (let i = 0; i < sections.length; i++) {
      const d = totalDistance(sections[i]);
      if (d > longestDist) {
        longestDist = d;
        longestIdx = i;
      }
    }

    const longest = sections[longestIdx];
    const newKm = totalDistance(longest);
    const newError = Math.abs(newKm - officialKm) / officialKm;

    // Only keep if it improves accuracy
    if (newError >= currentError) continue;

    // Report
    const removedSections = sections.filter((_, i) => i !== longestIdx);
    const removedPts = trail.coordinates.length - longest.length;
    const removedKm = trail.calculatedKm - newKm;

    console.log(`FIX  ${trail.name}`);
    console.log(`     ${sections.length} sections found (gaps >${GAP_KM}km)`);
    console.log(`     Keeping longest: ${longest.length} pts, ${newKm.toFixed(1)}km`);
    console.log(`     Removed: ${removedPts} pts, ${removedKm.toFixed(1)}km of flyback/fragments (${removedSections.length} sections)`);
    console.log(`     ${trail.calculatedKm.toFixed(1)}km → ${newKm.toFixed(1)}km (official ${officialKm}km, ${(newError * 100).toFixed(1)}% off)`);

    trail.coordinates = longest;
    trail.calculatedKm = newKm;
    writeFileSync(filePath, JSON.stringify(trail, null, 2));
    console.log(`     SAVED ✓\n`);
    fixedCount++;
  }

  if (fixedCount === 0) {
    console.log('No flyback issues found (all trails have continuous coordinates).');
  } else {
    console.log(`Fixed ${fixedCount} trails.`);

    // Update manifest
    const manifestPath = join(TRAIL_DATA_DIR, 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    for (const entry of manifest) {
      try {
        const data: TrailData = JSON.parse(readFileSync(join(TRAIL_DATA_DIR, `${entry.id}.json`), 'utf-8'));
        entry.calculatedKm = data.calculatedKm;
        entry.pointCount = data.coordinates.length;
        const elevs = data.coordinates.map((c: number[]) => c[2]);
        entry.elevationLow = Math.min(...elevs);
        entry.elevationHigh = Math.max(...elevs);
      } catch {}
    }
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log('Manifest updated.');
  }

  // Final status report
  console.log('\n=== FINAL STATUS ===');
  for (const file of files) {
    const id = file.replace('.json', '');
    if (tasmaniaIds.has(id)) continue;
    try {
      const t: TrailData = JSON.parse(readFileSync(join(TRAIL_DATA_DIR, file), 'utf-8'));
      if (!t.calculatedKm || !t.name) continue;
      const offKm = officialDistances.get(id) || t.distance_km;
      const errPct = (Math.abs(t.calculatedKm - offKm) / offKm * 100);
      const status = errPct <= 5 ? 'OK  ' : errPct <= 25 ? 'FAIR' : 'HIGH';
      console.log(`${status}  ${t.name.padEnd(42)} ${(t.calculatedKm.toFixed(1) + 'km').padStart(10)} / ${(offKm + 'km').padStart(8)}  ${errPct.toFixed(1).padStart(5)}% off`);
    } catch {}
  }
}

main().catch(console.error);
