export const GROK_BOT_PLAN_SCHEMA_VERSION = 1;

const MAX_REPORTS = 12;
const MAX_SHARE_NODES = 800;
const MAX_DEPTH = 8;
const MAX_TEXT = 200;
const WEEKLY_WARN_PERCENT = 80;

const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const SOURCE_PATTERN = /^[a-z][a-z0-9_]{0,80}$/;
const KEY_PATTERN = /^[a-z][a-z0-9_]{0,40}$/;
const ZONE_PATTERN = /^[A-Za-z0-9_+/.-]{1,64}$/;

const TOP_LEVEL_KEYS = new Set([
  'schema_version',
  'captured_at',
  'source',
  'plan',
  'weekly_usage_percent_used',
  'reset_at',
  'on_demand',
  'reports',
]);
const RESET_KEYS = new Set(['timezone', 'label', 'iso_approx']);
const ON_DEMAND_KEYS = new Set(['monthly_limit', 'amount']);
const REPORT_KEYS = new Set(['period', 'period_label', 'breakdown', 'rows']);
const META_KEYS = new Set([
  'share_pct',
  'children',
  'label',
  'note',
  'paused',
  'runs_per_week_approx',
]);

type Scalar = string | number | boolean | null;

interface ParsedField {
  ok: true;
  value: Scalar;
}

interface FieldError {
  ok: false;
  error: string;
}

interface ParseState {
  nodes: number;
}

export interface GrokBotPlanShareNode {
  sharePct: number;
  fields: Readonly<Record<string, Scalar>>;
  children: readonly GrokBotPlanShareNode[];
}

export interface GrokBotPlanReport {
  period: string;
  periodLabel: string;
  breakdown: readonly string[];
  rows: readonly GrokBotPlanShareNode[];
}

export interface GrokBotPlanUsage {
  schemaVersion: number;
  capturedAt: string;
  capturedAtMs: number;
  source: string;
  plan: string;
  weeklyUsagePercentUsed: number;
  resetAt: {
    timezone: string;
    label: string;
    isoApprox: string;
  };
  onDemand: {
    monthlyLimit: number | null;
    amount: number | null;
  };
  reports: readonly GrokBotPlanReport[];
}

export interface GrokBotPlanSnapshotSummary {
  id: number;
  capturedAt: string;
  capturedAtMs: number;
  plan: string;
  weeklyUsagePercentUsed: number;
}

export interface GrokBotPlanSnapshotRecord {
  id: number;
  receivedAt: number;
  usage: GrokBotPlanUsage;
}

export interface GrokBotPlanView {
  snapshot: GrokBotPlanSnapshotRecord | null;
  recent: readonly GrokBotPlanSnapshotSummary[];
  selectedId: number | null;
  latestId: number | null;
  notice: string | null;
}

export interface PresentedShareRow {
  title: string;
  detail: string | null;
  shareLabel: string;
  barPct: number;
  paused: boolean;
  note: string | null;
  cadence: string | null;
  extras: readonly { key: string; value: string }[];
  children: readonly PresentedShareRow[];
}

export interface PresentedReport {
  title: string;
  period: string;
  breakdownLabel: string;
  rows: readonly PresentedShareRow[];
}

export interface PresentedPlanUsage {
  plan: string;
  source: string;
  capturedAt: string;
  weeklyLabel: string;
  weeklyPct: number;
  weeklyWarn: boolean;
  resetLabel: string;
  resetDetail: string;
  onDemandValue: string;
  onDemandDetail: string;
  reports: readonly PresentedReport[];
}

export function parseGrokBotPlanCapture(value: string | undefined): number | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed)) return null;
  return parsed;
}

