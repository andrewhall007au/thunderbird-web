'use client';

import { Source, Layer } from 'react-map-gl/maplibre';
import { useMemo } from 'react';
import { useAuth } from '@/app/lib/auth';

interface RouteTrackProps {
  geojson: GeoJSON.Feature;
}

// Haversine distance in km between two [lng, lat] coordinates
function haversineKm(a: number[], b: number[]): number {
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// Place a marker every 1km (metric) or 1 mile (imperial) along the route
function samplePoints(geojson: GeoJSON.Feature, unitSystem: string): GeoJSON.FeatureCollection {
  const geometry = geojson.geometry;
  if (geometry.type !== 'LineString') {
    return { type: 'FeatureCollection', features: [] };
  }

  const coords = geometry.coordinates;
  if (coords.length === 0) return { type: 'FeatureCollection', features: [] };

  const MILE_KM = 1.60934;
  const INTERVAL_KM = unitSystem === 'imperial' ? MILE_KM : 1;
  const points: GeoJSON.Feature[] = [{
    type: 'Feature',
    properties: {},
    geometry: { type: 'Point', coordinates: coords[0] }
  }];

  let accumulated = 0;

  for (let i = 1; i < coords.length; i++) {
    accumulated += haversineKm(coords[i - 1], coords[i]);
    if (accumulated >= INTERVAL_KM) {
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

export default function RouteTrack({ geojson }: RouteTrackProps) {
  let unitSystem = 'metric';
  try {
    const auth = useAuth();
    unitSystem = auth.account?.unit_system || 'metric';
  } catch {
    // useAuth unavailable (e.g. outside AuthProvider) — default to metric
  }

  const markerPoints = useMemo(() => samplePoints(geojson, unitSystem), [geojson, unitSystem]);

  return (
    <>
      <Source id="route-track" type="geojson" data={geojson}>
        <Layer
          id="route-line-border"
          type="line"
          paint={{
            'line-color': '#FFFFFF',
            'line-width': 6,
            'line-opacity': 0.6
          }}
        />
        <Layer
          id="route-line"
          type="line"
          paint={{
            'line-color': '#FF10F0',
            'line-width': 3,
            'line-opacity': 0.95
          }}
        />
      </Source>
      <Source id="route-markers" type="geojson" data={markerPoints}>
        <Layer
          id="route-marker-border"
          type="circle"
          paint={{
            'circle-radius': 6,
            'circle-color': '#FF10F0',
            'circle-opacity': 0.9
          }}
        />
        <Layer
          id="route-marker-fill"
          type="circle"
          paint={{
            'circle-radius': 3.75,
            'circle-color': '#FFFFFF',
            'circle-opacity': 1
          }}
        />
      </Source>
    </>
  );
}
