'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language?: 'bash' | 'python' | 'xml' | 'yaml' | 'json' | 'sql' | 'javascript' | 'typescript' | 'html' | 'css';
  filename?: string;
  showLineNumbers?: boolean;
  maxHeight?: string;
}

const languageLabels: Record<string, string> = {
  bash: 'BASH',
  python: 'PYTHON',
  xml: 'XML',
  yaml: 'YAML',
  json: 'JSON',
  sql: 'SQL',
  javascript: 'JAVASCRIPT',
  typescript: 'TYPESCRIPT',
  html: 'HTML',
  css: 'CSS',
};

export function CodeBlock({
  code,
  language = 'bash',
  filename,
  showLineNumbers = false,
  maxHeight = 'max-h-[500px]',
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const lines = code.split('\n');

  return (
    <div className="border border-[var(--border)] rounded-2xl overflow-hidden bg-[var(--card)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--muted)]/50 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-medium text-[var(--muted-foreground)]">
            {languageLabels[language] || language.toUpperCase()}
          </span>
          {filename && (
            <span className="font-mono text-xs text-[var(--muted-foreground)]">
              {filename}
            </span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-green-500" />
              <span className="text-green-500">已複製</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>複製</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content */}
      <div className={`overflow-x-auto ${maxHeight}`}>
        <pre className="p-4 text-sm font-mono bg-[var(--background)] text-[var(--foreground)]">
          <code>
            {showLineNumbers ? (
              <table className="w-full">
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={idx}>
                      <td className="text-[var(--muted-foreground)] pr-4 text-right select-none w-8">
                        {idx + 1}
                      </td>
                      <td>{line || ' '}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              code
            )}
          </code>
        </pre>
      </div>
    </div>
  );
}

interface CodeBlockInlineProps {
  code: string;
}

export function CodeBlockInline({ code }: CodeBlockInlineProps) {
  return (
    <code className="px-1.5 py-0.5 bg-[var(--muted)] text-[var(--foreground)] rounded text-sm font-mono">
      {code}
    </code>
  );
}

export default CodeBlock;
