# Cursor pricing update guide

How to change list rates, add models, and date-cutoffs for the Cursor
dashboard. Read this before editing `src/lib/cursor/pricing.ts`.

The dashboard estimates **API-equivalent USD** from CSV token columns at
Cursor-published list rates. Most CSV `Cost` cells are `Included` / `Free`,
so we almost never use a billed dollar amount. Do not treat this as
Cursor’s invoice.

## Files

| File | Role |
| --- | --- |
| `src/lib/cursor/pricing.ts` | Rate table, aliases, pool (`cursor` vs `other`), dated overrides, `estimateCursorCost` |
| `src/lib/cursor/pricing.test.ts` | Rate, alias, cutoff, and sample-CSV coverage tests |
| `src/app/cursor/page.tsx` | Costs **per UTC day** via `utcNoonMs(day)`, then rolls days up to model / pool totals |
| `src/lib/cursor/csv.ts` | Parses Cursor usage CSV; `Model` slugs must resolve in pricing |

No database migration. Rates are applied at query time from stored tokens.

## Where to look for new prices

Use this order. Stop when a row is unambiguous.

1. **Cursor Models & Pricing (canonical)**
   https://cursor.com/docs/models-and-pricing
   Tables are USD **per million tokens**: Input, Cache write, Cache read, Output.
   Fast variants are separate rows (do not copy a sibling model’s output rate).
2. **Per-model Cursor docs** (launch posts and “Pricing” sections)
   - https://cursor.com/docs/models/grok-4-5
   - https://cursor.com/docs/models/grok-4-6
   - https://cursor.com/docs/models/cursor-composer-2-5
   - https://cursor.com/blog (e.g. “Introducing Grok 4.5”)
3. **Cursor changelog / forum** for first-party pool rules and launch-week promos
   https://cursor.com/changelog
   https://forum.cursor.com
4. **Provider list rates** (only for **Other Models** — Claude, GPT, Gemini, …)
   Cursor bills that pool at the model’s API price. Confirm Cursor’s table
   still matches before copying OpenAI/Anthropic/Google pages.
   - OpenAI: https://developers.openai.com/api/docs/pricing
   - Model pages, e.g. https://developers.openai.com/api/docs/models/gpt-5.6-sol
5. **A fresh Cursor usage CSV** (`Model` column) for slugs the table does not
   cover. Add the slug to `SAMPLE_CSV_MODELS` if it appears in real exports.

If Cursor omits cache-write (`-`), call `rate(input, output, cacheRead)` so
cache-write defaults to the **input** rate. Anthropic often lists cache-write
at 1.25× input and cache-read at 0.1× input — copy the table, do not guess.

## Where to look for start / cutoff dates

A new number on the docs page is not enough. Historical CSV rows must keep
the rate that was in force **that day**.

Search until you have a **calendar date**. Prefer primary sources:

| Source | What it is good for |
| --- | --- |
| Cursor blog / model doc “Pricing” | First-party launch rates and launch date |
| Cursor changelog | When a model entered the Cursor Models pool |
| OpenAI / Anthropic / Google blog or “what’s new” | Other Models list-rate cuts |
| Reuters / provider status / Bedrock “what’s new” | Same-day confirmation of API cuts |
| Git history of `pricing.ts` | What *this repo* used to believe — not a source of truth |

**Do not** treat a git commit that “synced rates” as the cutoff. That is
when we noticed, not when billing changed.

**Hour of day is usually unpublished.** Use **UTC midnight of the calendar
date** (`Date.UTC(year, monthIndex, day)`). Document the source in a
comment next to the constant.

Promos that say **“at least through DATE”**: keep the promo rate after that
date until a new card is published. Store the exclusive end instant only as
documentation (see `GPT_56_SOL_PROMO_END_MS`).

If you cannot find a start date, **do not overwrite the old rate**. Add the
new rate as a dated override only when the date is known; otherwise leave a
`// TODO(cutoff)` comment and keep the previous numbers for history.

## How to change a current rate (no cutoff)

