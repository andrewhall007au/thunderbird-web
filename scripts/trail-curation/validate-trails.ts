// Trail distance validation using haversine formula

/**
 * Calculate great-circle distance between two points using haversine formula
 * @param coord1 [lng, lat]
 * @param coord2 [lng, lat]
 * @returns Distance in kilometers
 */
export function haversineDistance(
  coord1: [number, number],
  coord2: [number, number]
): number {
  const R = 6371; // Earth's radius in km
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

/**
 * Calculate total trail distance from coordinate array
 * @param coords Array of [lng, lat, elevation] triplets
 * @returns Total distance in kilometers
 */
export function calculateTrailDistance(coords: [number, number, number][]): number {
  if (coords.length < 2) {
    return 0;
  }

  let totalDistance = 0;

  for (let i = 1; i < coords.length; i++) {
    const coord1: [number, number] = [coords[i - 1][0], coords[i - 1][1]];
    const coord2: [number, number] = [coords[i][0], coords[i][1]];
    totalDistance += haversineDistance(coord1, coord2);
  }

  return totalDistance;
}

export interface TrailValidationInput {
  name: string;
  coordinates: [number, number, number][];
  officialDistanceKm: number;
}

export interface ValidationResult {
  valid: boolean;
  calculatedKm: number;
  officialKm: number;
  percentDiff: number;
  flag: string | null;
}

/**
 * Validate trail distance against official distance
 * Flags trails >2% shorter or >20% longer than official distance
 * @param trail Trail data with coordinates and official distance
 * @returns Validation result with calculated distance and flags
 */
export function validateTrail(trail: TrailValidationInput): ValidationResult {
  const calculatedKm = calculateTrailDistance(trail.coordinates);
  const officialKm = trail.officialDistanceKm;

  if (officialKm === 0) {
    return {
      valid: false,
      calculatedKm,
      officialKm,
      percentDiff: 0,
      flag: 'no_official_distance',
    };
  }

  const percentDiff = ((calculatedKm - officialKm) / officialKm) * 100;

  let flag: string | null = null;
  let valid = true;

  if (percentDiff < -2) {
    // More than 2% shorter
    flag = 'too_short';
    valid = false;
  } else if (percentDiff > 20) {
    // More than 20% longer
    flag = 'too_long';
    valid = false;
  }

  return {
    valid,
    calculatedKm,
    officialKm,
    percentDiff,
    flag,
  };
}

export interface ValidationReport {
  total: number;
  passed: number;
  failed: number;
  flagged: Array<{
    name: string;
    flag: string;
    calculatedKm: number;
    officialKm: number;
    percentDiff: number;
  }>;
}

/**
 * Validate a batch of trails
 * @param trails Array of trail validation inputs
 * @returns Summary report with pass/fail counts and flagged trails
 */
export function validateBatch(trails: TrailValidationInput[]): ValidationReport {
  const report: ValidationReport = {
    total: trails.length,
    passed: 0,
    failed: 0,
    flagged: [],
  };

  for (const trail of trails) {
    const result = validateTrail(trail);

    if (result.valid) {
      report.passed++;
    } else {
      report.failed++;
      if (result.flag) {
        report.flagged.push({
          name: trail.name,
          flag: result.flag,
          calculatedKm: result.calculatedKm,
          officialKm: result.officialKm,
          percentDiff: result.percentDiff,
        });
      }
    }
  }

  return report;
}
