import { createHash } from 'node:crypto';

import { GROK_BOT_DEFAULT_MODEL } from '@/lib/grok-bot/membership';
import type { CursorProduct, CursorUsageEvent } from '@/lib/cursor/usage-event';

/** @deprecated Prefer CursorUsageEvent from usage-event.ts */
export type CursorCsvEvent = CursorUsageEvent;

export interface CursorCsvParseResult {
  events: CursorUsageEvent[];
  errors: string[];
  minEventAt: number | null;
  maxEventAt: number | null;
}

const USAGE_EVENTS_HEADERS = [
  'Date',
  'Cloud Agent ID',
  'Automation ID',
  'Kind',
  'Model',
  'Max Mode',
  'Input (w/ Cache Write)',
  'Input (w/o Cache Write)',
  'Cache Read',
  'Output Tokens',
  'Total Tokens',
  'Cost',
] as const;

const BILLING_ITEMS_HEADERS = [
  'Billing Item ID',
  'Event Time',
  'Product',
  'Usage Type',
  'Usage',
  'Pricing Contracted',
  'Model',
] as const;

type CursorCsvFormat = 'usage-events' | 'billing-items';

const INCLUDED_COST_RAW = 'Included';

const BILLING_METER_KEYS = {
  'cache-write-text-tokens': 'tokensInputCacheWrite',
  'prompt-text-tokens': 'tokensInput',
  'cached-prompt-text-tokens': 'tokensCacheRead',
  'completion-text-tokens': 'tokensOutput',
} as const;

type MeterField = (typeof BILLING_METER_KEYS)[keyof typeof BILLING_METER_KEYS];

interface TokenMeters {
  tokensInputCacheWrite: number;
  tokensInput: number;
  tokensCacheRead: number;
  tokensOutput: number;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      fields.push(current);
      current = '';
      continue;
    }
    current += ch;
  }

  fields.push(current);
  return fields;
}

function parseCsvRows(text: string): string[][] {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').filter((line) => line.trim().length > 0);
  return lines.map(parseCsvLine);
}

