const fs = require('fs');

// Read GPX file
const gpxContent = fs.readFileSync('app/data/gpx/us/at_centerline_full.gpx', 'utf8');

// Parse track points using regex (simple parser)
const trkptRegex = /<trkpt lat="([^"]+)" lon="([^"]+)">\s*<ele>([^<]+)<\/ele>/g;
const points = [];
let match;

while ((match = trkptRegex.exec(gpxContent)) !== null) {
  points.push({
    lat: parseFloat(match[1]),
    lon: parseFloat(match[2]),
    ele: parseFloat(match[3])
  });
}

console.log('=== APPALACHIAN TRAIL GPX ANALYSIS ===\n');
console.log('Total points: ' + points.length.toLocaleString());

// Calculate total distance (rough)
let totalDist = 0;
for (let i = 1; i < points.length; i++) {
  const dLat = (points[i].lat - points[i-1].lat) * 111.32; // km per degree
  const dLon = (points[i].lon - points[i-1].lon) * Math.cos(points[i].lat * Math.PI / 180) * 111.32;
  totalDist += Math.sqrt(dLat * dLat + dLon * dLon);
}
console.log('Approximate distance: ' + (totalDist * 0.621371).toFixed(0) + ' miles');

// Elevation stats (avoid spread on large arrays)
let minEle = Infinity, maxEle = -Infinity;
for (const p of points) {
  if (p.ele < minEle) minEle = p.ele;
  if (p.ele > maxEle) maxEle = p.ele;
}
console.log('\nElevation range: ' + minEle.toFixed(0) + 'm - ' + maxEle.toFixed(0) + 'm');
console.log('Elevation range: ' + (minEle * 3.28084).toFixed(0) + 'ft - ' + (maxEle * 3.28084).toFixed(0) + 'ft');

// Start and end points
console.log('\nStart (Springer Mountain, GA):');
console.log('  Lat: ' + points[0].lat + ', Lon: ' + points[0].lon + ', Ele: ' + points[0].ele + 'm');
console.log('\nEnd (Mount Katahdin, ME):');
console.log('  Lat: ' + points[points.length-1].lat + ', Lon: ' + points[points.length-1].lon + ', Ele: ' + points[points.length-1].ele + 'm');

// Sample points every ~100 miles for preview
const sampleInterval = Math.floor(points.length / 22); // ~22 sections of ~100mi
console.log('\n=== SAMPLE POINTS (every ~100 miles) ===\n');
console.log('Format: [longitude, latitude, elevation_meters]');
const samples = [];
for (let i = 0; i < points.length; i += sampleInterval) {
  const p = points[i];
  samples.push([parseFloat(p.lon.toFixed(6)), parseFloat(p.lat.toFixed(6)), parseFloat(p.ele.toFixed(1))]);
}
// Add final point
const lastP = points[points.length-1];
samples.push([parseFloat(lastP.lon.toFixed(6)), parseFloat(lastP.lat.toFixed(6)), parseFloat(lastP.ele.toFixed(1))]);

console.log(JSON.stringify(samples, null, 2));

// Output for popularTrails.ts format
console.log('\n=== READY FOR popularTrails.ts ===\n');
const output = {
  id: 'appalachian-trail',
  name: 'Appalachian Trail',
  region: 'Georgia to Maine',
  country: 'US',
  distance_km: Math.round(totalDist),
  typical_days: '5-7 months (thru-hike) or sections',
  coordinates: samples
};
console.log(JSON.stringify(output, null, 2));
