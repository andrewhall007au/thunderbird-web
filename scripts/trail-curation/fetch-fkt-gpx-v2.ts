// Fetch GPX files from FKT route pages with KNOWN URLs
// Usage: npx tsx scripts/trail-curation/fetch-fkt-gpx-v2.ts [--dry-run]

import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const DOWNLOADS_DIR = join(process.env.HOME || '', 'Downloads');
const TRAIL_DATA_DIR = join(process.cwd(), 'public', 'trail-data');
const FKT_BASE = 'https://fastestknowntime.com';

interface FktRoute {
  trailId: string;
  name: string;
  fktPath: string; // route path on FKT
}

// Known FKT route URLs found via web search
const FKT_ROUTES: FktRoute[] = [
  // Utah
  { trailId: 'the_narrows', name: 'The Narrows', fktPath: '/route/virgin-river-narrows-zion-np-ut' },
  { trailId: 'the_subway_at_zion', name: 'The Subway', fktPath: '/route/the-subway-zion-ut' },
  { trailId: 'observation_point_via_east_mesa', name: 'Observation Point', fktPath: '/route/observation-point-zion-national-park-ut' },
  { trailId: 'kings_peak_via_henrys_fork', name: 'Kings Peak', fktPath: '/route/kings-peak-ut' },
  { trailId: 'buckskin_gulch', name: 'Buckskin Gulch', fktPath: '/route/buckskin-paria-canyons-ut' },

  // Arizona
  { trailId: 'humphreys_peak_trail', name: 'Humphreys Peak', fktPath: '/route/humphreys-peak-az' },

  // East Coast
  { trailId: 'old_rag_mountain_loop', name: 'Old Rag Mountain', fktPath: '/route/old-rag-mtn-va' },
  { trailId: 'presidential_traverse', name: 'Presidential Traverse', fktPath: '/route/presidential-traverse-nh' },

  // Montana
  { trailId: 'highline_trail_glacier_np', name: 'Highline Trail', fktPath: '/route/highline-logans-pass-waterton-lake' },
  { trailId: 'granite_peak_montana', name: 'Granite Peak', fktPath: '/route/granite-peak-mt' },

  // Colorado
  { trailId: 'quandary_peak_east_ridge', name: 'Quandary Peak', fktPath: '/route/quandary-peak-co' },
  { trailId: 'capitol_peak_northeast_ridge', name: 'Capitol Peak', fktPath: '/route/capitol-peak-co' },
  { trailId: 'chicago_basin_14ers_loop', name: 'Chicago Basin 14ers', fktPath: '/route/sunlight-windom-eolus-co' },
  { trailId: 'emory_peak_trail', name: 'Emory Peak', fktPath: '/route/emory-peak-tx' },

  // Washington
  { trailId: 'enchantments_thru_hike', name: 'Enchantments Traverse', fktPath: '/route/enchantment-lakes-traverse-wa' },
  { trailId: 'hoh_river_to_blue_glacier', name: 'Hoh River Trail', fktPath: '/route/hoh-river-trail-blue-glacier' },
  { trailId: 'enchanted_valley_via_graves_creek', name: 'Enchanted Valley', fktPath: '/route/anderson-glacier-enchanted-valley' },
  { trailId: 'mount_adams_south_climb', name: 'Mount Adams', fktPath: '/route/mount-adams-traverse-wa' },

  // Oregon
  { trailId: 'mount_hood_via_south_side_route', name: 'Mount Hood', fktPath: '/route/mt-hood-or' },

  // California
  { trailId: 'mount_shasta_via_avalanche_gulch', name: 'Mount Shasta', fktPath: '/route/mt-shasta-ca' },
  { trailId: 'lassen_peak_trail', name: 'Lassen Peak', fktPath: '/route/lassen-peak-ca' },
  { trailId: 'mount_baldy_via_devil_s_backbone', name: 'Mount Baldy', fktPath: '/route/mt-baldy-ca' },
  { trailId: 'mount_san_jacinto_via_marion_mountain', name: 'San Jacinto Peak', fktPath: '/route/san-jacinto-peak-ca' },
  { trailId: 'telescope_peak_trail', name: 'Telescope Peak', fktPath: '/route/telescope-peak-ca' },
];

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function extractGpxUrl(html: string): string | null {
  // Look for /system/files/routes/gps_data/*.gpx links
  const match = html.match(/href="([^"]*\/system\/files\/routes\/gps_data\/[^"]+\.gpx)"/i);
  if (match) return match[1];
  // Try broader .gpx link
  const match2 = html.match(/href="([^"]*\.gpx[^"]*)"/i);
  if (match2 && !match2[1].includes('javascript')) return match2[1];
  return null;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`=== FETCH GPX FROM FKT (known URLs) ===${dryRun ? ' (DRY RUN)' : ''}\n`);

  // Skip trails that already have data
  const routes = FKT_ROUTES.filter(r => {
    if (existsSync(join(TRAIL_DATA_DIR, `${r.trailId}.json`))) {
      console.log(`  SKIP ${r.name} — already has data`);
      return false;
    }
    return true;
  });

  console.log(`\nRoutes to check: ${routes.length}\n`);

  let downloaded = 0;
  let noGpx = 0;
  let failed = 0;

  for (const route of routes) {
    const url = `${FKT_BASE}${route.fktPath}`;
    console.log(`--- ${route.name} ---`);
    console.log(`  Page: ${url}`);

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; trail-curation/1.0)' },
      });

      if (!res.ok) {
        console.log(`  HTTP ${res.status} — skipping`);
        failed++;
        await sleep(1500);
        continue;
      }

      const html = await res.text();
      const gpxUrl = extractGpxUrl(html);

      if (!gpxUrl) {
        console.log(`  Route page found but NO GPX file`);
        noGpx++;
        await sleep(1500);
        continue;
      }

      const fullGpxUrl = gpxUrl.startsWith('/') ? `${FKT_BASE}${gpxUrl}` : gpxUrl;
      console.log(`  GPX: ${fullGpxUrl}`);

      if (!dryRun) {
        const gpxRes = await fetch(fullGpxUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; trail-curation/1.0)' },
        });

        if (gpxRes.ok) {
          const gpxContent = await gpxRes.text();
          const filename = `fkt-${route.trailId}.gpx`;
          writeFileSync(join(DOWNLOADS_DIR, filename), gpxContent);
          console.log(`  SAVED → ~/Downloads/${filename} (${(gpxContent.length / 1024).toFixed(1)}KB)`);
          downloaded++;
        } else {
          console.log(`  Download failed: HTTP ${gpxRes.status}`);
          failed++;
        }
      } else {
        console.log(`  Would save to ~/Downloads/fkt-${route.trailId}.gpx`);
        downloaded++;
      }
    } catch (e: any) {
      console.log(`  Error: ${e.message}`);
      failed++;
    }

    await sleep(1500);
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Downloaded: ${downloaded}`);
  console.log(`No GPX on page: ${noGpx}`);
  console.log(`Failed/404: ${failed}`);
}

main().catch(console.error);
