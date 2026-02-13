/**
 * CAST-aligned danger calculation for weather conditions.
 * Matches backend DangerCalculator in formatter.py (Section 6.3).
 *
 * Uses hazard counting: ice + blind + wind + precip → !/!!/!!!
 * Plus thunderstorm detection via CAPE.
 */

import type { HourlyData } from './types';

export type SeverityLevel = 'green' | 'amber' | 'red';

export interface SeverityResult {
  level: SeverityLevel;
  danger: string;          // "", "!", "!!", "!!!"
  thunder: string;         // "", "TS?", "TS!"
  reasons: string[];
  windChill: number;
}

/**
 * CAST danger thresholds — matches backend/config/settings.py DangerThresholds
 */
const CAST_THRESHOLDS = {
  WIND_MODERATE: 50,     // km/h (default user profile)
  WIND_EXTREME: 70,      // km/h — auto !!!
  PRECIP_SIGNIFICANT: 5, // mm
  SNOW_SIGNIFICANT: 2,   // cm
  CLOUD_BLIND: 90,       // %
  CAPE_MODERATE: 200,    // J/kg → TS?
  CAPE_HIGH: 400,        // J/kg → TS!
};

/**
 * Calculate wind chill using the standard North American formula.
 * Only applies when temp <= 10°C and wind > 4.8 km/h.
 */
export function calculateWindChill(tempC: number, windKmh: number): number {
  if (tempC > 10 || windKmh <= 4.8) {
    return tempC;
  }

  const wc = 13.12 +
             0.6215 * tempC -
             11.37 * Math.pow(windKmh, 0.16) +
             0.3965 * tempC * Math.pow(windKmh, 0.16);

  return Math.round(wc * 10) / 10;
}

/**
 * Calculate CAST-aligned danger for a single hour.
 *
 * @param hourData - weather data for this hour
 * @param pinElevation - model elevation of the pin (meters ASL)
 */
export function calculateSeverity(
  hourData: HourlyData,
  pinElevation?: number
): SeverityResult {
  const reasons: string[] = [];
  let hazards = 0;
  let thunder = '';
  const elevation = pinElevation ?? 0;

  const windChill = calculateWindChill(hourData.temperature, hourData.windSpeed);

  // --- Hazard: Ice (peak above freezing level) ---
  if (elevation > hourData.freezingLevel && hourData.freezingLevel > 0) {
    hazards++;
    reasons.push(`Ice: above freezing level (FL ${Math.round(hourData.freezingLevel)}m)`);
  }

  // --- Hazard: Blind (peak in cloud with high coverage) ---
  if (elevation > hourData.cloudBase && hourData.cloudCover >= CAST_THRESHOLDS.CLOUD_BLIND) {
    hazards++;
    reasons.push(`Blind: in cloud (CB ${Math.round(hourData.cloudBase)}m, ${Math.round(hourData.cloudCover)}%)`);
  }

  // --- Hazard: Wind (dangerous gusts) ---
  if (hourData.windGusts >= CAST_THRESHOLDS.WIND_MODERATE) {
    hazards++;
    reasons.push(`Wind: gusts ${Math.round(hourData.windGusts)} km/h`);
  }

  // --- Hazard: Precip (significant wet + snow) ---
  if (hourData.precipitation >= CAST_THRESHOLDS.PRECIP_SIGNIFICANT &&
      hourData.snowfall >= CAST_THRESHOLDS.SNOW_SIGNIFICANT) {
    hazards++;
    reasons.push(`Precip: ${hourData.precipitation.toFixed(1)}mm rain + ${hourData.snowfall.toFixed(1)}cm snow`);
  }

  // --- Thunderstorm indicator ---
  if (hourData.cape >= CAST_THRESHOLDS.CAPE_HIGH) {
    thunder = 'TS!';
    reasons.push(`Thunderstorm likely: CAPE ${Math.round(hourData.cape)} J/kg`);
  } else if (hourData.cape >= CAST_THRESHOLDS.CAPE_MODERATE) {
    thunder = 'TS?';
    reasons.push(`Thunderstorm possible: CAPE ${Math.round(hourData.cape)} J/kg`);
  }

  // --- Extreme wind override → !!! ---
  let danger: string;
  if (hourData.windGusts >= CAST_THRESHOLDS.WIND_EXTREME) {
    danger = '!!!';
    if (!reasons.some(r => r.startsWith('Wind:'))) {
      reasons.push(`Extreme wind: gusts ${Math.round(hourData.windGusts)} km/h`);
    }
  } else if (hazards >= 3) {
    danger = '!!!';
  } else if (hazards === 2) {
    danger = '!!';
  } else if (hazards === 1) {
    danger = '!';
  } else {
    danger = '';
  }

  // Map danger to color level
  let level: SeverityLevel;
  if (danger === '!!!' || danger === '!!') {
    level = 'red';
  } else if (danger === '!' || thunder !== '') {
    level = 'amber';
  } else {
    level = 'green';
  }

  return { level, danger, thunder, reasons, windChill };
}

/**
 * Calculate severity for a full hourly forecast array.
 */
export function calculateHourlySeverities(
  hourlyData: HourlyData[],
  pinElevation?: number
): SeverityResult[] {
  return hourlyData.map(hour => calculateSeverity(hour, pinElevation));
}

/**
 * Color mapping for severity levels.
 */
export const SEVERITY_COLORS = {
  green: {
    bg: '#2563eb',
    text: '#ffffff',
    label: 'Safe',
    border: 'border-blue-600',
    bgClass: 'bg-blue-600',
    textClass: 'text-white'
  },
  amber: {
    bg: '#d97706',
    text: '#ffffff',
    label: 'Caution',
    border: 'border-amber-600',
    bgClass: 'bg-amber-600',
    textClass: 'text-white'
  },
  red: {
    bg: '#dc2626',
    text: '#ffffff',
    label: 'Danger',
    border: 'border-red-600',
    bgClass: 'bg-red-600',
    textClass: 'text-white'
  },
};

/**
 * Get severity summary across multiple pins.
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
    message = 'All pins safe';
  } else if (dangerCount > 0 && cautionCount > 0) {
    message = `${cautionCount} caution, ${dangerCount} danger`;
  } else if (dangerCount > 0) {
    message = `${dangerCount} danger — check conditions`;
  } else {
    message = `${cautionCount} caution`;
  }

  return { allSafe, dangerCount, cautionCount, message };
}
