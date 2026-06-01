'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface DataTableProps {
  columns: {
    key: string;
    header: string;
    width?: string;
    render?: (row: Record<string, unknown>) => React.ReactNode;
  }[];
  data: Record<string, unknown>[];
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function DataTable({
  columns,
  data,
  loading = false,
  emptyMessage = '沒有資料',
  className,
}: DataTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--terminal-green)]" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--muted-foreground)]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn('bg-[var(--card)] rounded-lg border border-[var(--border)] overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead className="bg-[var(--muted)] border-b border-[var(--border)]">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase"
                  style={{ width: col.width }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="hover:bg-[var(--accent)]/50 transition-colors"
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-sm text-[var(--foreground)]">
                    {col.render
                      ? col.render(row)
                      : String(row[col.key] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}