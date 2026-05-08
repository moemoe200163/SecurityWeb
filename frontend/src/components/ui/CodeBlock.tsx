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
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden bg-white dark:bg-neutral-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {languageLabels[language] || language.toUpperCase()}
          </span>
          {filename && (
            <span className="font-mono text-xs text-neutral-400 dark:text-neutral-500">
              {filename}
            </span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
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
        <pre className="p-4 text-sm font-mono bg-neutral-950 text-neutral-100">
          <code>
            {showLineNumbers ? (
              <table className="w-full">
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={idx}>
                      <td className="text-neutral-600 pr-4 text-right select-none w-8">
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
    <code className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded text-sm font-mono">
      {code}
    </code>
  );
}

export default CodeBlock;