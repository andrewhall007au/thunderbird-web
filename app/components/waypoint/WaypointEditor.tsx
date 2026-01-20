'use client';

import { useState, useEffect } from 'react';
import { Waypoint, WaypointType } from '../map/WaypointMarker';
import { Trash2, MapPin, Mountain, Tent, Save } from 'lucide-react';

interface WaypointEditorProps {
  waypoint: Waypoint | null;
  onUpdate: (id: string, updates: Partial<Waypoint>) => void;
  onDelete: (id: string) => void;
  onSave?: () => void;
  onClose: () => void;
}

const TYPE_OPTIONS: { value: WaypointType; label: string; icon: typeof MapPin }[] = [
  { value: 'camp', label: 'Camp', icon: Tent },
  { value: 'peak', label: 'Peak', icon: Mountain },
  { value: 'poi', label: 'Point of Interest', icon: MapPin }
];

export default function WaypointEditor({
  waypoint,
  onUpdate,
  onDelete,
  onSave,
  onClose
}: WaypointEditorProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<WaypointType>('poi');

  useEffect(() => {
    if (waypoint) {
      setName(waypoint.name);
      setType(waypoint.type);
    }
  }, [waypoint]);

  if (!waypoint) return null;

  const handleNameChange = (newName: string) => {
    setName(newName);
    onUpdate(waypoint.id, { name: newName });
  };

  const handleTypeChange = (newType: WaypointType) => {
    setType(newType);
    onUpdate(waypoint.id, { type: newType });
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Edit Waypoint</h3>
        <button
          onClick={onClose}
          className="text-gray-600 hover:text-gray-900"
          aria-label="Close editor"
        >
          &times;
        </button>
      </div>

      {/* Name input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-blue-500"
          placeholder="e.g., Lake Oberon Camp"
        />
      </div>

      {/* SMS Code display (auto-generated, ROUT-06) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          SMS Code
        </label>
        <div className="flex items-center gap-2">
          <code className="px-3 py-2 bg-gray-100 rounded-lg text-blue-400 font-mono text-lg">
            {waypoint.smsCode}
          </code>
          <span className="text-sm text-gray-600">
            Auto-generated from name
          </span>
        </div>
      </div>

      {/* Type selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Type
        </label>
        <div className="grid grid-cols-3 gap-2">
          {TYPE_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => handleTypeChange(value)}
              className={`
                flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors
                ${type === value
                  ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'}
              `}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Coordinates (read-only) */}
      <div className="text-sm text-gray-600">
        <p>Lat: {waypoint.lat.toFixed(5)}</p>
        <p>Lng: {waypoint.lng.toFixed(5)}</p>
        {waypoint.elevation && <p>Elevation: {waypoint.elevation}m</p>}
      </div>

      {/* Action buttons */}
      <div className="space-y-2">
        {/* Save Waypoint button */}
        {onSave && (
          <button
            onClick={onSave}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-gray-900 rounded-lg hover:bg-blue-500 transition-colors"
          >
            <Save className="w-4 h-4" />
            Save Waypoint
          </button>
        )}

        {/* Delete button */}
        <button
          onClick={() => onDelete(waypoint.id)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Delete Waypoint
        </button>
      </div>
    </div>
  );
}
