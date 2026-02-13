export interface TrailStats {
  distanceKm: number;
  totalAscent: number;   // meters
  totalDescent: number;  // meters
  minElev: number;
  maxElev: number;
}

// Haversine distance in km between two [lng, lat, ...] coordinates
export function haversineKm(a: number[], b: number[]): number {
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// Compute trail statistics from GeoJSON coordinates
export function computeTrailStats(geojson: GeoJSON.Feature): TrailStats | null {
  const geometry = geojson.geometry;
  if (geometry.type !== 'LineString' && geometry.type !== 'MultiLineString') return null;

  const coords: number[][] = geometry.type === 'LineString'
    ? geometry.coordinates
    : geometry.coordinates.flat();

  if (coords.length < 2) return null;

  let distance = 0;
  let totalAscent = 0;
  let totalDescent = 0;
  let minElev = Infinity;
  let maxElev = -Infinity;

  for (let i = 0; i < coords.length; i++) {
    const elev = coords[i][2] ?? 0;
    if (elev < minElev) minElev = elev;
    if (elev > maxElev) maxElev = elev;

    if (i > 0) {
      distance += haversineKm(coords[i - 1], coords[i]);
      const elevDiff = (coords[i][2] ?? 0) - (coords[i - 1][2] ?? 0);
      if (elevDiff > 0) totalAscent += elevDiff;
      else totalDescent += Math.abs(elevDiff);
    }
  }

  return {
    distanceKm: Math.round(distance * 10) / 10,
    totalAscent: Math.round(totalAscent),
    totalDescent: Math.round(totalDescent),
    minElev: Math.round(minElev),
    maxElev: Math.round(maxElev),
  };
}

// Place a marker every 1km along the trail
export function sampleKmMarkers(geojson: GeoJSON.Feature): GeoJSON.FeatureCollection {
  const geometry = geojson.geometry;
  if (geometry.type !== 'LineString' && geometry.type !== 'MultiLineString') {
    return { type: 'FeatureCollection', features: [] };
  }

  const coords: number[][] = geometry.type === 'LineString'
    ? geometry.coordinates
    : geometry.coordinates.flat();

  if (coords.length === 0) return { type: 'FeatureCollection', features: [] };

  const points: GeoJSON.Feature[] = [{
    type: 'Feature',
    properties: {},
    geometry: { type: 'Point', coordinates: coords[0] }
  }];

  let accumulated = 0;

  for (let i = 1; i < coords.length; i++) {
    accumulated += haversineKm(coords[i - 1], coords[i]);
    if (accumulated >= 1) {
      points.push({
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: coords[i] }
      });
      accumulated = 0;
    }
  }

  return { type: 'FeatureCollection', features: points };
}
