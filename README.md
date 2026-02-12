# opencode-stats

A dark-themed dashboard for viewing usage statistics from the [OpenCode](https://opencode.ai/) AI coding assistant. Reads from the OpenCode usage tracking SQLite database and displays token usage, cost estimates, model comparisons, tool call analytics, and full session conversation threads.

## Tech Stack

- **Framework**: Next.js (App Router), React 19
- **Language**: TypeScript (strict mode)
- **Database**: SQLite via `@libsql/client` — local file or remote [Turso](https://turso.tech/)
- **Styling**: Tailwind CSS v4, dark-only, full monospace (Geist Mono)
- **Charts**: Recharts

## Getting Started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

By default the app reads from `~/.local/share/opencode/usage.db`. Override with:

```bash
OPENCODE_USAGE_DB=/path/to/usage.db pnpm dev
```

## Deploying with Turso

For remote deployment (e.g., Cloudflare Pages), use a [Turso](https://turso.tech/) hosted database instead of a local file.

1. Create a database:
   ```bash
   turso db create opencode-usage
   ```

2. Push your local schema/data:
   ```bash
   turso db shell opencode-usage < schema.sql
   ```

3. Get credentials:
   ```bash
   turso db show opencode-usage --url
   turso db tokens create opencode-usage
   ```

4. Set environment variables:
   ```
   TURSO_DATABASE_URL=libsql://opencode-usage-<org>.turso.io
   TURSO_AUTH_TOKEN=<token>
   ```

When `TURSO_DATABASE_URL` is set, the app connects to Turso. Otherwise it falls back to the local SQLite file.

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `TURSO_DATABASE_URL` | Turso database URL | — |
| `TURSO_AUTH_TOKEN` | Turso auth token | — |
| `OPENCODE_USAGE_DB` | Local SQLite file path | `~/.local/share/opencode/usage.db` |

## Pages

| Route | Description |
|---|---|
| `/` | Dashboard home — stat cards, daily token chart, model table |
| `/projects` | All projects with session counts and token totals |
| `/projects/[id]` | Project detail — sessions list with stats |
| `/sessions/[id]` | Session detail — full conversation thread with inline tool calls |
| `/models` | Model comparison — usage, costs, cache efficiency, error rates |
| `/tools` | Tool usage analytics — call counts, error rates, durations |

## Scripts

```bash
pnpm dev          # start dev server
pnpm build        # production build
pnpm lint         # eslint
pnpm typecheck    # tsc --noEmit
```
