// Fix Nepal trail data — flyback removal, out-and-back detection, cleanup
// Usage: npx tsx scripts/trail-curation/fix-nepal.ts [--dry-run]

import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';

const trailDataDir = join(process.cwd(), 'public', 'trail-data');

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

function safeMin(arr: number[]): number {
  let min = Infinity;
  for (const v of arr) if (v < min) min = v;
  return min;
}
function safeMax(arr: number[]): number {
  let max = -Infinity;
  for (const v of arr) if (v > max) max = v;
  return max;
}

// Flyback removal
function removeFlyback(coords: [number, number, number][], officialKm: number): [number, number, number][] {
  if (coords.length < 20) return coords;
  const startLat = coords[0][1], startLon = coords[0][0];
  const thresholds = [0.5, 1, 2, 3, 5, 10, 15, 20, 30, 50];

  for (const threshold of thresholds) {
    for (let i = Math.floor(coords.length * 0.3); i < Math.floor(coords.length * 0.8); i++) {
      const gapKm = haversine(coords[i][1], coords[i][0], coords[i + 1][1], coords[i + 1][0]);
      const distToStart = haversine(coords[i + 1][1], coords[i + 1][0], startLat, startLon);

      if (gapKm > threshold && distToStart < threshold * 2) {
        const firstHalf = coords.slice(0, i + 1);
        const secondHalf = coords.slice(i + 1);
        const firstKm = totalDistance(firstHalf);
        const secondKm = totalDistance(secondHalf);

        let fixed: [number, number, number][];
        if (firstKm <= secondKm) {
          fixed = [...[...firstHalf].reverse(), ...secondHalf];
        } else {
          fixed = [...firstHalf, ...[...secondHalf].reverse()];
        }

        const fixedKm = totalDistance(fixed);
        const origKm = totalDistance(coords);
        if (Math.abs(fixedKm - officialKm) < Math.abs(origKm - officialKm)) {
          return fixed;
        }
      }
    }
  }
  return coords;
}

// Section dedup: remove duplicate overlapping sections
function sectionDedup(coords: [number, number, number][], officialKm: number): [number, number, number][] {
  if (coords.length < 100) return coords;

  const windowSize = 50;
  const calcKm = totalDistance(coords);
  if (calcKm <= officialKm * 1.15) return coords;

  // Find sections with overlapping centroids
  const sections: { start: number; end: number; centroidLat: number; centroidLon: number }[] = [];
  for (let i = 0; i < coords.length - windowSize; i += windowSize) {
    const section = coords.slice(i, i + windowSize);
    const avgLat = section.reduce((s, c) => s + c[1], 0) / section.length;
    const avgLon = section.reduce((s, c) => s + c[0], 0) / section.length;
    sections.push({ start: i, end: i + windowSize, centroidLat: avgLat, centroidLon: avgLon });
  }

  const toRemove = new Set<number>();
  for (let i = 0; i < sections.length; i++) {
    for (let j = i + 2; j < sections.length; j++) {
      const dist = haversine(sections[i].centroidLat, sections[i].centroidLon, sections[j].centroidLat, sections[j].centroidLon);
      if (dist < 1) { // Centroids within 1km = likely duplicate
        // Remove the later section
        for (let k = sections[j].start; k < sections[j].end; k++) toRemove.add(k);
      }
    }
  }

  if (toRemove.size === 0) return coords;

  const deduped = coords.filter((_, i) => !toRemove.has(i));
  const dedupedKm = totalDistance(deduped);
  if (Math.abs(dedupedKm - officialKm) < Math.abs(calcKm - officialKm)) {
    return deduped;
  }
  return coords;
}

// Adaptive gap skip
function adaptiveGapSkip(coords: [number, number, number][], officialKm: number): [number, number, number][] {
  const calcKm = totalDistance(coords);
  if (calcKm <= officialKm * 1.15) return coords;

  const gaps: { idx: number; km: number }[] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const gapKm = haversine(coords[i][1], coords[i][0], coords[i + 1][1], coords[i + 1][0]);
    if (gapKm > 1) gaps.push({ idx: i, km: gapKm });
  }
  gaps.sort((a, b) => b.km - a.km);

  let best = coords;
  let bestOff = Math.abs(calcKm - officialKm);

  for (const gap of gaps.slice(0, 15)) {
    const before = coords.slice(0, gap.idx + 1);
    const after = coords.slice(gap.idx + 1);
    const candidate = totalDistance(before) >= totalDistance(after) ? before : after;
    const candOff = Math.abs(totalDistance(candidate) - officialKm);
    if (candOff < bestOff) {
      best = candidate;
      bestOff = candOff;
    }
  }

  return best;
}

