import { grokBotUsageCatalog, type GrokBotUsageTypeOption } from '@/lib/grok-bot/catalog';
import type { GrokBotCharge, GrokBotPricedRow } from '@/lib/grok-bot/charge';
import {
  GROK_BOT_CYCLE_TIME_ZONE,
  projectGrokBotPeriods,
  resolveGrokBotWindow,
  type GrokBotCycleClock,
  type GrokBotResolvedWindow,
  type GrokBotWindowMode,
} from '@/lib/grok-bot/cycle';
import {
  grokBotHref,
  parseGrokBotChartMode,
  parseGrokBotCompareStarts,
  parseGrokBotFocusStart,
  removeGrokBotCompareStart,
  selectUsage,
  toggleGrokBotUsageParam,
  type GrokBotChartMode,
} from '@/lib/grok-bot/href';
import {
  alignGrokBotPeriods,
  foldGrokBotWindow,
  type GrokBotAlignedCharts,
} from '@/lib/grok-bot/window';

const GROK_BOT_PAGE_SIZE = 50;

export interface GrokBotLedger {
  readonly clock: GrokBotCycleClock;
  /** Snapshot instant. Projection uses this instead of the live clock. */
  readonly loadedAtMs: number;
  /** Sorted by (eventAt ASC, id ASC). The table is this order reversed. */
  readonly events: readonly GrokBotLedgerEvent[];
}

export interface GrokBotLedgerEvent {
  readonly id: number;
  readonly eventAt: number;
  readonly usageType: string;
  readonly kind: string;
  readonly tokensInput: number;
  readonly tokensCacheWrite: number;
  readonly tokensCacheRead: number;
  readonly tokensOutput: number;
  readonly tokensTotal: number;
  readonly priced: GrokBotPricedRow;
}

export interface GrokBotLens {
  readonly window: GrokBotWindowMode;
  /** `undefined` means every catalog id. */
  readonly usage: string | undefined;
  readonly mode: GrokBotChartMode;
  readonly compareStarts: readonly number[];
  readonly focusStartMs: number;
  readonly page: number;
}

export type GrokBotLensCommand =
  | { readonly type: 'cycle'; readonly offset: number }
  | { readonly type: 'range'; readonly startMs: number; readonly endMs: number }
  | { readonly type: 'toggle-usage'; readonly id: string }
  | { readonly type: 'chart-mode' }
  | { readonly type: 'add-compare'; readonly startMs: number }
  | { readonly type: 'remove-compare'; readonly startMs: number }
  | { readonly type: 'focus'; readonly startMs: number }
  | { readonly type: 'page'; readonly page: number };

export interface GrokBotSearchRaw {
  cycle?: string;
  start?: string;
  end?: string;
  usage?: string;
  page?: string;
  view?: string;
  cmp?: string;
  focus?: string;
}

export interface GrokBotTableRow {
  id: number;
  eventAt: number;
  usageType: string;
  label: string;
  kind: string;
  tokensInput: number;
  tokensCacheWrite: number;
  tokensCacheRead: number;
  tokensOutput: number;
  tokensTotal: number;
  charge: GrokBotCharge;
}

export interface GrokBotBoard {
  cycle: {
    offset: number;
    startMs: number;
    endMs: number;
    label: string;
  };
  windowMode: GrokBotWindowMode;
  window: { startMs: number; endMs: number; bucketMs: number };
  timeZone: 'Asia/Hong_Kong';
  usageTypes: readonly GrokBotUsageTypeOption[];
  selectedUsageTypeIds: readonly string[];
  usageParam: string | undefined;
  charts: GrokBotAlignedCharts;
  focusStartMs: number;
  rows: readonly GrokBotTableRow[];
  page: number;
  pageSize: number;
  totalRows: number;
  cycleHasRows: boolean;
}

