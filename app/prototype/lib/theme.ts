/**
 * Theme system for the Thunderbird prototype.
 * CSS custom properties for chart colors + light/dark theme definitions.
 */

export type ThemeMode = 'light' | 'dark';

export const THEMES: Record<ThemeMode, Record<string, string>> = {
  light: {
    '--chart-temp': '#1d4ed8',
    '--chart-temp-max': '#dc2626',
    '--chart-temp-min': '#2563eb',
    '--chart-temp-label': '#1d4ed8',
    '--chart-rain-prob': '#0ea5e9',
    '--chart-rain-bar': '#0284c7',
    '--chart-wind': '#7c3aed',
    '--chart-wind-fill': '#8b5cf6',
    '--chart-wind-label': '#6d28d9',
    '--chart-cloud': '#475569',
    '--chart-freeze': '#0891b2',
    '--chart-freeze-label': '#0e7490',
    '--chart-elev': '#c2410c',
    '--chart-tapped': '#d97706',
    '--chart-grid': '#d4d4d8',
    '--chart-axis-text': '#52525b',
    '--chart-pin-elev': '#d97706',
    '--chart-temp-max-label': '#dc2626',
    '--chart-elev-area': 'rgba(194, 65, 12, 0.15)',
  },
  dark: {
    '--chart-temp': '#3b82f6',
    '--chart-temp-max': '#ef4444',
    '--chart-temp-min': '#60a5fa',
    '--chart-temp-label': '#93c5fd',
    '--chart-rain-prob': '#93c5fd',
    '--chart-rain-bar': '#38bdf8',
    '--chart-wind': '#8b5cf6',
    '--chart-wind-fill': '#a78bfa',
    '--chart-wind-label': '#c4b5fd',
    '--chart-cloud': '#94a3b8',
    '--chart-freeze': '#22d3ee',
    '--chart-freeze-label': '#67e8f9',
    '--chart-elev': '#ea580c',
    '--chart-tapped': '#eab308',
    '--chart-grid': '#52525b',
    '--chart-axis-text': '#a1a1aa',
    '--chart-pin-elev': '#f59e0b',
    '--chart-temp-max-label': '#fca5a5',
    '--chart-elev-area': 'rgba(234, 88, 12, 0.15)',
  },
};
