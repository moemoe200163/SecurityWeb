'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Custom table styles
        table: ({ children }) => (
          <div className="overflow-x-auto my-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
            {children}
          </thead>
        ),
        th: ({ children }) => (
          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider border-b border-gray-200 dark:border-gray-600">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 whitespace-pre-wrap">
            {children}
          </td>
        ),
        tr: ({ children }) => (
          <tr className="hover:bg-blue-50/30 dark:hover:bg-gray-800/50 transition-colors even:bg-gray-50/50 dark:even:bg-gray-900/50">
            {children}
          </tr>
        ),
        // Header styles
        h1: ({ children }) => (
          <h1 className="text-2xl font-bold mt-6 mb-4 text-gray-900 dark:text-gray-100">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-xl font-semibold mt-5 mb-3 text-gray-800 dark:text-gray-200">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-800 dark:text-gray-200">
            {children}
          </h3>
        ),
        // Paragraph styles
        p: ({ children }) => (
          <p className="mb-4 leading-relaxed text-gray-700 dark:text-gray-300">
            {children}
          </p>
        ),
        // List styles
        ul: ({ children }) => (
          <ul className="mb-4 pl-6 list-disc list-inside space-y-1">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-4 pl-6 list-decimal list-inside space-y-1">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="text-gray-700 dark:text-gray-300">
            {children}
          </li>
        ),
        // Code styles
        code: ({ children, className }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-red-600 dark:text-red-400 text-sm font-mono">
                {children}
              </code>
            );
          }
          return (
            <code className={className}>
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="mb-4 rounded-xl overflow-hidden bg-neutral-950 text-neutral-100 text-sm font-mono">
            <code className="block p-4 overflow-x-auto">{children}</code>
          </pre>
        ),
        // Blockquote styles
        blockquote: ({ children }) => (
          <blockquote className="mb-4 pl-4 border-l-4 border-blue-500 italic text-gray-600 dark:text-gray-400">
            {children}
          </blockquote>
        ),
        // Strong and emphasis
        strong: ({ children }) => (
          <strong className="font-semibold text-gray-900 dark:text-gray-100">
            {children}
          </strong>
        ),
        em: ({ children }) => (
          <em className="italic text-gray-600 dark:text-gray-400">
            {children}
          </em>
        ),
        // Horizontal rule
        hr: () => (
          <hr className="my-6 border-gray-200 dark:border-gray-700" />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  );
}
