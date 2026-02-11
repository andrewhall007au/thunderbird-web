'use client';

import { useState } from 'react';
import { FileCode, ChevronDown, ChevronUp } from 'lucide-react';

export interface PayloadMetrics {
  requestUrl: string;
  requestSizeBytes: number;
  responseSizeBytes: number;
  responseTimeMs: number;
  totalTimeMs: number;
  pinCount: number;
}

interface PayloadInspectorProps {
  metrics: PayloadMetrics | null;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Calculate transfer time at different speeds
 */
function calculateTransferTime(bytes: number, speedBps: number): number {
  return (bytes * 8) / speedBps * 1000; // ms
}

export default function PayloadInspector({ metrics }: PayloadInspectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!metrics) {
    return null;
  }

  const perPinBytes = metrics.pinCount > 0
    ? Math.round(metrics.responseSizeBytes / metrics.pinCount)
    : 0;

  // Satellite speed estimates
  const theoreticalSpeed = 4 * 1024 * 1024; // 4 Mbps
  const realisticSpeed = 100 * 1024; // 100 kbps
  const transferTheoretical = calculateTransferTime(metrics.responseSizeBytes, theoreticalSpeed);
  const transferRealistic = calculateTransferTime(metrics.responseSizeBytes, realisticSpeed);

  // Feasibility assessment
  let feasibility: 'good' | 'ok' | 'poor';
  let feasibilityLabel: string;
  if (transferRealistic < 1000) {
    feasibility = 'good';
    feasibilityLabel = '✓ Well within satellite bandwidth';
  } else if (transferRealistic < 5000) {
    feasibility = 'ok';
    feasibilityLabel = '~ Acceptable for satellite';
  } else {
    feasibility = 'poor';
    feasibilityLabel = '✗ May be too large for satellite';
  }

  return (
    <div className="bg-zinc-800 border-t border-zinc-700">
      {/* Collapsed header */}
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-zinc-750 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <FileCode className="w-4 h-4 text-zinc-400" />
          <div className="text-sm font-medium">Payload Inspector</div>
          {!isExpanded && (
            <div className="text-xs text-zinc-400">
              {formatBytes(metrics.responseSizeBytes)} response
            </div>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-zinc-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-zinc-400" />
        )}
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-zinc-700 pt-4">
          {/* Last request metrics */}
          <div>
            <div className="text-xs text-zinc-400 uppercase tracking-wide mb-2">
              Last Request
            </div>
            <div className="bg-zinc-900 rounded p-3 font-mono text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-zinc-400">Request:</span>
                <span className="text-zinc-100">~{formatBytes(metrics.requestSizeBytes)} (URL)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Response:</span>
                <span className="text-zinc-100">{formatBytes(metrics.responseSizeBytes)} (JSON)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Per pin:</span>
                <span className="text-zinc-100">~{formatBytes(perPinBytes)}</span>
              </div>
              <div className="flex justify-between border-t border-zinc-700 pt-1.5 mt-1.5">
                <span className="text-zinc-400">API time:</span>
                <span className="text-zinc-100">{metrics.responseTimeMs}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Total:</span>
                <span className="text-zinc-100">{metrics.totalTimeMs}ms</span>
              </div>
            </div>
          </div>

          {/* Satellite feasibility */}
          <div>
            <div className="text-xs text-zinc-400 uppercase tracking-wide mb-2">
              Satellite Feasibility
            </div>
            <div className="bg-zinc-900 rounded p-3 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-zinc-400">At ~4 Mbps (theoretical):</span>
                <span className="text-zinc-100">{Math.round(transferTheoretical)}ms transfer</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">At ~100 kbps (realistic):</span>
                <span className="text-zinc-100">{Math.round(transferRealistic)}ms transfer</span>
              </div>
              <div className={`
                mt-2 pt-2 border-t border-zinc-700 font-medium
                ${feasibility === 'good' ? 'text-green-400' :
                  feasibility === 'ok' ? 'text-amber-400' :
                  'text-red-400'}
              `}>
                {feasibilityLabel}
              </div>
            </div>
          </div>

          {/* Technical notes */}
          <div className="bg-zinc-900 rounded p-3 text-xs text-zinc-400">
            <div className="font-medium text-zinc-300 mb-1">About These Metrics</div>
            <p className="mb-2">
              Open-Meteo returns ~{formatBytes(perPinBytes)} per location for 72 hours of hourly data
              (temp, wind, rain, cloud cover).
            </p>
            <p>
              Satellite data apps typically support 4-100+ kbps depending on service and conditions.
              AccuWeather and PlanMyWalk are already whitelisted on these services.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
