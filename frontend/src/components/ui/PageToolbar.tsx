'use client';

import type { ReactNode } from 'react';
import { Search, RefreshCw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolbarFilter {
  key: string;
  label: string;
  options: Array<{ value: string; label: string; count?: number }>;
  value: string;
  onChange: (value: string) => void;
}

interface PageToolbarProps {
  /** Search input */
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  /** Filter dropdowns */
  filters?: ToolbarFilter[];
  /** Show reset button when any filter is active */
  onReset?: () => void;
  /** Refresh button */
  onRefresh?: () => void;
  isRefreshing?: boolean;
  /** Primary action button (e.g. "新增") */
  primaryAction?: ReactNode;
  /** Right-side extra actions */
  actions?: ReactNode;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PageToolbar({
  search,
  filters = [],
  onReset,
  onRefresh,
  isRefreshing,
  primaryAction,
  actions,
  className,
}: PageToolbarProps) {
  const hasActiveFilter = filters.some((f) => f.value !== '') || search?.value !== '';

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 px-5 py-3 border-b border-[var(--border)] bg-[var(--card)]',
        className,
      )}
    >
      {/* Search */}
      {search && (
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
          <input
            type="text"
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder ?? '搜尋...'}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pl-9 pr-3 py-1.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--terminal-green)]/50 transition-colors"
          />
        </div>
      )}

      {/* Filters */}
      {filters.map((filter) => (
        <select
          key={filter.key}
          value={filter.value}
          onChange={(e) => filter.onChange(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--terminal-green)]/50 transition-colors"
        >
          <option value="">{filter.label}</option>
          {filter.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}{opt.count !== undefined ? ` (${opt.count})` : ''}
            </option>
          ))}
        </select>
      ))}

      {/* Reset */}
      {hasActiveFilter && onReset && (
        <button
          onClick={onReset}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
        >
          <X className="h-3 w-3" />
          清空
        </button>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Refresh */}
      {onRefresh && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="gap-1.5"
        >
          <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
          重新整理
        </Button>
      )}

      {/* Primary action */}
      {primaryAction}

      {/* Extra actions */}
      {actions}
    </div>
  );
}
