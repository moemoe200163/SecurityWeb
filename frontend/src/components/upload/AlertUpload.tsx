'use client';

import { useState, useCallback } from 'react';
import { Upload, FileText, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { AlertData } from '@/lib/types';

interface AlertUploadProps {
  onSubmit: (data: AlertData) => void;
  disabled?: boolean;
}

export function AlertUpload({ onSubmit, disabled = false }: AlertUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const processFile = async (file: File) => {
    const validTypes = ['application/json', 'text/csv', 'text/plain'];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.json') && !file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      alert('請上傳 JSON、CSV 或 TXT 檔案');
      return;
    }

    setFileName(file.name);
    const content = await file.text();
    setPasteContent(content);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        processFile(file);
      }
    },
    []
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleSubmit = () => {
    if (!pasteContent.trim() && !fileName) return;

    onSubmit({
      rawContent: pasteContent,
      fileName: fileName || undefined,
    });
  };

  const handleClear = () => {
    setPasteContent('');
    setFileName(null);
  };

  return (
    <div className="border border-[var(--border)] rounded-lg bg-[var(--card)] shadow-sm">
      <div className="p-4 border-b border-[var(--border)] bg-[var(--muted)]/40">
        <h3 className="font-medium text-sm text-[var(--foreground)] flex items-center gap-2">
          <Upload className="h-4 w-4" />
          告警上傳
        </h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Drag & Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
            isDragOver
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-[var(--border)] hover:border-[var(--muted-foreground)]'
          )}
        >
          <input
            type="file"
            accept=".json,.csv,.txt"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
            disabled={disabled}
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <FileText className="h-10 w-10 mx-auto mb-2 text-[var(--muted-foreground)]" />
            <p className="text-sm text-[var(--muted-foreground)]">
              拖拽檔案到此處，或 <span className="text-blue-500 font-medium">點擊上傳</span>
            </p>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">支援 JSON、CSV、TXT 格式</p>
          </label>
        </div>

        {/* Or separator */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[var(--card)] px-2 text-[var(--muted-foreground)]">或</span>
          </div>
        </div>

        {/* Paste area */}
        <div>
          <label className="text-sm font-medium text-[var(--foreground)] mb-2 block">
            貼上原始告警內容
          </label>
          <Textarea
            value={pasteContent}
            onChange={(e) => setPasteContent(e.target.value)}
            placeholder="貼上 JSON、CSV 或文字格式的告警內容..."
            className="min-h-32 font-mono text-xs"
            disabled={disabled}
          />
        </div>

        {/* File indicator */}
        {fileName && (
          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] bg-[var(--muted)] px-3 py-2 rounded-md">
            <FileText className="h-4 w-4" />
            <span>{fileName}</span>
            <button
              onClick={handleClear}
              className="ml-auto text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              disabled={disabled}
            >
              移除
            </button>
          </div>
        )}

        {/* Submit button */}
        <div className="flex gap-2">
          <Button
            onClick={handleSubmit}
            disabled={disabled || (!pasteContent.trim() && !fileName)}
            className="flex-1"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            開始 AI 分析
          </Button>
        </div>
      </div>
    </div>
  );
}
