// Fix flyback v2: Instead of keeping only longest section, remove only
// sections that go backwards (flyback towards start). Keep all forward sections.
// A section is "flyback" if its midpoint is closer to the trail start than
// the previous section's endpoint.
// Usage: npx tsx scripts/trail-curation/fix-flyback-v2.ts

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const TRAIL_DATA_DIR = join(process.cwd(), 'public', 'trail-data');
const GAP_KM = 2;

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

// Keep forward-progressing sections, remove flybacks
// A section is a flyback if its start is significantly closer to the trail origin
// than the end of the last kept section (it "flies back")
function removeFlybbacks(sections: [number, number, number][][]): [number, number, number][][] {
  if (sections.length <= 1) return sections;

  const origin = sections[0][0]; // Trail start point
  const kept: [number, number, number][][] = [sections[0]];

  for (let i = 1; i < sections.length; i++) {
    const lastKept = kept[kept.length - 1];
    const lastEnd = lastKept[lastKept.length - 1];

    const secStart = sections[i][0];
    const secMid = sections[i][Math.floor(sections[i].length / 2)];

    // Distance from origin to the last kept section's end
    const lastEndFromOrigin = haversine(origin[1], origin[0], lastEnd[1], lastEnd[0]);

    // Distance from origin to this section's midpoint
    const secMidFromOrigin = haversine(origin[1], origin[0], secMid[1], secMid[0]);

    // Section distance (how much trail it represents)
    const secDist = totalDist(sections[i]);

    // It's a flyback if the midpoint is much closer to origin than where we left off
    // AND the section is small relative to where we are
    const isFlyback = secMidFromOrigin < lastEndFromOrigin * 0.5 && secDist < lastEndFromOrigin * 0.3;

    if (isFlyback) {
      console.log(`     Removing flyback section ${i}: ${sections[i].length} pts, ${secDist.toFixed(1)}km (mid ${secMidFromOrigin.toFixed(1)}km from origin vs last end ${lastEndFromOrigin.toFixed(1)}km)`);
    } else {
      kept.push(sections[i]);
    }
  }

  return kept;
}

// Trails that were over-cut by v1 (need re-processing from original ordered data)
// We'll re-read the ordered files, apply smarter flyback removal
const TRAILS_TO_FIX = [
  'larapinta_trail',
  'great_north_walk',
  'grampians_peaks_trail',
  'yuraygir_coastal_walk',
];

async function main() {
  console.log('=== FLYBACK FIX v2 (forward-progression) ===\n');

  // Load official distances
  const trailList = JSON.parse(
    readFileSync(join(process.cwd(), 'scripts', 'trail-curation', 'trail-lists', 'australia-mainland-top25.json'), 'utf-8')
  );
  const officialKm = new Map<string, number>();
  for (const t of trailList) {
    const id = t.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    officialKm.set(id, t.officialDistanceKm);
  }

  // These trails need re-ordering from scratch because v1 flyback fix already cut them
  // We need to re-query or restore from progress data
  // For now, check what we have and apply smarter logic

  for (const id of TRAILS_TO_FIX) {
    const filePath = join(TRAIL_DATA_DIR, `${id}.json`);
    let trail: TrailData;
    try {
      trail = JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch { continue; }

    const offKm = officialKm.get(id) || trail.distance_km;
    const currentError = Math.abs(trail.calculatedKm - offKm) / offKm;

    console.log(`${trail.name}: ${trail.calculatedKm.toFixed(1)}km (${(currentError * 100).toFixed(1)}% off ${offKm}km)`);

    const sections = splitAtGaps(trail.coordinates, GAP_KM);
    if (sections.length <= 1) {
      console.log(`  No gaps found, skipping\n`);
      continue;
    }

    console.log(`  ${sections.length} sections found:`);
    for (let i = 0; i < sections.length; i++) {
      console.log(`    Section ${i}: ${sections[i].length} pts, ${totalDist(sections[i]).toFixed(1)}km`);
    }

    const kept = removeFlybbacks(sections);
    const keptCoords = kept.flat() as [number, number, number][];
    const newKm = totalDist(keptCoords);
    const newError = Math.abs(newKm - offKm) / offKm;

    console.log(`  Result: ${keptCoords.length} pts, ${newKm.toFixed(1)}km (${(newError * 100).toFixed(1)}% off)`);

    if (newError < currentError && keptCoords.length > trail.coordinates.length * 0.5) {
      trail.coordinates = keptCoords;
      trail.calculatedKm = newKm;
      writeFileSync(filePath, JSON.stringify(trail, null, 2));
      console.log(`  SAVED ✓\n`);
    } else {
      console.log(`  No improvement or too aggressive, keeping current\n`);
    }
  }
}

main().catch(console.error);
