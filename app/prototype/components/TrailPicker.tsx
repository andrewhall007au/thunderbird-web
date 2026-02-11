'use client';

import { useState } from 'react';
import { popularTrails, lazyTrailIds, loadTrailCoordinates, type TrailData } from '@/app/data/popularTrails';
import { ChevronDown, Search } from 'lucide-react';

interface TrailPickerProps {
  selectedTrailId: string | null;
  onTrailSelect: (trailId: string, geojson: GeoJSON.Feature) => void;
}

const COUNTRY_NAMES: Record<string, string> = {
  AU: 'Australia',
  CA: 'Canada',
  FR: 'France',
  DE: 'Germany',
  IT: 'Italy',
  JP: 'Japan',
  NZ: 'New Zealand',
  ZA: 'South Africa',
  CH: 'Switzerland',
  GB: 'United Kingdom',
  US: 'United States',
  NP: 'Nepal',
  PE: 'Peru',
  CL: 'Chile',
  AR: 'Argentina',
  BO: 'Bolivia',
  CO: 'Colombia',
  IN: 'India',
  NO: 'Norway',
  IS: 'Iceland',
  ES: 'Spain',
  GR: 'Greece',
  TR: 'Turkey',
  PT: 'Portugal',
  AT: 'Austria'
};

// Quick pick trail IDs
const QUICK_PICKS = [
  'overland_track',
  'pacific_crest_trail',
  'wonderland_trail',
  'milford_track',
  'tour_du_mont_blanc'
];

function trailToGeojson(trail: TrailData): GeoJSON.Feature {
  return {
    type: 'Feature',
    properties: { name: trail.name },
    geometry: {
      type: 'LineString',
      coordinates: trail.coordinates
    }
  };
}

export default function TrailPicker({ selectedTrailId, onTrailSelect }: TrailPickerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedTrail = popularTrails.find(t => t.id === selectedTrailId);

  const handleTrailClick = async (trail: TrailData) => {
    setLoading(true);
    try {
      // Check if trail needs lazy loading
      if (lazyTrailIds.has(trail.id)) {
        const coordinates = await loadTrailCoordinates(trail.id);
        const trailWithCoords = { ...trail, coordinates };
        const geojson = trailToGeojson(trailWithCoords);
        onTrailSelect(trail.id, geojson);
      } else {
        const geojson = trailToGeojson(trail);
        onTrailSelect(trail.id, geojson);
      }
      setIsExpanded(false);
      setSearchQuery('');
    } catch (error) {
      console.error('Failed to load trail:', error);
      alert('Failed to load trail data');
    } finally {
      setLoading(false);
    }
  };

  // Filter and group trails
  const filteredTrails = popularTrails.filter(trail => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      trail.name.toLowerCase().includes(query) ||
      trail.region.toLowerCase().includes(query) ||
      COUNTRY_NAMES[trail.country]?.toLowerCase().includes(query)
    );
  });

  const groupedTrails = filteredTrails.reduce((acc, trail) => {
    const country = trail.country;
    if (!acc[country]) acc[country] = [];
    acc[country].push(trail);
    return acc;
  }, {} as Record<string, TrailData[]>);

  // Sort countries alphabetically
  const sortedCountries = Object.keys(groupedTrails).sort((a, b) => {
    const nameA = COUNTRY_NAMES[a] || a;
    const nameB = COUNTRY_NAMES[b] || b;
    return nameA.localeCompare(nameB);
  });

  return (
    <div className="bg-zinc-800 border-b border-zinc-700">
      {/* Collapsed state - show selected trail */}
      {selectedTrail && !isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-750 transition-colors"
        >
          <div className="text-left">
            <div className="font-medium">{selectedTrail.name}</div>
            <div className="text-sm text-zinc-400">
              {selectedTrail.region} · {selectedTrail.distance_km}km
            </div>
          </div>
          <ChevronDown className="w-5 h-5 text-zinc-400" />
        </button>
      )}

      {/* Expanded state - show picker */}
      {(!selectedTrail || isExpanded) && (
        <div className="max-h-96 overflow-hidden flex flex-col">
          {/* Search bar */}
          <div className="p-3 border-b border-zinc-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search trails, regions, countries..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="text-xs text-zinc-500 mt-2">
              {filteredTrails.length} trail{filteredTrails.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Quick picks */}
          {!searchQuery && (
            <div className="p-3 border-b border-zinc-700">
              <div className="text-xs text-zinc-500 mb-2">Quick picks</div>
              <div className="flex flex-wrap gap-2">
                {QUICK_PICKS.map(trailId => {
                  const trail = popularTrails.find(t => t.id === trailId);
                  if (!trail) return null;
                  return (
                    <button
                      key={trailId}
                      onClick={() => handleTrailClick(trail)}
                      disabled={loading}
                      className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded-full text-xs transition-colors disabled:opacity-50"
                    >
                      {trail.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Trail list */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-8 text-center text-zinc-400">
                Loading trail data...
              </div>
            ) : sortedCountries.length === 0 ? (
              <div className="p-8 text-center text-zinc-400">
                No trails found
              </div>
            ) : (
              sortedCountries.map(countryCode => (
                <div key={countryCode}>
                  {/* Country header */}
                  <div className="sticky top-0 bg-zinc-800 px-4 py-2 border-b border-zinc-700">
                    <div className="text-sm font-medium text-zinc-400">
                      {COUNTRY_NAMES[countryCode] || countryCode}
                    </div>
                  </div>
                  {/* Trails in this country */}
                  {groupedTrails[countryCode]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(trail => (
                      <button
                        key={trail.id}
                        onClick={() => handleTrailClick(trail)}
                        disabled={loading}
                        className={`
                          w-full px-4 py-2 text-left hover:bg-zinc-700 transition-colors
                          disabled:opacity-50 border-b border-zinc-750
                          ${selectedTrailId === trail.id ? 'bg-zinc-700' : ''}
                        `}
                      >
                        <div className="font-medium text-sm">{trail.name}</div>
                        <div className="text-xs text-zinc-400 mt-0.5">
                          {trail.region} · {trail.distance_km}km · {trail.typical_days} days
                        </div>
                      </button>
                    ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
