/**
 * Open-Meteo API client for weather forecasting
 * Fetches hourly forecast data for multiple locations in a single batch request
 */

import { PinForecast, HourlyData } from './types';
import type { PayloadMetrics } from '../components/PayloadInspector';

// WMO weather code to human-readable condition
export const WMO_CODES: Record<number, string> = {
  0: 'Clear',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Heavy freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Rain showers',
  81: 'Mod rain showers',
  82: 'Heavy rain showers',
  85: 'Snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm + hail',
  99: 'Thunderstorm + heavy hail'
};

/**
 * Infer likely weather model based on location
 * Open-Meteo doesn't report which model was used, so we estimate
 */
function inferModelResolution(lat: number, lng: number): string {
  // US (HRRR 3km / GFS 13km)
  if (lat >= 24 && lat <= 50 && lng >= -130 && lng <= -60) {
    return 'HRRR 3km / GFS 13km';
  }
  // Europe (ICON-D2 2km)
  if (lat >= 35 && lat <= 72 && lng >= -25 && lng <= 45) {
    return 'ICON-D2 2km';
  }
  // Australia (BOM ACCESS 2.2km)
  if (lat >= -45 && lat <= -10 && lng >= 110 && lng <= 155) {
    return 'BOM ACCESS 2.2km';
  }
  // Default: GFS 13km
  return 'GFS 13km';
}

/**
 * Parse Open-Meteo hourly response into HourlyData array
 */
function parseHourlyData(hourly: any, now: Date, elevation: number): HourlyData[] {
  const times = hourly.time || [];
  const temperatures = hourly.temperature_2m || [];
  const windSpeeds = hourly.wind_speed_10m || [];
  const windGusts = hourly.wind_gusts_10m || [];
  const windDirections = hourly.wind_direction_10m || [];
  const rainProbs = hourly.precipitation_probability || [];
  const precip = hourly.precipitation || [];
  const weatherCodes = hourly.weather_code || [];
  const cloudCover = hourly.cloud_cover || [];
  const dewpoints = hourly.dew_point_2m || [];
  const freezingLevels = hourly.freezing_level_height || [];
  const snowfalls = hourly.snowfall || [];
  const capes = hourly.cape || [];

  const result: HourlyData[] = [];

  for (let i = 0; i < times.length; i++) {
    const timeStr = times[i];
    const time = new Date(timeStr);
    const hoursFromNow = Math.round((time.getTime() - now.getTime()) / (1000 * 60 * 60));

    const temp = temperatures[i] ?? 0;
    const dewpoint = dewpoints[i] ?? 0;
    // Cloud base via LCL formula: (temp - dewpoint) * 125 + elevation
    const cloudBase = (temp - dewpoint) * 125 + elevation;

    result.push({
      time: timeStr,
      hoursFromNow,
      temperature: temp,
      windSpeed: windSpeeds[i] ?? 0,
      windGusts: windGusts[i] ?? 0,
      windDirection: windDirections[i] ?? 0,
      rainProbability: rainProbs[i] ?? 0,
      precipitation: precip[i] ?? 0,
      weatherCode: weatherCodes[i] ?? 0,
      cloudCover: cloudCover[i] ?? 0,
      dewpoint,
      freezingLevel: freezingLevels[i] ?? 0,
      snowfall: snowfalls[i] ?? 0,
      cape: capes[i] ?? 0,
      cloudBase
    });
  }

  return result;
}

/**
 * Fetch weather forecasts for multiple pins in a single batch call
 *
 * @param pins Array of {lat, lng} coordinates
 * @param options Optional settings for simulation and metrics
 * @returns Map of lat,lng key to PinForecast, plus payload metrics
 */
export async function fetchMultiPinWeather(
  pins: { lat: number; lng: number }[],
  options?: {
    simulatedLatencyMs?: number;
    onMetrics?: (metrics: PayloadMetrics) => void;
  }
): Promise<Map<string, PinForecast>> {
  if (pins.length === 0) {
    return new Map();
  }

  // Build comma-separated coordinate lists
  const latitudes = pins.map(p => p.lat.toFixed(6)).join(',');
  const longitudes = pins.map(p => p.lng.toFixed(6)).join(',');

  // Open-Meteo API parameters
  const params = new URLSearchParams({
    latitude: latitudes,
    longitude: longitudes,
    hourly: [
      'temperature_2m',
      'wind_speed_10m',
      'wind_gusts_10m',
      'wind_direction_10m',
      'precipitation_probability',
      'precipitation',
      'weather_code',
      'cloud_cover',
      'dew_point_2m',
      'freezing_level_height',
      'snowfall',
      'cape'
    ].join(','),
    forecast_hours: '168',
    timezone: 'auto'
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params}`;

  try {
    // Start timing
    const startTime = performance.now();

    // Simulate satellite latency if requested
    if (options?.simulatedLatencyMs) {
      await new Promise(resolve => setTimeout(resolve, options.simulatedLatencyMs));
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Open-Meteo API error: ${response.status}`);
    }

    // Clone response to measure size
    const responseClone = response.clone();
    const responseText = await responseClone.text();
    const data = JSON.parse(responseText);

    // End timing
    const endTime = performance.now();
    const apiTime = Math.round(endTime - startTime - (options?.simulatedLatencyMs || 0));
    const totalTime = Math.round(endTime - startTime);

    // Calculate payload metrics
    if (options?.onMetrics) {
      const metrics: PayloadMetrics = {
        requestUrl: url,
        requestSizeBytes: url.length + 200, // URL + approximate headers
        responseSizeBytes: responseText.length,
        responseTimeMs: apiTime,
        totalTimeMs: totalTime,
        pinCount: pins.length
      };
      options.onMetrics(metrics);
    }
    const now = new Date();
    const results = new Map<string, PinForecast>();

    // Open-Meteo returns array when multiple locations
    // Single location returns single object
    const locations = Array.isArray(data) ? data : [data];

    for (let i = 0; i < locations.length && i < pins.length; i++) {
      const location = locations[i];
      const pin = pins[i];
      const key = `${pin.lat.toFixed(3)},${pin.lng.toFixed(3)}`;

      // Extract elevation
      const elevation = location.elevation || 0;

      // Parse hourly data (elevation needed for cloud base calculation)
      const hourly = parseHourlyData(location.hourly || {}, now, elevation);

      // Infer model resolution
      const modelResolution = inferModelResolution(pin.lat, pin.lng);

      results.set(key, {
        hourly,
        elevation,
        modelResolution,
        fetchedAt: now
      });
    }

    return results;
  } catch (error) {
    console.error('Failed to fetch weather from Open-Meteo:', error);
    // Return empty map on error
    return new Map();
  }
}

/**
 * Get weather condition text from WMO code
 */
export function getWeatherCondition(code: number): string {
  return WMO_CODES[code] || 'Unknown';
}

/**
 * Get weather emoji from WMO code
 */
export function getWeatherEmoji(code: number): string {
  if (code === 0 || code === 1) return '☀️';  // Clear
  if (code === 2) return '⛅';  // Partly cloudy
  if (code === 3) return '☁️';  // Overcast
  if (code >= 45 && code <= 48) return '🌫️';  // Fog
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return '🌧️';  // Rain
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return '🌨️';  // Snow
  if (code >= 95) return '⛈️';  // Thunderstorm
  return '☁️';  // Default
}

/**
 * Convert wind direction in degrees to compass bearing
 */
export function getWindBearing(degrees: number): string {
  const bearings = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round((degrees % 360) / 22.5) % 16;
  return bearings[index];
}
