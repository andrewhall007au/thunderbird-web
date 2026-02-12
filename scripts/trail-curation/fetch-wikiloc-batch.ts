// Batch fetch trail data from Wikiloc using Playwright + SRTM elevation enrichment
// Usage: npx tsx scripts/trail-curation/fetch-wikiloc-batch.ts --list trail-lists/tasmania-day-walks.json
import { chromium, Browser } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

interface TrailDef {
  name: string;
  searchName: string;
  region: string;
  country: string;
  officialDistanceKm: number;
  typicalDays: string;
  bbox: number[];
  wikiloc?: string;
}

interface TrailResult {
  name: string;
  region: string;
  country: string;
  officialDistanceKm: number;
  typicalDays: string;
  coordinates: number[][];
  source: string;
  distanceKm: number;
  elevationMin: number;
  elevationMax: number;
  error: number;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function fetchElevation(coords: number[][]): Promise<number[][]> {
  const BATCH_SIZE = 100;
  const result = [...coords.map(c => [...c])];
  const batches = Math.ceil(coords.length / BATCH_SIZE);
  console.log(`  Enriching elevation (${coords.length} pts, ~${batches} batches)...`);

  for (let b = 0; b < batches; b++) {
    const start = b * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, coords.length);
    const batchCoords = coords.slice(start, end);

    const locations = batchCoords.map(c => `${c[1]},${c[0]}`).join('|');
    const url = `https://api.opentopodata.org/v1/srtm30m?locations=${locations}`;

    for (let retry = 0; retry < 3; retry++) {
      try {
        const resp = await fetch(url);
        if (resp.status === 429) {
          console.log(`    Rate limited, waiting ${5 + retry * 5}s...`);
          await new Promise(r => setTimeout(r, (5 + retry * 5) * 1000));
          continue;
        }
        const data = await resp.json();
        if (data.results) {
          for (let i = 0; i < data.results.length; i++) {
            const ele = data.results[i].elevation;
            if (ele !== null && ele !== undefined) {
              result[start + i][2] = Math.round(ele);
            }
          }
        }
        break;
      } catch (err) {
        console.log(`    Elevation batch ${b} failed:`, (err as Error).message);
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    // Rate limit: 1 req/sec
    if (b < batches - 1) {
      await new Promise(r => setTimeout(r, 1100));
    }
  }

  return result;
}

async function extractFromWikiloc(browser: Browser, url: string): Promise<number[][]> {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);

    const result = await page.evaluate(() => {
      // Find Leaflet map and extract polyline coords
      const containers = document.querySelectorAll('.leaflet-container');
      if (containers.length === 0) return [];

      // Search window for map instance
      let map: any = null;
      for (const key of Object.keys(window)) {
        const val = (window as any)[key];
        if (val && val._container && val.getCenter && typeof val.eachLayer === 'function') {
          map = val;
          break;
        }
      }
      if (!map) return [];

      const coords: number[][] = [];
      map.eachLayer((layer: any) => {
        if (layer.getLatLngs && coords.length === 0) {
          const latlngs = layer.getLatLngs();
          const flat = Array.isArray(latlngs[0]) && typeof latlngs[0].lat === 'undefined'
            ? latlngs.flat()
            : latlngs;
          for (const ll of flat) {
            if (ll.lat !== undefined && ll.lng !== undefined) {
              coords.push([ll.lng, ll.lat, ll.alt || 0]);
            }
          }
        }
      });
      return coords;
    });

    await context.close();
    return result;
  } catch (err) {
    console.log(`    Playwright error: ${(err as Error).message}`);
    await context.close();
    return [];
  }
}

