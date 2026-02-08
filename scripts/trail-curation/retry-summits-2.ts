// Extract Mount Oakleigh and Federation Peak approach from OSM
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';
const TOPO_API = 'https://api.opentopodata.org/v1/srtm30m';

async function queryOverpass(query: string): Promise<any> {
  const response = await fetch(OVERPASS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (response.status !== 200) throw new Error(`Overpass: ${response.status}`);
  return response.json();
}

async function fetchElevations(coords: [number, number][]): Promise<number[]> {
  const elevations: number[] = [];
  for (let i = 0; i < coords.length; i += 100) {
    const batch = coords.slice(i, i + 100);
    const locations = batch.map(c => `${c[1]},${c[0]}`).join('|');
    const response = await fetch(`${TOPO_API}?locations=${locations}`);
    if (response.status === 200) {
      const data = await response.json();
      for (const r of (data.results || [])) {
        elevations.push(r.elevation !== null ? Math.round(r.elevation) : 0);
      }
    } else {
      batch.forEach(() => elevations.push(0));
    }
    await new Promise(r => setTimeout(r, 1100));
  }
  return elevations;
}

function extractCoords(data: any): [number, number][] {
  const elements = data.elements || [];
  const ways = elements.filter((e: any) => e.type === 'way');
  const nodes = elements.filter((e: any) => e.type === 'node');
  const nodeMap = new Map<number, { lat: number; lon: number }>();
  for (const n of nodes) nodeMap.set(n.id, { lat: n.lat, lon: n.lon });
  const coords: [number, number][] = [];
  for (const way of ways) {
    for (const nid of (way.nodes || [])) {
      const n = nodeMap.get(nid);
      if (n) coords.push([n.lon, n.lat]);
    }
  }
  return coords;
}

async function main() {
  const trailDir = join(process.cwd(), 'public', 'trail-data');
  mkdirSync(join(trailDir, 'summits'), { recursive: true });

  // 1. Mount Oakleigh — search near summit (-41.9000, 146.0000, 1286m)
  console.log('=== Mount Oakleigh ===');
  try {
    const q1 = '[out:json][timeout:30];way["highway"~"path|track"]["name"~"Oakleigh"](around:3000,-41.9000,146.0000);out body;>;out skel qt;';
    const data1 = await queryOverpass(q1);
    const ways1 = data1.elements.filter((e: any) => e.type === 'way');
    console.log(`  ${ways1.length} ways found:`);
    for (const w of ways1) {
      console.log(`    "${w.tags?.name || 'unnamed'}" (${(w.nodes || []).length} nodes)`);
    }
    const coords1 = extractCoords(data1);
    if (coords1.length > 0) {
      console.log(`  ${coords1.length} points, enriching elevation...`);
      const elev1 = await fetchElevations(coords1);
      const high1 = Math.max(...elev1);
      console.log(`  High point: ${high1}m`);
      writeFileSync(join(trailDir, 'summits', 'mount_oakleigh_track.json'), JSON.stringify({
        name: 'Mount Oakleigh Track',
        parentTrailId: 'overland_track',
        coordinates: coords1.map((c, i) => [c[0], c[1], elev1[i]]),
        highPoint: high1,
      }, null, 2));
    } else {
      // Try broader search without name filter
      console.log('  No named results, trying area search...');
      const q1b = '[out:json][timeout:30];way["highway"~"path|track"](around:1500,-41.9000,146.0000);out body;>;out skel qt;';
      const data1b = await queryOverpass(q1b);
      const ways1b = data1b.elements.filter((e: any) => e.type === 'way');
      console.log(`  ${ways1b.length} ways in area:`);
      for (const w of ways1b) {
        console.log(`    "${w.tags?.name || 'unnamed'}" (${(w.nodes || []).length} nodes)`);
      }
    }
  } catch (err) {
    console.log(`  Error: ${err}`);
  }

  await new Promise(r => setTimeout(r, 5000));

  // 2. Federation Peak approach — extract the Eastern Arthur Range Traverse way
  console.log('\n=== Federation Peak approach (Eastern Arthurs) ===');
  try {
    const q2 = '[out:json][timeout:60];way["highway"~"path|track"](around:5000,-43.2667,146.5167);out body;>;out skel qt;';
    const data2 = await queryOverpass(q2);
    const ways2 = data2.elements.filter((e: any) => e.type === 'way');
    console.log(`  ${ways2.length} ways found:`);
    for (const w of ways2) {
      console.log(`    "${w.tags?.name || 'unnamed'}" (${(w.nodes || []).length} nodes)`);
    }
    const coords2 = extractCoords(data2);
    if (coords2.length > 0) {
      console.log(`  ${coords2.length} total points, enriching elevation...`);
      const elev2 = await fetchElevations(coords2);
      const high2 = Math.max(...elev2);
      const low2 = Math.min(...elev2);
      console.log(`  Elevation: ${low2}m — ${high2}m`);
      writeFileSync(join(trailDir, 'summits', 'federation_peak_approach.json'), JSON.stringify({
        name: 'Federation Peak Approach (Eastern Arthurs)',
        parentTrailId: 'federation_peak',
        coordinates: coords2.map((c, i) => [c[0], c[1], elev2[i]]),
        highPoint: high2,
      }, null, 2));
    }
  } catch (err) {
    console.log(`  Error: ${err}`);
  }

  await new Promise(r => setTimeout(r, 5000));

  // 3. Retry The Acropolis
  console.log('\n=== The Acropolis ===');
  try {
    const q3 = '[out:json][timeout:60];way["highway"~"path|track"]["name"~"Acropolis"](around:5000,-41.9167,146.0167);out body;>;out skel qt;';
    const data3 = await queryOverpass(q3);
    const ways3 = data3.elements.filter((e: any) => e.type === 'way');
    console.log(`  ${ways3.length} ways found:`);
    for (const w of ways3) {
      console.log(`    "${w.tags?.name || 'unnamed'}" (${(w.nodes || []).length} nodes)`);
    }
    const coords3 = extractCoords(data3);
    if (coords3.length > 0) {
      console.log(`  ${coords3.length} points, enriching elevation...`);
      const elev3 = await fetchElevations(coords3);
      const high3 = Math.max(...elev3);
      console.log(`  High point: ${high3}m`);
      writeFileSync(join(trailDir, 'summits', 'the_acropolis_track.json'), JSON.stringify({
        name: 'The Acropolis Track',
        parentTrailId: 'overland_track',
        coordinates: coords3.map((c, i) => [c[0], c[1], elev3[i]]),
        highPoint: high3,
      }, null, 2));
    }
  } catch (err) {
    console.log(`  Error: ${err}`);
  }
}

main().catch(console.error);
