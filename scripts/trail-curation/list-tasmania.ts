// LIST Tasmania ArcGIS API integration
// Uses Transport Segments layer for walking track data
// Data: CC BY 3.0 AU - © State of Tasmania (Land Tasmania)
// API: https://services.thelist.tas.gov.au/arcgis/rest/services/Public/OpenDataWFS/MapServer/42

import { simplifyCoordinates } from './simplify-coordinates.js';

interface LISTFeature {
  type: 'Feature';
  properties: {
    PRI_NAME: string;
    SEC_NAME: string | null;
    COMP_LEN: number;
    USER_TYPE: string;
    TSEG_FEAT: string;
    TRANS_TYPE: string;
  };
  geometry: {
    type: 'LineString' | 'MultiLineString';
    coordinates: number[][];
  };
}

interface LISTResponse {
  type: 'FeatureCollection';
  features: LISTFeature[];
}

const LIST_BASE = 'https://services.thelist.tas.gov.au/arcgis/rest/services/Public/OpenDataWFS/MapServer/42/query';

/**
 * Fetch trail segments from LIST Tasmania by name
 * @param searchName Trail name to search for (partial match)
 * @returns GeoJSON features matching the trail name
 */
export async function fetchLISTTrail(searchName: string): Promise<LISTFeature[]> {
  const where = `PRI_NAME LIKE '%${searchName}%'`;
  const params = new URLSearchParams({
    where,
    outFields: 'PRI_NAME,SEC_NAME,COMP_LEN,USER_TYPE,TSEG_FEAT,TRANS_TYPE',
    f: 'geojson',
    outSR: '4326',
    resultRecordCount: '2000',
  });

  const url = `${LIST_BASE}?${params}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`LIST API returned ${response.status}`);
  }

  const data: LISTResponse = await response.json();
  return data.features || [];
}

/**
 * Extract and concatenate coordinates from LIST trail segments
 * Orders segments to form a continuous path
 */
export function extractLISTCoordinates(features: LISTFeature[]): [number, number, number][] {
  if (features.length === 0) return [];

  // Collect all segment coordinates
  const segments: [number, number, number][][] = [];

  for (const feature of features) {
    if (!feature.geometry) continue;
    const geom = feature.geometry;

    if (geom.type === 'LineString') {
      segments.push(geom.coordinates.map(c => [c[0], c[1], c[2] || 0] as [number, number, number]));
    } else if (geom.type === 'MultiLineString') {
      for (const line of geom.coordinates) {
        segments.push((line as number[][]).map(c => [c[0], c[1], c[2] || 0] as [number, number, number]));
      }
    }
  }

  if (segments.length === 0) return [];
  if (segments.length === 1) return segments[0];

  // Order segments into a continuous path using nearest-endpoint matching
  const ordered: [number, number, number][][] = [segments[0]];
  const used = new Set<number>([0]);

  while (used.size < segments.length) {
    const lastSeg = ordered[ordered.length - 1];
    const lastPoint = lastSeg[lastSeg.length - 1];

    let bestIdx = -1;
    let bestDist = Infinity;
    let bestReverse = false;

    for (let i = 0; i < segments.length; i++) {
      if (used.has(i)) continue;
      const seg = segments[i];
      const startDist = distance(lastPoint, seg[0]);
      const endDist = distance(lastPoint, seg[seg.length - 1]);

      if (startDist < bestDist) {
        bestDist = startDist;
        bestIdx = i;
        bestReverse = false;
      }
      if (endDist < bestDist) {
        bestDist = endDist;
        bestIdx = i;
        bestReverse = true;
      }
    }

    if (bestIdx === -1) break;
    used.add(bestIdx);

    const seg = bestReverse ? [...segments[bestIdx]].reverse() : segments[bestIdx];
    ordered.push(seg);
  }

  // Flatten to single coordinate array
  return ordered.flat();
}

function distance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
}

/**
 * Fetch a Tasmanian trail from LIST, simplify, and return
 */
export async function fetchTasmanianTrail(
  searchName: string,
  targetPoints: number = 100
): Promise<{
  coordinates: [number, number, number][] | null;
  rawPoints: number;
  simplifiedPoints: number;
  segmentCount: number;
}> {
  const features = await fetchLISTTrail(searchName);

  if (features.length === 0) {
    return { coordinates: null, rawPoints: 0, simplifiedPoints: 0, segmentCount: 0 };
  }

  const rawCoords = extractLISTCoordinates(features);

  if (rawCoords.length === 0) {
    return { coordinates: null, rawPoints: 0, simplifiedPoints: 0, segmentCount: features.length };
  }

  const simplified = simplifyCoordinates(rawCoords, targetPoints);

  return {
    coordinates: simplified,
    rawPoints: rawCoords.length,
    simplifiedPoints: simplified.length,
    segmentCount: features.length,
  };
}
