'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Map, { Source, Layer, Marker, NavigationControl, MapRef, MapLayerMouseEvent } from 'react-map-gl/maplibre';
import { LocateFixed } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Grid } from 'lucide-react';
import type { Pin } from '../lib/types';
import WeatherGrid from './WeatherGrid';
import BomGrid from './BomGrid';
import { calculateSeverity, SEVERITY_COLORS, type SeverityLevel } from '../lib/severity';

interface PrototypeMapProps {
  trailGeojson: GeoJSON.Feature | null;
  pins: Pin[];
  currentHour: number;
  onMapClick: (lat: number, lng: number) => void;
  onPinRemove: (id: string) => void;
  gridVisible: boolean;
  onGridToggle: () => void;
  mode?: 'online' | 'offline';
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

// Calculate trail center for grid resolution
function getTrailCenter(geojson: GeoJSON.Feature): { lat: number; lng: number } | null {
  const geometry = geojson.geometry;
  if (geometry.type !== 'LineString' && geometry.type !== 'MultiLineString') {
    return null;
  }

  const coords = geometry.type === 'LineString'
    ? geometry.coordinates
    : geometry.coordinates.flat();

  if (coords.length === 0) return null;

  let sumLng = 0, sumLat = 0;
  for (const coord of coords) {
    sumLng += coord[0];
    sumLat += coord[1];
  }

  return {
    lat: sumLat / coords.length,
    lng: sumLng / coords.length
  };
}

// Infer grid resolution based on trail location
function getGridResolution(center: { lat: number; lng: number }): number {
  if (center.lat >= 24 && center.lat <= 50 && center.lng >= -130 && center.lng <= -60) {
    return 3;
  }
  return 13;
}

export default function PrototypeMap({
  trailGeojson,
  pins,
  currentHour,
  onMapClick,
  onPinRemove,
  gridVisible,
  onGridToggle,
  mode = 'online'
}: PrototypeMapProps) {
  const [viewState, setViewState] = useState({
    latitude: 39.8,
    longitude: -98.5,
    zoom: 4
  });
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [mapBounds, setMapBounds] = useState<{ west: number; south: number; east: number; north: number } | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const mapRef = useRef<MapRef>(null);
  const hasGeolocated = useRef(false);

  // Auto-locate user on first load
  useEffect(() => {
    if (hasGeolocated.current) return;
    hasGeolocated.current = true;

    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        // Only fly to user location if no trail is selected
        if (!trailGeojson && mapRef.current) {
          mapRef.current.flyTo({ center: [loc.lng, loc.lat], zoom: 10, duration: 1500 });
        }
      },
      () => { /* permission denied or error — ignore silently */ },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fly to user location on button press
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        mapRef.current?.flyTo({ center: [loc.lng, loc.lat], zoom: 12, duration: 1000 });
      },
      () => { /* ignore */ },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // OSM basemap style (fast tile servers)
  const mapStyle = {
    version: 8 as const,
    sources: {
      'osm-tiles': {
        type: 'raster' as const,
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors'
      }
    },
    layers: [
      {
        id: 'osm',
        type: 'raster' as const,
        source: 'osm-tiles'
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
        // Update mapBounds after animation completes
        setTimeout(() => {
          const b = mapRef.current?.getBounds();
          if (b) setMapBounds({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() });
        }, 1100);
      }
    }
  }, [trailGeojson]);

  // Handle map click to add pin
  const handleMapClick = (e: MapLayerMouseEvent) => {
    if (e.originalEvent.target instanceof HTMLElement &&
        e.originalEvent.target.closest('.pin-marker')) {
      return;
    }
    onMapClick(e.lngLat.lat, e.lngLat.lng);
  };

  // Handle pin marker click
  const handlePinClick = (pinId: string) => {
    if (selectedPinId === pinId) {
      onPinRemove(pinId);
      setSelectedPinId(null);
    } else {
      setSelectedPinId(pinId);
    }
  };

  // Calculate grid properties
  const trailCenter = trailGeojson ? getTrailCenter(trailGeojson) : null;
  const trailBounds = trailGeojson ? getBoundsFromGeojson(trailGeojson) : null;
  const gridResolution = trailCenter ? getGridResolution(trailCenter) : 13;

