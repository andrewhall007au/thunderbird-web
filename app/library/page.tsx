'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  getLibraryRoutes,
  getLibraryRoute,
  cloneLibraryRoute,
  LibraryRouteResponse,
  LibraryRouteDetailResponse
} from '../lib/api';
import { Map, Mountain, Clock, Ruler, Copy, X, ChevronRight } from 'lucide-react';

// Dynamic import for map preview
const MapEditor = dynamic(() => import('../components/map/MapEditor'), {
  ssr: false,
  loading: () => <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
});

const DIFFICULTY_LABELS = ['Easy', 'Moderate', 'Challenging', 'Difficult', 'Expert'];

export default function LibraryPage() {
  const router = useRouter();
  const [routes, setRoutes] = useState<LibraryRouteResponse[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<LibraryRouteDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCloning, setIsCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRoutes();
  }, []);

  async function loadRoutes() {
    try {
      const data = await getLibraryRoutes();
      setRoutes(data);
    } catch (e) {
      setError('Failed to load route library');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSelectRoute(id: number) {
    try {
      const detail = await getLibraryRoute(id);
      setSelectedRoute(detail);
    } catch (e) {
      setError('Failed to load route details');
    }
  }

  async function handleClone() {
    if (!selectedRoute) return;

    setIsCloning(true);
    try {
      const result = await cloneLibraryRoute(selectedRoute.id);
      router.push(`/create?id=${result.route_id}`);
    } catch (e) {
      setError('Failed to clone route. Please log in first.');
      setIsCloning(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white text-gray-900 p-8">
        <div className="max-w-6xl mx-auto animate-pulse space-y-4">
          <div className="h-8 bg-gray-100 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-gray-100 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Route Library</h1>
        <p className="text-gray-500 mb-8">
          Browse popular trails and clone them to create your own custom route
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
            {error}
            <button onClick={() => setError(null)} className="ml-4 underline">Dismiss</button>
          </div>
        )}

        {routes.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <Map className="w-16 h-16 mx-auto mb-4 text-gray-500" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">No routes in library yet</h2>
            <p className="text-gray-500 mb-6">Check back soon or create your own route</p>
            <Link
              href="/create"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-gray-900 rounded-lg hover:bg-blue-500"
            >
              Create Route
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {routes.map((route) => (
              <button
                key={route.id}
                onClick={() => handleSelectRoute(route.id)}
                className="text-left p-4 bg-gray-50 rounded-lg hover:bg-gray-100/50 transition-colors group"
              >
                <h2 className="text-lg font-semibold text-gray-900 group-hover:text-blue-400 transition-colors">
                  {route.name}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {route.region}, {route.country}
                </p>

                <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
                  {route.distance_km && (
                    <span className="flex items-center gap-1">
                      <Ruler className="w-4 h-4" />
                      {route.distance_km.toFixed(0)} km
                    </span>
                  )}
                  {route.typical_days && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {route.typical_days} days
                    </span>
                  )}
                  {route.difficulty_grade && (
                    <span className="flex items-center gap-1">
                      <Mountain className="w-4 h-4" />
                      {DIFFICULTY_LABELS[route.difficulty_grade - 1] || 'Unknown'}
                    </span>
                  )}
                </div>

                <div className="mt-4 flex items-center text-blue-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                  View details <ChevronRight className="w-4 h-4" />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Route Detail Modal */}
        {selectedRoute && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-50 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{selectedRoute.name}</h2>
                    <p className="text-gray-500">
                      {selectedRoute.region}, {selectedRoute.country}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedRoute(null)}
                    className="p-2 text-gray-500 hover:text-gray-900"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {selectedRoute.description && (
                  <p className="text-gray-700 mb-6">{selectedRoute.description}</p>
                )}

                <div className="flex flex-wrap gap-4 mb-6 text-sm">
                  {selectedRoute.distance_km && (
                    <div className="px-3 py-2 bg-gray-100 rounded-lg">
                      <span className="text-gray-500">Distance:</span>{' '}
                      <span className="text-gray-900">{selectedRoute.distance_km.toFixed(0)} km</span>
                    </div>
                  )}
                  {selectedRoute.typical_days && (
                    <div className="px-3 py-2 bg-gray-100 rounded-lg">
                      <span className="text-gray-500">Duration:</span>{' '}
                      <span className="text-gray-900">{selectedRoute.typical_days} days</span>
                    </div>
                  )}
                  {selectedRoute.difficulty_grade && (
                    <div className="px-3 py-2 bg-gray-100 rounded-lg">
                      <span className="text-gray-500">Difficulty:</span>{' '}
                      <span className="text-gray-900">{DIFFICULTY_LABELS[selectedRoute.difficulty_grade - 1]}</span>
                    </div>
                  )}
                </div>

                {/* Map Preview */}
                {selectedRoute.track_geojson && (
                  <div className="mb-6 h-64 rounded-lg overflow-hidden">
                    <MapEditor trackGeojson={selectedRoute.track_geojson} />
                  </div>
                )}

                {/* Waypoint Preview */}
                {selectedRoute.waypoint_preview.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                      Key Waypoints
                    </h3>
                    <ul className="space-y-1 text-sm text-gray-700">
                      {selectedRoute.waypoint_preview.map((wp, i) => (
                        <li key={i}>&bull; {wp.name}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Clone Button */}
                <button
                  onClick={handleClone}
                  disabled={isCloning}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-gray-900 rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Copy className="w-5 h-5" />
                  {isCloning ? 'Cloning...' : 'Clone & Customize'}
                </button>
                <p className="text-center text-sm text-gray-500 mt-2">
                  Creates a copy you can edit and customize
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
