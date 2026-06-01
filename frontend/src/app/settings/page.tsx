'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { CheckCircle, XCircle, Loader2, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHero } from '@/components/layout/PageHero';

interface AISettings {
  provider: string;
  minimaxApiKey: string;
  minimaxApiEndpoint: string;
  minimaxModel: string;
  ollamaEndpoint: string;
  hasMinimaxKey: boolean;
  hasOllamaEndpoint: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AISettings>({
    provider: 'minimax',
    minimaxApiKey: '',
    minimaxApiEndpoint: '',
    minimaxModel: '',
    ollamaEndpoint: '',
    hasMinimaxKey: false,
    hasOllamaEndpoint: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveResult, setSaveResult] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await api.settings.getAI();
        setSettings({
          provider: data.provider || 'minimax',
          minimaxApiKey: data.minimaxApiKey || '',
          minimaxApiEndpoint: data.minimaxApiEndpoint || '',
          minimaxModel: data.minimaxModel || '',
          ollamaEndpoint: data.ollamaEndpoint || '',
          hasMinimaxKey: data.hasMinimaxKey || false,
          hasOllamaEndpoint: data.hasOllamaEndpoint || false,
        });
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleProviderChange = (provider: string) => {
    setSettings((prev) => ({ ...prev, provider }));
    setTestResult(null);
  };

  const handleModelChange = (model: string) => {
    setSettings((prev) => ({ ...prev, minimaxModel: model }));
    setTestResult(null);
  };

  const handleEndpointChange = (endpoint: string) => {
    setSettings((prev) => ({ ...prev, ollamaEndpoint: endpoint }));
    setTestResult(null);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveResult(null);
      await api.settings.updateAI({
        provider: settings.provider,
        minimaxApiKey: settings.minimaxApiKey || undefined,
        minimaxApiEndpoint: settings.minimaxApiEndpoint || undefined,
        minimaxModel: settings.minimaxModel || undefined,
        ollamaEndpoint: settings.ollamaEndpoint || undefined,
      });
      setSaveResult('設定已儲存');
    } catch (err) {
      console.error('Failed to save settings:', err);
      setSaveResult('儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const result = await api.settings.testAI({
        provider: settings.provider,
        ollamaEndpoint: settings.provider === 'ollama' ? settings.ollamaEndpoint : undefined,
      });
      setTestResult(result);
    } catch (err) {
      console.error('Failed to test connection:', err);
      setTestResult({ success: false, message: '連線測試失敗' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--terminal-green)]" />
      </div>
    );
  }

  return (
    <div className="min-h-full animate-fade-in-up">
      <PageHero
        icon={<Terminal className="h-8 w-8 text-[var(--terminal-green)]" />}
        title="系統設定"
        subtitle="AI PROVIDER CONFIGURATION"
        command="ai-config --provider-settings"
        commandValue={settings.provider}
      />

      <div className="max-w-2xl mx-auto p-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-6">
        {/* Provider Selection */}
        <div>
          <label className="block text-sm font-medium mb-3 text-[var(--foreground)]">
            <span className="font-mono text-[var(--terminal-green)]">$</span> select-provider
          </label>
          <div className="space-y-2">
            <label className="group flex items-center gap-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] cursor-pointer hover:border-[var(--terminal-green)]/50 transition-all duration-300">
              <input
                type="radio"
                name="provider"
                value="minimax"
                checked={settings.provider === 'minimax'}
                onChange={() => handleProviderChange('minimax')}
                className="h-4 w-4 text-[var(--terminal-green)]"
              />
              <div className="flex-1">
                <div className="font-medium text-[var(--foreground)]">MiniMax</div>
                <div className="text-sm font-mono text-[var(--muted-foreground)]">
                  {settings.hasMinimaxKey ? '[+] API Key configured' : '[-] API Key not set'}
                </div>
              </div>
              <div className={`w-2 h-2 rounded-full ${settings.provider === 'minimax' ? 'bg-[var(--terminal-green)] animate-pulse' : 'bg-[var(--border)]'}`} />
            </label>
            <label className="group flex items-center gap-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] cursor-pointer hover:border-[var(--terminal-green)]/50 transition-all duration-300">
              <input
                type="radio"
                name="provider"
                value="ollama"
                checked={settings.provider === 'ollama'}
                onChange={() => handleProviderChange('ollama')}
                className="h-4 w-4 text-[var(--terminal-green)]"
              />
              <div className="flex-1">
                <div className="font-medium text-[var(--foreground)]">Ollama</div>
                <div className="text-sm font-mono text-[var(--muted-foreground)]">
                  {settings.hasOllamaEndpoint ? '[+] Endpoint configured' : '[-] Endpoint not set'}
                </div>
              </div>
              <div className={`w-2 h-2 rounded-full ${settings.provider === 'ollama' ? 'bg-[var(--terminal-green)] animate-pulse' : 'bg-[var(--border)]'}`} />
            </label>
          </div>
        </div>

        {/* Ollama Settings */}
        {settings.provider === 'ollama' && (
          <div className="space-y-4 pt-4 border-t border-[var(--border)]">
            <div className="relative">
              <label className="block text-sm font-medium mb-2 text-[var(--foreground)]">
                <span className="font-mono text-[var(--terminal-green)]">$</span> ollama-endpoint
              </label>
              <input
                type="text"
                value={settings.ollamaEndpoint || ''}
                onChange={(e) => handleEndpointChange(e.target.value)}
                placeholder="http://localhost:11434"
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] font-mono focus:outline-none focus:ring-2 focus:ring-[var(--terminal-green)] focus:border-[var(--terminal-green)]/50 transition-all duration-300"
              />
            </div>
            <div className="relative">
              <label className="block text-sm font-medium mb-2 text-[var(--foreground)]">
                <span className="font-mono text-[var(--terminal-green)]">$</span> model-name
              </label>
              <input
                type="text"
                value={settings.minimaxModel || ''}
                onChange={(e) => handleModelChange(e.target.value)}
                placeholder="llama3"
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] font-mono focus:outline-none focus:ring-2 focus:ring-[var(--terminal-green)] focus:border-[var(--terminal-green)]/50 transition-all duration-300"
              />
            </div>
          </div>
        )}

        {/* Test Result */}
        {testResult && (
          <div
            className={`flex items-center gap-2 p-3 rounded-xl font-mono ${
              testResult.success
                ? 'bg-[var(--terminal-green)]/10 text-[var(--terminal-green)] border border-[var(--terminal-green)]/20'
                : 'bg-[var(--terminal-amber)]/10 text-[var(--terminal-amber)] border border-[var(--terminal-amber)]/20'
            }`}
          >
            {testResult.success ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <XCircle className="h-5 w-5" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}

        {/* Save Result */}
        {saveResult && (
          <div
            className={`flex items-center gap-2 p-3 rounded-xl font-mono ${
              saveResult === '設定已儲存'
                ? 'bg-[var(--terminal-green)]/10 text-[var(--terminal-green)] border border-[var(--terminal-green)]/20'
                : 'bg-[var(--terminal-amber)]/10 text-[var(--terminal-amber)] border border-[var(--terminal-amber)]/20'
            }`}
          >
            {saveResult === '設定已儲存' ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <XCircle className="h-5 w-5" />
            )}
            <span>{saveResult}</span>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 pt-4 border-t border-[var(--border)]">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[var(--terminal-green)] hover:bg-[var(--terminal-green)]/90 text-black font-medium"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                儲存中...
              </>
            ) : (
              <>
                <span className="font-mono mr-2">$</span> save-config
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing}
            className="border-[var(--border)] text-[var(--foreground)] hover:border-[var(--terminal-green)]/50 hover:text-[var(--terminal-green)]"
          >
            {testing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                測試中...
              </>
            ) : (
              <>
                <span className="font-mono mr-2">$</span> test-connection
              </>
            )}
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
}
