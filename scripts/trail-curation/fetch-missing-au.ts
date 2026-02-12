// Fetch Sunshine Coast Hinterland Great Walk + Kangaroo Island Wilderness Trail

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

function orderWaysFromRelation(rel: any, ways: any[], nodes: Record<number, any>): [number, number, number][] {
  const wayMap = new Map(ways.map(w => [w.id, w]));
  const coords: [number, number, number][] = [];
  const wayMembers = (rel.members || []).filter((m: any) => m.type === 'way');

  let prevEnd: number | null = null;
  for (const wm of wayMembers) {
    const w = wayMap.get(wm.ref);
    if (!w || !w.nodes || w.nodes.length === 0) continue;

    const wNodes = w.nodes.map((nid: number) => nodes[nid]).filter(Boolean);
    if (wNodes.length === 0) continue;

    // Check if we need to reverse this way to connect properly
    let wCoords = wNodes.map((n: any) => [n.lon, n.lat, 0] as [number, number, number]);
    if (prevEnd !== null) {
      const firstNode = w.nodes[0];
      const lastNode = w.nodes[w.nodes.length - 1];
      if (lastNode === prevEnd) {
        wCoords.reverse();
        prevEnd = firstNode;
      } else {
        prevEnd = lastNode;
      }
    } else {
      prevEnd = w.nodes[w.nodes.length - 1];
    }

    // Skip duplicate start point if connecting
    if (coords.length > 0 && wCoords.length > 0) {
      const last = coords[coords.length - 1];
      const first = wCoords[0];
      if (Math.abs(last[0] - first[0]) < 0.0001 && Math.abs(last[1] - first[1]) < 0.0001) {
        wCoords = wCoords.slice(1);
      }
    }
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
      } else {
        console.log(`  Elevation API ${resp.status} at batch ${i}`);
      }
    } catch (e) {
      console.log('  Elevation batch failed at', i);
    }
    if (i + BATCH < coords.length) await new Promise(r => setTimeout(r, 1500));
  }
  return result;
}

function calcDist(coords: [number, number, number][]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1];
    const [lng2, lat2] = coords[i];
    const dlat = (lat2 - lat1) * 111;
    const dlng = (lng2 - lng1) * 111 * Math.cos(lat1 * Math.PI / 180);
    total += Math.sqrt(dlat * dlat + dlng * dlng);
  }
  return total;
}

