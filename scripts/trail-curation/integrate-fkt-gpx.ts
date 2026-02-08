// Integrate FKT GPX data into trail-data, replacing LIST+DEM data where FKT is better
// Usage: npx tsx scripts/trail-curation/integrate-fkt-gpx.ts

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const TRAIL_DATA_DIR = join(process.cwd(), 'public', 'trail-data');
const GPX_PARSED_DIR = join(process.cwd(), 'scripts', 'trail-curation', 'gpx-downloads', 'parsed');

// Map FKT GPX files → trail IDs in our manifest
const FKT_TO_TRAIL: Record<string, {
  trailId: string;
  notes: string;
}> = {
  'overland-track-all-side-trips.json': {
    trailId: 'overland_track',
    notes: 'Includes all classic side trips (Cradle Mountain, Barn Bluff, Mt Oakleigh, Mt Ossa, Pelion East). GPS elevation to 1,604m.',
  },
  'south-coast-track.json': {
    trailId: 'south_coast_track',
    notes: 'GPS-recorded track with real elevation data.',
  },
  'western-arthurs-traverse.json': {
    trailId: 'western_arthur_range_traverse',
    notes: 'High-density GPS recording (50k+ points). Replaces sparse LIST data.',
  },
  'frenchmans-cap.json': {
    trailId: 'frenchmans_cap',
    notes: 'Route with GPS elevation to 1,420m summit.',
  },
  'mount-anne.json': {
    trailId: 'mount_anne_circuit',
    notes: 'GPS elevation to 1,378m summit.',
  },
  'federation-peak.json': {
    trailId: 'federation_peak',
    notes: 'Full route from Huon campground including summit (1,030m GPS). Replaces Huon Track approach-only data.',
  },
};

// Port Davey: The southwest-track.gpx contains BOTH Port Davey Track + South Coast Track (~165km combined).
// We need to extract Port Davey portion. The Port Davey Track runs from Scotts Peak Dam to Melaleuca.
// Scotts Peak Dam is roughly at lat -43.04, Melaleuca at -43.42.
// The Southwest Track starts at Scotts Peak and goes south to Cockle Creek via Melaleuca.
// Port Davey Track is the first ~70km section (Scotts Peak → Melaleuca).

interface ParsedTrail {
  name: string;
  source: string;
  license: string;
  coordinates: [number, number, number][];
  stats: {
    points: number;
    distanceKm: number;
    elevationLow: number;
    elevationHigh: number;
    elevationGain: number;
  };
}

