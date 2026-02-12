// Decode Wikiloc geom field - flat zigzag varint with delta encoding
// Usage: npx tsx scripts/trail-curation/decode-wikiloc-v3.ts [geom-file-or-string]
import * as fs from 'fs';

function readAllVarints(buf: Buffer): number[] {
  const values: number[] = [];
  let pos = 0;
  while (pos < buf.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      if (pos >= buf.length) break;
      byte = buf[pos++];
      result += (byte & 0x7f) * Math.pow(2, shift);
      shift += 7;
      if (shift > 49) break;
    } while (byte & 0x80);
    values.push(result);
  }
  return values;
}

function zigzagDecode(v: number): number {
  if (v >= 0 && v <= 0xFFFFFFFF) {
    return (v >>> 1) ^ -(v & 1);
  }
  const half = Math.floor(v / 2);
  return (v % 2 === 0) ? half : -(half + 1);
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Load geom from file or argument
let geom: string;
const arg = process.argv[2] || 'scripts/trail-curation/hartz-geom.txt';
if (fs.existsSync(arg)) {
  geom = fs.readFileSync(arg, 'utf-8').trim();
} else {
  geom = arg;
}

const buf = Buffer.from(geom, 'base64');
console.log(`Decoded ${buf.length} bytes from ${geom.length} base64 chars`);

const rawVarints = readAllVarints(buf);
const zigzag = rawVarints.map(zigzagDecode);
console.log(`Total varints: ${rawVarints.length}`);

// Header analysis
console.log(`\nHeader: [${zigzag.slice(0, 3).join(', ')}]`);
console.log(`  [0]=${zigzag[0]} (possible point count)`);
console.log(`  [1]=${zigzag[1]}`);
console.log(`  [2]=${zigzag[2]}`);

// First absolute coordinate
const startLng = zigzag[3] / 1e6;
const startLat = zigzag[4] / 1e6;
const startEle = zigzag[5];
console.log(`\nFirst point: lng=${startLng.toFixed(6)}, lat=${startLat.toFixed(6)}, ele=${startEle}`);

// Delta decode triplets: (dLng, dLat, dEle) starting from index 6
let lng = zigzag[3], lat = zigzag[4], ele = zigzag[5];
const coords: Array<[number, number, number]> = [[lng / 1e6, lat / 1e6, ele]];

let validPoints = 1;
let badPoints = 0;

for (let i = 6; i + 2 < zigzag.length; i += 3) {
  const dLng = zigzag[i];
  const dLat = zigzag[i + 1];
  const dEle = zigzag[i + 2];

  lng += dLng;
  lat += dLat;
  ele += dEle;

  const pLng = lng / 1e6;
  const pLat = lat / 1e6;

  // Sanity check: coordinates should be reasonable
  if (Math.abs(pLng) > 180 || Math.abs(pLat) > 90) {
    badPoints++;
    if (badPoints <= 3) {
      console.log(`  BAD point at i=${i}: lng=${pLng.toFixed(2)}, lat=${pLat.toFixed(2)} (deltas: ${dLng}, ${dLat}, ${dEle})`);
    }
  } else {
    coords.push([pLng, pLat, ele]);
    validPoints++;
  }
}

console.log(`\nValid points: ${validPoints}, Bad points: ${badPoints}`);

if (coords.length > 1) {
  console.log(`\nFirst 5 points:`);
  for (const [pLng, pLat, pEle] of coords.slice(0, 5)) {
    console.log(`  [${pLng.toFixed(6)}, ${pLat.toFixed(6)}, ${pEle}]`);
  }

  console.log(`\nLast 5 points:`);
  for (const [pLng, pLat, pEle] of coords.slice(-5)) {
    console.log(`  [${pLng.toFixed(6)}, ${pLat.toFixed(6)}, ${pEle}]`);
  }

  // Calculate distance
  let totalDist = 0;
  for (let i = 1; i < coords.length; i++) {
    totalDist += haversineKm(coords[i-1][1], coords[i-1][0], coords[i][1], coords[i][0]);
  }
  console.log(`\nTotal distance: ${totalDist.toFixed(2)} km`);

  // Elevation range
  let minEle = Infinity, maxEle = -Infinity;
  for (const c of coords) {
    if (c[2] < minEle) minEle = c[2];
    if (c[2] > maxEle) maxEle = c[2];
  }
  console.log(`Elevation range: ${minEle} - ${maxEle} (raw)`);
  console.log(`  If ÷10: ${(minEle/10).toFixed(1)} - ${(maxEle/10).toFixed(1)} m`);
  console.log(`  If raw m: ${minEle} - ${maxEle} m`);
}

// Also try: maybe it's NOT triplets but pairs (lng, lat) with no elevation
console.log(`\n\n=== TRYING PAIRS (no elevation) ===`);
lng = zigzag[3]; lat = zigzag[4];
const coords2: Array<[number, number]> = [[lng / 1e6, lat / 1e6]];
let valid2 = 1, bad2 = 0;

// Start from index 5 (skip header of 3, absolute pair at 3-4)
for (let i = 5; i + 1 < zigzag.length; i += 2) {
  lng += zigzag[i];
  lat += zigzag[i + 1];
  const pLng = lng / 1e6;
  const pLat = lat / 1e6;
  if (Math.abs(pLng) > 180 || Math.abs(pLat) > 90) {
    bad2++;
    if (bad2 <= 3) {
      console.log(`  BAD at i=${i}: ${pLng.toFixed(2)}, ${pLat.toFixed(2)}`);
    }
  } else {
    coords2.push([pLng, pLat]);
    valid2++;
  }
}

console.log(`Valid points: ${valid2}, Bad: ${bad2}`);
if (coords2.length > 1 && bad2 === 0) {
  let dist2 = 0;
  for (let i = 1; i < coords2.length; i++) {
    dist2 += haversineKm(coords2[i-1][1], coords2[i-1][0], coords2[i][1], coords2[i][0]);
  }
  console.log(`Total distance: ${dist2.toFixed(2)} km`);
  console.log(`First 3: ${coords2.slice(0, 3).map(c => `[${c[0].toFixed(6)}, ${c[1].toFixed(6)}]`).join(', ')}`);
  console.log(`Last 3: ${coords2.slice(-3).map(c => `[${c[0].toFixed(6)}, ${c[1].toFixed(6)}]`).join(', ')}`);
}

// Try: header=2, then absolute triplet at 2-4, deltas from 5
console.log(`\n\n=== TRYING HEADER=2 ===`);
{
  let lng = zigzag[2], lat = zigzag[3], ele = zigzag[4];
  console.log(`First point: lng=${(lng/1e6).toFixed(6)}, lat=${(lat/1e6).toFixed(6)}, ele=${ele}`);
  // Only proceed if first point makes sense
  if (Math.abs(lng/1e6) < 180 && Math.abs(lat/1e6) < 90) {
    const c: Array<[number, number, number]> = [[lng/1e6, lat/1e6, ele]];
    let bad = 0;
    for (let i = 5; i + 2 < zigzag.length; i += 3) {
      lng += zigzag[i]; lat += zigzag[i+1]; ele += zigzag[i+2];
      if (Math.abs(lng/1e6) > 180 || Math.abs(lat/1e6) > 90) { bad++; continue; }
      c.push([lng/1e6, lat/1e6, ele]);
    }
    console.log(`Points: ${c.length}, Bad: ${bad}`);
    if (c.length > 1 && bad < 5) {
      let d = 0;
      for (let i = 1; i < c.length; i++) d += haversineKm(c[i-1][1], c[i-1][0], c[i][1], c[i][0]);
      console.log(`Distance: ${d.toFixed(2)} km`);
    }
  }
}

// Try: (lat, lng, ele) instead of (lng, lat, ele) for first absolute point
console.log(`\n\n=== TRYING (lat, lng, ele) order ===`);
{
  // [3] = 146771006 as lat → 146.77 is not valid lat (>90)
  // So (lat, lng, ele) order means lat=[4]=-43.217, lng=[3]=146.771
  // But the deltas would also be (dLat, dLng, dEle)
  let lat2 = zigzag[4], lng2 = zigzag[3], ele2 = zigzag[5];
  const c: Array<[number, number, number]> = [[lng2/1e6, lat2/1e6, ele2]];
  let bad = 0;
  for (let i = 6; i + 2 < zigzag.length; i += 3) {
    // Swap: delta order is (dLat, dLng, dEle) but we're reading (d1, d2, d3)
    // If raw order at [i] is (dLat, dLng, dEle):
    lat2 += zigzag[i];
    lng2 += zigzag[i+1];
    ele2 += zigzag[i+2];
    if (Math.abs(lng2/1e6) > 180 || Math.abs(lat2/1e6) > 90) { bad++; continue; }
    c.push([lng2/1e6, lat2/1e6, ele2]);
  }
  console.log(`Points: ${c.length}, Bad: ${bad}`);
  if (c.length > 1 && bad < 5) {
    let d = 0;
    for (let i = 1; i < c.length; i++) d += haversineKm(c[i-1][1], c[i-1][0], c[i][1], c[i][0]);
    console.log(`Distance: ${d.toFixed(2)} km`);
    console.log(`First 3: ${c.slice(0, 3).map(p => `[${p[0].toFixed(6)}, ${p[1].toFixed(6)}, ${p[2]}]`).join(', ')}`);
    console.log(`Last 3: ${c.slice(-3).map(p => `[${p[0].toFixed(6)}, ${p[1].toFixed(6)}, ${p[2]}]`).join(', ')}`);
  }
}
