'use client';

import { useState, useCallback } from 'react';
import Map, { NavigationControl, MapLayerMouseEvent } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import RouteTrack from './RouteTrack';

interface MapEditorProps {
  trackGeojson?: GeoJSON.Feature;
  onMapClick?: (lat: number, lng: number) => void;
  initialViewport?: {
    latitude: number;
    longitude: number;
    zoom: number;
  };
}

export default function MapEditor({
  trackGeojson,
  onMapClick,
  initialViewport = { latitude: -42.0, longitude: 146.0, zoom: 8 }
}: MapEditorProps) {
  const [viewState, setViewState] = useState(initialViewport);

  const handleClick = useCallback((e: MapLayerMouseEvent) => {
    if (onMapClick) {
      onMapClick(e.lngLat.lat, e.lngLat.lng);
    }
  }, [onMapClick]);

  return (
    <div className="w-full h-[500px] md:h-[600px] rounded-lg overflow-hidden">
      <Map
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        mapStyle="https://tiles.openfreemap.org/styles/liberty"
        onClick={handleClick}
        cooperativeGestures={true}
        attributionControl={{ compact: true }}
      >
        <NavigationControl position="top-right" />
        {trackGeojson && <RouteTrack geojson={trackGeojson} />}
      </Map>
    </div>
  );
}
