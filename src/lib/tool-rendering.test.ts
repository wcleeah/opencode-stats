import test from 'node:test';
import assert from 'node:assert/strict';

import { renderToolPayload } from './tool-rendering';

// ---------------------------------------------------------------------------
// Null / empty payloads
// ---------------------------------------------------------------------------

test('renderToolPayload returns null artifact for null input', () => {
  const result = renderToolPayload({ tool: 'bash', side: 'input', raw: null });
  assert.equal(result.artifact, null);
});

test('renderToolPayload returns null artifact for empty string', () => {
  const result = renderToolPayload({ tool: 'bash', side: 'input', raw: '' });
  assert.equal(result.artifact, null);
});

// ---------------------------------------------------------------------------
// bash
// ---------------------------------------------------------------------------

test('bash input produces command artifact', () => {
  const raw = JSON.stringify({
    command: 'ls -la',
    workdir: '/Users/alice/Documents/proj/src',
    description: 'List files',
    timeout: 30000,
  });
  const result = renderToolPayload({ tool: 'bash', side: 'input', raw });
  assert.equal(result.artifact?.type, 'command');
  if (result.artifact?.type === 'command') {
    assert.equal(result.artifact.command, 'ls -la');
    assert.equal(result.artifact.workdir, 'src'); // shortened
    assert.equal(result.artifact.description, 'List files');
    assert.equal(result.artifact.timeout, 30000);
  }
});

test('bash output produces execution-log artifact', () => {
  const result = renderToolPayload({ tool: 'bash', side: 'output', raw: 'file1.ts\nfile2.ts' });
  assert.equal(result.artifact?.type, 'execution-log');
  if (result.artifact?.type === 'execution-log') {
    assert.equal(result.artifact.variant, 'default');
  }
});

test('bash output with error produces error-variant execution-log', () => {
  const result = renderToolPayload({ tool: 'bash', side: 'output', raw: 'Error: command not found' });
  assert.equal(result.artifact?.type, 'execution-log');
  if (result.artifact?.type === 'execution-log') {
    assert.equal(result.artifact.variant, 'error');
  }
});

// ---------------------------------------------------------------------------
// read
// ---------------------------------------------------------------------------

test('read input produces file-request artifact', () => {
  const raw = JSON.stringify({
    filePath: '/Users/alice/Documents/proj/src/file.ts',
    offset: 10,
    limit: 50,
  });
  const result = renderToolPayload({ tool: 'read', side: 'input', raw });
  assert.equal(result.artifact?.type, 'file-request');
  if (result.artifact?.type === 'file-request') {
    assert.equal(result.artifact.path, 'src/file.ts');
    assert.equal(result.artifact.offset, 10);
    assert.equal(result.artifact.limit, 50);
  }
});

test('read output with file envelope produces file-preview', () => {
  const raw = '<path>/Users/alice/proj/src/file.ts</path>\n<type>file</type>\n<content>const x = 1;</content>';
  const result = renderToolPayload({ tool: 'read', side: 'output', raw });
  assert.equal(result.artifact?.type, 'file-preview');
  if (result.artifact?.type === 'file-preview') {
    assert.equal(result.artifact.content, 'const x = 1;');
    assert.equal(result.artifact.language, 'typescript');
  }
});

test('read output with directory envelope produces directory-tree', () => {
  const raw = '<path>/Users/alice/proj/src/</path>\n<type>directory</type>\n<entries>file1.ts\nfile2.ts</entries>';
  const result = renderToolPayload({ tool: 'read', side: 'output', raw });
  assert.equal(result.artifact?.type, 'directory-tree');
  if (result.artifact?.type === 'directory-tree') {
    assert.deepEqual(result.artifact.entries, ['file1.ts', 'file2.ts']);
  }
});

// ---------------------------------------------------------------------------
// edit
// ---------------------------------------------------------------------------

