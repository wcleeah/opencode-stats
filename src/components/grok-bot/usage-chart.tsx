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
  grokBotBucketTickLabel,
  grokBotDayTickIndexes,
  grokBotProgressLabel,
  grokBotWallTimeFromUtcMs,
  grokBotWallTimeToUtcMs,
  type GrokBotWallTime,
} from '@/lib/grok-bot/cycle';
import {
  GROK_BOT_INS_LINE,
  GROK_BOT_OUTS_LINE,
  grokBotHref,
} from '@/lib/grok-bot/href';
import {
  grokBotPeriodCaption,
  type GrokBotAlignedCharts,
} from '@/lib/grok-bot/window';
import { useChartColors } from '@/lib/use-chart-colors';

const PERIOD_DASH: readonly (string | undefined)[] = [
  undefined,
  '6 4',
  '2 3',
  '8 3 2 3',
];

function periodDash(periodIndex: number, several: boolean): string | undefined {
  if (!several) return undefined;
  return PERIOD_DASH[periodIndex % PERIOD_DASH.length];
}

const MINUTE_MS = 60 * 1000;
const CHART_HEIGHT = 448;

interface ChartRow {
  label: string;
  [seriesKey: string]: string | number;
}

interface DrawnLine {
  readonly key: string;
  readonly name: string;
  readonly colorIndex: number;
  readonly periodIndex: number;
  readonly lineIndex: number;
  readonly side: 'type' | 'ins' | 'outs';
}

type GrokBotSeriesChartProps = {
  readonly charts: GrokBotAlignedCharts;
  readonly windowStartMs: number;
  readonly windowEndMs: number;
  readonly timeZone: 'Asia/Hong_Kong';
  readonly usageParam: string | undefined;
  readonly measure: 'tokens' | 'usd';
  readonly bucketMs: number;
  readonly focusStartMs: number;
  readonly compareStarts: readonly number[];
  readonly cycleOffset?: number;
};

function pad2(value: number): string {
  return String(value).padStart(2, '0');
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
  charts: GrokBotAlignedCharts,
  measure: 'tokens' | 'usd',
  spanMs: number,
  timeZone: 'Asia/Hong_Kong',
  windowStartMs: number,
  bucketMs: number,
): { rows: ChartRow[]; lines: DrawnLine[] } {
  const several = charts.periods.length > 1;
  const labelFor = (bucketStartMs: number): string => {
    if (!several) return grokBotBucketTickLabel(bucketStartMs, spanMs, timeZone);
    return grokBotProgressLabel(bucketStartMs - windowStartMs, bucketMs);
  };
  if (charts.mode === 'by-type') {
    const lines: DrawnLine[] = [];
    charts.lines.forEach((line, lineIndex) => {
      charts.periods.forEach((period, periodIndex) => {
        lines.push({
          key: several ? `${lineIndex}:${periodIndex}` : line.id,
          name: several
            ? `${line.label} · ${grokBotPeriodCaption(period, charts.periods)}`
            : line.label,
          colorIndex: lineIndex,
          periodIndex,
          lineIndex,
          side: 'type',
        });
      });
    });
    return {
      lines,
      rows: charts.points.map((point) => {
        const row: ChartRow = {
          label: labelFor(point.bucketStartMs),
        };
        for (const line of lines) {
          const cell = point.values[line.lineIndex]?.[line.periodIndex];
          row[line.key] = measure === 'tokens' ? (cell?.tokens ?? 0) : (cell?.usd ?? 0);
        }
        return row;
      }),
    };
  }

  const lines: DrawnLine[] = [];
  (['ins', 'outs'] as const).forEach((side, sideIndex) => {
    charts.periods.forEach((period, periodIndex) => {
      const label = side === 'ins' ? GROK_BOT_INS_LINE : GROK_BOT_OUTS_LINE;
      lines.push({
        key: several ? `${side}:${periodIndex}` : side,
        name: several
          ? `${label} · ${grokBotPeriodCaption(period, charts.periods)}`
          : label,
        colorIndex: sideIndex,
        periodIndex,
        lineIndex: sideIndex,
        side,
      });
    });
  });
  return {
    lines,
    rows: charts.points.map((point) => {
      const row: ChartRow = {
        label: labelFor(point.bucketStartMs),
      };
      for (const line of lines) {
        const side = point.sides[line.periodIndex];
        if (!side) {
          row[line.key] = 0;
          continue;
        }
        if (line.side === 'outs') {
          row[line.key] = measure === 'tokens' ? side.outsTokens : side.outsUsd;
        } else {
          row[line.key] = measure === 'tokens' ? side.insTokens : side.insUsd;
        }
      }
      return row;
    }),
  };
}

