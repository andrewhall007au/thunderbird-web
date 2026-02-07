// Per-country fallback data sources for when OSM validation fails

export interface FallbackSource {
  id: string;
  name: string;
  country: string;
  type: 'arcgis_featureserver' | 'geojson_url' | 'shapefile_url' | 'wfs' | 'gpx_download';
  url: string;
  queryParam?: string;
  format: 'geojson' | 'shapefile' | 'gpx';
  attribution: string;
  notes?: string;
}

// Per-country fallback source registry
const FALLBACK_REGISTRY: Record<string, FallbackSource[]> = {
  US: [
    {
      id: 'usfs_trails',
      name: 'USFS National Forest System Trails',
      country: 'US',
      type: 'arcgis_featureserver',
      url: 'https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_TrailNFS_01/MapServer/0',
      format: 'geojson',
      attribution: 'USDA Forest Service',
      notes: 'Federal trails in National Forests',
    },
    {
      id: 'nps_trails',
      name: 'National Park Service Trails',
      country: 'US',
      type: 'arcgis_featureserver',
      url: 'https://services1.arcgis.com/fBc8EJBxQRMcHlei/arcgis/rest/services/NPS_Trails/FeatureServer/0',
      format: 'geojson',
      attribution: 'National Park Service',
      notes: 'Trails in National Parks',
    },
    {
      id: 'blm_trails',
      name: 'BLM National Trails and Byways',
      country: 'US',
      type: 'arcgis_featureserver',
      url: 'https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_Trails_and_Byways/MapServer/1',
      format: 'geojson',
      attribution: 'Bureau of Land Management',
      notes: 'BLM-managed trails',
    },
  ],

  CA: [
    {
      id: 'parks_canada',
      name: 'Parks Canada Trails',
      country: 'CA',
      type: 'geojson_url',
      url: 'https://open.canada.ca/data/en/dataset/64a90e8d-5bc0-4027-8645-b5881b4068d4.geojson',
      format: 'geojson',
      attribution: 'Parks Canada',
      notes: 'National park trails',
    },
    {
      id: 'bc_trails',
      name: 'BC Recreation Sites and Trails',
      country: 'CA',
      type: 'geojson_url',
      url: 'https://catalogue.data.gov.bc.ca/dataset/recreation-lines/resource/trails.geojson',
      format: 'geojson',
      attribution: 'Government of British Columbia',
      notes: 'Provincial trails in BC',
    },
  ],

  AU: [
    {
      id: 'tas_listmap',
      name: 'Tasmania ListMap Tracks',
      country: 'AU',
      type: 'arcgis_featureserver',
      url: 'https://services.thelist.tas.gov.au/arcgis/rest/services/Public/CadastreAndAdministrative/MapServer/14',
      format: 'geojson',
      attribution: 'Land Tasmania (theLIST)',
      notes: 'Tasmanian walking tracks',
    },
    {
      id: 'nsw_npws',
      name: 'NSW National Parks Tracks',
      country: 'AU',
      type: 'arcgis_featureserver',
      url: 'https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/NPWS/NPWSEstateAndVisitorAssets/MapServer/6',
      format: 'geojson',
      attribution: 'NSW National Parks and Wildlife Service',
      notes: 'NSW park trails',
    },
    {
      id: 'parks_vic',
      name: 'Parks Victoria Tracks',
      country: 'AU',
      type: 'arcgis_featureserver',
      url: 'https://services6.arcgis.com/GB33F62SbDxJjwEL/arcgis/rest/services/Vicmap_Features_of_Interest/FeatureServer/14',
      format: 'geojson',
      attribution: 'Parks Victoria',
      notes: 'Victorian park trails',
    },
    {
      id: 'qld_parks',
      name: 'Queensland Parks Tracks',
      country: 'AU',
      type: 'geojson_url',
      url: 'https://www.data.qld.gov.au/dataset/parks-tracks/resource/tracks.geojson',
      format: 'geojson',
      attribution: 'Queensland Government',
      notes: 'QLD park trails',
    },
  ],

  NZ: [
    {
      id: 'doc_tracks',
      name: 'DOC Walking Tracks',
      country: 'NZ',
      type: 'arcgis_featureserver',
      url: 'https://services1.arcgis.com/3JjYDyG3oajxU6HO/arcgis/rest/services/DOC_Tracks/FeatureServer/0',
      format: 'geojson',
      attribution: 'Department of Conservation',
      notes: 'Great Walks and DOC tracks',
    },
    {
      id: 'linz_topo',
      name: 'LINZ Topographic Data',
      country: 'NZ',
      type: 'wfs',
      url: 'https://data.linz.govt.nz/services/query/v1/vector.json',
      queryParam: 'layer-50329',
      format: 'geojson',
      attribution: 'Land Information New Zealand',
      notes: 'Topographic trail data (requires API key)',
    },
  ],

  GB: [
    {
      id: 'os_paths',
      name: 'Ordnance Survey Open Roads',
      country: 'GB',
      type: 'geojson_url',
      url: 'https://api.os.uk/downloads/v1/products/OpenMapLocal/downloads?format=GeoPackage',
      format: 'geojson',
      attribution: 'Ordnance Survey',
      notes: 'OS open data paths (requires API key)',
    },
    {
      id: 'national_trails',
      name: 'National Trails',
      country: 'GB',
      type: 'geojson_url',
      url: 'https://naturalengland-defra.opendata.arcgis.com/datasets/national-trails.geojson',
      format: 'geojson',
      attribution: 'Natural England',
      notes: 'Official National Trails',
    },
  ],

  FR: [
    {
      id: 'ign_sentiers',
      name: 'IGN Sentiers de Randonnée',
      country: 'FR',
      type: 'wfs',
      url: 'https://wxs.ign.fr/decouverte/geoportail/wfs',
      queryParam: 'BDTOPO_V3:troncon_de_route',
      format: 'geojson',
      attribution: 'IGN France',
      notes: 'French hiking paths',
    },
    {
      id: 'ffrandonnee',
      name: 'FFRandonnée GR Trails',
      country: 'FR',
      type: 'geojson_url',
      url: 'https://www.data.gouv.fr/fr/datasets/sentiers-de-grande-randonnee.geojson',
      format: 'geojson',
      attribution: 'Fédération Française de la Randonnée Pédestre',
      notes: 'Grande Randonnée trails',
    },
  ],

  CH: [
    {
      id: 'swisstopo_hiking',
      name: 'SwissTopo Hiking Routes',
      country: 'CH',
      type: 'wfs',
      url: 'https://wms.geo.admin.ch/',
      queryParam: 'ch.astra.wanderland-sperrungen_umleitungen',
      format: 'geojson',
      attribution: 'Federal Office of Topography swisstopo',
      notes: 'Swiss hiking network',
    },
  ],

  IT: [
    {
      id: 'cai_sentieri',
      name: 'CAI Sentieri',
      country: 'IT',
      type: 'geojson_url',
      url: 'https://www.datiopen.it/it/dataset/sentieri-cai.geojson',
      format: 'geojson',
      attribution: 'Club Alpino Italiano',
      notes: 'Italian Alpine Club trails',
    },
  ],

  JP: [
    {
      id: 'gsi_trails',
      name: 'GSI Trails',
      country: 'JP',
      type: 'geojson_url',
      url: 'https://cyberjapandata.gsi.go.jp/xyz/experimental_trail/{z}/{x}/{y}.geojson',
      format: 'geojson',
      attribution: 'Geospatial Information Authority of Japan',
      notes: 'Experimental trail data',
    },
  ],

  ZA: [
    {
      id: 'sanparks',
      name: 'SANParks Trails',
      country: 'ZA',
      type: 'geojson_url',
      url: 'https://www.sanparks.org/assets/data/trails.geojson',
      format: 'geojson',
      attribution: 'South African National Parks',
      notes: 'National park trails',
    },
  ],

  DE: [
    {
      id: 'wanderbares_deutschland',
      name: 'Wanderbares Deutschland',
      country: 'DE',
      type: 'geojson_url',
      url: 'https://www.wanderbares-deutschland.de/api/trails.geojson',
      format: 'geojson',
      attribution: 'Deutscher Wanderverband',
      notes: 'Certified German hiking trails',
    },
  ],
};

