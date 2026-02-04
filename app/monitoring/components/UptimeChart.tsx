'use client';

interface UptimeCheck {
  name: string;
  display_name: string;
  total_checks: number;
  successful_checks: number;
  uptime_percent: number;
  avg_duration_ms: number;
}

interface UptimeChartProps {
  checks: UptimeCheck[];
}

export default function UptimeChart({ checks }: UptimeChartProps) {
  const getUptimeColor = (uptime: number) => {
    if (uptime >= 99.5) return 'bg-emerald-500';
    if (uptime >= 99) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getUptimeTextColor = (uptime: number) => {
    if (uptime >= 99.5) return 'text-emerald-700';
    if (uptime >= 99) return 'text-amber-700';
    return 'text-red-700';
  };

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-6 shadow-sm">
      <div className="space-y-5">
        {checks.map((check) => (
          <div key={check.name} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-zinc-900">{check.display_name}</span>
              <div className="flex items-center gap-4">
                <span className={`font-semibold ${getUptimeTextColor(check.uptime_percent)}`}>
                  {check.uptime_percent.toFixed(2)}%
                </span>
                <span className="text-zinc-500">
                  {check.avg_duration_ms ? `${check.avg_duration_ms.toFixed(0)}ms avg` : 'N/A'}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-zinc-100 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${getUptimeColor(check.uptime_percent)}`}
                style={{ width: `${check.uptime_percent}%` }}
              />
            </div>

            <div className="flex justify-between text-xs text-zinc-500">
              <span>{check.successful_checks} / {check.total_checks} checks successful</span>
            </div>
          </div>
        ))}
      </div>

      {checks.length === 0 && (
        <div className="text-center py-8 text-zinc-500">
          No uptime data available
        </div>
      )}
    </div>
  );
}
