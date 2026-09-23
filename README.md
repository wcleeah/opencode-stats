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
- Cursor mode (nav toggle): manually upload Cursor usage CSV exports to Turso, then view token usage, estimated API cost (Cursor published rates), realized value vs plan/pool, cloud-agent vs IDE breakdown, and model/agent tables. Rate updates: `CURSOR-PRICING.md`. The Cursor page has an **Update pricing** button that launches a Cloud Agent (needs `CURSOR_API_KEY`) to sync those rates and open a PR.
- SaaS mode (nav toggle): live Tavily remaining credits, an editable collection of named dashboard links (for providers without a usage API, such as Exa personal), plus OpenCode tool-call overlay for `exa_*` / `tavily_*` tools. Snapshots are cached in Turso (Tavily `/usage` is rate-limited).

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
TAVILY_API_KEY=<tavily api key>
CURSOR_API_KEY=<cursor cloud agents api key>
```
The repo also includes `.env.example` with the same placeholders.

SaaS provider keys and `CURSOR_API_KEY` are read from process env (Railway / Cloudflare / `.env.local`). They are never stored in Turso. Restart the process after changing secrets. Exa personal plans have no billing API, so remaining USD is not fetched; add a named Quick link on the SaaS page to open the Exa dashboard instead.

Create a Cursor API key at Dashboard → API Keys. The Cursor page **Update pricing** button uses it to launch a Cloud Agent that syncs `src/lib/cursor/pricing.ts` and opens a PR. The key owner must have access to `CURSOR_AGENT_REPO_URL` (defaults to this repo).

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
