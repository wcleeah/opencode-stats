/**
 * Normalized artifact types that tool payloads get parsed into.
 *
 * The renderer layer receives one of these discriminated-union members and
 * picks the appropriate visual component. The union is intentionally small --
 * many tools map to the same artifact type (e.g. grep input and glob input
 * both become `search-query`).
 */

// ---------------------------------------------------------------------------
// Supporting types used inside artifacts
// ---------------------------------------------------------------------------

export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | string;
  priority?: 'high' | 'medium' | 'low' | string;
  id?: string;
}

export interface SearchResultGroup {
  /** File path, repository, or URL heading */
  heading: string;
  matches: SearchMatch[];
}

export interface SearchMatch {
  line?: number;
  text: string;
  url?: string;
}

export interface SearchCard {
  title: string;
  url?: string;
  snippet: string;
  meta?: Record<string, string>;
}

export interface QuestionItem {
  header: string;
  question: string;
  options: { label: string; description: string }[];
}

export interface AnswerPair {
  question: string;
  answer: string;
}

export interface PatchFileOp {
  path: string;
  action: 'add' | 'update' | 'delete' | 'move' | string;
  hunks?: string;
}

// ---------------------------------------------------------------------------
// Artifact union
// ---------------------------------------------------------------------------

export type ToolArtifact =
  | CommandArtifact
  | ExecutionLogArtifact
  | FileRequestArtifact
  | FilePreviewArtifact
  | DirectoryTreeArtifact
  | DiffArtifact
  | PatchResultArtifact
  | SearchQueryArtifact
  | SearchResultsArtifact
  | TodoListArtifact
  | DocumentArtifact
  | QAArtifact
  | StatusArtifact
  | ErrorArtifact
  | JSONArtifact
  | RawArtifact;

export interface CommandArtifact {
  type: 'command';
  command: string;
  workdir?: string;
  description?: string;
  timeout?: number;
}

export interface ExecutionLogArtifact {
  type: 'execution-log';
  text: string;
  variant?: 'default' | 'error' | 'success';
}

export interface FileRequestArtifact {
  type: 'file-request';
  path: string;
  offset?: number;
  limit?: number;
}

export interface FilePreviewArtifact {
  type: 'file-preview';
  path?: string;
  language?: string;
  content: string;
  truncated?: boolean;
}

export interface DirectoryTreeArtifact {
  type: 'directory-tree';
  path?: string;
  entries: string[];
}

export interface DiffArtifact {
  type: 'diff';
  path?: string;
  oldText?: string;
  newText?: string;
  /** Raw unified/patch text (for apply_patch) */
  patchText?: string;
  replaceAll?: boolean;
}

export interface PatchResultArtifact {
  type: 'patch-result';
  summary: string;
  files?: PatchFileOp[];
  raw?: string | null;
}

export interface SearchQueryArtifact {
  type: 'search-query';
  query: string;
  path?: string;
  include?: string;
  repo?: string;
  language?: string[];
  url?: string;
  format?: string;
  meta?: Record<string, string>;
}

export interface SearchResultsArtifact {
  type: 'search-results';
  /** File-grouped results (grep-style) */
  groups?: SearchResultGroup[];
  /** Card-style results (web/code search) */
  cards?: SearchCard[];
  raw: string;
}

export interface TodoListArtifact {
  type: 'todo-list';
  todos: TodoItem[];
}

export interface DocumentArtifact {
  type: 'document';
  title?: string;
  url?: string;
  content: string;
  format?: 'markdown' | 'text' | 'html';
}

export interface QAArtifact {
  type: 'qa';
  questions?: QuestionItem[];
  answers?: AnswerPair[];
  answersText?: string;
}

export interface StatusArtifact {
  type: 'status';
  message: string;
  tone?: 'default' | 'success' | 'warning' | 'error';
}

export interface ErrorArtifact {
  type: 'error';
  tool?: string;
  summary: string;
  details?: string;
}

export interface JSONArtifact {
  type: 'json';
  value: unknown;
}

export interface RawArtifact {
  type: 'raw';
  text: string;
}

// ---------------------------------------------------------------------------
// Renderer result returned by the registry
// ---------------------------------------------------------------------------

export interface ToolRendererResult {
  artifact: ToolArtifact | null;
  /** If true the section should not be shown at all (e.g. todowrite echo) */
  hide?: boolean;
  /** Override default collapsed/expanded state */
  defaultExpanded?: boolean;
}
