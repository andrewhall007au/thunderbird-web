// Extract summit side track coordinates from OSM and merge with main trail data
// Usage: npx tsx scripts/trail-curation/extract-summit-routes.ts

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';
const TOPO_API = 'https://api.opentopodata.org/v1/srtm30m';

interface SummitRoute {
  name: string;
  parentTrailId: string;
  wayIds: number[];       // specific OSM way IDs to extract
  overpassQuery?: string; // or a custom query
}

// Known summit route way IDs from our search
const SUMMIT_ROUTES: SummitRoute[] = [
  {
    name: 'Mount Ossa Track',
    parentTrailId: 'overland_track',
    wayIds: [50801538, 752004270, 752004271],
  },
  {
    name: 'Cradle Mountain Summit Track',
    parentTrailId: 'overland_track',
    wayIds: [50799327], // "Cradle Mount Summit Track"
  },
  {
    name: 'Cradle Mountain Face Track',
    parentTrailId: 'overland_track',
    wayIds: [225519531], // "Cradle Mountain Face Track" + Chain Track
  },
  {
    name: 'Chain Track (Cradle)',
    parentTrailId: 'overland_track',
    wayIds: [183828827],
  },
  {
    name: 'Pelion West Track',
    parentTrailId: 'overland_track',
    wayIds: [306495159],
  },
  {
    name: 'Western Arthurs Traverse (OSM)',
    parentTrailId: 'western_arthur_range_traverse',
    wayIds: [119106911, 276752560],
  },
];

// Summits that need Overpass queries (rate limited earlier)
const SUMMIT_QUERIES: Array<{
  name: string;
  parentTrailId: string;
  lat: number;
  lng: number;
  radiusM: number;
  filterName?: string;
}> = [
  { name: 'Pelion East Track', parentTrailId: 'overland_track', lat: -41.8389, lng: 146.0417, radiusM: 2000, filterName: 'Pelion' },
  { name: 'The Acropolis Track', parentTrailId: 'overland_track', lat: -41.9167, lng: 146.0167, radiusM: 2000, filterName: 'Acropolis' },
  { name: 'Federation Peak Route', parentTrailId: 'federation_peak', lat: -43.2667, lng: 146.5167, radiusM: 3000, filterName: 'Federation' },
];

async function queryOverpass(query: string): Promise<any> {
  const response = await fetch(OVERPASS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!response.ok) throw new Error(`Overpass error: ${response.status}`);
  return response.json();
}

async function fetchWayCoordinates(wayIds: number[]): Promise<[number, number][]> {
  const idList = wayIds.join(',');
  const query = `
    [out:json][timeout:30];
    way(id:${idList});
    out body;
    >;
    out skel qt;
  `;

  const data = await queryOverpass(query);
  const elements = data.elements || [];
  const ways = elements.filter((e: any) => e.type === 'way');
  const nodes = elements.filter((e: any) => e.type === 'node');

  const nodeMap = new Map<number, { lat: number; lon: number }>();
  for (const n of nodes) {
    nodeMap.set(n.id, { lat: n.lat, lon: n.lon });
  }

  // Concatenate all way coordinates in order
  const coords: [number, number][] = [];
  for (const way of ways) {
    for (const nodeId of (way.nodes || [])) {
      const node = nodeMap.get(nodeId);
      if (node) coords.push([node.lon, node.lat]);
    }
  }

  return coords;
}

async function fetchElevations(coords: [number, number][]): Promise<number[]> {
  const elevations: number[] = [];

  for (let i = 0; i < coords.length; i += 100) {
    const batch = coords.slice(i, i + 100);
    const locations = batch.map(c => `${c[1]},${c[0]}`).join('|');
    const response = await fetch(`${TOPO_API}?locations=${locations}`);

    if (response.ok) {
      const data = await response.json();
      for (const r of (data.results || [])) {
        elevations.push(r.elevation !== null ? Math.round(r.elevation) : 0);
      }
    } else {
      for (const _ of batch) elevations.push(0);
    }

    await new Promise(r => setTimeout(r, 1100));
  }

  return elevations;
}

