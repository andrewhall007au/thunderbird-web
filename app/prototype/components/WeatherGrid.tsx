'use client';

import { useMemo } from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';

interface WeatherGridProps {
  visible: boolean;
  center: { lat: number; lng: number };
  bounds: [number, number, number, number]; // [west, south, east, north]
  resolution: number;  // Grid cell size in km (3, 13, etc.)
}

/**
 * Generate a GeoJSON grid of rectangular cells covering the bounds
 * with the specified resolution
 */
function generateGrid(
  bounds: [number, number, number, number],
  resolutionKm: number,
  centerLat: number
): GeoJSON.FeatureCollection {
  const [west, south, east, north] = bounds;

  // Convert km to degrees
  // 1 degree latitude = ~111km everywhere
  const latDeg = resolutionKm / 111;

  // 1 degree longitude = ~111km * cos(lat)
  const lngDeg = resolutionKm / (111 * Math.cos((centerLat * Math.PI) / 180));

  const features: GeoJSON.Feature[] = [];

  // Add padding of 1 cell on each side
  const paddedWest = west - lngDeg;
  const paddedEast = east + lngDeg;
  const paddedSouth = south - latDeg;
  const paddedNorth = north + latDeg;

  // Align grid to model origin (0,0) by snapping to cell boundaries
  const startLng = Math.floor(paddedWest / lngDeg) * lngDeg;
  const startLat = Math.floor(paddedSouth / latDeg) * latDeg;

  let cellIndex = 0;

  // Generate grid cells
  for (let lat = startLat; lat < paddedNorth; lat += latDeg) {
    for (let lng = startLng; lng < paddedEast; lng += lngDeg) {
      // Create cell polygon (rectangle)
      const coordinates = [
        [
          [lng, lat],
          [lng + lngDeg, lat],
          [lng + lngDeg, lat + latDeg],
          [lng, lat + latDeg],
          [lng, lat] // Close the polygon
        ]
      ];

      features.push({
        type: 'Feature',
        properties: {
          index: cellIndex
        },
        geometry: {
          type: 'Polygon',
          coordinates
        }
      });

      cellIndex++;
    }
  }

  return {
    type: 'FeatureCollection',
    features
  };
}

export default function WeatherGrid({ visible, center, bounds, resolution }: WeatherGridProps) {
  // Generate grid GeoJSON
  const gridData = useMemo(() => {
    if (!visible) return null;
    return generateGrid(bounds, resolution, center.lat);
  }, [visible, bounds, resolution, center.lat]);

  if (!visible || !gridData) {
    return null;
  }

  return (
    <>
      <Source id="weather-grid" type="geojson" data={gridData}>
        {/* Fill layer - alternating light/dark for visibility */}
        <Layer
          id="weather-grid-fill"
          type="fill"
          paint={{
            'fill-color': [
              'case',
              ['==', ['%', ['get', 'index'], 2], 0],
              '#ffffff',
              '#cccccc'
            ],
            'fill-opacity': 0.05
          }}
        />
        {/* Line layer - grid borders */}
        <Layer
          id="weather-grid-line"
          type="line"
          paint={{
            'line-color': '#ffffff',
            'line-width': 1,
            'line-opacity': 0.3,
            'line-dasharray': [2, 2]
          }}
        />
      </Source>

      {/* Resolution label in top-left corner */}
      <div className="absolute top-4 left-4 bg-zinc-900 bg-opacity-80 px-3 py-2 rounded border border-zinc-700 text-xs font-medium z-10">
        <div className="text-zinc-100">Weather Grid</div>
        <div className="text-zinc-400">{resolution}km resolution</div>
      </div>
    </>
  );
}
