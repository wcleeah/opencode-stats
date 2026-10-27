'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
  MCP_LINK_FLIGHT_HOLD_MS,
  mcpLinkFlightBusy,
  mcpLinkFlightFail,
  mcpLinkFlightMatches,
  mcpLinkFlightOnPending,
  mcpLinkFlightRefresh,
  mcpLinkFlightStart,
  mcpLinkFlightTimeout,
  type McpLinkFlight,
  type McpLinkFlightPhase,
} from '@/lib/mcp/link-flight';
import { cn } from '@/lib/utils';

import type { McpLink } from '@/types/mcp';

interface McpLinksProps {
  links: McpLink[];
}

function readError(payload: unknown, fallback: string): string {
  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    typeof (payload as { error: unknown }).error === 'string'
  ) {
    return (payload as { error: string }).error;
  }
  return fallback;
}

export function McpLinks({ links }: McpLinksProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<McpLinkFlightPhase>({ status: 'idle' });
  const shown = mcpLinkFlightOnPending(phase, pending);
  if (shown !== phase) setPhase(shown);
  const [drafts, setDrafts] = useState<Record<number, { name: string; url: string }>>(
    {},
  );
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');

  function draftFor(link: McpLink): { name: string; url: string } {
    return drafts[link.id] ?? { name: link.name, url: link.url };
  }

  useEffect(() => {
    if (shown.status !== 'refresh') return;
    const timer = window.setTimeout(() => {
      setPhase((current) => mcpLinkFlightTimeout(current));
    }, MCP_LINK_FLIGHT_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [shown]);

  function refresh(): void {
    startTransition(() => {
      router.refresh();
    });
  }

  function begin(flight: McpLinkFlight): void {
    setError(null);
    setPhase(mcpLinkFlightStart(flight));
  }

  function fail(current: McpLinkFlightPhase): void {
    setPhase(mcpLinkFlightFail(current));
  }

  function succeed(flight: McpLinkFlight): void {
    setPhase(mcpLinkFlightRefresh(mcpLinkFlightStart(flight)));
    refresh();
  }

  async function createLink(): Promise<void> {
    const flight: McpLinkFlight = { kind: 'add' };
    begin(flight);
    try {
      const response = await fetch('/api/mcp/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, url: newUrl }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        setError(readError(payload, 'Failed to add link'));
        fail(mcpLinkFlightStart(flight));
        return;
      }
      setNewName('');
      setNewUrl('');
      succeed(flight);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      fail(mcpLinkFlightStart(flight));
    }
  }

  async function saveLink(link: McpLink): Promise<void> {
    const draft = draftFor(link);
    const flight: McpLinkFlight = { kind: 'save', id: link.id };
    begin(flight);
    try {
      const response = await fetch(`/api/mcp/links/${link.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name,
          url: draft.url,
          sortOrder: link.sort_order,
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        setError(readError(payload, 'Failed to save link'));
        fail(mcpLinkFlightStart(flight));
        return;
      }
      setDrafts((current) => {
        const next = { ...current };
        delete next[link.id];
        return next;
      });
      succeed(flight);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      fail(mcpLinkFlightStart(flight));
    }
  }

  async function removeLink(link: McpLink): Promise<void> {
    if (!window.confirm(`Remove “${link.name}”?`)) return;
    const flight: McpLinkFlight = { kind: 'delete', id: link.id };
    begin(flight);
    try {
      const response = await fetch(`/api/mcp/links/${link.id}`, {
        method: 'DELETE',
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        setError(readError(payload, 'Failed to delete link'));
        fail(mcpLinkFlightStart(flight));
        return;
      }
      succeed(flight);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      fail(mcpLinkFlightStart(flight));
    }
  }

  async function moveLink(link: McpLink, direction: -1 | 1): Promise<void> {
    const index = links.findIndex((row) => row.id === link.id);
    const swapWith = links[index + direction];
    if (!swapWith) return;

    const flight: McpLinkFlight = {
      kind: direction < 0 ? 'up' : 'down',
      id: link.id,
    };
    begin(flight);
    try {
      const first = await fetch(`/api/mcp/links/${link.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: link.name,
          url: link.url,
          sortOrder: swapWith.sort_order,
        }),
      });
      if (!first.ok) {
        setError(readError(await first.json(), 'Failed to reorder link'));
        fail(mcpLinkFlightStart(flight));
        return;
      }
      const second = await fetch(`/api/mcp/links/${swapWith.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: swapWith.name,
          url: swapWith.url,
          sortOrder: link.sort_order,
        }),
      });
      if (!second.ok) {
        setError(readError(await second.json(), 'Failed to reorder link'));
        fail(mcpLinkFlightStart(flight));
        return;
      }
      succeed(flight);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      fail(mcpLinkFlightStart(flight));
    }
  }

  const busy = mcpLinkFlightBusy(shown, pending);

  function actionLabel(idle: string, working: string, flight: McpLinkFlight): string {
    return mcpLinkFlightMatches(shown, flight) ? working : idle;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs uppercase tracking-wider text-muted">Quick links</div>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setEditing((value) => !value);
            setError(null);
          }}
          className="rounded-md border border-border px-2 py-1 text-[10px] uppercase tracking-wide text-foreground hover:bg-surface-alt disabled:opacity-50"
        >
          {editing ? 'Done' : 'Edit'}
        </button>
      </div>

      {links.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'inline-flex items-center rounded-md border border-border bg-background',
                'px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-foreground',
                'hover:bg-surface-alt',
              )}
            >
              {link.name}
            </a>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted">
          No links yet. Add named buttons for dashboards that have no usage API
          (Exa personal billing, and so on).
        </p>
      )}

      {editing && (
        <div className="space-y-3 border-t border-border pt-3">
          {links.map((link, index) => {
            const draft = draftFor(link);
            const dirty = draft.name !== link.name || draft.url !== link.url;
            return (
              <div key={link.id} className="space-y-2 rounded-sm border border-border p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-[10px] uppercase tracking-wide text-muted">
                      Button name
                    </span>
                    <input
                      value={draft.name}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [link.id]: { ...draft, name: event.target.value },
                        }))
                      }
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[10px] uppercase tracking-wide text-muted">
                      URL
                    </span>
                    <input
                      value={draft.url}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [link.id]: { ...draft, url: event.target.value },
                        }))
                      }
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    />
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy || !dirty}
                    onClick={() => void saveLink(link)}
                    className="rounded-md border border-border px-2 py-1 text-[10px] uppercase tracking-wide hover:bg-surface-alt disabled:opacity-50"
                  >
                    {actionLabel('Save', 'Saving…', { kind: 'save', id: link.id })}
                  </button>
                  <button
                    type="button"
                    disabled={busy || index === 0}
                    onClick={() => void moveLink(link, -1)}
                    className="rounded-md border border-border px-2 py-1 text-[10px] uppercase tracking-wide hover:bg-surface-alt disabled:opacity-50"
                  >
                    {actionLabel('Up', 'Up…', { kind: 'up', id: link.id })}
                  </button>
                  <button
                    type="button"
                    disabled={busy || index === links.length - 1}
                    onClick={() => void moveLink(link, 1)}
                    className="rounded-md border border-border px-2 py-1 text-[10px] uppercase tracking-wide hover:bg-surface-alt disabled:opacity-50"
                  >
                    {actionLabel('Down', 'Down…', { kind: 'down', id: link.id })}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removeLink(link)}
                    className="rounded-md border border-error/30 px-2 py-1 text-[10px] uppercase tracking-wide text-error hover:bg-error/10 disabled:opacity-50"
                  >
                    {actionLabel('Delete', 'Delete…', { kind: 'delete', id: link.id })}
                  </button>
                </div>
              </div>
            );
          })}

          <form
            className="space-y-2 rounded-sm border border-dashed border-border p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void createLink();
            }}
          >
            <div className="text-[10px] uppercase tracking-wide text-muted">
              Add link
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                placeholder="Button name"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
              <input
                placeholder="https://dashboard.exa.ai"
                value={newUrl}
                onChange={(event) => setNewUrl(event.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={busy || !newName.trim() || !newUrl.trim()}
              className="rounded-md border border-border px-3 py-1.5 text-xs uppercase tracking-wide hover:bg-surface-alt disabled:opacity-50"
            >
              {actionLabel('Add button', 'Adding…', { kind: 'add' })}
            </button>
          </form>
        </div>
      )}

      {error && (
        <span
          role="alert"
          className="inline-block rounded-sm border border-error/30 bg-error/10 px-2 py-1 text-xs text-error"
        >
          {error}
        </span>
      )}
    </div>
  );
}
