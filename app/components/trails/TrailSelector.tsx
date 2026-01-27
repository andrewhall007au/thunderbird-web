'use client';

import { useState } from 'react';
import { popularTrails, TrailData } from '../../data/popularTrails';

interface TrailSelectorProps {
  onSelect: (trail: TrailData) => void;
  disabled?: boolean;
}

export default function TrailSelector({ onSelect, disabled }: TrailSelectorProps) {
  const [selectedId, setSelectedId] = useState('');

  // Sort trails alphabetically
  const sortedTrails = [...popularTrails].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedId(id);
    if (id) {
      const trail = popularTrails.find(t => t.id === id);
      if (trail) onSelect(trail);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Popular Trails
      </label>
      <select
        value={selectedId}
        onChange={handleChange}
        disabled={disabled}
        className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-blue-500 disabled:opacity-50"
      >
        <option value="">Select a popular trail...</option>
        {sortedTrails.map(trail => (
          <option key={trail.id} value={trail.id}>
            {trail.name} ({trail.region} - {trail.distance_km}km, {trail.typical_days} days)
          </option>
        ))}
      </select>
    </div>
  );
}
