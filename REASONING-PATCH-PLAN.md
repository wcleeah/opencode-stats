# Reasoning Display Patch Plan

## Problem

The session detail page in `opencode-stats` does not show reasoning content even
when the data already exists in Turso.

Current behavior:

- Rollups and response token counts can show reasoning usage via `tokens_reasoning`
- Session detail only renders assistant `text` content
- Assistant `reasoning` parts are stored in `response_parts` but never selected by
  the session message query

Root cause in current code:

- `src/lib/queries/messages.ts` only aggregates `response_parts` where
  `part_type = 'text'`
- `src/types/index.ts` only exposes `response_text` on `MessageThread`
- `src/app/sessions/[id]/page.tsx` only renders `am.response_text`

## What Reasoning Parts Look Like

The tracker stores assistant text-bearing parts in `response_parts`.

Relevant schema:

```sql
CREATE TABLE response_parts (
  response_id TEXT NOT NULL,
  part_id TEXT NOT NULL,
  part_type TEXT NOT NULL,
  sort_key TEXT NOT NULL,
  content TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  PRIMARY KEY (response_id, part_id)
)
```

Meaning of the important columns:

- `response_id`: assistant message / response id
- `part_id`: original OpenCode part id
- `part_type`: currently important values are `text` and `reasoning`
- `sort_key`: stable ordering key inside one response
- `content`: the actual text blob for that part

Example reasoning row shape:

```json
{
  "response_id": "msg_d4e56fe13002SdUY8oueya79rn",
  "part_id": "prt_d4e5725f8001Hp0pJwfQdggPVu",
  "part_type": "reasoning",
  "sort_key": "prt_d4e5725f8001Hp0pJwfQdggPVu",
  "content": "**Inspecting event flows**\n\nI'm considering...",
  "size_bytes": 522
}
```

Important correctness note:

- `tokens_reasoning > 0` does not guarantee a stored reasoning text blob
- the tracker only writes `response_parts` when the part has actual text content
- some responses have reasoning-token usage but no textual reasoning content

So the UI must treat:

- `responses.tokens_reasoning` as usage/accounting data
- `response_parts.part_type = 'reasoning'` as displayable reasoning text

These are related but not equivalent.

## What The UI Does Wrong Today

Current query in `src/lib/queries/messages.ts`:

```sql
(
  SELECT group_concat(content, '\n\n')
  FROM (
    SELECT content
    FROM response_parts rp
    WHERE rp.response_id = r.id AND rp.part_type = 'text'
    ORDER BY rp.sort_key
  )
) AS response_text
```

This drops all `reasoning` rows before the data reaches React.

Current rendering in `src/app/sessions/[id]/page.tsx`:

```tsx
{am.response_text && (
  <MarkdownContent content={am.response_text} ... />
)}
```

There is no `reasoning_text` field and no `response_parts` field in the view
model, so the page has no way to display reasoning even though Turso contains it.

## Correct Fetch Strategy

There are two possible approaches.

### Option A: Minimal Patch

Add a second aggregated field:

- `response_text` for `part_type = 'text'`
- `reasoning_text` for `part_type = 'reasoning'`

Example query shape:

```sql
SELECT
  t.id AS turn_id,
  t.content AS user_content,
  t.synthetic,
  t.compaction,
  t.undone_at,
  t.time_created AS user_created_at,
  t.turn_duration_ms,
  r.id AS response_id,
  r.model_id,
  r.provider_id,
  r.tokens_in,
  r.tokens_out,
  r.tokens_reasoning,
  r.cost AS total_cost,
  r.finish,
  r.error_type,
  r.error_message,
  r.time_created AS response_created_at,
  r.time_completed,
  (
    SELECT group_concat(content, '\n\n')
    FROM (
      SELECT content
      FROM response_parts rp
      WHERE rp.response_id = r.id AND rp.part_type = 'text'
      ORDER BY rp.sort_key
    )
  ) AS response_text,
  (
    SELECT group_concat(content, '\n\n')
    FROM (
      SELECT content
      FROM response_parts rp
      WHERE rp.response_id = r.id AND rp.part_type = 'reasoning'
      ORDER BY rp.sort_key
    )
  ) AS reasoning_text
FROM turns t
LEFT JOIN responses r ON r.turn_id = t.id
WHERE t.session_id = ?
ORDER BY t.time_created, r.time_created
```

Pros:

- Smallest patch
- Minimal type and UI changes

Cons:

- Loses part-level structure
- Cannot preserve exact interleaving if a response has multiple text and
  reasoning segments
- Harder to extend later for other part types

### Option B: Correct Patch

