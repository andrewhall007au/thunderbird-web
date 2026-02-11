'use client';

import { useState, Suspense, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import TrailPicker from './components/TrailPicker';
import ForecastPanel from './components/ForecastPanel';
import TimeScrubber from './components/TimeScrubber';
import SatelliteSimulator from './components/SatelliteSimulator';
import PayloadInspector, { type PayloadMetrics } from './components/PayloadInspector';
import { Pin } from './lib/types';
import { fetchMultiPinWeather } from './lib/openmeteo';
import { calculateSeverity, getSeveritySummary } from './lib/severity';

// Dynamic import to avoid SSR with MapLibre
const PrototypeMap = dynamic(() => import('./components/PrototypeMap'), { ssr: false });

const PIN_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const MAX_PINS = 8;
const SMS_MAX_LENGTH = 160;

export default function PrototypePage() {
  const [selectedTrailId, setSelectedTrailId] = useState<string | null>(null);
  const [trailGeojson, setTrailGeojson] = useState<GeoJSON.Feature | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [currentHour, setCurrentHour] = useState(0);
  const [gridVisible, setGridVisible] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [satelliteMode, setSatelliteMode] = useState(false);
  const [satelliteLatencyMs, setSatelliteLatencyMs] = useState(5000);
  const [lastPayloadMetrics, setLastPayloadMetrics] = useState<PayloadMetrics | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);

  // Add a new pin at the specified location
  const addPin = async (lat: number, lng: number) => {
    if (pins.length >= MAX_PINS) {
      return; // Max pins reached
    }

    const nextLabel = PIN_LABELS[pins.length];
    const newPin: Pin = {
      id: `pin-${Date.now()}`,
      lat,
      lng,
      label: nextLabel,
      loading: true
    };

    // Add pin to state immediately with loading state
    setPins(prev => [...prev, newPin]);
    setIsLoadingWeather(true);

    // Fetch weather for the new pin
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

      // Update pin with forecast data
      setPins(prev => prev.map(p =>
        p.id === newPin.id
          ? { ...p, forecast, loading: false }
          : p
      ));
    } catch (error) {
      console.error('Failed to fetch weather for pin:', error);
      // Clear loading state but leave forecast undefined
      setPins(prev => prev.map(p =>
        p.id === newPin.id
          ? { ...p, loading: false }
          : p
      ));
    } finally {
      setIsLoadingWeather(false);
    }
  };

  // Remove a specific pin
  const removePin = (id: string) => {
    const filtered = pins.filter(p => p.id !== id);
    // Re-label remaining pins sequentially
    const relabeled = filtered.map((pin, index) => ({
      ...pin,
      label: PIN_LABELS[index]
    }));
    setPins(relabeled);
  };

  // Clear all pins
  const clearPins = () => {
    setPins([]);
  };

  // Handle trail selection from picker
  const handleTrailSelect = (trailId: string, geojson: GeoJSON.Feature) => {
    setSelectedTrailId(trailId);
    setTrailGeojson(geojson);
  };

  // Generate WX command for all pins
  const getAllPinsWxCommand = (): string => {
    const coordPairs = pins.map(p => `${p.lat.toFixed(3)} ${p.lng.toFixed(3)}`);
    return `WX ${coordPairs.join(' ')}`;
  };

  // Copy WX command to clipboard
  const handleCopyWxCommand = async () => {
    const command = getAllPinsWxCommand();
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(command);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = command;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopyFeedback('Copied WX command!');
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      alert('Failed to copy to clipboard');
    }
  };

  // Calculate severity summary for all pins at current hour (memoized for performance)
  const severitySummary = useMemo(() => {
    return pins
      .filter(p => p.forecast && !p.loading)
      .map(p => {
        const hourlyData = p.forecast!.hourly[currentHour] || p.forecast!.hourly[0];
        return calculateSeverity(hourlyData);
      });
  }, [pins, currentHour]);

  const summary = useMemo(() => {
    return severitySummary.length > 0 ? getSeveritySummary(severitySummary) : null;
  }, [severitySummary]);

  // Online/offline detection
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="h-screen flex flex-col bg-zinc-900 text-zinc-100" style={{ height: '100dvh' }}>
      {/* Header */}
      <div className="bg-zinc-800 border-b border-zinc-700 px-4 py-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-lg font-bold">Thunderbird Trail Weather</h1>
            <p className="text-sm text-zinc-400 mt-1">
              Drop pins along a trail. Copy coordinates for SMS forecast.
            </p>
          </div>
          {/* Online/offline indicator */}
          <div className={`
            text-xs px-2 py-1 rounded flex-shrink-0 ml-2
            ${isOnline ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}
          `}>
            {isOnline ? '🌐 Online' : '📵 Offline'}
          </div>
        </div>
      </div>

      {/* Satellite mode banner */}
      {satelliteMode && (
        <div className="bg-blue-900/30 border-b border-blue-700/50 px-4 py-2 flex items-center justify-center gap-2 text-sm text-blue-300">
          <span className="animate-pulse">📡</span>
          <span>Satellite mode — {(satelliteLatencyMs / 1000).toFixed(1)}s latency</span>
        </div>
      )}

      {/* Trail Picker */}
      <div className="flex-shrink-0">
        <TrailPicker
          selectedTrailId={selectedTrailId}
          onTrailSelect={handleTrailSelect}
        />
      </div>

      {/* Map - takes remaining vertical space */}
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
          />
        </Suspense>
      </div>

      {/* Severity Summary Bar */}
      {summary && (
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

      {/* Time Scrubber */}
      <div className="flex-shrink-0">
        <TimeScrubber
          currentHour={currentHour}
          onHourChange={setCurrentHour}
          maxHours={72}
        />
      </div>

      {/* Forecast Panel - bottom sheet */}
      <div className="flex-shrink-0">
        <ForecastPanel
          pins={pins}
          currentHour={currentHour}
          onRemovePin={removePin}
          onClearPins={clearPins}
          onCopyWxCommand={handleCopyWxCommand}
        />
      </div>

      {/* Developer Tools */}
      <div className="flex-shrink-0">
        <SatelliteSimulator
          enabled={satelliteMode}
          onEnabledChange={setSatelliteMode}
          latencyMs={satelliteLatencyMs}
          onLatencyChange={setSatelliteLatencyMs}
        />
        <PayloadInspector metrics={lastPayloadMetrics} />
      </div>

      {/* Copy feedback toast */}
      {copyFeedback && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 bg-green-600 text-white rounded shadow-lg text-sm font-medium animate-fade-in z-50">
          {copyFeedback}
        </div>
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