When the new price applies for the entire life of that model in our data
(or launch was already that price):

1. Edit `CURSOR_MODEL_PRICING` in `pricing.ts`. Keys are **normalized family
   ids** (`composer-2.5-fast`, `gpt-5.6-sol`), not CSV effort slugs.
2. `rate(inputPerM, outputPerM, cacheReadPerM, cacheWritePerM?)` — arguments
   are **USD per million tokens**.
3. Comment *why* if two similar models differ (Grok 4.5 Fast output is $18;
   Grok 4.6 Fast output is $12).
4. Update tests that hard-code the old dollar amount.
5. Bump the “Sources (synced …)” date in the file header.

## How to add a dated cutoff

Pattern already used for GPT-5.6 Sol:

1. Keep **current** rates in `CURSOR_MODEL_PRICING` (what `Date.now()` should
   see).
2. Keep **previous** rates as a named `rate(...)` constant
   (e.g. `GPT_56_SOL_LAUNCH`).
3. Export `*_START_MS = Date.UTC(...)` (and optional exclusive `*_END_MS`).
4. Branch in `pricingForKeyAt(key, eventAtMs)`:

   ```ts
   if (key === 'gpt-5.6-sol' && eventAtMs < GPT_56_SOL_PROMO_START_MS) {
     return GPT_56_SOL_LAUNCH;
   }
   ```

5. The dashboard already passes `eventAt: utcNoonMs(row.day)` from daily
   aggregates (`YYYY-MM-DD` in UTC from SQLite `unixepoch`). You do **not**
   need per-event rows for a day-grained cutoff.
6. Tests: one event **before** the instant (old $), one **on** the instant
   (new $), and the promo floor date if any.

Add another `if` in `pricingForKeyAt` for each new era. Do not replace the
Sol branch; stack cutoffs.

`estimateCursorCost({ ..., eventAt })` is the public API. Omitting `eventAt`
uses `Date.now()` (current card).

## New model / CSV slug

1. Add the family key to `CURSOR_MODEL_PRICING`.
2. If CSV ids differ (`gpt-5.6-sol-medium`, `cursor-grok-4.5-high-fast`),
   either:
   - add `MODEL_ALIASES` entries, or
   - rely on `resolvePricingKey` stripping `-thinking-(low|medium|high|xhigh)`,
     `-(low|medium|high|xhigh)-fast`, and `-(low|medium|high|xhigh)`.
3. Set the usage **pool** in `getCursorUsagePool`:
   - `cursor` — Auto, Composer\*, Cursor Grok / Grok\*
   - `other` — everything else (Claude, GPT, Gemini, …)
4. Add every new CSV slug to `SAMPLE_CSV_MODELS` so
   `cursor pricing covers every model in the sample CSV` fails closed.
5. Test `resolvePricingKey('csv-slug')` and `getCursorUsagePool(...)`.

## Checklist

- [ ] Numbers match Cursor docs (per million, all four columns).
- [ ] Fast vs standard not mixed up; Grok 4.5 Fast ≠ Grok 4.6 Fast.
- [ ] Cutoff date sourced (blog / changelog / provider), stored as UTC
      midnight, commented.
- [ ] Old rate kept for `eventAt` before the cutoff.
- [ ] Aliases / effort suffixes resolve; pool classification correct.
- [ ] `SAMPLE_CSV_MODELS` updated if the CSV grew.
- [ ] `pnpm test` and `pnpm run typecheck`.

## Known dated cards (as of 2026-08-25)

| Model | Card | When |
| --- | --- | --- |
| GPT-5.6 Sol | $5 in / $30 out (launch) | Until **2026-08-21** 00:00 UTC |
| GPT-5.6 Sol | $4 in / $20 out (promo) | From **2026-08-21**; at least through **2026-11-21** |
| Grok 4.5 Fast | $4 in / $18 out | Launch **2026-07-08**; no later list-rate change |

After 2026-11-21, re-check OpenAI + Cursor docs before assuming Sol stays
at $4/$20.
