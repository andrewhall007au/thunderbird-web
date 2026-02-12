'use client';

import { useState, Suspense, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Smartphone, Tablet, Monitor, Wifi, WifiOff, FlaskConical } from 'lucide-react';
import TrailMenu from './components/TrailMenu';
import ForecastPanel from './components/ForecastPanel';
import TimeScrubber from './components/TimeScrubber';
import SatelliteSimulator from './components/SatelliteSimulator';
import PayloadInspector, { type PayloadMetrics } from './components/PayloadInspector';
import PinPanel from './components/PinPanel';
import { Pin } from './lib/types';
import { fetchMultiPinWeather } from './lib/openmeteo';
import { calculateSeverity, getSeveritySummary } from './lib/severity';

// Dynamic import to avoid SSR with MapLibre
const PrototypeMap = dynamic(() => import('./components/PrototypeMap'), { ssr: false });

const PIN_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const MAX_PINS = 8;

type AppMode = 'online' | 'offline';
type Viewport = 'mobile' | 'tablet' | 'desktop';

export default function PrototypePage() {
  const [selectedTrailId, setSelectedTrailId] = useState<string | null>(null);
  const [trailGeojson, setTrailGeojson] = useState<GeoJSON.Feature | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [currentHour, setCurrentHour] = useState(0);
  const [gridVisible, setGridVisible] = useState(false);

  const [satelliteMode, setSatelliteMode] = useState(false);
  const [satelliteLatencyMs, setSatelliteLatencyMs] = useState(5000);
  const [lastPayloadMetrics, setLastPayloadMetrics] = useState<PayloadMetrics | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [detectedMode, setDetectedMode] = useState<AppMode>('online');
  const [simulatedMode, setSimulatedMode] = useState<AppMode | null>(null); // null = use detected
  const [showModeAlert, setShowModeAlert] = useState(false);
  const [viewport, setViewport] = useState<Viewport>('mobile');

  // Effective mode: simulated override takes precedence over detected
  const mode = simulatedMode ?? detectedMode;

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
    setPins(prev => prev.filter(p => p.id !== id));
  };

  // Rename a pin
  const renamePin = (id: string, newLabel: string) => {
    setPins(prev => prev.map(p => p.id === id ? { ...p, label: newLabel } : p));
  };

  // Clear all pins
  const clearPins = () => {
    setPins([]);
  };

  // Handle trail selection from picker — auto-drop pins at highest and lowest elevation
  const handleTrailSelect = (trailId: string, geojson: GeoJSON.Feature) => {
    setSelectedTrailId(trailId);
    setTrailGeojson(geojson);

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

    // Create auto pins A (highest) and B (lowest)
    const autoA: Pin = {
      id: `pin-auto-high-${Date.now()}`,
      lat: coords[highIdx][1],
      lng: coords[highIdx][0],
      label: 'A',
      elevation: Math.round(highElev),
      loading: mode === 'online',
    };
    const autoB: Pin = {
      id: `pin-auto-low-${Date.now() + 1}`,
      lat: coords[lowIdx][1],
      lng: coords[lowIdx][0],
      label: 'B',
      elevation: Math.round(lowElev),
      loading: mode === 'online',
    };

    setPins([autoA, autoB]);

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

  // Calculate severity summary for all pins at current hour
  const severitySummary = useMemo(() => {
    return pins
      .filter(p => p.forecast && !p.loading)
      .map(p => {
        const hourlyData = p.forecast!.hourly[currentHour] || p.forecast!.hourly[0];
        return calculateSeverity(hourlyData, p.forecast!.elevation);
      });
  }, [pins, currentHour]);

  const summary = useMemo(() => {
    return severitySummary.length > 0 ? getSeveritySummary(severitySummary) : null;
  }, [severitySummary]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-zinc-900 text-zinc-100" style={{ height: '100dvh' }}>
      {/* Header */}
      <div className="bg-zinc-800 border-b border-zinc-700 px-4 py-2">
        <div className="flex items-center justify-between gap-2">
          <TrailMenu
            selectedTrailId={selectedTrailId}
            onTrailSelect={handleTrailSelect}
          />
          <h1 className="text-base font-bold truncate flex-1 min-w-0">
            {trailGeojson?.properties?.name || 'Select a trail'}
          </h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Connectivity status indicator */}
            <div className={`
              flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
              ${mode === 'online'
                ? 'bg-green-900/40 text-green-300 border border-green-700/50'
                : 'bg-amber-900/40 text-amber-300 border border-amber-700/50'
              }
            `}>
              {mode === 'online'
                ? <Wifi className="w-3 h-3" />
                : <WifiOff className="w-3 h-3" />
              }
              {mode === 'online' ? 'Data' : 'SMS only'}
              {simulatedMode !== null && (
                <span className="text-[10px] opacity-60 ml-0.5">SIM</span>
              )}
            </div>
            {/* Prototype simulate button */}
            <button
              onClick={cycleSimulatedMode}
              className="p-1.5 rounded-full bg-zinc-700 hover:bg-zinc-600 transition-colors text-zinc-400 hover:text-zinc-200"
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
            <div className="hidden sm:flex bg-zinc-700 rounded-full p-0.5">
              {([
                { key: 'mobile' as Viewport, icon: Smartphone, label: 'Mobile' },
                { key: 'tablet' as Viewport, icon: Tablet, label: 'Tablet' },
                { key: 'desktop' as Viewport, icon: Monitor, label: 'Desktop' },
              ]).map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  onClick={() => setViewport(key)}
                  className={`
                    px-2 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1
                    ${viewport === key
                      ? 'bg-zinc-500 text-white'
                      : 'text-zinc-400 hover:text-zinc-200'
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
        <p className="text-xs text-zinc-500 mt-1">
          Tap map to drop pins · Each grid cell is a separate forecast
        </p>
      </div>

      {/* Mode change alert banner */}
      {showModeAlert && (
        <div className={`
          flex-shrink-0 px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2
          transition-all
          ${mode === 'online'
            ? 'bg-green-900/50 text-green-200 border-b border-green-800/50'
            : 'bg-amber-900/50 text-amber-200 border-b border-amber-800/50'
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
              <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                <div className="text-zinc-400">Loading map...</div>
              </div>
            }>
              <PrototypeMap
                trailGeojson={trailGeojson}
                pins={pins}
                currentHour={currentHour}
                onMapClick={addPin}
                onPinRemove={removePin}
                gridVisible={gridVisible}
                onGridToggle={() => setGridVisible(!gridVisible)}
                mode={mode}
              />
            </Suspense>
          </div>
          {/* Sidebar */}
          <div className="w-96 flex flex-col overflow-y-auto border-l border-zinc-700 bg-zinc-800">
            {mode === 'online' && (
              <TimeScrubber
                currentHour={currentHour}
                onHourChange={setCurrentHour}
                maxHours={168}
              />
            )}
            {mode === 'online' && summary && (
              <div className={`
                px-4 py-2 text-center text-sm font-medium border-t border-zinc-700
                ${summary.allSafe
                  ? 'bg-green-900/30 text-green-300'
                  : summary.dangerCount > 0
                  ? 'bg-red-900/30 text-red-300'
                  : 'bg-amber-900/30 text-amber-300'
                }
              `}>
                {summary.message}
              </div>
            )}
            {mode === 'online' ? (
              <ForecastPanel
                pins={pins}
                currentHour={currentHour}
                onRemovePin={removePin}
                onRenamePin={renamePin}
                onClearPins={clearPins}

                viewport="desktop"
              />
            ) : (
              <PinPanel
                pins={pins}
                onRemovePin={removePin}
                onRenamePin={renamePin}
                onClearPins={clearPins}
                offlineMode
              />
            )}
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
        /* Mobile / Tablet: stacked layout */
        <>
          {/* Map - takes remaining vertical space */}
          <div className={`flex-1 relative ${viewport === 'tablet' ? 'min-h-[50vh]' : ''}`}>
            <Suspense fallback={
              <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                <div className="text-zinc-400">Loading map...</div>
              </div>
            }>
              <PrototypeMap
                trailGeojson={trailGeojson}
                pins={pins}
                currentHour={currentHour}
                onMapClick={addPin}
                onPinRemove={removePin}
                gridVisible={gridVisible}
                onGridToggle={() => setGridVisible(!gridVisible)}
                mode={mode}
              />
            </Suspense>
          </div>

          {/* Severity Summary Bar (online only, when pins have data) */}
          {mode === 'online' && summary && (
            <div className={`
              flex-shrink-0 px-4 py-2 text-center text-sm font-medium border-t border-zinc-700
              ${summary.allSafe
                ? 'bg-green-900/30 text-green-300'
                : summary.dangerCount > 0
                ? 'bg-red-900/30 text-red-300'
                : 'bg-amber-900/30 text-amber-300'
              }
            `}>
              {summary.message}
            </div>
          )}

          {/* Time Scrubber (online only) */}
          {mode === 'online' && (
            <div className="flex-shrink-0">
              <TimeScrubber
                currentHour={currentHour}
                onHourChange={setCurrentHour}
                maxHours={168}
              />
            </div>
          )}

          {/* Forecast Panel (online) or PinPanel (offline) */}
          <div className="flex-shrink-0">
            {mode === 'online' ? (
              <ForecastPanel
                pins={pins}
                currentHour={currentHour}
                onRemovePin={removePin}
                onRenamePin={renamePin}
                onClearPins={clearPins}

                viewport={viewport}
              />
            ) : (
              <PinPanel
                pins={pins}
                onRemovePin={removePin}
                onRenamePin={renamePin}
                onClearPins={clearPins}
                offlineMode
              />
            )}
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
        </>
      )}

      {/* Satellite loading overlay */}
      {satelliteMode && isLoadingWeather && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-800 rounded-lg p-6 max-w-sm mx-4 border border-zinc-700">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="animate-spin">📡</div>
              <div className="text-lg font-medium">Fetching via satellite...</div>
            </div>
            <div className="text-sm text-zinc-400 text-center mb-4">
              Simulating {(satelliteLatencyMs / 1000).toFixed(1)}s latency
            </div>
            <div className="w-full bg-zinc-700 rounded-full h-2 overflow-hidden">
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
            padding-bottom: env(safe-area-inset-bottom);
          }
        }
      `}</style>
    </div>
  );
}
