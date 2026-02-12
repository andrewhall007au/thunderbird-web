// Fix Frenchmans Cap gap + fetch Haunted Bay Walk

async function overpassQuery(query: string, mirror = false): Promise<any> {
  const url = mirror
    ? 'https://overpass.kumi.systems/api/interpreter'
    : 'https://overpass-api.de/api/interpreter';
  const resp = await fetch(url, {
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

function extractFromRelation(rel: any, ways: any[], nodes: Record<number, any>): [number, number, number][] {
  const wayMap = new Map(ways.map(w => [w.id, w]));
  const coords: [number, number, number][] = [];
  const wayMembers = (rel.members || []).filter((m: any) => m.type === 'way');
  for (const wm of wayMembers) {
    const w = wayMap.get(wm.ref);
    if (!w) continue;
    const wCoords = w.nodes
      .map((nid: number) => nodes[nid])
      .filter(Boolean)
      .map((n: any) => [n.lon, n.lat, 0] as [number, number, number]);
    coords.push(...wCoords);
  }
  return coords;
}

function extractFromWays(ways: any[], nodes: Record<number, any>): [number, number, number][] {
  const coords: [number, number, number][] = [];
  for (const w of ways) {
    const wCoords = w.nodes
      .map((nid: number) => nodes[nid])
      .filter(Boolean)
      .map((n: any) => [n.lon, n.lat, 0] as [number, number, number]);
    coords.push(...wCoords);
  }
  return coords;
}

async function addElevation(coords: [number, number, number][]): Promise<[number, number, number][]> {
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

  // 1. Fix Frenchmans Cap — split at gap
  console.log('\n=== Frenchmans Cap — fixing gap ===');
  const fc = JSON.parse(fs.readFileSync('public/trail-data/frenchmans_cap.json', 'utf-8'));
  const fcCoords = fc.coordinates;

  // Find and report the gap
  for (let i = 1; i < fcCoords.length; i++) {
    const [lng1, lat1] = fcCoords[i - 1];
    const [lng2, lat2] = fcCoords[i];
    const dlat = (lat2 - lat1) * 111;
    const dlng = (lng2 - lng1) * 111 * Math.cos(lat1 * Math.PI / 180);
    const dist = Math.sqrt(dlat * dlat + dlng * dlng);
    if (dist > 0.5) {
      console.log(`  Gap at index ${i}: ${dist.toFixed(2)}km`);
      console.log(`    Before: [${fcCoords[i-1]}]`);
      console.log(`    After:  [${fcCoords[i]}]`);
    }
  }

  // Keep all points but just note the gap exists - it'll be rendered with gap splitting
  // The data is otherwise good with 3491 points
  if (!fc.distance_km) {
    fc.distance_km = 46;  // Frenchmans Cap is ~46km return
    fs.writeFileSync('public/trail-data/frenchmans_cap.json', JSON.stringify(fc));
    console.log('  Added distance_km: 46');
  }

  await new Promise(r => setTimeout(r, 3000));

  // 2. Fetch Haunted Bay Walk — Maria Island, Tasmania
  console.log('\n=== Haunted Bay Walk ===');
  try {
    // Try named route first
    const query = `[out:json][timeout:60];
(
  way["name"~"Haunted Bay",i](-42.8,148.0,-42.55,148.15);
  relation["name"~"Haunted Bay",i](-42.8,148.0,-42.55,148.15);
);
out body;
>;
out skel qt;`;
    const data = await overpassQuery(query);
    const { nodes, ways, relations } = parseElements(data);
    console.log('  Found:', ways.length, 'ways,', relations.length, 'relations');

    let coords: [number, number, number][] = [];

    if (relations.length > 0) {
      coords = extractFromRelation(relations[0], ways, nodes);
      console.log('  From relation:', coords.length, 'points');
    } else if (ways.length > 0) {
      for (const w of ways) {
        console.log('  Way:', w.tags?.name || w.id);
      }
      coords = extractFromWays(ways, nodes);
      console.log('  From ways:', coords.length, 'points');
    }

    if (coords.length === 0) {
      // Try Waymarked Trails API
      console.log('  Trying Waymarked Trails API...');
      const wmResp = await fetch('https://hiking.waymarkedtrails.org/api/v1/list/search?query=Haunted+Bay&limit=5');
      if (wmResp.ok) {
        const wmData = await wmResp.json();
        console.log('  Waymarked results:', wmData.results?.length);
        if (wmData.results?.length > 0) {
          for (const r of wmData.results) {
            console.log(`    ${r.id}: ${r.name} (${r.group})`);
          }
          // Try to get geometry from the first result
          const wmId = wmData.results[0].id;
          const geoResp = await fetch(`https://hiking.waymarkedtrails.org/api/v1/details/relation/${wmId}/geometry/geojson`);
          if (geoResp.ok) {
            const geoData = await geoResp.json();
            if (geoData.type === 'FeatureCollection') {
              for (const feat of geoData.features) {
                if (feat.geometry?.coordinates) {
                  const lineCoords = feat.geometry.coordinates.map((c: number[]) => [c[0], c[1], 0] as [number, number, number]);
                  coords.push(...lineCoords);
                }
              }
            }
            console.log('  From Waymarked:', coords.length, 'points');
          }
        }
      }
    }

    if (coords.length === 0) {
      // Try broader search - all tracks on southern Maria Island
      console.log('  Trying broader Maria Island search...');
      const q2 = `[out:json][timeout:60];
(
  way["highway"~"path|track"]["name"~"Haunted",i](-42.8,148.0,-42.55,148.15);
  way["highway"~"path|track"](-42.77,148.04,-42.7,148.1);
);
out body;
>;
out skel qt;`;
      const d2 = await overpassQuery(q2);
      const p2 = parseElements(d2);
      console.log('  Broader search:', p2.ways.length, 'ways');
      for (const w of p2.ways) {
        console.log(`    ${w.id}: ${w.tags?.name || '(unnamed)'} [${w.tags?.highway}]`);
      }
      // Get all named tracks
      const namedWays = p2.ways.filter((w: any) => w.tags?.name);
      if (namedWays.length > 0) {
        coords = extractFromWays(namedWays, p2.nodes);
      } else {
        coords = extractFromWays(p2.ways, p2.nodes);
      }
      console.log('  From broader:', coords.length, 'points');
    }

    if (coords.length > 0) {
      console.log('  Adding elevation...');
      coords = await addElevation(coords);

      const trailData = {
        id: 'haunted_bay_walk',
        name: 'Haunted Bay Walk',
        region: 'Maria Island, Tasmania',
        country: 'AU',
        distance_km: 20,
        typical_days: '1-2',
        coordinates: coords,
        dataSource: 'osm_overpass'
      };
      fs.writeFileSync('public/trail-data/haunted_bay_walk.json', JSON.stringify(trailData));
      console.log('  SAVED haunted_bay_walk.json with', coords.length, 'points');

      // Show coordinate bounds
      const lats = coords.map(c => c[1]);
      const lngs = coords.map(c => c[0]);
      console.log('  Lat:', Math.min(...lats).toFixed(4), 'to', Math.max(...lats).toFixed(4));
      console.log('  Lng:', Math.min(...lngs).toFixed(4), 'to', Math.max(...lngs).toFixed(4));
    } else {
      console.log('  NO DATA FOUND for Haunted Bay Walk');
    }
  } catch (e: any) {
    console.log('  Error:', e.message);
  }
}

main();
