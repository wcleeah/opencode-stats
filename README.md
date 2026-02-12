# opencode-stats

A dark-themed dashboard for viewing usage statistics from the [OpenCode](https://opencode.ai/) AI coding assistant. Reads from the OpenCode usage tracking SQLite database and displays token usage, cost estimates, model comparisons, tool call analytics, and full session conversation threads.

## Tech Stack

- **Framework**: Next.js (App Router), React 19
- **Language**: TypeScript (strict mode)
- **Database**: SQLite via `@libsql/client/web` — remote [Turso](https://turso.tech/)
- **Styling**: Tailwind CSS v4, dark-only, full monospace (Geist Mono)
- **Charts**: Recharts

## Getting Started

1. Set up a [Turso](https://turso.tech/) database (see below).

2. Create a `.env.local` with your credentials:
   ```
   TURSO_DATABASE_URL=libsql://opencode-usage-<org>.turso.io
   TURSO_AUTH_TOKEN=<token>
   ```

3. Start the dev server:
   ```bash
   pnpm install
   pnpm dev
   ```

Open [http://localhost:3000](http://localhost:3000).

## Turso Setup

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

4. Set environment variables (in `.env.local` for dev, or in your hosting dashboard for production):
   ```
   TURSO_DATABASE_URL=libsql://opencode-usage-<org>.turso.io
   TURSO_AUTH_TOKEN=<token>
   ```

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `TURSO_DATABASE_URL` | Turso database URL | Yes |
| `TURSO_AUTH_TOKEN` | Turso auth token | Yes |

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