interface ManifestEntry {
  id: string;
  name: string;
  region: string;
  country: string;
  distance_km: number;
  typical_days: string;
  pointCount: number;
  dataSource: string;
  calculatedKm: number;
  elevationLow: number;
  elevationHigh: number;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function totalDistance(coords: [number, number, number][]): number {
  let d = 0;
  for (let i = 1; i < coords.length; i++) {
    d += haversine(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
  }
  return d;
}

function main() {
  console.log('=== INTEGRATE FKT GPX DATA ===\n');

  // Load existing manifest
  const manifest: ManifestEntry[] = JSON.parse(readFileSync(join(TRAIL_DATA_DIR, 'manifest.json'), 'utf-8'));
  console.log(`Existing manifest: ${manifest.length} trails\n`);

  // Process each FKT mapping
  for (const [gpxFile, mapping] of Object.entries(FKT_TO_TRAIL)) {
    const gpxPath = join(GPX_PARSED_DIR, gpxFile);
    let fktData: ParsedTrail;
    try {
      fktData = JSON.parse(readFileSync(gpxPath, 'utf-8'));
    } catch {
      console.log(`  SKIP ${gpxFile}: parsed file not found`);
      continue;
    }

    const entry = manifest.find(m => m.id === mapping.trailId);
    if (!entry) {
      console.log(`  SKIP ${mapping.trailId}: not in manifest`);
      continue;
    }

    // Load existing trail data
    const trailPath = join(TRAIL_DATA_DIR, `${mapping.trailId}.json`);
    let existingTrail: any;
    try {
      existingTrail = JSON.parse(readFileSync(trailPath, 'utf-8'));
    } catch {
      console.log(`  SKIP ${mapping.trailId}: trail JSON not found`);
      continue;
    }

    // Compare
    console.log(`--- ${entry.name} (${mapping.trailId}) ---`);
    console.log(`  EXISTING: ${entry.pointCount} pts, ${entry.calculatedKm.toFixed(1)} km, ${entry.elevationLow}m—${entry.elevationHigh}m [${entry.dataSource}]`);
    console.log(`  FKT GPX:  ${fktData.stats.points} pts, ${fktData.stats.distanceKm} km, ${fktData.stats.elevationLow}m—${fktData.stats.elevationHigh}m [GPS]`);
    console.log(`  Notes: ${mapping.notes}`);

    // Build new trail data
    const newTrailData = {
      ...existingTrail,
      coordinates: fktData.coordinates,
      dataSource: 'fkt_gpx',
      fktSource: fktData.source,
      fktLicense: fktData.license,
    };

    // Write updated trail file
    writeFileSync(trailPath, JSON.stringify(newTrailData, null, 2));

    // Update manifest entry
    const calcKm = totalDistance(fktData.coordinates);
    entry.pointCount = fktData.stats.points;
    entry.dataSource = 'fkt_gpx';
    entry.calculatedKm = calcKm;
    entry.elevationLow = fktData.stats.elevationLow;
    entry.elevationHigh = fktData.stats.elevationHigh;

    console.log(`  UPGRADED → ${fktData.stats.points} pts, ${calcKm.toFixed(1)} km, ${fktData.stats.elevationLow}m—${fktData.stats.elevationHigh}m\n`);
  }

  // Handle Port Davey Track from Southwest Track GPX
  console.log('--- Port Davey Track (from Southwest Track GPX) ---');
  try {
    const swData: ParsedTrail = JSON.parse(readFileSync(join(GPX_PARSED_DIR, 'southwest-track.json'), 'utf-8'));
    const entry = manifest.find(m => m.id === 'port_davey_track');

    if (entry) {
      // The Southwest Track goes from Scotts Peak Dam (~-43.04 lat) south to Melaleuca (~-43.42)
      // then east to Cockle Creek (~-43.53). Port Davey is just the Scotts Peak → Melaleuca section.
      // We find the southernmost point near Melaleuca (around lon 146.15) as the split point.
      // Actually, let's look for the turnaround — Port Davey track goes south, then the
      // South Coast Track continues east. We split where the track reaches Melaleuca area.

      // Melaleuca is approximately at -43.41, 146.15
      // Find the coordinate closest to Melaleuca
      let melaleucaIdx = 0;
      let minDist = Infinity;
      for (let i = 0; i < swData.coordinates.length; i++) {
        const d = haversine(-43.41, 146.15, swData.coordinates[i][1], swData.coordinates[i][0]);
        if (d < minDist) {
          minDist = d;
          melaleucaIdx = i;
        }
      }

      console.log(`  Southwest Track: ${swData.coordinates.length} pts total`);
      console.log(`  Melaleuca split point: index ${melaleucaIdx} (${minDist.toFixed(2)} km from Melaleuca)`);

      // Port Davey = start to Melaleuca
      const portDaveyCoords = swData.coordinates.slice(0, melaleucaIdx + 1);
      const pdKm = totalDistance(portDaveyCoords);
      const pdElevations = portDaveyCoords.map(c => c[2]);
      const pdLow = Math.round(Math.min(...pdElevations));
      const pdHigh = Math.round(Math.max(...pdElevations));

      console.log(`  EXISTING: ${entry.pointCount} pts, ${entry.calculatedKm.toFixed(1)} km, ${entry.elevationLow}m—${entry.elevationHigh}m [${entry.dataSource}]`);
      console.log(`  FKT GPX (Port Davey section): ${portDaveyCoords.length} pts, ${pdKm.toFixed(1)} km, ${pdLow}m—${pdHigh}m [GPS]`);

      // Load existing trail and update
      const trailPath = join(TRAIL_DATA_DIR, 'port_davey_track.json');
      const existingTrail = JSON.parse(readFileSync(trailPath, 'utf-8'));
      const newTrailData = {
        ...existingTrail,
        coordinates: portDaveyCoords,
        dataSource: 'fkt_gpx',
        fktSource: swData.source,
        fktLicense: swData.license,
      };
      writeFileSync(trailPath, JSON.stringify(newTrailData, null, 2));

      entry.pointCount = portDaveyCoords.length;
      entry.dataSource = 'fkt_gpx';
      entry.calculatedKm = pdKm;
      entry.elevationLow = pdLow;
      entry.elevationHigh = pdHigh;

      console.log(`  UPGRADED → ${portDaveyCoords.length} pts, ${pdKm.toFixed(1)} km, ${pdLow}m—${pdHigh}m\n`);
    }
  } catch (err) {
    console.log(`  Error: ${err}`);
  }

  // Write updated manifest
  writeFileSync(join(TRAIL_DATA_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // Summary
  console.log('\n=== FINAL MANIFEST ===');
  console.log(`${'Trail'.padEnd(35)} ${'Source'.padEnd(15)} ${'Points'.padStart(8)} ${'Km'.padStart(8)} ${'Elev Range'.padStart(15)}`);
  console.log('-'.repeat(85));
  for (const t of manifest) {
    console.log(`${t.name.padEnd(35)} ${t.dataSource.padEnd(15)} ${String(t.pointCount).padStart(8)} ${t.calculatedKm.toFixed(1).padStart(8)} ${(t.elevationLow + 'm—' + t.elevationHigh + 'm').padStart(15)}`);
  }

  const fktCount = manifest.filter(m => m.dataSource === 'fkt_gpx').length;
  const listCount = manifest.filter(m => m.dataSource === 'list_tasmania').length;
  const wmCount = manifest.filter(m => m.dataSource === 'waymarked_trails').length;
  console.log(`\nSources: ${fktCount} FKT GPX, ${listCount} LIST Tasmania, ${wmCount} Waymarked Trails`);
}

main();
