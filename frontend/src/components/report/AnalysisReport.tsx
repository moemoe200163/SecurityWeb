'use client';

import { useState, useRef } from 'react';
import { Copy, Check, FileText, Download, FileDown } from 'lucide-react';
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
  const [exporting, setExporting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
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

  const handleExportPDF = async () => {
    if (!contentRef.current) return;

    setExporting(true);

    try {
      // Use window.print() for PDF export via browser print dialog
      // This is simpler and more reliable than html2pdf
      const printContent = contentRef.current.innerHTML;
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('無法開啟列印視窗，請檢查瀏覽器設定');
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${title}</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                padding: 20px;
                max-width: 800px;
                margin: 0 auto;
              }
              h1 { font-size: 24px; margin-bottom: 20px; }
              h2 { font-size: 18px; margin-top: 20px; }
              table { border-collapse: collapse; width: 100%; margin: 10px 0; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f5f5f5; }
              pre { background-color: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; }
              code { background-color: #f5f5f5; padding: 2px 4px; border-radius: 2px; }
            </style>
          </head>
          <body>
            <h1>${title}</h1>
            <p>生成時間：${new Date().toLocaleString('zh-TW')}</p>
            <hr />
            ${printContent}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('PDF 導出失敗，請稍後再試');
    } finally {
      setExporting(false);
    }
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
          <Button variant="outline" size="sm" onClick={handleDownloadMarkdown}>
            <Download className="h-3 w-3 mr-1" />
            MD
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            disabled={exporting}
          >
            <FileDown className="h-3 w-3 mr-1" />
            {exporting ? '導出中...' : 'PDF'}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div
        ref={contentRef}
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
