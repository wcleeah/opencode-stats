'use client';

import { useEffect, useRef, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import {
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatCost, formatTokens } from '@/lib/format';
import {
  formatGrokBotWallTime,
  grokBotWallTimeFromUtcMs,
  grokBotWallTimeToUtcMs,
  type GrokBotWallTime,
} from '@/lib/grok-bot/cycle';
import {
  GROK_BOT_INS_LINE,
  GROK_BOT_OUTS_LINE,
  grokBotHref,
} from '@/lib/grok-bot/href';
import type { GrokBotCharts } from '@/lib/grok-bot/window';
import { useChartColors } from '@/lib/use-chart-colors';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const CHART_HEIGHT = 448;

interface ChartRow {
  label: string;
  [seriesKey: string]: string | number;
}

interface DrawnLine {
  key: string;
  name: string;
}

type GrokBotSeriesChartProps = {
  readonly charts: GrokBotCharts;
  readonly windowStartMs: number;
  readonly windowEndMs: number;
  readonly timeZone: 'Asia/Hong_Kong';
  readonly usageParam: string | undefined;
} & (
  | { readonly measure: 'tokens' }
  | { readonly measure: 'usd'; readonly dollarsAreEstimates: boolean }
);

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function tickLabel(utcMs: number, spanMs: number, timeZone: 'Asia/Hong_Kong'): string {
  const wall = grokBotWallTimeFromUtcMs(utcMs, timeZone);
  const hh = pad2(wall.hour);
  const mm = pad2(wall.minute);
  if (spanMs <= SIX_HOURS_MS) return `${hh}:${mm}`;
  if (spanMs <= FORTY_EIGHT_HOURS_MS) return `${wall.day} ${hh}:${mm}`;
  const weekday = wall.weekday.charAt(0).toUpperCase() + wall.weekday.slice(1, 3);
  return `${weekday} ${hh}`;
}

function wallInputValue(utcMs: number, timeZone: 'Asia/Hong_Kong'): string {
  const wall = grokBotWallTimeFromUtcMs(utcMs, timeZone);
  return `${wall.year}-${pad2(wall.month)}-${pad2(wall.day)}T${pad2(wall.hour)}:${pad2(wall.minute)}`;
}

function parseWallInput(
  value: string,
): Pick<GrokBotWallTime, 'year' | 'month' | 'day' | 'hour' | 'minute'> | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
}

function projection(
  charts: GrokBotCharts,
  measure: 'tokens' | 'usd',
  spanMs: number,
  timeZone: 'Asia/Hong_Kong',
): { rows: ChartRow[]; lines: DrawnLine[] } {
  if (charts.mode === 'by-type') {
    return {
      lines: charts.lines.map((line) => ({ key: line.id, name: line.label })),
      rows: charts.points.map((point) => {
        const row: ChartRow = {
          label: tickLabel(point.bucketStartMs, spanMs, timeZone),
        };
        charts.lines.forEach((line, index) => {
          const value = point.values[index];
          row[line.id] = measure === 'tokens' ? value.tokens : value.usd;
        });
        return row;
      }),
    };
  }
  return {
    lines: [
      { key: 'ins', name: GROK_BOT_INS_LINE },
      { key: 'outs', name: GROK_BOT_OUTS_LINE },
    ],
    rows: charts.points.map((point) => ({
      label: tickLabel(point.bucketStartMs, spanMs, timeZone),
      ins: measure === 'tokens' ? point.insTokens : point.insUsd,
      outs: measure === 'tokens' ? point.outsTokens : point.outsUsd,
    })),
  };
}

