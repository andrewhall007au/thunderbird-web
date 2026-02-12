'use client';

import { useMemo } from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';

// Geohash6 cell dimensions in degrees
const GH6_LNG = 0.010986328125;
const GH6_LAT = 0.0054931640625;
const MAX_LINES = 500; // Safety cap

function generateGridLines(
  west: number,
  south: number,
  east: number,
  north: number
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  const startLng = Math.floor(west / GH6_LNG) * GH6_LNG;
  const startLat = Math.floor(south / GH6_LAT) * GH6_LAT;

  for (let lng = startLng; lng <= east && features.length < MAX_LINES; lng += GH6_LNG) {
    features.push({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [[lng, south], [lng, north]],
      },
    });
  }

  for (let lat = startLat; lat <= north && features.length < MAX_LINES; lat += GH6_LAT) {
    features.push({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [[west, lat], [east, lat]],
      },
    });
  }

  return { type: 'FeatureCollection', features };
}

interface BomGridProps {
  zoom: number;
  bounds: {
    west: number;
    south: number;
    east: number;
    north: number;
  } | null;
}

export default function BomGrid({ zoom, bounds }: BomGridProps) {
  const visible = zoom >= 8 && bounds !== null;

  const gridData = useMemo(() => {
    if (!visible || !bounds) return null;
    return generateGridLines(bounds.west, bounds.south, bounds.east, bounds.north);
  }, [visible, bounds]);

  if (!visible || !gridData) return null;

  return (
    <Source id="bom-grid" type="geojson" data={gridData}>
      <Layer
        id="bom-grid-lines"
        type="line"
        paint={{
          'line-color': '#64748b',
          'line-width': 0.8,
          'line-opacity': 0.4,
        }}
      />
    </Source>
  );
}