export function grokBotPlanCaptureHref(baseHref: string, captureId: number): string {
  const queryIndex = baseHref.indexOf('?');
  const path = queryIndex === -1 ? baseHref : baseHref.slice(0, queryIndex);
  const params = new URLSearchParams(
    queryIndex === -1 ? '' : baseHref.slice(queryIndex + 1),
  );
  params.set('capture', String(captureId));
  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

export function parseGrokBotPlanUsage(
  input: unknown,
): { data: GrokBotPlanUsage | null; error: string | null } {
  if (!isRecord(input)) {
    return { data: null, error: 'Plan usage must be an object.' };
  }

  const missing = requiredKey(input, TOP_LEVEL_KEYS, 'body');
  if (missing) return { data: null, error: missing };
  const extra = unknownKey(input, TOP_LEVEL_KEYS, 'body');
  if (extra) return { data: null, error: extra };

  if (input.schema_version !== GROK_BOT_PLAN_SCHEMA_VERSION) {
    return { data: null, error: 'body.schema_version must be 1.' };
  }

  const captured = parseIso(input.captured_at, 'body.captured_at');
  if (typeof captured === 'string') return { data: null, error: captured };

  const source = requireIdentifier(input.source, SOURCE_PATTERN, 'body.source');
  if ('error' in source) return { data: null, error: source.error };

  const plan = requireText(input.plan, 80, 'body.plan');
  if ('error' in plan) return { data: null, error: plan.error };

  const weekly = parsePercent(
    input.weekly_usage_percent_used,
    'body.weekly_usage_percent_used',
  );
  if (typeof weekly === 'string') return { data: null, error: weekly };

  const reset = parseReset(input.reset_at);
  if ('error' in reset) return { data: null, error: reset.error };

  const onDemand = parseOnDemand(input.on_demand);
  if ('error' in onDemand) return { data: null, error: onDemand.error };

  const reports = parseReports(input.reports);
  if ('error' in reports) return { data: null, error: reports.error };

  return {
    data: {
      schemaVersion: GROK_BOT_PLAN_SCHEMA_VERSION,
      capturedAt: captured.text,
      capturedAtMs: captured.ms,
      source: source.text,
      plan: plan.text,
      weeklyUsagePercentUsed: weekly,
      resetAt: reset.reset,
      onDemand: onDemand.onDemand,
      reports: reports.reports,
    },
    error: null,
  };
}

export function grokBotPlanUsagePayload(
  usage: GrokBotPlanUsage,
): Record<string, unknown> {
  return {
    schema_version: usage.schemaVersion,
    captured_at: usage.capturedAt,
    source: usage.source,
    plan: usage.plan,
    weekly_usage_percent_used: usage.weeklyUsagePercentUsed,
    reset_at: {
      timezone: usage.resetAt.timezone,
      label: usage.resetAt.label,
      iso_approx: usage.resetAt.isoApprox,
    },
    on_demand: {
      monthly_limit: usage.onDemand.monthlyLimit,
      amount: usage.onDemand.amount,
    },
    reports: usage.reports.map((report) => ({
      period: report.period,
      period_label: report.periodLabel,
      breakdown: [...report.breakdown],
      rows: report.rows.map(canonicalNode),
    })),
  };
}

export function formatSharePct(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text}%`;
}

export function formatOnDemand(limit: number | null, amount: number | null): string {
  if (limit === null && amount === null) return '—';
  const amountText = amount === null ? '—' : formatPlainNumber(amount);
  const limitText = limit === null ? '—' : formatPlainNumber(limit);
  return `${amountText} / ${limitText}`;
}

export function shareBarWidth(sharePct: number): number {
  if (sharePct <= 0) return 0;
  return Math.min(100, Math.max(sharePct, 2));
}

export function presentGrokBotPlanUsage(usage: GrokBotPlanUsage): PresentedPlanUsage {
  return {
    plan: usage.plan,
    source: usage.source,
    capturedAt: usage.capturedAt,
    weeklyLabel: formatSharePct(usage.weeklyUsagePercentUsed),
    weeklyPct: usage.weeklyUsagePercentUsed,
    weeklyWarn: usage.weeklyUsagePercentUsed >= WEEKLY_WARN_PERCENT,
    resetLabel: usage.resetAt.label,
    resetDetail: `${usage.resetAt.timezone} · ${usage.resetAt.isoApprox}`,
    onDemandValue: formatOnDemand(usage.onDemand.monthlyLimit, usage.onDemand.amount),
    onDemandDetail: 'Amount / monthly limit',
    reports: usage.reports.map((report) => ({
      title: report.periodLabel,
      period: report.period,
      breakdownLabel: report.breakdown.join(' / '),
      rows: report.rows.map((row) => presentRow(row, report.breakdown, 0)),
    })),
  };
}

function presentRow(
  node: GrokBotPlanShareNode,
  breakdown: readonly string[],
  depth: number,
): PresentedShareRow {
  const titled = titleFrom(node.fields, breakdown, depth);
  const note = typeof node.fields.note === 'string' ? node.fields.note : null;
  const runs = node.fields.runs_per_week_approx;
  const skip = new Set<string>(['paused', 'note', 'runs_per_week_approx', 'label']);
  const dimension = breakdown[depth];
  if (dimension) skip.add(dimension);
  if (titled.titleKey) skip.add(titled.titleKey);

  const extras = Object.keys(node.fields)
    .filter((key) => !skip.has(key))
    .sort()
    .map((key) => ({ key, value: formatFieldValue(node.fields[key]) }));

  return {
    title: titled.title,
    detail: titled.detail,
    shareLabel: formatSharePct(node.sharePct),
    barPct: shareBarWidth(node.sharePct),
    paused: node.fields.paused === true,
    note: note && note !== titled.title ? note : null,
    cadence: typeof runs === 'number' ? `≈ ${formatPlainNumber(runs)} / week` : null,
    extras,
    children: node.children.map((child) => presentRow(child, breakdown, depth + 1)),
  };
}

function titleFrom(
  fields: Readonly<Record<string, Scalar>>,
  breakdown: readonly string[],
  depth: number,
): { title: string; titleKey: string | null; detail: string | null } {
  const dimension = breakdown[depth] ?? null;
  const dimensionValue = dimension && typeof fields[dimension] === 'string'
    ? fields[dimension]
    : null;
  const label = typeof fields.label === 'string' ? fields.label : null;
  if (label) {
    return {
      title: label,
      titleKey: 'label',
      detail: dimensionValue && dimensionValue !== label ? dimensionValue : null,
    };
  }
  if (dimension && dimensionValue) {
    return { title: dimensionValue, titleKey: dimension, detail: null };
  }
  const fallback = fallbackField(fields);
  if (fallback) return { title: fallback.value, titleKey: fallback.key, detail: null };
  return { title: 'Share', titleKey: null, detail: null };
}

function fallbackField(
  fields: Readonly<Record<string, Scalar>>,
): { key: string; value: string } | null {
  const texts = Object.entries(fields).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );
  const preferred = texts.find(([key]) => key !== 'note' && key !== 'label');
  if (preferred) return { key: preferred[0], value: preferred[1] };
  const note = texts.find(([key]) => key === 'note');
  if (note) return { key: note[0], value: note[1] };
  return null;
}

function formatFieldValue(value: Scalar | undefined): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'number') return formatPlainNumber(value);
  return value;
}

function formatPlainNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded);
}

function canonicalNode(node: GrokBotPlanShareNode): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node.fields)) {
    out[key] = value;
  }
  out.share_pct = node.sharePct;
  if (node.children.length > 0) {
    out.children = node.children.map(canonicalNode);
  }
  return out;
}

function parseReports(
  value: unknown,
): { reports: GrokBotPlanReport[] } | { error: string } {
  if (!Array.isArray(value)) return { error: 'body.reports must be an array.' };
  if (value.length > MAX_REPORTS) {
    return { error: `body.reports must contain at most ${MAX_REPORTS} items.` };
  }
  const state: ParseState = { nodes: 0 };
  const reports: GrokBotPlanReport[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const parsed = parseReport(value[index], `body.reports[${index}]`, state);
    if ('error' in parsed) return parsed;
    reports.push(parsed.report);
  }
  return { reports };
}

function parseReport(
  value: unknown,
  path: string,
  state: ParseState,
): { report: GrokBotPlanReport } | { error: string } {
  if (!isRecord(value)) return { error: `${path} must be an object.` };
  const missing = requiredKey(value, REPORT_KEYS, path);
  if (missing) return { error: missing };
  const extra = unknownKey(value, REPORT_KEYS, path);
  if (extra) return { error: extra };

  const period = requireIdentifier(value.period, KEY_PATTERN, `${path}.period`);
  if ('error' in period) return { error: period.error };
  const periodLabel = requireText(value.period_label, 160, `${path}.period_label`);
  if ('error' in periodLabel) return { error: periodLabel.error };
  const breakdown = parseBreakdown(value.breakdown, `${path}.breakdown`);
  if (typeof breakdown === 'string') return { error: breakdown };
  if (!Array.isArray(value.rows)) return { error: `${path}.rows must be an array.` };
  if (value.rows.length > MAX_SHARE_NODES) {
    return { error: `${path}.rows exceeds the ${MAX_SHARE_NODES} share-row limit.` };
  }

  const rows: GrokBotPlanShareNode[] = [];
  for (let index = 0; index < value.rows.length; index += 1) {
    const row = parseNode(value.rows[index], `${path}.rows[${index}]`, 0, breakdown, state);
    if (typeof row === 'string') return { error: row };
    rows.push(row);
  }
  return {
    report: {
      period: period.text,
      periodLabel: periodLabel.text,
      breakdown,
      rows,
    },
  };
}

function parseNode(
  value: unknown,
  path: string,
  depth: number,
  breakdown: readonly string[],
  state: ParseState,
): GrokBotPlanShareNode | string {
  if (depth > MAX_DEPTH) return `${path} is nested too deeply.`;
  state.nodes += 1;
  if (state.nodes > MAX_SHARE_NODES) {
    return `${path} exceeds the ${MAX_SHARE_NODES} share-row limit.`;
  }
  if (!isRecord(value)) return `${path} must be an object.`;
  if (!Object.prototype.hasOwnProperty.call(value, 'share_pct')) {
    return `${path}.share_pct is required.`;
  }

  const share = parsePercent(value.share_pct, `${path}.share_pct`);
  if (typeof share === 'string') return share;

  const fields: Record<string, Scalar> = {};
  for (const [key, field] of Object.entries(value)) {
    if (key === 'share_pct' || key === 'children') continue;
    if (!KEY_PATTERN.test(key)) return `${path}.${key} is not an allowed field.`;
    const parsed = parseNodeField(key, field, path);
    if (!parsed.ok) return parsed.error;
    fields[key] = parsed.value;
  }
  if (Object.keys(fields).length > 16) return `${path} has too many fields.`;

  const dimension = breakdown[depth];
  if (dimension) {
    if (typeof fields[dimension] !== 'string') {
      return `${path}.${dimension} must be a non-empty string.`;
    }
  } else if (!Object.values(fields).some((field) => typeof field === 'string')) {
    return `${path} needs a name.`;
  }

  const children: GrokBotPlanShareNode[] = [];
  if (Object.prototype.hasOwnProperty.call(value, 'children')) {
    if (!Array.isArray(value.children)) return `${path}.children must be an array.`;
    if (value.children.length > MAX_SHARE_NODES) {
      return `${path}.children exceeds the ${MAX_SHARE_NODES} share-row limit.`;
    }
    for (let index = 0; index < value.children.length; index += 1) {
      const child = parseNode(
        value.children[index],
        `${path}.children[${index}]`,
        depth + 1,
        breakdown,
        state,
      );
      if (typeof child === 'string') return child;
      children.push(child);
    }
  }

  return { sharePct: share, fields, children };
}

function parseNodeField(key: string, value: unknown, path: string): ParsedField | FieldError {
  const fieldPath = `${path}.${key}`;
  if (key === 'paused') {
    if (typeof value !== 'boolean') {
      return { ok: false, error: `${fieldPath} must be a boolean.` };
    }
    return { ok: true, value };
  }
  if (key === 'runs_per_week_approx') {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100_000) {
      return { ok: false, error: `${fieldPath} must be a number from 0 to 100000.` };
    }
    return { ok: true, value };
  }
  if (key === 'note' || key === 'label') {
    const text = requireText(value, MAX_TEXT, fieldPath);
    if ('error' in text) return { ok: false, error: text.error };
    return { ok: true, value: text.text };
  }
  if (typeof value === 'boolean' || value === null) return { ok: true, value };
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Math.abs(value) > 1e12) {
      return { ok: false, error: `${fieldPath} must be a finite number.` };
    }
    return { ok: true, value };
  }
  if (typeof value === 'string') {
    const text = requireText(value, MAX_TEXT, fieldPath);
    if ('error' in text) return { ok: false, error: text.error };
    return { ok: true, value: text.text };
  }
  return { ok: false, error: `${fieldPath} must be a string, number, or boolean.` };
}

function parseBreakdown(value: unknown, path: string): string[] | string {
  if (!Array.isArray(value) || value.length === 0 || value.length > 6) {
    return `${path} must list 1 to 6 dimension names.`;
  }
  const names: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const name = value[index];
    if (typeof name !== 'string' || !KEY_PATTERN.test(name) || META_KEYS.has(name)) {
      return `${path}[${index}] is not a usable dimension.`;
    }
    if (names.includes(name)) return `${path}[${index}] is not a usable dimension.`;
    names.push(name);
  }
  return names;
}

function parseReset(
  value: unknown,
): { reset: GrokBotPlanUsage['resetAt'] } | { error: string } {
  if (!isRecord(value)) return { error: 'body.reset_at must be an object.' };
  const missing = requiredKey(value, RESET_KEYS, 'body.reset_at');
  if (missing) return { error: missing };
  const extra = unknownKey(value, RESET_KEYS, 'body.reset_at');
  if (extra) return { error: extra };
  if (typeof value.timezone !== 'string' || !ZONE_PATTERN.test(value.timezone)) {
    return { error: 'body.reset_at.timezone must be a time zone name.' };
  }
  const label = requireText(value.label, 120, 'body.reset_at.label');
  if ('error' in label) return { error: label.error };
  const iso = parseIso(value.iso_approx, 'body.reset_at.iso_approx');
  if (typeof iso === 'string') return { error: iso };
  return {
    reset: {
      timezone: value.timezone,
      label: label.text,
      isoApprox: iso.text,
    },
  };
}

function parseOnDemand(
  value: unknown,
): { onDemand: GrokBotPlanUsage['onDemand'] } | { error: string } {
  if (!isRecord(value)) return { error: 'body.on_demand must be an object.' };
  const missing = requiredKey(value, ON_DEMAND_KEYS, 'body.on_demand');
  if (missing) return { error: missing };
  const extra = unknownKey(value, ON_DEMAND_KEYS, 'body.on_demand');
  if (extra) return { error: extra };
  const monthlyLimit = parseNullableAmount(
    value.monthly_limit,
    'body.on_demand.monthly_limit',
  );
  if (typeof monthlyLimit === 'string') return { error: monthlyLimit };
  const amount = parseNullableAmount(value.amount, 'body.on_demand.amount');
  if (typeof amount === 'string') return { error: amount };
  return { onDemand: { monthlyLimit, amount } };
}

function parseNullableAmount(value: unknown, path: string): number | null | string {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e12) {
    return `${path} must be null or a non-negative number.`;
  }
  return value;
}

function parsePercent(value: unknown, path: string): number | string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return `${path} must be a finite number.`;
  }
  if (value < 0 || value > 100) return `${path} must be between 0 and 100.`;
  return value;
}

function parseIso(
  value: unknown,
  path: string,
): { text: string; ms: number } | string {
  const text = requireText(value, 40, path);
  if ('error' in text) return `${path} must be an ISO-8601 timestamp.`;
  if (!ISO_PATTERN.test(text.text)) return `${path} must be an ISO-8601 timestamp.`;
  const ms = Date.parse(text.text);
  if (!Number.isFinite(ms)) return `${path} must be an ISO-8601 timestamp.`;
  return { text: text.text, ms };
}

function requireIdentifier(
  value: unknown,
  pattern: RegExp,
  path: string,
): { text: string } | { error: string } {
  if (typeof value !== 'string' || !pattern.test(value)) {
    return { error: `${path} must be a lowercase identifier.` };
  }
  return { text: value };
}

function requireText(
  value: unknown,
  max: number,
  path: string,
): { text: string } | { error: string } {
  if (typeof value !== 'string') return { error: `${path} must be a non-empty string.` };
  const text = value.trim();
  if (text.length === 0 || hasControl(text)) {
    return { error: `${path} must be a non-empty string.` };
  }
  if (text.length > max) return { error: `${path} must be at most ${max} characters.` };
  return { text };
}

function requiredKey(
  record: Record<string, unknown>,
  keys: ReadonlySet<string>,
  path: string,
): string | null {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) {
      return `${path}.${key} is required.`;
    }
  }
  return null;
}

function unknownKey(
  record: Record<string, unknown>,
  keys: ReadonlySet<string>,
  path: string,
): string | null {
  for (const key of Object.keys(record)) {
    if (!keys.has(key)) return `${path}.${key} is not supported.`;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasControl(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 32 || code === 127) return true;
  }
  return false;
}