function toTrailId(name: string): string {
  return name.toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

async function main() {
  const listArg = process.argv.find(a => a.startsWith('--list='))?.split('=')[1]
    || process.argv[process.argv.indexOf('--list') + 1];

  if (!listArg) {
    console.log('Usage: npx tsx fetch-wikiloc-batch.ts --list trail-lists/tasmania-day-walks.json');
    return;
  }

  const listPath = path.resolve('scripts/trail-curation', listArg);
  const trails: TrailDef[] = JSON.parse(fs.readFileSync(listPath, 'utf-8'));

  console.log(`\n=== WIKILOC BATCH FETCH: ${trails.length} trails ===\n`);

  const outDir = path.resolve('public/trail-data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const results: Array<{ name: string; status: string; points: number; dist: string; error: string; source: string }> = [];

  for (let i = 0; i < trails.length; i++) {
    const trail = trails[i];
    const trailId = toTrailId(trail.name);
    console.log(`[${i + 1}/${trails.length}] ${trail.name} (${trail.officialDistanceKm}km, ${trail.region})`);

    // Check if already exists with good data
    const outFile = path.join(outDir, `${trailId}.json`);
    if (fs.existsSync(outFile)) {
      const existing = JSON.parse(fs.readFileSync(outFile, 'utf-8'));
      if (existing.coordinates && existing.coordinates.length > 50) {
        const existingError = Math.abs(existing.distanceKm - trail.officialDistanceKm) / trail.officialDistanceKm;
        if (existingError < 0.25) {
          console.log(`  SKIP: already exists with ${existing.coordinates.length} pts, ${existing.distanceKm}km (${(existingError*100).toFixed(1)}% off)`);
          results.push({ name: trail.name, status: 'SKIP', points: existing.coordinates.length, dist: `${existing.distanceKm}km`, error: `${(existingError*100).toFixed(1)}%`, source: 'existing' });
          continue;
        }
      }
    }

    if (!trail.wikiloc) {
      console.log(`  SKIP: no Wikiloc URL`);
      results.push({ name: trail.name, status: 'SKIP', points: 0, dist: '-', error: '-', source: 'no_url' });
      continue;
    }

    // Extract from Wikiloc
    const coords = await extractFromWikiloc(browser, trail.wikiloc);

    if (coords.length === 0) {
      console.log(`  FAILED: no coordinates extracted`);
      results.push({ name: trail.name, status: 'FAIL', points: 0, dist: '-', error: '-', source: 'wikiloc' });
      continue;
    }

    console.log(`  Extracted ${coords.length} points from Wikiloc`);

    // Enrich elevation
    const enriched = await fetchElevation(coords);

    // Calculate stats
    let dist = 0;
    for (let j = 1; j < enriched.length; j++) {
      dist += haversineKm(enriched[j-1][1], enriched[j-1][0], enriched[j][1], enriched[j][0]);
    }

    let minEle = Infinity, maxEle = -Infinity;
    for (const c of enriched) {
      if (c[2] < minEle) minEle = c[2];
      if (c[2] > maxEle) maxEle = c[2];
    }

    const errorPct = Math.abs(dist - trail.officialDistanceKm) / trail.officialDistanceKm * 100;
    const quality = errorPct <= 5 ? 'OK' : errorPct <= 25 ? 'FAIR' : 'HIGH';

    console.log(`  Elevation: ${minEle}m — ${maxEle}m`);
    console.log(`  SUCCESS: ${quality} | ${enriched.length} pts, ${dist.toFixed(1)}km (${errorPct.toFixed(1)}% off) [wikiloc]`);

    // Save trail data
    const trailData: TrailResult = {
      name: trail.name,
      region: trail.region,
      country: trail.country,
      officialDistanceKm: trail.officialDistanceKm,
      typicalDays: trail.typicalDays,
      coordinates: enriched,
      source: 'wikiloc',
      distanceKm: Math.round(dist * 10) / 10,
      elevationMin: minEle,
      elevationMax: maxEle,
      error: Math.round(errorPct * 10) / 10
    };

    fs.writeFileSync(outFile, JSON.stringify(trailData));
    console.log(`  Saved: ${outFile}`);

    results.push({
      name: trail.name,
      status: quality,
      points: enriched.length,
      dist: `${dist.toFixed(1)}km`,
      error: `${errorPct.toFixed(1)}%`,
      source: 'wikiloc'
    });

    // Brief pause between trails
    await new Promise(r => setTimeout(r, 2000));
  }

  await browser.close();

  // Summary
  console.log(`\n=== SUMMARY ===`);
  console.log(`${'Trail'.padEnd(40)} ${'Status'.padEnd(8)} ${'Points'.padEnd(8)} ${'Dist'.padEnd(10)} ${'Error'.padEnd(8)} Source`);
  console.log('-'.repeat(90));
  for (const r of results) {
    console.log(`${r.name.padEnd(40)} ${r.status.padEnd(8)} ${String(r.points).padEnd(8)} ${r.dist.padEnd(10)} ${r.error.padEnd(8)} ${r.source}`);
  }

  const ok = results.filter(r => r.status === 'OK').length;
  const fair = results.filter(r => r.status === 'FAIR').length;
  const high = results.filter(r => r.status === 'HIGH').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const skip = results.filter(r => r.status === 'SKIP').length;
  console.log(`\nOK: ${ok}, FAIR: ${fair}, HIGH: ${high}, FAIL: ${fail}, SKIP: ${skip}`);
}

main().catch(console.error);