function ChartTooltip({
  active,
  payload,
  label,
  formatValue,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{
    name?: string;
    value?: number | string;
    color?: string;
    dataKey?: string | number;
  }>;
  label?: string;
  formatValue: (value: number, seriesKey: string) => string;
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
            {formatValue(
              typeof entry.value === 'number' ? entry.value : 0,
              String(entry.dataKey ?? ''),
            )}
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
    bucketMs,
    focusStartMs,
    compareStarts,
    cycleOffset,
  } = props;
  const router = useRouter();
  const colors = useChartColors();
  const spanMs = windowEndMs - windowStartMs + 1;
  const selection = useRef<{ startIndex: number; endIndex: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formatAxis = measure === 'usd' ? (value: number) => formatCost(value) : formatTokens;
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
  const drawn = projection(charts, measure, spanMs, timeZone, windowStartMs, bucketMs);
  const several = charts.periods.length > 1;
  const axisTicks = several
    ? undefined
    : grokBotDayTickIndexes(drawn.rows.length, bucketMs, spanMs)
      ?.map((index) => drawn.rows[index]?.label)
      .filter((label): label is string => label !== undefined);

  function navigationHref(next: { startMs?: number; endMs?: number; focusStartMs: number }): string {
    const ranged = next.startMs !== undefined && next.endMs !== undefined;
    const windowPart = ranged
      ? { startMs: next.startMs, endMs: next.endMs }
      : cycleOffset !== undefined
        ? { cycle: cycleOffset }
        : { startMs: windowStartMs, endMs: windowEndMs };
    const primaryStart = ranged ? next.startMs : windowStartMs;
    return grokBotHref({
      ...windowPart,
      usage: usageParam,
      mode: charts.mode,
      compareStarts,
      focusStartMs: next.focusStartMs,
      primaryStartMs: primaryStart,
    });
  }
  const formatTooltip = (value: number, seriesKey: string): string => {
    if (measure !== 'usd') return formatTokens(value);
    const periodIndex = drawn.lines.find((line) => line.key === seriesKey)?.periodIndex ?? 0;
    const period = charts.periods[periodIndex] ?? charts.periods[0];
    return formatCost(value, period.totals.spend.includesCardEstimate);
  };
  const points = charts.points;
  const pointGapMs = points.length > 1
    ? points[1].bucketStartMs - points[0].bucketStartMs
    : spanMs;

  function openRange(startMs: number, endMs: number): void {
    if (startMs === windowStartMs && endMs === windowEndMs) return;
    router.push(navigationHref({ startMs, endMs, focusStartMs }));
  }

  function highlightPeriod(startMs: number): void {
    if (!several || startMs === focusStartMs) return;
    router.push(navigationHref({ focusStartMs: startMs }));
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
    const endMs = Math.min(windowEndMs, points[end].bucketStartMs + pointGapMs - 1);
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
              {...(axisTicks
                ? {
                    ticks: axisTicks,
                    interval: 'preserveStartEnd' as const,
                    padding: { left: 36, right: 44 },
                  }
                : {})}
            />
            <YAxis
              tickFormatter={formatAxis}
              tick={{ fontSize: 10, fill: colors.axis }}
              tickLine={false}
              axisLine={false}
              width={measure === 'usd' ? 72 : 52}
            />
            <Tooltip content={<ChartTooltip formatValue={formatTooltip} />} />
            <Legend
              itemSorter={null}
              wrapperStyle={{ fontSize: '11px', color: colors.legend, cursor: several ? 'pointer' : undefined }}
              onClick={(entry) => {
                const key = String(entry.dataKey ?? '');
                const line = drawn.lines.find((item) => item.key === key);
                if (!line) return;
                const period = charts.periods[line.periodIndex];
                if (period) highlightPeriod(period.startMs);
              }}
            />
            {drawn.lines.map((line) => {
              const period = charts.periods[line.periodIndex];
              const focused = !several || period?.startMs === focusStartMs;
              return (
                <Line
                  key={line.key}
                  type="monotone"
                  dataKey={line.key}
                  name={line.name}
                  stroke={palette[line.colorIndex % palette.length]}
                  strokeWidth={several ? (focused ? 2.25 : 1.25) : 1.75}
                  strokeOpacity={focused ? 1 : 0.35}
                  strokeDasharray={periodDash(line.periodIndex, several)}
                  dot={false}
                  isAnimationActive={false}
                  style={{ cursor: several ? 'pointer' : undefined }}
                  onClick={() => {
                    if (period) highlightPeriod(period.startMs);
                  }}
                />
              );
            })}
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
      {several
        ? charts.periods.map((period) => (
            <p key={period.startMs} className="text-[10px]">
              <button
                type="button"
                className={
                  period.startMs === focusStartMs
                    ? 'text-foreground'
                    : 'text-muted hover:text-foreground'
                }
                onClick={() => highlightPeriod(period.startMs)}
              >
                {period.label}
              </button>
            </p>
          ))
        : null}
    </div>
  );
}
