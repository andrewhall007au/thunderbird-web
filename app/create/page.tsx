'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import GPXUpload from '../components/upload/GPXUpload';
import { parseGPX } from '@we-gold/gpxjs';

// Dynamic import to avoid SSR issues with MapLibre
const MapEditor = dynamic(() => import('../components/map/MapEditor'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] md:h-[600px] bg-gray-900 rounded-lg animate-pulse flex items-center justify-center">
      <p className="text-gray-500">Loading map...</p>
    </div>
  )
});

export default function CreateRoutePage() {
  const [trackGeojson, setTrackGeojson] = useState<GeoJSON.Feature | null>(null);
  const [routeName, setRouteName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGPXUpload = async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      const text = await file.text();
      const [result, err] = parseGPX(text);

      if (err) {
        throw new Error('Failed to parse GPX file');
      }

      // Convert to GeoJSON
      const geojson = result.toGeoJSON();

      // Find the track feature - cast to unknown first due to library type mismatch
      const features = geojson.features as unknown as GeoJSON.Feature[];
      const track = features.find(
        (f) => f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString'
      );

      if (track) {
        setTrackGeojson(track as GeoJSON.Feature);
        // Set default route name from GPX metadata or filename
        setRouteName(result.metadata?.name || file.name.replace('.gpx', ''));
      } else {
        setError('No track found in GPX file');
      }
    } catch (e) {
      setError('Failed to parse GPX file. Please check the format.');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Create Your Route</h1>
        <p className="text-gray-400 mb-8">
          Upload a GPX file from your favorite hiking app, then add waypoints for weather forecasts.
        </p>

        {!trackGeojson && (
          <GPXUpload onUpload={handleGPXUpload} isLoading={isLoading} />
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {trackGeojson && (
          <div className="mt-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Route Name
              </label>
              <input
                type="text"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="My Awesome Hike"
              />
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">Your Route</h2>
              <MapEditor trackGeojson={trackGeojson} />
            </div>

            <p className="text-gray-400 text-sm">
              Click on the map to add waypoints. Coming next: waypoint editor.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
