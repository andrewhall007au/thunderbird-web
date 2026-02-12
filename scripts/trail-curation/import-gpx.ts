// Import GPX files and replace trail data

import fs from 'fs';
import path from 'path';

interface Coord {
  lat: number;
  lng: number;
  ele: number;
}

function parseGPX(gpxContent: string): Coord[] {
  const coords: Coord[] = [];

  // Extract all trackpoints and route points
  const trkptRegex = /<(?:trkpt|rtept)\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>([\s\S]*?)<\/(?:trkpt|rtept)>/g;
  let match;
  while ((match = trkptRegex.exec(gpxContent)) !== null) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    const eleMatch = match[3].match(/<ele>([^<]+)<\/ele>/);
    const ele = eleMatch ? parseFloat(eleMatch[1]) : 0;
    if (!isNaN(lat) && !isNaN(lng)) {
      coords.push({ lat, lng, ele: Math.round(ele) });
    }
  }

  // Also try wpt (waypoints) if no trackpoints found
  if (coords.length === 0) {
    const wptRegex = /<wpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>([\s\S]*?)<\/wpt>/g;
    while ((match = wptRegex.exec(gpxContent)) !== null) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      const eleMatch = match[3].match(/<ele>([^<]+)<\/ele>/);
      const ele = eleMatch ? parseFloat(eleMatch[1]) : 0;
      if (!isNaN(lat) && !isNaN(lng)) {
        coords.push({ lat, lng, ele: Math.round(ele) });
      }
    }
  }

  return coords;
}

function calcDistance(coords: Coord[]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const dlat = (coords[i].lat - coords[i - 1].lat) * 111;
    const dlng = (coords[i].lng - coords[i - 1].lng) * 111 * Math.cos(coords[i - 1].lat * Math.PI / 180);
    total += Math.sqrt(dlat * dlat + dlng * dlng);
  }
  return total;
}

function countGaps(coords: Coord[], threshold = 1): number {
  let count = 0;
  for (let i = 1; i < coords.length; i++) {
    const dlat = (coords[i].lat - coords[i - 1].lat) * 111;
    const dlng = (coords[i].lng - coords[i - 1].lng) * 111 * Math.cos(coords[i - 1].lat * Math.PI / 180);
    if (Math.sqrt(dlat * dlat + dlng * dlng) > threshold) count++;
  }
  return count;
}

const gpxFiles: { gpx: string; trailId: string; name: string; region: string; distance_km: number; typical_days: string }[] = [
  {
    gpx: '/Users/andrewhall/Downloads/Freycinet-Peninsula-Circuit.gpx',
    trailId: 'freycinet_peninsula_circuit',
    name: 'Freycinet Peninsula Circuit',
    region: 'Tasmania',
    distance_km: 27,
    typical_days: '2-3'
  },
  {
    gpx: '/Users/andrewhall/Downloads/Frenchmans-Cap.gpx',
    trailId: 'frenchmans_cap',
    name: 'Frenchmans Cap',
    region: 'Franklin-Gordon Wild Rivers NP, TAS',
    distance_km: 46,
    typical_days: '3-5'
  },
  {
    gpx: '/Users/andrewhall/Downloads/Walls of Jerusalem Circuit.gpx',
    trailId: 'walls_of_jerusalem',
    name: 'Walls of Jerusalem',
    region: 'Tasmania',
    distance_km: 23,
    typical_days: '3'
  },
  {
    gpx: '/Users/andrewhall/Downloads/Kgari Great Walk.gpx',
    trailId: 'fraser_island_great_walk',
    name: 'Fraser Island Great Walk',
    region: 'Fraser Island, QLD',
    distance_km: 90,
    typical_days: '6-8'
  },
];

for (const { gpx, trailId, name, region, distance_km, typical_days } of gpxFiles) {
  console.log(`\n=== ${name} ===`);

  if (!fs.existsSync(gpx)) {
    console.log('  GPX file not found:', gpx);
    continue;
  }

  const gpxContent = fs.readFileSync(gpx, 'utf-8');
  const coords = parseGPX(gpxContent);
  console.log('  Parsed:', coords.length, 'points');

  if (coords.length === 0) {
    console.log('  NO POINTS FOUND');
    continue;
  }

  const dist = calcDistance(coords);
  const gaps = countGaps(coords);
  const elevs = coords.map(c => c.ele);
  console.log('  Distance:', dist.toFixed(2), 'km');
  console.log('  Gaps >1km:', gaps);
  console.log('  Elev range:', Math.min(...elevs), '-', Math.max(...elevs));
  console.log('  First:', coords[0]);
  console.log('  Last:', coords[coords.length - 1]);

  // Convert to [lng, lat, ele] format
  const trailCoords = coords.map(c => [c.lng, c.lat, c.ele]);

  // Read existing file to preserve any extra fields
  const outPath = `public/trail-data/${trailId}.json`;
  let existing: any = {};
  if (fs.existsSync(outPath)) {
    existing = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
    console.log('  Replacing existing:', existing.coordinates?.length, 'pts');
  }

  const trailData = {
    id: trailId,
    name: name,
    region: region,
    country: 'AU',
    distance_km: distance_km,
    typical_days: typical_days,
    coordinates: trailCoords,
    dataSource: 'gpx'
  };

  fs.writeFileSync(outPath, JSON.stringify(trailData));
  console.log('  SAVED', outPath, 'with', trailCoords.length, 'points');
}
