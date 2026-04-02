/**
 * extract-tool-payload-types.ts
 *
 * Standalone script that queries every tool_call + tool_payload row from the
 * Turso database, analyses the structural shapes of input/output payloads for
 * each tool, and writes two reports:
 *
 *   tmp/tool-payload-types.json   – machine-readable
 *   tmp/tool-payload-types.md     – human-readable markdown
 *
 * Run:
 *   node --import tsx scripts/extract-tool-payload-types.ts
 */

import { createClient } from '@libsql/client';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// ---------------------------------------------------------------------------
// 0. Env + DB client
// ---------------------------------------------------------------------------

process.loadEnvFile('.env.local');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// ---------------------------------------------------------------------------
// 1. Report types
// ---------------------------------------------------------------------------

interface ExampleRef {
  toolCallId: string;
  tool: string;
  truncatedPayload: string;
}

interface PayloadShapeReport {
  signature: string;
  kind: 'json' | 'text' | 'null';
  textKind?: string;
  count: number;
  examples: ExampleRef[];
  fieldStats?: Record<string, string[]>;
  rendererProposal: string;
}

interface ToolReport {
  tool: string;
  totalCalls: number;
  inputShapes: PayloadShapeReport[];
  outputShapes: PayloadShapeReport[];
}

interface ToolPayloadTypeReport {
  generatedAt: string;
  totalToolCalls: number;
  tools: ToolReport[];
}

// ---------------------------------------------------------------------------
// 2. Type inference helpers
// ---------------------------------------------------------------------------

function inferType(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'array<empty>';
    const elementTypes = [...new Set(value.map(inferType))].sort();
    return `array<${elementTypes.join(' | ')}>`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    const entries = keys.map((k) => `${k}:${inferType((value as Record<string, unknown>)[k])}`);
    return `object{${entries.join(', ')}}`;
  }
  return 'unknown';
}

function inferSignature(content: string | null): { signature: string; kind: 'json' | 'text' | 'null'; parsed: unknown } {
  if (content === null || content === undefined || content === '') {
    return { signature: 'null', kind: 'null', parsed: null };
  }

  // Try JSON parse
  const trimmed = content.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed === 'true' || trimmed === 'false' || trimmed === 'null') {
    try {
      const parsed = JSON.parse(trimmed);
      return { signature: inferType(parsed), kind: 'json', parsed };
    } catch {
      // fall through to text
    }
  }

  return { signature: 'text', kind: 'text', parsed: content };
}

// ---------------------------------------------------------------------------
// 3. Text heuristics
// ---------------------------------------------------------------------------

