/**
 * Pure parsing helpers for tool payloads.
 *
 * No React, no JSX -- just data in, data out.
 * Every function is individually testable.
 */

import type {
  SearchResultGroup,
  SearchCard,
  TodoItem,
  QuestionItem,
  AnswerPair,
  PatchFileOp,
} from '@/lib/tool-artifacts';

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

/** Try JSON.parse, return null on failure. */
export function parseJson(raw: string | null): unknown | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw.trim());
  } catch {
    return null;
  }
}

/**
 * Strip home-directory prefixes from absolute paths.
 * /Users/foo/Documents/project/src/file.ts -> src/file.ts
 */
export function shortenPath(path: string): string {
  return path.replace(/^\/Users\/[^/]+\/(?:Documents\/)?[^/]+\//, '');
}

/** Shorten all absolute paths found in a block of text. */
export function shortenOutputPaths(content: string): string {
  return content.replace(/\/Users\/[^\s/]+\/(?:Documents\/)?[^\s/]+\//g, '');
}

/** Strip ANSI escape codes. */
export function stripAnsi(text: string): string {
  const ansiPattern = new RegExp(String.raw`\x1b\[[0-9;]*[a-zA-Z]`, 'g');
  return text.replace(ansiPattern, '');
}

/** Guess language from file extension. */
export function detectLanguageFromPath(path?: string): string | undefined {
  if (!path) return undefined;
  const ext = path.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    json: 'json',
    md: 'markdown',
    css: 'css',
    html: 'html',
    py: 'python',
    rs: 'rust',
    go: 'go',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    sql: 'sql',
    graphql: 'graphql',
    svg: 'xml',
    xml: 'xml',
  };
  return ext ? map[ext] : undefined;
}

// ---------------------------------------------------------------------------
// Read tool output: XML envelope parser
// ---------------------------------------------------------------------------

export interface ReadEnvelope {
  type: 'file' | 'directory';
  path: string;
  content: string;
}

/**
 * Parse the XML envelope returned by the `read` tool.
 *
 * File output looks like:
 *   <path>/foo/bar.ts</path>\n<type>file</type>\n<content>...</content>
 *
 * Directory output looks like:
 *   <path>/foo/</path>\n<type>directory</type>\n<entries>...</entries>
 */
export function parseReadEnvelope(raw: string): ReadEnvelope | null {
  // File variant
  const fileMatch = raw.match(
    /^<path>(.*?)<\/path>\s*<type>file<\/type>\s*<content>([\s\S]*)<\/content>$/,
  );
  if (fileMatch) {
    return { type: 'file', path: fileMatch[1], content: fileMatch[2] };
  }

  // Directory variant
  const dirMatch = raw.match(
    /^<path>(.*?)<\/path>\s*<type>directory<\/type>\s*<entries>([\s\S]*)<\/entries>$/,
  );
  if (dirMatch) {
    return { type: 'directory', path: dirMatch[1], content: dirMatch[2] };
  }

  return null;
}

/** Parse newline-separated directory listing into entries. */
export function parseDirectoryEntries(raw: string): string[] {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Grep output parser
// ---------------------------------------------------------------------------

/**
 * Parse grep-style output into file-grouped results.
 *
 * Expected format per line:
 *   /path/to/file.ts:
 *     Line 42: matched text
 *
 * or the simpler:
 *   /path/to/file.ts:42:matched text
 */
export function parseGrepOutput(raw: string): SearchResultGroup[] {
  const groups: SearchResultGroup[] = [];
  let current: SearchResultGroup | null = null;

  for (const line of raw.split('\n')) {
    // File header line (path ending with colon, no line number prefix)
    const headerMatch = line.match(/^(\S.*?):\s*$/);
    if (headerMatch) {
      current = { heading: headerMatch[1], matches: [] };
      groups.push(current);
      continue;
    }

    // Indented match line: "  Line 42: text"
    const indentedMatch = line.match(/^\s+Line (\d+):\s(.*)$/);
    if (indentedMatch && current) {
      current.matches.push({
        line: parseInt(indentedMatch[1], 10),
        text: indentedMatch[2],
      });
      continue;
    }

    // Colon-delimited: "path:line:text"
    const colonMatch = line.match(/^(.+?):(\d+):(.*)$/);
    if (colonMatch) {
      const path = colonMatch[1];
      if (!current || current.heading !== path) {
        current = { heading: path, matches: [] };
        groups.push(current);
      }
      current.matches.push({
        line: parseInt(colonMatch[2], 10),
        text: colonMatch[3],
      });
      continue;
    }
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Web/code search output parser
// ---------------------------------------------------------------------------

/**
 * Parse structured search output like grepapp / exa / websearch / codesearch.
 *
 * These tools return blocks like:
 *   Title: ...
 *   URL: ...
 *   Text: ...
 *
 * or:
 *   Repository: ...
 *   Path: ...
 *   URL: ...
 *   Snippets: ...
 */
export function parseSearchCards(raw: string): SearchCard[] {
  const cards: SearchCard[] = [];

  // Split on double newlines or "---" separators to find card boundaries
  const blocks = raw.split(/\n(?=(?:Title|Repository|##?\s):|---)/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length === 0) continue;

    const kv: Record<string, string> = {};
    let bodyLines: string[] = [];
    let inBody = false;

    for (const line of lines) {
      const kvMatch = line.match(/^(Title|URL|Repository|Path|License|Text|Source):\s*(.*)$/i);
      if (kvMatch && !inBody) {
        kv[kvMatch[1].toLowerCase()] = kvMatch[2];
      } else {
        inBody = true;
        bodyLines.push(line);
      }
    }

    // Also handle markdown-heading style: "## Title\nURL: ..."
    const headingMatch = lines[0].match(/^##?\s+(.+)$/);
    if (headingMatch && !kv['title']) {
      kv['title'] = headingMatch[1];
      bodyLines = bodyLines.slice(1);
    }

    const title = kv['title'] || kv['repository'] || '';
    if (!title) continue;

    cards.push({
      title,
      url: kv['url'] || kv['source'],
      snippet: bodyLines.join('\n').trim() || kv['text'] || '',
      meta: Object.keys(kv).length > 0
        ? Object.fromEntries(
            Object.entries(kv).filter(([k]) => !['title', 'url', 'text'].includes(k)),
          )
        : undefined,
    });
  }

  return cards;
}

// ---------------------------------------------------------------------------
// Todo parser
// ---------------------------------------------------------------------------

/** Parse a todo array (from JSON-parsed todowrite input or output). */
export function parseTodoArray(arr: unknown[]): TodoItem[] {
  return arr.map((item) => {
    const obj = item as Record<string, unknown>;
    return {
      content: String(obj.content ?? ''),
      status: String(obj.status ?? 'pending'),
      priority: obj.priority ? String(obj.priority) : undefined,
      id: obj.id ? String(obj.id) : undefined,
    };
  });
}

// ---------------------------------------------------------------------------
// Question parser
// ---------------------------------------------------------------------------

/** Parse questions array from question tool input. */
export function parseQuestions(arr: unknown[]): QuestionItem[] {
  return arr.map((item) => {
    const obj = item as Record<string, unknown>;
    const options = Array.isArray(obj.options)
      ? (obj.options as Array<Record<string, unknown>>).map((o) => ({
          label: String(o.label ?? ''),
          description: String(o.description ?? ''),
        }))
      : [];
    return {
      header: String(obj.header ?? ''),
      question: String(obj.question ?? ''),
      options,
    };
  });
}

/**
 * Parse question tool output text into question-answer pairs.
 * Format: "question"="answer". "question2"="answer2".
 */
export function parseQuestionAnswers(raw: string): AnswerPair[] | null {
  const pairs: AnswerPair[] = [];
  const regex = /"([^"]+)"="([^"]+)"/g;
  let match: RegExpExecArray | null = regex.exec(raw);

  while (match !== null) {
    pairs.push({ question: match[1], answer: match[2] });
    match = regex.exec(raw);
  }

  return pairs.length > 0 ? pairs : null;
}

// ---------------------------------------------------------------------------
// apply_patch parser
// ---------------------------------------------------------------------------

/**
 * Parse the `*** Begin Patch` envelope into per-file operations.
 *
 * Format:
 *   *** Begin Patch
 *   *** Update File: path/to/file.ts
 *   <hunks...>
 *   *** Add File: path/to/new.ts
 *   <content...>
 *   *** End Patch
 */
export function parsePatchEnvelope(patchText: string): PatchFileOp[] {
  const ops: PatchFileOp[] = [];
  const lines = patchText.split('\n');

  let currentOp: PatchFileOp | null = null;
  const hunkLines: string[] = [];

  function flush() {
    if (currentOp) {
      currentOp.hunks = hunkLines.join('\n');
      ops.push(currentOp);
      hunkLines.length = 0;
    }
  }

  for (const line of lines) {
    const opMatch = line.match(
      /^\*{3}\s+(Add|Update|Delete|Move|Rename)\s+File:\s*(.+)$/i,
    );
    if (opMatch) {
      flush();
      currentOp = {
        path: opMatch[2].trim(),
        action: opMatch[1].toLowerCase(),
      };
      continue;
    }

    if (line.startsWith('*** Begin Patch') || line.startsWith('*** End Patch')) {
      continue;
    }

    if (currentOp) {
      hunkLines.push(line);
    }
  }
  flush();

  return ops;
}

// ---------------------------------------------------------------------------
// Output text classification
// ---------------------------------------------------------------------------

/** Detect if execution output looks like an error. */
export function looksLikeError(text: string): boolean {
  const t = text.trim();
  return (
    /^error\b/im.test(t) ||
    /Error executing code:/i.test(t) ||
    /\bERROR\b/.test(t.slice(0, 200)) ||
    /^fatal:/m.test(t) ||
    /command not found/.test(t) ||
    /ENOENT|EACCES|EPERM/.test(t)
  );
}
