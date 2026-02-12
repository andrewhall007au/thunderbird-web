'use client';

import { useState, useRef, useEffect } from 'react';
import { Menu, X, ChevronRight, ChevronLeft, Search } from 'lucide-react';
import { popularTrails, lazyTrailIds, loadTrailCoordinates, type TrailData } from '@/app/data/popularTrails';

interface TrailMenuProps {
  selectedTrailId: string | null;
  onTrailSelect: (trailId: string, geojson: GeoJSON.Feature) => void;
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

// Group trails by country, sorted alphabetically
function getGroupedTrails(query: string) {
  const filtered = popularTrails.filter(trail => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      trail.name.toLowerCase().includes(q) ||
      trail.region.toLowerCase().includes(q) ||
      COUNTRY_NAMES[trail.country]?.toLowerCase().includes(q)
    );
  });

  const grouped = filtered.reduce((acc, trail) => {
    const country = trail.country;
    if (!acc[country]) acc[country] = [];
    acc[country].push(trail);
    return acc;
  }, {} as Record<string, TrailData[]>);

  const sorted = Object.keys(grouped).sort((a, b) =>
    (COUNTRY_NAMES[a] || a).localeCompare(COUNTRY_NAMES[b] || b)
  );

  return { grouped, sorted, total: filtered.length };
}

export default function TrailMenu({ selectedTrailId, onTrailSelect }: TrailMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCountry, setActiveCountry] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveCountry(null);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

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
      setIsOpen(false);
      setActiveCountry(null);
      setSearchQuery('');
    } catch (error) {
      console.error('Failed to load trail:', error);
    } finally {
      setLoading(false);
    }
  };

  const { grouped, sorted, total } = getGroupedTrails(searchQuery);

  return (
    <div className="relative" ref={panelRef}>
      {/* Hamburger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 transition-colors text-zinc-300 hover:text-white"
        title="Trail library"
      >
        {isOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-zinc-800 border border-zinc-600 rounded-lg shadow-2xl shadow-black/50 z-50 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-zinc-700">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Search trails..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setActiveCountry(null); }}
                className="w-full pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-600 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <div className="text-[10px] text-zinc-500 mt-1 px-1">{total} trails</div>
          </div>

          {/* Content area */}
          <div className="max-h-80 overflow-y-auto">
            {activeCountry === null ? (
              /* Country list */
              sorted.map(code => (
                <button
                  key={code}
                  onClick={() => setActiveCountry(code)}
                  className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-zinc-700 transition-colors text-left border-b border-zinc-750"
                >
                  <div>
                    <div className="text-sm font-medium">{COUNTRY_NAMES[code] || code}</div>
                    <div className="text-xs text-zinc-400">{grouped[code].length} trails</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-500" />
                </button>
              ))
            ) : (
              /* Trail list for selected country */
              <>
                <button
                  onClick={() => setActiveCountry(null)}
                  className="w-full px-3 py-2 flex items-center gap-2 hover:bg-zinc-700 transition-colors text-left border-b border-zinc-600 bg-zinc-750 sticky top-0"
                >
                  <ChevronLeft className="w-4 h-4 text-zinc-400" />
                  <span className="text-sm font-medium text-zinc-300">{COUNTRY_NAMES[activeCountry] || activeCountry}</span>
                </button>
                {(grouped[activeCountry] || [])
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(trail => (
                    <button
                      key={trail.id}
                      onClick={() => handleTrailClick(trail)}
                      disabled={loading}
                      className={`
                        w-full px-3 py-2.5 text-left hover:bg-zinc-700 transition-colors
                        disabled:opacity-50 border-b border-zinc-750
                        ${selectedTrailId === trail.id ? 'bg-zinc-700 border-l-2 border-l-blue-500' : ''}
                      `}
                    >
                      <div className="text-sm">{trail.name}</div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        {trail.region} · {trail.distance_km}km · {trail.typical_days}d
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
