// Decode Wikiloc geom field from base64 to coordinates
// Usage: npx tsx scripts/trail-curation/decode-wikiloc.ts

// Known: start lat=-41.641174, lng=145.942755, end lat=-41.649395, lng=145.96181
// Known: 2479 points, elevation range 879m-1565m (2883ft-5134ft)

const geomB64 = process.argv[2] || '';

function analyze(geom: string) {
  const buf = Buffer.from(geom, 'base64');
  console.log(`Decoded: ${buf.length} bytes`);

  // Show first 100 bytes as hex
  console.log(`First 100 bytes hex: ${buf.subarray(0, 100).toString('hex')}`);

  // Check if it could be protobuf by looking for field tags
  // Protobuf field tag format: (field_number << 3) | wire_type
  // Common wire types: 0=varint, 1=64bit, 2=length-delimited, 5=32bit
  console.log(`\nFirst 20 bytes individually:`);
  for (let i = 0; i < Math.min(20, buf.length); i++) {
    const b = buf[i];
    console.log(`  [${i}] ${b} (0x${b.toString(16)}) wire_type=${b & 7} field=${b >> 3}`);
  }

  // Try to decode as protobuf varint sequence
  console.log(`\nTrying protobuf varint decode (first 20 values):`);
  let pos = 0;
  const varints: number[] = [];
  while (pos < buf.length && varints.length < 40) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = buf[pos++];
      result |= (byte & 0x7f) << shift;
      shift += 7;
    } while (byte & 0x80 && pos < buf.length);
    varints.push(result);
  }
  console.log('Raw varints:', varints.slice(0, 20));

  // Try zigzag decode (signed varints)
  const zigzag = varints.map(v => (v >>> 1) ^ -(v & 1));
  console.log('Zigzag decoded:', zigzag.slice(0, 20));

  // Check if zigzag values could be coordinates when divided by scale
  for (const scale of [1e5, 1e6, 1e7]) {
    const scaled = zigzag.slice(0, 6).map(v => v / scale);
    console.log(`  ÷${scale}: ${scaled.map(v => v.toFixed(6)).join(', ')}`);
  }

  // Try cumulative sum of zigzag values (delta encoding)
  console.log('\nTrying delta-encoded coordinates:');
  let lat = 0, lng = 0, ele = 0;

  // Skip first value if it's a header/count
  for (const startIdx of [0, 1, 2]) {
    lat = 0; lng = 0; ele = 0;
    console.log(`\n  Starting from index ${startIdx}:`);
    for (let i = startIdx; i < Math.min(startIdx + 12, zigzag.length); i += 3) {
      lat += zigzag[i];
      lng += zigzag[i + 1];
      ele += zigzag[i + 2];
      for (const scale of [1e5, 1e6, 1e7]) {
        const sLat = lat / scale;
        const sLng = lng / scale;
        if (Math.abs(sLat) > 10 && Math.abs(sLat) < 80 && Math.abs(sLng) > 50 && Math.abs(sLng) < 180) {
          console.log(`    ÷${scale}: lat=${sLat.toFixed(6)}, lng=${sLng.toFixed(6)}, ele=${ele} (raw: ${zigzag[i]}, ${zigzag[i+1]}, ${zigzag[i+2]})`);
        }
      }
    }
  }

  // Also try pairs (no elevation)
  console.log('\nTrying delta-encoded pairs (no elevation):');
  for (const startIdx of [0, 1]) {
    lat = 0; lng = 0;
    console.log(`\n  Starting from index ${startIdx}:`);
    for (let i = startIdx; i < Math.min(startIdx + 12, zigzag.length); i += 2) {
      lat += zigzag[i];
      lng += zigzag[i + 1];
      for (const scale of [1e5, 1e6, 1e7]) {
        const sLat = lat / scale;
        const sLng = lng / scale;
        if (Math.abs(sLat) > 10 && Math.abs(sLat) < 80 && Math.abs(sLng) > 50 && Math.abs(sLng) < 180) {
          console.log(`    ÷${scale}: lat=${sLat.toFixed(6)}, lng=${sLng.toFixed(6)} (raw: ${zigzag[i]}, ${zigzag[i+1]})`);
        }
      }
    }
  }

  // Expected: first point near lat=-41.641174, lng=145.942755
  // So lat*1e5 = -4164117, lng*1e5 = 14594275
  // Or lat*1e6 = -41641174, lng*1e6 = 145942755
  console.log('\nExpected first point: lat=-41.641174, lng=145.942755');
  console.log(`Expected lat*1e5 = ${Math.round(-41.641174 * 1e5)}, lng*1e5 = ${Math.round(145.942755 * 1e5)}`);
  console.log(`Expected lat*1e6 = ${Math.round(-41.641174 * 1e6)}, lng*1e6 = ${Math.round(145.942755 * 1e6)}`);

  // Check: does total varint count ÷ 2 or ÷ 3 = ~2479 points?
  // Count all varints in the buffer
  pos = 0;
  let totalVarints = 0;
  while (pos < buf.length) {
    let byte: number;
    do {
      byte = buf[pos++];
    } while (byte & 0x80 && pos < buf.length);
    totalVarints++;
  }
  console.log(`\nTotal varints in buffer: ${totalVarints}`);
  console.log(`÷2 = ${totalVarints / 2}, ÷3 = ${(totalVarints / 3).toFixed(1)}, ÷4 = ${totalVarints / 4}`);
}

// Read from stdin if no argument
if (geomB64) {
  analyze(geomB64);
} else {
  // Hardcoded short test from Hartz Peak page
  console.log('Usage: npx tsx decode-wikiloc.ts <base64-geom-string>');
  console.log('Or pipe: echo "..." | npx tsx decode-wikiloc.ts');
}
