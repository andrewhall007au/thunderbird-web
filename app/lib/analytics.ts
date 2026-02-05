/**
 * Analytics utilities for path tracking and A/B assignment.
 *
 * Tracks user entry path and assigns A/B variant for conversion analysis.
 * All functions are SSR-safe (check typeof window !== 'undefined').
 *
 * LocalStorage keys used:
 * - tb_entry_path: 'create' | 'buy' | 'organic'
 * - tb_variant: 'A' | 'B'
 * - tb_session_start: ISO timestamp
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

// LocalStorage key constants
const STORAGE_KEYS = {
  ENTRY_PATH: 'tb_entry_path',
  VARIANT: 'tb_variant',
  SESSION_START: 'tb_session_start',
} as const;

export type EntryPath = 'create' | 'buy' | 'organic';
export type Variant = 'A' | 'B';

export interface TrackingContext {
  entry_path: EntryPath;
  variant: Variant;
  session_start: string;
}

/**
 * Initialize path tracking on first visit.
 *
 * Call this on landing page or app layout to capture entry path.
 * Only sets values on first visit (won't overwrite existing).
 *
 * @param searchParams - URL search params (use useSearchParams hook)
 *
 * @example
 * ```tsx
 * 'use client';
 * import { useSearchParams } from 'next/navigation';
 * import { initPathTracking } from '@/app/lib/analytics';
 *
 * useEffect(() => {
 *   const params = new URLSearchParams(searchParams.toString());
 *   initPathTracking(params);
 * }, [searchParams]);
 * ```
 */
export function initPathTracking(searchParams: URLSearchParams): void {
  // SSR guard
  if (typeof window === 'undefined') return;

  // Only initialize once per session (first visit)
  if (localStorage.getItem(STORAGE_KEYS.ENTRY_PATH)) return;

  // Extract path from ?path= URL param (default: 'organic')
  const pathParam = searchParams.get('path');
  let entryPath: EntryPath = 'organic';
  if (pathParam === 'create' || pathParam === 'buy') {
    entryPath = pathParam;
  }

  // Assign A/B variant randomly
  const variant: Variant = Math.random() < 0.5 ? 'A' : 'B';

  // Store in localStorage
  localStorage.setItem(STORAGE_KEYS.ENTRY_PATH, entryPath);
  localStorage.setItem(STORAGE_KEYS.VARIANT, variant);
  localStorage.setItem(STORAGE_KEYS.SESSION_START, new Date().toISOString());
}

/**
 * Get current tracking context from localStorage.
 *
 * @returns Tracking context object or null if not initialized
 *
 * @example
 * ```tsx
 * const context = getTrackingContext();
 * if (context) {
 *   console.log(`User entered via ${context.entry_path}, variant ${context.variant}`);
 * }
 * ```
 */
export function getTrackingContext(): TrackingContext | null {
  // SSR guard
  if (typeof window === 'undefined') return null;

  const entryPath = localStorage.getItem(STORAGE_KEYS.ENTRY_PATH) as EntryPath | null;
  const variant = localStorage.getItem(STORAGE_KEYS.VARIANT) as Variant | null;
  const sessionStart = localStorage.getItem(STORAGE_KEYS.SESSION_START);

  if (!entryPath || !variant || !sessionStart) {
    return null;
  }

  return {
    entry_path: entryPath,
    variant: variant,
    session_start: sessionStart,
  };
}

/**
 * Track an analytics event.
 *
 * Sends event to backend /api/analytics endpoint.
 * Fire and forget - won't block UI or throw errors.
 *
 * @param event - Event name (e.g., 'page_view', 'purchase_completed')
 * @param properties - Additional event properties
 *
 * @example
 * ```tsx
 * // Track page view
 * trackEvent('page_view', { path: '/create' });
 *
 * // Track route creation
 * trackEvent('route_created', { waypoint_count: 5 });
 *
 * // Track purchase
 * trackEvent('purchase_completed', { amount_cents: 2999, entry_path: 'create' });
 * ```
 */
export function trackEvent(
  event: string,
  properties?: Record<string, unknown>
): void {
  // SSR guard
  if (typeof window === 'undefined') return;

  const context = getTrackingContext();

  // Build payload
  const payload = {
    event,
    variant: context?.variant || null,
    entry_path: context?.entry_path || null,
    properties: properties || {},
    timestamp: new Date().toISOString(),
  };

  // Fire and forget - don't await, don't block UI
  fetch(`${API_BASE}/api/analytics`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Silently ignore errors - analytics should never break the app
  });
}

// ============================================================================
// Convenience functions for common events
// ============================================================================

/**
 * Track page view event.
 */
export function trackPageView(path: string): void {
  trackEvent('page_view', { path });
}

/**
 * Track route creation event.
 */
export function trackRouteCreated(waypointCount: number): void {
  trackEvent('route_created', { waypoint_count: waypointCount });
}

/**
 * Track simulator view event.
 */
export function trackSimulatorViewed(routeId: number): void {
  trackEvent('simulator_viewed', { route_id: routeId });
}

/**
 * Track checkout started event.
 */
export function trackCheckoutStarted(): void {
  const context = getTrackingContext();
  trackEvent('checkout_started', { entry_path: context?.entry_path });
}

/**
 * Track purchase completed event.
 */
export function trackPurchaseCompleted(amountCents: number): void {
  const context = getTrackingContext();
  trackEvent('purchase_completed', {
    amount_cents: amountCents,
    entry_path: context?.entry_path,
  });
}
