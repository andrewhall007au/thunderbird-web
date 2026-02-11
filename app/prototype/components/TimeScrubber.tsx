'use client';

import { useEffect, useState } from 'react';

interface TimeScrubberProps {
  currentHour: number;      // 0-72
  onHourChange: (hour: number) => void;
  maxHours: number;         // Usually 72
}

/**
 * Format hour offset as human-readable time label
 */
function formatTimeLabel(hoursFromNow: number): string {
  const now = new Date();
  const targetTime = new Date(now.getTime() + hoursFromNow * 60 * 60 * 1000);

  if (hoursFromNow === 0) {
    return 'Now';
  }

  const isToday = targetTime.getDate() === now.getDate();
  const isTomorrow = targetTime.getDate() === now.getDate() + 1 ||
    (now.getDate() === new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() && targetTime.getDate() === 1);

  const hour = targetTime.getHours();
  const ampm = hour >= 12 ? 'pm' : 'am';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

  if (isToday) {
    return `Today ${hour12}${ampm}`;
  } else if (isTomorrow) {
    return `Tomorrow ${hour12}${ampm}`;
  } else {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `${dayNames[targetTime.getDay()]} ${hour12}${ampm}`;
  }
}

/**
 * Determine if a given hour is during daylight (6am-8pm) or nighttime
 */
function isDaylight(hoursFromNow: number): boolean {
  const now = new Date();
  const targetTime = new Date(now.getTime() + hoursFromNow * 60 * 60 * 1000);
  const hour = targetTime.getHours();
  return hour >= 6 && hour < 20;
}

export default function TimeScrubber({ currentHour, onHourChange, maxHours }: TimeScrubberProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onHourChange(parseInt(e.target.value, 10));
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    // Prevent page scroll during drag
    if ('touches' in e) {
      e.preventDefault();
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchend', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchend', handleGlobalMouseUp);
    };
  }, []);

  return (
    <div className="bg-zinc-800 border-t border-zinc-700 px-4 py-3">
      {/* Current time display */}
      <div className="text-center mb-2">
        <div className="text-sm font-medium text-zinc-100">
          {formatTimeLabel(currentHour)}
        </div>
        <div className="text-xs text-zinc-500">
          {currentHour === 0 ? 'Current conditions' : `${currentHour} hours from now`}
        </div>
      </div>

      {/* Slider container with day/night gradient background */}
      <div className="relative h-12 flex items-center">
        {/* Day/night background gradient */}
        <div className="absolute inset-0 flex">
          {Array.from({ length: maxHours + 1 }).map((_, hour) => {
            const isDay = isDaylight(hour);
            return (
              <div
                key={hour}
                className={`flex-1 transition-colors ${
                  isDay ? 'bg-zinc-700' : 'bg-zinc-900'
                }`}
                style={{ opacity: 0.5 }}
              />
            );
          })}
        </div>

        {/* Range input */}
        <input
          type="range"
          min="0"
          max={maxHours}
          step="1"
          value={currentHour}
          onChange={handleChange}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchEnd={handleMouseUp}
          className="relative w-full h-2 appearance-none bg-transparent cursor-pointer z-10 time-scrubber-slider"
          style={{
            WebkitAppearance: 'none',
          }}
        />
      </div>

      {/* Time markers */}
      <div className="flex justify-between mt-2 text-xs text-zinc-400 px-1">
        <div>Now</div>
        <div>+12h</div>
        <div>+24h</div>
        <div>+48h</div>
        <div>+72h</div>
      </div>

      {/* Custom slider styles - larger for mobile */}
      <style jsx>{`
        .time-scrubber-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          transition: transform 0.1s;
        }

        .time-scrubber-slider::-webkit-slider-thumb:hover {
          transform: scale(1.1);
          background: #60a5fa;
        }

        .time-scrubber-slider::-webkit-slider-thumb:active {
          transform: scale(1.15);
        }

        .time-scrubber-slider::-moz-range-thumb {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          transition: transform 0.1s;
        }

        .time-scrubber-slider::-moz-range-thumb:hover {
          transform: scale(1.1);
          background: #60a5fa;
        }

        .time-scrubber-slider::-moz-range-thumb:active {
          transform: scale(1.15);
        }

        .time-scrubber-slider::-webkit-slider-runnable-track {
          width: 100%;
          height: 8px;
          background: transparent;
          border-radius: 4px;
        }

        .time-scrubber-slider::-moz-range-track {
          width: 100%;
          height: 8px;
          background: transparent;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}
