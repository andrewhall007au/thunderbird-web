'use client';

import { useState, useCallback } from 'react';
import Map, { NavigationControl, MapLayerMouseEvent } from 'react-map-gl/maplibre';
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
