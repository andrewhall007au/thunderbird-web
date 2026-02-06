'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Map, { NavigationControl, MapLayerMouseEvent, MapRef, Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import RouteTrack from './RouteTrack';
import WaypointMarker, { Waypoint } from './WaypointMarker';
import { Mountain, Map as MapIcon } from 'lucide-react';

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
  centerOn?: {
    latitude: number;
    longitude: number;
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

type MapStyle = 'street' | 'topo';

export default function MapEditor({
  trackGeojson,
  waypoints = [],
  selectedWaypointId,
  onMapClick,
  onWaypointSelect,
  onWaypointDrag,
  onWaypointDelete,
  initialViewport = { latitude: -42.0, longitude: 146.0, zoom: 8 },
  centerOn
}: MapEditorProps) {
  const [viewState, setViewState] = useState(initialViewport);
  const [mapStyle, setMapStyle] = useState<MapStyle>('street');
  const mapRef = useRef<MapRef>(null);
  const hasFittedBounds = useRef(false);

  // Handle centering on a new location
  useEffect(() => {
    if (centerOn && mapRef.current) {
      mapRef.current.flyTo({
        center: [centerOn.longitude, centerOn.latitude],
        zoom: 13,
        duration: 1500
      });
    }
  }, [centerOn]);

  const getMapStyle = () => {
    if (mapStyle === 'topo') {
      // OpenTopoMap style for topographic view
      return {
        version: 8,
        sources: {
          'opentopomap': {
            type: 'raster',
            tiles: ['https://tile.opentopomap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenTopoMap contributors'
          }
        },
        layers: [
          {
            id: 'opentopomap',
            type: 'raster',
            source: 'opentopomap',
            minzoom: 0,
            maxzoom: 22
          }
        ]
      };
    }
    return 'https://tiles.openfreemap.org/styles/liberty';
  };

  // Fit bounds when GPX track changes
  const fitToBounds = useCallback(() => {
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

  // Zoom to fit GPX track when loaded - also handle map load event
  useEffect(() => {
    fitToBounds();
  }, [fitToBounds]);

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
    <div className="w-full h-[500px] md:h-[600px] rounded-lg overflow-hidden relative">
      {/* Map Style Toggle */}
      <div className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow-lg border border-zinc-200 overflow-hidden flex">
        <button
          onClick={() => setMapStyle('street')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
            mapStyle === 'street'
              ? 'bg-orange-500 text-white'
              : 'bg-white text-zinc-700 hover:bg-zinc-50'
          }`}
          title="Street Map"
        >
          <MapIcon className="w-4 h-4" />
          <span>Street</span>
        </button>
        <button
          onClick={() => setMapStyle('topo')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-l border-zinc-200 ${
            mapStyle === 'topo'
              ? 'bg-orange-500 text-white'
              : 'bg-white text-zinc-700 hover:bg-zinc-50'
          }`}
          title="Topographic Map"
        >
          <Mountain className="w-4 h-4" />
          <span>Topo</span>
        </button>
      </div>

      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        onLoad={fitToBounds}
        mapStyle={getMapStyle()}
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
