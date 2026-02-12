// Clean AU trail data by splitting at gap jumps (>1km between consecutive points)
// Removes straight-line artifacts from map display
// Usage: npx tsx scripts/trail-curation/clean-au-gaps.ts

import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const TRAIL_DIR = join(process.cwd(), 'public', 'trail-data');
const BACKUP_DIR = join(process.cwd(), 'scripts', 'trail-curation', 'backups');

const GAP_THRESHOLD_KM = 1.0;

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function totalDistance(coords: [number, number, number][]): number {
  let d = 0;
  for (let i = 1; i < coords.length; i++) {
    d += haversine(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
  }
  return d;
}

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

// Split coordinates into segments at gaps > threshold
function splitAtGaps(coords: [number, number, number][]): [number, number, number][][] {
  if (coords.length < 2) return [coords];

  const segments: [number, number, number][][] = [];
  let current: [number, number, number][] = [coords[0]];

  for (let i = 1; i < coords.length; i++) {
    const gap = haversine(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
    if (gap > GAP_THRESHOLD_KM) {
      if (current.length >= 3) segments.push(current);
      current = [coords[i]];
    } else {
      current.push(coords[i]);
    }
  }
  if (current.length >= 3) segments.push(current);

  return segments;
}

// Remove duplicate consecutive points
function dedup(coords: [number, number, number][]): [number, number, number][] {
  if (coords.length < 2) return coords;
  const result: [number, number, number][] = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    if (coords[i][0] !== coords[i - 1][0] || coords[i][1] !== coords[i - 1][1]) {
      result.push(coords[i]);
    }
  }
  return result;
}

// For bbox-polluted trails: find the best subset of segments closest to official distance
function selectBestSegments(segments: [number, number, number][][], targetKm: number): [number, number, number][][] {
  if (segments.length <= 1) return segments;

  // Calculate each segment's distance
  const segDists = segments.map(s => totalDistance(s));

  // If the longest segment alone is close enough, just use it
  const longest = Math.max(...segDists);
  const longestIdx = segDists.indexOf(longest);
  if (longest >= targetKm * 0.6) {
    return [segments[longestIdx]];
  }

  // Greedy: add segments by distance until we're close to target
  const sorted = segDists.map((d, i) => ({ d, i })).sort((a, b) => b.d - a.d);
  const selected: [number, number, number][][] = [];
  let totalSoFar = 0;

  for (const { d, i } of sorted) {
    if (totalSoFar + d <= targetKm * 1.5) {
      selected.push(segments[i]);
      totalSoFar += d;
      if (totalSoFar >= targetKm * 0.8) break;
    }
  }

  return selected.length > 0 ? selected : [segments[longestIdx]];
}

// AU trail IDs categorized
const CLEAN_TRAILS = [
  'australian_alps_walking_track', 'cape_to_cape_track', 'carnarvon_great_walk',
  'castle_rock_granite_skywalk', 'cooloola_great_walk', 'eastern_arthur_range_traverse',
  'grampians_peaks_trail', 'jatbula_trail', 'kanangra_to_katoomba', 'lake_rhona',
  'larapinta_trail', 'leeaberra_track', 'light_to_light_walk', 'mount_lofty_summit_via_waterfall_gully',
  'scenic_rim_trail', 'six_foot_track', 'wilsons_promontory_southern_circuit',
  'yuraygir_coastal_walk', 'mt_toolbrunup', 'mt_magog',
];

// Fixable: good data with gap jumps that can be split
const FIXABLE_TRAILS = [
  'bald_head_walk', 'bibbulmun_track', 'bluff_knoll', 'canberra_centenary_trail',
  'gold_coast_hinterland_great_walk', 'goldfields_track', 'great_north_walk',
  'great_ocean_walk', 'hakea_trail', 'mount_anne_circuit', 'mt_bogong',
  'razorback_ridge', 'thorsborne_trail', 'three_capes_track', 'walls_of_jerusalem',
  'wilderness_coast_walk',
];

// Bbox pollution: calc >> official, grabbed too many paths. Need segment selection.
const BBOX_POLLUTED = [
  'falls_to_hotham_alpine_crossing', 'fraser_island_great_walk', 'grand_canyon_track',
  'mt_talyuberlup', 'nancy_peak_and_devils_slide', 'royal_coast_track',
  'stirling_ridge_walk', 'tree_in_the_rock', 'whitsunday_ngaro_sea_trail',
  'blue_gum_forest_walk',
];

// Incomplete / different schema (Tasmania mostly) — leave for manual curation
const NEEDS_MANUAL = [
  'federation_peak', 'frenchmans_cap', 'freycinet_peninsula_circuit',
  'heysen_trail', 'mount_maria_walk', 'mt_feathertop', 'overland_track',
  'point_lesueur_walk', 'port_davey_track', 'south_coast_track',
  'tasman_cape_pillar', 'western_arthur_range_traverse', 'wilpena_pound',
];

function processTrail(id: string, mode: 'fixable' | 'bbox'): { before: string; after: string } | null {
  const fp = join(TRAIL_DIR, `${id}.json`);
  if (!existsSync(fp)) return null;

  const data: TrailData = JSON.parse(readFileSync(fp, 'utf-8'));
  const origCoords = dedup(data.coordinates);
  const origKm = totalDistance(origCoords);

  // Split at gaps
  const segments = splitAtGaps(origCoords);

  let finalCoords: [number, number, number][];

  if (mode === 'bbox' && segments.length > 1) {
    // Select best segments matching official distance
    const best = selectBestSegments(segments, data.distance_km);
    // Concatenate selected segments (with gap markers removed)
    finalCoords = best.reduce((acc, seg) => [...acc, ...seg], []);
  } else {
    // Fixable: just remove gap jumps by concatenating segments
    // This keeps all good data, just without straight-line artifacts
    finalCoords = segments.reduce((acc, seg) => [...acc, ...seg], []);
  }

  const newKm = totalDistance(finalCoords);
  const removed = origCoords.length - finalCoords.length;

  // Backup original
  copyFileSync(fp, join(BACKUP_DIR, `${id}.json`));

  // Save cleaned version
  data.coordinates = finalCoords;
  data.calculatedKm = newKm;
  writeFileSync(fp, JSON.stringify(data));

  const segInfo = segments.length > 1 ? ` (${segments.length} segs, kept ${mode === 'bbox' ? 'best' : 'all'})` : '';
  return {
    before: `${origCoords.length}pts ${origKm.toFixed(1)}km`,
    after: `${finalCoords.length}pts ${newKm.toFixed(1)}km${segInfo} [-${removed}pts]`,
  };
}

function main() {
  mkdirSync(BACKUP_DIR, { recursive: true });

  console.log('=== AU TRAIL GAP CLEANUP ===\n');

  console.log(`CLEAN (${CLEAN_TRAILS.length}): no changes needed`);
  console.log(`FIXABLE (${FIXABLE_TRAILS.length}): splitting at gaps`);
  console.log(`BBOX POLLUTED (${BBOX_POLLUTED.length}): selecting best segments`);
  console.log(`NEEDS MANUAL (${NEEDS_MANUAL.length}): flagged for curation\n`);

  // Process fixable trails
  console.log('--- FIXABLE TRAILS ---');
  for (const id of FIXABLE_TRAILS) {
    const result = processTrail(id, 'fixable');
    if (result) {
      console.log(`  ${id}`);
      console.log(`    Before: ${result.before}`);
      console.log(`    After:  ${result.after}`);
    } else {
      console.log(`  ${id}: FILE NOT FOUND`);
    }
  }

  // Process bbox polluted trails
  console.log('\n--- BBOX POLLUTED (best segment selection) ---');
  for (const id of BBOX_POLLUTED) {
    const result = processTrail(id, 'bbox');
    if (result) {
      console.log(`  ${id}`);
      console.log(`    Before: ${result.before}`);
      console.log(`    After:  ${result.after}`);
    } else {
      console.log(`  ${id}: FILE NOT FOUND`);
    }
  }

  console.log('\n--- NEEDS MANUAL CURATION ---');
  for (const id of NEEDS_MANUAL) {
    const fp = join(TRAIL_DIR, `${id}.json`);
    if (existsSync(fp)) {
      const data = JSON.parse(readFileSync(fp, 'utf-8'));
      const coords = data.coordinates || [];
      const km = totalDistance(coords);
      console.log(`  ${id}: ${coords.length}pts, calc=${km.toFixed(1)}km, official=${data.distance_km}km — SKIPPED`);
    } else {
      console.log(`  ${id}: FILE NOT FOUND`);
    }
  }

  console.log('\nBackups saved to scripts/trail-curation/backups/');
  console.log('Done.');
}

main();
