# AGENTS.md

## Project Overview

OpenCode Stats Viewer -- a Next.js web application that displays usage statistics
from the OpenCode AI assistant. It reads from a local SQLite database at
`~/.local/share/opencode/usage.db` (overridable via `OPENCODE_USAGE_DB` env var).

See `USAGE-DB-GUIDE.md` for the complete database schema, entity relationships,
and recommended SQL query patterns.

## Tech Stack

- **Framework**: Next.js (App Router)
- **Runtime / Package Manager**: Bun
- **Language**: TypeScript (strict mode)
- **Database**: SQLite via `bun:sqlite` (Bun's built-in SQLite driver)
- **Styling**: Tailwind CSS; visual design references grep.app and OpenCode's UI

## Build / Dev / Test Commands

```bash
bun install              # install dependencies
bun dev                  # start dev server (Next.js)
bun run build            # production build
bun run lint             # run ESLint
bun run typecheck        # run tsc --noEmit (if configured in scripts)
```

### Testing

```bash
bun test                 # run all tests
bun test path/to/file    # run a single test file
bun test --grep "name"   # run tests matching a pattern
```

Test files live alongside source code with the `.test.ts` / `.test.tsx` suffix.
Use `bun:test` (Bun's built-in test runner) with `describe`, `it`, `expect`.

## Project Structure

```
src/
  app/                   # Next.js App Router pages and layouts
    layout.tsx           # root layout
    page.tsx             # dashboard home
    api/                 # API route handlers
  components/            # shared React components
    ui/                  # primitive UI components (buttons, cards, etc.)
  lib/                   # non-React utilities
    db.ts                # SQLite connection and query helpers
    queries/             # typed SQL query functions
  types/                 # shared TypeScript type definitions
public/                  # static assets
```

## Code Style

### TypeScript

- Strict mode enabled (`"strict": true` in tsconfig)
- Prefer `interface` for object shapes that may be extended; use `type` for
  unions, intersections, and mapped types
- Never use `any` -- use `unknown` and narrow with type guards
- All function parameters and return types should be explicitly typed for
  exported functions; inferred types are fine for local variables
- Use `as const` for literal constants, not type assertions like `as SomeType`

### Naming Conventions

- **Files/directories**: `kebab-case` (e.g., `daily-stats.tsx`, `token-chart.tsx`)
- **React components**: `PascalCase` (e.g., `SessionList`, `TokenChart`)
- **Functions/variables**: `camelCase`
- **Types/interfaces**: `PascalCase`, no `I` prefix (e.g., `Session`, not `ISession`)
- **Constants**: `UPPER_SNAKE_CASE` for true constants, `camelCase` for derived values
- **Database columns**: `snake_case` (matching the SQLite schema)
- **API routes**: `kebab-case` URL segments

### Imports

- Use absolute imports via `@/` path alias (maps to `src/`)
- Order: (1) React/Next.js, (2) external libraries, (3) `@/lib`, (4) `@/components`,
  (5) `@/types`, (6) relative imports. Separate groups with a blank line.
- Prefer named exports over default exports (except for Next.js page components
  which require default exports)

### Formatting

- 2-space indentation
- Semicolons required
- Double quotes for JSX attributes, single quotes for all other strings
- Trailing commas in multi-line constructs
- Max line length: 100 characters (soft guideline)
- Use `prettier` with default config + the above overrides

### React / Next.js

- Default to Server Components; add `'use client'` only when needed (hooks,
  browser APIs, event handlers)
- Use `async` Server Components for data fetching -- call DB query functions
  directly, no API round-trip needed
- Colocate loading/error states with `loading.tsx` and `error.tsx` files
- Prefer `Suspense` boundaries for granular loading states
- Keep components small and focused; extract reusable logic into custom hooks
  (prefixed with `use`)

### Error Handling

- Wrap database operations in try/catch; return typed error objects, not thrown
  exceptions, from query functions where possible
- Use Next.js `error.tsx` boundaries for page-level error recovery
- Log errors to console with context (function name, parameters)
- For API routes, return structured JSON errors with appropriate HTTP status codes:
  `{ error: string; details?: string }`

### Database

- All timestamps in the database are Unix epoch **milliseconds** -- divide by
  1000 for SQLite date functions, use `new Date(ts)` in JS
- Open the database in read-only mode (`readonly: true`) -- this app only reads
- Use a singleton connection pattern; open once at module scope in `lib/db.ts`
- Use parameterized queries for all user-supplied values (never interpolate)
- Cost is 0 for `github-copilot` provider -- display as "Included" or estimate
  from token counts
- See `USAGE-DB-GUIDE.md` sections 9 and 10 for query patterns and data quality
  caveats (placeholder rows, NULL content, etc.)

### Testing

- Test files: `*.test.ts` / `*.test.tsx` next to the source file they test
- Use `bun:test` -- `describe`, `it`/`test`, `expect`
- For database query tests, use an in-memory SQLite DB seeded with fixture data
- For component tests, prefer testing behavior over implementation details
- Mock external dependencies at module boundaries, not deep internals

## Key Data Caveats

These affect how you query and display data:

1. **Filter real user turns**: `WHERE synthetic = 0 AND compaction = 0 AND undone_at IS NULL`
2. **Filter final responses**: `WHERE finish != 'tool-calls' OR finish IS NULL`
3. **Filter top-level sessions**: `WHERE parent_id IS NULL`
4. **Exclude placeholders**: `WHERE id != '_unknown'` for projects
5. **Verify completion**: Check `completed_at IS NOT NULL` before computing response times
6. **Timestamps are ms**: Always divide by 1000 for SQLite date functions

## Environment Variables

| Variable            | Description                                   | Default                              |
|---------------------|-----------------------------------------------|--------------------------------------|
| `OPENCODE_USAGE_DB` | Path to the SQLite database file              | `~/.local/share/opencode/usage.db`   |

## Dependencies to Use

- `bun:sqlite` -- built-in SQLite driver, no external package needed
- `recharts` or `@nivo/core` -- charting (pick one)
- `tailwindcss` -- styling
- `clsx` + `tailwind-merge` -- conditional class merging
- `date-fns` -- date formatting and manipulation
