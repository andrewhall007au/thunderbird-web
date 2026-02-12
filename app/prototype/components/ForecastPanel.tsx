'use client';

import { useState, useRef, useEffect } from 'react';
import type { Pin } from '../lib/types';
import { Copy, X, Trash2, ChevronUp, Pencil } from 'lucide-react';
import { getWeatherEmoji, getWindBearing } from '../lib/openmeteo';
import { calculateSeverity, SEVERITY_COLORS } from '../lib/severity';
import { calculateLightHours } from '../lib/sun';

type Viewport = 'mobile' | 'tablet' | 'desktop';

interface ForecastPanelProps {
  pins: Pin[];
  currentHour: number;  // 0-72
  onRemovePin: (id: string) => void;
  onRenamePin: (id: string, newLabel: string) => void;
  onClearPins: () => void;
  viewport?: Viewport;
}

const MAX_PINS = 8;

export default function ForecastPanel({
  pins,
  currentHour,
  onRemovePin,
  onRenamePin,
  onClearPins,
  viewport = 'mobile'
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
        </div>
        <ChevronUp className={`w-5 h-5 text-zinc-400 transition-transform ${isExpanded ? '' : 'rotate-180'}`} />
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-zinc-700">
          {pins.length === 0 ? (
            /* Empty state */
            <div className="px-4 py-3 text-center text-zinc-500">
              <div className="text-sm">Tap map to drop pins for forecasts</div>
            </div>
          ) : (
            <>
              {/* Forecast cards — layout varies by viewport */}
              <div className={viewport === 'mobile' ? 'overflow-x-auto snap-x snap-mandatory' : ''}>
                <div className={
                  viewport === 'desktop'
                    ? 'flex flex-col gap-3 p-4'
                    : viewport === 'tablet'
                    ? 'grid grid-cols-2 gap-3 p-4'
                    : 'flex gap-3 p-4 min-w-min'
                }>
                  {pins.map(pin => (
                    <div key={pin.id} className={viewport === 'mobile' ? 'snap-center' : ''}>
                      <ForecastCard
                        pin={pin}
                        currentHour={currentHour}
                        onRemove={() => onRemovePin(pin.id)}
                        onRename={(newLabel) => onRenamePin(pin.id, newLabel)}
                        viewport={viewport}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Clear all */}
              <div className="px-4 py-3 bg-zinc-900 border-t border-zinc-700">
                <button
                  onClick={handleClearPins}
                  className={`
                    w-full px-3 py-2 rounded text-sm font-medium transition-colors
                    ${clearConfirm
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-zinc-700 hover:bg-zinc-600'
                    }
                  `}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5" />
                    {clearConfirm ? 'Click again to confirm' : 'Clear All Pins'}
                  </div>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Get min/max temperature from a ±1h window around the current hour.
 */
function getTempRange(pin: Pin, currentHour: number): { min: number; max: number } {
  if (!pin.forecast) return { min: 0, max: 0 };
  const hourly = pin.forecast.hourly;
  const start = Math.max(0, currentHour - 1);
  const end = Math.min(hourly.length - 1, currentHour + 1);
  let min = Infinity, max = -Infinity;
  for (let i = start; i <= end; i++) {
    const t = hourly[i]?.temperature ?? 0;
    if (t < min) min = t;
    if (t > max) max = t;
  }
  return { min: Math.round(min), max: Math.round(max) };
}

/**
 * Inline editable label — click pencil to edit, Enter/blur to save.
 */
function EditableLabel({
  label,
  onRename,
  className
}: {
  label: string;
  onRename: (newLabel: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const save = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== label) {
      onRename(trimmed);
    } else {
      setValue(label);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={e => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') { setValue(label); setEditing(false); }
        }}
        className="bg-zinc-600 text-white text-xs font-bold rounded px-1.5 py-0.5 w-20 outline-none ring-1 ring-blue-500"
        maxLength={12}
      />
    );
  }

  return (
    <span className={`group/label inline-flex items-center gap-1 ${className || ''}`}>
      <span>[{label}]</span>
      <button
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        className="opacity-0 group-hover/label:opacity-100 p-0.5 hover:bg-zinc-600 rounded transition-opacity"
        title="Rename pin"
      >
        <Pencil className="w-3 h-3 text-zinc-400" />
      </button>
    </span>
  );
}

/**
 * Copy text to clipboard, returns true on success.
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Individual CAST-format forecast card for a single pin.
 */
function ForecastCard({
  pin,
  currentHour,
  onRemove,
  onRename,
  viewport = 'mobile'
}: {
  pin: Pin;
  currentHour: number;
  onRemove: () => void;
  onRename: (newLabel: string) => void;
  viewport?: Viewport;
}) {
  const [copyFeedback, setCopyFeedback] = useState(false);
  const sizeClass = viewport === 'mobile' ? 'w-52 flex-shrink-0' : '';

  const handleCopyPin = async () => {
    const command = `WX ${pin.lat.toFixed(3)} ${pin.lng.toFixed(3)}`;
    const ok = await copyToClipboard(command);
    if (ok) {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 1500);
    }
  };

  // Loading state
  if (pin.loading) {
    return (
      <div className={`${sizeClass} bg-zinc-700 rounded-lg p-4 border border-zinc-600`}>
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
      <div className={`${sizeClass} bg-zinc-700 rounded-lg p-4 border border-zinc-600 relative`}>
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
            {pin.lat.toFixed(3)}, {pin.lng.toFixed(3)}
          </div>
        </div>
        <button
          onClick={handleCopyPin}
          className="w-full mt-2 px-2 py-1.5 bg-zinc-600 hover:bg-zinc-500 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
        >
          <Copy className="w-3 h-3" />
          {copyFeedback ? 'Copied!' : 'Copy GPS point for SMS'}
        </button>
      </div>
    );
  }

  // Get hourly data for current hour
  const hourlyData = pin.forecast.hourly[currentHour] || pin.forecast.hourly[0];
  if (!hourlyData) {
    return null;
  }

  const elevation = pin.forecast.elevation;
  const severity = calculateSeverity(hourlyData, elevation);
  const severityColor = SEVERITY_COLORS[severity.level];
  const windBearing = getWindBearing(hourlyData.windDirection);
  const weatherEmoji = getWeatherEmoji(hourlyData.weatherCode);
  const tempRange = getTempRange(pin, currentHour);

  // CAST shortcodes: cloud base and freezing level in hundreds of meters
  const cbHundreds = Math.round(hourlyData.cloudBase / 100);
  const flHundreds = Math.round(hourlyData.freezingLevel / 100);

  // Light hours
  const forecastDate = new Date(hourlyData.time);
  const light = calculateLightHours(pin.lat, pin.lng, forecastDate);

  // Danger display string
  const dangerDisplay = [severity.danger, severity.thunder].filter(Boolean).join(' ');

  return (
    <div className={`${sizeClass} bg-zinc-700 rounded-lg p-3 border-l-4 ${severityColor.border} relative`}>
      {/* Remove button */}
      <button
        onClick={onRemove}
        className="absolute top-2 right-2 p-1 hover:bg-zinc-600 rounded transition-colors z-10"
        title="Remove pin"
      >
        <X className="w-4 h-4 text-zinc-400" />
      </button>

      {/* Header: Pin label + danger + elevation */}
      <div className="flex items-center gap-2 mb-1">
        <span className={`
          px-2 py-0.5 rounded text-xs font-bold
          ${severityColor.bgClass} ${severityColor.textClass}
        `}>
          <EditableLabel label={pin.label} onRename={onRename} />
          {dangerDisplay ? ` ${dangerDisplay}` : ''}
        </span>
      </div>

      {/* Elevation */}
      <div className="text-sm font-mono text-zinc-300 mb-1">
        Elevation {pin.elevation != null ? pin.elevation : Math.round(elevation)}m
      </div>

      {/* Light hours */}
      <div className="text-xs text-zinc-400 mb-2 font-mono">
        Light {light.sunrise}-{light.sunset} ({light.duration})
      </div>

      {/* Danger reasons (only when present) */}
      {severity.reasons.length > 0 && (
        <div className="text-xs text-zinc-300 mb-2 space-y-0.5">
          {severity.reasons.map((reason, idx) => (
            <div key={idx}>• {reason}</div>
          ))}
        </div>
      )}

      {/* Main weather: emoji + temp range */}
      <div className="flex items-center gap-2 mb-2">
        <div className="text-2xl">{weatherEmoji}</div>
        <div className="text-lg font-bold">
          {tempRange.min === tempRange.max
            ? `${tempRange.min}°C`
            : `${tempRange.min}-${tempRange.max}°C`
          }
        </div>
      </div>

      {/* CAST-format metrics */}
      <div className="space-y-1 text-xs font-mono">
        {/* Rain */}
        <div className="flex justify-between">
          <span className="text-zinc-400">Rn</span>
          <span>{Math.round(hourlyData.rainProbability)}%  {hourlyData.precipitation.toFixed(1)}mm</span>
        </div>

        {/* Snow (only when > 0) */}
        {hourlyData.snowfall > 0 && (
          <div className="flex justify-between">
            <span className="text-zinc-400">S</span>
            <span>{hourlyData.snowfall.toFixed(1)}cm</span>
          </div>
        )}

        {/* Wind */}
        <div className="flex justify-between">
          <span className="text-zinc-400">W</span>
          <span>{Math.round(hourlyData.windSpeed)}-{Math.round(hourlyData.windGusts)} {windBearing}</span>
        </div>

        {/* Cloud, cloud base, freezing level */}
        <div className="flex justify-between">
          <span className="text-zinc-400">Cld</span>
          <span>{Math.round(hourlyData.cloudCover)}%  CB{cbHundreds}  FL{flHundreds}</span>
        </div>
      </div>

      {/* Footer: time offset + model */}
      <div className="mt-2 pt-2 border-t border-zinc-600 flex justify-between text-xs text-zinc-500">
        <span>{hourlyData.hoursFromNow === 0 ? 'Now' : `+${hourlyData.hoursFromNow}h`}</span>
        <span>{pin.forecast.modelResolution}</span>
      </div>

      {/* Per-pin copy button */}
      <button
        onClick={handleCopyPin}
        className="w-full mt-2 px-2 py-1.5 bg-zinc-600 hover:bg-zinc-500 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
      >
        <Copy className="w-3 h-3" />
        {copyFeedback ? 'Copied!' : 'Copy GPS point for SMS'}
      </button>
    </div>
  );
}
