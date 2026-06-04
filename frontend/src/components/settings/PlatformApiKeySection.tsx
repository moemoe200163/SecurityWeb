'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Loader2, Copy, Check, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/ui/SectionCard';
import { getApiKey, setApiKey, clearApiKey } from '@/lib/api';

const DEV_API_KEY = 'sk-0000000000000000000000000000000000000000000000000000000000000001';
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function PlatformApiKeySection() {
  const [apiKey, setApiKeyState] = useState('');
  const [apiKeyStatus, setApiKeyStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [testingApiKey, setTestingApiKey] = useState(false);
  const [devKeyCopied, setDevKeyCopied] = useState(false);
  const [isDev, setIsDev] = useState(false);

  useEffect(() => {
    setIsDev(window.location.hostname === 'localhost');
    const stored = getApiKey();
    if (stored) {
      setApiKeyState(stored);
    }
  }, []);

  const handleTestApiKey = async () => {
    try {
      setTestingApiKey(true);
      const response = await fetch(`${API_BASE}/api/me/api-key`, {
        headers: { 'X-API-Key': apiKey },
      });
      setApiKeyStatus(response.ok ? 'valid' : 'invalid');
    } catch {
      setApiKeyStatus('invalid');
    } finally {
      setTestingApiKey(false);
    }
  };

  const handleSaveApiKey = () => {
    if (apiKey.trim() && apiKeyStatus === 'valid') {
      setApiKey(apiKey.trim());
    }
  };

  const handleClearApiKey = () => {
    clearApiKey();
    setApiKeyState('');
    setApiKeyStatus('idle');
  };

  const handleCopyDevKey = () => {
    navigator.clipboard.writeText(DEV_API_KEY);
    setApiKeyState(DEV_API_KEY);
    setApiKeyStatus('idle');
    setDevKeyCopied(true);
    setTimeout(() => setDevKeyCopied(false), 2000);
  };

  return (
    <SectionCard title="SecurityWeb Access Key">
      <div className="space-y-4">
        <p className="text-xs text-[var(--muted-foreground)]">
          此 Key 用於授權存取 SecurityWeb 後端 API（/alerts、/tools、/dashboard 等）。
        </p>

        <div className="flex gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => { setApiKeyState(e.target.value); setApiKeyStatus('idle'); }}
            placeholder="sk-..."
            className="flex-1 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[var(--terminal-green)] focus:border-[var(--terminal-green)]/50 transition-all duration-300"
          />
          <Button variant="outline" onClick={handleTestApiKey} disabled={testingApiKey || !apiKey.trim()} className="border-[var(--border)] text-[var(--foreground)] hover:border-[var(--terminal-green)]/50">
            {testingApiKey ? <Loader2 className="h-4 w-4 animate-spin" /> : '測試'}
          </Button>
          <Button onClick={handleSaveApiKey} disabled={!apiKey.trim() || apiKeyStatus !== 'valid'} className="bg-[var(--terminal-green)] hover:bg-[var(--terminal-green)]/90 text-black font-medium">
            儲存
          </Button>
          <Button variant="outline" onClick={handleClearApiKey} disabled={!apiKey} className="border-[var(--border)] text-[var(--foreground)] hover:border-red-500/50 hover:text-red-500">
            清除
          </Button>
        </div>

        {apiKeyStatus === 'valid' && (
          <div className="flex items-center gap-2 text-sm text-[var(--terminal-green)] font-mono">
            <CheckCircle className="h-4 w-4" />
            API Key 已設定且有效
          </div>
        )}
        {apiKeyStatus === 'invalid' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-red-500 font-mono">
              <XCircle className="h-4 w-4" />
              API Key 無效或無法連線
            </div>
            <div className="flex items-start gap-2 text-xs text-[var(--terminal-amber)] bg-[var(--terminal-amber)]/5 border border-[var(--terminal-amber)]/20 rounded-lg p-2">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>這是 SecurityWeb 平台存取 Key，不是 MiniMax / LLM API Key。</span>
            </div>
          </div>
        )}

        {isDev && (
          <div className="p-3 bg-[var(--terminal-green)]/5 border border-[var(--terminal-green)]/20 rounded-lg space-y-2">
            <div className="text-xs font-mono text-[var(--muted-foreground)]">
              開發模式：使用本機測試 Key 解鎖 /tools、/alerts
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono text-[var(--foreground)] bg-[var(--background)] px-2 py-1 rounded truncate">
                {DEV_API_KEY}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyDevKey}
                className="shrink-0 border-[var(--terminal-green)]/30 text-[var(--terminal-green)] hover:bg-[var(--terminal-green)]/10"
              >
                {devKeyCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                <span className="ml-1">{devKeyCopied ? '已複製' : '複製'}</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
