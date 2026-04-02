/**
 * Tool rendering registry.
 *
 * Maps (tool, side) pairs to parser functions that produce ToolArtifacts.
 * This is the single entry point that replaces the old `formatToolInput()`
 * and `shouldHideOutput()` logic from the session detail page.
 *
 * Pure logic -- no React, no JSX.
 */

import type { ToolArtifact, ToolRendererResult } from '@/lib/tool-artifacts';
import {
  parseJson,
  shortenPath,
  detectLanguageFromPath,
  parseReadEnvelope,
  parseDirectoryEntries,
  parseGrepOutput,
  parseSearchCards,
  parseTodoArray,
  parseQuestions,
  parseQuestionAnswers,
  parsePatchEnvelope,
  looksLikeError,
} from '@/lib/tool-parsers';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ToolPayloadContext {
  tool: string;
  side: 'input' | 'output';
  raw: string | null;
  /** The raw payload of the *other* side, used for dedup (e.g. todowrite). */
  otherRaw?: string | null;
}

/**
 * Parse a tool payload into a renderer result.
 *
 * Returns `{ artifact: null }` when the payload is empty/null.
 * Returns `{ hide: true }` when the section should not be shown.
 */
export function renderToolPayload(ctx: ToolPayloadContext): ToolRendererResult {
  if (ctx.raw === null || ctx.raw === undefined || ctx.raw === '') {
    return { artifact: null };
  }

  // Try tool-specific handler first
  const handler = ctx.side === 'input'
    ? INPUT_REGISTRY[ctx.tool]
    : OUTPUT_REGISTRY[ctx.tool];

  if (handler) {
    const result = handler(ctx.raw, ctx);
    if (result) return result;
  }

  // Fallback: generic handler
  return ctx.side === 'input'
    ? genericInput(ctx.raw)
    : genericOutput(ctx.raw);
}

// ---------------------------------------------------------------------------
// Handler type
// ---------------------------------------------------------------------------

type PayloadHandler = (
  raw: string,
  ctx: ToolPayloadContext,
) => ToolRendererResult | null;

// ---------------------------------------------------------------------------
// Input registry
// ---------------------------------------------------------------------------

const INPUT_REGISTRY: Record<string, PayloadHandler> = {
  bash: bashInput,
  read: readInput,
  edit: editInput,
  write: writeInput,
  glob: globInput,
  grep: grepInput,
  task: taskInput,
  webfetch: webfetchInput,
  todowrite: todowriteInput,
  todoread: statusInput('Read todo list'),
  question: questionInput,
  apply_patch: applyPatchInput,
  list: listInput,
  grepapp_searchGitHub: searchQueryInput,
  'context7_query-docs': searchQueryInput,
  'context7_resolve-library-id': searchQueryInput,
  exa_web_search_exa: searchQueryInput,
  exa_get_code_context_exa: searchQueryInput,
  exa_crawling_exa: crawlInput,
  websearch: searchQueryInput,
  codesearch: searchQueryInput,
  playwriter_execute: playwriterInput,
  playwriter_reset: statusInput('Reset browser connection'),
  'migrate-usage': statusInput('Migrate usage data'),
  invalid: invalidInput,
};

// ---------------------------------------------------------------------------
// Output registry
// ---------------------------------------------------------------------------

const OUTPUT_REGISTRY: Record<string, PayloadHandler> = {
  bash: bashOutput,
  read: readOutput,
  edit: editOutput,
  write: statusOutput,
  glob: globOutput,
  grep: grepOutput,
  task: documentOutput,
  webfetch: documentOutput,
  todowrite: todowriteOutput,
  todoread: todoreadOutput,
  question: questionOutput,
  apply_patch: applyPatchOutput,
  list: listOutput,
  grepapp_searchGitHub: searchCardsOutput,
  'context7_query-docs': documentOutput,
  'context7_resolve-library-id': documentOutput,
  exa_web_search_exa: searchCardsOutput,
  exa_get_code_context_exa: searchCardsOutput,
  exa_crawling_exa: documentOutput,
  websearch: searchCardsOutput,
  codesearch: searchCardsOutput,
  playwriter_execute: playwriterOutput,
  playwriter_reset: statusOutput,
  'migrate-usage': statusOutput,
  invalid: errorOutput,
};

// ---------------------------------------------------------------------------
// P0 Input handlers
// ---------------------------------------------------------------------------