test('edit input produces diff artifact', () => {
  const raw = JSON.stringify({
    filePath: '/Users/alice/Documents/proj/src/file.ts',
    oldString: 'const x = 1;',
    newString: 'const x = 2;',
    replaceAll: true,
  });
  const result = renderToolPayload({ tool: 'edit', side: 'input', raw });
  assert.equal(result.artifact?.type, 'diff');
  if (result.artifact?.type === 'diff') {
    assert.equal(result.artifact.oldText, 'const x = 1;');
    assert.equal(result.artifact.newText, 'const x = 2;');
    assert.equal(result.artifact.replaceAll, true);
  }
});

test('edit output produces patch-result artifact', () => {
  const result = renderToolPayload({ tool: 'edit', side: 'output', raw: 'Successfully edited file' });
  assert.equal(result.artifact?.type, 'patch-result');
  if (result.artifact?.type === 'patch-result') {
    assert.equal(result.artifact.summary, 'Successfully edited file');
  }
});

// ---------------------------------------------------------------------------
// grep
// ---------------------------------------------------------------------------

test('grep input produces search-query artifact', () => {
  const raw = JSON.stringify({
    pattern: 'TODO',
    include: '*.ts',
    path: '/Users/alice/Documents/proj/src',
  });
  const result = renderToolPayload({ tool: 'grep', side: 'input', raw });
  assert.equal(result.artifact?.type, 'search-query');
  if (result.artifact?.type === 'search-query') {
    assert.equal(result.artifact.query, 'TODO');
    assert.equal(result.artifact.include, '*.ts');
  }
});

test('grep output with structured results produces search-results', () => {
  const raw = 'src/a.ts:5:TODO fix this\nsrc/b.ts:10:TODO refactor';
  const result = renderToolPayload({ tool: 'grep', side: 'output', raw });
  assert.equal(result.artifact?.type, 'search-results');
  if (result.artifact?.type === 'search-results') {
    assert.equal(result.artifact.groups?.length, 2);
  }
});

// ---------------------------------------------------------------------------
// glob
// ---------------------------------------------------------------------------

test('glob input produces search-query artifact', () => {
  const raw = JSON.stringify({ pattern: '**/*.ts', path: '/Users/alice/Documents/proj' });
  const result = renderToolPayload({ tool: 'glob', side: 'input', raw });
  assert.equal(result.artifact?.type, 'search-query');
  if (result.artifact?.type === 'search-query') {
    assert.equal(result.artifact.query, '**/*.ts');
  }
});

test('glob output produces directory-tree artifact', () => {
  const raw = 'src/a.ts\nsrc/b.ts\nsrc/c.ts';
  const result = renderToolPayload({ tool: 'glob', side: 'output', raw });
  assert.equal(result.artifact?.type, 'directory-tree');
  if (result.artifact?.type === 'directory-tree') {
    assert.equal(result.artifact.entries.length, 3);
  }
});

// ---------------------------------------------------------------------------
// todowrite
// ---------------------------------------------------------------------------

test('todowrite input produces todo-list artifact', () => {
  const raw = JSON.stringify({
    todos: [
      { content: 'Task 1', status: 'pending', priority: 'high' },
      { content: 'Task 2', status: 'completed', priority: 'medium' },
    ],
  });
  const result = renderToolPayload({ tool: 'todowrite', side: 'input', raw });
  assert.equal(result.artifact?.type, 'todo-list');
  if (result.artifact?.type === 'todo-list') {
    assert.equal(result.artifact.todos.length, 2);
  }
});

test('todowrite output hides when it structurally matches input', () => {
  const todos = [
    { content: 'Task 1', status: 'pending', priority: 'high' },
  ];
  const inputRaw = JSON.stringify({ todos });
  const outputRaw = JSON.stringify(todos);
  const result = renderToolPayload({
    tool: 'todowrite',
    side: 'output',
    raw: outputRaw,
    otherRaw: inputRaw,
  });
  assert.equal(result.hide, true);
  assert.equal(result.artifact, null);
});

