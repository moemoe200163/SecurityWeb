'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Shield, Download, Copy, AlertTriangle, CheckCircle2, Clock, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ThreatSummaryCardProps {
  threatVerdict: string;       // ⚠️ 中危 - HTTP CRLF 注入
  mainConclusion: string;     // 主要結論描述
  riskLevel: string;          // 中危（CVSS ≈ 5.3）
  impactScope: string;        // 影響範圍描述
  currentStatus: string;      // 目前狀態
  immediateActions: string[];  // 立即建議陣列
  onDownloadPDF?: () => void;
  onCopySummary?: () => void;
}

// 風險等級配置
const riskConfig: Record<string, {
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
}> = {
  '高危': {
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    label: '高危',
  },
  '中危': {
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    label: '中危',
  },
  '低危': {
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    label: '低危',
  },
};

export function ThreatSummaryCard({
  threatVerdict,
  mainConclusion,
  riskLevel,
  impactScope,
  currentStatus,
  immediateActions,
  onDownloadPDF,
  onCopySummary,
}: ThreatSummaryCardProps) {
  // 解析風險等級關鍵字
  const getRiskKey = (level: string): string => {
    if (level.includes('高') || level.includes('high')) return '高危';
    if (level.includes('中') || level.includes('medium')) return '中危';
    if (level.includes('低') || level.includes('low')) return '低危';
    return '中危';
  };

  const riskKey = getRiskKey(riskLevel);
  const risk = riskConfig[riskKey] || riskConfig['中危'];

  return (
    <div className="w-full max-w-4xl mx-auto rounded-2xl overflow-hidden shadow-lg border border-gray-200/50 bg-white">
      {/* Header 區塊 - 使用 SOC 主題色 */}
      <div className="bg-[--color-soc] px-6 py-5" style={{ backgroundColor: 'oklch(0.6 0.15 220)' }}>
        <div className="flex items-center justify-between">
          {/* 左側：盾牌圖標 */}
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner">
              <Shield className="h-6 w-6 text-white" />
            </div>
            {/* 威脅判定文字 */}
            <div>
              <p className="text-white/80 text-sm font-medium mb-0.5">威脅判定</p>
              <h2 className="text-white text-xl font-bold tracking-tight prose prose-invert prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{threatVerdict}</ReactMarkdown>
              </h2>
            </div>
          </div>

          {/* 右側：風險等級標籤 */}
          <div className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-sm border shadow-sm',
            risk.bgColor,
            risk.borderColor
          )}>
            <AlertTriangle className={cn('h-4 w-4', risk.color)} />
            <span className={cn('text-sm font-semibold', risk.color)}>
              {risk.label}
            </span>
          </div>
        </div>
      </div>

      {/* Body 區塊 */}
      <div className="p-6 space-y-6">
        {/* 主要結論 */}
        <div className="bg-gradient-to-r from-gray-50 to-[--color-soc]/10 rounded-xl p-4 border border-gray-100">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-[--color-soc]/10 text-[--color-soc] flex items-center justify-center flex-shrink-0">
              <Target className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-medium text-[--color-soc] uppercase tracking-wider mb-1">
                主要結論
              </p>
              <div className="text-gray-800 leading-relaxed font-medium prose prose-sm max-w-none prose-blue">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{mainConclusion}</ReactMarkdown>
              </div>
            </div>
          </div>
        </div>

        {/* 兩欄佈局：影響範圍 + 目前狀態 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 影響範圍 */}
          <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-100">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-amber-600 uppercase tracking-wider mb-1">
                  影響範圍
                </p>
                <div className="text-gray-700 leading-relaxed text-sm prose prose-sm max-w-none prose-amber">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{impactScope}</ReactMarkdown>
                </div>
              </div>
            </div>
          </div>

          {/* 目前狀態 */}
          <div className="bg-[--color-soc]/5 rounded-xl p-4 border border-[--color-soc]/20">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-[--color-soc]/10 text-[--color-soc] flex items-center justify-center flex-shrink-0">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-[--color-soc] uppercase tracking-wider mb-1">
                  目前狀態
                </p>
                <div className="text-gray-700 leading-relaxed text-sm prose prose-sm max-w-none prose-blue">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentStatus}</ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 立即建議列表 */}
        <div className="bg-gray-50/50 rounded-xl p-4 border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-6 w-6 rounded-md bg-red-100 text-red-600 flex items-center justify-center">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
            <p className="text-sm font-semibold text-gray-700">
              立即建議（P0 優先級）
            </p>
          </div>
          <ul className="space-y-2">
            {immediateActions.slice(0, 5).map((action, index) => (
              <li key={index} className="text-gray-700 text-sm leading-relaxed prose prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{action}</ReactMarkdown>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Actions 區塊 */}
      <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onDownloadPDF}
          className="gap-2 bg-white border-gray-200 hover:bg-gray-50 hover:text-gray-900"
        >
          <Download className="h-4 w-4" />
          下載完整 PDF 報告
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onCopySummary}
          className="gap-2 bg-white border-gray-200 hover:bg-gray-50 hover:text-gray-900"
        >
          <Copy className="h-4 w-4" />
          複製簡短摘要
        </Button>
      </div>
    </div>
  );
}