function parseTokenCount(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const n = Number(trimmed.replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Invalid token count: ${value}`);
  }
  return Math.round(n);
}

function parseReportedCost(costRaw: string): number | null {
  const trimmed = costRaw.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (
    lower === 'included' ||
    lower === 'free' ||
    lower === 'errored, no charge' ||
    lower === '-'
  ) {
    return null;
  }

  const cleaned = trimmed.replace(/[$,]/g, '').trim();
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function parseBillingDecimal(contracted: string): number | null {
  const trimmed = contracted.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function hashCursorEvent(parts: {
  eventAtIso: string;
  cloudAgentId: string;
  automationId: string;
  kind: string;
  model: string;
  maxMode: string;
  tokensInputCacheWrite: string;
  tokensInput: string;
  tokensCacheRead: string;
  tokensOutput: string;
  tokensTotal: string;
  costRaw: string;
}): string {
  const payload = [
    parts.eventAtIso,
    parts.cloudAgentId,
    parts.automationId,
    parts.kind,
    parts.model,
    parts.maxMode,
    parts.tokensInputCacheWrite,
    parts.tokensInput,
    parts.tokensCacheRead,
    parts.tokensOutput,
    parts.tokensTotal,
    parts.costRaw,
  ].join('\0');

  return createHash('sha256').update(payload).digest('hex');
}

function hashBillingItemId(billingItemId: string): string {
  const trimmed = billingItemId.trim();
  if (!trimmed) {
    throw new Error('Missing Billing Item ID');
  }
  return createHash('sha256').update(`billing-item-id\0${trimmed}`).digest('hex');
}

function headerHits(header: readonly string[], required: readonly string[]): number {
  return required.filter((name) => header.includes(name)).length;
}

function detectCursorCsvFormat(
  header: readonly string[],
): CursorCsvFormat | { error: string } {
  const usageHits = headerHits(header, USAGE_EVENTS_HEADERS);
  const billingHits = headerHits(header, BILLING_ITEMS_HEADERS);

  if (usageHits === USAGE_EVENTS_HEADERS.length) {
    return 'usage-events';
  }
  if (billingHits === BILLING_ITEMS_HEADERS.length) {
    return 'billing-items';
  }

  const closer =
    billingHits >= usageHits ? BILLING_ITEMS_HEADERS : USAGE_EVENTS_HEADERS;
  const missing = closer.filter((name) => !header.includes(name));
  return {
    error: `Missing required columns for ${closer === BILLING_ITEMS_HEADERS ? 'billing-items' : 'usage-events'} export: ${missing.join(', ')}`,
  };
}

function parseCursorProduct(raw: string): CursorProduct {
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'cursor' || normalized === 'grok-bot') {
    return normalized;
  }
  throw new Error(`Unknown product: ${raw}`);
}

function parseBillingUsageMeters(usageJson: string): TokenMeters {
  const trimmed = usageJson.trim();
  const meters: TokenMeters = {
    tokensInputCacheWrite: 0,
    tokensInput: 0,
    tokensCacheRead: 0,
    tokensOutput: 0,
  };

  if (!trimmed || trimmed === '{}') {
    return meters;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('Invalid Usage JSON');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Invalid Usage JSON');
  }

  const record = parsed as Record<string, unknown>;
  for (const [key, field] of Object.entries(BILLING_METER_KEYS) as Array<
    [keyof typeof BILLING_METER_KEYS, MeterField]
  >) {
    const raw = record[key];
    if (raw === undefined) {
      continue;
    }
    if (typeof raw !== 'string' && typeof raw !== 'number') {
      throw new Error(`Invalid meter value for ${key}`);
    }
    const text = String(raw).trim();
    if (!text) {
      continue;
    }
    const n = Number(text.replace(/,/g, ''));
    if (!Number.isFinite(n) || n < 0) {
      throw new Error(`Invalid meter value for ${key}`);
    }
    meters[field] = Math.round(n);
  }

  return meters;
}

function mapBillingCost(
  usageType: string,
  pricingContracted: string,
): { costRaw: string; reportedCost: number | null } {
  const kindLower = usageType.trim().toLowerCase();
  const contractedText = pricingContracted.trim();

  if (kindLower === 'included') {
    const contracted = parseBillingDecimal(contractedText);
    if (contracted === null || contracted === 0) {
      return { costRaw: INCLUDED_COST_RAW, reportedCost: null };
    }
  }

  const reportedCost = parseBillingDecimal(contractedText);
  return {
    costRaw: contractedText || INCLUDED_COST_RAW,
    reportedCost,
  };
}

function resolveBillingModel(product: CursorProduct, modelRaw: string): string {
  const trimmed = modelRaw.trim();
  if (product === 'grok-bot') {
    return trimmed ? trimmed : GROK_BOT_DEFAULT_MODEL;
  }
  if (!trimmed) {
    throw new Error('Missing Model');
  }
  return trimmed;
}

function parseUsageEventsRow(
  row: readonly string[],
  index: Record<(typeof USAGE_EVENTS_HEADERS)[number], number>,
): {
  event: CursorUsageEvent;
  tokenMismatch: { csvTotal: number; componentTotal: number; tokensTotalRaw: string } | null;
} {
  const eventAtIso = (row[index.Date] ?? '').trim();
  const eventAt = Date.parse(eventAtIso);
  if (!Number.isFinite(eventAt)) {
    throw new Error(`Invalid date: ${eventAtIso}`);
  }

  const cloudAgentIdRaw = row[index['Cloud Agent ID']] ?? '';
  const automationIdRaw = row[index['Automation ID']] ?? '';
  const kind = (row[index.Kind] ?? '').trim();
  const model = (row[index.Model] ?? '').trim();
  const maxModeRaw = (row[index['Max Mode']] ?? '').trim();
  const tokensInputCacheWriteRaw = row[index['Input (w/ Cache Write)']] ?? '';
  const tokensInputRaw = row[index['Input (w/o Cache Write)']] ?? '';
  const tokensCacheReadRaw = row[index['Cache Read']] ?? '';
  const tokensOutputRaw = row[index['Output Tokens']] ?? '';
  const tokensTotalRaw = row[index['Total Tokens']] ?? '';
  const costRaw = (row[index.Cost] ?? '').trim();

  if (!kind) throw new Error('Missing Kind');
  if (!model) throw new Error('Missing Model');

  const tokensInputCacheWrite = parseTokenCount(tokensInputCacheWriteRaw);
  const tokensInput = parseTokenCount(tokensInputRaw);
  const tokensCacheRead = parseTokenCount(tokensCacheReadRaw);
  const tokensOutput = parseTokenCount(tokensOutputRaw);
  const csvTotal = parseTokenCount(tokensTotalRaw);
  const componentTotal =
    tokensInputCacheWrite + tokensInput + tokensCacheRead + tokensOutput;

  const tokenMismatch =
    csvTotal !== componentTotal && tokensTotalRaw.trim()
      ? { csvTotal, componentTotal, tokensTotalRaw }
      : null;

  return {
    tokenMismatch,
    event: {
      eventAt,
      cloudAgentId: emptyToNull(cloudAgentIdRaw),
      automationId: emptyToNull(automationIdRaw),
      kind,
      model,
      product: null,
      maxMode: maxModeRaw.toLowerCase() === 'yes',
      tokensInputCacheWrite,
      tokensInput,
      tokensCacheRead,
      tokensOutput,
      tokensTotal: componentTotal,
      costRaw: costRaw || INCLUDED_COST_RAW,
      reportedCost: parseReportedCost(costRaw),
      eventHash: hashCursorEvent({
        eventAtIso,
        cloudAgentId: cloudAgentIdRaw.trim(),
        automationId: automationIdRaw.trim(),
        kind,
        model,
        maxMode: maxModeRaw,
        tokensInputCacheWrite: tokensInputCacheWriteRaw.trim(),
        tokensInput: tokensInputRaw.trim(),
        tokensCacheRead: tokensCacheReadRaw.trim(),
        tokensOutput: tokensOutputRaw.trim(),
        tokensTotal: tokensTotalRaw.trim(),
        costRaw: costRaw || INCLUDED_COST_RAW,
      }),
    },
  };
}

function parseBillingItemsRow(
  row: readonly string[],
  index: Record<(typeof BILLING_ITEMS_HEADERS)[number], number>,
): CursorUsageEvent {
  const billingItemId = (row[index['Billing Item ID']] ?? '').trim();
  const eventAtIso = (row[index['Event Time']] ?? '').trim();
  const eventAt = Date.parse(eventAtIso);
  if (!Number.isFinite(eventAt)) {
    throw new Error(`Invalid Event Time: ${eventAtIso}`);
  }

  const product = parseCursorProduct(row[index.Product] ?? '');
  const usageType = (row[index['Usage Type']] ?? '').trim();
  if (!usageType) {
    throw new Error('Missing Usage Type');
  }

  const model = resolveBillingModel(product, row[index.Model] ?? '');
  const usageJson = row[index.Usage] ?? '';
  const meters = parseBillingUsageMeters(usageJson);
  const tokensTotal =
    meters.tokensInputCacheWrite +
    meters.tokensInput +
    meters.tokensCacheRead +
    meters.tokensOutput;

  const pricingContracted = row[index['Pricing Contracted']] ?? '';
  const { costRaw, reportedCost } = mapBillingCost(usageType, pricingContracted);

  return {
    eventAt,
    cloudAgentId: null,
    automationId: null,
    kind: usageType,
    model,
    product,
    maxMode: false,
    tokensInputCacheWrite: meters.tokensInputCacheWrite,
    tokensInput: meters.tokensInput,
    tokensCacheRead: meters.tokensCacheRead,
    tokensOutput: meters.tokensOutput,
    tokensTotal,
    costRaw,
    reportedCost,
    eventHash: hashBillingItemId(billingItemId),
  };
}

export function parseCursorUsageCsv(text: string): CursorCsvParseResult {
  const rows = parseCsvRows(text);
  if (rows.length === 0) {
    return {
      events: [],
      errors: ['CSV is empty'],
      minEventAt: null,
      maxEventAt: null,
    };
  }

  const header = rows[0].map((h) => h.trim());
  const format = detectCursorCsvFormat(header);
  if (typeof format !== 'string') {
    return {
      events: [],
      errors: [format.error],
      minEventAt: null,
      maxEventAt: null,
    };
  }

  const events: CursorUsageEvent[] = [];
  const errors: string[] = [];
  const bounds = { min: null as number | null, max: null as number | null };

  if (format === 'usage-events') {
    const index = Object.fromEntries(
      USAGE_EVENTS_HEADERS.map((name) => [name, header.indexOf(name)]),
    ) as Record<(typeof USAGE_EVENTS_HEADERS)[number], number>;

    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i];
      const rowNum = i + 1;
      try {
        const { event, tokenMismatch } = parseUsageEventsRow(row, index);
        if (tokenMismatch) {
          errors.push(
            `Row ${rowNum}: Total Tokens ${tokenMismatch.csvTotal} != component sum ${tokenMismatch.componentTotal}; using components`,
          );
        }
        events.push(event);
        bounds.min = bounds.min === null ? event.eventAt : Math.min(bounds.min, event.eventAt);
        bounds.max = bounds.max === null ? event.eventAt : Math.max(bounds.max, event.eventAt);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Row ${rowNum}: ${message}`);
      }
    }
  } else {
    const index = Object.fromEntries(
      BILLING_ITEMS_HEADERS.map((name) => [name, header.indexOf(name)]),
    ) as Record<(typeof BILLING_ITEMS_HEADERS)[number], number>;

    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i];
      const rowNum = i + 1;
      try {
        const event = parseBillingItemsRow(row, index);
        events.push(event);
        bounds.min = bounds.min === null ? event.eventAt : Math.min(bounds.min, event.eventAt);
        bounds.max = bounds.max === null ? event.eventAt : Math.max(bounds.max, event.eventAt);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Row ${rowNum}: ${message}`);
      }
    }
  }

  return {
    events,
    errors,
    minEventAt: bounds.min,
    maxEventAt: bounds.max,
  };
}
