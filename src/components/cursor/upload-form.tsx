'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface UploadResponse {
  data?: {
    importId: number;
    rowCount: number;
    insertedCount: number;
    skippedCount: number;
    parseErrors: string[];
  };
  error?: string;
  details?: string;
}

export function CursorUploadForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResponse['data'] | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (!file) {
      setError('Choose a Cursor usage CSV first.');
      return;
    }

    const body = new FormData();
    body.set('file', file);

    const response = await fetch('/api/cursor/upload', {
      method: 'POST',
      body,
    });
    const payload = (await response.json()) as UploadResponse;
    if (!response.ok || !payload.data) {
      setError(payload.details ? `${payload.error}: ${payload.details}` : (payload.error ?? 'Upload failed'));
      return;
    }

    setResult(payload.data);
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block space-y-2">
        <span className="text-xs uppercase tracking-wide text-muted">
          Cursor usage CSV
        </span>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-xs file:uppercase file:tracking-wide"
        />
      </label>

      <button
        type="submit"
        disabled={pending || !file}
        className="w-full rounded-md border border-border px-3 py-2 text-xs uppercase tracking-wide text-foreground hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {pending ? 'Importing…' : 'Upload & merge'}
      </button>

      {error && (
        <div className="rounded-sm border border-error/40 bg-error/5 px-3 py-2 text-xs text-error">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-sm border border-border bg-surface px-3 py-2 text-xs space-y-1">
          <div className="text-foreground font-medium">Import complete</div>
          <div className="text-muted">
            {result.insertedCount.toLocaleString()} inserted ·{' '}
            {result.skippedCount.toLocaleString()} duplicates skipped ·{' '}
            {result.rowCount.toLocaleString()} parsed
          </div>
          {result.parseErrors.length > 0 && (
            <div className="text-warning">
              {result.parseErrors.length} row warning(s): {result.parseErrors[0]}
            </div>
          )}
        </div>
      )}
    </form>
  );
}