function bashInput(raw: string): ToolRendererResult | null {
  const parsed = parseJson(raw) as Record<string, unknown> | null;
  if (!parsed || !parsed.command) return null;
  return {
    artifact: {
      type: 'command',
      command: String(parsed.command),
      workdir: parsed.workdir ? shortenPath(String(parsed.workdir)) : undefined,
      description: parsed.description ? String(parsed.description) : undefined,
      timeout: typeof parsed.timeout === 'number' ? parsed.timeout : undefined,
    },
  };
}

function readInput(raw: string): ToolRendererResult | null {
  const parsed = parseJson(raw) as Record<string, unknown> | null;
  if (!parsed || !parsed.filePath) return null;
  return {
    artifact: {
      type: 'file-request',
      path: shortenPath(String(parsed.filePath)),
      offset: typeof parsed.offset === 'number' ? parsed.offset : undefined,
      limit: typeof parsed.limit === 'number' ? parsed.limit : undefined,
    },
  };
}

function editInput(raw: string): ToolRendererResult | null {
  const parsed = parseJson(raw) as Record<string, unknown> | null;
  if (!parsed || !parsed.filePath) return null;
  return {
    artifact: {
      type: 'diff',
      path: shortenPath(String(parsed.filePath)),
      oldText: parsed.oldString != null ? String(parsed.oldString) : undefined,
      newText: parsed.newString != null ? String(parsed.newString) : undefined,
      replaceAll: parsed.replaceAll === true ? true : undefined,
    },
  };
}

function writeInput(raw: string): ToolRendererResult | null {
  const parsed = parseJson(raw) as Record<string, unknown> | null;
  if (!parsed || !parsed.filePath) return null;
  const path = String(parsed.filePath);
  return {
    artifact: {
      type: 'file-preview',
      path: shortenPath(path),
      language: detectLanguageFromPath(path),
      content: parsed.content != null ? String(parsed.content) : '',
      truncated: typeof parsed.content === 'string' && parsed.content.length > 5000,
    },
  };
}

function globInput(raw: string): ToolRendererResult | null {
  const parsed = parseJson(raw) as Record<string, unknown> | null;
  if (!parsed || !parsed.pattern) return null;
  return {
    artifact: {
      type: 'search-query',
      query: String(parsed.pattern),
      path: parsed.path ? shortenPath(String(parsed.path)) : undefined,
    },
  };
}

function grepInput(raw: string): ToolRendererResult | null {
  const parsed = parseJson(raw) as Record<string, unknown> | null;
  if (!parsed || !parsed.pattern) return null;
  return {
    artifact: {
      type: 'search-query',
      query: String(parsed.pattern),
      include: parsed.include ? String(parsed.include) : undefined,
      path: parsed.path ? shortenPath(String(parsed.path)) : undefined,
    },
  };
}

function taskInput(raw: string): ToolRendererResult | null {
  const parsed = parseJson(raw) as Record<string, unknown> | null;
  if (!parsed) return null;
  const meta: Record<string, string> = {};
  if (parsed.subagent_type) meta['agent'] = String(parsed.subagent_type);
  if (parsed.task_id) meta['resume'] = String(parsed.task_id);
  return {
    artifact: {
      type: 'search-query',
      query: parsed.description ? String(parsed.description) : '',
      meta: Object.keys(meta).length > 0 ? meta : undefined,
    },
    defaultExpanded: true,
  };
}

function webfetchInput(raw: string): ToolRendererResult | null {
  const parsed = parseJson(raw) as Record<string, unknown> | null;
  if (!parsed || !parsed.url) return null;
  return {
    artifact: {
      type: 'search-query',
      query: String(parsed.url),
      url: String(parsed.url),
      format: parsed.format ? String(parsed.format) : undefined,
    },
  };
}

function todowriteInput(raw: string): ToolRendererResult | null {
  const parsed = parseJson(raw) as Record<string, unknown> | null;
  if (!parsed || !Array.isArray(parsed.todos)) return null;
  return {
    artifact: {
      type: 'todo-list',
      todos: parseTodoArray(parsed.todos),
    },
  };
}

function questionInput(raw: string): ToolRendererResult | null {
  const parsed = parseJson(raw) as Record<string, unknown> | null;
  if (!parsed || !Array.isArray(parsed.questions)) return null;
  return {
    artifact: {
      type: 'qa',
      questions: parseQuestions(parsed.questions),
    },
    defaultExpanded: true,
  };
}

function applyPatchInput(raw: string): ToolRendererResult | null {
  const parsed = parseJson(raw) as Record<string, unknown> | null;
  if (!parsed || !parsed.patchText) return null;
  const patchText = String(parsed.patchText);
  const files = parsePatchEnvelope(patchText);
  return {
    artifact: {
      type: 'diff',
      patchText,
    },
    // Include parsed file ops for the renderer to summarise in the header
    ...(files.length > 0 ? {} : {}),
  };
}