test('todowrite output shows when it differs from input', () => {
  const inputRaw = JSON.stringify({
    todos: [{ content: 'A', status: 'pending' }],
  });
  const outputRaw = JSON.stringify([
    { content: 'A', status: 'completed' },
  ]);
  const result = renderToolPayload({
    tool: 'todowrite',
    side: 'output',
    raw: outputRaw,
    otherRaw: inputRaw,
  });
  assert.equal(result.hide, undefined);
  assert.equal(result.artifact?.type, 'todo-list');
});

// ---------------------------------------------------------------------------
// write
// ---------------------------------------------------------------------------

test('write input produces file-preview artifact', () => {
  const raw = JSON.stringify({
    filePath: '/Users/alice/Documents/proj/src/new-file.ts',
    content: 'export const x = 1;',
  });
  const result = renderToolPayload({ tool: 'write', side: 'input', raw });
  assert.equal(result.artifact?.type, 'file-preview');
  if (result.artifact?.type === 'file-preview') {
    assert.equal(result.artifact.path, 'src/new-file.ts');
    assert.equal(result.artifact.language, 'typescript');
    assert.equal(result.artifact.content, 'export const x = 1;');
  }
});

test('write output produces status artifact', () => {
  const result = renderToolPayload({ tool: 'write', side: 'output', raw: 'File written successfully' });
  assert.equal(result.artifact?.type, 'status');
});

// ---------------------------------------------------------------------------
// webfetch
// ---------------------------------------------------------------------------

test('webfetch input produces search-query with url', () => {
  const raw = JSON.stringify({ url: 'https://example.com', format: 'markdown' });
  const result = renderToolPayload({ tool: 'webfetch', side: 'input', raw });
  assert.equal(result.artifact?.type, 'search-query');
  if (result.artifact?.type === 'search-query') {
    assert.equal(result.artifact.url, 'https://example.com');
    assert.equal(result.artifact.format, 'markdown');
  }
});

test('webfetch output produces document artifact', () => {
  const result = renderToolPayload({ tool: 'webfetch', side: 'output', raw: '# Hello\nSome content' });
  assert.equal(result.artifact?.type, 'document');
  if (result.artifact?.type === 'document') {
    assert.equal(result.artifact.format, 'markdown');
  }
});

// ---------------------------------------------------------------------------
// apply_patch
// ---------------------------------------------------------------------------

test('apply_patch input produces diff artifact with patchText', () => {
  const patchText = `*** Begin Patch
*** Update File: src/file.ts
@@ -1,3 +1,3 @@
-old
+new
*** End Patch`;
  const raw = JSON.stringify({ patchText });
  const result = renderToolPayload({ tool: 'apply_patch', side: 'input', raw });
  assert.equal(result.artifact?.type, 'diff');
  if (result.artifact?.type === 'diff') {
    assert.equal(result.artifact.patchText, patchText);
  }
});

// ---------------------------------------------------------------------------
// question
// ---------------------------------------------------------------------------

test('question input produces qa artifact with questions', () => {
  const raw = JSON.stringify({
    questions: [{
      header: 'Tech Stack',
      question: 'Which framework?',
      options: [
        { label: 'React', description: 'Popular UI lib' },
        { label: 'Vue', description: 'Progressive framework' },
      ],
    }],
  });
  const result = renderToolPayload({ tool: 'question', side: 'input', raw });
  assert.equal(result.artifact?.type, 'qa');
  if (result.artifact?.type === 'qa') {
    assert.equal(result.artifact.questions?.length, 1);
    assert.equal(result.artifact.questions?.[0].options.length, 2);
  }
});

test('question output with answer pairs produces qa artifact', () => {
  const raw = '"Which framework?"="React"';
  const result = renderToolPayload({ tool: 'question', side: 'output', raw });
  assert.equal(result.artifact?.type, 'qa');
  if (result.artifact?.type === 'qa') {
    assert.equal(result.artifact.answers?.length, 1);
    assert.equal(result.artifact.answers?.[0].answer, 'React');
  }
});

