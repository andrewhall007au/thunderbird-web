// Fetch GPX files from FKT (fastestknowntime.com) for missing US trails
// Searches for route pages, extracts GPX download URLs, saves to ~/Downloads
// Usage: npx tsx scripts/trail-curation/fetch-fkt-gpx.ts [--dry-run] [--trail NAME]

import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const DOWNLOADS_DIR = join(process.env.HOME || '', 'Downloads');
const TRAIL_DATA_DIR = join(process.cwd(), 'public', 'trail-data');
const FKT_BASE = 'https://fastestknowntime.com';

interface TrailSearch {
  trailId: string;
  name: string;
  fktSearchTerms: string[]; // terms to try in FKT route URL slugs
  officialKm: number;
  region: string;
}

// Map each missing trail to FKT search terms (URL slug patterns)
const TRAILS: TrailSearch[] = [
  // Utah
  { trailId: 'the_narrows', name: 'The Narrows', fktSearchTerms: ['narrows-zion', 'the-narrows-ut', 'narrows-ut'], officialKm: 16.0, region: 'UT' },
  { trailId: 'delicate_arch_trail', name: 'Delicate Arch Trail', fktSearchTerms: ['delicate-arch'], officialKm: 4.8, region: 'UT' },
  { trailId: 'observation_point_via_east_mesa', name: 'Observation Point', fktSearchTerms: ['observation-point-zion', 'observation-point-ut'], officialKm: 12.9, region: 'UT' },
  { trailId: 'wave_via_wire_pass', name: 'Wave via Wire Pass', fktSearchTerms: ['wave-az', 'wire-pass'], officialKm: 9.7, region: 'AZ' },
  { trailId: 'peek_a_boo_loop_bryce', name: 'Peek-a-Boo Loop Bryce', fktSearchTerms: ['peek-a-boo-bryce', 'peekaboo-bryce'], officialKm: 8.9, region: 'UT' },
  { trailId: 'kings_peak_via_henrys_fork', name: 'Kings Peak', fktSearchTerms: ['kings-peak-ut', 'kings-peak'], officialKm: 44.3, region: 'UT' },
  { trailId: 'buckskin_gulch', name: 'Buckskin Gulch', fktSearchTerms: ['buckskin-gulch'], officialKm: 32.2, region: 'UT' },
  { trailId: 'mesa_arch_trail', name: 'Mesa Arch Trail', fktSearchTerms: ['mesa-arch'], officialKm: 0.8, region: 'UT' },

  // Arizona
  { trailId: 'havasu_falls', name: 'Havasu Falls', fktSearchTerms: ['havasu-falls', 'havasupai'], officialKm: 16.1, region: 'AZ' },
  { trailId: 'west_fork_oak_creek', name: 'West Fork Oak Creek', fktSearchTerms: ['west-fork-oak-creek', 'oak-creek-az'], officialKm: 11.3, region: 'AZ' },
  { trailId: 'cathedral_rock_trail', name: 'Cathedral Rock Trail', fktSearchTerms: ['cathedral-rock-az', 'cathedral-rock-sedona'], officialKm: 2.4, region: 'AZ' },
  { trailId: 'humphreys_peak_trail', name: 'Humphreys Peak', fktSearchTerms: ['humphreys-peak-az', 'humphreys-peak'], officialKm: 15.4, region: 'AZ' },

  // Hawaii
  { trailId: 'kalepa_ridge_trail', name: 'Kalepa Ridge', fktSearchTerms: ['kalepa-ridge'], officialKm: 3.2, region: 'HI' },
  { trailId: 'haleakala_sliding_sands_trail', name: 'Haleakala Sliding Sands', fktSearchTerms: ['sliding-sands', 'haleakala'], officialKm: 17.7, region: 'HI' },
  { trailId: 'koko_crater_trail', name: 'Koko Crater', fktSearchTerms: ['koko-crater', 'koko-head'], officialKm: 2.7, region: 'HI' },

  // East Coast
  { trailId: 'old_rag_mountain_loop', name: 'Old Rag Mountain', fktSearchTerms: ['old-rag-mtn-va', 'old-rag-va'], officialKm: 14.5, region: 'VA' },
  { trailId: 'presidential_traverse', name: 'Presidential Traverse', fktSearchTerms: ['presidential-traverse-nh', 'presidential-traverse'], officialKm: 37.0, region: 'NH' },
  { trailId: 'mount_katahdin_via_hunt_trail', name: 'Mount Katahdin', fktSearchTerms: ['katahdin-me', 'mount-katahdin', 'katahdin-hunt-trail'], officialKm: 16.7, region: 'ME' },
  { trailId: 'the_subway_at_zion', name: 'The Subway Zion', fktSearchTerms: ['subway-zion', 'the-subway-ut'], officialKm: 15.4, region: 'UT' },

  // Wyoming
  { trailId: 'cascade_canyon_to_lake_solitude', name: 'Cascade Canyon', fktSearchTerms: ['cascade-canyon-wy', 'lake-solitude-wy'], officialKm: 30.6, region: 'WY' },

  // Washington
  { trailId: 'enchantments_thru_hike', name: 'Enchantments Thru-Hike', fktSearchTerms: ['enchantment-lakes-traverse-wa', 'enchantments-wa'], officialKm: 29.8, region: 'WA' },
  { trailId: 'hoh_river_to_blue_glacier', name: 'Hoh River to Blue Glacier', fktSearchTerms: ['hoh-river-trail', 'hoh-river-wa', 'blue-glacier-wa'], officialKm: 43.5, region: 'WA' },
  { trailId: 'gothic_basin_trail', name: 'Gothic Basin', fktSearchTerms: ['gothic-basin-wa'], officialKm: 15.3, region: 'WA' },
  { trailId: 'mount_adams_south_climb', name: 'Mount Adams', fktSearchTerms: ['mount-adams-wa', 'mt-adams-wa'], officialKm: 16.1, region: 'WA' },
  { trailId: 'enchanted_valley_via_graves_creek', name: 'Enchanted Valley', fktSearchTerms: ['enchanted-valley-wa', 'graves-creek-wa'], officialKm: 43.5, region: 'WA' },
  { trailId: 'mount_hood_via_south_side_route', name: 'Mount Hood', fktSearchTerms: ['mount-hood-or', 'mt-hood-or'], officialKm: 14.5, region: 'OR' },

  // Montana
  { trailId: 'highline_trail_glacier_np', name: 'Highline Trail Glacier', fktSearchTerms: ['highline-trail-glacier', 'highline-trail-mt'], officialKm: 19.2, region: 'MT' },
  { trailId: 'grinnell_glacier_trail', name: 'Grinnell Glacier', fktSearchTerms: ['grinnell-glacier-mt', 'grinnell-glacier'], officialKm: 18.5, region: 'MT' },
  { trailId: 'iceberg_lake_trail', name: 'Iceberg Lake', fktSearchTerms: ['iceberg-lake-mt', 'iceberg-lake'], officialKm: 15.4, region: 'MT' },
  { trailId: 'scenic_point_trail', name: 'Scenic Point', fktSearchTerms: ['scenic-point-mt'], officialKm: 11.7, region: 'MT' },
  { trailId: 'granite_peak_montana', name: 'Granite Peak', fktSearchTerms: ['granite-peak-mt', 'granite-peak-montana'], officialKm: 32.2, region: 'MT' },

  // Colorado
  { trailId: 'four_pass_loop', name: 'Four Pass Loop', fktSearchTerms: ['four-pass-loop-co', 'four-pass-loop'], officialKm: 45.1, region: 'CO' },
  { trailId: 'maroon_bells_crater_lake', name: 'Maroon Bells', fktSearchTerms: ['maroon-bells-co', 'crater-lake-co'], officialKm: 6.1, region: 'CO' },
  { trailId: 'chicago_basin_14ers_loop', name: 'Chicago Basin', fktSearchTerms: ['chicago-basin-co'], officialKm: 50.0, region: 'CO' },
  { trailId: 'ice_lakes_basin', name: 'Ice Lakes Basin', fktSearchTerms: ['ice-lakes-co', 'ice-lake-basin-co'], officialKm: 11.3, region: 'CO' },
  { trailId: 'sky_pond_via_glacier_gorge', name: 'Sky Pond', fktSearchTerms: ['sky-pond-co', 'glacier-gorge-co'], officialKm: 14.5, region: 'CO' },
  { trailId: 'conundrum_hot_springs', name: 'Conundrum Hot Springs', fktSearchTerms: ['conundrum-hot-springs', 'conundrum-co'], officialKm: 27.4, region: 'CO' },
  { trailId: 'hanging_lake_trail', name: 'Hanging Lake', fktSearchTerms: ['hanging-lake-co', 'hanging-lake'], officialKm: 4.8, region: 'CO' },
  { trailId: 'mount_elbert_via_northeast_ridge', name: 'Mount Elbert', fktSearchTerms: ['mount-elbert-co', 'mt-elbert-co', 'elbert-co'], officialKm: 14.5, region: 'CO' },
  { trailId: 'quandary_peak_east_ridge', name: 'Quandary Peak', fktSearchTerms: ['quandary-peak-co', 'quandary-co'], officialKm: 10.5, region: 'CO' },
  { trailId: 'devil_s_causeway', name: "Devil's Causeway", fktSearchTerms: ['devils-causeway-co'], officialKm: 28.2, region: 'CO' },
  { trailId: 'capitol_peak_northeast_ridge', name: 'Capitol Peak', fktSearchTerms: ['capitol-peak-co', 'capitol-peak'], officialKm: 27.4, region: 'CO' },
  { trailId: 'blue_lakes_trail', name: 'Blue Lakes', fktSearchTerms: ['blue-lakes-co', 'blue-lake-co'], officialKm: 11.3, region: 'CO' },

  // California
  { trailId: 'mount_shasta_via_avalanche_gulch', name: 'Mount Shasta', fktSearchTerms: ['mount-shasta-ca', 'mt-shasta-ca', 'shasta-avalanche-gulch'], officialKm: 18.5, region: 'CA' },
  { trailId: 'lassen_peak_trail', name: 'Lassen Peak', fktSearchTerms: ['lassen-peak-ca', 'lassen-peak'], officialKm: 8.0, region: 'CA' },
  { trailId: 'mount_tallac_trail', name: 'Mount Tallac', fktSearchTerms: ['mount-tallac-ca', 'tallac-ca'], officialKm: 15.8, region: 'CA' },
  { trailId: 'alamere_falls_via_coast_trail', name: 'Alamere Falls', fktSearchTerms: ['alamere-falls-ca', 'alamere-falls'], officialKm: 21.9, region: 'CA' },
  { trailId: 'mount_baldy_via_devil_s_backbone', name: 'Mount Baldy', fktSearchTerms: ['mount-baldy-ca', 'mt-baldy-ca'], officialKm: 17.7, region: 'CA' },
  { trailId: 'mount_san_jacinto_via_marion_mountain', name: 'Mount San Jacinto', fktSearchTerms: ['san-jacinto-ca', 'mount-san-jacinto'], officialKm: 20.9, region: 'CA' },
  { trailId: 'cucamonga_peak_trail', name: 'Cucamonga Peak', fktSearchTerms: ['cucamonga-peak-ca', 'cucamonga-ca'], officialKm: 19.3, region: 'CA' },
  { trailId: 'horsetail_falls_trail', name: 'Horsetail Falls', fktSearchTerms: ['horsetail-falls-ca'], officialKm: 3.2, region: 'CA' },
  { trailId: 'mount_dana_trail', name: 'Mount Dana', fktSearchTerms: ['mount-dana-ca', 'mt-dana-ca'], officialKm: 9.7, region: 'CA' },
  { trailId: 'mono_pass_trail_yosemite', name: 'Mono Pass', fktSearchTerms: ['mono-pass-ca'], officialKm: 12.9, region: 'CA' },
  { trailId: 'moro_rock_trail', name: 'Moro Rock', fktSearchTerms: ['moro-rock-ca'], officialKm: 0.6, region: 'CA' },
  { trailId: 'big_baldy_trail', name: 'Big Baldy', fktSearchTerms: ['big-baldy-ca'], officialKm: 6.9, region: 'CA' },
  { trailId: 'mount_san_gorgonio_via_vivian_creek', name: 'Mount San Gorgonio', fktSearchTerms: ['san-gorgonio-ca', 'mount-san-gorgonio'], officialKm: 26.0, region: 'CA' },
  { trailId: 'cactus_to_clouds_trail', name: 'Cactus to Clouds', fktSearchTerms: ['cactus-to-clouds', 'skyline-trail-palm-springs'], officialKm: 33.8, region: 'CA' },
  { trailId: 'telescope_peak_trail', name: 'Telescope Peak', fktSearchTerms: ['telescope-peak-ca', 'telescope-peak'], officialKm: 22.5, region: 'CA' },
  { trailId: 'north_dome_via_indian_rock', name: 'North Dome', fktSearchTerms: ['north-dome-ca', 'north-dome-yosemite'], officialKm: 14.5, region: 'CA' },
  { trailId: 'sentinel_dome_and_taft_point', name: 'Sentinel Dome', fktSearchTerms: ['sentinel-dome-ca', 'taft-point-ca'], officialKm: 8.0, region: 'CA' },

  // Other
  { trailId: 'beartooth_traverse', name: 'Beartooth Traverse', fktSearchTerms: ['beartooth-traverse', 'beartooth-mt'], officialKm: 48.3, region: 'MT-WY' },
  { trailId: 'garfield_peak_trail', name: 'Garfield Peak', fktSearchTerms: ['garfield-peak-or', 'garfield-peak-crater-lake'], officialKm: 5.6, region: 'OR' },
  { trailId: 'emory_peak_trail', name: 'Emory Peak', fktSearchTerms: ['emory-peak-tx', 'emory-peak'], officialKm: 16.0, region: 'TX' },
];

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// Extract GPX URL from HTML content
function extractGpxUrl(html: string): string | null {
  // Look for /system/files/routes/gps_data/*.gpx links
  const match = html.match(/href="([^"]*\/system\/files\/routes\/gps_data\/[^"]+\.gpx)"/i);
  if (match) return match[1];

  // Also try broader .gpx link pattern
  const match2 = html.match(/href="([^"]*\.gpx)"/i);
  if (match2) return match2[1];

  return null;
}

