'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Map, { NavigationControl, MapLayerMouseEvent, MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import RouteTrack from './RouteTrack';
import WaypointMarker, { Waypoint } from './WaypointMarker';

interface MapEditorProps {
  trackGeojson?: GeoJSON.Feature;
  waypoints?: Waypoint[];
  selectedWaypointId?: string | null;
  onMapClick?: (lat: number, lng: number) => void;
  onWaypointSelect?: (id: string) => void;
  onWaypointDrag?: (id: string, lat: number, lng: number) => void;
  onWaypointDelete?: (id: string) => void;
  initialViewport?: {
    latitude: number;
    longitude: number;
    zoom: number;
  };
}

// Calculate bounding box from GeoJSON coordinates
function getBoundsFromGeojson(geojson: GeoJSON.Feature): [[number, number], [number, number]] | null {
  const geometry = geojson.geometry;
  if (geometry.type !== 'LineString' && geometry.type !== 'MultiLineString') {
    return null;
  }

  const coords = geometry.type === 'LineString'
    ? geometry.coordinates
    : geometry.coordinates.flat();

  if (coords.length === 0) return null;

  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;

  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return [[minLng, minLat], [maxLng, maxLat]];
}

export default function MapEditor({
  trackGeojson,
  waypoints = [],
  selectedWaypointId,
  onMapClick,
  onWaypointSelect,
  onWaypointDrag,
  onWaypointDelete,
  initialViewport = { latitude: -42.0, longitude: 146.0, zoom: 8 }
}: MapEditorProps) {
  const [viewState, setViewState] = useState(initialViewport);
  const mapRef = useRef<MapRef>(null);
  const hasFittedBounds = useRef(false);

  // Zoom to fit GPX track when loaded
  useEffect(() => {
    if (trackGeojson && mapRef.current && !hasFittedBounds.current) {
      const bounds = getBoundsFromGeojson(trackGeojson);
      if (bounds) {
        mapRef.current.fitBounds(bounds, {
          padding: 50,
          duration: 1000
        });
        hasFittedBounds.current = true;
      }
    }
  }, [trackGeojson]);

  // Reset fitted bounds flag when track changes
  useEffect(() => {
    if (!trackGeojson) {
      hasFittedBounds.current = false;
    }
  }, [trackGeojson]);

  const handleClick = useCallback((e: MapLayerMouseEvent) => {
    if (onMapClick) {
      onMapClick(e.lngLat.lat, e.lngLat.lng);
    }
  }, [onMapClick]);

  return (
    <div className="w-full h-[500px] md:h-[600px] rounded-lg overflow-hidden">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        mapStyle="https://tiles.openfreemap.org/styles/liberty"
        onClick={handleClick}
        cooperativeGestures={true}
        attributionControl={{ compact: true }}
      >
        <NavigationControl position="top-right" />
        {trackGeojson && <RouteTrack geojson={trackGeojson} />}
        {waypoints.map((wp) => (
          <WaypointMarker
            key={wp.id}
            waypoint={wp}
            isSelected={selectedWaypointId === wp.id}
            onSelect={onWaypointSelect}
            onDragEnd={onWaypointDrag}
            onDelete={onWaypointDelete}
          />
        ))}
      </Map>
    </div>
  );
}
