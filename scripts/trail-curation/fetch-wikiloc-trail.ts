// Fetch trail coordinates from Wikiloc by rendering the page and extracting Leaflet polyline data
// Usage: npx tsx scripts/trail-curation/fetch-wikiloc-trail.ts <wikiloc-url> [output-file]
import { chromium } from 'playwright';
import * as fs from 'fs';

async function extractTrailCoords(url: string): Promise<Array<[number, number, number]>> {
  console.log(`Fetching ${url}...`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

    // Wait for Leaflet map to load
    await page.waitForTimeout(3000);

    // Try to extract coordinates from Leaflet map
    const coords = await page.evaluate(() => {
      // Look for Leaflet map instance
      const mapContainers = document.querySelectorAll('.leaflet-container');
      if (mapContainers.length === 0) return { error: 'No Leaflet container found' };

      // Try to find the map object on any element
      let map: any = null;
      for (const el of mapContainers) {
        if ((el as any)._leaflet_map) {
          map = (el as any)._leaflet_map;
          break;
        }
        // Try underscore convention
        const id = (el as any)._leaflet_id;
        if (id && (window as any).L && (window as any).L.Map) {
          map = (el as any)._leaflet;
          break;
        }
      }

      // Alternative: search all window properties for Leaflet map
      if (!map) {
        for (const key of Object.keys(window)) {
          const val = (window as any)[key];
          if (val && val._container && val.getCenter && typeof val.eachLayer === 'function') {
            map = val;
            break;
          }
        }
      }

      if (!map) {
        // Try to find map via L.map instances
        const allMaps: any[] = [];
        if ((window as any).L) {
          // Check for stored map references
          document.querySelectorAll('[id]').forEach(el => {
            const m = (window as any).L.DomUtil.get(el.id);
            if (m && (m as any)._leaflet_id) {
              allMaps.push(el.id);
            }
          });
        }
        return { error: 'No map instance found', containers: mapContainers.length, allMaps };
      }

      // Extract polyline layers
      const coords: number[][] = [];
      map.eachLayer((layer: any) => {
        if (layer.getLatLngs) {
          const latlngs = layer.getLatLngs();
          // Could be flat array or nested
          const flat = Array.isArray(latlngs[0]) && typeof latlngs[0][0] !== 'number'
            ? latlngs.flat()
            : latlngs;

          for (const ll of flat) {
            if (ll.lat !== undefined && ll.lng !== undefined) {
              coords.push([ll.lng, ll.lat, ll.alt || 0]);
            }
          }
        }
      });

      return { coords, numLayers: 0 };
    });

    if ('error' in coords) {
      console.log('Direct Leaflet extraction failed:', coords);

      // Fallback: try to intercept the decoded coordinates from JavaScript
      const coords2 = await page.evaluate(() => {
        // Look for mapData in window scope
        const mapData = (window as any).mapData;
        if (mapData) {
          return { mapData: JSON.stringify(mapData).substring(0, 2000) };
        }

        // Look for any large arrays of coordinate-like objects
        const found: any = {};
        for (const key of Object.keys(window)) {
          const val = (window as any)[key];
          if (Array.isArray(val) && val.length > 10) {
            const first = val[0];
            if (first && typeof first.lat === 'number') {
              found[key] = val.length;
            }
          }
        }
        return { windowVars: found };
      });
      console.log('Window data:', JSON.stringify(coords2).substring(0, 1000));

      // Try extracting SVG path data (Leaflet renders as SVG)
      const svgData = await page.evaluate(() => {
        const paths = document.querySelectorAll('.leaflet-overlay-pane path');
        if (paths.length > 0) {
          const d = (paths[0] as SVGPathElement).getAttribute('d');
          return { pathCount: paths.length, firstPath: d?.substring(0, 500), fullLength: d?.length };
        }
        return { pathCount: 0 };
      });
      console.log('SVG paths:', JSON.stringify(svgData).substring(0, 500));

      await browser.close();
      return [];
    }

    console.log(`Extracted ${(coords as any).coords?.length || 0} coordinates`);
    await browser.close();
    return (coords as any).coords || [];

  } catch (err) {
    console.error('Error:', err);
    await browser.close();
    return [];
  }
}

async function main() {
  const url = process.argv[2] || 'https://www.wikiloc.com/hiking-trails/hartz-peak-89930644';
  const outputFile = process.argv[3];

  const coords = await extractTrailCoords(url);

  if (coords.length > 0) {
    console.log(`\nGot ${coords.length} coordinates`);
    console.log(`First: [${coords[0].map(v => v.toFixed(6)).join(', ')}]`);
    console.log(`Last: [${coords[coords.length-1].map(v => v.toFixed(6)).join(', ')}]`);

    // Calculate distance
    let dist = 0;
    for (let i = 1; i < coords.length; i++) {
      const dLat = (coords[i][1] - coords[i-1][1]) * Math.PI / 180;
      const dLng = (coords[i][0] - coords[i-1][0]) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(coords[i-1][1]*Math.PI/180) * Math.cos(coords[i][1]*Math.PI/180) * Math.sin(dLng/2)**2;
      dist += 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }
    console.log(`Distance: ${dist.toFixed(2)} km`);

    if (outputFile) {
      fs.writeFileSync(outputFile, JSON.stringify(coords, null, 2));
      console.log(`Saved to ${outputFile}`);
    }
  } else {
    console.log('No coordinates extracted');
  }
}

main().catch(console.error);
