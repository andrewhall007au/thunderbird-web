// Fix flyback patterns in US trail data
// Scans all US trail files, detects flyback (gap jumping back toward start),
// removes flyback sections, and reports before/after quality.
// Usage: npx tsx scripts/trail-curation/fix-flyback-us.ts [--dry-run]

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const TRAIL_DATA_DIR = join(process.cwd(), 'public', 'trail-data');
const GAP_KM = 2;

interface TrailInput {
  name: string;
  officialDistanceKm: number;
  [key: string]: any;
}

interface TrailData {
  id: string;
  name: string;
  coordinates: [number, number, number][];
  dataSource: string;
  calculatedKm: number;
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

function toId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
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

// Remove sections that fly back toward the trail start
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

    // Flyback: midpoint much closer to origin than where we left off,
    // AND section is small relative to progress
    const isFlyback = secMidFromOrigin < lastEndFromOrigin * 0.5 && secDist < lastEndFromOrigin * 0.3;

    if (isFlyback) {
      console.log(`     Removing flyback section ${i}: ${sections[i].length} pts, ${secDist.toFixed(1)}km (mid ${secMidFromOrigin.toFixed(1)}km from origin vs last end ${lastEndFromOrigin.toFixed(1)}km)`);
      removed++;
    } else {
      kept.push(sections[i]);
    }
  }

  return { kept, removed };
}

