'use client';

import { useState, useRef, useEffect } from 'react';
import Map, { Source, Layer, Marker, NavigationControl, MapRef, MapLayerMouseEvent } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Pin } from '../page';

interface PrototypeMapProps {
  trailGeojson: GeoJSON.Feature | null;
  pins: Pin[];
  onMapClick: (lat: number, lng: number) => void;
  onPinRemove: (id: string) => void;
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

  for (const coord of coords) {
    const lng = coord[0];
    const lat = coord[1];
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return [[minLng, minLat], [maxLng, maxLat]];
}

export default function PrototypeMap({
  trailGeojson,
  pins,
  onMapClick,
  onPinRemove
}: PrototypeMapProps) {
  const [viewState, setViewState] = useState({
    latitude: 39.8,
    longitude: -98.5,
    zoom: 4
  });
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const mapRef = useRef<MapRef>(null);

  // OpenTopoMap basemap style
  const topoStyle = {
    version: 8 as const,
    sources: {
      'topo-tiles': {
        type: 'raster' as const,
        tiles: ['https://tile.opentopomap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenTopoMap contributors'
      }
    },
    layers: [
      {
        id: 'topo',
        type: 'raster' as const,
        source: 'topo-tiles'
      }
    ]
  };

  // Fit map to trail bounds when trail changes
  useEffect(() => {
    if (trailGeojson && mapRef.current) {
      const bounds = getBoundsFromGeojson(trailGeojson);
      if (bounds) {
        mapRef.current.fitBounds(bounds, {
          padding: 40,
          duration: 1000
        });
      }
    }
  }, [trailGeojson]);

  // Handle map click to add pin
  const handleMapClick = (e: MapLayerMouseEvent) => {
    // Don't add pin if clicking on a marker
    if (e.originalEvent.target instanceof HTMLElement &&
        e.originalEvent.target.closest('.pin-marker')) {
      return;
    }
    onMapClick(e.lngLat.lat, e.lngLat.lng);
  };

  // Handle pin marker click
  const handlePinClick = (pinId: string) => {
    if (selectedPinId === pinId) {
      // Second click removes the pin
      onPinRemove(pinId);
      setSelectedPinId(null);
    } else {
      // First click selects it
      setSelectedPinId(pinId);
    }
  };

  return (
    <Map
      ref={mapRef}
      {...viewState}
      onMove={evt => setViewState(evt.viewState)}
      mapStyle={topoStyle}
      style={{ width: '100%', height: '100%' }}
      onClick={handleMapClick}
      touchPitch={false}
    >
      {/* Navigation controls */}
      <NavigationControl position="top-right" />

      {/* Trail line rendering */}
      {trailGeojson && (
        <Source id="trail-line" type="geojson" data={trailGeojson}>
          {/* White border for contrast */}
          <Layer
            id="trail-border"
            type="line"
            paint={{
              'line-color': '#ffffff',
              'line-width': 5,
              'line-opacity': 0.8
            }}
          />
          {/* Magenta trail line */}
          <Layer
            id="trail-main"
            type="line"
            paint={{
              'line-color': '#FF10F0',
              'line-width': 3
            }}
          />
        </Source>
      )}

      {/* Pin markers */}
      {pins.map(pin => (
        <Marker
          key={pin.id}
          latitude={pin.lat}
          longitude={pin.lng}
          anchor="bottom"
        >
          <div
            className="pin-marker cursor-pointer relative"
            onClick={() => handlePinClick(pin.id)}
            title={`${pin.lat.toFixed(3)}°, ${pin.lng.toFixed(3)}°`}
          >
            {/* Pin circle with stem */}
            <div className="relative">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center
                  text-white font-bold text-sm shadow-lg
                  transition-all
                  ${selectedPinId === pin.id
                    ? 'bg-yellow-500 ring-4 ring-yellow-300 scale-110'
                    : 'bg-blue-500 hover:bg-blue-600'
                  }
                `}
              >
                {pin.label}
              </div>
              {/* Stem pointing down */}
              <div
                className={`
                  absolute left-1/2 -translate-x-1/2 top-full
                  w-1 h-2
                  ${selectedPinId === pin.id ? 'bg-yellow-500' : 'bg-blue-500'}
                `}
              />
            </div>
          </div>
        </Marker>
      ))}
    </Map>
  );
}
