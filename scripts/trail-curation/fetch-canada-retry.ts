// Retry fetch for 27 failed Canadian trails with improved search variants
// Strategy: broader OSM name variants, French names for QC, relaxed highway types
// Usage: npx tsx scripts/trail-curation/fetch-canada-retry.ts [--dry-run] [--only trailId]
//
// Pipeline:
// 1. Try OSM ways with multiple name variants + broader highway types
// 2. Chain way segments by nearest endpoint
// 3. Detect out-and-back (calc ≈ official/2) → mirror
// 4. Enrich elevation via SRTM 30m
// 5. Write trail JSON + update manifest

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const OVERPASS_API = 'https://overpass.kumi.systems/api/interpreter';
const OVERPASS_API_FALLBACK = 'https://overpass-api.de/api/interpreter';
const TOPO_API = 'https://api.opentopodata.org/v1/srtm30m';
const TRAIL_DATA_DIR = join(process.cwd(), 'public', 'trail-data');

interface RetryTrail {
  id: string;
  name: string;
  searchNames: string[];
  region: string;
  country: string;
  officialKm: number;
  typicalDays: string;
  bbox: [number, number, number, number];
}

// 27 failed trails with expanded search variants
const RETRY_TRAILS: RetryTrail[] = [
  // --- British Columbia ---
  {
    id: 'rockwall_trail', name: 'Rockwall Trail', region: 'British Columbia', country: 'CA',
    officialKm: 55, typicalDays: '4',
    searchNames: ['Rockwall Trail', 'Rockwall', 'Rockwall Highline', 'Helmet Creek'],
    bbox: [50.5, -116.2, 50.8, -115.8]
  },
  {
    id: 'della_falls_trail', name: 'Della Falls Trail', region: 'British Columbia', country: 'CA',
    officialKm: 32, typicalDays: '3',
    searchNames: ['Della Falls Trail', 'Della Falls', 'Drinkwater Creek Trail', 'Drinkwater Creek'],
    bbox: [49.05, -125.65, 49.2, -125.4]
  },
  {
    id: 'nootka_trail', name: 'Nootka Trail', region: 'British Columbia', country: 'CA',
    officialKm: 35, typicalDays: '5',
    searchNames: ['Nootka Trail', 'Nootka Island Trail', 'Calvin Falls Trail'],
    bbox: [49.55, -126.8, 49.85, -126.4]
  },

  // --- Alberta (Rockies / Parks Canada) ---
  {
    id: 'tonquin_valley', name: 'Tonquin Valley Trail', region: 'Alberta', country: 'CA',
    officialKm: 44, typicalDays: '3',
    searchNames: ['Tonquin Valley Trail', 'Tonquin Valley', 'Astoria River Trail', 'Maccarib Pass Trail', 'Astoria River'],
    bbox: [52.6, -118.15, 52.85, -117.8]
  },
  {
    id: 'lake_agnes_and_big_beehive', name: 'Lake Agnes and Big Beehive Trail', region: 'Alberta', country: 'CA',
    officialKm: 13, typicalDays: '1',
    searchNames: ['Lake Agnes Trail', 'Lake Agnes', 'Big Beehive Trail', 'Big Beehive', 'Lake Agnes Teahouse'],
    bbox: [51.36, -116.28, 51.44, -116.16]
  },
  {
    id: 'mt_assiniboine_via_wonder_pass', name: 'Mt Assiniboine via Wonder Pass', region: 'Alberta', country: 'CA',
    officialKm: 55, typicalDays: '4',
    searchNames: ['Wonder Pass Trail', 'Wonder Pass', 'Bryant Creek Trail', 'Bryant Creek', 'Mount Assiniboine'],
    bbox: [50.7, -115.8, 51.0, -115.4]
  },
  {
    id: 'egypt_lake_via_healy_pass', name: 'Egypt Lake via Healy Pass', region: 'Alberta', country: 'CA',
    officialKm: 24, typicalDays: '2',
    searchNames: ['Egypt Lake Trail', 'Healy Pass Trail', 'Healy Pass', 'Healy Creek Trail', 'Egypt Lake'],
    bbox: [51.05, -116.2, 51.2, -115.95]
  },
  {
    id: 'sawback_trail', name: 'Sawback Trail', region: 'Alberta', country: 'CA',
    officialKm: 74, typicalDays: '5',
    searchNames: ['Sawback Trail', 'Sawback Range Trail', 'Mystic Pass', 'Johnston Creek'],
    bbox: [51.15, -116.1, 51.5, -115.5]
  },
  {
    id: 'skoki_loop', name: 'Skoki Loop', region: 'Alberta', country: 'CA',
    officialKm: 35, typicalDays: '3',
    searchNames: ['Skoki Trail', 'Skoki Loop', 'Skoki Valley Trail', 'Temple Trail', 'Boulder Pass Trail'],
    bbox: [51.4, -116.45, 51.6, -116.15]
  },
  {
    id: 'akamina_ridge_trail', name: 'Akamina Ridge Trail', region: 'Alberta', country: 'CA',
    officialKm: 10, typicalDays: '1',
    searchNames: ['Akamina Ridge Trail', 'Akamina Ridge', 'Akamina Pass Trail', 'Wall Lake Trail'],
    bbox: [49.0, -114.2, 49.06, -114.0]
  },
  {
    id: 'carthew_alderson_trail', name: 'Carthew-Alderson Trail', region: 'Alberta', country: 'CA',
    officialKm: 20, typicalDays: '1',
    searchNames: ['Carthew-Alderson Trail', 'Carthew Alderson', 'Carthew Summit Trail', 'Alderson Lake Trail', 'Cameron Lake Trail'],
    bbox: [49.0, -114.15, 49.1, -113.85]
  },

  // --- Ontario ---
  {
    id: 'algonquin_highlands_backpacking_trail', name: 'Algonquin Highlands Backpacking Trail', region: 'Ontario', country: 'CA',
    officialKm: 88, typicalDays: '7',
    searchNames: ['Western Uplands Trail', 'Western Uplands Backpacking Trail', 'Highland Trail', 'Highland Backpacking Trail'],
    bbox: [45.3, -78.9, 45.8, -78.2]
  },
  {
    id: 'coastal_trail_pukaskwa', name: 'Coastal Trail (Pukaskwa)', region: 'Ontario', country: 'CA',
    officialKm: 60, typicalDays: '5',
    searchNames: ['Coastal Hiking Trail', 'Pukaskwa Coastal Trail', 'White River Suspension Bridge Trail', 'Mdaabii Miikna'],
    bbox: [47.7, -86.0, 48.4, -85.2]
  },
  {
    id: 'killarney_provincial_park_the_crack', name: 'Killarney Provincial Park - The Crack', region: 'Ontario', country: 'CA',
    officialKm: 6, typicalDays: '1',
    searchNames: ['The Crack Trail', 'The Crack', 'Crack Trail'],
    bbox: [45.95, -81.55, 46.05, -81.35]
  },
  {
    id: 'cup_and_saucer_trail', name: 'Cup and Saucer Trail', region: 'Ontario', country: 'CA',
    officialKm: 9, typicalDays: '1',
    searchNames: ['Cup and Saucer Trail', 'Cup and Saucer', 'Cup and Saucer Lookout Trail'],
    bbox: [45.68, -82.45, 45.76, -82.25]
  },

  // --- Quebec (try French names) ---
  {
    id: 'sentier_des_caps_de_charlevoix', name: 'Sentier des Caps de Charlevoix', region: 'Quebec', country: 'CA',
    officialKm: 51, typicalDays: '3',
    searchNames: ['Sentier des Caps', 'Sentier des Caps de Charlevoix', 'Caps de Charlevoix'],
    bbox: [47.05, -70.85, 47.35, -70.55]
  },
  {
    id: 'mont_jacques_cartier_trail', name: 'Mont Jacques-Cartier Trail', region: 'Quebec', country: 'CA',
    officialKm: 16, typicalDays: '1',
    searchNames: ['Mont Jacques-Cartier', 'Sentier du Mont Jacques-Cartier', 'Jacques-Cartier'],
    bbox: [48.9, -66.0, 49.05, -65.8]
  },
  {
    id: 'les_loups_trail', name: 'Les Loups Trail', region: 'Quebec', country: 'CA',
    officialKm: 45, typicalDays: '3',
    searchNames: ['Sentier Les Loups', 'Les Loups', 'Sentier des Loups', 'Parc national de la Gaspésie'],
    bbox: [48.55, -66.25, 48.85, -65.85]
  },
  {
    id: 'mont_albert_circuit', name: 'Mont Albert Circuit', region: 'Quebec', country: 'CA',
    officialKm: 17, typicalDays: '2',
    searchNames: ['Mont Albert', 'Sentier du Mont Albert', 'Mont-Albert', 'Sentier Mont-Albert'],
    bbox: [48.9, -66.55, 49.05, -66.3]
  },
  {
    id: 'mont_tremblant_summit_trail', name: 'Mont Tremblant Summit Trail', region: 'Quebec', country: 'CA',
    officialKm: 11, typicalDays: '1',
    searchNames: ['Grand Brûlé', 'Sentier du Sommet', 'Mont Tremblant', 'La Roche'],
    bbox: [46.17, -74.67, 46.28, -74.52]
  },

  // --- Maritimes ---
  {
    id: 'cape_chignecto_coastal_trail', name: 'Cape Chignecto Coastal Trail', region: 'Nova Scotia', country: 'CA',
    officialKm: 51, typicalDays: '4',
    searchNames: ['Cape Chignecto Coastal Trail', 'Cape Chignecto Trail', 'Chignecto'],
    bbox: [45.2, -65.15, 45.4, -64.75]
  },
  {
    id: 'skyline_trail_cape_breton', name: 'Skyline Trail (Cape Breton)', region: 'Nova Scotia', country: 'CA',
    officialKm: 9, typicalDays: '1',
    searchNames: ['Skyline Trail', 'Skyline Loop', 'Cabot Trail Skyline'],
    bbox: [46.62, -61.05, 46.72, -60.85]
  },

  // --- Northern / Remote ---
  {
    id: 'canol_heritage_trail', name: 'Canol Heritage Trail', region: 'Yukon / Northwest Territories', country: 'CA',
    officialKm: 355, typicalDays: '21',
    searchNames: ['Canol Heritage Trail', 'Canol Road', 'Canol Trail'],
    bbox: [61.5, -131.5, 63.5, -125.0]
  },
  {
    id: 'chilkoot_pass_trail', name: 'Chilkoot Pass Trail', region: 'Yukon / Alaska', country: 'CA',
    officialKm: 53, typicalDays: '4',
    searchNames: ['Chilkoot Pass', 'Chilkoot Trail'],
    bbox: [59.3, -135.6, 59.85, -134.7]
  },
  {
    id: 'tombstone_grizzly_lake_trail', name: 'Tombstone Grizzly Lake Trail', region: 'Yukon', country: 'CA',
    officialKm: 20, typicalDays: '2',
    searchNames: ['Grizzly Lake Trail', 'Grizzly Lake', 'Tombstone Mountain Trail', 'Goldensides Trail'],
    bbox: [64.3, -138.5, 64.55, -138.15]
  },
  {
    id: 'aulavik_river_route', name: 'Aulavik River Route', region: 'Northwest Territories', country: 'CA',
    officialKm: 140, typicalDays: '10',
    searchNames: ['Thomsen River', 'Aulavik River', 'Thomsen River Route'],
    bbox: [73.3, -120.5, 74.2, -117.5]
  },
  {
    id: 'grey_owl_trail', name: 'Grey Owl Trail', region: 'Saskatchewan', country: 'CA',
    officialKm: 40, typicalDays: '3',
    searchNames: ['Grey Owl Trail', 'Grey Owl', 'Kingsmere River Trail', 'Kingsmere Lake Trail'],
    bbox: [53.8, -106.6, 54.05, -105.9]
  },
];

