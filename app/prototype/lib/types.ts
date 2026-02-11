/**
 * Type definitions for the companion app prototype
 */

export interface Pin {
  id: string;         // "A", "B", "C"...
  lat: number;
  lng: number;
  label: string;      // Same as id
  forecast?: PinForecast;
  loading?: boolean;
}

export interface PinForecast {
  hourly: HourlyData[];
  elevation: number;       // Model elevation in meters
  modelResolution: string; // e.g. "HRRR 3km", "GFS 13km"
  fetchedAt: Date;
}

export interface HourlyData {
  time: string;            // ISO 8601 datetime
  hoursFromNow: number;    // 0, 1, 2... 72
  temperature: number;     // Celsius
  windSpeed: number;       // km/h
  windGusts: number;       // km/h
  windDirection: number;   // degrees
  rainProbability: number; // 0-100%
  precipitation: number;   // mm
  weatherCode: number;     // WMO weather code
  cloudCover: number;      // 0-100%
}
