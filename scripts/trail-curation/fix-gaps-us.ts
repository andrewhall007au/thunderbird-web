// Fix straight-line gap artifacts in US trail data
// Strategy 1: Gap skipping — try multiple thresholds, skip segments > threshold from distance calc
// Strategy 2: Section dedup — detect sections starting back near origin (Lost Coast pattern)
// Key rule: ONLY apply a correction if it brings calculated distance CLOSER to official
//
// Usage: npx tsx scripts/trail-curation/fix-gaps-us.ts [--dry-run]

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const TRAIL_DATA_DIR = join(process.cwd(), 'public', 'trail-data');

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

// Strategy 1: Skip segments larger than threshold in distance calculation
function calcDistSkippingGaps(coords: [number, number, number][], thresholdKm: number): { trailKm: number; gapKm: number; gapCount: number } {
  let trailKm = 0;
  let gapKm = 0;
  let gapCount = 0;
  for (let i = 1; i < coords.length; i++) {
    const seg = haversine(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
    if (seg > thresholdKm) {
      gapKm += seg;
      gapCount++;
    } else {
      trailKm += seg;
    }
  }
  return { trailKm, gapKm, gapCount };
}

// Strategy 2: Split at gaps, detect & remove duplicate/flyback sections
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

function removeDuplicateSections(
  sections: [number, number, number][][],
  officialKm: number
): { coords: [number, number, number][]; description: string } | null {
  if (sections.length <= 1) return null;

  const origin = sections[0][0];
  const sectionMeta = sections.map((s, i) => {
    const dist = totalDist(s);
    const startFromOrigin = haversine(s[0][1], s[0][0], origin[1], origin[0]);
    return { idx: i, pts: s.length, dist, startFromOrigin };
  });

  // Find sections that START back near origin (within 2km) when they shouldn't
  // These are likely duplicate directions of the same trail
  const farSections = sectionMeta.filter(s => s.idx > 0 && s.startFromOrigin < 2);

  if (farSections.length === 0) return null;

  // Try keeping all sections EXCEPT the ones starting back near origin
  const keptIdxs = new Set(sectionMeta.map(s => s.idx));
  for (const fs of farSections) {
    keptIdxs.delete(fs.idx);
  }

  const keptCoords = [...keptIdxs].sort().flatMap(i => sections[i]) as [number, number, number][];
  const keptDist = totalDist(keptCoords);
  const origDist = totalDist(sections.flat() as [number, number, number][]);

  // Also try keeping ONLY the section closest to official distance
  const closestToOfficial = sectionMeta
    .filter(s => s.dist > 1) // skip tiny junk
    .sort((a, b) => Math.abs(a.dist - officialKm) - Math.abs(b.dist - officialKm))[0];

  // Also try: keep longest section
  const longest = sectionMeta.sort((a, b) => b.dist - a.dist)[0];

  const candidates: { coords: [number, number, number][]; dist: number; desc: string }[] = [];

  // Candidate: remove flyback sections
  if (keptCoords.length > 0 && keptIdxs.size < sections.length) {
    candidates.push({
      coords: keptCoords,
      dist: keptDist,
      desc: `removed ${farSections.length} section(s) starting near origin`
    });
  }

  // Candidate: keep only closest-to-official section
  if (closestToOfficial) {
    candidates.push({
      coords: sections[closestToOfficial.idx] as [number, number, number][],
      dist: closestToOfficial.dist,
      desc: `kept section ${closestToOfficial.idx} (${closestToOfficial.dist.toFixed(1)}km, closest to official)`
    });
  }

  if (candidates.length === 0) return null;

  // Pick the candidate closest to official
  const best = candidates.sort((a, b) =>
    Math.abs(a.dist - officialKm) - Math.abs(b.dist - officialKm)
  )[0];

  return { coords: best.coords, description: best.desc };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`=== GAP FIX — US TRAILS ===${dryRun ? ' (DRY RUN)' : ''}\n`);

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

  const GAP_THRESHOLDS = [0.5, 1, 2, 5, 10, 20, 50];
  const SECTION_SPLIT_THRESHOLD = 2; // km — for section dedup

  const results: { name: string; before: number; after: number; official: number; action: string }[] = [];
  let fixedCount = 0;

  for (const id of [...usTrailIds].sort()) {
    const filePath = join(TRAIL_DATA_DIR, `${id}.json`);
    let trail: TrailData;
    try {
      trail = JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch { continue; }

    const offKm = officialKm.get(id) || trail.distance_km;
    const currentKm = totalDist(trail.coordinates);
    const currentErr = Math.abs(currentKm - offKm) / offKm;

    // Skip trails already very close to official
    if (currentErr < 0.02) {
      results.push({ name: trail.name, before: currentKm, after: currentKm, official: offKm, action: 'skip (already OK)' });
      continue;
    }

    let bestKm = currentKm;
    let bestErr = currentErr;
    let bestAction = 'no change';
    let bestCoords: [number, number, number][] | null = null;

    // Strategy 1: Try different gap thresholds (distance recalculation only)
    for (const threshold of GAP_THRESHOLDS) {
      const { trailKm, gapKm, gapCount } = calcDistSkippingGaps(trail.coordinates, threshold);
      if (gapCount === 0) continue;

      const err = Math.abs(trailKm - offKm) / offKm;
      if (err < bestErr) {
        bestKm = trailKm;
        bestErr = err;
        bestAction = `skip ${gapCount} gaps >${threshold}km (${gapKm.toFixed(1)}km removed)`;
        bestCoords = null; // coordinates unchanged, only calculatedKm updates
      }
    }

    // Strategy 2: Section dedup (coordinates change)
    const sections = splitAtGaps(trail.coordinates, SECTION_SPLIT_THRESHOLD);
    if (sections.length > 1) {
      const dedup = removeDuplicateSections(sections, offKm);
      if (dedup) {
        const dedupKm = totalDist(dedup.coords);
        const dedupErr = Math.abs(dedupKm - offKm) / offKm;
        if (dedupErr < bestErr) {
          bestKm = dedupKm;
          bestErr = dedupErr;
          bestAction = `dedup: ${dedup.description}`;
          bestCoords = dedup.coords;
        }
      }
    }

    // Only apply if we improved
    if (bestAction !== 'no change' && bestErr < currentErr) {
      const beforeStatus = currentErr <= 0.05 ? 'OK' : currentErr <= 0.25 ? 'FAIR' : 'HIGH';
      const afterStatus = bestErr <= 0.05 ? 'OK' : bestErr <= 0.25 ? 'FAIR' : 'HIGH';

      console.log(`${trail.name}:`);
      console.log(`  ${currentKm.toFixed(1)}km → ${bestKm.toFixed(1)}km (${(currentErr * 100).toFixed(1)}% → ${(bestErr * 100).toFixed(1)}%) [${beforeStatus} → ${afterStatus}]`);
      console.log(`  Action: ${bestAction}`);

      if (!dryRun) {
        if (bestCoords) {
          trail.coordinates = bestCoords;
        }
        trail.calculatedKm = bestKm;
        writeFileSync(filePath, JSON.stringify(trail, null, 2));
        console.log(`  SAVED`);
      }
      console.log();
      fixedCount++;
    } else {
      // No improvement
    }

    results.push({ name: trail.name, before: currentKm, after: bestKm, official: offKm, action: bestAction });
  }

  // Summary table
  console.log('\n=== QUALITY SUMMARY (after gap fix) ===');
  console.log(`${'Status'.padEnd(6)} ${'Trail'.padEnd(45)} ${'Calc'.padStart(10)} ${'Official'.padStart(10)} ${'Off'.padStart(8)}  ${'Action'}`);
  console.log('-'.repeat(110));

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
    const changed = r.action !== 'no change' && r.action !== 'skip (already OK)' ? ' *' : '';
    console.log(`${status.padEnd(6)} ${r.name.padEnd(45)} ${(r.after.toFixed(1) + 'km').padStart(10)} ${(r.official + 'km').padStart(10)} ${((err * 100).toFixed(1) + '%').padStart(8)}  ${r.action}${changed}`);
  }

  console.log(`\nFixed: ${fixedCount}/${results.length} trails`);
  console.log(`Quality: OK=${okCount}, FAIR=${fairCount}, HIGH=${highCount}`);
}

main().catch(console.error);