function classifyText(text: string): string {
  const t = text.trim();

  // Diff / patch
  if (/^(---|\+\+\+|diff --git|@@\s)/.test(t) || /^[-+]{3}\s/.test(t)) return 'diff-patch';
  if (/^[+-]\s/.test(t) && /\n[+-]\s/.test(t)) return 'diff-patch';

  // Markdown checklist
  if (/^[-*]\s\[[ x]\]/m.test(t)) return 'markdown-checklist';

  // XML / file attachment (common in tool outputs like Read)
  if (t.startsWith('<') && (t.includes('<path>') || t.includes('<content>') || t.includes('<type>'))) return 'xml-file-attachment';

  // Stack trace
  if (/at\s+\S+\s+\(/.test(t) || /^\s+at\s+/.test(t) || /Error:.*\n\s+at\s/.test(t)) return 'stack-trace';

  // ANSI / terminal log output
  const ansiRegex = new RegExp(String.raw`\x1b\[`);
  if (ansiRegex.test(t) || /\[\d{2}:\d{2}:\d{2}\]/.test(t)) return 'terminal-log';

  // Shell command (starts with common shell patterns)
  if (/^(ls|cd|cat|grep|find|mkdir|rm|cp|mv|git|npm|pnpm|bun|node|python|curl|wget|docker)\s/m.test(t)) return 'shell-command';

  // URL
  if (/^https?:\/\/\S+$/.test(t)) return 'url';

  // Key-value blocks
  if (/^\w[\w\s]*:\s*.+$/m.test(t) && (t.match(/^\w[\w\s]*:\s*.+$/gm) || []).length >= 3) return 'key-value-block';

  // Code fence
  if (/^```/.test(t)) return 'code-fence';

  // Tabular / JSON-like lines
  if (t.split('\n').filter((l) => l.trim().startsWith('{')).length > 2) return 'json-lines';

  // Markdown with headers
  if (/^#{1,6}\s/.test(t)) return 'markdown';

  // File path
  if (/^\/[\w./-]+$/.test(t) || /^[A-Z]:\\/.test(t)) return 'file-path';

  // Multi-line plain text
  if (t.includes('\n')) return 'multi-line-text';

  return 'plain-text';
}

// ---------------------------------------------------------------------------
// 4. Renderer proposal mapping
// ---------------------------------------------------------------------------

function proposeRenderer(tool: string, side: 'input' | 'output', kind: 'json' | 'text' | 'null', textKind: string | undefined, signature: string): string {
  // Tool-specific overrides first
  const toolRenderers: Record<string, Record<string, string>> = {
    bash: {
      input: 'command-card',
      output: 'terminal-log',
    },
    read: {
      input: 'path-request',
      output: 'file-preview',
    },
    edit: {
      input: 'patch-preview',
      output: 'patch-result',
    },
    write: {
      input: 'file-preview',
      output: 'write-result',
    },
    glob: {
      input: 'search-query',
      output: 'path-list',
    },
    grep: {
      input: 'search-query',
      output: 'search-results',
    },
    todowrite: {
      input: 'todo-list',
      output: 'todo-result',
    },
    task: {
      input: 'task-card',
      output: 'task-result',
    },
    webfetch: {
      input: 'url-fetch',
      output: 'markdown-output',
    },
    question: {
      input: 'questionnaire',
      output: 'questionnaire-result',
    },
  };

  const toolSpecific = toolRenderers[tool]?.[side];
  if (toolSpecific) return toolSpecific;

  if (kind === 'null') return 'raw-fallback';

  // Text-kind based
  if (textKind) {
    const textRenderers: Record<string, string> = {
      'diff-patch': 'patch-preview',
      'markdown-checklist': 'checklist',
      'xml-file-attachment': 'file-preview',
      'stack-trace': 'terminal-log',
      'terminal-log': 'terminal-log',
      'shell-command': 'command-card',
      'url': 'url-fetch',
      'key-value-block': 'key-value-card',
      'code-fence': 'code-preview',
      'json-lines': 'json-inspector',
      'markdown': 'markdown-output',
      'file-path': 'path-request',
      'multi-line-text': 'markdown-output',
      'plain-text': 'raw-fallback',
    };
    return textRenderers[textKind] || 'raw-fallback';
  }

  // JSON kind
  if (kind === 'json') {
    if (signature.startsWith('array')) return 'table-output';
    if (signature.startsWith('object')) return 'json-inspector';
    return 'json-inspector';
  }

  return 'raw-fallback';
}

// ---------------------------------------------------------------------------
// 5. Field stats collector
// ---------------------------------------------------------------------------

function collectFieldStats(parsed: unknown): Record<string, string> | undefined {
  if (parsed === null || parsed === undefined || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return undefined;
  }
  const obj = parsed as Record<string, unknown>;
  const stats: Record<string, string> = {};
  for (const [key, val] of Object.entries(obj)) {
    stats[key] = inferType(val);
  }
  return stats;
}

// ---------------------------------------------------------------------------
// 6. Shape grouping key
// ---------------------------------------------------------------------------

function shapeKey(signature: string, kind: 'json' | 'text' | 'null', textKind?: string): string {
  return `${kind}::${signature}::${textKind || ''}`;
}

// ---------------------------------------------------------------------------
// 7. Main extraction logic
// ---------------------------------------------------------------------------

interface RawRow {
  id: string;
  tool: string;
  status: string;
  title: string | null;
  error: string | null;
  response_id: string;
  root_session_id: string;
  started_at: number | null;
  completed_at: number | null;
  session_title: string | null;
  worktree: string | null;
  input_content: string | null;
  output_content: string | null;
}

function truncate(s: string | null, maxLen: number = 500): string {
  if (!s) return '';
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + `... [truncated, ${s.length} chars total]`;
}

async function main() {
  console.log('Querying tool_calls + tool_payloads...');

  const result = await db.execute(`
    SELECT
      tc.id,
      tc.tool,
      tc.status,
      tc.title,
      tc.error,
      tc.response_id,
      tc.root_session_id,
      tc.started_at,
      tc.completed_at,
      s.title AS session_title,
      p.worktree,
      in_payload.content AS input_content,
      out_payload.content AS output_content
    FROM tool_calls tc
    LEFT JOIN tool_payloads in_payload
      ON in_payload.tool_call_id = tc.id
     AND in_payload.payload_type = 'input'
    LEFT JOIN tool_payloads out_payload
      ON out_payload.tool_call_id = tc.id
     AND out_payload.payload_type = 'output'
    LEFT JOIN sessions s
      ON s.id = tc.root_session_id
    LEFT JOIN projects p
      ON p.id = s.project_id
    ORDER BY COALESCE(tc.started_at, tc.completed_at), tc.id
  `);

  const rows: RawRow[] = result.rows.map((row) => {
    const obj: Record<string, unknown> = {};
    for (const col of result.columns) {
      obj[col] = row[col];
    }
    return obj as unknown as RawRow;
  });

  console.log(`Fetched ${rows.length} tool call rows.`);

  // Group by tool
  const toolGroups = new Map<string, RawRow[]>();
  for (const row of rows) {
    const tool = row.tool || '_unknown';
    if (!toolGroups.has(tool)) toolGroups.set(tool, []);
    toolGroups.get(tool)!.push(row);
  }

  // Analyse each tool
  const toolReports: ToolReport[] = [];

  for (const [tool, toolRows] of [...toolGroups.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const inputShapes = new Map<string, {
      signature: string;
      kind: 'json' | 'text' | 'null';
      textKind?: string;
      count: number;
      examples: ExampleRef[];
      fieldStatsAccum: Map<string, Set<string>>;
    }>();

    const outputShapes = new Map<string, {
      signature: string;
      kind: 'json' | 'text' | 'null';
      textKind?: string;
      count: number;
      examples: ExampleRef[];
      fieldStatsAccum: Map<string, Set<string>>;
    }>();

    for (const row of toolRows) {
      // --- Input ---
      const inResult = inferSignature(row.input_content as string | null);
      const inTextKind = inResult.kind === 'text' ? classifyText(row.input_content!) : undefined;
      const inKey = shapeKey(inResult.signature, inResult.kind, inTextKind);

      if (!inputShapes.has(inKey)) {
        inputShapes.set(inKey, {
          signature: inResult.signature,
          kind: inResult.kind,
          textKind: inTextKind,
          count: 0,
          examples: [],
          fieldStatsAccum: new Map(),
        });
      }
      const inShape = inputShapes.get(inKey)!;
      inShape.count++;
      if (inShape.examples.length < 3) {
        inShape.examples.push({
          toolCallId: row.id,
          tool: row.tool,
          truncatedPayload: truncate(row.input_content),
        });
      }
      // Collect field stats for JSON objects
      if (inResult.kind === 'json' && inResult.parsed && typeof inResult.parsed === 'object' && !Array.isArray(inResult.parsed)) {
        const fields = collectFieldStats(inResult.parsed);
        if (fields) {
          for (const [k, v] of Object.entries(fields)) {
            if (!inShape.fieldStatsAccum.has(k)) inShape.fieldStatsAccum.set(k, new Set());
            inShape.fieldStatsAccum.get(k)!.add(v);
          }
        }
      }

      // --- Output ---
      const outResult = inferSignature(row.output_content as string | null);
      const outTextKind = outResult.kind === 'text' ? classifyText(row.output_content!) : undefined;
      const outKey = shapeKey(outResult.signature, outResult.kind, outTextKind);

      if (!outputShapes.has(outKey)) {
        outputShapes.set(outKey, {
          signature: outResult.signature,
          kind: outResult.kind,
          textKind: outTextKind,
          count: 0,
          examples: [],
          fieldStatsAccum: new Map(),
        });
      }
      const outShape = outputShapes.get(outKey)!;
      outShape.count++;
      if (outShape.examples.length < 3) {
        outShape.examples.push({
          toolCallId: row.id,
          tool: row.tool,
          truncatedPayload: truncate(row.output_content),
        });
      }
      if (outResult.kind === 'json' && outResult.parsed && typeof outResult.parsed === 'object' && !Array.isArray(outResult.parsed)) {
        const fields = collectFieldStats(outResult.parsed);
        if (fields) {
          for (const [k, v] of Object.entries(fields)) {
            if (!outShape.fieldStatsAccum.has(k)) outShape.fieldStatsAccum.set(k, new Set());
            outShape.fieldStatsAccum.get(k)!.add(v);
          }
        }
      }
    }

    // Finalize shapes
    function finalizeShapes(shapesMap: Map<string, {
      signature: string;
      kind: 'json' | 'text' | 'null';
      textKind?: string;
      count: number;
      examples: ExampleRef[];
      fieldStatsAccum: Map<string, Set<string>>;
    }>, side: 'input' | 'output'): PayloadShapeReport[] {
      return [...shapesMap.values()]
        .sort((a, b) => b.count - a.count)
        .map((shape) => {
          const fieldStats: Record<string, string[]> | undefined =
            shape.fieldStatsAccum.size > 0
              ? Object.fromEntries(
                  [...shape.fieldStatsAccum.entries()].map(([k, v]) => [k, [...v].sort()]),
                )
              : undefined;

          return {
            signature: shape.signature,
            kind: shape.kind,
            ...(shape.textKind ? { textKind: shape.textKind } : {}),
            count: shape.count,
            examples: shape.examples,
            ...(fieldStats ? { fieldStats } : {}),
            rendererProposal: proposeRenderer(tool, side, shape.kind, shape.textKind, shape.signature),
          };
        });
    }

    toolReports.push({
      tool,
      totalCalls: toolRows.length,
      inputShapes: finalizeShapes(inputShapes, 'input'),
      outputShapes: finalizeShapes(outputShapes, 'output'),
    });
  }

  const report: ToolPayloadTypeReport = {
    generatedAt: new Date().toISOString(),
    totalToolCalls: rows.length,
    tools: toolReports,
  };

  // ---------------------------------------------------------------------------
  // 8. Write JSON output
  // ---------------------------------------------------------------------------

  mkdirSync(resolve('tmp'), { recursive: true });

  const jsonPath = resolve('tmp/tool-payload-types.json');
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`Wrote JSON report: ${jsonPath}`);

  // ---------------------------------------------------------------------------
  // 9. Write Markdown output
  // ---------------------------------------------------------------------------

  const md = generateMarkdown(report);
  const mdPath = resolve('tmp/tool-payload-types.md');
  writeFileSync(mdPath, md, 'utf-8');
  console.log(`Wrote Markdown report: ${mdPath}`);

  console.log('\nDone!');
}

// ---------------------------------------------------------------------------
// 10. Markdown generator
// ---------------------------------------------------------------------------

function generateMarkdown(report: ToolPayloadTypeReport): string {
  const lines: string[] = [];
  const w = (...args: string[]) => lines.push(args.join(''));

  w('# Tool Payload Type Report');
  w('');
  w(`Generated: ${report.generatedAt}`);
  w('');

  // --- Global summary ---
  w('## Global Summary');
  w('');
  w(`- **Total tool calls**: ${report.totalToolCalls.toLocaleString()}`);
  w(`- **Distinct tools**: ${report.tools.length}`);
  w('');

  w('### Tools by call count');
  w('');
  w('| Tool | Calls | % of total |');
  w('|------|------:|----------:|');
  for (const t of report.tools) {
    const pct = ((t.totalCalls / report.totalToolCalls) * 100).toFixed(1);
    w(`| \`${t.tool}\` | ${t.totalCalls.toLocaleString()} | ${pct}% |`);
  }
  w('');

  // --- Top shapes across all tools ---
  w('### Top input shapes (across all tools)');
  w('');
  const allInputShapes: { tool: string; shape: PayloadShapeReport }[] = [];
  for (const t of report.tools) {
    for (const s of t.inputShapes) {
      allInputShapes.push({ tool: t.tool, shape: s });
    }
  }
  allInputShapes.sort((a, b) => b.shape.count - a.shape.count);

  w('| Tool | Kind | TextKind | Signature (truncated) | Count | Renderer |');
  w('|------|------|----------|-----------------------|------:|----------|');
  for (const { tool, shape } of allInputShapes.slice(0, 20)) {
    const sig = shape.signature.length > 60 ? shape.signature.slice(0, 60) + '...' : shape.signature;
    w(`| \`${tool}\` | ${shape.kind} | ${shape.textKind || '-'} | \`${sig}\` | ${shape.count} | \`${shape.rendererProposal}\` |`);
  }
  w('');

  w('### Top output shapes (across all tools)');
  w('');
  const allOutputShapes: { tool: string; shape: PayloadShapeReport }[] = [];
  for (const t of report.tools) {
    for (const s of t.outputShapes) {
      allOutputShapes.push({ tool: t.tool, shape: s });
    }
  }
  allOutputShapes.sort((a, b) => b.shape.count - a.shape.count);

  w('| Tool | Kind | TextKind | Signature (truncated) | Count | Renderer |');
  w('|------|------|----------|-----------------------|------:|----------|');
  for (const { tool, shape } of allOutputShapes.slice(0, 20)) {
    const sig = shape.signature.length > 60 ? shape.signature.slice(0, 60) + '...' : shape.signature;
    w(`| \`${tool}\` | ${shape.kind} | ${shape.textKind || '-'} | \`${sig}\` | ${shape.count} | \`${shape.rendererProposal}\` |`);
  }
  w('');

  // --- Per-tool sections ---
  w('---');
  w('');
  w('## Per-Tool Breakdown');
  w('');

  for (const t of report.tools) {
    w(`### \`${t.tool}\` (${t.totalCalls.toLocaleString()} calls)`);
    w('');

    // Input shapes
    w('#### Input shapes');
    w('');
    if (t.inputShapes.length === 0) {
      w('_No input payloads found._');
    } else {
      for (const shape of t.inputShapes) {
        const pct = ((shape.count / t.totalCalls) * 100).toFixed(1);
        w(`**${shape.kind}${shape.textKind ? ` / ${shape.textKind}` : ''}** - ${shape.count} occurrences (${pct}%) -> \`${shape.rendererProposal}\``);
        w('');

        // Signature
        if (shape.signature !== 'null' && shape.signature !== 'text') {
          w(`Signature: \`${shape.signature.length > 200 ? shape.signature.slice(0, 200) + '...' : shape.signature}\``);
          w('');
        }

        // Field stats
        if (shape.fieldStats) {
          w('<details><summary>Field types</summary>');
          w('');
          for (const [field, types] of Object.entries(shape.fieldStats)) {
            w(`- \`${field}\`: ${types.join(', ')}`);
          }
          w('');
          w('</details>');
          w('');
        }

        // Examples
        if (shape.examples.length > 0) {
          w('<details><summary>Examples</summary>');
          w('');
          for (const ex of shape.examples) {
            w(`**Tool call**: \`${ex.toolCallId}\``);
            w('```');
            w(ex.truncatedPayload);
            w('```');
            w('');
          }
          w('</details>');
          w('');
        }
      }
    }

    // Output shapes
    w('#### Output shapes');
    w('');
    if (t.outputShapes.length === 0) {
      w('_No output payloads found._');
    } else {
      for (const shape of t.outputShapes) {
        const pct = ((shape.count / t.totalCalls) * 100).toFixed(1);
        w(`**${shape.kind}${shape.textKind ? ` / ${shape.textKind}` : ''}** - ${shape.count} occurrences (${pct}%) -> \`${shape.rendererProposal}\``);
        w('');

        if (shape.signature !== 'null' && shape.signature !== 'text') {
          w(`Signature: \`${shape.signature.length > 200 ? shape.signature.slice(0, 200) + '...' : shape.signature}\``);
          w('');
        }

        if (shape.fieldStats) {
          w('<details><summary>Field types</summary>');
          w('');
          for (const [field, types] of Object.entries(shape.fieldStats)) {
            w(`- \`${field}\`: ${types.join(', ')}`);
          }
          w('');
          w('</details>');
          w('');
        }

        if (shape.examples.length > 0) {
          w('<details><summary>Examples</summary>');
          w('');
          for (const ex of shape.examples) {
            w(`**Tool call**: \`${ex.toolCallId}\``);
            w('```');
            w(ex.truncatedPayload);
            w('```');
            w('');
          }
          w('</details>');
          w('');
        }
      }
    }

    w('---');
    w('');
  }

  // --- Renderer proposal summary ---
  w('## Renderer Proposal Summary');
  w('');
  const rendererCounts = new Map<string, { tools: Set<string>; totalCount: number }>();
  for (const t of report.tools) {
    for (const shapes of [t.inputShapes, t.outputShapes]) {
      for (const s of shapes) {
        if (!rendererCounts.has(s.rendererProposal)) {
          rendererCounts.set(s.rendererProposal, { tools: new Set(), totalCount: 0 });
        }
        const entry = rendererCounts.get(s.rendererProposal)!;
        entry.tools.add(t.tool);
        entry.totalCount += s.count;
      }
    }
  }

  const sortedRenderers = [...rendererCounts.entries()].sort((a, b) => b[1].totalCount - a[1].totalCount);

  w('| Renderer | Total payloads | Tools |');
  w('|----------|---------------:|-------|');
  for (const [renderer, { tools, totalCount }] of sortedRenderers) {
    w(`| \`${renderer}\` | ${totalCount.toLocaleString()} | ${[...tools].sort().map((t) => `\`${t}\``).join(', ')} |`);
  }
  w('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
