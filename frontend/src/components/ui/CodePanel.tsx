'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface CodePanelProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  className?: string;
  maxHeight?: string;
}

export function CodePanel({
  code,
  language,
  showLineNumbers = false,
  className,
  maxHeight = 'max-h-96',
}: CodePanelProps) {
  const [copied, setCopied] = useState(false);

  const lines = code.split('\n');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn(
      'relative bg-[var(--card)] rounded-lg border border-[var(--border)] overflow-hidden',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--muted)]">
        <div className="flex items-center gap-2">
          {language && (
            <span className="text-xs font-mono text-[var(--muted-foreground)]">
              {language}
            </span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" />
              <span>已複製</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>複製</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content */}
      <div className={cn('overflow-auto', maxHeight)}>
        <pre className="p-4 text-sm font-mono text-[var(--foreground)]">
          {showLineNumbers ? (
            <code className="block">
              {lines.map((line, i) => (
                <div key={i} className="flex">
                  <span className="select-none text-[var(--muted-foreground)] w-8 text-right pr-4">
                    {i + 1}
                  </span>
                  <span>{line || ' '}</span>
                </div>
              ))}
            </code>
          ) : (
            <code className="whitespace-pre-wrap">{code}</code>
          )}
        </pre>
      </div>
    </div>
  );
}