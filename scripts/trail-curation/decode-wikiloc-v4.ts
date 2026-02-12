// Decode Wikiloc geom - analyze byte-level structure
import * as fs from 'fs';

const geom = fs.readFileSync('scripts/trail-curation/hartz-geom.txt', 'utf-8').trim();
const buf = Buffer.from(geom, 'base64');
console.log(`Buffer: ${buf.length} bytes`);

// We know bytes 0-16 contain header + first absolute point
// Let's look at bytes 17+ in detail

// First, show hex of bytes 14-40
console.log('\nBytes 14-50 (hex):');
for (let i = 14; i < Math.min(50, buf.length); i++) {
  const b = buf[i];
  const signed = b > 127 ? b - 256 : b;
  process.stdout.write(`  [${i}] 0x${b.toString(16).padStart(2,'0')} = ${b.toString().padStart(3)} (${signed >= 0 ? '+' : ''}${signed})\n`);
}

// Try interpretation: after header (17 bytes), data is SIGNED BYTES as deltas
console.log('\n=== SIGNED BYTE DELTAS (dLng, dLat, dEle per byte) ===');
{
  let lng = 146771006, lat = -43217415, ele = 8556;
  const coords: Array<[number, number, number]> = [[lng/1e6, lat/1e6, ele/10]];

  for (let i = 17; i + 2 < buf.length; i += 3) {
    const dLng = buf[i] > 127 ? buf[i] - 256 : buf[i];
    const dLat = buf[i+1] > 127 ? buf[i+1] - 256 : buf[i+1];
    const dEle = buf[i+2] > 127 ? buf[i+2] - 256 : buf[i+2];
    lng += dLng;
    lat += dLat;
    ele += dEle;
    coords.push([lng/1e6, lat/1e6, ele/10]);
  }

  console.log(`Points: ${coords.length}`);
  console.log(`First 5: ${coords.slice(0,5).map(c => `[${c[0].toFixed(6)}, ${c[1].toFixed(6)}, ${c[2].toFixed(1)}]`).join('\n  ')}`);
  console.log(`Last 3: ${coords.slice(-3).map(c => `[${c[0].toFixed(6)}, ${c[1].toFixed(6)}, ${c[2].toFixed(1)}]`).join('\n  ')}`);

  let dist = 0;
  for (let i = 1; i < coords.length; i++) {
    const dLat = (coords[i][1] - coords[i-1][1]) * Math.PI / 180;
    const dLng = (coords[i][0] - coords[i-1][0]) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(coords[i-1][1]*Math.PI/180) * Math.cos(coords[i][1]*Math.PI/180) * Math.sin(dLng/2)**2;
    dist += 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
  console.log(`Distance: ${dist.toFixed(2)} km (expected ~9.7)`);
  const eles = coords.map(c => c[2]);
  console.log(`Elevation: ${Math.min(...eles).toFixed(1)} - ${Math.max(...eles).toFixed(1)} m`);
}

// Try interpretation: signed int16 LE deltas
console.log('\n=== SIGNED INT16 LE DELTAS (dLng, dLat, dEle per int16) ===');
{
  let lng = 146771006, lat = -43217415, ele = 8556;
  const coords: Array<[number, number, number]> = [[lng/1e6, lat/1e6, ele/10]];

  for (let i = 17; i + 5 < buf.length; i += 6) {
    const dLng = buf.readInt16LE(i);
    const dLat = buf.readInt16LE(i + 2);
    const dEle = buf.readInt16LE(i + 4);
    lng += dLng;
    lat += dLat;
    ele += dEle;
    coords.push([lng/1e6, lat/1e6, ele/10]);
  }

  console.log(`Points: ${coords.length}`);
  if (coords.length > 1) {
    console.log(`First 5: ${coords.slice(0,5).map(c => `[${c[0].toFixed(6)}, ${c[1].toFixed(6)}, ${c[2].toFixed(1)}]`).join('\n  ')}`);
    let dist = 0;
    for (let i = 1; i < coords.length; i++) {
      const dLat = (coords[i][1] - coords[i-1][1]) * Math.PI / 180;
      const dLng = (coords[i][0] - coords[i-1][0]) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(coords[i-1][1]*Math.PI/180) * Math.cos(coords[i][1]*Math.PI/180) * Math.sin(dLng/2)**2;
      dist += 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }
    console.log(`Distance: ${dist.toFixed(2)} km`);
  }
}

// Try: maybe the data after first point uses a DIFFERENT varint format
// Google polyline uses 5-bit chunks with offset 63
// What if Wikiloc uses 6-bit chunks from binary?
console.log('\n=== 6-BIT CHUNK VARINTS ===');
{
  function read6bit(buf: Buffer, startByte: number): { values: number[], bytesUsed: number } {
    const values: number[] = [];
    let bitPos = startByte * 8;
    const maxBit = buf.length * 8;

    while (bitPos < maxBit && values.length < 2000) {
      let result = 0;
      let shift = 0;
      let chunk: number;
      do {
        const byteIdx = Math.floor(bitPos / 8);
        const bitOff = bitPos % 8;
        if (byteIdx >= buf.length) break;
        // Read 6 bits
        let raw = (buf[byteIdx] >> bitOff);
        if (bitOff > 2 && byteIdx + 1 < buf.length) {
          raw |= (buf[byteIdx + 1] << (8 - bitOff));
        }
        chunk = raw & 0x3f; // 6 bits
        const cont = (chunk & 0x20) !== 0; // bit 5 is continuation
        result |= (chunk & 0x1f) << shift; // 5 data bits
        shift += 5;
        bitPos += 6;
        if (!cont) break;
      } while (true);

      // Zigzag decode
      const decoded = (result & 1) ? -(result >> 1) - 1 : result >> 1;
      values.push(decoded);
    }

    return { values, bytesUsed: Math.ceil(bitPos / 8) - startByte };
  }

  const { values: v6 } = read6bit(buf, 17);
  console.log(`Got ${v6.length} values`);
  console.log(`First 15: ${v6.slice(0, 15).join(', ')}`);
}

// Try: varints but reading the BASE64 STRING directly (Google polyline style)
// Each character: charCode - 63, 5-bit chunks with bit 5 as continuation
console.log('\n=== GOOGLE POLYLINE ON BASE64 STRING ===');
{
  function decodeGooglePoly(s: string, precision: number = 1e5): Array<[number, number]> {
    const coords: [number, number][] = [];
    let idx = 0, lat = 0, lng = 0;

    while (idx < s.length) {
      // Decode lat
      let shift = 0, result = 0, byte: number;
      do {
        byte = s.charCodeAt(idx++) - 63;
        if (byte < 0) return coords; // invalid char
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20 && idx < s.length);
      lat += result & 1 ? ~(result >> 1) : result >> 1;

      // Decode lng
      shift = 0; result = 0;
      do {
        byte = s.charCodeAt(idx++) - 63;
        if (byte < 0) return coords;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20 && idx < s.length);
      lng += result & 1 ? ~(result >> 1) : result >> 1;

      coords.push([lat / precision, lng / precision]);
    }
    return coords;
  }

  for (const prec of [1e5, 1e6, 1e7]) {
    const pts = decodeGooglePoly(geom, prec);
    if (pts.length > 0) {
      const first = pts[0];
      if (Math.abs(first[0]) < 90 && Math.abs(first[1]) < 180) {
        console.log(`  Precision ${prec}: ${pts.length} points`);
        console.log(`    First: lat=${first[0].toFixed(6)}, lng=${first[1].toFixed(6)}`);
        if (pts.length > 1) {
          const last = pts[pts.length - 1];
          console.log(`    Last: lat=${last[0].toFixed(6)}, lng=${last[1].toFixed(6)}`);
          // Check if near Hartz Peak
          if (Math.abs(first[0] + 43.217) < 1 || Math.abs(first[1] - 146.77) < 1) {
            console.log('    *** NEAR HARTZ PEAK! ***');
            let dist = 0;
            for (let i = 1; i < pts.length; i++) {
              const dLat = (pts[i][0] - pts[i-1][0]) * Math.PI / 180;
              const dLng = (pts[i][1] - pts[i-1][1]) * Math.PI / 180;
              const a = Math.sin(dLat/2)**2 + Math.cos(pts[i-1][0]*Math.PI/180) * Math.cos(pts[i][0]*Math.PI/180) * Math.sin(dLng/2)**2;
              dist += 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            }
            console.log(`    Distance: ${dist.toFixed(2)} km`);
          }
        }
      }
    }
  }
}

// Try: Google polyline on base64 with DIFFERENT offset
console.log('\n=== POLYLINE WITH DIFFERENT OFFSETS ===');
for (const offset of [0, 32, 48, 63, 64, 65]) {
  let idx = 0, lat = 0, lng = 0;
  const pts: [number, number][] = [];
  let valid = true;

  while (idx < geom.length && pts.length < 3) {
    let shift = 0, result = 0, byte: number;
    do {
      byte = geom.charCodeAt(idx++) - offset;
      if (byte < 0 || byte > 63) { valid = false; break; }
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && idx < geom.length);
    if (!valid) break;
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0; result = 0;
    do {
      byte = geom.charCodeAt(idx++) - offset;
      if (byte < 0 || byte > 63) { valid = false; break; }
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && idx < geom.length);
    if (!valid) break;
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    pts.push([lat/1e6, lng/1e6]);
  }

  if (pts.length > 0 && valid) {
    const f = pts[0];
    console.log(`  offset=${offset}: first=(${f[0].toFixed(6)}, ${f[1].toFixed(6)})`);
  }
}
