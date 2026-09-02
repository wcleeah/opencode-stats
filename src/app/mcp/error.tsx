'use client';

export default function McpError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <div className="text-sm text-error">Failed to load MCP credits</div>
      <div className="max-w-md text-xs text-muted">{error.message}</div>
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
