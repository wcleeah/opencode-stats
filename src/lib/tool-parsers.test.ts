import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseJson,
  shortenPath,
  shortenOutputPaths,
  stripAnsi,
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
} from './tool-parsers';

// ---------------------------------------------------------------------------
// parseJson
// ---------------------------------------------------------------------------

test('parseJson parses valid JSON', () => {
  assert.deepEqual(parseJson('{"a":1}'), { a: 1 });
});

test('parseJson returns null for invalid JSON', () => {
  assert.equal(parseJson('not json'), null);
});

test('parseJson returns null for null/empty input', () => {
  assert.equal(parseJson(null), null);
  assert.equal(parseJson(''), null);
});

test('parseJson trims whitespace before parsing', () => {
  assert.deepEqual(parseJson('  {"b":2}  '), { b: 2 });
});

// ---------------------------------------------------------------------------
// shortenPath
// ---------------------------------------------------------------------------

test('shortenPath strips /Users/*/Documents/*/ prefix', () => {
  assert.equal(
    shortenPath('/Users/alice/Documents/myproject/src/file.ts'),
    'src/file.ts',
  );
});

test('shortenPath strips /Users/*/* prefix (no Documents)', () => {
  assert.equal(
    shortenPath('/Users/bob/myproject/src/file.ts'),
    'src/file.ts',
  );
});

test('shortenPath returns relative paths unchanged', () => {
  assert.equal(shortenPath('src/file.ts'), 'src/file.ts');
});

// ---------------------------------------------------------------------------
// shortenOutputPaths
// ---------------------------------------------------------------------------

test('shortenOutputPaths shortens paths in multi-line text', () => {
  const input = 'Error in /Users/alice/Documents/proj/src/a.ts\nAlso /Users/bob/proj/b.ts';
  const result = shortenOutputPaths(input);
  assert.equal(result, 'Error in src/a.ts\nAlso b.ts');
});

// ---------------------------------------------------------------------------
// stripAnsi
// ---------------------------------------------------------------------------

test('stripAnsi removes ANSI escape codes', () => {
  assert.equal(stripAnsi('\x1b[31mred\x1b[0m text'), 'red text');
});

test('stripAnsi leaves plain text unchanged', () => {
  assert.equal(stripAnsi('hello world'), 'hello world');
});

// ---------------------------------------------------------------------------
// detectLanguageFromPath
// ---------------------------------------------------------------------------

test('detectLanguageFromPath maps .ts to typescript', () => {
  assert.equal(detectLanguageFromPath('file.ts'), 'typescript');
});

test('detectLanguageFromPath maps .py to python', () => {
  assert.equal(detectLanguageFromPath('script.py'), 'python');
});

test('detectLanguageFromPath returns undefined for unknown extensions', () => {
  assert.equal(detectLanguageFromPath('file.xyz'), undefined);
});

test('detectLanguageFromPath returns undefined for no path', () => {
  assert.equal(detectLanguageFromPath(undefined), undefined);
});

// ---------------------------------------------------------------------------
// parseReadEnvelope
// ---------------------------------------------------------------------------

test('parseReadEnvelope parses file envelope', () => {
  const raw = '<path>/Users/alice/proj/src/file.ts</path>\n<type>file</type>\n<content>const x = 1;</content>';
  const result = parseReadEnvelope(raw);
  assert.deepEqual(result, {
    type: 'file',
    path: '/Users/alice/proj/src/file.ts',
    content: 'const x = 1;',
  });
});

test('parseReadEnvelope parses directory envelope', () => {
  const raw = '<path>/Users/alice/proj/src/</path>\n<type>directory</type>\n<entries>file1.ts\nfile2.ts</entries>';
  const result = parseReadEnvelope(raw);
  assert.deepEqual(result, {
    type: 'directory',
    path: '/Users/alice/proj/src/',
    content: 'file1.ts\nfile2.ts',
  });
});

test('parseReadEnvelope returns null for non-envelope text', () => {
  assert.equal(parseReadEnvelope('just plain text'), null);
});

// ---------------------------------------------------------------------------
// parseDirectoryEntries
// ---------------------------------------------------------------------------

test('parseDirectoryEntries splits lines and trims', () => {
  assert.deepEqual(
    parseDirectoryEntries('file1.ts\n  file2.ts\n\nfile3.ts'),
    ['file1.ts', 'file2.ts', 'file3.ts'],
  );
});

test('parseDirectoryEntries handles empty input', () => {
  assert.deepEqual(parseDirectoryEntries(''), []);
});

// ---------------------------------------------------------------------------
// parseGrepOutput
// ---------------------------------------------------------------------------

