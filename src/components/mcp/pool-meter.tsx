interface PoolMeterProps {
  label: string;
  usedLabel: string;
  detail?: string;
  percent: number;
  warn?: boolean;
}

export function PoolMeter({
  label,
  usedLabel,
  detail,
  percent,
  warn = false,
}: PoolMeterProps) {
  const width = Math.min(100, Math.max(percent > 0 ? 2 : 0, percent));

  return (
    <div className="rounded-sm border border-border bg-surface p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
        <div className="text-xs tabular-nums text-foreground">{usedLabel}</div>
      </div>
      <div className="h-2 overflow-hidden rounded-sm bg-surface-alt">
        <div
          className={
            warn
              ? 'h-full bg-warning transition-all'
              : 'h-full bg-foreground/70 transition-all'
          }
          style={{ width: `${width}%` }}
        />
      </div>
      {detail && <div className="mt-2 text-xs text-muted">{detail}</div>}
    </div>
  );
}
