'use client';

export default function CursorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <div className="text-sm text-error">Failed to load Cursor stats</div>
      <div className="text-xs text-muted max-w-md">{error.message}</div>
      <button
        type="button"
        onClick={reset}
        className="rounded-md border border-border px-3 py-1.5 text-xs uppercase tracking-wide"
      >
        Retry
      </button>
    </div>
  );
}
