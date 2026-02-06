/**
 * Elevation API utilities
 * Uses Open-Elevation API (free, no API key required)
 */

interface ElevationResult {
  elevation: number;
  latitude: number;
  longitude: number;
}

interface ElevationResponse {
  results: ElevationResult[];
}

/**
 * Fetch elevation for a single location
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns Elevation in meters, or null if fetch fails
 */
export async function getElevation(lat: number, lng: number): Promise<number | null> {
  try {
    const response = await fetch(
      `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`
    );

    if (!response.ok) {
      console.error('Elevation API error:', response.status);
      return null;
    }

    const data: ElevationResponse = await response.json();

    if (data.results && data.results.length > 0) {
      return Math.round(data.results[0].elevation);
    }

    return null;
  } catch (error) {
    console.error('Failed to fetch elevation:', error);
    return null;
  }
}

/**
 * Fetch elevations for multiple locations in batch
 * @param locations - Array of {lat, lng} objects
 * @returns Array of elevations in meters (null for failed fetches)
 */
export async function getElevationsBatch(
  locations: { lat: number; lng: number }[]
): Promise<(number | null)[]> {
  if (locations.length === 0) return [];

  try {
    // Open-Elevation API supports batch requests
    const locationsParam = locations.map(loc => `${loc.lat},${loc.lng}`).join('|');

    const response = await fetch(
      `https://api.open-elevation.com/api/v1/lookup?locations=${locationsParam}`
    );

    if (!response.ok) {
      console.error('Elevation API error:', response.status);
      return locations.map(() => null);
    }

    const data: ElevationResponse = await response.json();

    return data.results.map(result =>
      result.elevation ? Math.round(result.elevation) : null
    );
  } catch (error) {
    console.error('Failed to fetch elevations:', error);
    return locations.map(() => null);
  }
}
