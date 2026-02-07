'use client';

import { useState, useMemo } from 'react';
import { popularTrails, TrailData } from '../../data/popularTrails';
import { MapPin, Mountain } from 'lucide-react';

interface TrailSelectorProps {
  onSelect: (trail: TrailData) => void;
  disabled?: boolean;
}

// All weather API countries with display names (sorted alphabetically by display name)
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
};

// All weather API countries in display order
const ALL_COUNTRIES = Object.keys(COUNTRY_NAMES).sort((a, b) =>
  COUNTRY_NAMES[a].localeCompare(COUNTRY_NAMES[b])
);

export default function TrailSelector({ onSelect, disabled }: TrailSelectorProps) {
  const [selectedId, setSelectedId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Filter and group trails
  const { groupedTrails, totalFiltered, totalTrails } = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();

    // Filter trails based on search (name, region, or country name)
    const filtered = popularTrails.filter(trail => {
      const countryName = COUNTRY_NAMES[trail.country] || trail.country;
      return (
        trail.name.toLowerCase().includes(searchLower) ||
        trail.region.toLowerCase().includes(searchLower) ||
        countryName.toLowerCase().includes(searchLower)
      );
    });

    // Group by country
    const grouped = new Map<string, TrailData[]>();

    ALL_COUNTRIES.forEach(countryCode => {
      const countryTrails = filtered
        .filter(trail => trail.country === countryCode)
        .sort((a, b) => a.name.localeCompare(b.name));

      // Only include country groups that have trails OR if no search is active
      if (countryTrails.length > 0 || searchTerm === '') {
        grouped.set(countryCode, countryTrails);
      }
    });

    return {
      groupedTrails: grouped,
      totalFiltered: filtered.length,
      totalTrails: popularTrails.length,
    };
  }, [searchTerm]);

  const handleSelect = (trail: TrailData) => {
    setSelectedId(trail.id);
    onSelect(trail);
  };

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search trails by name, region, or country..."
          className="w-full px-4 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          disabled={disabled}
        />
      </div>

      {/* Scrollable Trail List */}
      <div className="max-h-[400px] overflow-y-auto pr-2">
        {totalFiltered === 0 ? (
          <p className="text-center text-zinc-500 py-8">No trails found</p>
        ) : (
          <div className="space-y-1">
            {Array.from(groupedTrails.entries()).map(([countryCode, trails]) => (
              <div key={countryCode} role="group" aria-label={`${COUNTRY_NAMES[countryCode]} trails`}>
                {/* Country Header */}
                <div className="sticky top-0 bg-zinc-50 border-t border-zinc-200 px-4 py-2 -mx-2 z-10">
                  <h2 className="font-semibold text-sm text-zinc-900">
                    {COUNTRY_NAMES[countryCode]}
                  </h2>
                </div>

                {/* Trails or Coming Soon */}
                {trails.length === 0 ? (
                  <p className="text-sm italic text-zinc-400 py-3 px-4">
                    Coming soon
                  </p>
                ) : (
                  <div className="space-y-2 py-2">
                    {trails.map(trail => (
                      <button
                        key={trail.id}
                        onClick={() => handleSelect(trail)}
                        disabled={disabled}
                        className={`
                          w-full text-left p-4 rounded-lg border-2 transition-all
                          ${selectedId === trail.id
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm'}
                          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className={`font-semibold mb-1 ${selectedId === trail.id ? 'text-orange-900' : 'text-zinc-900'}`}>
                              {trail.name}
                            </h3>
                            <div className="flex items-center gap-3 text-sm text-zinc-600 flex-wrap">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {trail.region}
                              </span>
                              <span className="flex items-center gap-1">
                                <Mountain className="w-3 h-3" />
                                {trail.distance_km}km
                              </span>
                              <span>
                                {trail.typical_days} days
                              </span>
                            </div>
                          </div>
                          {selectedId === trail.id && (
                            <div className="flex-shrink-0">
                              <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-white text-sm">
                                ✓
                              </div>
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Trail count */}
      <p className="text-xs text-zinc-500 text-center">
        Showing {totalFiltered} of {totalTrails} trails
      </p>
    </div>
  );
}
