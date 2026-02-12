// Test decoding Wikiloc geom field
// Usage: npx tsx scripts/trail-curation/test-wikiloc-decode.ts

async function main() {
  const url = 'https://www.wikiloc.com/hiking-trails/cradle-mountain-summit-58140513';
  console.log(`Fetching ${url}...`);

  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
  });
  const html = await resp.text();
  console.log(`Got ${html.length} chars of HTML`);

  // Extract geom field
  const geomMatch = html.match(/"geom"\s*:\s*"([^"]+)"/);
  if (!geomMatch) {
    console.log('No geom field found');
    // Try to find any coordinate-like data
    const coordMatch = html.match(/coordinates|points|latlng|polyline/gi);
    console.log('Coordinate keywords found:', coordMatch?.slice(0, 10));
    return;
  }

  const geom = geomMatch[1];
  console.log(`Geom string: ${geom.length} chars`);
  console.log(`First 200 chars: ${geom.substring(0, 200)}`);
  console.log(`Last 50 chars: ${geom.substring(geom.length - 50)}`);

  // Check character set
  const chars = new Set(geom.split(''));
  console.log(`Unique chars (${chars.size}):`, [...chars].sort().join(''));

  // Try base64 decode
  try {
    const decoded = Buffer.from(geom, 'base64');
    console.log(`\nBase64 decoded: ${decoded.length} bytes`);
    console.log(`First 50 bytes (hex):`, decoded.subarray(0, 50).toString('hex'));
    console.log(`First 50 bytes (utf8):`, decoded.subarray(0, 50).toString('utf8'));

    // Check if it looks like protobuf (varint encoding)
    // Or check if it's packed floats/doubles
    const view = new DataView(decoded.buffer, decoded.byteOffset, decoded.byteLength);

    // Try reading as float64 pairs (lng, lat)
    console.log('\nTrying float64 pairs:');
    for (let i = 0; i < Math.min(decoded.length, 80); i += 8) {
      if (i + 8 <= decoded.length) {
        const val = view.getFloat64(i, true); // little-endian
        const valBE = view.getFloat64(i, false); // big-endian
        if (Math.abs(val) > 0.001 && Math.abs(val) < 200) console.log(`  offset ${i}: LE=${val.toFixed(6)}`);
        if (Math.abs(valBE) > 0.001 && Math.abs(valBE) < 200) console.log(`  offset ${i}: BE=${valBE.toFixed(6)}`);
      }
    }

    // Try reading as int32 pairs (Google polyline style: lat*1e5, lng*1e5)
    console.log('\nTrying int32 pairs (÷1e5):');
    for (let i = 0; i < Math.min(decoded.length, 40); i += 4) {
      if (i + 4 <= decoded.length) {
        const val = view.getInt32(i, true) / 1e5;
        const valBE = view.getInt32(i, false) / 1e5;
        if (Math.abs(val) > 0.001 && Math.abs(val) < 200) console.log(`  offset ${i}: LE=${val.toFixed(6)}`);
        if (Math.abs(valBE) > 0.001 && Math.abs(valBE) < 200) console.log(`  offset ${i}: BE=${valBE.toFixed(6)}`);
      }
    }
  } catch (e) {
    console.log('Base64 decode failed:', e);
  }

  // Try Google encoded polyline decode
  console.log('\nTrying Google polyline decode...');
  try {
    const coords = decodePolyline(geom);
    console.log(`Decoded ${coords.length} points`);
    if (coords.length > 0) {
      console.log('First 5:', coords.slice(0, 5));
      console.log('Last 5:', coords.slice(-5));
    }
  } catch (e) {
    console.log('Google polyline decode failed:', (e as Error).message);
  }

  // Also look for elevation profile data
  const eleMatch = html.match(/elevation[Pp]rofile|eleData|chartData/);
  console.log('\nElevation profile references:', eleMatch);

  // Look for any JSON arrays with numbers
  const jsonArrayMatch = html.match(/\[\s*\[\s*-?\d+\.?\d*\s*,\s*-?\d+\.?\d*/);
  if (jsonArrayMatch) {
    console.log('\nFound JSON coordinate array:', jsonArrayMatch[0].substring(0, 200));
  }

  // Check for trail download links
  const downloadMatch = html.match(/download\.do\?id=\d+|\.gpx|\.kml/gi);
  console.log('\nDownload links:', downloadMatch?.slice(0, 5));
}

function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coords.push([lat / 1e5, lng / 1e5]);
  }

  return coords;
}

main().catch(console.error);
