'use client';

import { useState } from 'react';
import type { Pin } from '../lib/types';
import { Copy, X, Trash2, ChevronUp } from 'lucide-react';
import { getWeatherEmoji, getWindBearing } from '../lib/openmeteo';

interface ForecastPanelProps {
  pins: Pin[];
  currentHour: number;  // 0-72
  onRemovePin: (id: string) => void;
  onClearPins: () => void;
  onCopyWxCommand: () => void;
}

const MAX_PINS = 8;

export default function ForecastPanel({
  pins,
  currentHour,
  onRemovePin,
  onClearPins,
  onCopyWxCommand
}: ForecastPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [clearConfirm, setClearConfirm] = useState(false);

  const handleClearPins = () => {
    if (!clearConfirm) {
      setClearConfirm(true);
      setTimeout(() => setClearConfirm(false), 3000);
      return;
    }
    onClearPins();
    setClearConfirm(false);
  };

  return (
    <div className="bg-zinc-800 border-t border-zinc-700">
      {/* Collapsed header */}
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-zinc-750 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="text-sm font-medium">
            {pins.length}/{MAX_PINS} pins
          </div>
          {pins.length > 0 && !isExpanded && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCopyWxCommand();
              }}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy
            </button>
          )}
        </div>
        <ChevronUp className={`w-5 h-5 text-zinc-400 transition-transform ${isExpanded ? '' : 'rotate-180'}`} />
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-zinc-700">
          {pins.length === 0 ? (
            /* Empty state */
            <div className="px-4 py-8 text-center text-zinc-500">
              <div className="text-4xl mb-2">📍</div>
              <div className="text-sm">Drop pins on the map to see forecasts</div>
            </div>
          ) : (
            <>
              {/* Horizontal scrollable forecast cards */}
              <div className="overflow-x-auto">
                <div className="flex gap-3 p-4 min-w-min">
                  {pins.map(pin => (
                    <ForecastCard
                      key={pin.id}
                      pin={pin}
                      currentHour={currentHour}
                      onRemove={() => onRemovePin(pin.id)}
                    />
                  ))}
                </div>
              </div>

              {/* SMS Export section */}
              <div className="p-4 bg-zinc-900 border-t border-zinc-700">
                <div className="space-y-3">
                  <button
                    onClick={onCopyWxCommand}
                    className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copy WX Command for SMS
                  </button>

                  {/* Clear all button */}
                  <button
                    onClick={handleClearPins}
                    className={`
                      w-full px-4 py-2 rounded text-sm font-medium transition-colors
                      ${clearConfirm
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-zinc-700 hover:bg-zinc-600'
                      }
                    `}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Trash2 className="w-4 h-4" />
                      {clearConfirm ? 'Click again to confirm' : 'Clear All Pins'}
                    </div>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Individual forecast card for a single pin
 */
function ForecastCard({
  pin,
  currentHour,
  onRemove
}: {
  pin: Pin;
  currentHour: number;
  onRemove: () => void;
}) {
  // Loading state
  if (pin.loading) {
    return (
      <div className="w-44 flex-shrink-0 bg-zinc-700 rounded-lg p-4 border border-zinc-600">
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-zinc-600 rounded w-16"></div>
          <div className="h-4 bg-zinc-600 rounded w-20"></div>
          <div className="h-8 bg-zinc-600 rounded w-24 mt-4"></div>
          <div className="space-y-2">
            <div className="h-3 bg-zinc-600 rounded"></div>
            <div className="h-3 bg-zinc-600 rounded"></div>
            <div className="h-3 bg-zinc-600 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  // Error state (no forecast data)
  if (!pin.forecast) {
    return (
      <div className="w-44 flex-shrink-0 bg-zinc-700 rounded-lg p-4 border border-zinc-600 relative">
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 p-1 hover:bg-zinc-600 rounded transition-colors"
          title="Remove pin"
        >
          <X className="w-4 h-4 text-zinc-400" />
        </button>
        <div className="text-center py-4">
          <div className="text-2xl mb-2">⚠️</div>
          <div className="text-sm text-zinc-400">No data</div>
          <div className="text-xs text-zinc-500 mt-1">
            {pin.lat.toFixed(3)}°, {pin.lng.toFixed(3)}°
          </div>
        </div>
      </div>
    );
  }

  // Get hourly data for current hour
  const hourlyData = pin.forecast.hourly[currentHour] || pin.forecast.hourly[0];
  if (!hourlyData) {
    return null;
  }

  const weatherEmoji = getWeatherEmoji(hourlyData.weatherCode);
  const windBearing = getWindBearing(hourlyData.windDirection);

  return (
    <div className="w-44 flex-shrink-0 bg-zinc-700 rounded-lg p-4 border border-zinc-600 relative">
      {/* Remove button */}
      <button
        onClick={onRemove}
        className="absolute top-2 right-2 p-1 hover:bg-zinc-600 rounded transition-colors"
        title="Remove pin"
      >
        <X className="w-4 h-4 text-zinc-400" />
      </button>

      {/* Pin label */}
      <div className="flex items-center gap-2 mb-1">
        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
          {pin.label}
        </div>
        <div className="font-bold text-sm">{pin.label}</div>
      </div>

      {/* Coordinates */}
      <div className="text-xs text-zinc-400 font-mono mb-1">
        {pin.lat.toFixed(3)}°, {pin.lng.toFixed(3)}°
      </div>

      {/* Elevation */}
      <div className="text-xs text-zinc-400 mb-3">
        {Math.round(pin.forecast.elevation)}m
      </div>

      {/* Main weather display */}
      <div className="flex items-center gap-2 mb-3">
        <div className="text-3xl">{weatherEmoji}</div>
        <div className="text-2xl font-bold">{Math.round(hourlyData.temperature)}°C</div>
      </div>

      {/* Weather details */}
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-zinc-400">Wind:</span>
          <span className="font-medium">{Math.round(hourlyData.windSpeed)} km/h {windBearing}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">Gusts:</span>
          <span className="font-medium">{Math.round(hourlyData.windGusts)} km/h</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">Rain:</span>
          <span className="font-medium">
            {Math.round(hourlyData.rainProbability)}% ({hourlyData.precipitation.toFixed(1)}mm)
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">Cloud:</span>
          <span className="font-medium">{Math.round(hourlyData.cloudCover)}%</span>
        </div>
      </div>

      {/* Time indicator */}
      <div className="mt-3 pt-3 border-t border-zinc-600 text-center">
        <div className="text-xs text-zinc-400">
          {hourlyData.hoursFromNow === 0 ? 'Now' : `+${hourlyData.hoursFromNow}h`}
        </div>
      </div>

      {/* Model info */}
      <div className="mt-2 text-xs text-zinc-500 text-center">
        {pin.forecast.modelResolution}
      </div>
    </div>
  );
}
