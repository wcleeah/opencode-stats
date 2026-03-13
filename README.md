# opencode-stats

Dashboard UI for the v2 OpenCode analytics schema stored in Turso.

The tracker plugin now writes directly to Turso and maintains fact tables plus rollups.
This app reads those rollups for dashboard/list pages and reads fact tables for session detail views.

## Environment

Create `.env.local`:

```bash
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
```

## Scripts

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm typecheck
```

## Main Routes

- `/` dashboard overview
- `/projects` projects list
- `/projects/[id]` project detail
- `/sessions/[id]` session detail with conversation and tool IO
- `/models` model analytics
- `/tools` tool analytics
- `/time` time analytics

## Data Shape

The app expects the v2 schema with these key tables:

- facts: `projects`, `sessions`, `turns`, `responses`, `response_parts`, `llm_steps`, `tool_calls`, `tool_payloads`
- rollups: `session_rollups`, `session_model_rollups`, `project_rollups`, `project_model_rollups`, `tool_rollups`, `daily_global_rollups`, `daily_model_rollups`, `daily_tool_rollups`, `daily_project_rollups`