test('parseGrepOutput parses file-header style output', () => {
  const raw = `/Users/alice/proj/src/file.ts:
  Line 10: const x = 1;
  Line 20: const y = 2;`;
  const result = parseGrepOutput(raw);
  assert.equal(result.length, 1);
  assert.equal(result[0].heading, '/Users/alice/proj/src/file.ts');
  assert.equal(result[0].matches.length, 2);
  assert.deepEqual(result[0].matches[0], { line: 10, text: 'const x = 1;' });
  assert.deepEqual(result[0].matches[1], { line: 20, text: 'const y = 2;' });
});

test('parseGrepOutput parses colon-delimited style', () => {
  const raw = 'src/a.ts:5:hello\nsrc/a.ts:10:world\nsrc/b.ts:3:foo';
  const result = parseGrepOutput(raw);
  assert.equal(result.length, 2);
  assert.equal(result[0].heading, 'src/a.ts');
  assert.equal(result[0].matches.length, 2);
  assert.equal(result[1].heading, 'src/b.ts');
  assert.equal(result[1].matches.length, 1);
});

test('parseGrepOutput returns empty for non-grep text', () => {
  assert.deepEqual(parseGrepOutput('no matches found'), []);
});

// ---------------------------------------------------------------------------
// parseSearchCards
// ---------------------------------------------------------------------------

test('parseSearchCards parses Title/URL/Text format', () => {
  const raw = `Title: My Result
URL: https://example.com
Text: Some snippet text`;
  const cards = parseSearchCards(raw);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].title, 'My Result');
  assert.equal(cards[0].url, 'https://example.com');
});

test('parseSearchCards returns empty for unstructured text', () => {
  assert.deepEqual(parseSearchCards('just random text'), []);
});

// ---------------------------------------------------------------------------
// parseTodoArray
// ---------------------------------------------------------------------------

test('parseTodoArray maps todo objects correctly', () => {
  const input = [
    { content: 'Task 1', status: 'completed', priority: 'high' },
    { content: 'Task 2', status: 'pending' },
  ];
  const result = parseTodoArray(input);
  assert.equal(result.length, 2);
  assert.deepEqual(result[0], {
    content: 'Task 1',
    status: 'completed',
    priority: 'high',
    id: undefined,
  });
  assert.deepEqual(result[1], {
    content: 'Task 2',
    status: 'pending',
    priority: undefined,
    id: undefined,
  });
});

// ---------------------------------------------------------------------------
// parseQuestions
// ---------------------------------------------------------------------------

test('parseQuestions maps question objects', () => {
  const input = [{
    header: 'Choose',
    question: 'Which option?',
    options: [
      { label: 'A', description: 'First' },
      { label: 'B', description: 'Second' },
    ],
  }];
  const result = parseQuestions(input);
  assert.equal(result.length, 1);
  assert.equal(result[0].header, 'Choose');
  assert.equal(result[0].options.length, 2);
});

// ---------------------------------------------------------------------------
// parseQuestionAnswers
// ---------------------------------------------------------------------------

test('parseQuestionAnswers parses "q"="a" pairs', () => {
  const raw = '"Which option?"="Option A". "Color?"="Blue".';
  const result = parseQuestionAnswers(raw);
  assert.equal(result!.length, 2);
  assert.deepEqual(result![0], { question: 'Which option?', answer: 'Option A' });
  assert.deepEqual(result![1], { question: 'Color?', answer: 'Blue' });
});

test('parseQuestionAnswers returns null for plain text', () => {
  assert.equal(parseQuestionAnswers('no answers here'), null);
});

// ---------------------------------------------------------------------------
// parsePatchEnvelope
// ---------------------------------------------------------------------------

test('parsePatchEnvelope parses Begin/End Patch format', () => {
  const raw = `*** Begin Patch
*** Update File: src/file.ts
@@ -1,3 +1,3 @@
-old line
+new line
*** Add File: src/new.ts
content here
*** End Patch`;
  const result = parsePatchEnvelope(raw);
  assert.equal(result.length, 2);
  assert.equal(result[0].path, 'src/file.ts');
  assert.equal(result[0].action, 'update');
  assert.equal(result[1].path, 'src/new.ts');
  assert.equal(result[1].action, 'add');
});

test('parsePatchEnvelope returns empty for non-patch text', () => {
  assert.deepEqual(parsePatchEnvelope('not a patch'), []);
});

// ---------------------------------------------------------------------------
// looksLikeError
// ---------------------------------------------------------------------------

test('looksLikeError detects error patterns', () => {
  assert.equal(looksLikeError('Error: something failed'), true);
  assert.equal(looksLikeError('fatal: not a git repo'), true);
  assert.equal(looksLikeError('ENOENT: no such file'), true);
  assert.equal(looksLikeError('command not found'), true);
  assert.equal(looksLikeError('Error executing code: timeout'), true);
});

test('looksLikeError returns false for normal output', () => {
  assert.equal(looksLikeError('Build succeeded'), false);
  assert.equal(looksLikeError('3 files changed'), false);
});
