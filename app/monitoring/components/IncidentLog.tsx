'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle, Clock, ChevronDown, ChevronUp, Activity } from 'lucide-react';

interface Incident {
  id: string;
  check_name: string;
  display_name: string;
  severity: 'critical' | 'warning';
  status: 'active' | 'acknowledged' | 'resolved';
  first_seen: string;
  last_seen: string;
  failure_count: number;
  message: string;
}

interface TimelineEvent {
  timestamp: string;
  event: string;
  details: string;
}

interface IncidentTimeline {
  incident: Incident;
  timeline: TimelineEvent[];
}

interface IncidentLogProps {
  active: Incident[];
  resolved: Incident[];
  onAcknowledge: (incidentId: string) => void;
}

export default function IncidentLog({ active, resolved, onAcknowledge }: IncidentLogProps) {
  const [expandedTimelines, setExpandedTimelines] = useState<Set<string>>(new Set());
  const [timelineData, setTimelineData] = useState<Record<string, IncidentTimeline>>({});
  const [loadingTimelines, setLoadingTimelines] = useState<Set<string>>(new Set());

  const toggleTimeline = async (incidentId: string) => {
    const newExpanded = new Set(expandedTimelines);

    if (newExpanded.has(incidentId)) {
      newExpanded.delete(incidentId);
      setExpandedTimelines(newExpanded);
    } else {
      newExpanded.add(incidentId);
      setExpandedTimelines(newExpanded);

      // Fetch timeline if not already loaded
      if (!timelineData[incidentId]) {
        setLoadingTimelines(new Set(Array.from(loadingTimelines).concat(incidentId)));
        try {
          const res = await fetch(`/api/monitoring/incidents/${incidentId}/timeline`);
          if (res.ok) {
            const data = await res.json();
            setTimelineData({ ...timelineData, [incidentId]: data });
          }
        } catch (err) {
          console.error('Error fetching timeline:', err);
        } finally {
          const newLoading = new Set(loadingTimelines);
          newLoading.delete(incidentId);
          setLoadingTimelines(newLoading);
        }
      }
    }
  };

  const getRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  };

  const formatDuration = (firstSeen: string, lastSeen: string) => {
    const start = new Date(firstSeen);
    const end = new Date(lastSeen);
    const diff = end.getTime() - start.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  const renderIncident = (incident: Incident) => {
    const isAcknowledged = incident.status === 'acknowledged';
    const isResolved = incident.status === 'resolved';
    const isExpanded = expandedTimelines.has(incident.id);
    const timeline = timelineData[incident.id];
    const isLoadingTimeline = loadingTimelines.has(incident.id);

    const severityConfig = {
      critical: {
        bg: isAcknowledged ? 'bg-amber-50' : 'bg-red-50',
        border: isAcknowledged ? 'border-amber-200' : 'border-red-200',
        badge: isAcknowledged ? 'bg-amber-500' : 'bg-red-500',
        text: isAcknowledged ? 'text-amber-700' : 'text-red-700',
        pulse: !isAcknowledged && !isResolved
      },
      warning: {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        badge: 'bg-amber-500',
        text: 'text-amber-700',
        pulse: !isAcknowledged && !isResolved
      }
    };

    const config = severityConfig[incident.severity];

    return (
      <div key={incident.id} className={`${config.bg} border ${config.border} rounded-lg p-5`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3 flex-1">
            <div className="relative">
              <AlertCircle className={`w-5 h-5 ${config.text}`} />
              {config.pulse && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.badge} opacity-75`}></span>
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${config.badge}`}></span>
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-zinc-900">{incident.display_name}</h4>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.badge} text-white`}>
                  {incident.severity}
                </span>
                {isAcknowledged && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-500 text-white">
                    Acknowledged
                  </span>
                )}
              </div>
              <p className="text-sm text-zinc-600 mb-2">{incident.message}</p>
              <div className="flex items-center gap-4 text-xs text-zinc-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Started {getRelativeTime(incident.first_seen)}
                </span>
                <span>Duration: {formatDuration(incident.first_seen, incident.last_seen)}</span>
                <span>{incident.failure_count} failures</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isAcknowledged && !isResolved && (
              <button
                onClick={() => onAcknowledge(incident.id)}
                className="px-3 py-1.5 bg-zinc-900 text-white text-sm rounded-lg hover:bg-zinc-800 transition-colors"
              >
                Acknowledge
              </button>
            )}
            <button
              onClick={() => toggleTimeline(incident.id)}
              className="px-3 py-1.5 bg-white border border-zinc-300 text-zinc-700 text-sm rounded-lg hover:bg-zinc-50 transition-colors flex items-center gap-1"
            >
              Timeline
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Timeline */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-zinc-200">
            {isLoadingTimeline ? (
              <div className="flex items-center justify-center py-4 text-zinc-500">
                <div className="w-4 h-4 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin mr-2" />
                Loading timeline...
              </div>
            ) : timeline ? (
              <div className="space-y-3">
                <h5 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Event Timeline
                </h5>
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-zinc-200" />

                  {/* Events */}
                  <div className="space-y-3">
                    {timeline.timeline.map((event, idx) => (
                      <div key={idx} className="relative flex gap-3 pl-0">
                        {/* Dot */}
                        <div className="relative flex-shrink-0">
                          <div className={`w-4 h-4 rounded-full ${
                            event.event === 'resolved' ? 'bg-emerald-500' :
                            event.event === 'acknowledged' ? 'bg-amber-500' :
                            event.event === 'alert_sent' ? 'bg-blue-500' :
                            'bg-zinc-400'
                          } border-2 border-white`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pb-3">
                          <div className="flex items-baseline justify-between gap-2 mb-1">
                            <span className="text-sm font-medium text-zinc-900 capitalize">
                              {event.event.replace(/_/g, ' ')}
                            </span>
                            <span className="text-xs text-zinc-500 whitespace-nowrap">
                              {new Date(event.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-600">{event.details}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-zinc-500 text-sm">
                Failed to load timeline
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Active Incidents */}
      {active.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-zinc-900 mb-3 flex items-center gap-2">
            <span className="flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            Active Incidents ({active.length})
          </h4>
          <div className="space-y-3">
            {active.map(renderIncident)}
          </div>
        </div>
      )}

      {/* Resolved Incidents */}
      {resolved.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-zinc-900 mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            Recently Resolved ({resolved.length})
          </h4>
          <div className="space-y-3">
            {resolved.map(renderIncident)}
          </div>
        </div>
      )}

      {active.length === 0 && resolved.length === 0 && (
        <div className="bg-white rounded-xl border border-zinc-200 p-8 text-center">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <p className="text-zinc-600">No incidents to display</p>
        </div>
      )}
    </div>
  );
}
