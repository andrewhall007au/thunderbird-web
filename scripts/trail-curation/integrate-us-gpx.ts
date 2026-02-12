// Integrate GPX files from ~/Downloads for failed US trails
// Handles GPX with and without elevation (adds SRTM elevation if missing)
// Usage: npx tsx scripts/trail-curation/integrate-us-gpx.ts [--dry-run]
//
// Place GPX files in ~/Downloads with names matching the patterns below.
// The script auto-detects which trail each GPX belongs to by filename matching.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const TRAIL_DATA_DIR = join(process.cwd(), 'public', 'trail-data');
const DOWNLOADS_DIR = join(process.env.HOME || '', 'Downloads');
const TOPO_API = 'https://api.opentopodata.org/v1/srtm30m';

interface TrailMapping {
  trailId: string;
  name: string;
  officialKm: number;
  region: string;
  typicalDays: string;
  filePatterns: string[]; // lowercase patterns to match GPX filenames
}

// Map trail IDs to acceptable GPX filename patterns
// User downloads GPX from FKT or other sources, names don't need to be exact
const TRAIL_MAPPINGS: TrailMapping[] = [
  // Utah
  { trailId: 'the_narrows', name: 'The Narrows', officialKm: 16.0, region: 'UT', typicalDays: '1 day', filePatterns: ['narrows'] },
  { trailId: 'delicate_arch_trail', name: 'Delicate Arch Trail', officialKm: 4.8, region: 'UT', typicalDays: '1 day', filePatterns: ['delicate-arch', 'delicate_arch'] },
  { trailId: 'observation_point_via_east_mesa', name: 'Observation Point via East Mesa', officialKm: 12.9, region: 'UT', typicalDays: '1 day', filePatterns: ['observation-point', 'observation_point'] },
  { trailId: 'wave_via_wire_pass', name: 'Wave via Wire Pass', officialKm: 9.7, region: 'AZ', typicalDays: '1 day', filePatterns: ['wave', 'wire-pass'] },
  { trailId: 'peek_a_boo_loop_bryce', name: 'Peek-a-Boo Loop Bryce', officialKm: 8.9, region: 'UT', typicalDays: '1 day', filePatterns: ['peek-a-boo', 'peekaboo'] },
  { trailId: 'kings_peak_via_henrys_fork', name: 'Kings Peak via Henrys Fork', officialKm: 44.3, region: 'UT', typicalDays: '3 days', filePatterns: ['kings-peak', 'henrys-fork'] },
  { trailId: 'buckskin_gulch', name: 'Buckskin Gulch', officialKm: 32.2, region: 'UT', typicalDays: '2-3 days', filePatterns: ['buckskin'] },
  { trailId: 'mesa_arch_trail', name: 'Mesa Arch Trail', officialKm: 0.8, region: 'UT', typicalDays: '1 day', filePatterns: ['mesa-arch', 'mesa_arch'] },

  // Arizona
  { trailId: 'havasu_falls', name: 'Havasu Falls', officialKm: 16.1, region: 'AZ', typicalDays: '2-3 days', filePatterns: ['havasu'] },
  { trailId: 'west_fork_oak_creek', name: 'West Fork Oak Creek', officialKm: 11.3, region: 'AZ', typicalDays: '1 day', filePatterns: ['west-fork', 'oak-creek'] },
  { trailId: 'cathedral_rock_trail', name: 'Cathedral Rock Trail', officialKm: 2.4, region: 'AZ', typicalDays: '1 day', filePatterns: ['cathedral-rock', 'cathedral_rock'] },
  { trailId: 'humphreys_peak_trail', name: 'Humphreys Peak Trail', officialKm: 15.4, region: 'AZ', typicalDays: '1 day', filePatterns: ['humphreys'] },

  // Hawaii
  { trailId: 'kalepa_ridge_trail', name: 'Kalepa Ridge Trail', officialKm: 3.2, region: 'HI', typicalDays: '1 day', filePatterns: ['kalepa'] },
  { trailId: 'haleakala_sliding_sands_trail', name: 'Haleakala Sliding Sands Trail', officialKm: 17.7, region: 'HI', typicalDays: '1 day', filePatterns: ['sliding-sands', 'haleakala'] },
  { trailId: 'koko_crater_trail', name: 'Koko Crater Trail', officialKm: 2.7, region: 'HI', typicalDays: '1 day', filePatterns: ['koko'] },

  // Virginia / East Coast
  { trailId: 'old_rag_mountain_loop', name: 'Old Rag Mountain Loop', officialKm: 14.5, region: 'VA', typicalDays: '1 day', filePatterns: ['old-rag', 'old_rag'] },
  { trailId: 'presidential_traverse', name: 'Presidential Traverse', officialKm: 37.0, region: 'NH', typicalDays: '2-3 days', filePatterns: ['presidential'] },
  { trailId: 'mount_katahdin_via_hunt_trail', name: 'Mount Katahdin via Hunt Trail', officialKm: 16.7, region: 'ME', typicalDays: '1 day', filePatterns: ['katahdin', 'hunt-trail'] },
  { trailId: 'the_subway_at_zion', name: 'The Subway at Zion', officialKm: 15.4, region: 'UT', typicalDays: '1 day', filePatterns: ['subway'] },

  // Wyoming
  { trailId: 'cascade_canyon_to_lake_solitude', name: 'Cascade Canyon to Lake Solitude', officialKm: 30.6, region: 'WY', typicalDays: '1-2 days', filePatterns: ['cascade-canyon', 'lake-solitude'] },

  // Washington
  { trailId: 'enchantments_thru_hike', name: 'Enchantments Thru-Hike', officialKm: 29.8, region: 'WA', typicalDays: '2-3 days', filePatterns: ['enchantment'] },
  { trailId: 'hoh_river_to_blue_glacier', name: 'Hoh River to Blue Glacier', officialKm: 43.5, region: 'WA', typicalDays: '3-4 days', filePatterns: ['hoh-river', 'hoh_river', 'blue-glacier'] },
  { trailId: 'gothic_basin_trail', name: 'Gothic Basin Trail', officialKm: 15.3, region: 'WA', typicalDays: '1 day', filePatterns: ['gothic-basin', 'gothic_basin'] },
  { trailId: 'mount_adams_south_climb', name: 'Mount Adams South Climb', officialKm: 16.1, region: 'WA', typicalDays: '2 days', filePatterns: ['adams', 'south-climb'] },
  { trailId: 'enchanted_valley_via_graves_creek', name: 'Enchanted Valley via Graves Creek', officialKm: 43.5, region: 'WA', typicalDays: '3-4 days', filePatterns: ['enchanted-valley', 'graves-creek'] },
  { trailId: 'mount_hood_via_south_side_route', name: 'Mount Hood via South Side Route', officialKm: 14.5, region: 'OR', typicalDays: '1-2 days', filePatterns: ['mount-hood', 'south-side'] },

  // Montana
  { trailId: 'highline_trail_glacier_np', name: 'Highline Trail (Glacier NP)', officialKm: 19.2, region: 'MT', typicalDays: '1 day', filePatterns: ['highline'] },
  { trailId: 'grinnell_glacier_trail', name: 'Grinnell Glacier Trail', officialKm: 18.5, region: 'MT', typicalDays: '1 day', filePatterns: ['grinnell'] },
  { trailId: 'iceberg_lake_trail', name: 'Iceberg Lake Trail', officialKm: 15.4, region: 'MT', typicalDays: '1 day', filePatterns: ['iceberg-lake', 'iceberg_lake'] },
  { trailId: 'scenic_point_trail', name: 'Scenic Point Trail', officialKm: 11.7, region: 'MT', typicalDays: '1 day', filePatterns: ['scenic-point'] },
  { trailId: 'granite_peak_montana', name: 'Granite Peak Montana', officialKm: 32.2, region: 'MT', typicalDays: '2-3 days', filePatterns: ['granite-peak'] },

  // Colorado
  { trailId: 'four_pass_loop', name: 'Four Pass Loop', officialKm: 45.1, region: 'CO', typicalDays: '3-4 days', filePatterns: ['four-pass'] },
  { trailId: 'maroon_bells_crater_lake', name: 'Maroon Bells Crater Lake', officialKm: 6.1, region: 'CO', typicalDays: '1 day', filePatterns: ['maroon-bells', 'crater-lake'] },
  { trailId: 'chicago_basin_14ers_loop', name: 'Chicago Basin 14ers Loop', officialKm: 50.0, region: 'CO', typicalDays: '3-4 days', filePatterns: ['chicago-basin'] },
  { trailId: 'ice_lakes_basin', name: 'Ice Lakes Basin', officialKm: 11.3, region: 'CO', typicalDays: '1 day', filePatterns: ['ice-lake'] },
  { trailId: 'sky_pond_via_glacier_gorge', name: 'Sky Pond via Glacier Gorge', officialKm: 14.5, region: 'CO', typicalDays: '1 day', filePatterns: ['sky-pond'] },
  { trailId: 'conundrum_hot_springs', name: 'Conundrum Hot Springs', officialKm: 27.4, region: 'CO', typicalDays: '2 days', filePatterns: ['conundrum'] },
  { trailId: 'hanging_lake_trail', name: 'Hanging Lake Trail', officialKm: 4.8, region: 'CO', typicalDays: '1 day', filePatterns: ['hanging-lake'] },
  { trailId: 'mount_elbert_via_northeast_ridge', name: 'Mount Elbert via Northeast Ridge', officialKm: 14.5, region: 'CO', typicalDays: '1 day', filePatterns: ['elbert'] },
  { trailId: 'quandary_peak_east_ridge', name: 'Quandary Peak East Ridge', officialKm: 10.5, region: 'CO', typicalDays: '1 day', filePatterns: ['quandary'] },
  { trailId: 'devil_s_causeway', name: "Devil's Causeway", officialKm: 28.2, region: 'CO', typicalDays: '1-2 days', filePatterns: ['devils-causeway', 'devil-causeway'] },
  { trailId: 'capitol_peak_northeast_ridge', name: 'Capitol Peak Northeast Ridge', officialKm: 27.4, region: 'CO', typicalDays: '2 days', filePatterns: ['capitol-peak'] },
  { trailId: 'blue_lakes_trail', name: 'Blue Lakes Trail', officialKm: 11.3, region: 'CO', typicalDays: '1 day', filePatterns: ['blue-lake'] },

  // California
  { trailId: 'mount_shasta_via_avalanche_gulch', name: 'Mount Shasta via Avalanche Gulch', officialKm: 18.5, region: 'CA', typicalDays: '2 days', filePatterns: ['shasta', 'avalanche-gulch'] },
  { trailId: 'lassen_peak_trail', name: 'Lassen Peak Trail', officialKm: 8.0, region: 'CA', typicalDays: '1 day', filePatterns: ['lassen'] },
  { trailId: 'mount_tallac_trail', name: 'Mount Tallac Trail', officialKm: 15.8, region: 'CA', typicalDays: '1 day', filePatterns: ['tallac'] },
  { trailId: 'alamere_falls_via_coast_trail', name: 'Alamere Falls via Coast Trail', officialKm: 21.9, region: 'CA', typicalDays: '1 day', filePatterns: ['alamere'] },
  { trailId: 'mount_baldy_via_devil_s_backbone', name: "Mount Baldy via Devil's Backbone", officialKm: 17.7, region: 'CA', typicalDays: '1 day', filePatterns: ['baldy', 'devils-backbone'] },
  { trailId: 'mount_san_jacinto_via_marion_mountain', name: 'Mount San Jacinto via Marion Mountain', officialKm: 20.9, region: 'CA', typicalDays: '1 day', filePatterns: ['san-jacinto', 'marion'] },
  { trailId: 'cucamonga_peak_trail', name: 'Cucamonga Peak Trail', officialKm: 19.3, region: 'CA', typicalDays: '1 day', filePatterns: ['cucamonga'] },
  { trailId: 'horsetail_falls_trail', name: 'Horsetail Falls Trail', officialKm: 3.2, region: 'CA', typicalDays: '1 day', filePatterns: ['horsetail'] },
  { trailId: 'mount_dana_trail', name: 'Mount Dana Trail', officialKm: 9.7, region: 'CA', typicalDays: '1 day', filePatterns: ['dana'] },
  { trailId: 'mono_pass_trail_yosemite', name: 'Mono Pass Trail Yosemite', officialKm: 12.9, region: 'CA', typicalDays: '1 day', filePatterns: ['mono-pass'] },
  { trailId: 'moro_rock_trail', name: 'Moro Rock Trail', officialKm: 0.6, region: 'CA', typicalDays: '1 day', filePatterns: ['moro-rock'] },
  { trailId: 'big_baldy_trail', name: 'Big Baldy Trail', officialKm: 6.9, region: 'CA', typicalDays: '1 day', filePatterns: ['big-baldy'] },
  { trailId: 'mount_san_gorgonio_via_vivian_creek', name: 'Mount San Gorgonio via Vivian Creek', officialKm: 26.0, region: 'CA', typicalDays: '1-2 days', filePatterns: ['san-gorgonio', 'vivian'] },
  { trailId: 'cactus_to_clouds_trail', name: 'Cactus to Clouds Trail', officialKm: 33.8, region: 'CA', typicalDays: '1-2 days', filePatterns: ['cactus-to-clouds', 'skyline-palm'] },
  { trailId: 'telescope_peak_trail', name: 'Telescope Peak Trail', officialKm: 22.5, region: 'CA', typicalDays: '1-2 days', filePatterns: ['telescope'] },
  { trailId: 'north_dome_via_indian_rock', name: 'North Dome via Indian Rock', officialKm: 14.5, region: 'CA', typicalDays: '1 day', filePatterns: ['north-dome'] },
  { trailId: 'sentinel_dome_and_taft_point', name: 'Sentinel Dome and Taft Point', officialKm: 8.0, region: 'CA', typicalDays: '1 day', filePatterns: ['sentinel-dome', 'taft-point'] },
  { trailId: 'beartooth_traverse', name: 'Beartooth Traverse', officialKm: 48.3, region: 'MT-WY', typicalDays: '3-4 days', filePatterns: ['beartooth'] },
  { trailId: 'garfield_peak_trail', name: 'Garfield Peak Trail', officialKm: 5.6, region: 'OR', typicalDays: '1 day', filePatterns: ['garfield'] },
  { trailId: 'emory_peak_trail', name: 'Emory Peak Trail', officialKm: 16.0, region: 'TX', typicalDays: '1 day', filePatterns: ['emory'] },
];

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function totalDistance(coords: [number, number, number][]): number {
  let d = 0;
  for (let i = 1; i < coords.length; i++) {
    d += haversine(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
  }
  return d;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// Parse GPX file
function parseGPX(gpxContent: string): { coords: [number, number, number][]; hasElevation: boolean } {
  const coords: [number, number, number][] = [];
  let hasElevation = true;
  let match;

  // Try trkpt with elevation
  const trkptEleRegex = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>[\s\S]*?<ele>([^<]+)<\/ele>[\s\S]*?<\/trkpt>/gi;
  while ((match = trkptEleRegex.exec(gpxContent)) !== null) {
    coords.push([parseFloat(match[2]), parseFloat(match[1]), parseFloat(match[3])]);
  }

  // Try trkpt without elevation
  if (coords.length === 0) {
    hasElevation = false;
    const trkptRegex = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*/gi;
    while ((match = trkptRegex.exec(gpxContent)) !== null) {
      coords.push([parseFloat(match[2]), parseFloat(match[1]), 0]);
    }
  }

  // Try rtept
  if (coords.length === 0) {
    const rteptRegex = /<rtept\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>[\s\S]*?<\/rtept>/gi;
    while ((match = rteptRegex.exec(gpxContent)) !== null) {
      const eleMatch = match[0].match(/<ele>([^<]+)<\/ele>/i);
      coords.push([parseFloat(match[2]), parseFloat(match[1]), eleMatch ? parseFloat(eleMatch[1]) : 0]);
      if (!eleMatch) hasElevation = false;
    }
  }

  // Try wpt (waypoints)
  if (coords.length === 0) {
    const wptRegex = /<wpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>[\s\S]*?<\/wpt>/gi;
    while ((match = wptRegex.exec(gpxContent)) !== null) {
      const eleMatch = match[0].match(/<ele>([^<]+)<\/ele>/i);
      coords.push([parseFloat(match[2]), parseFloat(match[1]), eleMatch ? parseFloat(eleMatch[1]) : 0]);
      if (!eleMatch) hasElevation = false;
    }
  }

  return { coords, hasElevation };
}

// Enrich elevation via SRTM 30m
async function enrichElevation(coords: [number, number, number][]): Promise<[number, number, number][]> {
  const result = [...coords];
  const total = Math.ceil(coords.length / 100);
  for (let i = 0; i < coords.length; i += 100) {
    const batch = coords.slice(i, i + 100);
    const locations = batch.map(c => `${c[1]},${c[0]}`).join('|');
    try {
      const res = await fetch(`${TOPO_API}?locations=${locations}`);
      if (res.ok) {
        const data = await res.json();
        for (let j = 0; j < batch.length; j++) {
          const ele = data.results?.[j]?.elevation ?? 0;
          result[i + j] = [batch[j][0], batch[j][1], Math.round(ele)];
        }
      }
    } catch {}
    await sleep(1100);
    if ((i / 100 + 1) % 50 === 0) {
      console.log(`    Elevation: ${Math.min(i / 100 + 1, total)}/${total} batches`);
    }
  }
  return result;
}

// Match a GPX filename to a trail mapping
function matchGPXToTrail(filename: string): TrailMapping | null {
  // Normalize: replace underscores with hyphens for matching
  const lower = filename.toLowerCase().replace(/_/g, '-');
  for (const mapping of TRAIL_MAPPINGS) {
    for (const pattern of mapping.filePatterns) {
      if (lower.includes(pattern)) {
        return mapping;
      }
    }
    // Also try matching by trail ID (for fkt-{trailId}.gpx files)
    if (lower.includes(mapping.trailId.replace(/_/g, '-'))) {
      return mapping;
    }
  }
  return null;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`=== INTEGRATE US TRAIL GPX FILES ===${dryRun ? ' (DRY RUN)' : ''}\n`);

  // Scan ~/Downloads for GPX files
  let gpxFiles: string[];
  try {
    gpxFiles = readdirSync(DOWNLOADS_DIR)
      .filter(f => f.toLowerCase().endsWith('.gpx'))
      .sort();
  } catch {
    console.log(`Could not read ${DOWNLOADS_DIR}`);
    return;
  }

  console.log(`Found ${gpxFiles.length} GPX files in ~/Downloads\n`);

  // Check which trails still need data
  const needed = new Set<string>();
  for (const m of TRAIL_MAPPINGS) {
    if (!existsSync(join(TRAIL_DATA_DIR, `${m.trailId}.json`))) {
      needed.add(m.trailId);
    }
  }
  console.log(`Trails still needing GPX: ${needed.size}/${TRAIL_MAPPINGS.length}\n`);

  // Match GPX files to trails
  const matched: { file: string; mapping: TrailMapping }[] = [];
  const unmatched: string[] = [];

  for (const file of gpxFiles) {
    const mapping = matchGPXToTrail(file);
    if (mapping) {
      matched.push({ file, mapping });
    } else {
      unmatched.push(file);
    }
  }

  if (matched.length === 0) {
    console.log('No GPX files matched any needed trail.');
    console.log('\nTo integrate trails, download GPX files from FKT (fastestknowntime.com)');
    console.log('and place them in ~/Downloads. The script matches by filename patterns.\n');
    console.log('Still needed:');
    for (const m of TRAIL_MAPPINGS) {
      const status = needed.has(m.trailId) ? 'NEED' : 'HAVE';
      console.log(`  ${status.padEnd(5)} ${m.name.padEnd(45)} (match: ${m.filePatterns.join(', ')})`);
    }
    return;
  }

  console.log(`Matched ${matched.length} GPX files:\n`);

  const results: { name: string; km: number; official: number; pts: number; status: string }[] = [];

  for (const { file, mapping } of matched) {
    console.log(`[${file}] → ${mapping.name}`);

    const gpxContent = readFileSync(join(DOWNLOADS_DIR, file), 'utf-8');
    const { coords, hasElevation } = parseGPX(gpxContent);

    if (coords.length < 5) {
      console.log(`  Only ${coords.length} points — skipping\n`);
      continue;
    }

    console.log(`  Parsed: ${coords.length} pts, elevation: ${hasElevation ? 'GPS' : 'MISSING'}`);

    let finalCoords = coords;
    if (!hasElevation) {
      if (dryRun) {
        console.log(`  Would fetch SRTM elevation for ${coords.length} points`);
      } else {
        console.log(`  Fetching SRTM elevation for ${coords.length} points...`);
        finalCoords = await enrichElevation(coords);
      }
    }

    const km = totalDistance(finalCoords);
    const errPct = Math.abs(km - mapping.officialKm) / mapping.officialKm * 100;
    const status = errPct <= 5 ? 'OK' : errPct <= 25 ? 'FAIR' : 'HIGH';

    console.log(`  Distance: ${km.toFixed(1)}km (${errPct.toFixed(1)}% off ${mapping.officialKm}km official) [${status}]`);

    if (!dryRun) {
      const elevs = finalCoords.map(c => c[2]);
      const trailData = {
        id: mapping.trailId,
        name: mapping.name,
        region: mapping.region,
        country: 'US',
        distance_km: mapping.officialKm,
        typical_days: mapping.typicalDays,
        coordinates: finalCoords,
        dataSource: 'gpx_user',
        calculatedKm: km,
      };

      const trailPath = join(TRAIL_DATA_DIR, `${mapping.trailId}.json`);
      writeFileSync(trailPath, JSON.stringify(trailData, null, 2));

      // Update manifest
      const manifestPath = join(TRAIL_DATA_DIR, 'manifest.json');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      const existingIdx = manifest.findIndex((m: any) => m.id === mapping.trailId);
      if (existingIdx >= 0) manifest.splice(existingIdx, 1);

      manifest.push({
        id: mapping.trailId,
        name: mapping.name,
        region: mapping.region,
        country: 'US',
        distance_km: mapping.officialKm,
        typical_days: mapping.typicalDays,
        pointCount: finalCoords.length,
        dataSource: 'gpx_user',
        calculatedKm: km,
        elevationLow: elevs.reduce((a, b) => a < b ? a : b, Infinity),
        elevationHigh: elevs.reduce((a, b) => a > b ? a : b, -Infinity),
      });

      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      console.log(`  SAVED\n`);
    } else {
      console.log(`  Would save to ${mapping.trailId}.json\n`);
    }

    results.push({ name: mapping.name, km, official: mapping.officialKm, pts: finalCoords.length, status });
  }

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Integrated: ${results.length}`);
  for (const r of results) {
    const errPct = (Math.abs(r.km - r.official) / r.official * 100).toFixed(1);
    console.log(`  ${r.status.padEnd(5)} ${r.name.padEnd(45)} ${(r.km.toFixed(1) + 'km').padStart(10)} / ${(r.official + 'km').padStart(7)}  ${r.pts} pts  ${errPct}%`);
  }

  if (unmatched.length > 0) {
    console.log(`\nUnmatched GPX files: ${unmatched.join(', ')}`);
  }

  // Show remaining needs
  const remaining = TRAIL_MAPPINGS.filter(m =>
    !results.some(r => r.name === m.name) && !existsSync(join(TRAIL_DATA_DIR, `${m.trailId}.json`))
  );
  if (remaining.length > 0) {
    console.log(`\nStill need GPX (${remaining.length} trails):`);
    for (const m of remaining) {
      console.log(`  ${m.name} (${m.officialKm}km, ${m.region})`);
    }
  }
}

main().catch(console.error);
