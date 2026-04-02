'use client';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ToolsError({ error, reset }: ErrorPageProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center max-w-md">
        <div className="text-error text-sm mb-2">Failed to load tool usage</div>
        <div className="text-muted text-xs mb-4">
          {error.message || 'An unexpected error occurred'}
        </div>
        <button
          onClick={reset}
          type="button"
          className="rounded-sm border border-border bg-surface px-3 py-1.5 text-xs text-foreground hover:bg-surface-alt transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
