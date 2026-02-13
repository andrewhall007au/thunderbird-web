'use client';

import { useState, useRef, useEffect } from 'react';
import { Menu, X, ChevronDown, ChevronRight, Search, MapPin } from 'lucide-react';
import { popularTrails, lazyTrailIds, loadTrailCoordinates, type TrailData } from '@/app/data/popularTrails';

interface GeoResult {
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
}

interface TrailMenuProps {
  selectedTrailId: string | null;
  onTrailSelect: (trailId: string, geojson: GeoJSON.Feature) => void;
  onPlaceSelect?: (lat: number, lng: number, name: string) => void;
}

function trailToGeojson(trail: TrailData): GeoJSON.Feature {
  return {
    type: 'Feature',
    properties: { name: trail.name },
    geometry: { type: 'LineString', coordinates: trail.coordinates },
  };
}

// Map region strings to their parent state/territory
const STATE_ABBREV: Record<string, string> = {
  TAS: 'Tasmania', WA: 'Western Australia', VIC: 'Victoria',
  NSW: 'New South Wales', QLD: 'Queensland', SA: 'South Australia',
  NT: 'Northern Territory', ACT: 'ACT',
};

function regionToState(region: string): string {
  // Direct state names
  if (Object.values(STATE_ABBREV).includes(region)) return region;
  if (region === 'ACT') return 'ACT';
  if (region === 'Victoria / NSW / ACT') return 'Victoria';
  // Sub-region pattern: "Place, XX" where XX is state abbreviation
  const commaMatch = region.match(/,\s*(TAS|WA|VIC|NSW|QLD|SA|NT|ACT)\s*$/);
  if (commaMatch) return STATE_ABBREV[commaMatch[1]] || region;
  return region;
}

// Get all AU trails grouped by state, plus flat search matches
function getGroupedTrails(query: string) {
  const allAU = popularTrails.filter(trail => trail.country === 'AU');
  const q = query.toLowerCase();

  const matches = query
    ? allAU.filter(t => t.name.toLowerCase().includes(q) || t.region.toLowerCase().includes(q))
    : [];

  // Group ALL AU trails by state
  const grouped = allAU.reduce((acc, trail) => {
    const state = regionToState(trail.region);
    if (!acc[state]) acc[state] = [];
    acc[state].push(trail);
    return acc;
  }, {} as Record<string, TrailData[]>);

  // Sort trails alphabetically within each state
  for (const state of Object.keys(grouped)) {
    grouped[state].sort((a, b) => a.name.localeCompare(b.name));
  }

  const sortedStates = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  // Count matches per state
  const matchCountByState: Record<string, number> = {};
  for (const t of matches) {
    const state = regionToState(t.region);
    matchCountByState[state] = (matchCountByState[state] || 0) + 1;
  }

  return {
    grouped,
    sortedStates,
    matches: matches.sort((a, b) => a.name.localeCompare(b.name)),
    matchCountByState,
    total: allAU.length,
  };
}

