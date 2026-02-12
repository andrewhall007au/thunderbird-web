// Fix way ordering for mainland Australia trails
// Detects segment boundaries (large gaps) in flattened coordinate arrays,
// then chains segments by nearest-endpoint to produce a continuous path.
// Usage: npx tsx scripts/trail-curation/fix-way-ordering.ts

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const TRAIL_DATA_DIR = join(process.cwd(), 'public', 'trail-data');
const GAP_THRESHOLD_KM = 0.5; // Points >500m apart = segment boundary
const ERROR_THRESHOLD = 0.05; // Fix trails where calculated distance is >5% off official

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

function coordDistance(a: [number, number, number], b: [number, number, number]): number {
  return haversine(a[1], a[0], b[1], b[0]);
}

// Split a flat coordinate array into segments at large gaps
function splitIntoSegments(coords: [number, number, number][]): [number, number, number][][] {
  if (coords.length === 0) return [];

  const segments: [number, number, number][][] = [];
  let current: [number, number, number][] = [coords[0]];

  for (let i = 1; i < coords.length; i++) {
    const gap = coordDistance(coords[i - 1], coords[i]);
    if (gap > GAP_THRESHOLD_KM) {
      if (current.length > 0) segments.push(current);
      current = [coords[i]];
    } else {
      current.push(coords[i]);
    }
  }
  if (current.length > 0) segments.push(current);

  return segments;
}

// Chain segments by nearest-endpoint (the proven Bibbulmun fix)
function chainSegments(segments: [number, number, number][][]): [number, number, number][] {
  if (segments.length <= 1) return segments[0] || [];

  const ordered: [number, number, number][][] = [segments[0]];
  const used = new Set<number>([0]);

  while (used.size < segments.length) {
    const lastSeg = ordered[ordered.length - 1];
    const lastPoint = lastSeg[lastSeg.length - 1];

    let bestIdx = -1;
    let bestDist = Infinity;
    let bestReverse = false;

    for (let i = 0; i < segments.length; i++) {
      if (used.has(i)) continue;
      const seg = segments[i];

      const startDist = coordDistance(lastPoint, seg[0]);
      const endDist = coordDistance(lastPoint, seg[seg.length - 1]);

      if (startDist < bestDist) {
        bestDist = startDist;
        bestIdx = i;
        bestReverse = false;
      }
      if (endDist < bestDist) {
        bestDist = endDist;
        bestIdx = i;
        bestReverse = true;
      }
    }

    if (bestIdx === -1) break;
    used.add(bestIdx);

    const seg = bestReverse ? [...segments[bestIdx]].reverse() : segments[bestIdx];
    ordered.push(seg);
  }

  return ordered.flat();
}

// Load official distances from trail list
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

  // Find all AU mainland trail files (exclude Tasmania)
  const tasmaniaIds = new Set([
    'overland_track', 'south_coast_track', 'western_arthurs_traverse',
    'frenchmans_cap', 'mount_anne_circuit', 'federation_peak',
    'port_davey_track', 'three_capes_track', 'eastern_arthurs_traverse',
    'freycinet_peninsula_circuit', 'walls_of_jerusalem', 'cape_pillar',
    'leeaberra_track', 'lake_rhona', 'point_lesueur', 'mount_maria',
  ]);

  const files = readdirSync(TRAIL_DATA_DIR)
    .filter(f => f.endsWith('.json') && f !== 'manifest.json');

  let fixedCount = 0;
  let skippedCount = 0;
  const fixResults: { name: string; before: number; after: number; official: number; segments: number }[] = [];

  for (const file of files) {
    const id = file.replace('.json', '');
    if (tasmaniaIds.has(id)) continue;
    if (id.startsWith('summits')) continue;

    const filePath = join(TRAIL_DATA_DIR, file);
    let trail: TrailData;
    try {
      trail = JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch { continue; }

    // Skip files that aren't trail data
    if (!trail.coordinates || !trail.calculatedKm || !trail.name) {
      continue;
    }

    // Skip already-fixed trails
    if (trail.dataSource === 'osm_overpass_ordered') {
      console.log(`SKIP ${trail.name} — already ordered`);
      skippedCount++;
      continue;
    }

    const officialKm = officialDistances.get(id) || trail.distance_km;
    const errorPct = Math.abs(trail.calculatedKm - officialKm) / officialKm;

    if (errorPct <= ERROR_THRESHOLD) {
      console.log(`OK   ${trail.name} — ${trail.calculatedKm.toFixed(1)}km calc vs ${officialKm}km official (${(errorPct * 100).toFixed(1)}% off)`);
      skippedCount++;
      continue;
    }

    console.log(`\nFIX  ${trail.name}`);
    console.log(`     Before: ${trail.calculatedKm.toFixed(1)}km calc vs ${officialKm}km official (${(errorPct * 100).toFixed(1)}% off)`);

    // Split into segments at gaps
    const segments = splitIntoSegments(trail.coordinates);
    console.log(`     Detected ${segments.length} segments from ${trail.coordinates.length} points`);

    if (segments.length <= 1) {
      console.log(`     Only 1 segment, nothing to reorder — skipping`);
      skippedCount++;
      continue;
    }

    // Chain segments
    const ordered = chainSegments(segments);
    const newKm = totalDistance(ordered);
    const newErrorPct = Math.abs(newKm - officialKm) / officialKm;

    console.log(`     After:  ${newKm.toFixed(1)}km calc (${(newErrorPct * 100).toFixed(1)}% off official)`);

    // Only save if the fix actually improved things
    if (newKm < trail.calculatedKm) {
      const beforeKm = trail.calculatedKm;
      trail.coordinates = ordered;
      trail.calculatedKm = newKm;
      trail.dataSource = trail.dataSource + '_ordered';
      writeFileSync(filePath, JSON.stringify(trail, null, 2));
      console.log(`     SAVED ✓`);
      fixedCount++;
      fixResults.push({
        name: trail.name,
        before: beforeKm,
        after: newKm,
        official: officialKm,
        segments: segments.length,
      });
    } else {
      console.log(`     No improvement — skipping`);
      skippedCount++;
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Fixed: ${fixedCount}`);
  console.log(`Skipped: ${skippedCount}`);
  if (fixResults.length > 0) {
    console.log(`\nResults:`);
    for (const r of fixResults) {
      console.log(`  ${r.name}: ${r.before.toFixed(0)}km → ${r.after.toFixed(0)}km (official ${r.official}km, ${r.segments} segments)`);
    }
  }

  // Update manifest
  const manifestPath = join(TRAIL_DATA_DIR, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  let manifestUpdated = 0;

  for (const entry of manifest) {
    const filePath = join(TRAIL_DATA_DIR, `${entry.id}.json`);
    try {
      const trail: TrailData = JSON.parse(readFileSync(filePath, 'utf-8'));
      if (trail.dataSource.includes('ordered') && entry.dataSource !== trail.dataSource) {
        entry.dataSource = trail.dataSource;
        entry.calculatedKm = trail.calculatedKm;
        entry.pointCount = trail.coordinates.length;
        const elevations = trail.coordinates.map((c: number[]) => c[2]);
        entry.elevationLow = Math.min(...elevations);
        entry.elevationHigh = Math.max(...elevations);
        manifestUpdated++;
      }
    } catch {}
  }

  if (manifestUpdated > 0) {
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`\nManifest: updated ${manifestUpdated} entries`);
  }
}

main().catch(console.error);