// ---------------------------------------------------------------------------
// grepapp_searchGitHub
// ---------------------------------------------------------------------------

test('grepapp_searchGitHub input produces search-query with language', () => {
  const raw = JSON.stringify({
    query: 'useState(',
    language: ['TypeScript', 'TSX'],
    repo: 'facebook/react',
  });
  const result = renderToolPayload({ tool: 'grepapp_searchGitHub', side: 'input', raw });
  assert.equal(result.artifact?.type, 'search-query');
  if (result.artifact?.type === 'search-query') {
    assert.equal(result.artifact.query, 'useState(');
    assert.deepEqual(result.artifact.language, ['TypeScript', 'TSX']);
  }
});

// ---------------------------------------------------------------------------
// playwriter_execute
// ---------------------------------------------------------------------------

test('playwriter_execute input produces file-preview (JS code)', () => {
  const raw = JSON.stringify({ code: 'await page.goto("https://example.com")' });
  const result = renderToolPayload({ tool: 'playwriter_execute', side: 'input', raw });
  assert.equal(result.artifact?.type, 'file-preview');
  if (result.artifact?.type === 'file-preview') {
    assert.equal(result.artifact.language, 'javascript');
  }
});

// ---------------------------------------------------------------------------
// invalid tool
// ---------------------------------------------------------------------------

test('invalid tool input produces error artifact', () => {
  const raw = JSON.stringify({ tool: 'nonexistent', error: 'Tool not found' });
  const result = renderToolPayload({ tool: 'invalid', side: 'input', raw });
  assert.equal(result.artifact?.type, 'error');
  if (result.artifact?.type === 'error') {
    assert.equal(result.artifact.summary, 'Tool not found');
  }
});

// ---------------------------------------------------------------------------
// Generic fallback
// ---------------------------------------------------------------------------

test('unknown tool with JSON input produces json artifact', () => {
  const raw = JSON.stringify({ key: 'value' });
  const result = renderToolPayload({ tool: 'unknown_tool', side: 'input', raw });
  assert.equal(result.artifact?.type, 'json');
});

test('unknown tool with plain text output produces raw artifact', () => {
  const result = renderToolPayload({ tool: 'unknown_tool', side: 'output', raw: 'some output' });
  assert.equal(result.artifact?.type, 'raw');
});

// ---------------------------------------------------------------------------
// task
// ---------------------------------------------------------------------------

test('task input produces search-query with agent metadata', () => {
  const raw = JSON.stringify({
    description: 'Explore codebase',
    prompt: 'Find all API endpoints',
    subagent_type: 'explore',
  });
  const result = renderToolPayload({ tool: 'task', side: 'input', raw });
  assert.equal(result.artifact?.type, 'search-query');
  if (result.artifact?.type === 'search-query') {
    assert.equal(result.artifact.query, 'Explore codebase');
    assert.equal(result.artifact.meta?.agent, 'explore');
  }
});

test('task output produces document artifact', () => {
  const result = renderToolPayload({ tool: 'task', side: 'output', raw: 'Found 5 API endpoints...' });
  assert.equal(result.artifact?.type, 'document');
});

// ---------------------------------------------------------------------------
// statusInput tools (todoread, playwriter_reset, migrate-usage)
// ---------------------------------------------------------------------------

test('todoread input produces status artifact', () => {
  const result = renderToolPayload({ tool: 'todoread', side: 'input', raw: '{}' });
  assert.equal(result.artifact?.type, 'status');
  if (result.artifact?.type === 'status') {
    assert.equal(result.artifact.message, 'Read todo list');
  }
});

test('playwriter_reset input produces status artifact', () => {
  const result = renderToolPayload({ tool: 'playwriter_reset', side: 'input', raw: '{}' });
  assert.equal(result.artifact?.type, 'status');
  if (result.artifact?.type === 'status') {
    assert.equal(result.artifact.message, 'Reset browser connection');
  }
});
