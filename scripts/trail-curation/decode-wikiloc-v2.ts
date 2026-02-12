// Decode Wikiloc geom field - analyze protobuf structure properly
// Usage: npx tsx scripts/trail-curation/decode-wikiloc-v2.ts

// Hartz Peak: start lat=-43.217, lng=146.77, ele ~880m
// Expected: 2479 points (Cradle Mountain) or similar

function decodeVarint(buf: Buffer, offset: number): { value: number; bytesRead: number } {
  let result = 0;
  let shift = 0;
  let pos = offset;
  let byte: number;
  do {
    byte = buf[pos++];
    result |= (byte & 0x7f) << shift;
    shift += 7;
    if (shift > 35) break; // prevent infinite loop
  } while (byte & 0x80);
  return { value: result, bytesRead: pos - offset };
}

function zigzag(v: number): number {
  return (v >>> 1) ^ -(v & 1);
}

// Try to parse as a protobuf message with tagged fields
function parseProtobuf(buf: Buffer, depth = 0): any[] {
  const fields: any[] = [];
  let pos = 0;
  const indent = '  '.repeat(depth);

  while (pos < buf.length) {
    const { value: tag, bytesRead: tagBytes } = decodeVarint(buf, pos);
    pos += tagBytes;

    const fieldNum = tag >> 3;
    const wireType = tag & 7;

    if (wireType === 0) { // Varint
      const { value, bytesRead } = decodeVarint(buf, pos);
      pos += bytesRead;
      fields.push({ field: fieldNum, type: 'varint', value, zigzag: zigzag(value) });
    } else if (wireType === 1) { // 64-bit
      if (pos + 8 > buf.length) break;
      const val = buf.readDoubleLE(pos);
      pos += 8;
      fields.push({ field: fieldNum, type: 'fixed64', value: val });
    } else if (wireType === 2) { // Length-delimited
      const { value: len, bytesRead } = decodeVarint(buf, pos);
      pos += bytesRead;
      if (len > 0 && len <= buf.length - pos) {
        const data = buf.subarray(pos, pos + len);
        fields.push({ field: fieldNum, type: 'bytes', length: len, data });
        pos += len;
      } else {
        break; // invalid
      }
    } else if (wireType === 5) { // 32-bit
      if (pos + 4 > buf.length) break;
      const val = buf.readFloatLE(pos);
      const intVal = buf.readInt32LE(pos);
      pos += 4;
      fields.push({ field: fieldNum, type: 'fixed32', float: val, int: intVal });
    } else {
      break; // unknown wire type, stop
    }

    if (fields.length > 100) break;
  }

  return fields;
}

// Read the full geom from the Cradle Mountain page (passed as arg or use test data)
const testGeom = "wggHpQ38sPyLAY3ImynYhQHgvP3hrV9IrwEAoB9YSQCwbXBQAOBdmgEDANCMAZgBdQDAPnoxAKAfjgEtAPAuhgE/APAuNlUA4NoBmAEXANCMAZQBAQCwbYYBCgDAPpABLgCQTpIBCACwbXYhAMA+CFkA0IwBcmEFsOcCOF0FoJMEEmEA0IkCXl8C0PQIakcAoJwBeiEIgH2IAQwGwD6SAQgJwD6SARoNkE5+AwnAPmYuC8A+eA4FkE6KASQFkE54HkvAPowBFQXAPnoYAZBOegEH4F12FAXAPnokA8A+ehYHwD6KAQ4AkE5cOQGQTyzhA6lA";

const geom = process.argv[2] || testGeom;
const buf = Buffer.from(geom, 'base64');
console.log(`Decoded: ${buf.length} bytes from ${geom.length} base64 chars`);

// Parse as protobuf
console.log('\n=== PROTOBUF STRUCTURE ===');
const fields = parseProtobuf(buf);

for (const f of fields.slice(0, 30)) {
  if (f.type === 'varint') {
    const scaled = f.zigzag / 1e6;
    const note = (Math.abs(scaled) > 10 && Math.abs(scaled) < 180) ? ` → ${scaled.toFixed(6)}` : '';
    console.log(`  field ${f.field} (varint): ${f.value} / zigzag=${f.zigzag}${note}`);
  } else if (f.type === 'bytes') {
    // Try to recursively parse sub-message
    console.log(`  field ${f.field} (bytes): ${f.length} bytes`);
    const subFields = parseProtobuf(f.data, 1);
    for (const sf of subFields.slice(0, 15)) {
      if (sf.type === 'varint') {
        const scaled = sf.zigzag / 1e6;
        const note = (Math.abs(scaled) > 10 && Math.abs(scaled) < 180) ? ` → ${scaled.toFixed(6)}` : '';
        console.log(`    field ${sf.field} (varint): ${sf.value} / zigzag=${sf.zigzag}${note}`);
      } else if (sf.type === 'bytes') {
        console.log(`    field ${sf.field} (bytes): ${sf.length} bytes`);
        // Go one more level deep
        const subSub = parseProtobuf(sf.data, 2);
        for (const ssf of subSub.slice(0, 10)) {
          if (ssf.type === 'varint') {
            const scaled = ssf.zigzag / 1e6;
            const note = (Math.abs(scaled) > 10 && Math.abs(scaled) < 180) ? ` → ${scaled.toFixed(6)}` : '';
            console.log(`      field ${ssf.field} (varint): ${ssf.value} / zigzag=${ssf.zigzag}${note}`);
          } else if (ssf.type === 'bytes') {
            console.log(`      field ${ssf.field} (bytes): ${ssf.length} bytes`);
          } else {
            console.log(`      field ${ssf.field} (${ssf.type}):`, ssf);
          }
        }
      } else if (sf.type === 'fixed64') {
        console.log(`    field ${sf.field} (float64): ${sf.value}`);
      } else if (sf.type === 'fixed32') {
        console.log(`    field ${sf.field} (float32): ${sf.float} / int: ${sf.int}`);
      }
    }
  } else if (f.type === 'fixed64') {
    console.log(`  field ${f.field} (float64): ${f.value}`);
  } else if (f.type === 'fixed32') {
    console.log(`  field ${f.field} (float32): ${f.float} / int: ${f.int}`);
  }
}
