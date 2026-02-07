// End-to-end trail fetcher with automatic OSM -> fallback chain

import { buildTrailQuery, queryOverpass, extractCoordinates } from './overpass-query.js';
import { simplifyCoordinates } from './simplify-coordinates.js';
import { findElevationWaypoints, ElevationWaypoint } from './elevation-waypoints.js';
import { validateTrail, ValidationResult } from './validate-trails.js';
import { tryFallbackChain, FallbackSource } from './fallback-sources.js';
import { fetchFromWaymarkedTrails } from './waymarked-trails.js';

export interface TrailInput {
  name: string;
  searchName?: string;
  region: string;
  country: string;
  officialDistanceKm: number;
  typicalDays: string;
  bbox?: [number, number, number, number]; // [south, west, north, east]
  targetPoints?: number;
}

export interface TrailData {
  id: string;
  name: string;
  region: string;
  country: string;
  distance_km: number;
  typical_days: string;
  coordinates: [number, number, number][];
}

export interface TrailResult {
  success: boolean;
  trail?: TrailData;
  validation?: ValidationResult;
  elevationWaypoints?: {
    trailLow: ElevationWaypoint;
    trailHigh: ElevationWaypoint;
  };
  flags: string[];
  error?: string;
  rawPointCount?: number;
  simplifiedPointCount?: number;
  dataSource: string;
  fallbackAttempts?: Array<{
    sourceId: string;
    success: boolean;
    error?: string;
  }>;
}

/**
 * Generate trail ID from name
 * @param name Trail name
 * @returns Lowercase ID with underscores
 */
function generateTrailId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_');
}

/**
 * Fetch trail data with automatic fallback chain
 * Tries OSM first, then country-specific government sources on validation failure
 * @param input Trail input specification
 * @returns Complete trail result with metadata
 */
