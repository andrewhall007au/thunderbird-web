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
          'line-color': '#00FFFF',
          'line-width': 4,
          'line-opacity': 0.9
        }}
      />
    </Source>
  );
}
