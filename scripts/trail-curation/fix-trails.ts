// Fix Point Lesueur (wrong coordinates - France instead of Tasmania)
// Fetch Mt Trio (new trail)
// Check Freycinet Peninsula Circuit

async function overpassQuery(query: string): Promise<any> {
  const resp = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: 'data=' + encodeURIComponent(query)
  });
  if (!resp.ok) throw new Error(`Overpass HTTP ${resp.status}`);
  return resp.json();
}

function parseElements(data: any) {
  const nodes: Record<number, { lat: number; lon: number }> = {};
  const ways: any[] = [];
  const relations: any[] = [];
  for (const el of data.elements) {
    if (el.type === 'node') nodes[el.id] = el;
    else if (el.type === 'way') ways.push(el);
    else if (el.type === 'relation') relations.push(el);
  }
  return { nodes, ways, relations };
}

function extractCoords(ways: any[], nodes: Record<number, any>, relations: any[]): [number, number, number][] {
  // If there's a relation, use its ordered way members
  if (relations.length > 0) {
    const rel = relations[0];
    console.log('  Using relation:', rel.tags?.name);
    const wayMap = new Map(ways.map(w => [w.id, w]));
    const coords: [number, number, number][] = [];
    const wayMembers = (rel.members || []).filter((m: any) => m.type === 'way');
    for (const wm of wayMembers) {
      const w = wayMap.get(wm.ref);
      if (!w) continue;
      const wCoords: [number, number, number][] = w.nodes
        .map((nid: number) => nodes[nid])
        .filter(Boolean)
        .map((n: any) => [n.lon, n.lat, 0] as [number, number, number]);
      coords.push(...wCoords);
    }
    return coords;
  }

  // Otherwise concatenate all ways
  const coords: [number, number, number][] = [];
  for (const w of ways) {
    console.log('  Way:', w.tags?.name || w.id);
    const wCoords: [number, number, number][] = w.nodes
      .map((nid: number) => nodes[nid])
      .filter(Boolean)
      .map((n: any) => [n.lon, n.lat, 0] as [number, number, number]);
    coords.push(...wCoords);
  }
  return coords;
}

async function addElevation(coords: [number, number, number][]): Promise<[number, number, number][]> {
  // Batch elevation requests (100 at a time)
  const BATCH = 100;
  const result = [...coords];
  for (let i = 0; i < coords.length; i += BATCH) {
    const batch = coords.slice(i, i + BATCH);
    const locs = batch.map(([lng, lat]) => `${lat},${lng}`).join('|');
    try {
      const resp = await fetch(`https://api.opentopodata.org/v1/srtm30m?locations=${locs}`);
      if (resp.ok) {
        const data = await resp.json();
        for (let j = 0; j < data.results.length; j++) {
          const elev = data.results[j].elevation;
          if (elev !== null) result[i + j][2] = Math.round(elev);
        }
      }
    } catch (e) {
      console.log('  Elevation batch failed at', i);
    }
    if (i + BATCH < coords.length) await new Promise(r => setTimeout(r, 1500));
  }
  return result;
}