// --- Utilities ---

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function totalDist(coords: [number, number, number][]): number {
  let d = 0;
  for (let i = 1; i < coords.length; i++) {
    d += haversine(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
  }
  return d;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function overpassQuery(query: string, retries = 3): Promise<any> {
  const apis = [OVERPASS_API, OVERPASS_API_FALLBACK];

  for (let attempt = 0; attempt <= retries; attempt++) {
    for (const api of apis) {
      try {
        const res = await fetch(api, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(90000),
        });

        if (!res.ok) {
          const label = api.includes('kumi') ? 'kumi' : 'main';
          console.log(`    Overpass ${label}: HTTP ${res.status}, trying next...`);
          continue;
        }

        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('xml') || contentType.includes('html')) {
          const label = api.includes('kumi') ? 'kumi' : 'main';
          console.log(`    Overpass ${label}: got XML instead of JSON (rate limited?), trying next...`);
          continue;
        }

        return await res.json();
      } catch (e: any) {
        const label = api.includes('kumi') ? 'kumi' : 'main';
        if (e.name === 'TimeoutError') {
          console.log(`    Overpass ${label}: timeout, trying next...`);
        }
        continue;
      }
    }

    if (attempt < retries) {
      const delay = 10000 * (attempt + 1);
      console.log(`    All APIs failed, retrying in ${delay / 1000}s...`);
      await sleep(delay);
    }
  }

  throw new Error('All Overpass API attempts failed');
}

