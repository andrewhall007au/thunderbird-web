'use client';

import { useState } from 'react';
import { Search, X } from 'lucide-react';

interface QuickLocationSearchProps {
  onLocationSelect: (lat: number, lng: number) => void;
}

export default function QuickLocationSearch({ onLocationSelect }: QuickLocationSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError('');

    try {
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
        const { lat, lon } = results[0];
        onLocationSelect(parseFloat(lat), parseFloat(lon));
        setSearchQuery(''); // Clear after successful search
      } else {
        setError('Location not found');
      }
    } catch (err) {
      setError('Search failed');
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="mb-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setError('');
            }}
            placeholder="Search location to jump on map (e.g., Cradle Mountain)..."
            className="w-full px-4 py-2 pr-10 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            disabled={isSearching}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setError('');
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={isSearching || !searchQuery.trim()}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          <Search className="w-4 h-4" />
          {isSearching ? 'Searching...' : 'Go'}
        </button>
      </form>
      {error && (
        <p className="mt-1 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
