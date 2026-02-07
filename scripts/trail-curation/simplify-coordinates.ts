// Douglas-Peucker coordinate simplification with binary search for target point count

import simplify from 'simplify-js';

/**
 * Simplify trail coordinates using Douglas-Peucker algorithm
 * Uses binary search to find tolerance that achieves target point count
 * @param coords Array of [lng, lat, elevation] triplets
 * @param targetPoints Target number of points (default: 100, range typically 50-200)
 * @returns Simplified coordinate array
 */
export function simplifyCoordinates(
  coords: [number, number, number][],
  targetPoints: number = 100
): [number, number, number][] {
  if (coords.length <= targetPoints) {
    return coords;
  }

  // Convert to simplify-js format: {x, y}
  const points = coords.map(([lng, lat]) => ({ x: lng, y: lat }));

  // Binary search for optimal tolerance
  let minTolerance = 0.0001;
  let maxTolerance = 0.1;
  let bestTolerance = minTolerance;
  let bestResult = points;

  // Allow +/-20% of target point count
  const minPoints = Math.floor(targetPoints * 0.8);
  const maxPoints = Math.ceil(targetPoints * 1.2);

  for (let iteration = 0; iteration < 20; iteration++) {
    const tolerance = (minTolerance + maxTolerance) / 2;
    const simplified = simplify(points, tolerance, true); // highQuality: true

    if (simplified.length > maxPoints) {
      // Too many points - increase tolerance
      minTolerance = tolerance;
    } else if (simplified.length < minPoints) {
      // Too few points - decrease tolerance
      maxTolerance = tolerance;
    } else {
      // Within acceptable range
      bestTolerance = tolerance;
      bestResult = simplified;
      break;
    }

    // Track best result
    if (Math.abs(simplified.length - targetPoints) < Math.abs(bestResult.length - targetPoints)) {
      bestTolerance = tolerance;
      bestResult = simplified;
    }
  }

  // Re-attach elevation values from nearest original coordinates
  const result: [number, number, number][] = bestResult.map((point) => {
    // Find closest original coordinate
    let minDist = Infinity;
    let closestElevation = 0;

    for (const [lng, lat, ele] of coords) {
      const dist = Math.sqrt((point.x - lng) ** 2 + (point.y - lat) ** 2);
      if (dist < minDist) {
        minDist = dist;
        closestElevation = ele;
      }
    }

    return [point.x, point.y, closestElevation];
  });

  return result;
}
