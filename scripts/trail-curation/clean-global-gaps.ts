// Clean global (non-AU) trail data by splitting at gap jumps (>1km between consecutive points)
// For bbox-polluted trails (calc >> official), selects best segments matching official distance
// Usage: npx tsx scripts/trail-curation/clean-global-gaps.ts [--dry-run]
//
// Based on clean-au-gaps.ts logic

import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

const TRAIL_DIR = join(process.cwd(), 'public', 'trail-data');
const BACKUP_DIR = join(process.cwd(), 'scripts', 'trail-curation', 'backups-global');
const DRY_RUN = process.argv.includes('--dry-run');

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
  [key: string]: unknown;
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

// AU trail IDs to skip (already cleaned)
const AU_TRAIL_IDS = new Set<string>();

function isAUTrail(data: TrailData): boolean {
  return data.country === 'AU';
}

function analyzeTrail(data: TrailData): { mode: 'fixable' | 'bbox' | 'low_coverage' | 'skip'; reason: string } {
  const coords = data.coordinates || [];
  if (coords.length === 0) return { mode: 'skip', reason: 'no coordinates' };

  let maxGap = 0, gapCount = 0, totalDist = 0;
  for (let i = 1; i < coords.length; i++) {
    const dist = haversine(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
    totalDist += dist;
    if (dist > maxGap) maxGap = dist;
    if (dist > GAP_THRESHOLD_KM) gapCount++;
  }

  const coverage = data.distance_km > 0 ? totalDist / data.distance_km : 1;

  // Not a problem trail
  if (maxGap <= 5 && gapCount <= 3 && (coverage >= 0.3 || data.distance_km <= 5) && (coverage <= 2.5 || data.distance_km <= 5)) {
    return { mode: 'skip', reason: 'clean' };
  }

  // Bbox-polluted: way too much data relative to official distance
  if (coverage > 2.5 && data.distance_km > 5) {
    return { mode: 'bbox', reason: `coverage ${(coverage * 100).toFixed(0)}%` };
  }

  // Very low coverage: needs GPX, not gap-split
  if (coverage < 0.3 && data.distance_km > 5 && gapCount === 0) {
    return { mode: 'low_coverage', reason: `coverage ${(coverage * 100).toFixed(0)}%, no gaps to split` };
  }

  // Fixable: has gaps that can be split
  return { mode: 'fixable', reason: `${gapCount} gaps, max ${maxGap.toFixed(1)}km` };
}

function processTrail(id: string, data: TrailData, mode: 'fixable' | 'bbox'): { before: string; after: string; newCoords: [number, number, number][] } {
  const origCoords = dedup(data.coordinates);
  const origKm = totalDistance(origCoords);

  const segments = splitAtGaps(origCoords);

  let finalCoords: [number, number, number][];

  if (mode === 'bbox' && segments.length > 1) {
    const best = selectBestSegments(segments, data.distance_km);
    finalCoords = best.reduce((acc, seg) => [...acc, ...seg], []);
  } else if (mode === 'bbox' && segments.length === 1) {
    // Bbox-polluted but no gaps to split — can't fix with gap-split alone
    finalCoords = origCoords;
  } else {
    finalCoords = segments.reduce((acc, seg) => [...acc, ...seg], []);
  }

  const newKm = totalDistance(finalCoords);
  const removed = origCoords.length - finalCoords.length;
  const segInfo = segments.length > 1 ? ` (${segments.length} segs)` : '';

  return {
    before: `${origCoords.length}pts ${origKm.toFixed(1)}km`,
    after: `${finalCoords.length}pts ${newKm.toFixed(1)}km${segInfo} [-${removed}pts]`,
    newCoords: finalCoords,
  };
}

function main() {
  mkdirSync(BACKUP_DIR, { recursive: true });

  console.log(`=== GLOBAL TRAIL GAP CLEANUP ===${DRY_RUN ? ' (DRY RUN)' : ''}\n`);

  const files = readdirSync(TRAIL_DIR).filter(f => f.endsWith('.json') && f !== 'manifest.json');

  const results = {
    fixable: [] as { id: string; name: string; country: string; before: string; after: string }[],
    bbox: [] as { id: string; name: string; country: string; before: string; after: string }[],
    low_coverage: [] as { id: string; name: string; country: string; reason: string; pts: number; dist: number }[],
    skipped_au: 0,
    skipped_clean: 0,
  };

  for (const f of files) {
    const id = f.replace('.json', '');
    const fp = join(TRAIL_DIR, f);
    const data: TrailData = JSON.parse(readFileSync(fp, 'utf-8'));

    if (isAUTrail(data)) {
      results.skipped_au++;
      continue;
    }

    const analysis = analyzeTrail(data);

    if (analysis.mode === 'skip') {
      results.skipped_clean++;
      continue;
    }

    if (analysis.mode === 'low_coverage') {
      results.low_coverage.push({
        id, name: data.name, country: data.country,
        reason: analysis.reason,
        pts: (data.coordinates || []).length,
        dist: data.distance_km,
      });
      continue;
    }

    const result = processTrail(id, data, analysis.mode);

    if (!DRY_RUN) {
      // Backup original
      copyFileSync(fp, join(BACKUP_DIR, f));

      // Save cleaned version
      data.coordinates = result.newCoords;
      data.calculatedKm = totalDistance(result.newCoords);
      writeFileSync(fp, JSON.stringify(data));
    }

    const bucket = analysis.mode === 'bbox' ? results.bbox : results.fixable;
    bucket.push({ id, name: data.name, country: data.country, before: result.before, after: result.after });
  }

  // Print results
  console.log(`Skipped: ${results.skipped_au} AU trails, ${results.skipped_clean} clean trails\n`);

  console.log(`--- FIXABLE TRAILS (gap-split) [${results.fixable.length}] ---`);
  for (const r of results.fixable.sort((a, b) => a.country.localeCompare(b.country))) {
    console.log(`  ${r.country} | ${r.name} (${r.id})`);
    console.log(`    Before: ${r.before}`);
    console.log(`    After:  ${r.after}`);
  }

  console.log(`\n--- BBOX POLLUTED (segment selection) [${results.bbox.length}] ---`);
  for (const r of results.bbox.sort((a, b) => a.country.localeCompare(b.country))) {
    console.log(`  ${r.country} | ${r.name} (${r.id})`);
    console.log(`    Before: ${r.before}`);
    console.log(`    After:  ${r.after}`);
  }

  console.log(`\n--- LOW COVERAGE (need GPX) [${results.low_coverage.length}] ---`);
  for (const r of results.low_coverage.sort((a, b) => a.country.localeCompare(b.country))) {
    console.log(`  ${r.country} | ${r.name} (${r.id}) | ${r.pts}pts | ${r.dist}km | ${r.reason}`);
  }

  if (DRY_RUN) {
    console.log('\n(Dry run — no files modified. Remove --dry-run to apply changes.)');
  } else {
    console.log(`\nBackups saved to scripts/trail-curation/backups-global/`);
    console.log(`Modified: ${results.fixable.length + results.bbox.length} trails`);
  }
  console.log('Done.');
}

main();