async function fetchWithRetry(url: string, retries = 2): Promise<Response | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; trail-curation/1.0)' },
        redirect: 'follow',
      });
      return res;
    } catch {
      if (i < retries) await sleep(2000);
    }
  }
  return null;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const trailFilter = process.argv.find(a => a.startsWith('--trail='))?.split('=')[1]?.toLowerCase();

  console.log(`=== FETCH GPX FROM FKT ===${dryRun ? ' (DRY RUN)' : ''}\n`);

  let trails = TRAILS;

  // Skip trails that already have data files
  trails = trails.filter(t => {
    const exists = existsSync(join(TRAIL_DATA_DIR, `${t.trailId}.json`));
    if (exists) {
      console.log(`  SKIP ${t.name} — already has data`);
    }
    return !exists;
  });

  if (trailFilter) {
    trails = trails.filter(t => t.name.toLowerCase().includes(trailFilter));
  }

  console.log(`\nTrails to fetch: ${trails.length}\n`);

  let found = 0;
  let notFound = 0;
  const results: { name: string; status: string; gpxUrl?: string }[] = [];

  for (const trail of trails) {
    console.log(`\n--- ${trail.name} (${trail.region}) ---`);

    let gpxUrl: string | null = null;
    let routeUrl: string | null = null;

    // Try each search term as a route URL slug
    for (const slug of trail.fktSearchTerms) {
      const url = `${FKT_BASE}/route/${slug}`;
      console.log(`  Trying ${url}...`);

      const res = await fetchWithRetry(url);
      if (!res) {
        console.log(`    Network error`);
        continue;
      }

      if (res.status === 200) {
        const html = await res.text();
        gpxUrl = extractGpxUrl(html);
        routeUrl = url;
        if (gpxUrl) {
          console.log(`    FOUND route page + GPX`);
          break;
        } else {
          console.log(`    Route page found but NO GPX file`);
          // Still useful to know the route exists
        }
      } else if (res.status === 404) {
        console.log(`    404`);
      } else {
        console.log(`    HTTP ${res.status}`);
      }

      await sleep(1500); // Be polite
    }

    if (gpxUrl) {
      // Make absolute URL if needed
      if (gpxUrl.startsWith('/')) {
        gpxUrl = `${FKT_BASE}${gpxUrl}`;
      }

      console.log(`  GPX: ${gpxUrl}`);

      if (!dryRun) {
        const gpxRes = await fetchWithRetry(gpxUrl);
        if (gpxRes && gpxRes.ok) {
          const gpxContent = await gpxRes.text();
          const filename = `fkt-${trail.trailId}.gpx`;
          const outPath = join(DOWNLOADS_DIR, filename);
          writeFileSync(outPath, gpxContent);
          console.log(`  SAVED → ~/Downloads/${filename} (${(gpxContent.length / 1024).toFixed(1)}KB)`);
          found++;
          results.push({ name: trail.name, status: 'DOWNLOADED', gpxUrl });
        } else {
          console.log(`  Failed to download GPX`);
          results.push({ name: trail.name, status: 'DL_FAILED', gpxUrl });
        }
      } else {
        console.log(`  Would download to ~/Downloads/fkt-${trail.trailId}.gpx`);
        found++;
        results.push({ name: trail.name, status: 'FOUND', gpxUrl });
      }
    } else if (routeUrl) {
      console.log(`  Route page found but no GPX: ${routeUrl}`);
      results.push({ name: trail.name, status: 'NO_GPX' });
      notFound++;
    } else {
      console.log(`  NOT FOUND on FKT`);
      results.push({ name: trail.name, status: 'NOT_FOUND' });
      notFound++;
    }

    await sleep(1500); // Rate limit politeness
  }

  // Summary
  console.log(`\n\n=== SUMMARY ===`);
  console.log(`Found GPX: ${found}`);
  console.log(`Not found: ${notFound}\n`);

  for (const r of results) {
    const icon = r.status === 'DOWNLOADED' || r.status === 'FOUND' ? 'OK' : '  ';
    console.log(`  ${icon} ${r.status.padEnd(12)} ${r.name}`);
  }
}

main().catch(console.error);
