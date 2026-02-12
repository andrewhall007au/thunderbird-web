import fs from 'fs';
import path from 'path';

const dir = 'public/trail-data';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'manifest.json');

// Check what fields exist across all trail files
const sources: Record<string, number> = {};
const extraFields = new Set<string>();
const sampleCoordPrecision: Record<string, number[]> = {};

for (const f of files) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
    const src = d.dataSource || 'none';
    if (!sources[src]) sources[src] = 0;
    sources[src]++;

    // Check for non-standard fields
    for (const key of Object.keys(d)) {
      if (!['id', 'name', 'region', 'country', 'distance_km', 'typical_days', 'coordinates', 'dataSource', 'calculatedKm'].includes(key)) {
        extraFields.add(`${key} (in ${f})`);
      }
    }

    // Check coordinate precision (decimal places = fingerprint risk)
    if (d.coordinates?.length > 0) {
      const sample = d.coordinates[0];
      const lngStr = String(sample[0]);
      const latStr = String(sample[1]);
      const lngDecimals = lngStr.includes('.') ? lngStr.split('.')[1].length : 0;
      const latDecimals = latStr.includes('.') ? latStr.split('.')[1].length : 0;
      if (!sampleCoordPrecision[src]) sampleCoordPrecision[src] = [];
      sampleCoordPrecision[src].push(Math.max(lngDecimals, latDecimals));
    }
  } catch (e) {}
}

console.log('=== dataSource field values ===');
for (const [src, count] of Object.entries(sources).sort((a, b) => (b as number) - (a as number))) {
  const precisions = sampleCoordPrecision[src] || [];
  const avgPrec = precisions.length > 0 ? (precisions.reduce((a, b) => a + b, 0) / precisions.length).toFixed(1) : '?';
  console.log(`  ${src}: ${count} trails (avg ${avgPrec} decimal places)`);
}

console.log('\n=== Extra fields (beyond standard schema) ===');
for (const f of extraFields) console.log(`  ${f}`);

// Check if any GPX files in downloads still have metadata
console.log('\n=== GPX metadata in recent imports ===');
const gpxDir = '/Users/andrewhall/Downloads';
const gpxFiles = ['Freycinet-Peninsula-Circuit.gpx', 'Frenchmans-Cap.gpx', 'Walls of Jerusalem Circuit.gpx', 'Kgari Great Walk.gpx', 'Heysen_Trail_20250514 (1).gpx'];

for (const gf of gpxFiles) {
  const fp = path.join(gpxDir, gf);
  if (!fs.existsSync(fp)) continue;
  const content = fs.readFileSync(fp, 'utf-8');

  console.log(`\n  ${gf}:`);

  // Check creator attribute
  const creatorMatch = content.match(/creator="([^"]+)"/);
  if (creatorMatch) console.log(`    creator: ${creatorMatch[1]}`);

  // Check metadata
  const metaMatch = content.match(/<metadata>([\s\S]*?)<\/metadata>/);
  if (metaMatch) {
    const meta = metaMatch[1];
    const nameMatch = meta.match(/<name>([^<]+)<\/name>/);
    const authorMatch = meta.match(/<author>([\s\S]*?)<\/author>/);
    const linkMatch = meta.match(/<link[^>]*href="([^"]+)"/);
    const timeMatch = meta.match(/<time>([^<]+)<\/time>/);
    if (nameMatch) console.log(`    name: ${nameMatch[1]}`);
    if (authorMatch) console.log(`    author: ${authorMatch[1].replace(/\s+/g, ' ').trim()}`);
    if (linkMatch) console.log(`    link: ${linkMatch[1]}`);
    if (timeMatch) console.log(`    time: ${timeMatch[1]}`);
  }

  // Check track names
  const trkNameMatch = content.match(/<trk>\s*<name>([^<]+)<\/name>/);
  if (trkNameMatch) console.log(`    track name: ${trkNameMatch[1]}`);

  // Check for copyright
  const copyrightMatch = content.match(/<copyright[^>]*>([\s\S]*?)<\/copyright>/);
  if (copyrightMatch) console.log(`    COPYRIGHT: ${copyrightMatch[1].replace(/\s+/g, ' ').trim()}`);
}

console.log('\n=== RISK ASSESSMENT ===');
console.log('1. dataSource field: reveals origin type (gpx, fkt_gpx, osm_overpass, etc.)');
console.log('2. Coordinate precision: high decimal places (10+) are fingerprints from specific GPS devices/apps');
console.log('3. Coordinate sequences: exact point-by-point matching could identify source GPX');
console.log('4. No GPX metadata retained: we strip all metadata during JSON conversion');
console.log('5. JSON files are publicly served at /trail-data/{id}.json');
