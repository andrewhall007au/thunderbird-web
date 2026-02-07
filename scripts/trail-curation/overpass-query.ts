// Overpass API query builder and executor for hiking routes from OpenStreetMap

export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  nodes?: number[];
  members?: Array<{
    type: string;
    ref: number;
    role: string;
  }>;
}

export interface OverpassResponse {
  version: number;
  generator: string;
  elements: OverpassElement[];
}

/**
 * Builds an Overpass QL query for hiking route relations matching a trail name
 * @param trailName Name of the trail to search for (case-insensitive)
 * @param bbox Optional bounding box [south, west, north, east] = [minLat, minLng, maxLat, maxLng]
 * @returns Overpass QL query string
 */
export function buildTrailQuery(
  trailName: string,
  bbox?: [number, number, number, number]
): string {
  const bboxStr = bbox ? `(${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]})` : '';

  // Search for hiking route relations first, then fall back to named ways/paths
  return `
[out:json][timeout:60];
(
  rel[route="hiking"]["name"~"${trailName}",i]${bboxStr};
  rel[route="foot"]["name"~"${trailName}",i]${bboxStr};
  way[highway~"path|track|footway"]["name"~"${trailName}",i]${bboxStr};
);
out body;
>;
out skel qt;
`.trim();
}

/**
 * Query the Overpass API with retry logic and exponential backoff
 * @param query Overpass QL query string
 * @returns Parsed Overpass API response
 */
export async function queryOverpass(query: string): Promise<OverpassResponse> {
  const url = 'https://overpass-api.de/api/interpreter';
  const maxAttempts = 3;
  const delays = [2000, 4000, 8000]; // 2s, 4s, 8s

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(query)}`,
      });

      // Retry on 429 (rate limit) or 5xx (server error)
      if (response.status === 429 || response.status >= 500) {
        if (attempt < maxAttempts - 1) {
          console.warn(
            `Overpass API returned ${response.status}, retrying in ${delays[attempt]}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
          continue;
        }
        throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
      }

      if (!response.ok) {
        throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data as OverpassResponse;
    } catch (error) {
      if (attempt < maxAttempts - 1) {
        console.warn(
          `Overpass API request failed (${error}), retrying in ${delays[attempt]}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
        continue;
      }
      throw error;
    }
  }

  throw new Error('Failed to query Overpass API after 3 attempts');
}

/**
 * Extract ordered coordinates from Overpass response
 * Handles both way members of relations and standalone ways
 * @param response Overpass API response
 * @returns Array of [lng, lat, elevation] triplets
 */
export function extractCoordinates(
  response: OverpassResponse
): [number, number, number][] {
  const coordinates: [number, number, number][] = [];

  // Build node lookup map
  const nodeMap = new Map<number, { lat: number; lon: number; ele?: number }>();
  response.elements
    .filter((el) => el.type === 'node' && el.lat !== undefined && el.lon !== undefined)
    .forEach((node) => {
      const elevation = node.tags?.ele ? parseInt(node.tags.ele, 10) : undefined;
      nodeMap.set(node.id, {
        lat: node.lat!,
        lon: node.lon!,
        ele: elevation,
      });
    });

  // Build way lookup map
  const wayMap = new Map<number, number[]>();
  response.elements
    .filter((el) => el.type === 'way' && el.nodes)
    .forEach((way) => {
      wayMap.set(way.id, way.nodes!);
    });

  // Find hiking route relations
  const relations = response.elements.filter(
    (el) => el.type === 'relation' && el.tags?.route === 'hiking'
  );

  if (relations.length === 0) {
    // No relation found - look for standalone ways
    const ways = response.elements.filter(
      (el) => el.type === 'way' && el.nodes && el.nodes.length > 0
    );

    for (const way of ways) {
      for (const nodeId of way.nodes!) {
        const node = nodeMap.get(nodeId);
        if (node) {
          // OSM returns lat/lon, but we need [lng, lat, elevation]
          coordinates.push([node.lon, node.lat, node.ele || 0]);
        }
      }
    }

    return coordinates;
  }

  // Extract coordinates from relation members in order
  const relation = relations[0]; // Use first matching relation
  if (!relation.members) {
    console.warn('Relation has no members');
    return coordinates;
  }

  for (const member of relation.members) {
    if (member.type === 'way') {
      const wayNodes = wayMap.get(member.ref);
      if (!wayNodes) {
        console.warn(`Way ${member.ref} not found in response - possible gap in trail data`);
        continue;
      }

      for (const nodeId of wayNodes) {
        const node = nodeMap.get(nodeId);
        if (node) {
          // OSM returns lat/lon, but we need [lng, lat, elevation]
          coordinates.push([node.lon, node.lat, node.ele || 0]);
        } else {
          console.warn(`Node ${nodeId} not found in response`);
        }
      }
    }
  }

  return coordinates;
}
