'use client';

import { useState } from 'react';
import { Copy, Check, FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface AnalysisReportProps {
  report: string;
  title?: string;
}

export function AnalysisReport({ report, title = '安全分析報告' }: AnalysisReportProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `安全分析報告_${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-gray-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-500" />
          <h3 className="font-medium text-sm text-gray-700">{title}</h3>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={copied}
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 mr-1" />
                已複製
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 mr-1" />
                複製
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-3 w-3 mr-1" />
            下載
          </Button>
        </div>
      </div>

      {/* Content */}
      <div
        className={cn(
          'p-6 max-h-96 overflow-y-auto prose prose-sm max-w-none',
          'prose-headings:text-gray-900 prose-headings:font-semibold',
          'prose-table:text-xs prose-table:border-collapse',
          'prose-th:bg-gray-50 prose-th:border prose-th:px-3 prose-th:py-2',
          'prose-td:border prose-td:px-3 prose-td:py-2',
          'prose-code:text-blue-600 prose-code:bg-blue-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded',
          'prose-pre:bg-gray-900 prose-pre:text-gray-100'
        )}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
      </div>
    </Card>
  );
}
