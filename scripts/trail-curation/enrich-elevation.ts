// Enrich ALL trail coordinate points with elevation from SRTM 30m DEM
// Every point gets real elevation — no sampling, no shortcuts
// Usage: npx tsx scripts/trail-curation/enrich-elevation.ts

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const TOPO_API = 'https://api.opentopodata.org/v1/srtm30m';
const BATCH_SIZE = 100;
const DELAY_MS = 1100;

interface TrailFile {
  id: string;
  name: string;
  region: string;
  country: string;
  distance_km: number;
  typical_days: string;
  coordinates: [number, number, number][];
}

async function fetchElevationBatch(coords: [number, number, number][]): Promise<(number | null)[]> {
  const locations = coords.map(c => `${c[1]},${c[0]}`).join('|');
  const response = await fetch(`${TOPO_API}?locations=${locations}`);

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  if (!data.results) return coords.map(() => null);

  return data.results.map((r: { elevation: number | null }) =>
    r.elevation !== null ? Math.round(r.elevation) : null
  );
}

async function enrichTrail(filePath: string): Promise<{ low: number; high: number; enriched: number; total: number }> {
  const trail: TrailFile = JSON.parse(readFileSync(filePath, 'utf8'));
  const coords = trail.coordinates;

  let enriched = 0;
  let low = Infinity;
  let high = -Infinity;
  let retries = 0;

  for (let i = 0; i < coords.length; i += BATCH_SIZE) {
    const batch = coords.slice(i, i + BATCH_SIZE);

    try {
      const elevations = await fetchElevationBatch(batch);

      for (let j = 0; j < batch.length; j++) {
        const elev = elevations[j];
        if (elev !== null) {
          coords[i + j][2] = elev;
          enriched++;
          if (elev < low) low = elev;
          if (elev > high) high = elev;
        }
      }
      retries = 0;
    } catch (err) {
      // Retry once after longer delay
      if (retries < 2) {
        retries++;
        console.log(`\n    Retry ${retries} after error...`);
        await new Promise(r => setTimeout(r, 3000));
        i -= BATCH_SIZE; // retry same batch
        continue;
      }
      console.log(`\n    Skipping batch after ${retries} retries`);
      retries = 0;
    }

    const progress = Math.min(i + BATCH_SIZE, coords.length);
    process.stdout.write(`\r    ${progress}/${coords.length} points`);

    if (i + BATCH_SIZE < coords.length) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  process.stdout.write('\n');

  trail.coordinates = coords;
  writeFileSync(filePath, JSON.stringify(trail));

  return { low, high, enriched, total: coords.length };
}

async function main() {
  const trailDir = join(process.cwd(), 'public', 'trail-data');
  const manifest = JSON.parse(readFileSync(join(trailDir, 'manifest.json'), 'utf8'));

  let totalPoints = 0;
  for (const m of manifest) totalPoints += m.pointCount;
  const estMinutes = Math.ceil(totalPoints / BATCH_SIZE * DELAY_MS / 60000);

  console.log(`=== ELEVATION ENRICHMENT (EVERY POINT) ===`);
  console.log(`Source: SRTM 30m via Open-Topo-Data`);
  console.log(`Trails: ${manifest.length}`);
  console.log(`Total points: ${totalPoints.toLocaleString()}`);
  console.log(`Estimated: ~${estMinutes} minutes\n`);

  const results: Array<{ name: string; low: number; high: number; enriched: number; total: number }> = [];

  for (let i = 0; i < manifest.length; i++) {
    const m = manifest[i];
    const filePath = join(trailDir, `${m.id}.json`);
    console.log(`  [${i + 1}/${manifest.length}] ${m.name} (${m.pointCount} pts)`);

    const result = await enrichTrail(filePath);
    results.push({ name: m.name, ...result });

    console.log(`    ${result.low}m low — ${result.high}m high (${result.enriched}/${result.total} enriched)`);
  }

  // Update manifest with elevation
  for (const m of manifest) {
    const r = results.find(r => r.name === m.name);
    if (r) {
      m.elevationLow = r.low;
      m.elevationHigh = r.high;
    }
  }
  writeFileSync(join(trailDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // Summary
  console.log(`\n=== ELEVATION SUMMARY ===`);
  console.log(`${'Trail'.padEnd(40)} ${'Low'.padStart(7)} ${'High'.padStart(7)} ${'Coverage'.padStart(8)}`);
  console.log('-'.repeat(64));
  for (const r of results) {
    const pct = ((r.enriched / r.total) * 100).toFixed(0) + '%';
    console.log(`${r.name.padEnd(40)} ${(r.low + 'm').padStart(7)} ${(r.high + 'm').padStart(7)} ${pct.padStart(8)}`);
  }
}

main().catch(console.error);