function chainSegments(segments: [number, number][][]): [number, number][] {
  if (segments.length === 0) return [];
  if (segments.length === 1) return segments[0];

  const used = new Set<number>();
  const result: [number, number][] = [...segments[0]];
  used.add(0);

  while (used.size < segments.length) {
    const lastPt = result[result.length - 1];
    let bestIdx = -1;
    let bestDist = Infinity;
    let bestReverse = false;

    for (let i = 0; i < segments.length; i++) {
      if (used.has(i)) continue;
      const seg = segments[i];

      const dStart = haversine(lastPt[1], lastPt[0], seg[0][1], seg[0][0]);
      const dEnd = haversine(lastPt[1], lastPt[0], seg[seg.length - 1][1], seg[seg.length - 1][0]);

      if (dStart < bestDist) { bestDist = dStart; bestIdx = i; bestReverse = false; }
      if (dEnd < bestDist) { bestDist = dEnd; bestIdx = i; bestReverse = true; }
    }

    if (bestIdx === -1) break;
    used.add(bestIdx);

    const seg = bestReverse ? [...segments[bestIdx]].reverse() : segments[bestIdx];
    result.push(...seg);
  }

  return result;
}

async function enrichElevation(coords: [number, number][]): Promise<[number, number, number][]> {
  const enriched: [number, number, number][] = [];
  const batchSize = 100;
  const totalBatches = Math.ceil(coords.length / batchSize);
  console.log(`  Enriching elevation (${coords.length} pts, ~${totalBatches} batches)...`);

  for (let i = 0; i < coords.length; i += batchSize) {
    const batch = coords.slice(i, i + batchSize);
    const locations = batch.map(c => `${c[1]},${c[0]}`).join('|');

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`${TOPO_API}?locations=${locations}`, {
          signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) {
          await sleep(2000);
          continue;
        }
        const data = await res.json();
        if (data.results) {
          for (let j = 0; j < batch.length; j++) {
            const elev = data.results[j]?.elevation ?? 0;
            enriched.push([batch[j][0], batch[j][1], Math.round(elev)]);
          }
          break;
        }
      } catch {
        await sleep(2000);
      }
      if (attempt === 2) {
        for (const c of batch) enriched.push([c[0], c[1], 0]);
      }
    }
    await sleep(1100); // rate limit
  }

  return enriched;
}

