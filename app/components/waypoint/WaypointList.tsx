'use client';

import { Waypoint, WaypointType } from '../map/WaypointMarker';
import { Tent, Mountain, MapPin, GripVertical } from 'lucide-react';

interface WaypointListProps {
  waypoints: Waypoint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorder?: (startIndex: number, endIndex: number) => void;
}

const TYPE_ICONS: Record<WaypointType, typeof MapPin> = {
  camp: Tent,
  peak: Mountain,
  poi: MapPin
};

const TYPE_COLORS: Record<WaypointType, string> = {
  camp: 'text-green-400',
  peak: 'text-orange-400',
  poi: 'text-blue-400'
};

export default function WaypointList({
  waypoints,
  selectedId,
  onSelect
}: WaypointListProps) {
  if (waypoints.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No waypoints yet</p>
        <p className="text-sm">Click on the map to add one</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
        Waypoints ({waypoints.length})
      </h3>
      <ul className="space-y-1">
        {waypoints.map((wp) => {
          const Icon = TYPE_ICONS[wp.type];
          return (
            <li key={wp.id}>
              <button
                onClick={() => onSelect(wp.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left
                  transition-colors
                  ${selectedId === wp.id
                    ? 'bg-blue-500/20 border border-blue-500/50'
                    : 'hover:bg-gray-700/50'}
                `}
              >
                <GripVertical className="w-4 h-4 text-gray-600 cursor-grab" />
                <Icon className={`w-5 h-5 ${TYPE_COLORS[wp.type]}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-white truncate">
                    {wp.name || 'Unnamed waypoint'}
                  </p>
                  <p className="text-xs text-gray-500">
                    <code className="text-blue-400">{wp.smsCode}</code>
                    {' '}&middot;{' '}
                    {wp.lat.toFixed(3)}, {wp.lng.toFixed(3)}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
