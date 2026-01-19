'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getRoutes, deleteRoute, RouteResponse } from '../lib/api';
import { Map, Trash2, Edit, Plus } from 'lucide-react';

export default function MyRoutesPage() {
  const [routes, setRoutes] = useState<RouteResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRoutes();
  }, []);

  async function loadRoutes() {
    try {
      const data = await getRoutes();
      setRoutes(data);
    } catch (e) {
      setError('Failed to load routes. Please log in.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this route? This cannot be undone.')) return;

    try {
      await deleteRoute(id);
      setRoutes(routes.filter(r => r.id !== id));
    } catch (e) {
      alert('Failed to delete route');
    }
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-yellow-500/20 text-yellow-400',
    active: 'bg-green-500/20 text-green-400',
    archived: 'bg-gray-500/20 text-gray-400'
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-800 rounded w-1/4"></div>
            <div className="h-24 bg-gray-800 rounded"></div>
            <div className="h-24 bg-gray-800 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">My Routes</h1>
          <Link
            href="/create"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create New
          </Link>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {routes.length === 0 ? (
          <div className="text-center py-12 bg-gray-900 rounded-lg">
            <Map className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-300 mb-2">No routes yet</h2>
            <p className="text-gray-500 mb-6">Create your first route to get started</p>
            <Link
              href="/create"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Route
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {routes.map((route) => (
              <div
                key={route.id}
                className="flex items-center gap-4 p-4 bg-gray-900 rounded-lg hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-lg font-semibold text-white">{route.name}</h2>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[route.status] || statusColors.draft}`}>
                      {route.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {route.waypoint_count} waypoints
                    {route.created_at && (
                      <> &middot; Created {new Date(route.created_at).toLocaleDateString()}</>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/create?id=${route.id}`}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                    title="Edit route"
                  >
                    <Edit className="w-5 h-5" />
                  </Link>
                  <button
                    onClick={() => handleDelete(route.id)}
                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
                    title="Delete route"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
