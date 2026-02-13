'use client';

import { useState, useRef, useEffect } from 'react';
import { Menu, X, ChevronRight, ChevronLeft, Search, MapPin } from 'lucide-react';
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

const COUNTRY_NAMES: Record<string, string> = {
  AU: 'Australia', CA: 'Canada', FR: 'France', DE: 'Germany', IT: 'Italy',
  JP: 'Japan', NZ: 'New Zealand', ZA: 'South Africa', CH: 'Switzerland',
  GB: 'United Kingdom', US: 'United States', NP: 'Nepal', PE: 'Peru',
  CL: 'Chile', AR: 'Argentina', BO: 'Bolivia', CO: 'Colombia', IN: 'India',
  NO: 'Norway', IS: 'Iceland', ES: 'Spain', GR: 'Greece', TR: 'Turkey',
  PT: 'Portugal', AT: 'Austria',
};

function trailToGeojson(trail: TrailData): GeoJSON.Feature {
  return {
    type: 'Feature',
    properties: { name: trail.name },
    geometry: { type: 'LineString', coordinates: trail.coordinates },
  };
}

// Group AU trails by state/region, sorted alphabetically
function getGroupedTrails(query: string) {
  const filtered = popularTrails.filter(trail => {
    if (trail.country !== 'AU') return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      trail.name.toLowerCase().includes(q) ||
      trail.region.toLowerCase().includes(q)
    );
  });

  const grouped = filtered.reduce((acc, trail) => {
    const region = trail.region;
    if (!acc[region]) acc[region] = [];
    acc[region].push(trail);
    return acc;
  }, {} as Record<string, TrailData[]>);

  const sorted = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  return { grouped, sorted, total: filtered.length };
}

export default function TrailMenu({ selectedTrailId, onTrailSelect, onPlaceSelect }: TrailMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeRegion, setActiveRegion] = useState<string | null>(null);
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
        setActiveRegion(null);
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
    setActiveRegion(null);
  };

  const { grouped, sorted, total } = getGroupedTrails(searchQuery);

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
                onChange={e => { setSearchQuery(e.target.value); setActiveRegion(null); }}
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

            {/* Trail results */}
            {searchQuery.length >= 2 && total > 0 && (
              <div className="px-3 py-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide bg-zinc-50 dark:bg-zinc-900/50">
                Trails
              </div>
            )}

            {activeRegion === null ? (
              /* State/region list */
              sorted.map(region => (
                <button
                  key={region}
                  onClick={() => setActiveRegion(region)}
                  className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors text-left border-b border-zinc-100 dark:border-zinc-750"
                >
                  <div>
                    <div className="text-sm font-medium">{region}</div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">{grouped[region].length} trail{grouped[region].length !== 1 ? 's' : ''}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                </button>
              ))
            ) : (
              /* Trail list for selected region */
              <>
                <button
                  onClick={() => setActiveRegion(null)}
                  className="w-full px-3 py-2 flex items-center gap-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors text-left border-b border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-750 sticky top-0"
                >
                  <ChevronLeft className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{activeRegion}</span>
                </button>
                {(grouped[activeRegion] || [])
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(trail => (
                    <button
                      key={trail.id}
                      onClick={() => handleTrailClick(trail)}
                      disabled={loading}
                      className={`
                        w-full px-3 py-2.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors
                        disabled:opacity-50 border-b border-zinc-100 dark:border-zinc-750
                        ${selectedTrailId === trail.id ? 'bg-zinc-100 dark:bg-zinc-700 border-l-2 border-l-blue-500' : ''}
                      `}
                    >
                      <div className="text-sm">{trail.name}</div>
                      <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {trail.distance_km}km · {trail.typical_days}d
                      </div>
                    </button>
                  ))
                }
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
