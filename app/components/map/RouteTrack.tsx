'use client';

import { Source, Layer } from 'react-map-gl/maplibre';

interface RouteTrackProps {
  geojson: GeoJSON.Feature;
}

export default function RouteTrack({ geojson }: RouteTrackProps) {
  return (
    <Source id="route-track" type="geojson" data={geojson}>
      <Layer
        id="route-line"
        type="line"
        paint={{
          'line-color': '#3b82f6',
          'line-width': 3,
          'line-opacity': 0.8
        }}
      />
    </Source>
  );
}
