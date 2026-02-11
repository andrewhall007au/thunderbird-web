/**
 * Severity calculation for weather conditions
 * Determines risk level (green/amber/red) based on weather thresholds
 */

import type { HourlyData } from './types';

export type SeverityLevel = 'green' | 'amber' | 'red';

export interface SeverityResult {
  level: SeverityLevel;
  reasons: string[];     // e.g., ["High wind: 55 km/h", "Hypothermia risk: -3°C wind chill"]
  windChill: number;     // Calculated wind chill in °C
}

/**
 * Default thresholds based on alpine hiking risk assessment
 * From PROPOSAL.md risk table
 */
export const DEFAULT_THRESHOLDS = {
  wind: { amber: 30, red: 50 },           // km/h
  windChill: { amber: 5, red: 0 },         // °C (below these values)
  rainProbability: { amber: 40, red: 70 },  // %
  precipitation: { red: 5 },                // mm (only triggers red when combined with high rain%)
  visibility: { amber: 5, red: 1 },         // km (not available from Open-Meteo basic, future use)
};

/**
 * Calculate wind chill using the standard North American formula
 * Only applies when temp <= 10°C and wind > 4.8 km/h
 *
 * Formula: WC = 13.12 + 0.6215×T - 11.37×V^0.16 + 0.3965×T×V^0.16
 * where T = air temperature (°C), V = wind speed (km/h)
 */
export function calculateWindChill(tempC: number, windKmh: number): number {
  // Wind chill only applies in cold conditions with wind
  if (tempC > 10 || windKmh <= 4.8) {
    return tempC;
  }

  const wc = 13.12 +
             0.6215 * tempC -
             11.37 * Math.pow(windKmh, 0.16) +
             0.3965 * tempC * Math.pow(windKmh, 0.16);

  return Math.round(wc * 10) / 10; // Round to 1 decimal
}

/**
 * Calculate severity level for a single hour of weather data
 *
 * Logic:
 * - Start at green (safe)
 * - Check each threshold
 * - If ANY condition is red → overall red
 * - If ANY is amber (and none red) → overall amber
 * - Collect all triggered reasons
 */
export function calculateSeverity(
  hourData: HourlyData,
  thresholds = DEFAULT_THRESHOLDS
): SeverityResult {
  let level = 'green' as SeverityLevel;
  const reasons: string[] = [];

  // Calculate wind chill
  const windChill = calculateWindChill(hourData.temperature, hourData.windSpeed);

  // Check sustained wind
  if (hourData.windSpeed >= thresholds.wind.red) {
    level = 'red';
    reasons.push(`High wind: ${Math.round(hourData.windSpeed)} km/h`);
  } else if (hourData.windSpeed >= thresholds.wind.amber) {
    if (level !== 'red') level = 'amber';
    reasons.push(`Strong wind: ${Math.round(hourData.windSpeed)} km/h`);
  }

  // Check wind gusts (use 1.2x multiplier for gust thresholds)
  if (hourData.windGusts >= thresholds.wind.red * 1.2) {
    level = 'red';
    reasons.push(`Dangerous gusts: ${Math.round(hourData.windGusts)} km/h`);
  } else if (hourData.windGusts >= thresholds.wind.amber * 1.2) {
    if (level !== 'red') level = 'amber';
    reasons.push(`Strong gusts: ${Math.round(hourData.windGusts)} km/h`);
  }

  // Check wind chill (hypothermia risk)
  if (windChill < thresholds.windChill.red) {
    level = 'red';
    reasons.push(`Hypothermia risk: ${windChill}°C wind chill`);
  } else if (windChill < thresholds.windChill.amber) {
    if (level !== 'red') level = 'amber';
    reasons.push(`Cold exposure: ${windChill}°C wind chill`);
  }

  // Check rain probability + precipitation amount
  if (hourData.rainProbability >= thresholds.rainProbability.red &&
      hourData.precipitation >= thresholds.precipitation.red) {
    level = 'red';
    reasons.push(`Heavy rain: ${Math.round(hourData.rainProbability)}% (${hourData.precipitation.toFixed(1)}mm)`);
  } else if (hourData.rainProbability >= thresholds.rainProbability.amber) {
    if (level !== 'red') level = 'amber';
    reasons.push(`Rain likely: ${Math.round(hourData.rainProbability)}%`);
  }

  return {
    level,
    reasons,
    windChill
  };
}

/**
 * Calculate severity for a full hourly forecast array
 * Returns severity result for each hour
 */
export function calculateHourlySeverities(
  hourlyData: HourlyData[],
  thresholds = DEFAULT_THRESHOLDS
): SeverityResult[] {
  return hourlyData.map(hour => calculateSeverity(hour, thresholds));
}

/**
 * Color mapping for severity levels
 * Tailwind-compatible color values
 */
export const SEVERITY_COLORS = {
  green: {
    bg: '#22c55e',
    text: '#ffffff',
    label: 'Safe',
    border: 'border-green-500',
    bgClass: 'bg-green-500',
    textClass: 'text-white'
  },
  amber: {
    bg: '#f59e0b',
    text: '#000000',
    label: 'Caution',
    border: 'border-amber-500',
    bgClass: 'bg-amber-500',
    textClass: 'text-black'
  },
  red: {
    bg: '#ef4444',
    text: '#ffffff',
    label: 'Danger',
    border: 'border-red-500',
    bgClass: 'bg-red-500',
    textClass: 'text-white'
  },
};

/**
 * Get severity summary across multiple pins
 * Used for summary bar in UI
 */
export function getSeveritySummary(severities: SeverityResult[]): {
  allSafe: boolean;
  dangerCount: number;
  cautionCount: number;
  message: string;
} {
  const dangerCount = severities.filter(s => s.level === 'red').length;
  const cautionCount = severities.filter(s => s.level === 'amber').length;
  const allSafe = dangerCount === 0 && cautionCount === 0;

  let message = '';
  if (allSafe) {
    message = 'All pins safe ✓';
  } else if (dangerCount > 0 && cautionCount > 0) {
    message = `${cautionCount} caution, ${dangerCount} danger ⚠`;
  } else if (dangerCount > 0) {
    message = `${dangerCount} danger ⚠ — check conditions`;
  } else {
    message = `${cautionCount} caution ⚠`;
  }

  return {
    allSafe,
    dangerCount,
    cautionCount,
    message
  };
}
