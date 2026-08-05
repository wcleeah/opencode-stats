export const dynamic = 'force-dynamic';

import Link from 'next/link';

import { formatDateTime } from '@/lib/format';
import { listCursorImports } from '@/lib/queries/cursor';

import { Card } from '@/components/ui/card';
import { CursorUploadForm } from '@/components/cursor/upload-form';

export default async function CursorUploadPage() {
  const importsResult = await listCursorImports(20);
  const imports = importsResult.data ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">Upload Cursor usage</h1>
          <p className="mt-1 text-xs text-muted max-w-md">
            Export a CSV from Cursor&apos;s usage page, then upload it here. Re-uploads merge
            and skip duplicates.
          </p>
        </div>
        <Link
          href="/cursor"
          className="rounded-md border border-border px-3 py-1.5 text-xs uppercase tracking-wide hover:bg-surface-alt"
        >
          Dashboard
        </Link>
      </div>

      <Card>
        <CursorUploadForm />
      </Card>

      <Card>
        <div className="mb-3 text-xs text-muted uppercase tracking-wider">
          Import history
        </div>
        {importsResult.error ? (
          <div className="text-xs text-error">{importsResult.error}</div>
        ) : imports.length === 0 ? (
          <div className="text-xs text-muted">No uploads yet</div>
        ) : (
          <ul className="divide-y divide-border">
            {imports.map((item) => (
              <li key={item.id} className="py-2 first:pt-0 last:pb-0">
                <div className="text-sm text-foreground break-all">{item.filename}</div>
                <div className="mt-0.5 text-xs text-muted">
                  {formatDateTime(item.imported_at)} · {item.row_count} rows · +
                  {item.inserted_count} inserted · {item.skipped_count} skipped
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