async function searchAndExtract(query: { name: string; lat: number; lng: number; radiusM: number; filterName?: string }) {
  const overpassQuery = `
    [out:json][timeout:30];
    way["highway"~"path|track"]["name"~"${query.filterName || ''}"](around:${query.radiusM},${query.lat},${query.lng});
    out body;
    >;
    out skel qt;
  `;

  const data = await queryOverpass(overpassQuery);
  const elements = data.elements || [];
  const ways = elements.filter((e: any) => e.type === 'way');
  const nodes = elements.filter((e: any) => e.type === 'node');

  const nodeMap = new Map<number, { lat: number; lon: number }>();
  for (const n of nodes) {
    nodeMap.set(n.id, { lat: n.lat, lon: n.lon });
  }

  const coords: [number, number][] = [];
  for (const way of ways) {
    console.log(`    Found: "${way.tags?.name || 'unnamed'}" (${way.nodes?.length || 0} nodes)`);
    for (const nodeId of (way.nodes || [])) {
      const node = nodeMap.get(nodeId);
      if (node) coords.push([node.lon, node.lat]);
    }
  }

  return coords;
}

async function main() {
  const trailDir = join(process.cwd(), 'public', 'trail-data');
  console.log('=== EXTRACT SUMMIT ROUTES ===\n');

  const allSummits: Array<{
    name: string;
    parentTrailId: string;
    coordinates: [number, number, number][];
    highPoint: number;
  }> = [];

  // Step 1: Extract routes by known way IDs
  for (const route of SUMMIT_ROUTES) {
    console.log(`[Way IDs] ${route.name}`);
    try {
      const coords = await fetchWayCoordinates(route.wayIds);
      console.log(`  ${coords.length} coordinate points`);

      if (coords.length > 0) {
        console.log(`  Enriching elevation...`);
        const elevations = await fetchElevations(coords);
        const fullCoords: [number, number, number][] = coords.map((c, i) => [c[0], c[1], elevations[i] || 0]);
        const highPoint = Math.max(...elevations);
        console.log(`  High point: ${highPoint}m`);

        allSummits.push({
          name: route.name,
          parentTrailId: route.parentTrailId,
          coordinates: fullCoords,
          highPoint,
        });
      }
    } catch (err) {
      console.log(`  Error: ${err}`);
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  // Step 2: Search for rate-limited summits
  for (const query of SUMMIT_QUERIES) {
    console.log(`\n[Search] ${query.name}`);
    try {
      const coords = await searchAndExtract(query);
      console.log(`  ${coords.length} coordinate points`);

      if (coords.length > 0) {
        console.log(`  Enriching elevation...`);
        const elevations = await fetchElevations(coords);
        const fullCoords: [number, number, number][] = coords.map((c, i) => [c[0], c[1], elevations[i] || 0]);
        const highPoint = Math.max(...elevations);
        console.log(`  High point: ${highPoint}m`);

        allSummits.push({
          name: query.name,
          parentTrailId: query.parentTrailId,
          coordinates: fullCoords,
          highPoint,
        });
      }
    } catch (err) {
      console.log(`  Error: ${err}`);
    }
    await new Promise(r => setTimeout(r, 3000));
  }

  // Step 3: Save summit routes as separate files
  for (const summit of allSummits) {
    const filename = summit.name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_') + '.json';
    const filepath = join(trailDir, 'summits', filename);

    // Ensure summits directory exists
    const { mkdirSync } = await import('fs');
    mkdirSync(join(trailDir, 'summits'), { recursive: true });

    writeFileSync(filepath, JSON.stringify(summit, null, 2));
    console.log(`\nSaved: summits/${filename} (${summit.coordinates.length} pts, high: ${summit.highPoint}m)`);
  }

  // Summary
  console.log('\n=== SUMMIT ROUTE SUMMARY ===');
  console.log(`${'Route'.padEnd(35)} ${'Parent'.padEnd(30)} ${'Points'.padStart(7)} ${'High'.padStart(7)}`);
  console.log('-'.repeat(82));
  for (const s of allSummits) {
    console.log(`${s.name.padEnd(35)} ${s.parentTrailId.padEnd(30)} ${String(s.coordinates.length).padStart(7)} ${(s.highPoint + 'm').padStart(7)}`);
  }
}

main().catch(console.error);