function toId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`=== FIX NEPAL TRAILS ===${dryRun ? ' (DRY RUN)' : ''}`);

  const trailListPath = join(process.cwd(), 'scripts', 'trail-curation', 'trail-lists', 'nepal-trails.json');
  const trails = JSON.parse(readFileSync(trailListPath, 'utf-8'));

  // Trails to DELETE (too little usable data)
  const deleteIds = [
    'upper_mustang_trek',  // 16km vs 140km — 88.5% off, barely any data
    'poon_hill_trek',      // 13.9km vs 40km — 65% off, only 246 pts
  ];

  for (const id of deleteIds) {
    const file = join(trailDataDir, `${id}.json`);
    if (existsSync(file)) {
      console.log(`\nDELETE: ${id}`);
      if (!dryRun) {
        unlinkSync(file);
        const manifestPath = join(trailDataDir, 'manifest.json');
        if (existsSync(manifestPath)) {
          const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
          const filtered = manifest.filter((m: any) => m.id !== id);
          writeFileSync(manifestPath, JSON.stringify(filtered, null, 2));
        }
      }
      console.log(`  Removed trail data file`);
    }
  }

  // Fix trails with flyback/dedup/gap-skip
  const fixTrails = [
    { id: 'everest_base_camp_trek', official: 130 },
    { id: 'annapurna_circuit', official: 200 },
    { id: 'annapurna_base_camp_trek', official: 110 },
    { id: 'makalu_base_camp_trek', official: 125 },
  ];

  for (const { id, official } of fixTrails) {
    const file = join(trailDataDir, `${id}.json`);
    if (!existsSync(file)) continue;

    console.log(`\nFIX: ${id}`);
    const data = JSON.parse(readFileSync(file, 'utf-8'));
    const origKm = totalDistance(data.coordinates);
    console.log(`  Before: ${data.coordinates.length} pts, ${origKm.toFixed(1)}km (official: ${official}km)`);

    let fixed = data.coordinates;
    let fixedKm = origKm;

    // Check out-and-back FIRST (before flyback which can change distance)
    const halfOff = Math.abs(origKm - official / 2) / (official / 2) * 100;
    if (halfOff < 20) {
      console.log(`  Detected out-and-back (${origKm.toFixed(1)}km ≈ ${(official / 2).toFixed(1)}km). Mirroring...`);
      const reversed = [...fixed].reverse().slice(1) as [number, number, number][];
      fixed = [...fixed, ...reversed];
      fixedKm = totalDistance(fixed);
      console.log(`  After mirror: ${fixed.length} pts, ${fixedKm.toFixed(1)}km`);
    } else {
      // Try flyback removal (only if not mirrored)
      fixed = removeFlyback(fixed, official);
      fixedKm = totalDistance(fixed);
      if (fixedKm !== origKm) console.log(`  After flyback: ${fixed.length} pts, ${fixedKm.toFixed(1)}km`);

      // Try section dedup
      const beforeDedup = fixedKm;
      fixed = sectionDedup(fixed, official);
      fixedKm = totalDistance(fixed);
      if (fixedKm !== beforeDedup) console.log(`  After dedup: ${fixed.length} pts, ${fixedKm.toFixed(1)}km`);

      // Try gap skip
      const beforeGap = fixedKm;
      fixed = adaptiveGapSkip(fixed, official);
      fixedKm = totalDistance(fixed);
      if (fixedKm !== beforeGap) console.log(`  After gap skip: ${fixed.length} pts, ${fixedKm.toFixed(1)}km`);
    }

    const pctOff = Math.abs(fixedKm - official) / official * 100;
    const status = pctOff <= 5 ? 'OK' : pctOff <= 25 ? 'FAIR' : 'HIGH';
    console.log(`  Result: ${status} | ${fixed.length} pts, ${fixedKm.toFixed(1)}km (${pctOff.toFixed(1)}% off)`);

    // Apply if improved
    if (!dryRun && Math.abs(fixedKm - official) < Math.abs(origKm - official)) {
      data.coordinates = fixed;
      data.calculatedKm = fixedKm;
      data.dataSource += '_fixed';
      writeFileSync(file, JSON.stringify(data));
      console.log(`  Saved.`);
    }

    // Delete if still > 50% off
    if (pctOff > 50) {
      console.log(`  Still ${pctOff.toFixed(1)}% off — deleting (not usable)`);
      if (!dryRun) {
        unlinkSync(file);
        const manifestPath = join(trailDataDir, 'manifest.json');
        if (existsSync(manifestPath)) {
          const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
          const filtered = manifest.filter((m: any) => m.id !== id);
          writeFileSync(manifestPath, JSON.stringify(filtered, null, 2));
        }
      }
    }
  }

  // Summary of all remaining Nepal trails
  console.log(`\n=== NEPAL FIX SUMMARY ===`);
  for (const trail of trails) {
    const id = toId(trail.name);
    const file = join(trailDataDir, `${id}.json`);
    if (existsSync(file)) {
      const data = JSON.parse(readFileSync(file, 'utf-8'));
      const calcKm = totalDistance(data.coordinates);
      const pctOff = Math.abs(calcKm - trail.officialDistanceKm) / trail.officialDistanceKm * 100;
      const status = pctOff <= 5 ? 'OK' : pctOff <= 25 ? 'FAIR' : 'HIGH';
      console.log(`  ${status} | ${trail.name} | ${calcKm.toFixed(1)}km / ${trail.officialDistanceKm}km | ${pctOff.toFixed(1)}% off | ${data.coordinates.length} pts`);
    } else {
      console.log(`  --- | ${trail.name} | DELETED/FAILED`);
    }
  }
}

main().catch(console.error);
