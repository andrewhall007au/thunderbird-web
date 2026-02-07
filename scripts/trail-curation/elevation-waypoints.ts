// Elevation waypoint detection - finds min/max elevation points along a trail

export interface ElevationWaypoint {
  name: string;
  coordinates: [number, number, number];
  index: number;
  elevationDataAvailable?: boolean;
}

export interface ElevationWaypoints {
  trailLow: ElevationWaypoint;
  trailHigh: ElevationWaypoint;
}

/**
 * Find the lowest and highest elevation points along a trail
 * @param coords Array of [lng, lat, elevation] triplets
 * @returns Object with trailLow and trailHigh waypoints
 */
export function findElevationWaypoints(
  coords: [number, number, number][]
): ElevationWaypoints {
  if (coords.length === 0) {
    throw new Error('Cannot find elevation waypoints from empty coordinate array');
  }

  // Check if elevation data is available (not all zeros)
  const hasElevationData = coords.some((coord) => coord[2] !== 0);

  if (!hasElevationData) {
    // No elevation data available - return first coordinate for both
    return {
      trailLow: {
        name: 'Trail Low Point',
        coordinates: coords[0],
        index: 0,
        elevationDataAvailable: false,
      },
      trailHigh: {
        name: 'Trail High Point',
        coordinates: coords[0],
        index: 0,
        elevationDataAvailable: false,
      },
    };
  }

  // Find min and max elevation points
  let minElevation = Infinity;
  let maxElevation = -Infinity;
  let minIndex = 0;
  let maxIndex = 0;

  coords.forEach((coord, index) => {
    const elevation = coord[2];

    if (elevation < minElevation) {
      minElevation = elevation;
      minIndex = index;
    }

    if (elevation > maxElevation) {
      maxElevation = elevation;
      maxIndex = index;
    }
  });

  return {
    trailLow: {
      name: 'Trail Low Point',
      coordinates: coords[minIndex],
      index: minIndex,
      elevationDataAvailable: true,
    },
    trailHigh: {
      name: 'Trail High Point',
      coordinates: coords[maxIndex],
      index: maxIndex,
      elevationDataAvailable: true,
    },
  };
}
