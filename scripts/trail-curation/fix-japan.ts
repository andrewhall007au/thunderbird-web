// Fix Japan trail data — bbox cropping, flyback removal, and cleanup
// Usage: npx tsx scripts/trail-curation/fix-japan.ts [--dry-run]

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

// Crop trail to points within bbox [south, west, north, east]
function cropToBBox(coords: [number, number, number][], bbox: [number, number, number, number]): [number, number, number][] {
  return coords.filter(c => {
    const lat = c[1], lon = c[0];
    return lat >= bbox[0] && lat <= bbox[2] && lon >= bbox[1] && lon <= bbox[3];
  });
}

// Flyback removal: detect gap returning near start, reverse shorter section + stitch
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

        // Reverse shorter section and prepend
        let fixed: [number, number, number][];
        if (firstKm <= secondKm) {
          fixed = [...[...firstHalf].reverse(), ...secondHalf];
        } else {
          fixed = [...firstHalf, ...[...secondHalf].reverse()];
        }

        const fixedKm = totalDistance(fixed);
        const origKm = totalDistance(coords);
        const origOff = Math.abs(origKm - officialKm) / officialKm;
        const fixedOff = Math.abs(fixedKm - officialKm) / officialKm;

        if (fixedOff < origOff) {
          return fixed;
        }
      }
    }
  }

  return coords;
}

