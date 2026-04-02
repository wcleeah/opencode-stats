'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

import { useChartColors } from '@/lib/use-chart-colors';
import type { ToolUsage } from '@/types';
import { formatDuration } from '@/lib/format';

interface ToolChartProps {
  data: ToolUsage[];
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: ToolUsage;
  }>;
}) {
  if (!active || !payload?.length) return null;

  const tool = payload[0].payload;

  return (
    <div className="rounded-sm border border-border bg-surface px-3 py-2 text-xs">
      <div className="mb-1 font-medium text-foreground">{tool.tool}</div>
      <div className="space-y-0.5 text-muted">
        <div>
          Calls:{' '}
          <span className="text-foreground tabular-nums">
            {tool.call_count.toLocaleString()}
          </span>
        </div>
        <div>
          Errors:{' '}
          <span className="text-error tabular-nums">
            {tool.error_count} ({tool.error_rate}%)
          </span>
        </div>
        <div>
          Avg duration:{' '}
          <span className="text-foreground tabular-nums">
            {formatDuration(tool.avg_duration_ms)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ToolChart({ data }: ToolChartProps) {
  const c = useChartColors();

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted text-sm">
        No tool usage data available
      </div>
    );
  }

  // Show top 15 tools by call count
  const chartData = data.slice(0, 15);

  return (
    <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 32)}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={c.grid} horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 10, fill: c.axis }}
          tickLine={false}
          axisLine={{ stroke: c.grid }}
        />
        <YAxis
          type="category"
          dataKey="tool"
          tick={{ fontSize: 10, fill: c.axis }}
          tickLine={false}
          axisLine={false}
          width={140}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="call_count" radius={[0, 2, 2, 0]} maxBarSize={20}>
          {chartData.map((entry) => (
            <Cell
              key={entry.tool}
              fill={entry.error_rate > 10 ? c.chart4 : c.chart2}
              fillOpacity={0.7}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
