# OpenCode Stats
OpenCode Stats is a Next.js dashboard for exploring OpenCode usage data from a Turso/libSQL database. It shows usage across projects, sessions, models, tools, and time, and includes a detailed session view that renders conversations, reasoning blocks, and tool calls with structured output instead of raw blobs.

## Features
- Global dashboard with totals for projects, sessions, turns, tokens, tool calls, models used, cost, and wall-clock time.
- Daily token usage charts and per-model usage tables.
- Project list and project detail pages with pagination, activity, token totals, session counts, code change summaries, and cost rollups.
- Session detail pages with the full conversation thread, subtask tree, assistant finish states, errors, reasoning parts, and inline tool call rendering.
- Model analytics including cache hit rate, reasoning tokens, daily error rate, and estimated total cost.
- Time analytics for turn wall time, assistant time, tool time, and project breakdowns.
- Tool analytics for call volume, error rate, duration, and input/output bytes.
- Date range filters on the dashboard, models, and time views.
- Cursor mode (nav toggle): manually upload Cursor usage CSV exports to Turso, then view token usage, estimated API cost (Cursor published rates), realized value vs plan/pool, cloud-agent vs IDE breakdown, and model/agent tables.

## Tech Stack
- Next.js 16 App Router
- Tailwind
- Recharts
- `@libsql/client` for Turso/libSQL access
- OpenNext + Wrangler for Cloudflare deployment

## Requirements
- `pnpm`
- A Turso/libSQL database containing the OpenCode usage data this app queries
- Environment variables for database access

This repo does not currently include database migrations or the ingestion step that populates the analytics tables. The app expects the database to already be loaded.

## Environment
Set the database connection in `.env.local`:

```bash
TURSO_DATABASE_URL=libsql://opencode-usage-<org>.turso.io
TURSO_AUTH_TOKEN=<token>
```
The repo also includes `.env.example` with the same placeholders.

## Local Development
Install dependencies:
```bash
pnpm install
```
Start the dev server:
```bash
pnpm dev
```
Open `http://localhost:3000`.

Pages are server-rendered and query the database directly from server code; the
app does not add a separate internal API layer for the main analytics screens.

## Cloudflare Deployment

This repo is configured for Cloudflare Workers via OpenNext.

Preview locally:

```bash
pnpm preview
```

Deploy:

```bash
pnpm deploy
```

Before deploying, make sure `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are
available to the Cloudflare runtime.

## Project Structure

```text
src/
  app/         Next.js routes and layouts
  components/  shared UI and chart components
  lib/         database helpers, query functions, formatting, pricing
  types/       shared TypeScript types
scripts/       one-off maintenance and analysis scripts
public/        static assets
```
