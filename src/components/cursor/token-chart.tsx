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

import { useChartColors } from '@/lib/use-chart-colors';
import type { CursorDailyUsage } from '@/types/cursor';

interface CursorTokenChartProps {
  data: CursorDailyUsage[];
}

function formatTick(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return String(value);
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-sm border border-border bg-surface px-3 py-2 text-xs">
      <div className="mb-1 text-muted">{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted">{entry.name}:</span>
          <span className="font-medium tabular-nums text-foreground">
            {formatTick(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function CursorTokenChart({ data }: CursorTokenChartProps) {
  const c = useChartColors();

  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-muted text-sm sm:h-64">
        No token usage data yet. Upload a Cursor CSV export.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 10, fill: c.axis }}
          tickLine={false}
          axisLine={{ stroke: c.grid }}
          minTickGap={24}
        />
        <YAxis
          tickFormatter={formatTick}
          tick={{ fontSize: 10, fill: c.axis }}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: '11px', color: c.legend }} />
        <Area
          type="monotone"
          dataKey="tokens_input"
          name="Input"
          stackId="tokens"
          stroke={c.chart1}
          fill={c.chart1}
          fillOpacity={0.2}
          strokeWidth={1.5}
        />
        <Area
          type="monotone"
          dataKey="tokens_input_cache_write"
          name="Cache write"
          stackId="tokens"
          stroke={c.chart5}
          fill={c.chart5}
          fillOpacity={0.2}
          strokeWidth={1.5}
        />
        <Area
          type="monotone"
          dataKey="tokens_cache_read"
          name="Cache read"
          stackId="tokens"
          stroke={c.chart3}
          fill={c.chart3}
          fillOpacity={0.2}
          strokeWidth={1.5}
        />
        <Area
          type="monotone"
          dataKey="tokens_output"
          name="Output"
          stackId="tokens"
          stroke={c.chart2}
          fill={c.chart2}
          fillOpacity={0.2}
          strokeWidth={1.5}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