function listInput(raw: string): ToolRendererResult | null {
  const parsed = parseJson(raw) as Record<string, unknown> | null;
  if (!parsed || !parsed.path) return null;
  return {
    artifact: {
      type: 'file-request',
      path: shortenPath(String(parsed.path)),
    },
  };
}

// ---------------------------------------------------------------------------
// P1 Input handlers
// ---------------------------------------------------------------------------

/** Generic search/query input for MCP tools. */
function searchQueryInput(raw: string): ToolRendererResult | null {
  const parsed = parseJson(raw) as Record<string, unknown> | null;
  if (!parsed) return null;

  const query = parsed.query ? String(parsed.query) : '';
  const meta: Record<string, string> = {};
  if (parsed.libraryId) meta['library'] = String(parsed.libraryId);
  if (parsed.libraryName) meta['library'] = String(parsed.libraryName);
  if (parsed.repo) meta['repo'] = String(parsed.repo);
  if (parsed.path) meta['path'] = String(parsed.path);
  if (parsed.numResults) meta['results'] = String(parsed.numResults);
  if (Array.isArray(parsed.language)) {
    meta['language'] = (parsed.language as string[]).join(', ');
  }

  return {
    artifact: {
      type: 'search-query',
      query,
      repo: parsed.repo ? String(parsed.repo) : undefined,
      language: Array.isArray(parsed.language) ? parsed.language as string[] : undefined,
      meta: Object.keys(meta).length > 0 ? meta : undefined,
    },
  };
}

function crawlInput(raw: string): ToolRendererResult | null {
  const parsed = parseJson(raw) as Record<string, unknown> | null;
  if (!parsed) return null;

  const urls = Array.isArray(parsed.urls) ? (parsed.urls as string[]) : [];
  const meta: Record<string, string> = {};
  if (parsed.maxCharacters) meta['maxChars'] = String(parsed.maxCharacters);
  if (parsed.maxAgeHours) meta['maxAge'] = `${parsed.maxAgeHours}h`;

  return {
    artifact: {
      type: 'search-query',
      query: urls.join(', '),
      url: urls[0],
      meta: Object.keys(meta).length > 0 ? meta : undefined,
    },
  };
}

function playwriterInput(raw: string): ToolRendererResult | null {
  const parsed = parseJson(raw) as Record<string, unknown> | null;
  if (!parsed || !parsed.code) return null;
  return {
    artifact: {
      type: 'file-preview',
      language: 'javascript',
      content: String(parsed.code),
    },
  };
}

function invalidInput(raw: string): ToolRendererResult | null {
  const parsed = parseJson(raw) as Record<string, unknown> | null;
  if (!parsed) return null;
  return {
    artifact: {
      type: 'error',
      tool: parsed.tool ? String(parsed.tool) : undefined,
      summary: parsed.error ? String(parsed.error) : 'Invalid tool call',
    },
  };
}

/** Factory for tools whose input is just `{}` -- show a status label. */
function statusInput(label: string): PayloadHandler {
  return () => ({
    artifact: { type: 'status', message: label },
  });
}

// ---------------------------------------------------------------------------
// P0 Output handlers
// ---------------------------------------------------------------------------

function bashOutput(raw: string): ToolRendererResult | null {
  return {
    artifact: {
      type: 'execution-log',
      text: raw,
      variant: looksLikeError(raw) ? 'error' : 'default',
    },
  };
}

function readOutput(raw: string): ToolRendererResult | null {
  const envelope = parseReadEnvelope(raw);
  if (envelope) {
    if (envelope.type === 'directory') {
      return {
        artifact: {
          type: 'directory-tree',
          path: shortenPath(envelope.path),
          entries: parseDirectoryEntries(envelope.content),
        },
      };
    }
    return {
      artifact: {
        type: 'file-preview',
        path: shortenPath(envelope.path),
        language: detectLanguageFromPath(envelope.path),
        content: envelope.content,
        truncated: envelope.content.length > 10000,
      },
    };
  }
  // No envelope -- treat as raw text (unusual)
  return { artifact: { type: 'raw', text: raw } };
}

function editOutput(raw: string): ToolRendererResult | null {
  return {
    artifact: {
      type: 'patch-result',
      summary: raw,
    },
  };
}

function globOutput(raw: string): ToolRendererResult | null {
  const entries = parseDirectoryEntries(raw);
  if (entries.length > 0) {
    return {
      artifact: {
        type: 'directory-tree',
        entries,
      },
    };
  }
  return { artifact: { type: 'raw', text: raw } };
}

