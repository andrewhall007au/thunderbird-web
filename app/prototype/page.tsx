'use client';

import { useState, Suspense } from 'react';
import dynamic from 'next/dynamic';
import TrailPicker from './components/TrailPicker';
import ForecastPanel from './components/ForecastPanel';
import TimeScrubber from './components/TimeScrubber';
import { Pin } from './lib/types';
import { fetchMultiPinWeather } from './lib/openmeteo';

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

    // Fetch weather for the new pin
    try {
      const forecasts = await fetchMultiPinWeather([{ lat, lng }]);
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

  return (
    <div className="h-screen flex flex-col bg-zinc-900 text-zinc-100">
      {/* Header */}
      <div className="bg-zinc-800 border-b border-zinc-700 px-4 py-3">
        <h1 className="text-lg font-bold">Thunderbird Trail Weather</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Drop pins along a trail. Copy coordinates for SMS forecast.
        </p>
      </div>

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
            onMapClick={addPin}
            onPinRemove={removePin}
            gridVisible={gridVisible}
            onGridToggle={() => setGridVisible(!gridVisible)}
          />
        </Suspense>
      </div>

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

      {/* Copy feedback toast */}
      {copyFeedback && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 bg-green-600 text-white rounded shadow-lg text-sm font-medium animate-fade-in z-50">
          {copyFeedback}
        </div>
      )}
    </div>
  );
}
