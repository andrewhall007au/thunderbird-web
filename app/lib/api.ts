/**
 * API client for route operations.
 *
 * Connects frontend to backend route/waypoint endpoints.
 * See backend/app/routers/routes.py for API spec.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ApiError {
  detail: string;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// ============================================================================
// Types matching backend models (backend/app/routers/routes.py)
// ============================================================================

export interface RouteResponse {
  id: number;
  name: string;
  status: 'draft' | 'active' | 'archived';
  waypoint_count: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface WaypointResponse {
  id: number;
  name: string;
  type: 'camp' | 'peak' | 'poi';
  sms_code: string;
  lat: number;
  lng: number;
  elevation: number;
  order_index: number;
}

export interface RouteDetailResponse extends Omit<RouteResponse, 'waypoint_count'> {
  gpx_data: {
    track_geojson?: GeoJSON.Feature;
    waypoints?: Array<{ name: string; lat: number; lng: number; elevation?: number }>;
    metadata?: { name?: string; description?: string };
  } | null;
  waypoints: WaypointResponse[];
}

export interface GPXUploadResponse {
  track_geojson: GeoJSON.Feature;
  waypoints: Array<{ name: string; lat: number; lng: number; elevation?: number }>;
  metadata: { name?: string; description?: string };
}

// ============================================================================
// Route operations
// ============================================================================

/**
 * Upload and parse GPX file (preview only, not saved).
 */
export async function uploadGPX(file: File): Promise<GPXUploadResponse> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/api/routes/upload-gpx`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(error.detail || 'Failed to upload GPX');
  }

  return response.json();
}

/**
 * Create a new route.
 */
export async function createRoute(data: {
  name: string;
  gpx_data?: object;
}): Promise<RouteResponse> {
  return apiRequest('/api/routes', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

/**
 * List all routes for the current account.
 */
export async function getRoutes(): Promise<RouteResponse[]> {
  return apiRequest('/api/routes');
}

/**
 * Get route details including waypoints.
 */
export async function getRoute(id: number): Promise<RouteDetailResponse> {
  return apiRequest(`/api/routes/${id}`);
}

/**
 * Update a route.
 */
export async function updateRoute(
  id: number,
  data: { name?: string; status?: string; gpx_data?: object }
): Promise<RouteResponse> {
  return apiRequest(`/api/routes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  });
}

/**
 * Delete a route and all its waypoints.
 */
export async function deleteRoute(id: number): Promise<void> {
  await apiRequest(`/api/routes/${id}`, { method: 'DELETE' });
}

// ============================================================================
// Waypoint operations
// ============================================================================

/**
 * Add a waypoint to a route.
 */
export async function addWaypoint(
  routeId: number,
  data: { name: string; type: string; lat: number; lng: number; elevation?: number }
): Promise<WaypointResponse> {
  return apiRequest(`/api/routes/${routeId}/waypoints`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

/**
 * Update a waypoint.
 */
export async function updateWaypoint(
  routeId: number,
  waypointId: number,
  data: { name?: string; type?: string; lat?: number; lng?: number; elevation?: number }
): Promise<WaypointResponse> {
  return apiRequest(`/api/routes/${routeId}/waypoints/${waypointId}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  });
}

/**
 * Delete a waypoint from a route.
 */
export async function deleteWaypoint(routeId: number, waypointId: number): Promise<void> {
  await apiRequest(`/api/routes/${routeId}/waypoints/${waypointId}`, {
    method: 'DELETE'
  });
}

/**
 * Reorder waypoints in a route.
 */
export async function reorderWaypoints(
  routeId: number,
  waypointIds: number[]
): Promise<WaypointResponse[]> {
  return apiRequest(`/api/routes/${routeId}/waypoints/reorder`, {
    method: 'POST',
    body: JSON.stringify({ waypoint_ids: waypointIds })
  });
}

// ============================================================================
// Forecast Preview
// ============================================================================

export interface ForecastPreviewResponse {
  sms_content: string;
  source: 'live' | 'sample';
}

export interface WaypointForForecast {
  lat: number;
  lng: number;
  elevation: number;
  name: string;
  sms_code: string;
  type: string;
}

/**
 * Get a live forecast preview for a waypoint.
 * Returns formatted SMS content exactly as user would receive.
 *
 * For CAMPS7/PEAKS7 commands, pass all waypoints to get multi-waypoint forecasts.
 */
export async function getForecastPreview(data: {
  lat: number;
  lng: number;
  elevation: number;
  name: string;
  sms_code: string;
  command: string;
  waypoints?: WaypointForForecast[];
}): Promise<ForecastPreviewResponse> {
  return apiRequest('/api/routes/forecast-preview', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

// ============================================================================
// Route Library operations
// ============================================================================

export interface LibraryRouteResponse {
  id: number;
  name: string;
  description?: string;
  country?: string;
  region?: string;
  difficulty_grade?: number;
  distance_km?: number;
  typical_days?: string;
}

export interface LibraryRouteDetailResponse extends LibraryRouteResponse {
  waypoint_preview: Array<{ name: string; lat: number; lng: number }>;
  track_geojson?: GeoJSON.Feature;
}

/**
 * List all active library routes.
 * Public endpoint - no auth required.
 */
export async function getLibraryRoutes(country?: string): Promise<LibraryRouteResponse[]> {
  const url = country
    ? `/api/library?country=${encodeURIComponent(country)}`
    : '/api/library';
  return apiRequest(url);
}

/**
 * Get detailed library route info including track preview.
 * Public endpoint - no auth required.
 */
export async function getLibraryRoute(id: number): Promise<LibraryRouteDetailResponse> {
  return apiRequest(`/api/library/${id}`);
}

/**
 * Clone a library route to user's account.
 * Requires authentication.
 */
export async function cloneLibraryRoute(id: number): Promise<{ success: boolean; route_id: number; message: string }> {
  return apiRequest(`/api/library/${id}/clone`, { method: 'POST' });
}
