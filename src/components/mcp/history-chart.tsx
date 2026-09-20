'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { useChartColors } from '@/lib/use-chart-colors';

export interface McpHistoryPoint {
  day: string;
  tavily_plan_usage: number | null;
}

interface McpHistoryChartProps {
  data: McpHistoryPoint[];
}

function formatTavily(value: number): string {
  return value.toLocaleString();
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const value = payload[0].value;
  return (
    <div className="rounded-sm border border-border bg-surface px-3 py-2 text-xs">
      <div className="mb-1 text-muted">{label}</div>
      <div className="font-medium tabular-nums text-foreground">
        {`${formatTavily(value)} credits`}
      </div>
    </div>
  );
}

export function McpHistoryChart({ data }: McpHistoryChartProps) {
  const c = useChartColors();
  const series = data.filter((row) => row.tavily_plan_usage !== null);

  if (series.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted sm:h-64">
        No snapshot history yet — open this page occasionally to build a series.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={c.grid} />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 10, fill: c.axis }}
          tickLine={false}
          axisLine={{ stroke: c.grid }}
          minTickGap={24}
        />
        <YAxis
          tickFormatter={formatTavily}
          tick={{ fontSize: 10, fill: c.axis }}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="tavily_plan_usage" fill={c.chart1} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
