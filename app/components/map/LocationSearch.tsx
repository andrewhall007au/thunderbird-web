'use client';

import { useState } from 'react';
import { Search, MapPin } from 'lucide-react';

// Trailhead locations for nearby trail matching
// [trailId, lat, lng]
const trailheads: [string, number, number][] = [
  ['overland_track', -41.636, 145.949],
];

// Haversine distance in km
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findClosestTrail(lat: number, lng: number, radiusKm = 50): string | null {
  let closest: { id: string; dist: number } | null = null;
  for (const [id, tLat, tLng] of trailheads) {
    const dist = haversineKm(lat, lng, tLat, tLng);
    if (dist <= radiusKm && (closest === null || dist < closest.dist)) {
      closest = { id, dist };
    }
  }
  return closest?.id ?? null;
}

interface LocationSearchProps {
  onLocationSelect: (lat: number, lng: number, name: string) => void;
  onTrailSelect?: (trailId: string) => void;
}

// Popular hiking regions as quick options
const popularRegions = [
  { name: 'Tasmania, Australia', lat: -42.0, lng: 146.5 },
  { name: 'New Zealand Alps', lat: -43.5, lng: 170.1 },
  { name: 'Rocky Mountains, USA', lat: 39.7, lng: -105.8 },
  { name: 'Swiss Alps', lat: 46.5, lng: 8.0 },
  { name: 'Patagonia', lat: -49.3, lng: -73.0 },
  { name: 'Himalayas, Nepal', lat: 28.0, lng: 84.0 },
];

export default function LocationSearch({ onLocationSelect, onTrailSelect }: LocationSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleRegionClick = (region: typeof popularRegions[0]) => {
    onLocationSelect(region.lat, region.lng, region.name);
  };

  const handleManualSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      // Use Nominatim for geocoding (free, no API key required)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`,
        {
          headers: {
            'User-Agent': 'Thunderbird-Weather-App'
          }
        }
      );

      const results = await response.json();
      if (results.length > 0) {
        const { lat, lon, display_name } = results[0];
        const parsedLat = parseFloat(lat);
        const parsedLng = parseFloat(lon);

        // If a known trail is nearby, load it directly
        const trailId = findClosestTrail(parsedLat, parsedLng);
        if (trailId && onTrailSelect) {
          onTrailSelect(trailId);
        } else {
          onLocationSelect(parsedLat, parsedLng, display_name);
        }
      } else {
        alert('Location not found. Try a popular region or enter coordinates.');
      }
    } catch (error) {
      console.error('Search error:', error);
      alert('Search failed. Please try again or select a popular region.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-zinc-900 mb-2">
          Where is your hike?
        </h2>
        <p className="text-zinc-600">
          Search for a location or choose a popular region to start adding waypoints
        </p>
      </div>

      {/* Search Input */}
      <div className="bg-white rounded-xl p-6 border-2 border-zinc-200">
        <label className="block text-sm font-medium text-zinc-700 mb-3">
          Search for a location
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleManualSearch()}
            placeholder="e.g., Cradle Mountain, Torres del Paine..."
            className="flex-1 px-4 py-3 border-2 border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            disabled={isSearching}
          />
          <button
            onClick={handleManualSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Popular Regions */}
      <div className="bg-white rounded-xl p-6 border-2 border-zinc-200">
        <label className="block text-sm font-medium text-zinc-700 mb-3">
          Or choose a popular hiking region
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {popularRegions.map((region) => (
            <button
              key={region.name}
              onClick={() => handleRegionClick(region)}
              className="p-4 text-left border-2 border-zinc-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-all group"
            >
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-zinc-400 group-hover:text-orange-500" />
                <span className="text-sm font-medium text-zinc-900">
                  {region.name}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
