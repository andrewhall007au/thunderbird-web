'use client';

import { useState } from 'react';
import { Satellite, ChevronDown, ChevronUp } from 'lucide-react';

interface SatelliteSimulatorProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  latencyMs: number;
  onLatencyChange: (ms: number) => void;
}

export default function SatelliteSimulator({
  enabled,
  onEnabledChange,
  latencyMs,
  onLatencyChange
}: SatelliteSimulatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700">
      {/* Collapsed header with toggle */}
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <Satellite className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
          <div className="text-sm font-medium">Satellite Simulation</div>
          {enabled && !isExpanded && (
            <div className="px-2 py-0.5 bg-blue-600 rounded text-sm font-medium text-white">
              ON - {(latencyMs / 1000).toFixed(1)}s
            </div>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
        )}
      </div>

      {/* Expanded controls */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-zinc-200 dark:border-zinc-700 pt-4">
          {/* Enable/Disable toggle */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Satellite Mode</div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                Simulate 2-10 second latency
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEnabledChange(!enabled);
              }}
              className={`
                relative w-12 h-6 rounded-full transition-colors
                ${enabled ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-600'}
              `}
            >
              <div
                className={`
                  absolute top-1 w-4 h-4 rounded-full bg-white transition-transform
                  ${enabled ? 'translate-x-7' : 'translate-x-1'}
                `}
              />
            </button>
          </div>

          {/* Latency slider (only when enabled) */}
          {enabled && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium">
                  Latency: {(latencyMs / 1000).toFixed(1)}s
                </label>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">
                  2s - 10s
                </div>
              </div>
              <input
                type="range"
                min="2000"
                max="10000"
                step="500"
                value={latencyMs}
                onChange={(e) => onLatencyChange(parseInt(e.target.value, 10))}
                onClick={(e) => e.stopPropagation()}
                className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between mt-1 text-sm text-zinc-500">
                <span>Fast</span>
                <span>Realistic</span>
                <span>Slow</span>
              </div>
            </div>
          )}

          {/* Connection type display */}
          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
            <div className="text-sm text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
              Current Mode
            </div>
            <div className="text-sm font-medium">
              {enabled ? (
                <span className="text-blue-600 dark:text-blue-400">📡 Satellite Data ({(latencyMs / 1000).toFixed(1)}s latency)</span>
              ) : (
                <span className="text-green-600 dark:text-green-400">🌐 Full Connectivity</span>
              )}
            </div>
          </div>

          {/* Info about satellite simulation */}
          <div className="bg-zinc-50 dark:bg-zinc-900 rounded p-3 text-sm text-zinc-500 dark:text-zinc-400">
            <div className="font-medium text-zinc-700 dark:text-zinc-300 mb-1">About This Simulation</div>
            <p>
              Satellite data services (Garmin inReach, SPOT, Zoleo) have 2-10 second latency for API calls.
              This simulation adds delay to weather requests to validate the UX under real constraints.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