  return (
    <Map
      ref={mapRef}
      {...viewState}
      onMove={evt => {
        setViewState(evt.viewState);
        const b = mapRef.current?.getBounds();
        if (b) setMapBounds({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() });
      }}
      mapStyle={mapStyle}
      style={{ width: '100%', height: '100%' }}
      onClick={handleMapClick}
      onLoad={() => {
        const b = mapRef.current?.getBounds();
        if (b) setMapBounds({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() });
      }}
      scrollZoom={true}
      keyboard={true}
      touchPitch={false}
    >
      {/* Navigation controls */}
      <NavigationControl position="top-right" />

      {/* BOM geohash6 grid — faint mesh, visible at zoom >= 10 */}
      <BomGrid zoom={viewState.zoom} bounds={mapBounds} />

      {/* Locate me button */}
      <div className="absolute top-4 left-4 z-10">
        <button
          onClick={handleLocateMe}
          className="p-2 rounded shadow-lg bg-white text-zinc-900 hover:bg-zinc-100 transition-colors"
          title="Go to my location"
        >
          <LocateFixed className="w-5 h-5" />
        </button>
      </div>

      {/* User location marker */}
      {userLocation && (
        <Marker latitude={userLocation.lat} longitude={userLocation.lng} anchor="center">
          <div className="relative">
            <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg" />
            <div className="absolute inset-0 w-4 h-4 bg-blue-400 rounded-full animate-ping opacity-40" />
          </div>
        </Marker>
      )}

      {/* Grid toggle button (online only) */}
      {mode === 'online' && (
        <div className="absolute top-4 right-16 z-10">
          <button
            onClick={onGridToggle}
            className={`
              p-2 rounded shadow-lg transition-colors
              ${gridVisible
                ? 'bg-blue-600 text-white'
                : 'bg-white text-zinc-900 hover:bg-zinc-100'
              }
            `}
            title="Toggle weather grid"
          >
            <Grid className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Weather grid overlay (online only) */}
      {mode === 'online' && gridVisible && trailCenter && trailBounds && (
        <WeatherGrid
          visible={gridVisible}
          center={trailCenter}
          bounds={[trailBounds[0][0], trailBounds[0][1], trailBounds[1][0], trailBounds[1][1]]}
          resolution={gridResolution}
        />
      )}

      {/* Trail line rendering */}
      {trailGeojson && (
        <Source id="trail-line" type="geojson" data={trailGeojson}>
          <Layer
            id="trail-border"
            type="line"
            paint={{
              'line-color': '#ffffff',
              'line-width': 5,
              'line-opacity': 0.8
            }}
          />
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
      {pins.map(pin => {
        let severityLevel: SeverityLevel = 'green';
        let dangerStr = '';
        let bgColor = '#3b82f6'; // Default blue for loading/no data/offline

        if (mode === 'online' && pin.forecast && !pin.loading) {
          const hourlyData = pin.forecast.hourly[currentHour] || pin.forecast.hourly[0];
          if (hourlyData) {
            const severity = calculateSeverity(hourlyData, pin.forecast.elevation);
            severityLevel = severity.level;
            dangerStr = severity.danger;
            bgColor = SEVERITY_COLORS[severityLevel].bg;
          }
        }

        const isSelected = selectedPinId === pin.id;
        const shouldPulse = dangerStr === '!!' || dangerStr === '!!!';
        const pinLabel = dangerStr ? `${pin.label}${dangerStr}` : pin.label;

        return (
          <Marker
            key={pin.id}
            latitude={pin.lat}
            longitude={pin.lng}
            anchor="bottom"
          >
            <div
              className="pin-marker cursor-pointer relative"
              onClick={() => handlePinClick(pin.id)}
              title={`${pin.lat.toFixed(3)}, ${pin.lng.toFixed(3)}`}
            >
              <div className="relative p-2 -m-2">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    text-white font-bold shadow-lg
                    transition-all
                    ${isSelected ? 'ring-4 ring-yellow-300 scale-110' : ''}
                    ${shouldPulse ? 'animate-pulse-glow' : ''}
                  `}
                  style={{
                    backgroundColor: isSelected ? '#eab308' : bgColor,
                    fontSize: dangerStr ? '0.65rem' : '0.875rem'
                  }}
                >
                  {pinLabel}
                </div>
                {/* Stem pointing down */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 top-full w-1.5 h-3"
                  style={{
                    backgroundColor: isSelected ? '#eab308' : bgColor
                  }}
                />
              </div>
            </div>
          </Marker>
        );
      })}

      {/* CSS for pin pulse animation */}
      <style jsx global>{`
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 8px rgba(239, 68, 68, 0.6), 0 0 16px rgba(239, 68, 68, 0.4);
          }
          50% {
            box-shadow: 0 0 16px rgba(239, 68, 68, 0.8), 0 0 24px rgba(239, 68, 68, 0.6);
          }
        }
        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
      `}</style>
    </Map>
  );
}
