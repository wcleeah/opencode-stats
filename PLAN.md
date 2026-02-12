# OpenCode Stats Viewer -- Implementation Plan

## Design Decisions

- **Full monospace**: All text uses Geist Mono. CLI terminal aesthetic.
- **Dark only**: No light mode, no theme toggle. Hardcoded `className="dark"` on `<html>`.
- **Top bar navigation**: CLI-style prompt breadcrumbs (`>_ projects / repo-name / session abc...`), NOT a sidebar.
- **Pagination**: For data-heavy views (session lists, project lists).
- **Full conversation viewer**: Render actual message content from blob tables on session detail page.
- **Estimated costs**: Compute from token counts using a pricing table when provider reports $0. Show `~$X.XX` with "estimated" indicator.

## Color System

- **Background**: `#000` (pure black)
- **Foreground**: `#ededed`
- **Gray scale**: grep.app's `--grep-0: #0a0a0a` through `--grep-12: #777`
- **Accent**: OpenCode's `#03B000` terminal green
- **Status**: `#f76190` (error), `#52a9ff` (info), `#f1a10d` (warning), `#03B000` (success)
- **Border radius**: 4px
- **Borders**: 1px `--grep-2`, no shadows, no gradients

---

## Phase 1 -- Scaffolding

- [ ] Install deps: `recharts`, `clsx`, `tailwind-merge`, `date-fns`
- [ ] Fix `package.json`: rename `"temp"` to `"opencode-stats"`, add `typecheck` script
- [ ] Rewrite `globals.css`: dark-only CSS vars, `@theme inline` for Tailwind v4, grep-* color scale, accent green, chart colors, monospace everywhere
- [ ] Rewrite `layout.tsx`: drop Geist sans, keep Geist_Mono only, `<html className="dark">`, updated metadata
- [ ] Replace `page.tsx`: strip default template, add temporary placeholder
- [ ] **Commit**: scaffolding

## Phase 2 -- Database Layer

- [ ] `src/lib/db.ts`: singleton read-only `bun:sqlite`, env var support, `{ data, error }` query helpers
- [ ] `src/types/index.ts`: interfaces for all DB entities (Project, Session, UserMessage, AssistantMessage, Step, ToolCall, AssistantBlob, ToolCallBlob) plus composite view types
- [ ] `src/lib/queries/`: stats.ts, projects.ts, sessions.ts, messages.ts, analytics.ts implementing USAGE-DB-GUIDE query patterns 9.1-9.11
- [ ] **Commit**: database layer

## Phase 3 -- Shared Components

- [ ] `src/lib/format.ts`: formatTokens, formatCost, formatDuration, formatRelativeTime, formatDate, formatDiff
- [ ] `src/components/ui/`: Card, StatCard, Table, Badge (CLI-style), Skeleton, Pagination
- [ ] `src/components/nav.tsx` + `breadcrumbs.tsx`: top bar with `>_` prompt prefix
- [ ] **Commit**: shared components

## Phase 4 -- Dashboard Home `/`

- [ ] Summary stat cards (global stats query 9.11)
- [ ] Daily token usage area chart + model usage table (queries 9.3, 9.4)
- [ ] **Commit**: dashboard home

## Phase 5 -- Projects & Sessions

- [ ] `/projects`: paginated project list
- [ ] `/projects/[id]`: project detail with paginated session list (query 9.1)
- [ ] `/sessions/[id]`: session detail with stats header, conversation thread from blobs (query 9.2), subtask tree (query 9.6), tool calls timeline
- [ ] **Commit**: projects & sessions pages

## Phase 6 -- Analytics

- [ ] `/tools`: tool usage bar chart + table (query 9.5)
- [ ] `/models`: model comparison, cache efficiency trend (query 9.10), error rate over time (query 9.7)
- [ ] **Commit**: analytics pages

## Phase 7 -- Cost Estimation

- [ ] `src/lib/pricing.ts`: MODEL_PRICING map, estimateCost function
- [ ] Integrate estimated costs into all views that show cost data
- [ ] **Commit**: cost estimation

## Phase 8 -- Polish

- [ ] `loading.tsx` and `error.tsx` for all routes
- [ ] Responsive layout
- [ ] Update AGENTS.md
- [ ] **Commit**: final polish