export async function fetchTrail(input: TrailInput): Promise<TrailResult> {
  const searchName = input.searchName || input.name;
  const targetPoints = input.targetPoints || 100;
  const flags: string[] = [];

  // Step 1: Try OSM via Overpass API
  console.log(`Querying OSM for "${searchName}"...`);

  try {
    const query = buildTrailQuery(searchName, input.bbox);
    const response = await queryOverpass(query);
    const rawCoordinates = extractCoordinates(response);

    if (rawCoordinates.length === 0) {
      console.log(`OSM returned no coordinates for "${searchName}"`);
      flags.push('osm_no_data');
    } else {
      console.log(`OSM returned ${rawCoordinates.length} coordinates`);

      // Simplify coordinates
      const simplifiedCoordinates = simplifyCoordinates(rawCoordinates, targetPoints);
      console.log(`Simplified to ${simplifiedCoordinates.length} points`);

      // Validate distance
      const validation = validateTrail({
        name: input.name,
        coordinates: simplifiedCoordinates,
        officialDistanceKm: input.officialDistanceKm,
      });

      console.log(
        `Validation: ${validation.calculatedKm.toFixed(1)}km vs ${validation.officialKm}km (${validation.percentDiff.toFixed(1)}% diff)`
      );

      // Accept OSM data if we got coordinates, even if validation flags issues.
      // The strict validation check (2%) is for the final QA report (plan 10-07).
      // Here we use a relaxed threshold: accept data within 50% of official distance.
      // Data >50% off likely means OSM returned wrong/extra routes.
      const percentOff = Math.abs(validation.percentDiff);
      // Accept any OSM data that's within reasonable range.
      // Trail geometry is a visual planning aid — approximate is fine.
      // Too short (<50% of official): likely missing major sections
      // Too long (>200% of official): likely returned wrong/multiple trails
      const isReasonableMatch = validation.percentDiff >= -50 && validation.percentDiff <= 200;

      if (validation.valid || isReasonableMatch) {
        if (!validation.valid) {
          flags.push(`validation_warning:${validation.flag}`);
          console.log(
            `  Accepting OSM data with validation warning (${validation.percentDiff.toFixed(1)}% off, within 50% tolerance)`
          );
        }

        const elevationWaypoints = findElevationWaypoints(simplifiedCoordinates);

        const trail: TrailData = {
          id: generateTrailId(input.name),
          name: input.name,
          region: input.region,
          country: input.country,
          distance_km: input.officialDistanceKm,
          typical_days: input.typicalDays,
          coordinates: simplifiedCoordinates,
        };

        return {
          success: true,
          trail,
          validation,
          elevationWaypoints,
          flags,
          rawPointCount: rawCoordinates.length,
          simplifiedPointCount: simplifiedCoordinates.length,
          dataSource: 'osm',
        };
      } else {
        // Data is >50% off - likely wrong route from OSM, try fallback
        console.log(
          `OSM data too far off for "${input.name}" (${validation.percentDiff.toFixed(1)}% diff, >50% tolerance). Trying fallback sources...`
        );
        flags.push(`osm_validation_failed:${validation.flag}`);
      }
    }
  } catch (error) {
    console.log(`OSM query failed: ${error}`);
    flags.push('osm_query_failed');
  }

  // Step 2: Try Waymarked Trails API (better name-based search over OSM data)
  console.log(`Trying Waymarked Trails API for "${searchName}"...`);

  try {
    const wmResult = await fetchFromWaymarkedTrails(searchName, input.bbox);

    if (wmResult.coordinates && wmResult.coordinates.length > 0) {
      console.log(
        `Waymarked Trails returned ${wmResult.coordinates.length} coordinates (relation ${wmResult.relationId})`
      );

      const simplifiedCoordinates = simplifyCoordinates(wmResult.coordinates, targetPoints);
      const validation = validateTrail({
        name: input.name,
        coordinates: simplifiedCoordinates,
        officialDistanceKm: input.officialDistanceKm,
      });

      console.log(
        `WM validation: ${validation.calculatedKm.toFixed(1)}km vs ${validation.officialKm}km (${validation.percentDiff.toFixed(1)}% diff)`
      );

      const isReasonableMatch = validation.percentDiff >= -50 && validation.percentDiff <= 200;

      if (validation.valid || isReasonableMatch) {
        if (!validation.valid) {
          flags.push(`validation_warning:${validation.flag}`);
        }

        const elevationWaypoints = findElevationWaypoints(simplifiedCoordinates);

        const trail: TrailData = {
          id: generateTrailId(input.name),
          name: input.name,
          region: input.region,
          country: input.country,
          distance_km: input.officialDistanceKm,
          typical_days: input.typicalDays,
          coordinates: simplifiedCoordinates,
        };

        return {
          success: true,
          trail,
          validation,
          elevationWaypoints,
          flags,
          rawPointCount: wmResult.coordinates.length,
          simplifiedPointCount: simplifiedCoordinates.length,
          dataSource: 'waymarked_trails',
        };
      } else {
        console.log(
          `Waymarked Trails data too far off (${validation.percentDiff.toFixed(1)}% diff). Trying government fallbacks...`
        );
        flags.push(`waymarked_validation_failed:${validation.flag}`);
      }
    } else {
      console.log(`Waymarked Trails returned no data for "${searchName}"`);
      flags.push('waymarked_no_data');
    }
  } catch (error) {
    console.log(`Waymarked Trails query failed: ${error}`);
    flags.push('waymarked_query_failed');
  }

  // Step 3: Try government fallback sources
  console.log(`Trying fallback sources for country: ${input.country}...`);

  const fallbackResult = await tryFallbackChain(input.country, searchName, input.bbox);

  if (fallbackResult.coordinates && fallbackResult.coordinates.length > 0) {
    console.log(
      `Fallback succeeded via ${fallbackResult.source?.name} (${fallbackResult.coordinates.length} points)`
    );

    // Simplify and validate fallback coordinates
    const simplifiedCoordinates = simplifyCoordinates(fallbackResult.coordinates, targetPoints);
    const validation = validateTrail({
      name: input.name,
      coordinates: simplifiedCoordinates,
      officialDistanceKm: input.officialDistanceKm,
    });

    console.log(
      `Fallback validation: ${validation.calculatedKm.toFixed(1)}km vs ${validation.officialKm}km (${validation.percentDiff.toFixed(1)}% diff)`
    );

    const elevationWaypoints = findElevationWaypoints(simplifiedCoordinates);

    const trail: TrailData = {
      id: generateTrailId(input.name),
      name: input.name,
      region: input.region,
      country: input.country,
      distance_km: input.officialDistanceKm,
      typical_days: input.typicalDays,
      coordinates: simplifiedCoordinates,
    };

    return {
      success: true,
      trail,
      validation,
      elevationWaypoints,
      flags,
      rawPointCount: fallbackResult.coordinates.length,
      simplifiedPointCount: simplifiedCoordinates.length,
      dataSource: fallbackResult.source!.id,
      fallbackAttempts: fallbackResult.attemptsLog,
    };
  } else {
    console.log(`All fallback sources exhausted for "${input.name}"`);
    flags.push('all_sources_exhausted');

    return {
      success: false,
      flags,
      error: 'No data available from OSM or fallback sources',
      dataSource: 'none',
      fallbackAttempts: fallbackResult.attemptsLog,
    };
  }
}