interface PreparedLens {
  readonly resolved: GrokBotResolvedWindow;
  readonly compareStarts: readonly number[];
  readonly projected: ReturnType<typeof projectGrokBotPeriods>;
  readonly focusStartMs: number;
  readonly catalog: readonly GrokBotUsageTypeOption[];
  readonly selection: { readonly ids: readonly string[]; readonly param: string | undefined };
  readonly accepts: (event: GrokBotLedgerEvent) => boolean;
  readonly seriesTypes: readonly { readonly id: string; readonly label: string }[];
  readonly cycleEvents: readonly GrokBotLedgerEvent[];
}

function lowerBound(events: readonly GrokBotLedgerEvent[], timeMs: number): number {
  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (events[mid].eventAt < timeMs) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function upperBound(events: readonly GrokBotLedgerEvent[], timeMs: number): number {
  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (events[mid].eventAt <= timeMs) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function sliceByTime(
  events: readonly GrokBotLedgerEvent[],
  startMs: number,
  endMs: number,
): readonly GrokBotLedgerEvent[] {
  return events.slice(lowerBound(events, startMs), upperBound(events, endMs));
}

function windowFromLens(
  ledger: GrokBotLedger,
  window: GrokBotWindowMode,
): GrokBotResolvedWindow {
  return resolveGrokBotWindow({
    clock: ledger.clock,
    now: new Date(ledger.loadedAtMs),
    cycle: window.kind === 'cycle' ? String(window.offset) : undefined,
    start: window.kind === 'range' ? String(window.startMs) : undefined,
    end: window.kind === 'range' ? String(window.endMs) : undefined,
  });
}

function catalogFor(
  ledger: GrokBotLedger,
  cycleStartMs: number,
  cycleEndMs: number,
): readonly GrokBotUsageTypeOption[] {
  const ids = sliceByTime(ledger.events, cycleStartMs, cycleEndMs).map(
    (event) => event.usageType,
  );
  return grokBotUsageCatalog(ids);
}

function clampedPage(totalRows: number, requested: number): number {
  if (!Number.isSafeInteger(requested) || requested < 1) return 1;
  if (totalRows === 0) return 1;
  return Math.min(requested, Math.ceil(totalRows / GROK_BOT_PAGE_SIZE));
}

function parsePage(page: string | undefined): number {
  if (page === undefined) return 1;
  const trimmed = page.trim();
  if (!/^\d+$/.test(trimmed)) return 1;
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return 1;
  return parsed;
}

function searchRawFromQuery(query: string): GrokBotSearchRaw {
  const question = query.indexOf('?');
  const search = question === -1
    ? (query.startsWith('/') ? '' : query)
    : query.slice(question + 1);
  const params = new URLSearchParams(search);
  const read = (key: string): string | undefined => {
    const value = params.get(key);
    return value === null ? undefined : value;
  };
  return {
    cycle: read('cycle'),
    start: read('start'),
    end: read('end'),
    usage: read('usage'),
    page: read('page'),
    view: read('view'),
    cmp: read('cmp'),
    focus: read('focus'),
  };
}

function sameStarts(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((start, index) => start === right[index]);
}

function prepare(ledger: GrokBotLedger, lens: GrokBotLens): PreparedLens {
  const resolved = windowFromLens(ledger, lens.window);
  const compareStarts = parseGrokBotCompareStarts(
    lens.compareStarts.join(','),
    resolved.window.startMs,
  );
  const projected = projectGrokBotPeriods({
    clock: ledger.clock,
    primary: resolved,
    compareStarts,
  });
  const focusStartMs = parseGrokBotFocusStart(
    String(lens.focusStartMs),
    projected.map((period) => period.window.startMs),
  );
  const catalog = catalogFor(ledger, resolved.cycle.startMs, resolved.cycle.endMs);
  const selection = selectUsage(catalog, lens.usage);
  const explicit = selection.param === undefined ? undefined : new Set(selection.ids);
  const accepts = (event: GrokBotLedgerEvent): boolean => (
    explicit === undefined || explicit.has(event.usageType)
  );
  const cycleEvents = sliceByTime(
    ledger.events,
    resolved.cycle.startMs,
    resolved.cycle.endMs,
  );
  const inCycle = new Set(cycleEvents.map((event) => event.usageType));
  const selected = new Set(selection.ids);
  const seriesTypes = catalog
    .filter((entry) => selected.has(entry.id) && inCycle.has(entry.id))
    .map((entry) => ({ id: entry.id, label: entry.label }));
  return {
    resolved,
    compareStarts,
    projected,
    focusStartMs,
    catalog,
    selection,
    accepts,
    seriesTypes,
    cycleEvents,
  };
}

function focusedEvents(
  ledger: GrokBotLedger,
  prepared: PreparedLens,
): GrokBotLedgerEvent[] {
  const period = prepared.projected.find(
    (item) => item.window.startMs === prepared.focusStartMs,
  ) ?? prepared.projected[0];
  return sliceByTime(
    ledger.events,
    period.window.startMs,
    period.window.endMs,
  ).filter(prepared.accepts);
}

function finish(ledger: GrokBotLedger, lens: GrokBotLens): GrokBotLens {
  const prepared = prepare(ledger, lens);
  return {
    window: prepared.resolved.mode,
    usage: prepared.selection.param,
    mode: lens.mode,
    compareStarts: prepared.compareStarts,
    focusStartMs: prepared.focusStartMs,
    page: clampedPage(focusedEvents(ledger, prepared).length, lens.page),
  };
}

export function grokBotLensFromSearch(
  ledger: GrokBotLedger,
  raw: GrokBotSearchRaw | string,
): GrokBotLens {
  const parsed = typeof raw === 'string' ? searchRawFromQuery(raw) : raw;
  const resolved = resolveGrokBotWindow({
    clock: ledger.clock,
    now: new Date(ledger.loadedAtMs),
    cycle: parsed.cycle,
    start: parsed.start,
    end: parsed.end,
  });
  const compareStarts = parseGrokBotCompareStarts(parsed.cmp, resolved.window.startMs);
  const projected = projectGrokBotPeriods({
    clock: ledger.clock,
    primary: resolved,
    compareStarts,
  });
  return finish(ledger, {
    window: resolved.mode,
    usage: parsed.usage,
    mode: parseGrokBotChartMode(parsed.view),
    compareStarts,
    focusStartMs: parseGrokBotFocusStart(
      parsed.focus,
      projected.map((period) => period.window.startMs),
    ),
    page: parsePage(parsed.page),
  });
}

export function applyGrokBotLens(
  ledger: GrokBotLedger,
  lens: GrokBotLens,
  command: GrokBotLensCommand,
): GrokBotLens {
  const now = new Date(ledger.loadedAtMs);
  switch (command.type) {
    case 'cycle': {
      const resolved = resolveGrokBotWindow({
        clock: ledger.clock,
        now,
        cycle: String(command.offset),
      });
      return finish(ledger, { ...lens, window: resolved.mode, page: 1 });
    }
    case 'range': {
      const resolved = resolveGrokBotWindow({
        clock: ledger.clock,
        now,
        start: String(command.startMs),
        end: String(command.endMs),
      });
      return finish(ledger, { ...lens, window: resolved.mode, page: 1 });
    }
    case 'toggle-usage': {
      const resolved = windowFromLens(ledger, lens.window);
      const catalog = catalogFor(ledger, resolved.cycle.startMs, resolved.cycle.endMs);
      const usage = toggleGrokBotUsageParam(
        catalog.map((entry) => entry.id),
        lens.usage,
        command.id,
      );
      return finish(ledger, { ...lens, usage, page: 1 });
    }
    case 'chart-mode':
      return finish(ledger, {
        ...lens,
        mode: lens.mode === 'by-type' ? 'ins-outs' : 'by-type',
        page: 1,
      });
    case 'add-compare': {
      const resolved = windowFromLens(ledger, lens.window);
      const compareStarts = parseGrokBotCompareStarts(
        [...lens.compareStarts, command.startMs].join(','),
        resolved.window.startMs,
      );
      if (sameStarts(compareStarts, lens.compareStarts)) return lens;
      return finish(ledger, { ...lens, compareStarts, page: 1 });
    }
    case 'remove-compare': {
      const compareStarts = removeGrokBotCompareStart(lens.compareStarts, command.startMs);
      if (sameStarts(compareStarts, lens.compareStarts)) return lens;
      const primaryStartMs = windowFromLens(ledger, lens.window).window.startMs;
      const focusStartMs = lens.focusStartMs === command.startMs
        ? primaryStartMs
        : lens.focusStartMs;
      return finish(ledger, { ...lens, compareStarts, focusStartMs, page: 1 });
    }
    case 'focus':
      return finish(ledger, { ...lens, focusStartMs: command.startMs, page: 1 });
    case 'page':
      return finish(ledger, { ...lens, page: command.page });
  }
}

export function projectGrokBotBoard(
  ledger: GrokBotLedger,
  lens: GrokBotLens,
): GrokBotBoard {
  const prepared = prepare(ledger, lens);
  const folds = prepared.projected.map((period) => ({
    projected: period,
    folded: foldGrokBotWindow({
      windowStartMs: period.window.startMs,
      windowEndMs: period.window.endMs,
      bucketMs: period.window.bucketMs,
      seriesTypes: prepared.seriesTypes,
      events: sliceByTime(
        ledger.events,
        period.window.startMs,
        period.window.endMs,
      ).filter(prepared.accepts),
      mode: lens.mode,
    }),
  }));
  const charts = alignGrokBotPeriods({
    seriesTypes: prepared.seriesTypes,
    folds,
  });
  const ordered = focusedEvents(ledger, prepared).reverse();
  const totalRows = ordered.length;
  const page = clampedPage(totalRows, lens.page);
  const labels = new Map(prepared.catalog.map((entry) => [entry.id, entry.label]));
  const rows = ordered
    .slice((page - 1) * GROK_BOT_PAGE_SIZE, page * GROK_BOT_PAGE_SIZE)
    .map((event): GrokBotTableRow => ({
      id: event.id,
      eventAt: event.eventAt,
      usageType: event.usageType,
      label: labels.get(event.usageType) ?? event.usageType,
      kind: event.kind,
      tokensInput: event.tokensInput,
      tokensCacheWrite: event.tokensCacheWrite,
      tokensCacheRead: event.tokensCacheRead,
      tokensOutput: event.tokensOutput,
      tokensTotal: event.tokensTotal,
      charge: event.priced.charge,
    }));

  return {
    cycle: {
      offset: prepared.resolved.cycle.offset,
      startMs: prepared.resolved.cycle.startMs,
      endMs: prepared.resolved.cycle.endMs,
      label: prepared.resolved.cycle.label,
    },
    windowMode: prepared.resolved.mode,
    window: prepared.resolved.window,
    timeZone: GROK_BOT_CYCLE_TIME_ZONE,
    usageTypes: prepared.catalog,
    selectedUsageTypeIds: prepared.selection.ids,
    usageParam: prepared.selection.param,
    charts,
    focusStartMs: prepared.focusStartMs,
    rows,
    page,
    pageSize: GROK_BOT_PAGE_SIZE,
    totalRows,
    cycleHasRows: prepared.cycleEvents.length > 0,
  };
}

export function grokBotHrefForLens(ledger: GrokBotLedger, lens: GrokBotLens): string {
  const resolved = windowFromLens(ledger, lens.window);
  const windowPart = resolved.mode.kind === 'cycle'
    ? { cycle: resolved.mode.offset }
    : { startMs: resolved.mode.startMs, endMs: resolved.mode.endMs };
  return grokBotHref({
    ...windowPart,
    usage: lens.usage,
    page: lens.page,
    mode: lens.mode,
    compareStarts: lens.compareStarts,
    focusStartMs: lens.focusStartMs,
    primaryStartMs: resolved.window.startMs,
  });
}
