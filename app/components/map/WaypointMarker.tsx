'use client';

import { Marker, MarkerDragEvent } from 'react-map-gl/maplibre';

// Color scheme per ROUT-04
const WAYPOINT_COLORS = {
  camp: '#22c55e',   // Green
  peak: '#f97316',   // Orange
  poi: '#3b82f6'     // Blue
} as const;

export type WaypointType = keyof typeof WAYPOINT_COLORS;

export interface Waypoint {
  id: string;
  lat: number;
  lng: number;
  name: string;
  type: WaypointType;
  smsCode: string;
  elevation?: number;
}

interface WaypointMarkerProps {
  waypoint: Waypoint;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  onDragEnd?: (id: string, lat: number, lng: number) => void;
  onDelete?: (id: string) => void;
}

export default function WaypointMarker({
  waypoint,
  isSelected,
  onSelect,
  onDragEnd,
  onDelete
}: WaypointMarkerProps) {
  const handleDragEnd = (e: MarkerDragEvent) => {
    if (onDragEnd) {
      onDragEnd(waypoint.id, e.lngLat.lat, e.lngLat.lng);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelect) {
      onSelect(waypoint.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (onDelete) {
        onDelete(waypoint.id);
      }
    }
  };

  return (
    <Marker
      latitude={waypoint.lat}
      longitude={waypoint.lng}
      draggable
      onDragEnd={handleDragEnd}
      anchor="bottom"
    >
      <div
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        className={`
          flex flex-col items-center cursor-pointer
          transition-transform duration-150
          ${isSelected ? 'scale-125 z-10' : 'hover:scale-110'}
        `}
        role="button"
        aria-label={`${waypoint.name} - ${waypoint.type}`}
      >
        {/* Pin */}
        <div
          className={`
            flex items-center justify-center
            w-8 h-8 rounded-full
            text-xs font-bold text-white
            shadow-lg
            ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900' : ''}
          `}
          style={{ backgroundColor: WAYPOINT_COLORS[waypoint.type] }}
        >
          {waypoint.smsCode.slice(0, 3)}
        </div>
        {/* Stem */}
        <div
          className="w-0.5 h-2"
          style={{ backgroundColor: WAYPOINT_COLORS[waypoint.type] }}
        />
        {/* Label (visible when selected) */}
        {isSelected && (
          <div className="mt-1 px-2 py-0.5 bg-gray-900/90 rounded text-xs text-white whitespace-nowrap">
            {waypoint.name}
          </div>
        )}
      </div>
    </Marker>
  );
}
