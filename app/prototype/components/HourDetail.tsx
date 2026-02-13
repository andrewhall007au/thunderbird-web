'use client';

import type { Pin } from '../lib/types';
import type { HourlyData } from '../lib/types';
import { getWeatherEmoji, getWindBearing } from '../lib/openmeteo';
import { calculateSeverity, SEVERITY_COLORS } from '../lib/severity';
import { calculateLightHours } from '../lib/sun';

interface HourDetailProps {
  pin: Pin;
  hourData: HourlyData;
}

export default function HourDetail({ pin, hourData }: HourDetailProps) {
  const elevation = pin.forecast?.elevation ?? 0;
  const severity = calculateSeverity(hourData, elevation);
  const severityColor = SEVERITY_COLORS[severity.level];
  const windBearing = getWindBearing(hourData.windDirection);
  const weatherEmoji = getWeatherEmoji(hourData.weatherCode);

  const cbHundreds = Math.round(hourData.cloudBase / 100);
  const flHundreds = Math.round(hourData.freezingLevel / 100);

  const forecastDate = new Date(hourData.time);
  const light = calculateLightHours(pin.lat, pin.lng, forecastDate);

  const dangerDisplay = [severity.danger, severity.thunder].filter(Boolean).join(' ');

  return (
    <div className="px-3 py-2 bg-zinc-100 dark:bg-zinc-750 border-t border-zinc-200 dark:border-zinc-600">
      {/* Row 1: Severity badge + emoji + temp */}
      <div className="flex items-center gap-2">
        <span
          className="px-1.5 py-0.5 rounded text-sm font-bold"
          style={{ backgroundColor: severityColor.bg, color: severityColor.text }}
        >
          {severity.level === 'green' ? 'Safe' : severity.level === 'amber' ? 'Caution' : 'Danger'}
          {dangerDisplay ? ` ${dangerDisplay}` : ''}
        </span>
        <span className="text-sm">{weatherEmoji} {Math.round(hourData.temperature)}°C</span>
        <span className="text-sm text-zinc-500 dark:text-zinc-400 ml-auto">
          {hourData.hoursFromNow === 0 ? 'Now' : `+${hourData.hoursFromNow}h`}
        </span>
      </div>

      {/* Row 2: Elevation + light */}
      <div className="text-sm font-mono text-zinc-500 dark:text-zinc-400 mt-1">
        {pin.elevation != null ? pin.elevation : Math.round(elevation)}m · {light.sunrise}-{light.sunset} ({light.duration})
      </div>

      {/* Danger reasons */}
      {severity.reasons.length > 0 && (
        <div className="text-sm text-zinc-700 dark:text-zinc-300 mt-1">
          {severity.reasons.map((reason, idx) => (
            <span key={idx}>{idx > 0 ? ' · ' : ''}{reason}</span>
          ))}
        </div>
      )}

      {/* CAST metrics */}
      <div className="text-sm font-mono mt-1 space-y-0.5">
        <div className="flex gap-3">
          <span><span className="text-zinc-400 dark:text-zinc-500">Rn</span> {Math.round(hourData.rainProbability)}% {hourData.precipitation.toFixed(1)}mm</span>
          <span><span className="text-zinc-400 dark:text-zinc-500">W</span> {Math.round(hourData.windSpeed)}-{Math.round(hourData.windGusts)} {windBearing}</span>
          {hourData.snowfall > 0 && (
            <span><span className="text-zinc-400 dark:text-zinc-500">S</span> {hourData.snowfall.toFixed(1)}cm</span>
          )}
        </div>
        <div className="flex gap-3">
          <span><span className="text-zinc-400 dark:text-zinc-500">Cld</span> {Math.round(hourData.cloudCover)}% CB{cbHundreds} FL{flHundreds}</span>
          <span className="text-zinc-400 dark:text-zinc-500 ml-auto">{pin.forecast?.modelResolution}</span>
        </div>
      </div>
    </div>
  );
}
