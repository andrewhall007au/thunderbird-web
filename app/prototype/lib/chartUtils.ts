/**
 * Pure utility functions for sparkline chart rendering.
 */

import type { HourlyData } from './types';

export type TimeRange = '12h' | '24h' | '7d';

const RANGE_HOURS: Record<TimeRange, number> = {
  '12h': 12,
  '24h': 24,
  '7d': 168,
};

/** Slice hourly data to the selected time range. */
export function sliceToRange(hourly: HourlyData[], range: TimeRange): HourlyData[] {
  const count = RANGE_HOURS[range];
  return hourly.slice(0, count);
}

/** Map hour index to SVG x-pixel. */
export function xScale(index: number, total: number, width: number): number {
  if (total <= 1) return width / 2;
  return (index / (total - 1)) * width;
}

/** Map data value to SVG y-pixel (0 = top). */
export function yScale(value: number, min: number, max: number, height: number): number {
  if (max === min) return height / 2;
  return height - ((value - min) / (max - min)) * height;
}

/** Build SVG polyline `points` string. */
export function buildPolylinePoints(
  values: number[],
  width: number,
  height: number,
  min?: number,
  max?: number
): string {
  if (values.length === 0) return '';
  const lo = min ?? Math.min(...values);
  const hi = max ?? Math.max(...values);
  return values
    .map((v, i) => `${xScale(i, values.length, width)},${yScale(v, lo, hi, height)}`)
    .join(' ');
}

/** Build SVG polygon `points` string (closed at bottom edge for area fill). */
export function buildAreaPolygonPoints(
  values: number[],
  width: number,
  height: number,
  min?: number,
  max?: number
): string {
  if (values.length === 0) return '';
  const lo = min ?? Math.min(...values);
  const hi = max ?? Math.max(...values);
  const top = values
    .map((v, i) => `${xScale(i, values.length, width)},${yScale(v, lo, hi, height)}`)
    .join(' ');
  const lastX = xScale(values.length - 1, values.length, width);
  const firstX = xScale(0, values.length, width);
  return `${top} ${lastX},${height} ${firstX},${height}`;
}

/** Time label ported from TimeScrubber. */
export function getTimeLabel(hoursFromNow: number): string {
  if (hoursFromNow === 0) return 'Now';
  const now = new Date();
  const target = new Date(now.getTime() + hoursFromNow * 3600000);
  const hour = target.getHours();
  const ampm = hour >= 12 ? 'pm' : 'am';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayDiff = Math.floor(hoursFromNow / 24);
  if (dayDiff === 0) return `Today ${h12}${ampm}`;
  return `${days[target.getDay()]} ${h12}${ampm}`;
}

/** Compact time label for chart axis — short enough to fit without overlap. */
export function getCompactTimeLabel(hoursFromNow: number): string {
  if (hoursFromNow === 0) return 'Now';
  const now = new Date();
  const target = new Date(now.getTime() + hoursFromNow * 3600000);
  const hour = target.getHours();
  const suffix = hour >= 12 ? 'pm' : 'am';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  // Same calendar day — just show hour
  if (target.toDateString() === now.toDateString()) {
    return `${h12}${suffix}`;
  }
  // Different day — show day + hour
  return `${days[target.getDay()]} ${h12}${suffix}`;
}

/** Cloud cover emoji for a given percentage. */
export function cloudEmoji(cover: number): string {
  if (cover <= 10) return '\u2600\uFE0F';   // ☀️
  if (cover <= 30) return '\uD83C\uDF24';    // 🌤
  if (cover <= 60) return '\u26C5';           // ⛅
  if (cover <= 85) return '\uD83C\uDF25';    // 🌥
  return '\u2601\uFE0F';                      // ☁️
}

/** Wind direction as a compass arrow character. */
export function windArrow(degrees: number): string {
  // Meteorological convention: direction wind comes FROM
  // Arrow points in direction wind is going (opposite)
  const arrows = ['\u2193', '\u2199', '\u2190', '\u2196', '\u2191', '\u2197', '\u2192', '\u2198']; // ↓↙←↖↑↗→↘
  const idx = Math.round(degrees / 45) % 8;
  return arrows[idx];
}

/** Compass label for wind direction. */
export function windCompass(degrees: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(degrees / 45) % 8;
  return dirs[idx];
}

/** Get evenly-spaced tick indices for value/time annotations. */
export function getTickIndices(range: TimeRange, total: number): number[] {
  const step = range === '12h' ? 3 : range === '24h' ? 6 : 24;
  const indices: number[] = [];
  for (let i = 0; i < total; i += step) {
    indices.push(i);
  }
  // Always include the last point
  if (indices[indices.length - 1] !== total - 1 && total > 1) {
    indices.push(total - 1);
  }
  return indices;
}

/** Convert click x-position to nearest hour index. */
export function xToHourIndex(clientX: number, svgRect: DOMRect, totalHours: number): number {
  const x = clientX - svgRect.left;
  const ratio = Math.max(0, Math.min(1, x / svgRect.width));
  return Math.round(ratio * (totalHours - 1));
}

/** Get hour indices at 24h boundaries for day divider lines. */
export function getDayBoundaries(totalHours: number): number[] {
  const boundaries: number[] = [];
  for (let h = 24; h < totalHours; h += 24) {
    boundaries.push(h);
  }
  return boundaries;
}

/**
 * Group hourly data indices by calendar day.
 * Returns array of { startIdx, endIdx, label } for each day.
 */
export function getCalendarDayGroups(hourlyData: HourlyData[]): { startIdx: number; endIdx: number; label: string }[] {
  if (hourlyData.length === 0) return [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayStr = new Date().toDateString();
  const groups: { startIdx: number; endIdx: number; label: string }[] = [];
  let prevDateStr = '';
  let groupStart = 0;

  for (let i = 0; i <= hourlyData.length; i++) {
    const dateStr = i < hourlyData.length ? new Date(hourlyData[i].time).toDateString() : '';
    if (dateStr !== prevDateStr) {
      if (i > 0) {
        const d = new Date(hourlyData[groupStart].time);
        const label = d.toDateString() === todayStr ? 'Today' : dayNames[d.getDay()];
        groups.push({ startIdx: groupStart, endIdx: i - 1, label });
      }
      groupStart = i;
      prevDateStr = dateStr;
    }
  }
  return groups;
}
