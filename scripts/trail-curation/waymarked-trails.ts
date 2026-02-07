// Waymarked Trails API integration
// Uses OSM data with better trail-level search than raw Overpass queries
// API docs: https://hiking.waymarkedtrails.org/api/v1/

interface WaymarkedSearchResult {
  type: string;
  id: number;
  name: string;
  group?: string;
  linear?: string;
  symbol_id?: string;
}

interface WaymarkedSearchResponse {
  query: string;
  page: number;
  results: WaymarkedSearchResult[];
}

interface WaymarkedWayGeometry {
  type: 'LineString';
  coordinates: [number, number][];
}

interface WaymarkedWay {
  id: number;
  geometry: WaymarkedWayGeometry;
}

interface WaymarkedRouteSection {
  ways: WaymarkedWay[];
}

interface WaymarkedDetailResponse {
  type: string;
  id: number;
  name: string;
  official_length?: number;
  operator?: string;
  bbox?: [number, number, number, number];
  tags?: Record<string, string>;
  route?: {
    main: WaymarkedRouteSection[];
  };
}

/**
 * Convert Web Mercator (EPSG:3857) coordinates to WGS84 (EPSG:4326)
 */
function webMercatorToWGS84(x: number, y: number): [number, number] {
  const lng = (x * 180) / 20037508.34;
  const lat =
    (Math.atan(Math.exp((y * Math.PI) / 20037508.34)) * 360) / Math.PI - 90;
  return [lng, lat];
}

/**
 * Search for a trail by name using the Waymarked Trails API
 * @param trailName Trail name to search for
 * @returns Array of matching trail results with OSM relation IDs
 */
export async function searchWaymarkedTrails(
  trailName: string
): Promise<WaymarkedSearchResult[]> {
  const url = `https://hiking.waymarkedtrails.org/api/v1/list/search?query=${encodeURIComponent(trailName)}`;

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(
      `Waymarked Trails search failed: ${response.status} ${response.statusText}`
    );
  }

  const data: WaymarkedSearchResponse = await response.json();
  return data.results || [];
}

/**
 * Get trail detail with geometry from Waymarked Trails API
 * @param relationId OSM relation ID
 * @returns Trail detail with geometry
 */
export async function getWaymarkedTrailDetail(
  relationId: number
): Promise<WaymarkedDetailResponse> {
  const url = `https://hiking.waymarkedtrails.org/api/v1/details/relation/${relationId}`;

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(
      `Waymarked Trails detail failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * Extract and reproject coordinates from Waymarked Trails detail response
 * Concatenates all way segments into a single polyline
 * Converts from EPSG:3857 to WGS84
 * @param detail Trail detail response
 * @returns Array of [lng, lat, elevation] triplets in WGS84
 */
export function extractWaymarkedCoordinates(
  detail: WaymarkedDetailResponse
): [number, number, number][] {
  const coordinates: [number, number, number][] = [];

  if (!detail.route?.main) {
    return coordinates;
  }

  for (const section of detail.route.main) {
    if (!section.ways) continue;
    for (const way of section.ways) {
      if (!way.geometry?.coordinates) continue;

      for (const [x, y] of way.geometry.coordinates) {
        const [lng, lat] = webMercatorToWGS84(x, y);
        coordinates.push([lng, lat, 0]); // No elevation from this API
      }
    }
  }

  return coordinates;
}

/**
 * Fetch trail coordinates via Waymarked Trails API
 * Searches by name, picks best match, extracts geometry
 * @param trailName Trail name to search for
 * @param bbox Optional bounding box for disambiguation [south, west, north, east]
 * @returns Coordinates in [lng, lat, elevation] format, or null if not found
 */
export async function fetchFromWaymarkedTrails(
  trailName: string,
  bbox?: [number, number, number, number]
): Promise<{
  coordinates: [number, number, number][] | null;
  relationId?: number;
  officialLength?: number;
}> {
  // Step 1: Search for the trail
  const results = await searchWaymarkedTrails(trailName);

  if (results.length === 0) {
    return { coordinates: null };
  }

  // Step 2: Pick the best match
  // Prefer relations (routes) over ways
  const relations = results.filter((r) => r.type === 'relation');
  const bestMatch = relations.length > 0 ? relations[0] : results[0];

  // Step 3: Get detail with geometry
  // Rate limit: wait 1s before detail request
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const detail = await getWaymarkedTrailDetail(bestMatch.id);

  // Step 4: Extract and reproject coordinates
  const coordinates = extractWaymarkedCoordinates(detail);

  if (coordinates.length === 0) {
    return { coordinates: null, relationId: bestMatch.id };
  }

  return {
    coordinates,
    relationId: bestMatch.id,
    officialLength: detail.official_length,
  };
}