/**
 * Get the prioritized list of fallback sources for a country
 * @param country Two-letter country code (ISO 3166-1 alpha-2)
 * @returns Array of fallback sources, or empty array if none defined
 */
export function getFallbackSources(country: string): FallbackSource[] {
  return FALLBACK_REGISTRY[country] || [];
}

/**
 * Fetch trail coordinates from a single fallback source
 * @param source Fallback source configuration
 * @param trailName Name of the trail to search for
 * @param bbox Optional bounding box [minLat, minLon, maxLat, maxLon]
 * @returns Coordinates in [lng, lat, elevation] format, or null if not found/failed
 */
export async function fetchFromFallback(
  source: FallbackSource,
  trailName: string,
  bbox?: [number, number, number, number]
): Promise<[number, number, number][] | null> {
  const timeout = 30000; // 30 seconds

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    let url: string;
    let response: Response;

    switch (source.type) {
      case 'arcgis_featureserver': {
        // ArcGIS Feature Service query
        const where = `TRAIL_NAME LIKE '%${trailName}%' OR NAME LIKE '%${trailName}%'`;
        const params = new URLSearchParams({
          where,
          outFields: '*',
          f: 'geojson',
          outSR: '4326',
        });
        url = `${source.url}/query?${params}`;
        response = await fetch(url, { signal: controller.signal });
        break;
      }

      case 'geojson_url': {
        // Direct GeoJSON URL
        url = source.url;
        response = await fetch(url, { signal: controller.signal });
        break;
      }

      case 'wfs': {
        // WFS service
        const filter = `name LIKE '%${trailName}%'`;
        const params = new URLSearchParams({
          service: 'WFS',
          version: '2.0.0',
          request: 'GetFeature',
          typeName: source.queryParam || '',
          outputFormat: 'application/json',
          CQL_FILTER: filter,
        });
        url = `${source.url}?${params}`;
        response = await fetch(url, { signal: controller.signal });
        break;
      }

      default:
        console.warn(`Unsupported source type: ${source.type}`);
        clearTimeout(timeoutId);
        return null;
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Fallback source ${source.id} returned ${response.status}`);
      return null;
    }

    const data = await response.json();

    // Extract coordinates from GeoJSON
    return extractGeoJSONCoordinates(data, trailName);
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.warn(`Fallback source ${source.id} timed out after ${timeout}ms`);
    } else {
      console.warn(`Fallback source ${source.id} failed: ${error}`);
    }
    return null;
  }
}

/**
 * Extract coordinates from GeoJSON response
 * Handles LineString and MultiLineString geometries
 */
function extractGeoJSONCoordinates(
  geojson: any,
  trailName: string
): [number, number, number][] | null {
  if (!geojson.features || geojson.features.length === 0) {
    return null;
  }

  // Search for feature matching trail name
  const normalizedSearch = trailName.toLowerCase();
  let matchingFeature = geojson.features.find((feature: any) => {
    const name = feature.properties?.name || feature.properties?.TRAIL_NAME || '';
    return name.toLowerCase().includes(normalizedSearch);
  });

  // If no match, use first feature
  if (!matchingFeature) {
    matchingFeature = geojson.features[0];
  }

  const geometry = matchingFeature.geometry;
  if (!geometry) {
    return null;
  }

  const coordinates: [number, number, number][] = [];

  if (geometry.type === 'LineString') {
    // Single line
    for (const coord of geometry.coordinates) {
      const [lng, lat, ele = 0] = coord;
      coordinates.push([lng, lat, ele]);
    }
  } else if (geometry.type === 'MultiLineString') {
    // Multiple line segments - concatenate
    for (const line of geometry.coordinates) {
      for (const coord of line) {
        const [lng, lat, ele = 0] = coord;
        coordinates.push([lng, lat, ele]);
      }
    }
  } else {
    console.warn(`Unsupported geometry type: ${geometry.type}`);
    return null;
  }

  return coordinates.length > 0 ? coordinates : null;
}

/**
 * Try all fallback sources for a country in priority order
 * @param country Two-letter country code
 * @param trailName Name of the trail to search for
 * @param bbox Optional bounding box
 * @returns First successful result with attempt log
 */
export async function tryFallbackChain(
  country: string,
  trailName: string,
  bbox?: [number, number, number, number]
): Promise<{
  coordinates: [number, number, number][] | null;
  source: FallbackSource | null;
  attemptsLog: { sourceId: string; success: boolean; error?: string }[];
}> {
  const sources = getFallbackSources(country);
  const attemptsLog: { sourceId: string; success: boolean; error?: string }[] = [];

  for (const source of sources) {
    console.log(`  Trying fallback: ${source.name}...`);

    try {
      const coordinates = await fetchFromFallback(source, trailName, bbox);

      if (coordinates && coordinates.length > 0) {
        console.log(`  ${source.name}: OK (${coordinates.length} points)`);
        attemptsLog.push({ sourceId: source.id, success: true });
        return { coordinates, source, attemptsLog };
      } else {
        console.log(`  ${source.name}: FAILED (no data)`);
        attemptsLog.push({ sourceId: source.id, success: false, error: 'no data' });
      }
    } catch (error) {
      console.log(`  ${source.name}: FAILED (${error})`);
      attemptsLog.push({ sourceId: source.id, success: false, error: String(error) });
    }
  }

  return { coordinates: null, source: null, attemptsLog };
}
