'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Clock, TrendingUp, Activity } from 'lucide-react';
import StatusCard from './components/StatusCard';
import UptimeChart from './components/UptimeChart';
import IncidentLog from './components/IncidentLog';

interface Check {
  name: string;
  display_name: string;
  status: 'pass' | 'fail' | 'degraded';
  last_check_ms: number;
  duration_ms: number;
  error?: string;
}

interface StatusData {
  overall_status: 'healthy' | 'degraded' | 'down';
  checks: Check[];
  active_incidents: number;
  timestamp: string;
}

interface UptimeCheck {
  name: string;
  display_name: string;
  total_checks: number;
  successful_checks: number;
  uptime_percent: number;
  avg_duration_ms: number;
}

interface UptimeData {
  period_hours: number;
  checks: UptimeCheck[];
}

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

interface IncidentsData {
  active: Incident[];
  recent_resolved: Incident[];
}

export default function MonitoringDashboard() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [uptime, setUptime] = useState<UptimeData | null>(null);
  const [incidents, setIncidents] = useState<IncidentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = async () => {
    try {
      const [statusRes, uptimeRes, incidentsRes] = await Promise.all([
        fetch('/api/monitoring/status'),
        fetch('/api/monitoring/uptime?hours=24'),
        fetch('/api/monitoring/incidents')
      ]);

      if (!statusRes.ok || !uptimeRes.ok || !incidentsRes.ok) {
        throw new Error('Failed to fetch monitoring data');
      }

      const statusData = await statusRes.json();
      const uptimeData = await uptimeRes.json();
      const incidentsData = await incidentsRes.json();

      setStatus(statusData);
      setUptime(uptimeData);
      setIncidents(incidentsData);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching monitoring data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleAcknowledge = async (incidentId: string) => {
    try {
      const res = await fetch(`/api/monitoring/incidents/${incidentId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledged_by: 'admin' })
      });

      if (!res.ok) {
        throw new Error('Failed to acknowledge incident');
      }

      // Refresh incidents
      fetchData();
    } catch (err) {
      console.error('Error acknowledging incident:', err);
      alert('Failed to acknowledge incident');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-4 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
          <span className="text-zinc-600">Loading monitoring data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="bg-white rounded-xl border border-red-200 p-6 max-w-md">
          <div className="flex items-center gap-3 mb-3">
            <XCircle className="w-6 h-6 text-red-500" />
            <h2 className="text-lg font-semibold text-zinc-900">Error Loading Dashboard</h2>
          </div>
          <p className="text-zinc-600 mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="bg-zinc-900 text-white px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!status || !uptime || !incidents) {
    return null;
  }

  const overallStatusConfig = {
    healthy: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-700',
      icon: CheckCircle,
      label: 'All Systems Operational'
    },
    degraded: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-700',
      icon: AlertTriangle,
      label: 'System Degraded'
    },
    down: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-700',
      icon: XCircle,
      label: 'System Down'
    }
  };

  const config = overallStatusConfig[status.overall_status];
  const StatusIcon = config.icon;

  return (
    <div className="min-h-screen bg-zinc-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-zinc-900">System Health</h1>
            {lastUpdated && (
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Clock className="w-4 h-4" />
                <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
              </div>
            )}
          </div>
          <p className="text-zinc-600">Real-time monitoring of all critical systems</p>
        </div>

        {/* Overall Status Banner */}
        <div className={`${config.bg} ${config.border} border rounded-xl p-6 mb-8`}>
          <div className="flex items-center gap-4">
            <StatusIcon className={`w-8 h-8 ${config.text}`} />
            <div className="flex-1">
              <h2 className={`text-xl font-semibold ${config.text}`}>{config.label}</h2>
              <p className="text-zinc-600 text-sm mt-1">
                {status.checks.length} checks monitored • {status.active_incidents} active incidents
              </p>
            </div>
          </div>
        </div>

        {/* Status Cards Grid */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Current Status
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {status.checks.map((check) => (
              <StatusCard
                key={check.name}
                name={check.name}
                displayName={check.display_name}
                status={check.status}
                lastCheckMs={check.last_check_ms}
                durationMs={check.duration_ms}
                error={check.error}
              />
            ))}
          </div>
        </div>

        {/* Uptime Chart */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            24-Hour Uptime
          </h3>
          <UptimeChart checks={uptime.checks} />
        </div>

        {/* Incidents */}
        {(incidents.active.length > 0 || incidents.recent_resolved.length > 0) && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Incidents
            </h3>
            <IncidentLog
              active={incidents.active}
              resolved={incidents.recent_resolved}
              onAcknowledge={handleAcknowledge}
            />
          </div>
        )}
      </div>
    </div>
  );
}