export default function TrailMenu({ selectedTrailId, onTrailSelect, onPlaceSelect }: TrailMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [geoResults, setGeoResults] = useState<GeoResult[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const geoAbort = useRef<AbortController | null>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
        setGeoResults([]);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  // Geocode search with debounce
  useEffect(() => {
    if (searchQuery.length < 2) {
      setGeoResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      geoAbort.current?.abort();
      const controller = new AbortController();
      geoAbort.current = controller;
      setGeoLoading(true);

      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchQuery)}&count=5&language=en`,
          { signal: controller.signal }
        );
        const data = await res.json();
        setGeoResults(data.results ?? []);
      } catch {
        // aborted or network error — ignore
      } finally {
        setGeoLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleTrailClick = async (trail: TrailData) => {
    setLoading(true);
    try {
      if (lazyTrailIds.has(trail.id)) {
        const coordinates = await loadTrailCoordinates(trail.id);
        const trailWithCoords = { ...trail, coordinates };
        onTrailSelect(trail.id, trailToGeojson(trailWithCoords));
      } else {
        onTrailSelect(trail.id, trailToGeojson(trail));
      }
    } catch (error) {
      console.error('Failed to load trail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceClick = (place: GeoResult) => {
    onPlaceSelect?.(place.latitude, place.longitude, place.name);
    setIsOpen(false);
    setSearchQuery('');
    setGeoResults([]);
  };

  const toggleRegion = (region: string) => {
    setExpandedRegions(prev => {
      const next = new Set(prev);
      if (next.has(region)) next.delete(region);
      else next.add(region);
      return next;
    });
  };

  const { grouped, sortedStates, matches, matchCountByState, total } = getGroupedTrails(searchQuery);

  const TrailButton = ({ trail }: { trail: TrailData }) => (
    <button
      onClick={() => handleTrailClick(trail)}
      disabled={loading}
      className={`
        w-full px-3 pl-8 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors
        disabled:opacity-50 border-b border-zinc-100 dark:border-zinc-750
        ${selectedTrailId === trail.id ? 'bg-zinc-100 dark:bg-zinc-700 border-l-2 border-l-blue-500' : ''}
      `}
    >
      <div className="text-sm">{trail.name}</div>
      <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
        {trail.distance_km}km · {trail.typical_days}d
      </div>
    </button>
  );

  return (
    <div className="relative" ref={panelRef}>
      {/* Hamburger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded-lg bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 transition-colors text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
        title="Trail library"
      >
        {isOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded-lg shadow-2xl shadow-black/20 dark:shadow-black/50 z-50 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-zinc-200 dark:border-zinc-700">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Search trails or places..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-600 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <div className="text-xs text-zinc-500 mt-1 px-1">{total} trails</div>
          </div>

          {/* Content area */}
          <div className="max-h-80 overflow-y-auto">
            {/* Place results (geocoding) */}
            {searchQuery.length >= 2 && (geoResults.length > 0 || geoLoading) && (
              <div className="border-b border-zinc-200 dark:border-zinc-600">
                <div className="px-3 py-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide bg-zinc-50 dark:bg-zinc-900/50">
                  Places
                </div>
                {geoLoading && geoResults.length === 0 && (
                  <div className="px-3 py-2 text-sm text-zinc-400">Searching...</div>
                )}
                {geoResults.map((place, i) => (
                  <button
                    key={`geo-${i}`}
                    onClick={() => handlePlaceClick(place)}
                    className="w-full px-3 py-2 flex items-center gap-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors text-left"
                  >
                    <MapPin className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{place.name}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                        {[place.admin1, place.country].filter(Boolean).join(', ')}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Flat search results (matching trails) */}
            {searchQuery && matches.length > 0 && (
              <div className="border-b border-zinc-200 dark:border-zinc-600">
                <div className="px-3 py-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide bg-zinc-50 dark:bg-zinc-900/50">
                  Matching trails
                </div>
                {matches.map(trail => (
                  <button
                    key={`match-${trail.id}`}
                    onClick={() => handleTrailClick(trail)}
                    disabled={loading}
                    className={`
                      w-full px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors
                      disabled:opacity-50 border-b border-zinc-100 dark:border-zinc-750
                      ${selectedTrailId === trail.id ? 'bg-zinc-100 dark:bg-zinc-700 border-l-2 border-l-blue-500' : ''}
                    `}
                  >
                    <div className="text-sm">{trail.name}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {trail.region} · {trail.distance_km}km · {trail.typical_days}d
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* State accordion */}
            {sortedStates.map(state => {
              const isExpanded = expandedRegions.has(state);
              const matchCount = matchCountByState[state] || 0;
              const trails = grouped[state];

              return (
                <div key={state}>
                  <button
                    onClick={() => toggleRegion(state)}
                    className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors text-left border-b border-zinc-100 dark:border-zinc-750"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded
                        ? <ChevronDown className="w-4 h-4 text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
                        : <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
                      }
                      <div>
                        <span className="text-sm font-medium">{state}</span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 ml-2">{trails.length}</span>
                      </div>
                    </div>
                    {searchQuery && matchCount > 0 && (
                      <span className="bg-blue-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                        {matchCount}
                      </span>
                    )}
                  </button>
                  {isExpanded && trails.map(trail => (
                    <TrailButton key={trail.id} trail={trail} />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
