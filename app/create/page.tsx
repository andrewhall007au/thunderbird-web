'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import GPXUpload from '../components/upload/GPXUpload';
import { parseGPX } from '@we-gold/gpxjs';
import WaypointList from '../components/waypoint/WaypointList';
import WaypointEditor from '../components/waypoint/WaypointEditor';
import { Waypoint, WaypointType } from '../components/map/WaypointMarker';
import TrailSelector from '../components/trails/TrailSelector';
import ElevationProfile from '../components/elevation/ElevationProfile';
import LocationSearch from '../components/map/LocationSearch';
import QuickLocationSearch from '../components/map/QuickLocationSearch';
import { TrailData, popularTrails } from '../data/popularTrails';
import { getElevation } from '../lib/elevation';
import {
  createRoute,
  updateRoute,
  getRoute,
  addWaypoint
} from '../lib/api';
import { trackRouteCreated } from '../lib/analytics';

// Dynamic import to avoid SSR issues with MapLibre
const MapEditor = dynamic(() => import('../components/map/MapEditor'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] md:h-[600px] bg-gray-50 rounded-lg animate-pulse flex items-center justify-center">
      <p className="text-gray-600">Loading map...</p>
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

type CreationMethod = 'library' | 'gpx' | 'manual' | null;

// Inner component that uses useSearchParams
function CreateRouteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeIdParam = searchParams.get('id');

  const [creationMethod, setCreationMethod] = useState<CreationMethod>(null);
  const [trackGeojson, setTrackGeojson] = useState<GeoJSON.Feature | null>(null);
  const [routeName, setRouteName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualLocation, setManualLocation] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [mapCenter, setMapCenter] = useState<{ latitude: number; longitude: number } | undefined>(undefined);
  const [isFetchingElevation, setIsFetchingElevation] = useState(false);

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
      // Auto-select creation method when editing
      setCreationMethod('gpx'); // Default to GPX for editing
    }
  }, [currentRouteId]);

  // Auto-load first trail when library method is selected
  useEffect(() => {
    if (creationMethod === 'library' && !trackGeojson) {
      const firstTrail = [...popularTrails].sort((a, b) => a.name.localeCompare(b.name))[0];
      if (firstTrail) {
        handleTrailSelect(firstTrail);
      }
    }
  }, [creationMethod]);

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

  // Standard save without redirect (for draft saves)
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
      return routeIdToUse;
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save route');
      console.error(e);
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  // Save and redirect to preview page
  async function handlePreviewSMS() {
    if (waypoints.length === 0) {
      setSaveError('Add at least one waypoint to preview');
      return;
    }

    if (!token) {
      // Redirect to login, then back here
      const returnUrl = `/create${currentRouteId ? `?id=${currentRouteId}` : ''}`;
      router.push(`/login?redirect=${encodeURIComponent(returnUrl)}`);
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const routeId = await handleSave();
      if (routeId) {
        // Track route_created analytics event
        trackRouteCreated(waypoints.length);
        // Redirect to preview page
        router.push(`/create/preview?id=${routeId}`);
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save route');
      console.error(e);
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
  const handleMapClick = async (lat: number, lng: number) => {
    const existingCodes = waypoints.map(w => w.smsCode);
    const defaultName = `Waypoint ${waypoints.length + 1}`;

    // Create waypoint immediately (without elevation)
    const tempId = crypto.randomUUID();
    const newWaypoint: WaypointWithBackend = {
      id: tempId,
      lat,
      lng,
      name: defaultName,
      type: 'poi',
      smsCode: generateSMSCode(defaultName, existingCodes)
    };
    setWaypoints([...waypoints, newWaypoint]);
    setSelectedWaypointId(tempId);
    setIsDirty(true);

    // Fetch elevation in background and update waypoint
    setIsFetchingElevation(true);
    const elevation = await getElevation(lat, lng);
    setIsFetchingElevation(false);

    if (elevation) {
      setWaypoints(prev => prev.map(wp =>
        wp.id === tempId ? { ...wp, elevation } : wp
      ));
    }
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

  const handleTrailSelect = (trail: TrailData) => {
    const geojson: GeoJSON.Feature = {
      type: 'Feature',
      properties: { name: trail.name },
      geometry: {
        type: 'LineString',
        coordinates: trail.coordinates
      }
    };
    setTrackGeojson(geojson);
    setRouteName(trail.name);
    setWaypoints([]);
    setSelectedWaypointId(null);
    setCurrentRouteId(null);
    setIsDirty(true);
  };

  const selectedWaypoint = waypoints.find(w => w.id === selectedWaypointId) || null;

  // Determine current step
  const hasSelectedMethod = creationMethod !== null;
  const hasTrackOrManual = trackGeojson !== null || (creationMethod === 'manual' && manualLocation !== null);
  const currentStep = !hasSelectedMethod ? 0 : !hasTrackOrManual ? 1 : waypoints.length === 0 ? 2 : 3;

  // Step indicator component
  const StepIndicator = ({ step, title, isActive, isComplete }: {
    step: number;
    title: string;
    isActive: boolean;
    isComplete: boolean;
  }) => (
    <div className="flex items-center gap-3">
      <span className={`
        flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg border-2
        ${isComplete
          ? 'bg-orange-500 text-white border-orange-500'
          : 'bg-white text-gray-900 border-gray-300'}
      `}>
        {isComplete ? '✓' : step}
      </span>
      <span className={`text-lg font-medium ${isActive || isComplete ? 'text-gray-900' : 'text-gray-600'}`}>
        {title}
      </span>
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">
          {currentRouteId ? 'Edit Route' : 'Create Your Route'}
        </h1>

        {/* Persistent Step Indicators - only show after method selected */}
        {hasSelectedMethod && (
          <div className="mb-6">
            <div className="space-y-3 mb-4">
              <StepIndicator step={1} title="Choose Route Source" isActive={currentStep === 1} isComplete={currentStep > 1} />
              <StepIndicator step={2} title="Set Waypoints on Map" isActive={currentStep === 2} isComplete={currentStep > 2} />
              <StepIndicator step={3} title="Preview SMS Forecast" isActive={currentStep === 3} isComplete={false} />
            </div>

            {/* Back to method selection button */}
            <button
              onClick={() => {
                setCreationMethod(null);
                setTrackGeojson(null);
                setWaypoints([]);
                setRouteName('');
                setManualLocation(null);
              }}
              className="btn-orange inline-flex items-center gap-2 px-8 py-3.5"
            >
              <span>←</span>
              <span>Back to method selection</span>
            </button>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {/* STEP 0: Choose Creation Method */}
        {currentStep === 0 && (
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-3">How do you want to create your route forecast?</h2>
            <p className="text-center text-zinc-600 mb-8">Choose the method that works best for you</p>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Library Route Option */}
              <button
                onClick={() => setCreationMethod('library')}
                className="group bg-white border-2 border-zinc-200 rounded-xl p-6 hover:border-orange-500 hover:shadow-lg transition-all text-left"
              >
                <div className="text-4xl mb-4">🥾</div>
                <h3 className="text-lg font-semibold text-zinc-900 mb-2 group-hover:text-orange-500">
                  Library Route
                </h3>
                <p className="text-sm text-zinc-600">
                  Choose from 25 popular trails around the world
                </p>
              </button>

              {/* GPX File Option */}
              <button
                onClick={() => setCreationMethod('gpx')}
                className="group bg-white border-2 border-zinc-200 rounded-xl p-6 hover:border-orange-500 hover:shadow-lg transition-all text-left"
              >
                <div className="text-4xl mb-4">📁</div>
                <h3 className="text-lg font-semibold text-zinc-900 mb-2 group-hover:text-orange-500">
                  GPX File
                </h3>
                <p className="text-sm text-zinc-600">
                  Upload from Gaia GPS, AllTrails, or any hiking app
                </p>
              </button>

              {/* Manual GPS Points Option */}
              <button
                onClick={() => setCreationMethod('manual')}
                className="group bg-white border-2 border-zinc-200 rounded-xl p-6 hover:border-orange-500 hover:shadow-lg transition-all text-left"
              >
                <div className="text-4xl mb-4">📍</div>
                <h3 className="text-lg font-semibold text-zinc-900 mb-2 group-hover:text-orange-500">
                  Search GPS Points
                </h3>
                <p className="text-sm text-zinc-600">
                  Manually place waypoints on the map
                </p>
              </button>
            </div>
          </div>
        )}

        {/* STEP 1: Based on chosen method */}
        {currentStep === 1 && !isLoading && (
          <>
            {/* Library Route - skip this, auto-loads first trail and goes to map */}

            {/* GPX File Upload */}
            {creationMethod === 'gpx' && (
              <div className="max-w-3xl mx-auto">
                <div className="bg-white rounded-xl p-8 border-2 border-zinc-200">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-4xl">📁</span>
                    <div>
                      <h2 className="text-2xl font-semibold text-zinc-900">Upload Your GPX File</h2>
                      <p className="text-zinc-600">
                        Import from Gaia GPS, AllTrails, Caltopo, or any hiking app
                      </p>
                    </div>
                  </div>
                  <GPXUpload onUpload={handleGPXUpload} isLoading={isLoading} />
                </div>
              </div>
            )}

            {/* Manual GPS Points - show location search */}
            {creationMethod === 'manual' && (
              <LocationSearch
                onLocationSelect={(lat, lng, name) => {
                  setManualLocation({ lat, lng, name });
                  setRouteName(name);
                }}
              />
            )}
          </>
        )}

        {isLoading && !trackGeojson && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-600">Loading route...</span>
          </div>
        )}

        {/* STEP 2: Set Waypoints */}
        {currentStep >= 2 && (trackGeojson || manualLocation) && (
          <div className="space-y-6">
            {/* Route name input or trail selector */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              {creationMethod === 'library' ? (
                <div className="flex-1 max-w-md">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Selected Trail
                  </label>
                  <select
                    value={routeName}
                    onChange={(e) => {
                      const trail = popularTrails.find(t => t.name === e.target.value);
                      if (trail) handleTrailSelect(trail);
                    }}
                    className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-orange-500"
                  >
                    {(() => {
                      const countryNames: Record<string, string> = {
                        'US': 'United States',
                        'CA': 'Canada',
                        'AU': 'Australia',
                        'NZ': 'New Zealand',
                        'GB': 'United Kingdom',
                        'FR': 'France',
                        'CH': 'Switzerland',
                        'IT': 'Italy',
                        'JP': 'Japan',
                        'ZA': 'South Africa',
                        'DE': 'Germany',
                      };
                      // Countries with trail data, sorted
                      const trailsByCountry = new Map<string, TrailData[]>();
                      for (const trail of popularTrails) {
                        const existing = trailsByCountry.get(trail.country) || [];
                        existing.push(trail);
                        trailsByCountry.set(trail.country, existing);
                      }
                      // Sort trails within each country
                      Array.from(trailsByCountry.values()).forEach(trails => {
                        trails.sort((a, b) => a.name.localeCompare(b.name));
                      });
                      // Country display order: launch markets first, then alphabetical
                      const launchMarkets = ['US', 'CA', 'AU'];
                      const otherCountries = Object.keys(countryNames)
                        .filter(c => !launchMarkets.includes(c))
                        .sort((a, b) => countryNames[a].localeCompare(countryNames[b]));
                      const orderedCountries = [...launchMarkets, ...otherCountries];

                      return orderedCountries.map(countryCode => {
                        const trails = trailsByCountry.get(countryCode);
                        const label = `${countryNames[countryCode] || countryCode}`;
                        if (!trails || trails.length === 0) {
                          return (
                            <optgroup key={countryCode} label={label}>
                              <option disabled value="">
                                Coming Soon
                              </option>
                            </optgroup>
                          );
                        }
                        return (
                          <optgroup key={countryCode} label={label}>
                            {trails.map(trail => (
                              <option key={trail.id} value={trail.name}>
                                {trail.name}
                              </option>
                            ))}
                          </optgroup>
                        );
                      });
                    })()}
                  </select>
                </div>
              ) : (
                <div className="flex-1 max-w-md">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Route Name
                  </label>
                  <input
                    type="text"
                    value={routeName}
                    onChange={handleRouteNameChange}
                    className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-blue-500"
                    placeholder="My Awesome Hike"
                  />
                </div>
              )}

              <div className="flex items-center gap-4">
                <button
                  onClick={handleSave}
                  disabled={isSaving || !isDirty}
                  className={`
                    min-w-[250px] px-8 py-3 rounded-lg font-semibold text-lg transition-colors
                    ${isSaving
                      ? 'bg-gray-200 text-gray-600 cursor-not-allowed'
                      : !isDirty
                        ? 'bg-green-500 text-white cursor-default'
                        : 'bg-orange-500 text-white hover:bg-orange-600'}
                  `}
                >
                  {isSaving ? 'Saving...' : !isDirty ? 'Saved' : 'Save Route'}
                </button>

                {!token && (
                  <p className="text-sm text-yellow-500">
                    Log in to save your route
                  </p>
                )}

                {saveError && (
                  <p className="text-sm text-red-500">{saveError}</p>
                )}
              </div>
            </div>

            {/* Map and waypoint editing */}
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">2. Click the map to add waypoints</h2>
              <p className="text-gray-600 mb-4">
                Add camps, peaks, and points of interest where you want weather forecasts
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Map takes 2 columns on large screens */}
                <div className="lg:col-span-2">
                  {/* Quick location search */}
                  <QuickLocationSearch
                    onLocationSelect={(lat, lng) => {
                      setMapCenter({ latitude: lat, longitude: lng });
                    }}
                  />
                  <MapEditor
                    trackGeojson={trackGeojson}
                    waypoints={waypoints}
                    selectedWaypointId={selectedWaypointId}
                    onMapClick={handleMapClick}
                    onWaypointSelect={setSelectedWaypointId}
                    onWaypointDrag={handleWaypointDrag}
                    onWaypointDelete={handleWaypointDelete}
                    initialViewport={
                      manualLocation
                        ? { latitude: manualLocation.lat, longitude: manualLocation.lng, zoom: 11 }
                        : undefined
                    }
                    centerOn={mapCenter}
                  />
                  <div className="mt-2 flex items-center justify-between text-sm text-gray-600">
                    <p>Click to add • Drag to move • Select to edit</p>
                    {isFetchingElevation && (
                      <p className="flex items-center gap-2 text-orange-600">
                        <span className="inline-block w-3 h-3 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
                        Fetching elevation...
                      </p>
                    )}
                  </div>
                  {trackGeojson && (
                    <div className="mt-4">
                      <ElevationProfile
                        trackGeojson={trackGeojson}
                        waypoints={waypoints.map(wp => ({ name: wp.name, lat: wp.lat, lng: wp.lng }))}
                      />
                    </div>
                  )}
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

              {/* Save Route button */}
              <div className="mt-6 flex justify-start">
                <button
                  onClick={handleSave}
                  disabled={isSaving || !isDirty}
                  className={`
                    min-w-[250px] px-8 py-3 rounded-lg font-semibold text-lg transition-colors
                    ${isSaving
                      ? 'bg-gray-200 text-gray-600 cursor-not-allowed'
                      : !isDirty
                        ? 'bg-green-500 text-white cursor-default'
                        : 'bg-orange-500 text-white hover:bg-orange-600'}
                  `}
                >
                  {isSaving ? 'Saving...' : !isDirty ? 'Saved' : 'Save Route'}
                </button>
              </div>
            </div>

            {/* STEP 3: Preview SMS - only shows after first waypoint */}
            {currentStep === 3 && (
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">3. Preview your SMS forecast</h2>
                <p className="text-gray-600 mb-6">
                  See exactly what your weather forecasts will look like on your phone
                </p>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <button
                    onClick={handlePreviewSMS}
                    disabled={isSaving}
                    className={`
                      px-8 py-3 rounded-lg font-semibold text-lg transition-colors
                      ${isSaving
                        ? 'bg-gray-200 text-gray-600 cursor-not-allowed'
                        : 'bg-orange-500 text-white hover:bg-orange-600'}
                    `}
                  >
                    {isSaving ? 'Saving...' : 'Preview SMS Forecast'}
                  </button>
                  <p className="text-sm text-gray-600">
                    (don&apos;t worry, you can edit your route at any time)
                  </p>
                </div>
              </div>
            )}
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
      <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    }>
      <CreateRouteContent />
    </Suspense>
  );
}
