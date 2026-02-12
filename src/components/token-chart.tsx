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

import type { DailyTokenUsage } from '@/types';

interface TokenChartProps {
  data: DailyTokenUsage[];
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
            {formatTick(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TokenChart({ data }: TokenChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted text-sm">
        No token usage data available
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
          tickFormatter={formatTick}
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
          dataKey="total_in"
          name="Input"
          stroke="#52a9ff"
          fill="#52a9ff"
          fillOpacity={0.1}
          strokeWidth={1.5}
        />
        <Area
          type="monotone"
          dataKey="total_out"
          name="Output"
          stroke="#03B000"
          fill="#03B000"
          fillOpacity={0.1}
          strokeWidth={1.5}
        />
        <Area
          type="monotone"
          dataKey="total_reasoning"
          name="Reasoning"
          stroke="#f1a10d"
          fill="#f1a10d"
          fillOpacity={0.1}
          strokeWidth={1.5}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
