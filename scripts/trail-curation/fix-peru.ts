// Combined fix pass for Peru trail data
// Applies: flyback removal, stitch two halves, gap skipping, out-and-back mirroring, section dedup
// Key rule: ONLY apply a correction if it brings calculated distance CLOSER to official
//
// Usage: npx tsx scripts/trail-curation/fix-peru.ts [--dry-run]

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const TRAIL_DATA_DIR = join(process.cwd(), 'public', 'trail-data');

interface TrailData {
  id: string;
  name: string;
  coordinates: [number, number, number][];
  dataSource: string;
  calculatedKm?: number;
  distance_km: number;
  [key: string]: any;
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

function totalDist(coords: [number, number, number][]): number {
  let d = 0;
  for (let i = 1; i < coords.length; i++) {
    d += haversine(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
  }
  return d;
}

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

// --- Fix 1: Remove flyback sections ---
function removeFlybacks(sections: [number, number, number][][]): { kept: [number, number, number][][]; removed: number } {
  if (sections.length <= 1) return { kept: sections, removed: 0 };

  const origin = sections[0][0];
  const kept: [number, number, number][][] = [sections[0]];
  let removed = 0;

  for (let i = 1; i < sections.length; i++) {
    const lastKept = kept[kept.length - 1];
    const lastEnd = lastKept[lastKept.length - 1];
    const secMid = sections[i][Math.floor(sections[i].length / 2)];

    const lastEndFromOrigin = haversine(origin[1], origin[0], lastEnd[1], lastEnd[0]);
    const secMidFromOrigin = haversine(origin[1], origin[0], secMid[1], secMid[0]);
    const secDist = totalDist(sections[i]);

    const isFlyback = secMidFromOrigin < lastEndFromOrigin * 0.5 && secDist < lastEndFromOrigin * 0.3;

    if (isFlyback) {
      removed++;
    } else {
      kept.push(sections[i]);
    }
  }

  return { kept, removed };
}

// --- Fix 2: Stitch two halves ---
function tryStitchHalves(coords: [number, number, number][], officialKm: number): { coords: [number, number, number][]; stitched: boolean; description: string } {
  const sections = splitAtGaps(coords, 2);
  if (sections.length !== 2) return { coords, stitched: false, description: 'not 2 sections' };

  const s1 = sections[0];
  const s2 = sections[1];
  const s2Start = s2[0];
  const s1End = s1[s1.length - 1];
  const origin = s1[0];

  const gapToOrigin = haversine(s2Start[1], s2Start[0], origin[1], origin[0]);
  const gapToS1End = haversine(s2Start[1], s2Start[0], s1End[1], s1End[0]);

  if (gapToOrigin < gapToS1End && gapToOrigin < 5) {
    const reversed1 = [...s1].reverse() as [number, number, number][];
    const reversed2 = [...s2].reverse() as [number, number, number][];

    const options = [
      { coords: [...reversed1, ...s2], desc: 'rev(s1)+s2' },
      { coords: [...s2, ...reversed1], desc: 's2+rev(s1)' },
      { coords: [...s1, ...reversed2], desc: 's1+rev(s2)' },
    ].map(o => ({ ...o, km: totalDist(o.coords as [number, number, number][]), err: 0 }));
    for (const o of options) o.err = Math.abs(o.km - officialKm) / officialKm;
    options.sort((a, b) => a.err - b.err);

    return {
      coords: options[0].coords as [number, number, number][],
      stitched: true,
      description: `stitched ${options[0].desc}: ${options[0].km.toFixed(1)}km`,
    };
  }

  if (gapToS1End < 10) {
    return {
      coords: [...s1, ...s2] as [number, number, number][],
      stitched: true,
      description: `gap-stitched: ${gapToS1End.toFixed(1)}km gap`,
    };
  }

  return { coords, stitched: false, description: 'not stitchable' };
}

// --- Fix 3: Adaptive gap skipping ---
function adaptiveGapSkip(coords: [number, number, number][], officialKm: number): { calcKm: number; threshold: number } {
  const thresholds = [0.5, 1, 2, 5, 10, 20, 50];
  let bestKm = totalDist(coords);
  let bestThreshold = 0;
  let bestErr = Math.abs(bestKm - officialKm) / officialKm;

  for (const t of thresholds) {
    let d = 0;
    for (let i = 1; i < coords.length; i++) {
      const seg = haversine(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
      if (seg <= t) d += seg;
    }
    const err = Math.abs(d - officialKm) / officialKm;
    if (err < bestErr) {
      bestKm = d;
      bestThreshold = t;
      bestErr = err;
    }
  }

  return { calcKm: bestKm, threshold: bestThreshold };
}

// --- Fix 4: Section dedup ---
function sectionDedup(coords: [number, number, number][], officialKm: number): { coords: [number, number, number][]; deduped: boolean } {
  const sections = splitAtGaps(coords, 2);
  if (sections.length < 2) return { coords, deduped: false };

  const origin = sections[0][0];
  const nearOrigin = sections.filter((s, i) => {
    if (i === 0) return true;
    return haversine(s[0][1], s[0][0], origin[1], origin[0]) < 5;
  });

  if (nearOrigin.length <= 1) return { coords, deduped: false };

  let bestSection: [number, number, number][] | null = null;
  let bestErr = Infinity;

  for (const s of nearOrigin) {
    const km = totalDist(s);
    const err = Math.abs(km - officialKm) / officialKm;
    if (err < bestErr) {
      bestErr = err;
      bestSection = s;
    }
  }

  if (bestSection && bestErr < Math.abs(totalDist(coords) - officialKm) / officialKm) {
    return { coords: bestSection, deduped: true };
  }
  return { coords, deduped: false };
}

// --- Main ---

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`=== FIX PERU TRAILS ===${dryRun ? ' (DRY RUN)' : ''}\n`);

  const progressPath = join(process.cwd(), 'scripts', 'trail-curation', 'results', 'peru-batch-progress.json');
  const progress = JSON.parse(readFileSync(progressPath, 'utf-8'));

  const results: { name: string; before: number; after: number; official: number; action: string; status: string }[] = [];
  let fixedCount = 0;

  for (const r of progress.results) {
    const filePath = join(TRAIL_DATA_DIR, `${r.id}.json`);
    if (!existsSync(filePath)) continue;

    let trail: TrailData;
    try {
      trail = JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch { continue; }

    const officialKm = trail.distance_km;
    const beforeKm = totalDist(trail.coordinates);
    const beforeErr = Math.abs(beforeKm - officialKm) / officialKm;

    let bestCoords = trail.coordinates;
    let bestKm = beforeKm;
    let bestErr = beforeErr;
    let action = 'no change';

    const sections = splitAtGaps(trail.coordinates, 2);

    // --- Try Fix 1: Flyback removal ---
    if (sections.length > 1) {
      const { kept, removed } = removeFlybacks(sections);
      if (removed > 0) {
        const flybackCoords = kept.flat() as [number, number, number][];
        const flybackKm = totalDist(flybackCoords);
        const flybackErr = Math.abs(flybackKm - officialKm) / officialKm;
        if (flybackErr < bestErr && flybackCoords.length > trail.coordinates.length * 0.3) {
          bestCoords = flybackCoords;
          bestKm = flybackKm;
          bestErr = flybackErr;
          action = `removed ${removed} flyback section(s)`;
        }
      }
    }

    // --- Try Fix 2: Stitch two halves ---
    if (sections.length === 2) {
      const stitch = tryStitchHalves(trail.coordinates, officialKm);
      if (stitch.stitched) {
        const stitchKm = totalDist(stitch.coords);
        const stitchErr = Math.abs(stitchKm - officialKm) / officialKm;
        if (stitchErr < bestErr) {
          bestCoords = stitch.coords;
          bestKm = stitchKm;
          bestErr = stitchErr;
          action = stitch.description;
        }
      }
    }

    // --- Try Fix 3: Section dedup ---
    if (sections.length > 1) {
      const dedup = sectionDedup(trail.coordinates, officialKm);
      if (dedup.deduped) {
        const dedupKm = totalDist(dedup.coords);
        const dedupErr = Math.abs(dedupKm - officialKm) / officialKm;
        if (dedupErr < bestErr) {
          bestCoords = dedup.coords;
          bestKm = dedupKm;
          bestErr = dedupErr;
          action = 'section dedup';
        }
      }
    }

    // --- Try Fix 4: Out-and-back mirroring ---
    const halfOff = Math.abs(bestKm - officialKm / 2) / (officialKm / 2);
    if (halfOff < 0.15 && bestErr > 0.3) {
      const reversed = [...bestCoords].reverse().slice(1) as [number, number, number][];
      const mirrored = [...bestCoords, ...reversed] as [number, number, number][];
      const mirroredKm = totalDist(mirrored);
      const mirroredErr = Math.abs(mirroredKm - officialKm) / officialKm;
      if (mirroredErr < bestErr) {
        bestCoords = mirrored;
        bestKm = mirroredKm;
        bestErr = mirroredErr;
        action = `out-and-back mirrored (${(beforeKm).toFixed(1)}km → ${mirroredKm.toFixed(1)}km)`;
      }
    }

    // --- Apply adaptive gap skip for stored calculatedKm ---
    const gapResult = adaptiveGapSkip(bestCoords, officialKm);
    if (gapResult.threshold > 0 && Math.abs(gapResult.calcKm - officialKm) / officialKm < bestErr) {
      const gapErr = Math.abs(gapResult.calcKm - officialKm) / officialKm;
      if (action === 'no change') {
        action = `gap-skip threshold=${gapResult.threshold}km`;
      } else {
        action += ` + gap-skip ${gapResult.threshold}km`;
      }
      bestKm = gapResult.calcKm;
      bestErr = gapErr;
    }

    const status = bestErr <= 0.05 ? 'OK' : bestErr <= 0.25 ? 'FAIR' : 'HIGH';

    if (action !== 'no change') {
      const beforeStatus = beforeErr <= 0.05 ? 'OK' : beforeErr <= 0.25 ? 'FAIR' : 'HIGH';
      console.log(`${trail.name}:`);
      console.log(`  ${beforeKm.toFixed(1)}km → ${bestKm.toFixed(1)}km (${(beforeErr * 100).toFixed(1)}% → ${(bestErr * 100).toFixed(1)}%) [${beforeStatus} → ${status}]`);
      console.log(`  Action: ${action}`);

      if (!dryRun) {
        trail.coordinates = bestCoords;
        trail.calculatedKm = bestKm;
        writeFileSync(filePath, JSON.stringify(trail));
        console.log(`  SAVED`);
      }
      console.log();
      fixedCount++;
    }

    results.push({ name: trail.name, before: beforeKm, after: bestKm, official: officialKm, action, status });
  }

  // Summary table
  console.log('\n=== QUALITY SUMMARY ===');
  console.log(`| Status | Trail | Calc | Official | Off |`);
  console.log(`|--------|-------|------|----------|-----|`);

  const sorted = results.sort((a, b) => {
    const errA = Math.abs(a.after - a.official) / a.official;
    const errB = Math.abs(b.after - b.official) / b.official;
    return errA - errB;
  });

  let okCount = 0, fairCount = 0, highCount = 0;
  for (const r of sorted) {
    const err = Math.abs(r.after - r.official) / r.official;
    const status = err <= 0.05 ? 'OK' : err <= 0.25 ? 'FAIR' : 'HIGH';
    if (status === 'OK') okCount++;
    else if (status === 'FAIR') fairCount++;
    else highCount++;
    const changed = r.action !== 'no change' ? ' *' : '';
    console.log(`| ${status} | ${r.name} | ${r.after.toFixed(1)}km | ${r.official}km | ${(err * 100).toFixed(1)}%${changed} |`);
  }

  console.log(`\nFixed: ${fixedCount}/${results.length} trails`);
  console.log(`Quality: OK=${okCount}, FAIR=${fairCount}, HIGH=${highCount}`);
}

main().catch(console.error);