function listOutput(raw: string): ToolRendererResult | null {
  const entries = parseDirectoryEntries(raw);
  if (entries.length > 0) {
    return {
      artifact: {
        type: 'directory-tree',
        entries,
      },
    };
  }
  return { artifact: { type: 'raw', text: raw } };
}

function grepOutput(raw: string): ToolRendererResult | null {
  const groups = parseGrepOutput(raw);
  if (groups.length > 0) {
    return {
      artifact: {
        type: 'search-results',
        groups,
        raw,
      },
    };
  }
  // Couldn't parse structured results -- still show as search results with raw
  return { artifact: { type: 'search-results', raw } };
}

function todowriteOutput(raw: string, ctx: ToolPayloadContext): ToolRendererResult | null {
  // If output structurally matches input, hide it
  if (ctx.otherRaw) {
    const inputParsed = parseJson(ctx.otherRaw) as Record<string, unknown> | null;
    const outputParsed = parseJson(raw);
    if (
      inputParsed &&
      Array.isArray(inputParsed.todos) &&
      Array.isArray(outputParsed)
    ) {
      // Compare stringified to check structural equality
      const inputStr = JSON.stringify(inputParsed.todos);
      const outputStr = JSON.stringify(outputParsed);
      if (inputStr === outputStr) {
        return { artifact: null, hide: true };
      }
    }
  }

  const parsed = parseJson(raw);
  if (Array.isArray(parsed)) {
    return {
      artifact: {
        type: 'todo-list',
        todos: parseTodoArray(parsed),
      },
    };
  }
  return { artifact: { type: 'raw', text: raw } };
}

function todoreadOutput(raw: string): ToolRendererResult | null {
  const parsed = parseJson(raw);
  if (Array.isArray(parsed)) {
    return {
      artifact: {
        type: 'todo-list',
        todos: parseTodoArray(parsed),
      },
    };
  }
  return { artifact: { type: 'raw', text: raw } };
}

function applyPatchOutput(raw: string): ToolRendererResult | null {
  const files = parsePatchEnvelope(raw);
  if (files.length > 0) {
    return {
      artifact: {
        type: 'patch-result',
        summary: `${files.length} file(s) patched`,
        files,
        raw,
      },
    };
  }
  return {
    artifact: {
      type: 'patch-result',
      summary: raw,
    },
  };
}

function questionOutput(raw: string): ToolRendererResult | null {
  const answers = parseQuestionAnswers(raw);
  if (answers) {
    return {
      artifact: {
        type: 'qa',
        answers,
        answersText: raw,
      },
    };
  }
  return {
    artifact: {
      type: 'qa',
      answersText: raw,
    },
  };
}

// ---------------------------------------------------------------------------
// P1 Output handlers
// ---------------------------------------------------------------------------

function documentOutput(raw: string): ToolRendererResult | null {
  return {
    artifact: {
      type: 'document',
      content: raw,
      format: 'markdown',
    },
  };
}

function searchCardsOutput(raw: string): ToolRendererResult | null {
  const cards = parseSearchCards(raw);
  if (cards.length > 0) {
    return {
      artifact: {
        type: 'search-results',
        cards,
        raw,
      },
    };
  }
  // Couldn't parse cards -- fall back to document
  return {
    artifact: {
      type: 'document',
      content: raw,
      format: 'text',
    },
  };
}

function playwriterOutput(raw: string): ToolRendererResult | null {
  if (looksLikeError(raw)) {
    return {
      artifact: {
        type: 'error',
        summary: raw.split('\n')[0],
        details: raw,
      },
    };
  }
  return {
    artifact: {
      type: 'execution-log',
      text: raw,
    },
  };
}

function statusOutput(raw: string): ToolRendererResult | null {
  return {
    artifact: {
      type: 'status',
      message: raw,
      tone: looksLikeError(raw) ? 'error' : 'success',
    },
  };
}

function errorOutput(raw: string): ToolRendererResult | null {
  return {
    artifact: {
      type: 'error',
      summary: raw.split('\n')[0],
      details: raw,
    },
  };
}

// ---------------------------------------------------------------------------
// Generic fallbacks
// ---------------------------------------------------------------------------

function genericInput(raw: string): ToolRendererResult {
  const parsed = parseJson(raw) as Record<string, unknown> | null;
  if (parsed && typeof parsed === 'object') {
    // Show as JSON inspector for unknown structured tools
    return { artifact: { type: 'json', value: parsed } };
  }
  return { artifact: { type: 'raw', text: raw } };
}

function genericOutput(raw: string): ToolRendererResult {
  return { artifact: { type: 'raw', text: raw } };
}
