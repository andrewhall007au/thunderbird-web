'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import GPXUpload from '../components/upload/GPXUpload';
import { parseGPX } from '@we-gold/gpxjs';
import WaypointList from '../components/waypoint/WaypointList';
import WaypointEditor from '../components/waypoint/WaypointEditor';
import { Waypoint } from '../components/map/WaypointMarker';

// Dynamic import to avoid SSR issues with MapLibre
const MapEditor = dynamic(() => import('../components/map/MapEditor'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] md:h-[600px] bg-gray-900 rounded-lg animate-pulse flex items-center justify-center">
      <p className="text-gray-500">Loading map...</p>
    </div>
  )
});

// Reserved SMS codes that cannot be used (per 03-02 plan)
const RESERVED_CODES = ['HELP', 'STOP', 'START', 'YES', 'NO', 'INFO'];

// SMS code generation (client-side preview, server validates on save)
function generateSMSCode(name: string, existingCodes: string[]): string {
  // Remove common prefixes per 03-RESEARCH.md decision
  const cleaned = name
    .replace(/^(Mt\.?|Mount|Lake|The|Camp|Point|Peak)\s+/i, '')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase();

  let code = cleaned.slice(0, 5).padEnd(5, 'X');

  // Handle collisions with numeric suffix
  let suffix = 1;
  while (existingCodes.includes(code) || RESERVED_CODES.includes(code)) {
    code = cleaned.slice(0, 4) + suffix;
    suffix++;
  }

  return code;
}

export default function CreateRoutePage() {
  const [trackGeojson, setTrackGeojson] = useState<GeoJSON.Feature | null>(null);
  const [routeName, setRouteName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Waypoint state
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>(null);

  const handleGPXUpload = async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      const text = await file.text();
      const [result, err] = parseGPX(text);

      if (err) {
        throw new Error('Failed to parse GPX file');
      }

      // Convert to GeoJSON
      const geojson = result.toGeoJSON();

      // Find the track feature - cast to unknown first due to library type mismatch
      const features = geojson.features as unknown as GeoJSON.Feature[];
      const track = features.find(
        (f) => f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString'
      );

      if (track) {
        setTrackGeojson(track as GeoJSON.Feature);
        // Set default route name from GPX metadata or filename
        setRouteName(result.metadata?.name || file.name.replace('.gpx', ''));
      } else {
        setError('No track found in GPX file');
      }
    } catch (e) {
      setError('Failed to parse GPX file. Please check the format.');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // Waypoint handlers
  const handleMapClick = (lat: number, lng: number) => {
    const existingCodes = waypoints.map(w => w.smsCode);
    const defaultName = `Waypoint ${waypoints.length + 1}`;
    const newWaypoint: Waypoint = {
      id: crypto.randomUUID(),
      lat,
      lng,
      name: defaultName,
      type: 'poi',
      smsCode: generateSMSCode(defaultName, existingCodes)
    };
    setWaypoints([...waypoints, newWaypoint]);
    setSelectedWaypointId(newWaypoint.id);
  };

  const handleWaypointUpdate = (id: string, updates: Partial<Waypoint>) => {
    setWaypoints(waypoints.map(wp => {
      if (wp.id !== id) return wp;
      const updated = { ...wp, ...updates };
      // Regenerate SMS code if name changed
      if (updates.name && updates.name !== wp.name) {
        const existingCodes = waypoints.filter(w => w.id !== id).map(w => w.smsCode);
        updated.smsCode = generateSMSCode(updates.name, existingCodes);
      }
      return updated;
    }));
  };

  const handleWaypointDrag = (id: string, lat: number, lng: number) => {
    setWaypoints(waypoints.map(wp =>
      wp.id === id ? { ...wp, lat, lng } : wp
    ));
  };

  const handleWaypointDelete = (id: string) => {
    setWaypoints(waypoints.filter(wp => wp.id !== id));
    if (selectedWaypointId === id) {
      setSelectedWaypointId(null);
    }
  };

  const selectedWaypoint = waypoints.find(w => w.id === selectedWaypointId) || null;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Create Your Route</h1>
        <p className="text-gray-400 mb-8">
          Upload a GPX file from your favorite hiking app, then add waypoints for weather forecasts.
        </p>

        {!trackGeojson && (
          <GPXUpload onUpload={handleGPXUpload} isLoading={isLoading} />
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {trackGeojson && (
          <div className="mt-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Route Name
              </label>
              <input
                type="text"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                className="w-full max-w-md px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="My Awesome Hike"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Map takes 2 columns on large screens */}
              <div className="lg:col-span-2">
                <h2 className="text-xl font-semibold mb-4">Your Route</h2>
                <MapEditor
                  trackGeojson={trackGeojson}
                  waypoints={waypoints}
                  selectedWaypointId={selectedWaypointId}
                  onMapClick={handleMapClick}
                  onWaypointSelect={setSelectedWaypointId}
                  onWaypointDrag={handleWaypointDrag}
                  onWaypointDelete={handleWaypointDelete}
                />
                <p className="mt-2 text-sm text-gray-500">
                  Click on the map to add waypoints. Drag to reposition. Press Delete to remove.
                </p>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <WaypointList
                  waypoints={waypoints}
                  selectedId={selectedWaypointId}
                  onSelect={setSelectedWaypointId}
                />

                <WaypointEditor
                  waypoint={selectedWaypoint}
                  onUpdate={handleWaypointUpdate}
                  onDelete={handleWaypointDelete}
                  onClose={() => setSelectedWaypointId(null)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
