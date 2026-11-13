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
- Grok Bot plan usage on `/cursor/grok`. An external client posts a snapshot to `POST /api/cursor/grok/usage` with `GROK_BOT_INGEST_SECRET`. The page renders the stored plan, weekly percent, reset, on-demand figures, and share trees.
- SaaS mode (nav toggle): live Tavily remaining credits, an editable collection of named dashboard links (for providers without a usage API, such as Exa personal), plus OpenCode tool-call overlay for `exa_*` / `tavily_*` tools. Snapshots are cached in Turso (Tavily `/usage` is rate-limited).

## Tech Stack
- Next.js 16 App Router
- Tailwind
- Recharts
- `@libsql/client` for Turso/libSQL access
- Railway for production hosting (Cloudflare remains DNS-only)

## Requirements
- `pnpm`
- A Turso/libSQL database containing the OpenCode usage data this app queries
- Environment variables for database access

OpenCode analytics tables are expected to already be loaded. Cursor usage and Grok Bot plan usage create their own tables when those features are used.

## Environment
Set the database connection in `.env.local`:

```bash
TURSO_DATABASE_URL=libsql://opencode-usage-<org>.turso.io
TURSO_AUTH_TOKEN=<token>
TAVILY_API_KEY=<tavily api key>
CURSOR_API_KEY=<cursor cloud agents api key>
GROK_BOT_INGEST_SECRET=<long random secret>
```
The repo also includes `.env.example` with the same placeholders.

SaaS provider keys, `CURSOR_API_KEY`, and `GROK_BOT_INGEST_SECRET` are read from process env (Railway variables / `.env.local`). They are never stored in Turso. Restart the process after changing secrets. Exa personal plans have no billing API, so remaining USD is not fetched; add a named Quick link on the SaaS page to open the Exa dashboard instead.

Create a Cursor API key at Dashboard → API Keys. The Cursor page **Update pricing** button uses it to launch a Cloud Agent that syncs `src/lib/cursor/pricing.ts` and opens a PR. The key owner must have access to `CURSOR_AGENT_REPO_URL` (defaults to this repo).

## Grok Bot plan usage

`POST /api/cursor/grok/usage` stores one plan-usage snapshot in Turso. `/cursor/grok` renders the newest snapshot, and lists recent captures when more than one is stored. Share figures are percentages.

Set `GROK_BOT_INGEST_SECRET` before posting. Until it is set, the route responds with 503. Send it as a bearer token:

```bash
curl -sS -X POST "https://<your-host>/api/cursor/grok/usage" \
  -H "Authorization: Bearer $GROK_BOT_INGEST_SECRET" \
  -H "Content-Type: application/json" \
  --data-binary @grok-bot-usage.json
```

A new `source` + `captured_at` pair returns 201. Posting the same pair again updates that snapshot and returns 200.

The body is `schema_version` 1. Required fields are `captured_at`, `source`, `plan`, `weekly_usage_percent_used`, `reset_at` (`timezone`, `label`, `iso_approx`), `on_demand` (`monthly_limit` and `amount`, each a number or null), and `reports`. Each report has `period`, `period_label`, `breakdown` (dimension names such as `bot`, `routine`, `activity`, or `day`), and `rows`. A row has `share_pct` and the dimension named by `breakdown` at that depth. Optional `label`, `children`, `paused`, `note`, `runs_per_week_approx`, and other scalar fields are stored and shown. See `src/lib/grok-bot/fixtures/plan-usage-sample.json`.

## Local Development
Install dependencies:
```bash
pnpm install
```
Start the dev server:
```bash
pnpm dev
```
Open `http://localhost:3000` (redirects to the SaaS dashboard at `/saas`).
OpenCode usage is at `/opencode`; Cursor usage is at `/cursor`.

Pages are server-rendered and query the database directly from server code; the
app does not add a separate internal API layer for the main analytics screens.

## Railway Deployment

This repo is a standard Next.js app. Railway builds with `pnpm run build` and
starts with `pnpm start` (`next start`).

Set these variables on the Railway service (do not commit them):

```bash
TURSO_DATABASE_URL=libsql://opencode-usage-<org>.turso.io
TURSO_AUTH_TOKEN=<token>
TAVILY_API_KEY=<tavily api key>
CURSOR_API_KEY=<cursor cloud agents api key>
GROK_BOT_INGEST_SECRET=<long random secret>
# Optional:
# CURSOR_AGENT_REPO_URL=https://github.com/wcleeah/opencode-stats
# CURSOR_AGENT_STARTING_REF=main
```

Generate a Railway service domain first, confirm the app boots, then attach a
custom domain in Railway if you want one. Keep the DNS zone on Cloudflare and
point the hostname at the Railway CNAME (plus the Railway TXT ownership record).
Cloudflare proxy is optional; DNS-only (grey cloud) is the simplest setup.

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
