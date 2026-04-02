import { cn } from '@/lib/utils';

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export function Table({ children, className }: TableProps) {
  return (
    <div className={cn('overflow-x-auto rounded-sm border border-border', className)}>
      <table className="w-full text-sm">
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-border bg-surface-alt">
      {children}
    </thead>
  );
}

export function TableBody({ children }: { children: React.ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TableRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <tr
      className={cn(
        'border-b border-border last:border-b-0 hover:bg-surface-alt/50 transition-colors',
        className,
      )}
    >
      {children}
    </tr>
  );
}

interface TableCellProps {
  children: React.ReactNode;
  className?: string;
  header?: boolean;
  align?: 'left' | 'center' | 'right';
}

export function TableCell({
  children,
  className,
  header = false,
  align = 'left',
}: TableCellProps) {
  const Tag = header ? 'th' : 'td';
  const alignClass = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  }[align];

  return (
    <Tag
      className={cn(
        'px-3 py-2',
        header ? 'text-xs text-muted uppercase tracking-wider font-medium' : 'tabular-nums',
        alignClass,
        className,
      )}
    >
      {children}
    </Tag>
  );
}