// Adaptive gap skip: remove large gaps that make distance too long
function adaptiveGapSkip(coords: [number, number, number][], officialKm: number): [number, number, number][] {
  const calcKm = totalDistance(coords);
  if (calcKm <= officialKm * 1.15) return coords;

  // Find all gaps
  const gaps: { idx: number; km: number }[] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const gapKm = haversine(coords[i][1], coords[i][0], coords[i + 1][1], coords[i + 1][0]);
    if (gapKm > 0.5) gaps.push({ idx: i, km: gapKm });
  }
  gaps.sort((a, b) => b.km - a.km);

  let best = coords;
  let bestOff = Math.abs(calcKm - officialKm);

  for (const gap of gaps.slice(0, 10)) {
    // Split at gap, keep the longer section
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

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`=== FIX JAPAN TRAILS ===${dryRun ? ' (DRY RUN)' : ''}`);

  const trailListPath = join(process.cwd(), 'scripts', 'trail-curation', 'trail-lists', 'japan-trails.json');
  const trails = JSON.parse(readFileSync(trailListPath, 'utf-8'));

  // Trails to DELETE (too little usable data)
  const deleteIds = [
    'mount_fuji_yoshida_trail',  // 14 pts, 0.1km vs 14km — useless
    'tateyama_alpine_route',     // 4km vs 37km — wrong trail (Tateyama Murodo summit only)
  ];

  for (const id of deleteIds) {
    const file = join(trailDataDir, `${id}.json`);
    if (existsSync(file)) {
      console.log(`\nDELETE: ${id}`);
      if (!dryRun) {
        unlinkSync(file);
        // Remove from manifest
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

  // Fix Nakasendo: crop to Magome-Tsumago bbox
  const nakasendoFile = join(trailDataDir, 'nakasendo_trail_magome_to_tsumago.json');
  if (existsSync(nakasendoFile)) {
    console.log(`\nFIX: Nakasendo Trail (Magome to Tsumago)`);
    const data = JSON.parse(readFileSync(nakasendoFile, 'utf-8'));
    const origKm = totalDistance(data.coordinates);
    console.log(`  Before: ${data.coordinates.length} pts, ${origKm.toFixed(1)}km`);

    // Find longest contiguous section within tight Magome-Tsumago bbox
    const inBox = (c: number[]) => c[1] >= 35.53 && c[1] <= 35.59 && c[0] >= 137.56 && c[0] <= 137.61;
    let bestStart = 0, bestLen = 0, curStart = 0, curLen = 0;
    for (let i = 0; i < data.coordinates.length; i++) {
      if (inBox(data.coordinates[i])) {
        if (curLen === 0) curStart = i;
        curLen++;
        if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
      } else { curLen = 0; }
    }
    const cropped = data.coordinates.slice(bestStart, bestStart + bestLen);
    const croppedKm = totalDistance(cropped);
    console.log(`  After contiguous bbox section: ${cropped.length} pts, ${croppedKm.toFixed(1)}km`);

    const pctOff = Math.abs(croppedKm - 8) / 8 * 100;
    console.log(`  Off: ${pctOff.toFixed(1)}% (official: 8km)`);

    if (!dryRun && cropped.length >= 10) {
      data.coordinates = cropped;
      data.calculatedKm = croppedKm;
      data.dataSource += '_bbox_cropped';
      writeFileSync(nakasendoFile, JSON.stringify(data));
    }
  }

  // Fix Kumano Kodo: try flyback + gap skip
  const kumanoFile = join(trailDataDir, 'kumano_kodo_nakahechi.json');
  if (existsSync(kumanoFile)) {
    console.log(`\nFIX: Kumano Kodo Nakahechi`);
    const data = JSON.parse(readFileSync(kumanoFile, 'utf-8'));
    const origKm = totalDistance(data.coordinates);
    console.log(`  Before: ${data.coordinates.length} pts, ${origKm.toFixed(1)}km`);

    let fixed = removeFlyback(data.coordinates, 65);
    let fixedKm = totalDistance(fixed);
    console.log(`  After flyback: ${fixed.length} pts, ${fixedKm.toFixed(1)}km`);

    fixed = adaptiveGapSkip(fixed, 65);
    fixedKm = totalDistance(fixed);
    console.log(`  After gap skip: ${fixed.length} pts, ${fixedKm.toFixed(1)}km`);

    const pctOff = Math.abs(fixedKm - 65) / 65 * 100;
    console.log(`  Off: ${pctOff.toFixed(1)}% (official: 65km)`);

    if (!dryRun && Math.abs(fixedKm - 65) < Math.abs(origKm - 65)) {
      data.coordinates = fixed;
      data.calculatedKm = fixedKm;
      data.dataSource += '_fixed';
      writeFileSync(kumanoFile, JSON.stringify(data));
    }
  }

  // Fix Southern Alps: try flyback + gap skip
  const southernAlpsFile = join(trailDataDir, 'southern_alps_traverse.json');
  if (existsSync(southernAlpsFile)) {
    console.log(`\nFIX: Southern Alps Traverse`);
    const data = JSON.parse(readFileSync(southernAlpsFile, 'utf-8'));
    const origKm = totalDistance(data.coordinates);
    console.log(`  Before: ${data.coordinates.length} pts, ${origKm.toFixed(1)}km`);

    let fixed = removeFlyback(data.coordinates, 94);
    let fixedKm = totalDistance(fixed);
    console.log(`  After flyback: ${fixed.length} pts, ${fixedKm.toFixed(1)}km`);

    fixed = adaptiveGapSkip(fixed, 94);
    fixedKm = totalDistance(fixed);
    console.log(`  After gap skip: ${fixed.length} pts, ${fixedKm.toFixed(1)}km`);

    const pctOff = Math.abs(fixedKm - 94) / 94 * 100;
    console.log(`  Off: ${pctOff.toFixed(1)}% (official: 94km)`);

    // If still > 40% off, delete (too sparse)
    if (pctOff > 40) {
      console.log(`  Still ${pctOff.toFixed(1)}% off — deleting (too sparse for usable data)`);
      if (!dryRun) {
        unlinkSync(southernAlpsFile);
        const manifestPath = join(trailDataDir, 'manifest.json');
        if (existsSync(manifestPath)) {
          const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
          const filtered = manifest.filter((m: any) => m.id !== 'southern_alps_traverse');
          writeFileSync(manifestPath, JSON.stringify(filtered, null, 2));
        }
      }
    } else if (!dryRun && Math.abs(fixedKm - 94) < Math.abs(origKm - 94)) {
      data.coordinates = fixed;
      data.calculatedKm = fixedKm;
      data.dataSource += '_fixed';
      writeFileSync(southernAlpsFile, JSON.stringify(data));
    }
  }

  // Summary
  console.log(`\n=== JAPAN FIX SUMMARY ===`);
  const remaining = ['kumano_kodo_nakahechi', 'nakasendo_trail_magome_to_tsumago', 'mount_hakusan', 'mount_rishiri'];
  for (const id of remaining) {
    const file = join(trailDataDir, `${id}.json`);
    if (existsSync(file)) {
      const data = JSON.parse(readFileSync(file, 'utf-8'));
      const trail = trails.find((t: any) => id === t.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
      const official = trail?.officialDistanceKm || 0;
      const pctOff = official > 0 ? Math.abs(data.calculatedKm - official) / official * 100 : 0;
      const status = pctOff <= 5 ? 'OK' : pctOff <= 25 ? 'FAIR' : 'HIGH';
      console.log(`  ${status} | ${data.name} | ${data.calculatedKm.toFixed(1)}km / ${official}km | ${pctOff.toFixed(1)}% off | ${data.coordinates.length} pts`);
    }
  }
}

main().catch(console.error);