async function fetchTrailWays(trail: RetryTrail): Promise<{ coords: [number, number, number][]; source: string } | null> {
  const bboxStr = `(${trail.bbox[0]},${trail.bbox[1]},${trail.bbox[2]},${trail.bbox[3]})`;

  for (const searchName of trail.searchNames) {
    // Escape special regex chars in search name
    const escapedName = searchName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Try broader highway types than just path|footway
    const query = `[out:json][timeout:60];
      (
        way["highway"~"path|footway|track|steps|bridleway|tertiary|service"]["name"~"${escapedName}",i]${bboxStr};
      );
      out body;>;out skel qt;`;

    try {
      const data = await overpassQuery(query);
      const elements = data.elements || [];

      // Two-pass: collect nodes first, then resolve ways
      const nodes = new Map<number, [number, number]>();
      const ways: { id: number; nodeIds: number[] }[] = [];

      for (const el of elements) {
        if (el.type === 'node' && el.lat != null && el.lon != null) {
          nodes.set(el.id, [el.lon, el.lat]);
        }
        if (el.type === 'way' && el.nodes) {
          ways.push({ id: el.id, nodeIds: el.nodes });
        }
      }

      if (ways.length === 0) continue;

      // Resolve way coordinates
      const segments: [number, number][][] = [];
      for (const way of ways) {
        const pts: [number, number][] = [];
        for (const nid of way.nodeIds) {
          const node = nodes.get(nid);
          if (node) pts.push(node);
        }
        if (pts.length >= 2) segments.push(pts);
      }

      if (segments.length === 0) continue;

      const chained = chainSegments(segments);
      if (chained.length < 3) continue;

      console.log(`  Found ${ways.length} ways via "${searchName}" → ${chained.length} points`);

      // Enrich elevation
      const enriched = await enrichElevation(chained);

      // Check for out-and-back: if calc ≈ official/2, mirror
      let finalCoords = enriched;
      const calcKm = totalDist(enriched);
      const halfOff = Math.abs(calcKm - trail.officialKm / 2) / (trail.officialKm / 2);
      const fullOff = Math.abs(calcKm - trail.officialKm) / trail.officialKm;
      if (halfOff < 0.15 && fullOff > 0.3) {
        const reversed = [...enriched].reverse().slice(1) as [number, number, number][];
        const mirrored = [...enriched, ...reversed] as [number, number, number][];
        const mirroredKm = totalDist(mirrored);
        const mirroredOff = Math.abs(mirroredKm - trail.officialKm) / trail.officialKm;
        if (mirroredOff < fullOff) {
          console.log(`  Out-and-back: ${calcKm.toFixed(1)}km → ${mirroredKm.toFixed(1)}km (mirrored)`);
          finalCoords = mirrored;
        }
      }

      return { coords: finalCoords, source: 'osm_ways' };
    } catch (e: any) {
      // continue to next search name
    }

    await sleep(3000);
  }

  // Also try relation search with broader matching
  for (const searchName of trail.searchNames) {
    const escapedName = searchName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const query = `[out:json][timeout:60];
      (
        rel["route"="hiking"]["name"~"${escapedName}",i]${bboxStr};
        rel["route"="foot"]["name"~"${escapedName}",i]${bboxStr};
        rel["type"="route"]["name"~"${escapedName}",i]${bboxStr};
      );
      out tags;`;

    try {
      const data = await overpassQuery(query);
      const rels = (data.elements || []).filter((e: any) => e.type === 'relation');
      if (rels.length > 0) {
        const best = rels[0];
        console.log(`  Found relation: ${best.id} "${best.tags?.name}" via "${searchName}"`);

        // Fetch ways from relation
        const wayQuery = `[out:json][timeout:120];
          rel(${best.id});
          way(r:"");
          out body;>;out skel qt;`;

        const wayData = await overpassQuery(wayQuery);
        const wayElements = wayData.elements || [];

        const nodes = new Map<number, [number, number]>();
        const ways: { id: number; nodeIds: number[] }[] = [];

        for (const el of wayElements) {
          if (el.type === 'node' && el.lat != null && el.lon != null) {
            nodes.set(el.id, [el.lon, el.lat]);
          }
          if (el.type === 'way' && el.nodes) {
            ways.push({ id: el.id, nodeIds: el.nodes });
          }
        }

        if (ways.length === 0) continue;

        const segments: [number, number][][] = [];
        for (const way of ways) {
          const pts: [number, number][] = [];
          for (const nid of way.nodeIds) {
            const node = nodes.get(nid);
            if (node) pts.push(node);
          }
          if (pts.length >= 2) segments.push(pts);
        }

        if (segments.length === 0) continue;

        console.log(`    ${ways.length} ways, chaining...`);
        const chained = chainSegments(segments);

        const enriched = await enrichElevation(chained);
        return { coords: enriched, source: 'osm_overpass_ordered' };
      }
    } catch {
      // continue
    }

    await sleep(3000);
  }

  return null;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const onlyId = process.argv.find(a => a.startsWith('--only'))
    ? process.argv[process.argv.indexOf('--only') + 1]
    : null;

  console.log(`=== RETRY CANADA TRAILS (${RETRY_TRAILS.length} trails) ===${dryRun ? ' (DRY RUN)' : ''}\n`);

  // Load manifest
  const manifestPath = join(TRAIL_DATA_DIR, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

  // Load progress
  const progressPath = join(process.cwd(), 'scripts', 'trail-curation', 'results', 'canada-retry-progress.json');
  const progress: { results: any[]; failures: string[]; timestamp: string } = existsSync(progressPath)
    ? JSON.parse(readFileSync(progressPath, 'utf-8'))
    : { results: [], failures: [], timestamp: '' };

  const alreadyDone = new Set(progress.results.map((r: any) => r.id));

  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < RETRY_TRAILS.length; i++) {
    const trail = RETRY_TRAILS[i];

    if (onlyId && trail.id !== onlyId) continue;

    // Skip if already has data
    if (existsSync(join(TRAIL_DATA_DIR, `${trail.id}.json`))) {
      console.log(`[${i + 1}/${RETRY_TRAILS.length}] SKIP ${trail.name} — already has data`);
      continue;
    }

    if (alreadyDone.has(trail.id)) {
      console.log(`[${i + 1}/${RETRY_TRAILS.length}] SKIP ${trail.name} — already in progress`);
      continue;
    }

    console.log(`\n[${i + 1}/${RETRY_TRAILS.length}] ${trail.name} (${trail.officialKm}km, ${trail.region})`);

    const result = await fetchTrailWays(trail);

    if (!result) {
      console.log(`  FAILED: no data found`);
      progress.failures.push(trail.name);
      failed++;
      continue;
    }

    const calcKm = totalDist(result.coords);
    const offPct = Math.abs(calcKm - trail.officialKm) / trail.officialKm * 100;
    const status = offPct <= 5 ? 'OK' : offPct <= 25 ? 'FAIR' : 'HIGH';

    // Elevation stats
    let elevLow = Infinity, elevHigh = -Infinity;
    for (const c of result.coords) {
      if (c[2] > 0) {
        if (c[2] < elevLow) elevLow = c[2];
        if (c[2] > elevHigh) elevHigh = c[2];
      }
    }

    console.log(`  SUCCESS: ${status} | ${result.coords.length} pts, ${calcKm.toFixed(1)}km (${offPct.toFixed(1)}% off) [${result.source}]`);
    if (elevLow < Infinity) console.log(`  Elevation: ${elevLow}m — ${elevHigh}m`);

    if (!dryRun) {
      // Write trail data file
      const trailData = {
        id: trail.id,
        name: trail.name,
        region: trail.region,
        country: trail.country,
        distance_km: trail.officialKm,
        typical_days: trail.typicalDays,
        coordinates: result.coords,
        dataSource: result.source,
        calculatedKm: calcKm,
      };
      writeFileSync(join(TRAIL_DATA_DIR, `${trail.id}.json`), JSON.stringify(trailData));

      // Update manifest
      manifest[trail.id] = {
        pointCount: result.coords.length,
        dataSource: result.source,
        calculatedKm: calcKm,
        elevationLow: elevLow < Infinity ? elevLow : undefined,
        elevationHigh: elevHigh > -Infinity ? elevHigh : undefined,
      };
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    }

    progress.results.push({
      id: trail.id,
      name: trail.name,
      calcKm,
      pts: result.coords.length,
      source: result.source,
      off: offPct,
      status,
    });
    progress.timestamp = new Date().toISOString();
    writeFileSync(progressPath, JSON.stringify(progress, null, 2));

    succeeded++;
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Succeeded: ${succeeded}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total trails in manifest: ${Object.keys(manifest).length}`);
}

main().catch(console.error);