Fetch response metadata and response parts separately, then group in code.

This is the preferred approach.

Why this is correct:

- `response_parts` is already the fact table for assistant content
- `sort_key` gives the display order within a response
- the UI can render each part by `part_type`
- this preserves future compatibility if more part types become displayable

Recommended query split:

1. Keep the main thread query for turns and response metadata.
2. Add a second query for all response parts in the session.

Suggested response-parts query:

```sql
SELECT
  rp.response_id,
  rp.part_id,
  rp.part_type,
  rp.sort_key,
  rp.content,
  rp.size_bytes
FROM response_parts rp
JOIN responses r ON r.id = rp.response_id
WHERE r.session_id = ?
ORDER BY r.time_created, rp.sort_key
```

If the page should include the full root-session subtree instead of the single
session only, use:

```sql
SELECT
  rp.response_id,
  rp.part_id,
  rp.part_type,
  rp.sort_key,
  rp.content,
  rp.size_bytes
FROM response_parts rp
JOIN responses r ON r.id = rp.response_id
WHERE r.root_session_id = (
  SELECT root_session_id FROM sessions WHERE id = ?
)
ORDER BY r.time_created, rp.sort_key
```

Then build:

- `Map<response_id, ResponsePart[]>`
- render `text` and `reasoning` blocks in order

## Recommended Types

Add a dedicated response-part type in `src/types/index.ts`.

Suggested shape:

```ts
export interface ResponsePart {
  response_id: string;
  part_id: string;
  part_type: 'text' | 'reasoning' | string;
  sort_key: string;
  content: string;
  size_bytes: number;
}
```

If using the minimal patch, extend `MessageThread` with:

```ts
reasoning_text: string | null;
```

If using the correct patch, keep `MessageThread` for response metadata and fetch
`ResponsePart[]` separately.

## Recommended UI Rendering

### Minimal Patch Rendering

Render assistant text and reasoning as two separate sections.

Suggested behavior:

- show normal assistant response body as today
- if `reasoning_text` exists, render it in a separate collapsible block
- label it clearly as `reasoning`
- default collapsed is safer because reasoning blobs can be long

Example behavior:

- assistant badge row
- main visible response markdown
- collapsible reasoning section
- inline tool calls below

### Correct Patch Rendering

Render response parts in order.

Suggested part rendering rules:

- `text`: render with `MarkdownContent`
- `reasoning`: render in a visually distinct block

Suggested reasoning styling:

- muted surface or bordered inset block
- small `reasoning` badge
- smaller text than final answer
- collapsible by default when long

Pseudo-render shape:

```tsx
{parts.map((part) => {
  if (part.part_type === 'text') {
    return <MarkdownContent key={part.part_id} content={part.content} />;
  }

  if (part.part_type === 'reasoning') {
    return (
      <Card key={part.part_id}>
        <Badge variant="warning">reasoning</Badge>
        <CollapsibleContent content={part.content} maxLines={12} />
      </Card>
    );
  }

  return null;
})}
```

## Exact Files To Change

Minimal patch:

- `src/lib/queries/messages.ts`
  - add `reasoning_text` subquery
- `src/types/index.ts`
  - extend `MessageThread`
- `src/app/sessions/[id]/page.tsx`
  - render `reasoning_text`

Correct patch:

- `src/lib/queries/messages.ts`
  - add a new `getResponsePartsBySession()` query
- `src/types/index.ts`
  - add `ResponsePart`
- `src/app/sessions/[id]/page.tsx`
  - fetch parts
  - group by `response_id`
  - render ordered parts by type

## Recommended Implementation Order

1. Add a `ResponsePart` type.
2. Add a dedicated `getResponsePartsBySession(sessionId)` query.
3. Keep `getMessageThread()` focused on turns and response metadata.
4. Group parts by `response_id` in `src/app/sessions/[id]/page.tsx`.
5. Render `text` and `reasoning` separately, preserving `sort_key` order.
6. Add a compact visual treatment for reasoning blocks.

## Validation Checklist

- A response with `tokens_reasoning > 0` and stored reasoning text shows a
  reasoning block.
- A response with `tokens_reasoning > 0` but no reasoning text still shows token
  counts and does not render an empty reasoning section.
- Responses with multiple reasoning parts preserve order by `sort_key`.
- Existing assistant text rendering remains unchanged.
- Tool call rendering stays attached to the correct `response_id`.

## Bottom Line

The data is already in Turso.

The session breakdown hides it because it currently treats assistant content as a
single aggregated `text` blob and filters `response_parts` to `part_type =
'text'` only.

The correct fix is to make the session detail page part-aware instead of
text-only.
