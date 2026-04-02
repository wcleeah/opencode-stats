import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-sm border border-border bg-surface p-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  subValue?: React.ReactNode;
  accent?: boolean;
}

export function StatCard({ label, value, subValue, accent }: StatCardProps) {
  return (
    <Card>
      <div className="text-xs text-muted uppercase tracking-wider">{label}</div>
      <div
        className={cn(
          'mt-1 text-2xl font-bold tabular-nums font-mono',
          accent ? 'text-foreground' : 'text-foreground',
        )}
      >
        {value}
      </div>
      {subValue && (
        <div className="mt-0.5 text-xs text-muted">{subValue}</div>
      )}
    </Card>
  );
}
