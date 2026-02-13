'use client';

import { useState, Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Smartphone, Tablet, Monitor, Wifi, WifiOff, FlaskConical, Sun, Moon } from 'lucide-react';
import TrailMenu from './components/TrailMenu';
import ChartPanel from './components/ChartPanel';
import SatelliteSimulator from './components/SatelliteSimulator';
import PayloadInspector, { type PayloadMetrics } from './components/PayloadInspector';
import ThemeProvider, { useTheme } from './components/ThemeProvider';

import { Pin } from './lib/types';
import { fetchMultiPinWeather } from './lib/openmeteo';
import { computeTrailStats, type TrailStats } from './lib/trailStats';

const ElevationProfile = dynamic(() => import('./components/ElevationProfile'), { ssr: false });

// Dynamic import to avoid SSR with MapLibre
const PrototypeMap = dynamic(() => import('./components/PrototypeMap'), { ssr: false });

const PIN_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const MAX_PINS = 8;

type AppMode = 'online' | 'offline';
type Viewport = 'mobile' | 'tablet' | 'desktop';

function PrototypePageInner() {
  const searchParams = useSearchParams();
  const urlMode = searchParams.get('mode');
  const { theme, toggleTheme } = useTheme();

  const [selectedTrailId, setSelectedTrailId] = useState<string | null>(null);
  const [trailGeojson, setTrailGeojson] = useState<GeoJSON.Feature | null>(null);
  const [trailStats, setTrailStats] = useState<TrailStats | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [gridVisible, setGridVisible] = useState(false);
  const [forecastExpanded, setForecastExpanded] = useState(false);

  const [satelliteMode, setSatelliteMode] = useState(false);
  const [satelliteLatencyMs, setSatelliteLatencyMs] = useState(5000);
  const [lastPayloadMetrics, setLastPayloadMetrics] = useState<PayloadMetrics | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [detectedMode, setDetectedMode] = useState<AppMode>('online');
  const [simulatedMode, setSimulatedMode] = useState<AppMode | null>(
    urlMode === 'offline' ? 'offline' : urlMode === 'online' ? 'online' : null
  ); // null = use detected
  const [showModeAlert, setShowModeAlert] = useState(false);
  const [viewport, setViewport] = useState<Viewport>('mobile');
  const [mapFlyTo, setMapFlyTo] = useState<{ lat: number; lng: number; zoom: number } | null>(null);

  // Effective mode: simulated override takes precedence over detected
  const mode = simulatedMode ?? detectedMode;

  // Location passed from parent preview page (for iframe geolocation)
  const [parentLocation, setParentLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Listen for messages from preview page (postMessage)
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'setMode' && (e.data.mode === 'online' || e.data.mode === 'offline')) {
        setSimulatedMode(e.data.mode);
      }
      if (e.data?.type === 'setLocation' && typeof e.data.lat === 'number' && typeof e.data.lng === 'number') {
        setParentLocation({ lat: e.data.lat, lng: e.data.lng });
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Connectivity probe — try a lightweight fetch to detect online/satellite
  useEffect(() => {
    const probe = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        // Lightweight probe — Open-Meteo geocoding endpoint with a tiny query
        await fetch('https://geocoding-api.open-meteo.com/v1/search?name=test&count=1', {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const prevMode = detectedMode;
        setDetectedMode('online');
        if (prevMode === 'offline') {
          setShowModeAlert(true);
          setTimeout(() => setShowModeAlert(false), 4000);
        }
      } catch {
        const prevMode = detectedMode;
        setDetectedMode('offline');
        if (prevMode === 'online') {
          setShowModeAlert(true);
          setTimeout(() => setShowModeAlert(false), 4000);
        }
      }
    };

    probe(); // Initial probe
    const interval = setInterval(probe, 30000); // Re-probe every 30s
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch weather for a list of pins
  const fetchWeatherForPins = async (pinsToFetch: Pin[]) => {
    if (pinsToFetch.length === 0) return;
    setIsLoadingWeather(true);

    try {
      const coords = pinsToFetch.map(p => ({ lat: p.lat, lng: p.lng }));
      const forecasts = await fetchMultiPinWeather(coords, {
        simulatedLatencyMs: satelliteMode ? satelliteLatencyMs : undefined,
        onMetrics: setLastPayloadMetrics
      });

      setPins(prev => prev.map(p => {
        const key = `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
        const forecast = forecasts.get(key);
        if (forecast && pinsToFetch.some(pf => pf.id === p.id)) {
          return { ...p, forecast, loading: false };
        }
        return p;
      }));
    } catch (error) {
      console.error('Failed to fetch weather:', error);
      setPins(prev => prev.map(p =>
        pinsToFetch.some(pf => pf.id === p.id) ? { ...p, loading: false } : p
      ));
    } finally {
      setIsLoadingWeather(false);
    }
  };

  // Find nearest trail point elevation for a given lat/lng
  const findNearestElevation = (lat: number, lng: number): number | undefined => {
    if (!trailGeojson) return undefined;
    const geometry = trailGeojson.geometry;
    if (geometry.type !== 'LineString' && geometry.type !== 'MultiLineString') return undefined;
    const coords = geometry.type === 'LineString'
      ? geometry.coordinates
      : (geometry as GeoJSON.MultiLineString).coordinates.flat();

    let bestDist = Infinity;
    let bestElev: number | undefined;
    for (const c of coords) {
      const dlat = c[1] - lat;
      const dlng = c[0] - lng;
      const d = dlat * dlat + dlng * dlng;
      if (d < bestDist && c[2] != null) {
        bestDist = d;
        bestElev = Math.round(c[2]);
      }
    }
    return bestElev;
  };

  // Add a new pin at the specified location
  const addPin = async (lat: number, lng: number) => {
    if (pins.length >= MAX_PINS) return;
    setForecastExpanded(true);

    const nextLabel = PIN_LABELS[pins.length];
    const elevation = findNearestElevation(lat, lng);
    const newPin: Pin = {
      id: `pin-${Date.now()}`,
      lat,
      lng,
      label: nextLabel,
      elevation,
      loading: mode === 'online'
    };

    setPins(prev => [...prev, newPin]);
    setSelectedPinId(newPin.id);

    // Only fetch weather in online mode
    if (mode === 'online') {
      setIsLoadingWeather(true);
      try {
        const forecasts = await fetchMultiPinWeather(
          [{ lat, lng }],
          {
            simulatedLatencyMs: satelliteMode ? satelliteLatencyMs : undefined,
            onMetrics: setLastPayloadMetrics
          }
        );
        const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
        const forecast = forecasts.get(key);

        setPins(prev => prev.map(p =>
          p.id === newPin.id ? { ...p, forecast, loading: false } : p
        ));
      } catch (error) {
        console.error('Failed to fetch weather for pin:', error);
        setPins(prev => prev.map(p =>
          p.id === newPin.id ? { ...p, loading: false } : p
        ));
      } finally {
        setIsLoadingWeather(false);
      }
    }
  };

  // Remove a specific pin (preserves custom labels on remaining pins)
  const removePin = (id: string) => {
    setPins(prev => {
      const remaining = prev.filter(p => p.id !== id);
      if (selectedPinId === id) {
        setSelectedPinId(remaining[0]?.id ?? null);
      }
      return remaining;
    });
  };

  // Clear all pins
  const clearPins = () => {
    setPins([]);
    setSelectedPinId(null);
  };

  // Handle trail selection from picker — auto-drop pins at highest and lowest elevation
  const handleTrailSelect = (trailId: string, geojson: GeoJSON.Feature) => {
    setSelectedTrailId(trailId);
    setTrailGeojson(geojson);
    setTrailStats(computeTrailStats(geojson));

    // Extract coordinates with elevation
    const geometry = geojson.geometry;
    if (geometry.type !== 'LineString' && geometry.type !== 'MultiLineString') return;
    const coords = geometry.type === 'LineString'
      ? geometry.coordinates
      : geometry.coordinates.flat();

    if (coords.length === 0 || !coords[0][2] && coords[0][2] !== 0) return;

    // Find highest and lowest elevation points
    let highIdx = 0, lowIdx = 0;
    let highElev = -Infinity, lowElev = Infinity;
    for (let i = 0; i < coords.length; i++) {
      const elev = coords[i][2];
      if (elev == null) continue;
      if (elev > highElev) { highElev = elev; highIdx = i; }
      if (elev < lowElev) { lowElev = elev; lowIdx = i; }
    }

    // Create auto pins H (highest) and L (lowest)
    const autoA: Pin = {
      id: `pin-auto-high-${Date.now()}`,
      lat: coords[highIdx][1],
      lng: coords[highIdx][0],
      label: 'H',
      elevation: Math.round(highElev),
      loading: mode === 'online',
    };
    const autoB: Pin = {
      id: `pin-auto-low-${Date.now() + 1}`,
      lat: coords[lowIdx][1],
      lng: coords[lowIdx][0],
      label: 'L',
      elevation: Math.round(lowElev),
      loading: mode === 'online',
    };

    setPins([autoA, autoB]);
    setSelectedPinId(autoA.id);
    setForecastExpanded(true);

    if (mode === 'online') {
      fetchWeatherForPins([autoA, autoB]);
    }
  };

  // Simulate mode toggle (prototype only) — cycle: auto → online → offline → auto
  const cycleSimulatedMode = () => {
    if (simulatedMode === null) {
      // Currently auto → force online
      setSimulatedMode('online');
    } else if (simulatedMode === 'online') {
      // Force online → force offline
      setSimulatedMode('offline');
    } else {
      // Force offline → back to auto
      setSimulatedMode(null);
    }
  };

  // When effective mode changes to online, fetch weather for pins missing forecasts
  useEffect(() => {
    if (mode === 'online') {
      const pinsNeedingWeather = pins.filter(p => !p.forecast && !p.loading);
      if (pinsNeedingWeather.length > 0) {
        setPins(prev => prev.map(p =>
          pinsNeedingWeather.some(pn => pn.id === p.id)
            ? { ...p, loading: true }
            : p
        ));
        fetchWeatherForPins(pinsNeedingWeather);
      }
    }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps


  return (
    <div className="h-screen flex flex-col bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100" style={{ height: '100dvh' }}>
      {/* Header */}
      <div className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 px-4 py-2">
        <div className="flex items-center justify-between gap-2">
          <TrailMenu
            selectedTrailId={selectedTrailId}
            onTrailSelect={handleTrailSelect}
            onPlaceSelect={(lat, lng) => setMapFlyTo({ lat, lng, zoom: 10 })}
          />
          <h1 className="text-base font-bold truncate flex-1 min-w-0">
            {trailGeojson?.properties?.name || 'Search trail or place'}
          </h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Connectivity status indicator */}
            <div className={`
              flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium
              ${mode === 'online'
                ? 'bg-green-100 text-green-700 border border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700/50'
                : 'bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700/50'
              }
            `}>
              {mode === 'online'
                ? <Wifi className="w-3 h-3" />
                : <WifiOff className="w-3 h-3" />
              }
              {mode === 'online' ? 'Data' : 'SMS only'}
              {simulatedMode !== null && (
                <span className="text-xs opacity-60 ml-0.5">SIM</span>
              )}
            </div>
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-full bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 transition-colors text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
            >
              {theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
            </button>
            {/* Prototype simulate button */}
            <button
              onClick={cycleSimulatedMode}
              className="p-1.5 rounded-full bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 transition-colors text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              title={simulatedMode === null
                ? 'Auto-detect (click to simulate)'
                : simulatedMode === 'online'
                ? 'Simulating: Online (click for offline)'
                : 'Simulating: Offline (click for auto)'
              }
            >
              <FlaskConical className="w-3.5 h-3.5" />
            </button>
            {/* Viewport selector — hidden on small screens */}
            <div className="hidden sm:flex bg-zinc-200 dark:bg-zinc-700 rounded-full p-0.5">
              {([
                { key: 'mobile' as Viewport, icon: Smartphone, label: 'Mobile' },
                { key: 'tablet' as Viewport, icon: Tablet, label: 'Tablet' },
                { key: 'desktop' as Viewport, icon: Monitor, label: 'Desktop' },
              ]).map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  onClick={() => setViewport(key)}
                  className={`
                    px-2 py-1 rounded-full text-sm font-medium transition-colors flex items-center gap-1
                    ${viewport === key
                      ? 'bg-zinc-400 dark:bg-zinc-500 text-white'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                    }
                  `}
                  title={label}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="text-sm mt-1">
          {trailStats ? (
            <span className="text-orange-600 dark:text-orange-400 font-medium">
              {trailStats.distanceKm} km · +{trailStats.totalAscent}m gain · {trailStats.minElev}m – {trailStats.maxElev}m
            </span>
          ) : (
            <span className="text-zinc-500">Tap map to drop pins · Each grid cell is a separate forecast</span>
          )}
        </p>
      </div>

      {/* Mode change alert banner */}
      {showModeAlert && (
        <div className={`
          flex-shrink-0 px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2
          transition-all
          ${mode === 'online'
            ? 'bg-green-100 text-green-700 border-b border-green-200 dark:bg-green-900/50 dark:text-green-200 dark:border-b dark:border-green-800/50'
            : 'bg-amber-100 text-amber-700 border-b border-amber-200 dark:bg-amber-900/50 dark:text-amber-200 dark:border-b dark:border-amber-800/50'
          }
        `}>
          {mode === 'online'
            ? <><Wifi className="w-4 h-4" /> Data connection detected — forecasts available</>
            : <><WifiOff className="w-4 h-4" /> No data connection — use SMS for forecasts</>
          }
        </div>
      )}

      {/* Desktop: two-column layout (map + sidebar) */}
      {viewport === 'desktop' ? (
        <div className="flex flex-1 overflow-hidden">
          {/* Map */}
          <div className="flex-1 relative">
            <Suspense fallback={
              <div className="w-full h-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800">
                <div className="text-zinc-500 dark:text-zinc-400">Loading map...</div>
              </div>
            }>
              <PrototypeMap
                trailGeojson={trailGeojson}
                pins={pins}
                selectedPinId={selectedPinId}
                onMapClick={addPin}
                onPinRemove={removePin}
                onPinSelect={(id: string) => { setSelectedPinId(id); setForecastExpanded(true); }}
                gridVisible={gridVisible}
                onGridToggle={() => setGridVisible(!gridVisible)}
                mode={mode}
                parentLocation={parentLocation}
                flyTo={mapFlyTo}
              />
            </Suspense>
          </div>
          {/* Sidebar */}
          <div className="w-96 flex flex-col overflow-y-auto border-l border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
            {trailGeojson && <ElevationProfile geojson={trailGeojson} />}
            <ChartPanel
              pins={pins}
              selectedPinId={selectedPinId}
              onPinSelect={setSelectedPinId}
              onRemovePin={removePin}
              onClearPins={clearPins}
              expanded={forecastExpanded}
              onExpandedChange={setForecastExpanded}
              viewport="desktop"
              mode={mode}
            />
            {mode === 'online' && (
              <>
                <SatelliteSimulator
                  enabled={satelliteMode}
                  onEnabledChange={setSatelliteMode}
                  latencyMs={satelliteLatencyMs}
                  onLatencyChange={setSatelliteLatencyMs}
                />
                <PayloadInspector metrics={lastPayloadMetrics} />
              </>
            )}
          </div>
        </div>
      ) : (
        /* Mobile / Tablet: scrollable stacked layout */
        <div className="flex-1 overflow-y-auto">
          {/* Map - fixed height so it doesn't get crushed */}
          <div className={`relative ${viewport === 'tablet' ? 'h-[55vh]' : 'h-[45vh]'} flex-shrink-0`}>
            <Suspense fallback={
              <div className="w-full h-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800">
                <div className="text-zinc-500 dark:text-zinc-400">Loading map...</div>
              </div>
            }>
              <PrototypeMap
                trailGeojson={trailGeojson}
                pins={pins}
                selectedPinId={selectedPinId}
                onMapClick={addPin}
                onPinRemove={removePin}
                onPinSelect={(id: string) => { setSelectedPinId(id); setForecastExpanded(true); }}
                gridVisible={gridVisible}
                onGridToggle={() => setGridVisible(!gridVisible)}
                mode={mode}
                parentLocation={parentLocation}
                flyTo={mapFlyTo}
              />
            </Suspense>
          </div>

          {/* Elevation profile */}
          {trailGeojson && (
            <div className="flex-shrink-0">
              <ElevationProfile geojson={trailGeojson} />
            </div>
          )}

          {/* Chart Panel (both modes) */}
          <div className="flex-shrink-0">
            <ChartPanel
              pins={pins}
              selectedPinId={selectedPinId}
              onPinSelect={setSelectedPinId}
              onRemovePin={removePin}
              onClearPins={clearPins}
              expanded={forecastExpanded}
              onExpandedChange={setForecastExpanded}
              viewport={viewport}
              mode={mode}
            />
          </div>

          {/* Developer Tools (online only, hidden on mobile) */}
          {mode === 'online' && (
            <div className="flex-shrink-0 hidden sm:block">
              <SatelliteSimulator
                enabled={satelliteMode}
                onEnabledChange={setSatelliteMode}
                latencyMs={satelliteLatencyMs}
                onLatencyChange={setSatelliteLatencyMs}
              />
              <PayloadInspector metrics={lastPayloadMetrics} />
            </div>
          )}
        </div>
      )}

      {/* Satellite loading overlay */}
      {satelliteMode && isLoadingWeather && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 max-w-sm mx-4 border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="animate-spin">📡</div>
              <div className="text-lg font-medium">Fetching via satellite...</div>
            </div>
            <div className="text-sm text-zinc-500 dark:text-zinc-400 text-center mb-4">
              Simulating {(satelliteLatencyMs / 1000).toFixed(1)}s latency
            </div>
            <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-500 h-full animate-loading-bar"
                style={{
                  animationDuration: `${satelliteLatencyMs}ms`
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Loading bar animation and safe-area support */}
      <style jsx global>{`
        @keyframes loading-bar {
          from {
            width: 0%;
          }
          to {
            width: 100%;
          }
        }
        .animate-loading-bar {
          animation: loading-bar linear forwards;
        }

        /* Safe area insets for notched devices */
        @supports (padding: env(safe-area-inset-bottom)) {
          body {
            padding-top: env(safe-area-inset-top);
            padding-bottom: env(safe-area-inset-bottom);
          }
        }
      `}</style>
    </div>
  );
}

export default function PrototypePage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400">
        Loading...
      </div>
    }>
      <ThemeProvider>
        <PrototypePageInner />
      </ThemeProvider>
    </Suspense>
  );
}