async function main() {
  const fs = await import('fs');

  // 1. Point Lesueur Walk - Maria Island, Tasmania
  console.log('\n=== Point Lesueur Walk ===');
  try {
    const query = `[out:json][timeout:60];
(
  way["name"~"Point Lesueur",i](-42.75,148.0,-42.55,148.15);
  relation["name"~"Point Lesueur",i](-42.75,148.0,-42.55,148.15);
);
out body;
>;
out skel qt;`;
    const data = await overpassQuery(query);
    const { nodes, ways, relations } = parseElements(data);
    console.log('  Found:', ways.length, 'ways,', relations.length, 'relations');

    let coords = extractCoords(ways, nodes, relations);
    if (coords.length === 0) {
      // Try broader search - Maria Island walking tracks
      console.log('  No direct match, trying broader search on Maria Island...');
      const q2 = `[out:json][timeout:60];
way["highway"="path"]["name"~"Lesueur",i](-42.65,148.05,-42.6,148.1);
out body;
>;
out skel qt;`;
      const d2 = await overpassQuery(q2);
      const p2 = parseElements(d2);
      console.log('  Broader:', p2.ways.length, 'ways');
      coords = extractCoords(p2.ways, p2.nodes, p2.relations);
    }

    if (coords.length > 0) {
      console.log('  Points:', coords.length);
      console.log('  Adding elevation...');
      coords = await addElevation(coords);
      const trailData = {
        id: 'point_lesueur_walk',
        name: 'Point Lesueur Walk',
        region: 'Maria Island, Tasmania',
        country: 'AU',
        distance_km: 28,
        typical_days: '2',
        coordinates: coords,
        dataSource: 'osm_overpass'
      };
      fs.writeFileSync('public/trail-data/point_lesueur_walk.json', JSON.stringify(trailData));
      console.log('  SAVED point_lesueur_walk.json with', coords.length, 'points');
    } else {
      console.log('  NO DATA FOUND');
    }
  } catch (e: any) {
    console.log('  Error:', e.message);
  }

  await new Promise(r => setTimeout(r, 3000));

  // 2. Mt Trio - Stirling Range, WA
  console.log('\n=== Mt Trio ===');
  try {
    const query = `[out:json][timeout:60];
(
  way["name"~"Trio",i](-34.45,118.0,-34.30,118.2);
  relation["name"~"Trio",i](-34.45,118.0,-34.30,118.2);
);
out body;
>;
out skel qt;`;
    const data = await overpassQuery(query);
    const { nodes, ways, relations } = parseElements(data);
    console.log('  Found:', ways.length, 'ways,', relations.length, 'relations');

    let coords = extractCoords(ways, nodes, relations);
    if (coords.length > 0) {
      console.log('  Points:', coords.length);
      console.log('  Adding elevation...');
      coords = await addElevation(coords);
      const trailData = {
        id: 'mt_trio',
        name: 'Mt Trio',
        region: 'Stirling Range, WA',
        country: 'AU',
        distance_km: 3.5,
        typical_days: '1',
        coordinates: coords,
        dataSource: 'osm_overpass'
      };
      fs.writeFileSync('public/trail-data/mt_trio.json', JSON.stringify(trailData));
      console.log('  SAVED mt_trio.json with', coords.length, 'points');
    } else {
      console.log('  NO DATA FOUND');
    }
  } catch (e: any) {
    console.log('  Error:', e.message);
  }

  await new Promise(r => setTimeout(r, 3000));

  // 3. Check Freycinet Peninsula Circuit
  console.log('\n=== Freycinet Peninsula Circuit ===');
  try {
    const existing = JSON.parse(fs.readFileSync('public/trail-data/freycinet_peninsula_circuit.json', 'utf-8'));
    console.log('  Points:', existing.coordinates?.length);
    console.log('  Distance:', existing.distance_km, 'km');
    console.log('  Calculated:', existing.calculatedKm?.toFixed(2), 'km');
    if (existing.coordinates?.length > 0) {
      const c = existing.coordinates;
      console.log('  First:', c[0]);
      console.log('  Last:', c[c.length-1]);
      // Check lat/lng range
      const lats = c.map((p: number[]) => p[1]);
      const lngs = c.map((p: number[]) => p[0]);
      console.log('  Lat range:', Math.min(...lats).toFixed(3), 'to', Math.max(...lats).toFixed(3));
      console.log('  Lng range:', Math.min(...lngs).toFixed(3), 'to', Math.max(...lngs).toFixed(3));

      // Check for gaps
      let gaps = [];
      for (let i = 1; i < c.length; i++) {
        const [lng1, lat1] = c[i-1];
        const [lng2, lat2] = c[i];
        const dlat = (lat2 - lat1) * 111;
        const dlng = (lng2 - lng1) * 111 * Math.cos(lat1 * Math.PI / 180);
        const dist = Math.sqrt(dlat * dlat + dlng * dlng);
        if (dist > 0.5) gaps.push({ i, dist: dist.toFixed(2) + 'km' });
      }
      console.log('  Gaps >500m:', gaps.length, gaps.slice(0, 5));
    }
  } catch (e: any) {
    console.log('  Error reading:', e.message);
  }
}

main();