// Also try the "stitch two halves" approach for trails where OSM produces
// two halves meeting at midpoint with gap back to start
function tryStitchHalves(coords: [number, number, number][], officialKm: number): { coords: [number, number, number][]; stitched: boolean; description: string } {
  const sections = splitAtGaps(coords, GAP_KM);
  if (sections.length !== 2) return { coords, stitched: false, description: 'not 2 sections' };

  const s1 = sections[0];
  const s2 = sections[1];
  const s1End = s1[s1.length - 1];
  const s2Start = s2[0];
  const s2End = s2[s2.length - 1];
  const origin = s1[0];

  // Check if section 2 starts near section 1's end (continuation)
  // OR if section 2 starts back near origin (flyback to fill second half)
  const gapToOrigin = haversine(s2Start[1], s2Start[0], origin[1], origin[0]);
  const gapToS1End = haversine(s2Start[1], s2Start[0], s1End[1], s1End[0]);

  // If s2 starts near origin — it's the classic flyback pattern
  // The trail was split into two halves, both starting from the origin
  if (gapToOrigin < gapToS1End && gapToOrigin < 5) {
    // Section 2 goes from origin toward the trail end
    // Section 1 goes from origin toward some midpoint
    // We need to figure out which half comes first

    const s1Km = totalDist(s1);
    const s2Km = totalDist(s2);

    // Try: reverse s1 (so it goes midpoint→origin) + s2 (origin→end)
    const reversed1 = [...s1].reverse() as [number, number, number][];
    const stitchedA = [...reversed1, ...s2];
    const stitchedAKm = totalDist(stitchedA);
    const errA = Math.abs(stitchedAKm - officialKm) / officialKm;

    // Try: s2 + reverse s1
    const stitchedB = [...s2, ...reversed1];
    const stitchedBKm = totalDist(stitchedB);
    const errB = Math.abs(stitchedBKm - officialKm) / officialKm;

    // Try: s1 + reverse s2
    const reversed2 = [...s2].reverse() as [number, number, number][];
    const stitchedC = [...s1, ...reversed2];
    const stitchedCKm = totalDist(stitchedC);
    const errC = Math.abs(stitchedCKm - officialKm) / officialKm;

    const best = [
      { coords: stitchedA, km: stitchedAKm, err: errA, desc: 'rev(s1)+s2' },
      { coords: stitchedB, km: stitchedBKm, err: errB, desc: 's2+rev(s1)' },
      { coords: stitchedC, km: stitchedCKm, err: errC, desc: 's1+rev(s2)' },
    ].sort((a, b) => a.err - b.err)[0];

    return {
      coords: best.coords as [number, number, number][],
      stitched: true,
      description: `stitched ${best.desc}: s1=${s1Km.toFixed(1)}km + s2=${s2Km.toFixed(1)}km → ${best.km.toFixed(1)}km`,
    };
  }

  // If s2 starts near s1 end — it's a continuation with a gap
  if (gapToS1End < 10) {
    const stitched = [...s1, ...s2];
    const km = totalDist(stitched);
    return {
      coords: stitched as [number, number, number][],
      stitched: true,
      description: `gap-stitched: ${gapToS1End.toFixed(1)}km gap`,
    };
  }

  return { coords, stitched: false, description: 'sections not stitchable' };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`=== FLYBACK FIX — US TRAILS ===${dryRun ? ' (DRY RUN)' : ''}\n`);

  // Load US trail list for official distances
  const trailList: TrailInput[] = JSON.parse(
    readFileSync(join(process.cwd(), 'scripts', 'trail-curation', 'trail-lists', 'us-trails.json'), 'utf-8')
  );

  const officialKm = new Map<string, number>();
  for (const t of trailList) {
    officialKm.set(toId(t.name), t.officialDistanceKm);
  }

  // Find all US trail files
  const usTrailIds = new Set<string>();
  for (const t of trailList) {
    const id = toId(t.name);
    if (existsSync(join(TRAIL_DATA_DIR, `${id}.json`))) {
      usTrailIds.add(id);
    }
  }

  console.log(`Found ${usTrailIds.size} US trail files\n`);

  const results: { name: string; before: number; after: number; official: number; action: string }[] = [];
  let fixedCount = 0;

  for (const id of [...usTrailIds].sort()) {
    const filePath = join(TRAIL_DATA_DIR, `${id}.json`);
    let trail: TrailData;
    try {
      trail = JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch { continue; }

    const offKm = officialKm.get(id) || trail.distance_km;
    const beforeKm = totalDist(trail.coordinates);
    const beforeErr = Math.abs(beforeKm - offKm) / offKm;

    // Skip trails with GPX data (already good quality)
    if (trail.dataSource === 'fkt_gpx' || trail.dataSource === 'gpx_user') {
      results.push({ name: trail.name, before: beforeKm, after: beforeKm, official: offKm, action: 'skip (GPX)' });
      continue;
    }

    // Try flyback removal first
    const sections = splitAtGaps(trail.coordinates, GAP_KM);
    let bestCoords = trail.coordinates;
    let bestKm = beforeKm;
    let action = 'no change';

    if (sections.length > 1) {
      // Method 1: Remove flyback sections
      const { kept, removed } = removeFlybacks(sections);
      if (removed > 0) {
        const flybackCoords = kept.flat() as [number, number, number][];
        const flybackKm = totalDist(flybackCoords);
        const flybackErr = Math.abs(flybackKm - offKm) / offKm;

        if (flybackErr < beforeErr && flybackCoords.length > trail.coordinates.length * 0.3) {
          bestCoords = flybackCoords;
          bestKm = flybackKm;
          action = `removed ${removed} flyback section(s)`;
        }
      }

      // Method 2: Try stitch two halves (for 2-section trails)
      const stitch = tryStitchHalves(trail.coordinates, offKm);
      if (stitch.stitched) {
        const stitchKm = totalDist(stitch.coords);
        const stitchErr = Math.abs(stitchKm - offKm) / offKm;
        const currentBestErr = Math.abs(bestKm - offKm) / offKm;

        if (stitchErr < currentBestErr) {
          bestCoords = stitch.coords;
          bestKm = stitchKm;
          action = stitch.description;
        }
      }
    }

    const afterErr = Math.abs(bestKm - offKm) / offKm;

    if (action !== 'no change' && afterErr < beforeErr) {
      const beforeStatus = beforeErr <= 0.05 ? 'OK' : beforeErr <= 0.25 ? 'FAIR' : 'HIGH';
      const afterStatus = afterErr <= 0.05 ? 'OK' : afterErr <= 0.25 ? 'FAIR' : 'HIGH';

      console.log(`${trail.name}:`);
      console.log(`  ${beforeKm.toFixed(1)}km → ${bestKm.toFixed(1)}km (${(beforeErr * 100).toFixed(1)}% → ${(afterErr * 100).toFixed(1)}%) [${beforeStatus} → ${afterStatus}]`);
      console.log(`  Action: ${action}`);

      if (!dryRun) {
        trail.coordinates = bestCoords;
        trail.calculatedKm = bestKm;
        writeFileSync(filePath, JSON.stringify(trail, null, 2));
        console.log(`  SAVED`);
      }
      console.log();
      fixedCount++;
    }

    results.push({ name: trail.name, before: beforeKm, after: bestKm, official: offKm, action });
  }

  // Summary table
  console.log('\n=== QUALITY SUMMARY ===');
  console.log(`${'Status'.padEnd(6)} ${'Trail'.padEnd(42)} ${'Calc'.padStart(10)} ${'Official'.padStart(10)} ${'Off'.padStart(8)}`);
  console.log('-'.repeat(80));

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
    const changed = r.action !== 'no change' && r.action !== 'skip (GPX)' ? ' *' : '';
    console.log(`${status.padEnd(6)} ${r.name.padEnd(42)} ${(r.after.toFixed(1) + 'km').padStart(10)} ${(r.official + 'km').padStart(10)} ${((err * 100).toFixed(1) + '%').padStart(8)}${changed}`);
  }

  console.log(`\nFixed: ${fixedCount}/${results.length} trails`);
  console.log(`Quality: OK=${okCount}, FAIR=${fairCount}, HIGH=${highCount}`);
}

main().catch(console.error);
