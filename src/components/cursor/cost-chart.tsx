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

export interface CursorDailyCostPoint {
  day: string;
  estimated_cost: number;
}

interface CursorCostChartProps {
  data: CursorDailyCostPoint[];
}

function formatTick(value: number): string {
  if (value >= 100) return `$${value.toFixed(0)}`;
  if (value >= 1) return `$${value.toFixed(1)}`;
  return `$${value.toFixed(2)}`;
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
  return (
    <div className="rounded-sm border border-border bg-surface px-3 py-2 text-xs">
      <div className="mb-1 text-muted">{label}</div>
      <div className="font-medium tabular-nums text-foreground">
        {formatTick(payload[0].value)}
      </div>
    </div>
  );
}

export function CursorCostChart({ data }: CursorCostChartProps) {
  const c = useChartColors();

  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-muted text-sm sm:h-64">
        No cost data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
          width={48}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="estimated_cost" name="Est. cost" fill={c.chart1} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
