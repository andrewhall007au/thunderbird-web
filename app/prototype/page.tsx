'use client';

import { useState, Suspense } from 'react';
import dynamic from 'next/dynamic';
import TrailPicker from './components/TrailPicker';
import PinPanel from './components/PinPanel';

// Dynamic import to avoid SSR with MapLibre
const PrototypeMap = dynamic(() => import('./components/PrototypeMap'), { ssr: false });

export interface Pin {
  id: string;
  lat: number;
  lng: number;
  label: string;
}

const PIN_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const MAX_PINS = 8;

export default function PrototypePage() {
  const [selectedTrailId, setSelectedTrailId] = useState<string | null>(null);
  const [trailGeojson, setTrailGeojson] = useState<GeoJSON.Feature | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);

  // Add a new pin at the specified location
  const addPin = (lat: number, lng: number) => {
    if (pins.length >= MAX_PINS) {
      return; // Max pins reached
    }

    const nextLabel = PIN_LABELS[pins.length];
    const newPin: Pin = {
      id: `pin-${Date.now()}`,
      lat,
      lng,
      label: nextLabel
    };

    setPins([...pins, newPin]);
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
          />
        </Suspense>
      </div>

      {/* Pin Panel - bottom sheet */}
      <div className="flex-shrink-0">
        <PinPanel
          pins={pins}
          onRemovePin={removePin}
          onClearPins={clearPins}
        />
      </div>
    </div>
  );
}
