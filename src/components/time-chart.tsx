'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

import { formatDuration } from '@/lib/format';
import type { DailyTimeUsage } from '@/types';

interface TimeChartProps {
  data: DailyTimeUsage[];
}

function formatTimeTick(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
    payload: DailyTimeUsage;
  }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload;

  return (
    <div className="rounded-sm border border-border bg-grep-1 px-3 py-2 text-xs">
      <div className="mb-1 text-muted">{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-grep-11">{entry.name}:</span>
          <span className="font-medium tabular-nums text-foreground">
            {formatDuration(entry.value)}
          </span>
        </div>
      ))}
      {row && (
        <div className="mt-1 pt-1 border-t border-border/50 text-muted">
          {row.turn_count} turns · {row.response_count} responses
        </div>
      )}
    </div>
  );
}

export function TimeChart({ data }: TimeChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted text-sm">
        No time usage data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 10, fill: '#777' }}
          tickLine={false}
          axisLine={{ stroke: '#1a1a1a' }}
        />
        <YAxis
          tickFormatter={formatTimeTick}
          tick={{ fontSize: 10, fill: '#777' }}
          tickLine={false}
          axisLine={false}
          width={50}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: '11px', color: '#888' }}
        />
        <Area
          type="monotone"
          dataKey="total_active_time_ms"
          name="Active Time"
          stroke="#52a9ff"
          fill="#52a9ff"
          fillOpacity={0.1}
          strokeWidth={1.5}
        />
        <Area
          type="monotone"
          dataKey="total_response_time_ms"
          name="Response Time"
          stroke="#03B000"
          fill="#03B000"
          fillOpacity={0.1}
          strokeWidth={1.5}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
