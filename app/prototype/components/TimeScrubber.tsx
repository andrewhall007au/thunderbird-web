'use client';

interface TimeScrubberProps {
  currentHour: number;      // 0-168 (7 days)
  onHourChange: (hour: number) => void;
  maxHours: number;         // Usually 168
}

function getTimeLabel(hoursFromNow: number): string {
  if (hoursFromNow === 0) return 'Now';
  const now = new Date();
  const target = new Date(now.getTime() + hoursFromNow * 3600000);
  const hour = target.getHours();
  const ampm = hour >= 12 ? 'pm' : 'am';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayDiff = Math.floor(hoursFromNow / 24);
  if (dayDiff === 0) return `Today ${h12}${ampm}`;
  return `${days[target.getDay()]} ${h12}${ampm}`;
}

function getDayMarkers(maxHours: number): string[] {
  const now = new Date();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const maxDays = Math.floor(maxHours / 24);
  const markers: string[] = [];
  for (let i = 0; i <= maxDays; i++) {
    if (i === 0) {
      markers.push('Today');
    } else {
      const target = new Date(now.getTime() + i * 24 * 3600000);
      markers.push(days[target.getDay()]);
    }
  }
  return markers;
}

export default function TimeScrubber({ currentHour, onHourChange, maxHours }: TimeScrubberProps) {
  const markers = getDayMarkers(maxHours);

  return (
    <div className="bg-zinc-800 border-t border-zinc-700 px-4 py-2">
      {/* Label */}
      <div className="text-xs font-medium text-zinc-300 text-center mb-1">
        {getTimeLabel(currentHour)}
      </div>

      {/* Slider */}
      <input
        type="range"
        min="0"
        max={maxHours}
        step="1"
        value={currentHour}
        onChange={e => onHourChange(parseInt(e.target.value, 10))}
        className="w-full h-1.5 appearance-none bg-zinc-600 rounded-full cursor-pointer time-slider"
      />

      {/* Day of week markers */}
      <div className="flex justify-between mt-1 text-[10px] text-zinc-500 px-0.5">
        {markers.map((label, i) => (
          <span key={i}>{label}</span>
        ))}
      </div>

      <style jsx>{`
        .time-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        }
        .time-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: none;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        }
      `}</style>
    </div>
  );
}