async function main() {
  const fs = await import('fs');

  // 1. Sunshine Coast Hinterland Great Walk
  console.log('\n=== Sunshine Coast Hinterland Great Walk ===');
  try {
    // Try Waymarked Trails first
    console.log('  Trying Waymarked Trails...');
    const wmResp = await fetch('https://hiking.waymarkedtrails.org/api/v1/list/search?query=Sunshine+Coast+Hinterland+Great+Walk&limit=5');
    let coords: [number, number, number][] = [];

    if (wmResp.ok) {
      const wmData = await wmResp.json();
      console.log('  Waymarked results:', wmData.results?.length);
      if (wmData.results?.length > 0) {
        for (const r of wmData.results) {
          console.log(`    ${r.id}: ${r.name} (${r.group})`);
        }
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

    if (coords.length === 0) {
      // Try OSM Overpass - relation search
      console.log('  Trying Overpass...');
      const query = `[out:json][timeout:90];
(
  relation["name"~"Sunshine Coast Hinterland",i](-27.0,152.5,-26.5,153.2);
  relation["name"~"Great Walk",i](-27.0,152.5,-26.5,153.2);
  way["name"~"Sunshine Coast Hinterland",i](-27.0,152.5,-26.5,153.2);
);
out body;
>;
out skel qt;`;
      const data = await overpassQuery(query);
      const { nodes, ways, relations } = parseElements(data);
      console.log('  Found:', ways.length, 'ways,', relations.length, 'relations');

      if (relations.length > 0) {
        // Find the most relevant relation
        for (const r of relations) {
          console.log(`  Relation: ${r.tags?.name} (${r.members?.length} members)`);
        }
        const best = relations.find((r: any) => r.tags?.name?.includes('Hinterland')) || relations[0];
        coords = orderWaysFromRelation(best, ways, nodes);
        console.log('  From relation:', coords.length, 'points');
      } else if (ways.length > 0) {
        coords = extractFromWays(ways, nodes);
        console.log('  From ways:', coords.length, 'points');
      }
    }

    if (coords.length > 0) {
      const dist = calcDist(coords);
      console.log('  Raw distance:', dist.toFixed(2), 'km');
      console.log('  Adding elevation...');
      coords = await addElevation(coords);

      const elevs = coords.map(c => c[2]);
      console.log('  Elev range:', Math.min(...elevs), '-', Math.max(...elevs));

      const trailData = {
        id: 'sunshine_coast_hinterland_great_walk',
        name: 'Sunshine Coast Hinterland Great Walk',
        region: 'Queensland',
        country: 'AU',
        distance_km: 59,
        typical_days: '4-5',
        coordinates: coords,
        dataSource: 'osm_overpass'
      };
      fs.writeFileSync('public/trail-data/sunshine_coast_hinterland_great_walk.json', JSON.stringify(trailData));
      console.log('  SAVED with', coords.length, 'points');
    } else {
      console.log('  NO DATA FOUND');
    }
  } catch (e: any) {
    console.log('  Error:', e.message);
  }

  await new Promise(r => setTimeout(r, 5000));

  // 2. Kangaroo Island Wilderness Trail
  console.log('\n=== Kangaroo Island Wilderness Trail ===');
  try {
    console.log('  Trying Waymarked Trails...');
    const wmResp = await fetch('https://hiking.waymarkedtrails.org/api/v1/list/search?query=Kangaroo+Island+Wilderness+Trail&limit=5');
    let coords: [number, number, number][] = [];

    if (wmResp.ok) {
      const wmData = await wmResp.json();
      console.log('  Waymarked results:', wmData.results?.length);
      if (wmData.results?.length > 0) {
        for (const r of wmData.results) {
          console.log(`    ${r.id}: ${r.name} (${r.group})`);
        }
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

    if (coords.length === 0) {
      console.log('  Trying Overpass...');
      const query = `[out:json][timeout:90];
(
  relation["name"~"Kangaroo Island Wilderness",i](-36.2,136.5,-35.5,137.5);
  relation["name"~"Wilderness Trail",i](-36.2,136.5,-35.5,137.5);
  way["name"~"Kangaroo Island Wilderness",i](-36.2,136.5,-35.5,137.5);
);
out body;
>;
out skel qt;`;
      const data = await overpassQuery(query);
      const { nodes, ways, relations } = parseElements(data);
      console.log('  Found:', ways.length, 'ways,', relations.length, 'relations');

      if (relations.length > 0) {
        for (const r of relations) {
          console.log(`  Relation: ${r.tags?.name} (${r.members?.length} members)`);
        }
        const best = relations.find((r: any) => r.tags?.name?.includes('Wilderness')) || relations[0];
        coords = orderWaysFromRelation(best, ways, nodes);
        console.log('  From relation:', coords.length, 'points');
      } else if (ways.length > 0) {
        for (const w of ways) console.log('  Way:', w.tags?.name);
        coords = extractFromWays(ways, nodes);
        console.log('  From ways:', coords.length, 'points');
      }
    }

    if (coords.length === 0) {
      // Try broader search
      console.log('  Trying broader Flinders Chase NP search...');
      const q2 = `[out:json][timeout:90];
(
  way["highway"~"path|track"]["name"~"Wilderness",i](-36.1,136.5,-35.7,137.0);
);
out body;
>;
out skel qt;`;
      const d2 = await overpassQuery(q2, true);
      const p2 = parseElements(d2);
      console.log('  Broader:', p2.ways.length, 'ways');
      for (const w of p2.ways) console.log(`    ${w.tags?.name}`);
      if (p2.ways.length > 0) {
        coords = extractFromWays(p2.ways, p2.nodes);
      }
    }

    if (coords.length > 0) {
      const dist = calcDist(coords);
      console.log('  Raw distance:', dist.toFixed(2), 'km');
      console.log('  Adding elevation...');
      coords = await addElevation(coords);

      const elevs = coords.map(c => c[2]);
      console.log('  Elev range:', Math.min(...elevs), '-', Math.max(...elevs));

      const trailData = {
        id: 'kangaroo_island_wilderness_trail',
        name: 'Kangaroo Island Wilderness Trail',
        region: 'South Australia',
        country: 'AU',
        distance_km: 46,
        typical_days: '4',
        coordinates: coords,
        dataSource: 'osm_overpass'
      };
      fs.writeFileSync('public/trail-data/kangaroo_island_wilderness_trail.json', JSON.stringify(trailData));
      console.log('  SAVED with', coords.length, 'points');
    } else {
      console.log('  NO DATA FOUND');
    }
  } catch (e: any) {
    console.log('  Error:', e.message);
  }
}

main();
