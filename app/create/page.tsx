'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import GPXUpload from '../components/upload/GPXUpload';
import { parseGPX } from '@we-gold/gpxjs';
import WaypointList from '../components/waypoint/WaypointList';
import WaypointEditor from '../components/waypoint/WaypointEditor';
import { Waypoint, WaypointType } from '../components/map/WaypointMarker';
import {
  createRoute,
  updateRoute,
  getRoute,
  addWaypoint
} from '../lib/api';

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

// Extended waypoint with backend ID for syncing
interface WaypointWithBackend extends Waypoint {
  backendId?: number;
}

// Inner component that uses useSearchParams
function CreateRouteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeIdParam = searchParams.get('id');

  const [trackGeojson, setTrackGeojson] = useState<GeoJSON.Feature | null>(null);
  const [routeName, setRouteName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Waypoint state
  const [waypoints, setWaypoints] = useState<WaypointWithBackend[]>([]);
  const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>(null);

  // Route persistence state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [currentRouteId, setCurrentRouteId] = useState<number | null>(
    routeIdParam ? parseInt(routeIdParam) : null
  );

  // Check if user is logged in
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  // Load existing route when editing
  useEffect(() => {
    if (currentRouteId) {
      loadExistingRoute(currentRouteId);
    }
  }, [currentRouteId]);

  // Unsaved changes warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  async function loadExistingRoute(id: number) {
    try {
      setIsLoading(true);
      setError(null);
      const route = await getRoute(id);

      setRouteName(route.name);

      if (route.gpx_data?.track_geojson) {
        setTrackGeojson(route.gpx_data.track_geojson);
      }

      // Convert backend waypoints to frontend format
      setWaypoints(route.waypoints.map(wp => ({
        id: String(wp.id), // Frontend uses string IDs
        backendId: wp.id,  // Keep backend ID for updates
        lat: wp.lat,
        lng: wp.lng,
        name: wp.name,
        type: wp.type as WaypointType,
        smsCode: wp.sms_code,
        elevation: wp.elevation
      })));

      setIsDirty(false);
    } catch (e) {
      setError('Failed to load route. Please check you are logged in.');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    if (!token) {
      // Redirect to login, then back here
      const returnUrl = `/create${currentRouteId ? `?id=${currentRouteId}` : ''}`;
      router.push(`/login?redirect=${encodeURIComponent(returnUrl)}`);
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      let routeIdToUse = currentRouteId;

      // Create route if new
      if (!routeIdToUse) {
        const newRoute = await createRoute({
          name: routeName || 'Untitled Route',
          gpx_data: trackGeojson ? {
            track_geojson: trackGeojson,
            metadata: { name: routeName }
          } : undefined
        });
        routeIdToUse = newRoute.id;
        setCurrentRouteId(routeIdToUse);

        // Update URL without full reload
        window.history.replaceState({}, '', `/create?id=${routeIdToUse}`);
      } else {
        // Update existing route
        await updateRoute(routeIdToUse, {
          name: routeName,
          gpx_data: trackGeojson ? {
            track_geojson: trackGeojson,
            metadata: { name: routeName }
          } : undefined
        });
      }

      // Sync new waypoints to backend
      const updatedWaypoints = [...waypoints];
      for (let i = 0; i < updatedWaypoints.length; i++) {
        const wp = updatedWaypoints[i];
        if (!wp.backendId) {
          // New waypoint - create on backend
          const created = await addWaypoint(routeIdToUse, {
            name: wp.name,
            type: wp.type,
            lat: wp.lat,
            lng: wp.lng,
            elevation: wp.elevation
          });
          updatedWaypoints[i] = {
            ...wp,
            backendId: created.id,
            smsCode: created.sms_code // Use server-generated code
          };
        }
      }
      setWaypoints(updatedWaypoints);

      setIsDirty(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save route');
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  }

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
        setIsDirty(true);
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
    const newWaypoint: WaypointWithBackend = {
      id: crypto.randomUUID(),
      lat,
      lng,
      name: defaultName,
      type: 'poi',
      smsCode: generateSMSCode(defaultName, existingCodes)
    };
    setWaypoints([...waypoints, newWaypoint]);
    setSelectedWaypointId(newWaypoint.id);
    setIsDirty(true);
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
    setIsDirty(true);
  };

  const handleWaypointDrag = (id: string, lat: number, lng: number) => {
    setWaypoints(waypoints.map(wp =>
      wp.id === id ? { ...wp, lat, lng } : wp
    ));
    setIsDirty(true);
  };

  const handleWaypointDelete = (id: string) => {
    setWaypoints(waypoints.filter(wp => wp.id !== id));
    if (selectedWaypointId === id) {
      setSelectedWaypointId(null);
    }
    setIsDirty(true);
  };

  const handleRouteNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRouteName(e.target.value);
    setIsDirty(true);
  };

  const selectedWaypoint = waypoints.find(w => w.id === selectedWaypointId) || null;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">
          {currentRouteId ? 'Edit Route' : 'Create Your Route'}
        </h1>
        <p className="text-gray-400 mb-8">
          Upload a GPX file from your favorite hiking app, then add waypoints for weather forecasts.
        </p>

        {!trackGeojson && !isLoading && (
          <>
            <p className="text-gray-300 mb-4">
              Upload a GPX file of your route or select one from the library
            </p>
            <GPXUpload onUpload={handleGPXUpload} isLoading={isLoading} />
          </>
        )}

        {isLoading && !trackGeojson && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-400">Loading route...</span>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {trackGeojson && (
          <div className="mt-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <div className="flex-1 max-w-md">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Route Name
                </label>
                <input
                  type="text"
                  value={routeName}
                  onChange={handleRouteNameChange}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="My Awesome Hike"
                />
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className={`
                    px-6 py-2 rounded-lg font-medium transition-colors
                    ${isSaving
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : isDirty
                        ? 'bg-blue-600 text-white hover:bg-blue-500'
                        : 'bg-green-700 text-green-200 cursor-default'}
                  `}
                >
                  {isSaving ? 'Saving...' : isDirty ? 'Save Draft' : 'Saved'}
                </button>

                {!token && (
                  <p className="text-sm text-yellow-400">
                    Log in to save your route
                  </p>
                )}

                {saveError && (
                  <p className="text-sm text-red-400">{saveError}</p>
                )}
              </div>
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
                  onSave={handleSave}
                  onClose={() => setSelectedWaypointId(null)}
                />
              </div>
            </div>

            {/* Finalize button */}
            <div className="mt-8 flex flex-col items-center">
              <button
                onClick={handleSave}
                disabled={isSaving || !isDirty}
                className={`
                  px-8 py-3 rounded-lg font-semibold text-lg transition-colors
                  ${isSaving || !isDirty
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-500'}
                `}
              >
                {isSaving ? 'Saving...' : 'Finalize Route'}
              </button>
              <p className="mt-2 text-sm text-gray-500">
                (don&apos;t worry you can edit it at any time)
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Wrap in Suspense for useSearchParams
export default function CreateRoutePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    }>
      <CreateRouteContent />
    </Suspense>
  );
}
