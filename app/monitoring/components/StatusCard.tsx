'use client';

import { useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface StatusCardProps {
  name: string;
  displayName: string;
  status: 'pass' | 'fail' | 'degraded';
  lastCheckMs: number;
  durationMs: number;
  error?: string;
}

export default function StatusCard({
  name,
  displayName,
  status,
  lastCheckMs,
  durationMs,
  error
}: StatusCardProps) {
  const [expanded, setExpanded] = useState(false);

  const statusConfig = {
    pass: {
      bg: 'bg-white',
      border: 'border-l-4 border-l-emerald-500',
      icon: CheckCircle,
      iconColor: 'text-emerald-500',
      label: 'Operational',
      labelColor: 'text-emerald-700'
    },
    fail: {
      bg: 'bg-white',
      border: 'border-l-4 border-l-red-500',
      icon: XCircle,
      iconColor: 'text-red-500',
      label: 'Failed',
      labelColor: 'text-red-700'
    },
    degraded: {
      bg: 'bg-white',
      border: 'border-l-4 border-l-amber-500',
      icon: AlertCircle,
      iconColor: 'text-amber-500',
      label: 'Degraded',
      labelColor: 'text-amber-700'
    }
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  const getRelativeTime = (timestampMs: number) => {
    const now = Date.now();
    const diff = now - timestampMs;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  };

  const hasError = error && error.trim().length > 0;

  return (
    <div className={`${config.bg} ${config.border} border border-zinc-200 rounded-lg p-4 shadow-sm`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 flex-1">
          <StatusIcon className={`w-5 h-5 ${config.iconColor} flex-shrink-0`} />
          <div className="min-w-0 flex-1">
            <h4 className="font-medium text-zinc-900 truncate">{displayName}</h4>
            <p className={`text-xs font-medium ${config.labelColor}`}>{config.label}</p>
          </div>
        </div>
      </div>

      <div className="space-y-2 text-sm text-zinc-600">
        <div className="flex justify-between">
          <span>Last check:</span>
          <span className="font-medium">{getRelativeTime(lastCheckMs)}</span>
        </div>
        <div className="flex justify-between">
          <span>Response time:</span>
          <span className="font-medium">{durationMs.toFixed(0)}ms</span>
        </div>
      </div>

      {hasError && (
        <div className="mt-3 pt-3 border-t border-zinc-200">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center justify-between w-full text-left text-sm text-zinc-700 hover:text-zinc-900 transition-colors"
          >
            <span className="font-medium">Error details</span>
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          {expanded && (
            <div className="mt-2 p-3 bg-zinc-50 rounded text-xs text-zinc-600 font-mono break-words">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
