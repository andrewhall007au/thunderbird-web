'use client';

import { useState } from 'react';
import { popularTrails, TrailData } from '../../data/popularTrails';
import { MapPin, Mountain } from 'lucide-react';

interface TrailSelectorProps {
  onSelect: (trail: TrailData) => void;
  disabled?: boolean;
}

export default function TrailSelector({ onSelect, disabled }: TrailSelectorProps) {
  const [selectedId, setSelectedId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Sort trails alphabetically
  const sortedTrails = [...popularTrails].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // Filter trails based on search
  const filteredTrails = sortedTrails.filter(trail =>
    trail.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    trail.region.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          placeholder="Search trails by name or region..."
          className="w-full px-4 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          disabled={disabled}
        />
      </div>

      {/* Scrollable Trail List */}
      <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">
        {filteredTrails.length === 0 ? (
          <p className="text-center text-zinc-500 py-8">No trails found</p>
        ) : (
          filteredTrails.map(trail => (
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
                      {trail.typical_days} day{trail.typical_days > 1 ? 's' : ''}
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
          ))
        )}
      </div>

      {/* Trail count */}
      <p className="text-xs text-zinc-500 text-center">
        Showing {filteredTrails.length} of {sortedTrails.length} trails
      </p>
    </div>
  );
}
