'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Trash2, ChevronUp, Copy } from 'lucide-react';
import type { Pin } from '../lib/types';
import { calculateSeverity, calculateHourlySeverities, SEVERITY_COLORS } from '../lib/severity';
import { type TimeRange, sliceToRange, getDayBoundaries, getTimeLabel, getCompactTimeLabel, getTickIndices, getCalendarDayGroups, xScale } from '../lib/chartUtils';
import SeverityBand from './SeverityBand';
import TempSparkline from './TempSparkline';
import RainSparkline from './RainSparkline';
import WindSparkline from './WindSparkline';
import CloudSparkline from './CloudSparkline';
import CloudBaseSparkline from './CloudBaseSparkline';
import FreezeSparkline from './FreezeSparkline';
import WindDirRow from './WindDirRow';
import DangerRow from './DangerRow';
import HourDetail from './HourDetail';

type Viewport = 'mobile' | 'tablet' | 'desktop';

type AppMode = 'online' | 'offline';

interface ChartPanelProps {
  pins: Pin[];
  selectedPinId: string | null;
  onPinSelect: (id: string) => void;
  onRemovePin: (id: string) => void;
  onClearPins: () => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  viewport?: Viewport;
  mode?: AppMode;
}

export default function ChartPanel({
  pins,
  selectedPinId,
  onPinSelect,
  onRemovePin,
  onClearPins,
  expanded: isExpanded,
  onExpandedChange: setIsExpanded,
  viewport = 'mobile',
  mode = 'online',
}: ChartPanelProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [tappedHour, setTappedHour] = useState<number | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);

  // Measure chart container width via the expanded content wrapper
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        // Subtract px-5 padding (20px each side = 40px)
        setChartWidth(Math.max(0, entry.contentRect.width - 40));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isExpanded]);

  // Swipe gestures (ported from ForecastPanel)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const delta = e.changedTouches[0].clientY - touchStartY.current;
    if (delta > 40) setIsExpanded(false);
    if (delta < -40) setIsExpanded(true);
    touchStartY.current = null;
  }, [setIsExpanded]);

  const handleClearPins = () => {
    if (!clearConfirm) {
      setClearConfirm(true);
      setTimeout(() => setClearConfirm(false), 3000);
      return;
    }
    onClearPins();
    setClearConfirm(false);
  };

  const handleCopySmsCommand = async () => {
    if (!selectedPin) return;
    const command = `WX ${selectedPin.lat.toFixed(3)} ${selectedPin.lng.toFixed(3)}`;
    try {
      await navigator.clipboard.writeText(command);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = command;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  };

  // Selected pin
  const selectedPin = pins.find(p => p.id === selectedPinId) ?? pins[0] ?? null;

  // Sliced hourly data for the selected pin
  const slicedHourly = useMemo(() => {
    if (!selectedPin?.forecast) return [];
    return sliceToRange(selectedPin.forecast.hourly, timeRange);
  }, [selectedPin?.id, selectedPin?.forecast, timeRange]);

  // Severities for the severity band
  const severities = useMemo(() => {
    if (!selectedPin?.forecast) return [];
    return calculateHourlySeverities(slicedHourly, selectedPin.forecast.elevation);
  }, [slicedHourly, selectedPin?.forecast?.elevation]);

  // Day boundaries (only relevant for 7d)
  const dayBounds = useMemo(() => {
    if (timeRange !== '7d') return undefined;
    return getDayBoundaries(slicedHourly.length);
  }, [timeRange, slicedHourly.length]);

  // Tick indices for value annotations + time axis
  const tickIndices = useMemo(() => {
    if (slicedHourly.length === 0) return [];
    return getTickIndices(timeRange, slicedHourly.length);
  }, [timeRange, slicedHourly.length]);

  // Handle sparkline tap
  const handleSparklineTap = (idx: number) => {
    if (tappedHour === idx) {
      setTappedHour(null);
    } else {
      setTappedHour(idx);
    }
  };

  // Reset tapped hour when time range or pin changes
  useEffect(() => {
    setTappedHour(null);
  }, [timeRange, selectedPinId]);

  const ranges: TimeRange[] = ['12h', '24h', '7d'];

  const timeRangeLabel = timeRange === '12h' ? '12 Hour' : timeRange === '24h' ? '24 Hour' : '7 Day';

  // Active severity color for selected pin (used by pin tabs + time range tabs)
  let activeSevColor = SEVERITY_COLORS.green.bg;
  if (selectedPin?.forecast && !selectedPin.loading) {
    const sev = calculateSeverity(selectedPin.forecast.hourly[0], selectedPin.forecast.elevation);
    activeSevColor = SEVERITY_COLORS[sev.level].bg;
  }

  // Pin elevation for freeze chart reference line
  const pinElevation = selectedPin?.elevation ?? (selectedPin?.forecast ? Math.round(selectedPin.forecast.elevation) : undefined);

  // Time axis renderer (shared across chart area)
  // Calendar day groups for 7d mode
  const calendarDayGroups = useMemo(() => {
    if (timeRange !== '7d' || slicedHourly.length === 0) return [];
    return getCalendarDayGroups(slicedHourly);
  }, [timeRange, slicedHourly]);

  const renderTimeAxis = () => {
    if (chartWidth <= 0) return null;

    // 7D mode: show day names centered on each day
    if (timeRange === '7d' && calendarDayGroups.length > 0) {
      return (
        <svg width={chartWidth} height={20} className="block mt-1" overflow="visible">
          {calendarDayGroups.map((group, idx) => {
            const midIdx = (group.startIdx + group.endIdx) / 2;
            const cx = xScale(midIdx, slicedHourly.length, chartWidth);
            // Day boundary line at start of each day (except first)
            const boundaryX = idx > 0 ? xScale(group.startIdx, slicedHourly.length, chartWidth) : null;
            const isFirst = idx === 0;
            const isLast = idx === calendarDayGroups.length - 1;
            const anchor = isFirst ? 'start' : isLast ? 'end' : 'middle';
            const labelX = isFirst ? Math.max(0, cx) : isLast ? Math.min(chartWidth, cx) : cx;
            return (
              <g key={`day-${idx}`}>
                {boundaryX !== null && (
                  <line x1={boundaryX} y1={0} x2={boundaryX} y2={4} stroke="var(--chart-grid)" strokeWidth={1} />
                )}
                <text
                  x={labelX}
                  y={16}
                  textAnchor={anchor}
                  fontSize="13"
                  fill="var(--chart-axis-text)"
                  fontWeight="600"
                >
                  {group.label}
                </text>
              </g>
            );
          })}
        </svg>
      );
    }

    // 12h / 24h: show hour ticks
    if (tickIndices.length === 0) return null;
    return (
      <svg width={chartWidth} height={20} className="block mt-1" overflow="visible">
        {tickIndices.map((i, idx) => {
          if (i >= slicedHourly.length) return null;
          const cx = xScale(i, slicedHourly.length, chartWidth);
          const label = getCompactTimeLabel(slicedHourly[i].hoursFromNow);
          const isFirst = idx === 0;
          const isLast = idx === tickIndices.length - 1;
          const anchor = isFirst ? 'start' : isLast ? 'end' : 'middle';
          return (
            <g key={`time-${i}`}>
              <line x1={cx} y1={0} x2={cx} y2={4} stroke="var(--chart-grid)" strokeWidth={1} />
              <text
                x={cx}
                y={16}
                textAnchor={anchor}
                fontSize="13"
                fill="var(--chart-axis-text)"
                fontWeight="600"
              >
                {label.replace(/(am|pm)$/, '')}
                {label.match(/(am|pm)$/) && (
                  <tspan fontSize="8.5">{label.match(/(am|pm)$/)![0]}</tspan>
                )}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div
      className="bg-white dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Drag handle */}
      <div
        className="cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-750 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex justify-center pt-2">
          <div className="w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        </div>
        <div className="px-4 py-1 flex items-center justify-between">
          <div className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {pins.length === 0 ? 'No pins' : `${pins.length} pin${pins.length > 1 ? 's' : ''}`}
          </div>
          <ChevronUp className={`w-5 h-5 text-zinc-500 dark:text-zinc-400 transition-transform ${isExpanded ? '' : 'rotate-180'}`} />
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div ref={containerRef} className="border-t border-zinc-200 dark:border-zinc-700">
          {pins.length === 0 ? (
            <div className="px-4 py-3 text-center text-zinc-500">
              <div className="text-sm">Tap map to drop pins for forecasts</div>
            </div>
          ) : (
            <>
              {/* Pin tabs + time range toggle */}
              <div className="flex items-center gap-2 px-3 py-2">
                <div className="flex-1 overflow-x-auto flex gap-1 min-w-0">
                  {pins.map(pin => {
                    const isActive = pin.id === (selectedPin?.id ?? null);
                    let bgColor = isActive ? SEVERITY_COLORS.green.bg : '';
                    if (isActive && pin.forecast && !pin.loading) {
                      const sev = calculateSeverity(pin.forecast.hourly[0], pin.forecast.elevation);
                      bgColor = SEVERITY_COLORS[sev.level].bg;
                    }
                    return (
                      <button
                        key={pin.id}
                        onClick={() => onPinSelect(pin.id)}
                        className={`
                          px-3 py-1.5 rounded text-sm font-bold flex-shrink-0 transition-colors
                          ${isActive ? 'text-white' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'}
                        `}
                        style={isActive
                          ? { backgroundColor: bgColor }
                          : { backgroundColor: 'var(--chart-grid)' }
                        }
                      >
                        {pin.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex bg-zinc-200 dark:bg-zinc-700 rounded p-0.5 flex-shrink-0">
                  {ranges.map(r => (
                    <button
                      key={r}
                      onClick={() => setTimeRange(r)}
                      className={`
                        px-3 py-1.5 rounded text-sm font-medium transition-colors
                        ${timeRange === r ? 'text-white' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'}
                      `}
                      style={timeRange === r ? { backgroundColor: activeSevColor } : undefined}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Charts (online only) — scrollable */}
              {mode === 'online' && (
                selectedPin?.loading ? (
                  <div className="px-3 py-5">
                    <div className="animate-pulse space-y-2">
                      <div className="h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded w-full" />
                      <div className="h-11 bg-zinc-200 dark:bg-zinc-700 rounded w-full" />
                      <div className="h-10 bg-zinc-200 dark:bg-zinc-700 rounded w-full" />
                      <div className="h-10 bg-zinc-200 dark:bg-zinc-700 rounded w-full" />
                    </div>
                  </div>
                ) : selectedPin?.forecast && slicedHourly.length > 0 && chartWidth > 0 ? (
                  <div className="px-5 pb-1">
                    {/* Severity band */}
                    <SeverityBand severities={severities} width={chartWidth} />

                    {/* Time axis (top) */}
                    {renderTimeAxis()}

                    {/* Danger annotations */}
                    <div className="mt-1">
                      <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-1 font-medium">Danger</div>
                      <DangerRow
                        severities={severities}
                        width={chartWidth}
                        tickIndices={tickIndices}
                      />
                    </div>

                    {/* Temperature */}
                    <hr className="mt-3 border-zinc-200 dark:border-zinc-700" />
                    <div className="mt-2 pb-1">
                      <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-1 font-medium">Temp °C</div>
                      <TempSparkline
                        hourlyData={slicedHourly}
                        width={chartWidth}
                        tappedHour={tappedHour}
                        onTap={handleSparklineTap}
                        dayBoundaries={dayBounds}
                        tickIndices={tickIndices}
                        timeRange={timeRange}
                      />
                    </div>

                    {/* Rain */}
                    <hr className="mt-2 border-zinc-200 dark:border-zinc-700" />
                    <div className="mt-2 pb-1">
                      <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-1 font-medium">Rain % / mm</div>
                      <RainSparkline
                        hourlyData={slicedHourly}
                        width={chartWidth}
                        tappedHour={tappedHour}
                        onTap={handleSparklineTap}
                        dayBoundaries={dayBounds}
                        tickIndices={tickIndices}
                      />
                    </div>

                    {/* Wind speed + direction */}
                    <hr className="mt-2 border-zinc-200 dark:border-zinc-700" />
                    <div className="mt-2 pb-1">
                      <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-1 font-medium">Wind km/h</div>
                      <WindSparkline
                        hourlyData={slicedHourly}
                        width={chartWidth}
                        tappedHour={tappedHour}
                        onTap={handleSparklineTap}
                        dayBoundaries={dayBounds}
                        tickIndices={tickIndices}
                      />
                      <div className="mt-1.5">
                        <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-1 font-medium">Wind Dir</div>
                        <WindDirRow
                          hourlyData={slicedHourly}
                          width={chartWidth}
                          tickIndices={tickIndices}
                        />
                      </div>
                    </div>

                    {/* Cloud cover */}
                    <hr className="mt-2 border-zinc-200 dark:border-zinc-700" />
                    <div className="mt-2 pb-1">
                      <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-1 font-medium">Cloud Cover %</div>
                      <CloudSparkline
                        hourlyData={slicedHourly}
                        width={chartWidth}
                        tappedHour={tappedHour}
                        onTap={handleSparklineTap}
                        dayBoundaries={dayBounds}
                        tickIndices={tickIndices}
                      />
                    </div>

                    {/* Cloud base */}
                    <hr className="mt-2 border-zinc-200 dark:border-zinc-700" />
                    <div className="mt-2 pb-1">
                      <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-1 font-medium">Cloud Base (m)</div>
                      <CloudBaseSparkline
                        hourlyData={slicedHourly}
                        width={chartWidth}
                        tappedHour={tappedHour}
                        onTap={handleSparklineTap}
                        dayBoundaries={dayBounds}
                        tickIndices={tickIndices}
                      />
                    </div>

                    {/* Freezing level */}
                    <hr className="mt-2 border-zinc-200 dark:border-zinc-700" />
                    <div className="mt-2 pb-1">
                      <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-1 font-medium">Freezing Level (m)</div>
                      <FreezeSparkline
                        hourlyData={slicedHourly}
                        width={chartWidth}
                        tappedHour={tappedHour}
                        onTap={handleSparklineTap}
                        dayBoundaries={dayBounds}
                        tickIndices={tickIndices}
                        pinElevation={pinElevation}
                      />
                    </div>

                    {/* Time axis (bottom) */}
                    {renderTimeAxis()}

                    {/* Tapped hour detail */}
                    {tappedHour !== null && tappedHour < slicedHourly.length && (
                      <div className="text-xs text-yellow-600 dark:text-yellow-400 text-center mt-0.5">
                        {getTimeLabel(slicedHourly[tappedHour].hoursFromNow)}
                      </div>
                    )}
                  </div>
                ) : selectedPin && !selectedPin.forecast ? (
                  <div className="px-3 py-4 text-center text-zinc-500 text-sm">
                    No forecast data
                  </div>
                ) : null
              )}

              {/* Hour detail (when tapped, online only) */}
              {mode === 'online' && tappedHour !== null && selectedPin?.forecast && tappedHour < slicedHourly.length && (
                <HourDetail
                  pin={selectedPin}
                  hourData={slicedHourly[tappedHour]}
                />
              )}

              {/* Pin details */}
              {selectedPin && (
                <div className="px-4 py-2 bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-700">
                  <div className="w-full px-3 py-2 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm font-medium">
                    Point Elevation {selectedPin.elevation != null ? selectedPin.elevation : selectedPin.forecast ? Math.round(selectedPin.forecast.elevation) : '—'}m · {selectedPin.lat.toFixed(3)}, {selectedPin.lng.toFixed(3)}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="px-4 py-2 bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-700 space-y-2">
                {selectedPin && (
                  <button
                    onClick={handleCopySmsCommand}
                    className={`
                      w-full px-3 py-2 rounded text-sm font-medium transition-colors
                      ${copyFeedback
                        ? 'bg-green-600 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }
                    `}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <Copy className="w-3.5 h-3.5" />
                      {copyFeedback
                        ? `Copied: WX ${selectedPin.lat.toFixed(3)} ${selectedPin.lng.toFixed(3)}`
                        : `Get SMS Command for ${timeRangeLabel} Forecast`
                      }
                    </div>
                  </button>
                )}
                <button
                  onClick={handleClearPins}
                  className={`
                    w-full px-3 py-1.5 rounded text-sm font-medium transition-colors
                    ${clearConfirm
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                    }
                  `}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <Trash2 className="w-3 h-3" />
                    {clearConfirm ? 'Click again to confirm' : 'Clear All Pins'}
                  </div>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