function ChartTooltip({
  active,
  payload,
  label,
  formatValue,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ name?: string; value?: number | string; color?: string }>;
  label?: string;
  formatValue: (value: number) => string;
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
            {formatValue(typeof entry.value === 'number' ? entry.value : 0)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function GrokBotSeriesChart(props: GrokBotSeriesChartProps): JSX.Element {
  const {
    charts,
    windowStartMs,
    windowEndMs,
    timeZone,
    usageParam,
    measure,
  } = props;
  const dollarsAreEstimates = props.measure === 'usd' && props.dollarsAreEstimates;
  const router = useRouter();
  const colors = useChartColors();
  const spanMs = windowEndMs - windowStartMs + 1;
  const selection = useRef<{ startIndex: number; endIndex: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formatValue = measure === 'usd'
    ? (value: number) => formatCost(value, dollarsAreEstimates)
    : formatTokens;
  const emptyCopy = measure === 'tokens'
    ? 'No token usage in this window.'
    : 'No spending in this window.';

  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);

  if (charts.points.length === 0) {
    return (
      <div className="flex h-[28rem] items-center justify-center text-sm text-muted">
        {emptyCopy}
      </div>
    );
  }

  const palette = [colors.chart1, colors.chart2, colors.chart3, colors.chart4, colors.chart5];
  const drawn = projection(charts, measure, spanMs, timeZone);
  const points = charts.points;
  const bucketMs = points.length > 1
    ? points[1].bucketStartMs - points[0].bucketStartMs
    : spanMs;

  function openRange(startMs: number, endMs: number): void {
    if (startMs === windowStartMs && endMs === windowEndMs) return;
    router.push(grokBotHref({ startMs, endMs, usage: usageParam, mode: charts.mode }));
  }

  function rangeForIndexes(
    startIndex: number,
    endIndex: number,
  ): { startMs: number; endMs: number } | null {
    const last = points.length - 1;
    const start = Math.max(0, Math.min(startIndex, last));
    const end = Math.max(start, Math.min(endIndex, last));
    if (start === 0 && end === last) return null;
    const startMs = points[start].bucketStartMs;
    const endMs = Math.min(windowEndMs, points[end].bucketStartMs + bucketMs - 1);
    if (startMs === windowStartMs && endMs === windowEndMs) return null;
    return { startMs, endMs };
  }

  // onChange fires for each drag pixel, and onDragEnd reports the controlled
  // indexes rather than that selection. Remember the latest indexes and open
  // that range once the drag settles.
  function rememberBrush(next: { startIndex?: number; endIndex?: number }): void {
    if (next.startIndex === undefined || next.endIndex === undefined) return;
    selection.current = { startIndex: next.startIndex, endIndex: next.endIndex };
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      const chosen = selection.current;
      if (!chosen) return;
      const range = rangeForIndexes(chosen.startIndex, chosen.endIndex);
      if (range) openRange(range.startMs, range.endMs);
    }, 300);
  }

  function finishBrush(): void {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const chosen = selection.current;
    if (!chosen) return;
    const range = rangeForIndexes(chosen.startIndex, chosen.endIndex);
    if (range) openRange(range.startMs, range.endMs);
  }

  function applyMinutes(startValue: string, endValue: string): void {
    const startWall = parseWallInput(startValue);
    const endWall = parseWallInput(endValue);
    if (!startWall || !endWall) return;
    const startMs = grokBotWallTimeToUtcMs(startWall, timeZone);
    const endMinuteMs = grokBotWallTimeToUtcMs(endWall, timeZone);
    openRange(startMs, endMinuteMs + MINUTE_MS - 1);
  }

  const startValue = wallInputValue(windowStartMs, timeZone);
  const endValue = wallInputValue(windowEndMs, timeZone);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-[10px] uppercase tracking-wide text-muted">Start</span>
          <input
            type="datetime-local"
            step={60}
            value={startValue}
            aria-label="Window start"
            onChange={(event) => applyMinutes(event.target.value, endValue)}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] uppercase tracking-wide text-muted">End</span>
          <input
            type="datetime-local"
            step={60}
            value={endValue}
            aria-label="Window end"
            onChange={(event) => applyMinutes(startValue, event.target.value)}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      <div className="w-full">
        <ResponsiveContainer
          width="100%"
          height={CHART_HEIGHT}
          initialDimension={{ width: 720, height: CHART_HEIGHT }}
        >
          <LineChart data={drawn.rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: colors.axis }}
              tickLine={false}
              axisLine={{ stroke: colors.grid }}
              minTickGap={24}
            />
            <YAxis
              tickFormatter={formatValue}
              tick={{ fontSize: 10, fill: colors.axis }}
              tickLine={false}
              axisLine={false}
              width={measure === 'usd' ? 72 : 52}
            />
            <Tooltip content={<ChartTooltip formatValue={formatValue} />} />
            <Legend wrapperStyle={{ fontSize: '11px', color: colors.legend }} />
            {drawn.lines.map((line, index) => (
              <Line
                key={line.key}
                type="monotone"
                dataKey={line.key}
                name={line.name}
                stroke={palette[index % palette.length]}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            ))}
            <Brush
              dataKey="label"
              height={28}
              stroke={colors.axis}
              fill={colors.tooltip}
              onChange={rememberBrush}
              onDragEnd={finishBrush}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-muted">
        {formatGrokBotWallTime(grokBotWallTimeFromUtcMs(windowStartMs, timeZone))}
        {' to '}
        {formatGrokBotWallTime(grokBotWallTimeFromUtcMs(windowEndMs, timeZone))}
        {' · '}
        Asia/Hong_Kong
      </p>
    </div>
  );
}
