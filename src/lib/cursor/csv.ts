import { createHash } from 'node:crypto';

export interface CursorCsvEvent {
  eventAt: number;
  cloudAgentId: string | null;
  automationId: string | null;
  kind: string;
  model: string;
  maxMode: boolean;
  tokensInputCacheWrite: number;
  tokensInput: number;
  tokensCacheRead: number;
  tokensOutput: number;
  tokensTotal: number;
  costRaw: string;
  reportedCost: number | null;
  eventHash: string;
}

export interface CursorCsvParseResult {
  events: CursorCsvEvent[];
  errors: string[];
  minEventAt: number | null;
  maxEventAt: number | null;
}

const REQUIRED_HEADERS = [
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
  const missing = REQUIRED_HEADERS.filter((h) => !header.includes(h));
  if (missing.length > 0) {
    return {
      events: [],
      errors: [`Missing required columns: ${missing.join(', ')}`],
      minEventAt: null,
      maxEventAt: null,
    };
  }

  const index = Object.fromEntries(
    REQUIRED_HEADERS.map((name) => [name, header.indexOf(name)]),
  ) as Record<(typeof REQUIRED_HEADERS)[number], number>;

  const events: CursorCsvEvent[] = [];
  const errors: string[] = [];
  let minEventAt: number | null = null;
  let maxEventAt: number | null = null;

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const rowNum = i + 1;
    try {
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

      const event: CursorCsvEvent = {
        eventAt,
        cloudAgentId: emptyToNull(cloudAgentIdRaw),
        automationId: emptyToNull(automationIdRaw),
        kind,
        model,
        maxMode: maxModeRaw.toLowerCase() === 'yes',
        tokensInputCacheWrite: parseTokenCount(tokensInputCacheWriteRaw),
        tokensInput: parseTokenCount(tokensInputRaw),
        tokensCacheRead: parseTokenCount(tokensCacheReadRaw),
        tokensOutput: parseTokenCount(tokensOutputRaw),
        tokensTotal: parseTokenCount(tokensTotalRaw),
        costRaw: costRaw || 'Included',
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
          costRaw: costRaw || 'Included',
        }),
      };

      events.push(event);
      minEventAt = minEventAt === null ? event.eventAt : Math.min(minEventAt, event.eventAt);
      maxEventAt = maxEventAt === null ? event.eventAt : Math.max(maxEventAt, event.eventAt);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Row ${rowNum}: ${message}`);
    }
  }

  return { events, errors, minEventAt, maxEventAt };
}
