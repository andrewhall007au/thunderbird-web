// Search OSM for summit side track routes off the Overland Track and other trails
// Uses Overpass API to find hiking paths near known summit coordinates
// Usage: npx tsx scripts/trail-curation/find-summit-routes.ts

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

interface Summit {
  name: string;
  parentTrail: string;
  lat: number;
  lng: number;
  knownElevation: number;
  searchRadiusM: number;
}

const SUMMITS: Summit[] = [
  // Overland Track side trips
  { name: 'Cradle Mountain', parentTrail: 'Overland Track', lat: -41.6540, lng: 145.9422, knownElevation: 1545, searchRadiusM: 2000 },
  { name: 'Barn Bluff', parentTrail: 'Overland Track', lat: -41.6825, lng: 145.9650, knownElevation: 1559, searchRadiusM: 2000 },
  { name: 'Mount Ossa', parentTrail: 'Overland Track', lat: -41.8750, lng: 146.0333, knownElevation: 1617, searchRadiusM: 3000 },
  { name: 'Pelion East', parentTrail: 'Overland Track', lat: -41.8389, lng: 146.0417, knownElevation: 1433, searchRadiusM: 2000 },
  { name: 'Pelion West', parentTrail: 'Overland Track', lat: -41.8361, lng: 146.0111, knownElevation: 1560, searchRadiusM: 2000 },
  { name: 'The Acropolis', parentTrail: 'Overland Track', lat: -41.9167, lng: 146.0167, knownElevation: 1481, searchRadiusM: 2000 },
  { name: 'Mount Oakleigh', parentTrail: 'Overland Track', lat: -41.9000, lng: 146.0000, knownElevation: 1286, searchRadiusM: 2000 },
  // Federation Peak
  { name: 'Federation Peak Summit', parentTrail: 'Federation Peak', lat: -43.2667, lng: 146.5167, knownElevation: 1224, searchRadiusM: 3000 },
  // Western Arthurs
  { name: 'Mount Hesperus', parentTrail: 'Western Arthur Range', lat: -43.1833, lng: 146.3500, knownElevation: 1180, searchRadiusM: 2000 },
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

async function findSummitRoutes(summit: Summit) {
  console.log(`\n--- ${summit.name} (${summit.knownElevation}m) ---`);
  console.log(`  Parent: ${summit.parentTrail}`);
  console.log(`  Search: ${summit.searchRadiusM}m radius around [${summit.lat}, ${summit.lng}]`);

  // Search for hiking paths/tracks near the summit
  const query = `
    [out:json][timeout:30];
    (
      way["highway"~"path|track|footway"](around:${summit.searchRadiusM},${summit.lat},${summit.lng});
    );
    out body;
    >;
    out skel qt;
  `;

  try {
    const data = await queryOverpass(query);
    const elements = data.elements || [];
    const ways = elements.filter((e: any) => e.type === 'way');
    const nodes = elements.filter((e: any) => e.type === 'node');

    // Build node lookup
    const nodeMap = new Map<number, { lat: number; lon: number }>();
    for (const n of nodes) {
      nodeMap.set(n.id, { lat: n.lat, lon: n.lon });
    }

    console.log(`  Found ${ways.length} ways, ${nodes.length} nodes`);

    // Show details of each way
    for (const way of ways) {
      const name = way.tags?.name || '(unnamed)';
      const highway = way.tags?.highway || '?';
      const sac = way.tags?.sac_scale || '';
      const surface = way.tags?.surface || '';
      const trail_visibility = way.tags?.trail_visibility || '';
      const nodeCount = way.nodes?.length || 0;

      // Get coordinates for this way
      const coords: [number, number][] = [];
      for (const nodeId of (way.nodes || [])) {
        const node = nodeMap.get(nodeId);
        if (node) coords.push([node.lon, node.lat]);
      }

      // Calculate approximate length
      let lengthM = 0;
      for (let i = 1; i < coords.length; i++) {
        const dlat = (coords[i][1] - coords[i - 1][1]) * 111320;
        const dlng = (coords[i][0] - coords[i - 1][0]) * 111320 * Math.cos(coords[i][1] * Math.PI / 180);
        lengthM += Math.sqrt(dlat * dlat + dlng * dlng);
      }

      // Find highest point (by latitude proximity to summit — rough heuristic)
      let closestToSummit = Infinity;
      for (const c of coords) {
        const dist = Math.sqrt((c[1] - summit.lat) ** 2 + (c[0] - summit.lng) ** 2);
        if (dist < closestToSummit) closestToSummit = dist;
      }
      const closestKm = (closestToSummit * 111).toFixed(2);

      console.log(`  Way ${way.id}: "${name}" [${highway}] ${sac ? 'sac:' + sac : ''} ${nodeCount} nodes, ~${(lengthM / 1000).toFixed(1)}km, closest: ${closestKm}km to summit`);
    }
  } catch (err) {
    console.log(`  Error: ${err}`);
  }
}

async function main() {
  console.log('=== OSM SUMMIT ROUTE SEARCH ===\n');

  for (const summit of SUMMITS) {
    await findSummitRoutes(summit);
    // Rate limit
    await new Promise(r => setTimeout(r, 2000));
  }
}

main().catch(console.error);
