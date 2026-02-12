// Final retry for last 4 trails — very targeted queries
// Usage: npx tsx scripts/trail-curation/retry3-au-phase13.ts

import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const TOPO_API = 'https://api.opentopodata.org/v1/srtm30m';
const OVERPASS_API = 'https://overpass.kumi.systems/api/interpreter';

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function totalDistance(coords: [number, number][]): number {
  let d = 0;
  for (let i = 1; i < coords.length; i++) {
    d += haversine(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
  }
  return d;
}

async function sleep(ms: number) { await new Promise(r => setTimeout(r, ms)); }

async function queryOverpass(query: string): Promise<{ coords: [number, number][]; source: string } | null> {
  try {
    const res = await fetch(OVERPASS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (!res.ok) { console.log(`    HTTP ${res.status}`); return null; }
    const data = await res.json();
    const elements = data.elements || [];
    const nodes = elements.filter((e: any) => e.type === 'node');
    const ways = elements.filter((e: any) => e.type === 'way');
    if (ways.length === 0) { console.log(`    No ways found`); return null; }
    const nodeMap = new Map<number, { lat: number; lon: number }>();
    for (const n of nodes) { if (n.lat !== undefined) nodeMap.set(n.id, { lat: n.lat, lon: n.lon }); }
    const coords: [number, number][] = [];
    for (const way of ways) { for (const nid of (way.nodes || [])) { const n = nodeMap.get(nid); if (n) coords.push([n.lon, n.lat]); } }
    console.log(`    ${ways.length} ways, ${coords.length} pts`);
    return coords.length >= 5 ? { coords, source: 'osm_overpass' } : null;
  } catch (err) { console.log(`    Error: ${err}`); return null; }
}

async function enrichElevation(coords: [number, number][]): Promise<[number, number, number][]> {
  const result: [number, number, number][] = [];
  for (let i = 0; i < coords.length; i += 100) {
    const batch = coords.slice(i, i + 100);
    const locations = batch.map(c => `${c[1]},${c[0]}`).join('|');
    try {
      const res = await fetch(`${TOPO_API}?locations=${locations}`);
      if (res.ok) {
        const data = await res.json();
        for (let j = 0; j < batch.length; j++) {
          const ele = data.results?.[j]?.elevation ?? 0;
          result.push([batch[j][0], batch[j][1], Math.round(ele)]);
        }
      } else { for (const c of batch) result.push([c[0], c[1], 0]); }
    } catch { for (const c of batch) result.push([c[0], c[1], 0]); }
    await sleep(1100);
  }
  return result;
}

async function processTrail(name: string, id: string, region: string, officialKm: number, typicalDays: string, queries: string[]) {
  const trailDataDir = join(process.cwd(), 'public', 'trail-data');
  const targetPath = join(trailDataDir, `${id}.json`);
  if (existsSync(targetPath)) { console.log(`  SKIP: exists`); return true; }

  for (let i = 0; i < queries.length; i++) {
    console.log(`  Query ${i + 1}/${queries.length}...`);
    const result = await queryOverpass(queries[i]);
    if (result) {
      const km = totalDistance(result.coords);
      console.log(`  Enriching elevation (${result.coords.length} pts)...`);
      const coords3d = await enrichElevation(result.coords);
      writeFileSync(targetPath, JSON.stringify({
        id, name, region, country: 'AU', distance_km: officialKm, typical_days: typicalDays,
        coordinates: coords3d, dataSource: result.source, calculatedKm: km,
      }));
      console.log(`  SUCCESS: ${coords3d.length} pts, ${km.toFixed(1)} km`);
      return true;
    }
    await sleep(5000);
  }
  return false;
}

async function main() {
  console.log(`=== FINAL RETRY: 4 REMAINING TRAILS ===\n`);

  // 1. Grand Canyon Track - try with steps tag and very tight bbox around Blackheath
  console.log(`[1/4] Grand Canyon Track`);
  const gc = await processTrail(
    'Grand Canyon Track', 'grand_canyon_track', 'Blue Mountains, NSW', 6, '1',
    [
      // Include steps (the canyon has many) and use tight bbox
      `[out:json][timeout:120];(way["highway"~"path|track|footway|steps"]["name"~"Grand Canyon",i](-33.69,150.32,-33.66,150.36);way["highway"~"path|track|footway|steps"]["name"~"Evans Lookout|Neates Glen",i](-33.69,150.32,-33.66,150.36););out body;>;out skel qt;`,
      // All paths in Grand Canyon area
      `[out:json][timeout:120];way["highway"~"path|footway|steps"](-33.685,150.325,-33.665,150.355);out body;>;out skel qt;`,
    ]
  );
  await sleep(6000);

  // 2. Mt Talyuberlup - try wider bbox and all track types
  console.log(`\n[2/4] Mt Talyuberlup`);
  const mt = await processTrail(
    'Mt Talyuberlup', 'mt_talyuberlup', 'Stirling Range, WA', 3, '1',
    [
      `[out:json][timeout:120];way["highway"~"path|track|footway"](-34.395,118.010,-34.365,118.050);out body;>;out skel qt;`,
      // Even wider
      `[out:json][timeout:120];way["highway"~"path|track|footway|cycleway"](-34.40,118.00,-34.36,118.06);out body;>;out skel qt;`,
    ]
  );
  await sleep(6000);

  // 3. Hakea Trail
  console.log(`\n[3/4] Hakea Trail`);
  const ht = await processTrail(
    'Hakea Trail', 'hakea_trail', 'Stirling Range, WA', 8, '1',
    [
      `[out:json][timeout:120];way["highway"~"path|track|footway"]["name"~"Hakea",i](-34.44,117.95,-34.34,118.15);out body;>;out skel qt;`,
      // All named hiking paths in eastern Stirling Range
      `[out:json][timeout:120];way["highway"~"path|track|footway"](-34.41,118.03,-34.37,118.09);out body;>;out skel qt;`,
    ]
  );
  await sleep(6000);

  // 4. Nancy Peak and Devils Slide
  console.log(`\n[4/4] Nancy Peak and Devils Slide`);
  const np = await processTrail(
    'Nancy Peak and Devils Slide', 'nancy_peak_and_devils_slide', 'Porongurup Range, WA', 5, '1',
    [
      // All paths in Porongurup Range
      `[out:json][timeout:120];way["highway"~"path|track|footway"](-34.70,117.84,-34.66,117.92);out body;>;out skel qt;`,
    ]
  );

  console.log(`\n=== DONE ===`);
  console.log(`Grand Canyon: ${gc ? 'SUCCESS' : 'FAILED'}`);
  console.log(`Talyuberlup: ${mt ? 'SUCCESS' : 'FAILED'}`);
  console.log(`Hakea Trail: ${ht ? 'SUCCESS' : 'FAILED'}`);
  console.log(`Nancy Peak: ${np ? 'SUCCESS' : 'FAILED'}`);
}

main().catch(console.error);
