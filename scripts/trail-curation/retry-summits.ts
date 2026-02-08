// Retry summit routes that failed due to rate limiting
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

async function main() {
  const trailDir = join(process.cwd(), 'public', 'trail-data');
  mkdirSync(join(trailDir, 'summits'), { recursive: true });

  // 1. Western Arthurs Traverse
  console.log('=== Western Arthurs Traverse ===');
  try {
    const q1 = '[out:json][timeout:60];way(id:119106911,276752560);out body;>;out skel qt;';
    const data1 = await queryOverpass(q1);
    const nodes1 = data1.elements.filter((e: any) => e.type === 'node');
    const ways1 = data1.elements.filter((e: any) => e.type === 'way');
    const nodeMap1 = new Map<number, { lat: number; lon: number }>();
    for (const n of nodes1) nodeMap1.set(n.id, { lat: n.lat, lon: n.lon });
    const coords1: [number, number][] = [];
    for (const way of ways1) {
      for (const nid of (way.nodes || [])) {
        const n = nodeMap1.get(nid);
        if (n) coords1.push([n.lon, n.lat]);
      }
    }
    console.log(`  ${coords1.length} points`);
    console.log('  Enriching elevation...');
    const elev1 = await fetchElevations(coords1);
    const full1: [number, number, number][] = coords1.map((c, i) => [c[0], c[1], elev1[i]]);
    const high1 = Math.max(...elev1);
    console.log(`  High point: ${high1}m`);
    writeFileSync(join(trailDir, 'summits', 'western_arthurs_traverse_osm.json'), JSON.stringify({
      name: 'Western Arthurs Traverse (OSM)',
      parentTrailId: 'western_arthur_range_traverse',
      coordinates: full1,
      highPoint: high1,
    }, null, 2));
  } catch (err) {
    console.log(`  Error: ${err}`);
  }

  await new Promise(r => setTimeout(r, 5000));

  // 2. Acropolis area
  console.log('\n=== The Acropolis area ===');
  try {
    const q2 = '[out:json][timeout:30];way["highway"~"path|track"](around:3000,-41.9167,146.0167);out body;>;out skel qt;';
    const data2 = await queryOverpass(q2);
    const ways2 = data2.elements.filter((e: any) => e.type === 'way');
    const nodes2 = data2.elements.filter((e: any) => e.type === 'node');
    const nodeMap2 = new Map<number, { lat: number; lon: number }>();
    for (const n of nodes2) nodeMap2.set(n.id, { lat: n.lat, lon: n.lon });
    console.log(`  ${ways2.length} ways found:`);
    for (const w of ways2) {
      console.log(`    "${w.tags?.name || 'unnamed'}" (${(w.nodes || []).length} nodes, sac:${w.tags?.sac_scale || 'none'})`);
    }
    // Extract all coordinates
    const coords2: [number, number][] = [];
    for (const way of ways2) {
      for (const nid of (way.nodes || [])) {
        const n = nodeMap2.get(nid);
        if (n) coords2.push([n.lon, n.lat]);
      }
    }
    if (coords2.length > 0) {
      console.log(`  ${coords2.length} total points, enriching elevation...`);
      const elev2 = await fetchElevations(coords2);
      const high2 = Math.max(...elev2);
      console.log(`  High point: ${high2}m`);
    }
  } catch (err) {
    console.log(`  Error: ${err}`);
  }

  await new Promise(r => setTimeout(r, 5000));

  // 3. Federation Peak area
  console.log('\n=== Federation Peak area ===');
  try {
    const q3 = '[out:json][timeout:30];way["highway"~"path|track"](around:5000,-43.2667,146.5167);out body;>;out skel qt;';
    const data3 = await queryOverpass(q3);
    const ways3 = data3.elements.filter((e: any) => e.type === 'way');
    console.log(`  ${ways3.length} ways found:`);
    for (const w of ways3) {
      console.log(`    "${w.tags?.name || 'unnamed'}" (${(w.nodes || []).length} nodes, sac:${w.tags?.sac_scale || 'none'})`);
    }
  } catch (err) {
    console.log(`  Error: ${err}`);
  }
}

main().catch(console.error);
