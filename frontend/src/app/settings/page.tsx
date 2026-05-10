'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Settings, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="h-6 w-6 text-gray-600" />
        <h1 className="text-2xl font-semibold">AI 設定</h1>
      </div>

      <div className="bg-white rounded-lg border p-6 space-y-6">
        {/* Provider Selection */}
        <div>
          <label className="block text-sm font-medium mb-3">AI Provider</label>
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="provider"
                value="minimax"
                checked={settings.provider === 'minimax'}
                onChange={() => handleProviderChange('minimax')}
                className="h-4 w-4 text-blue-600"
              />
              <div>
                <div className="font-medium">MiniMax</div>
                <div className="text-sm text-gray-500">使用 MiniMax API {settings.hasMinimaxKey ? '✓ 已設定 API Key' : '✗ 未設定 API Key'}</div>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="provider"
                value="ollama"
                checked={settings.provider === 'ollama'}
                onChange={() => handleProviderChange('ollama')}
                className="h-4 w-4 text-blue-600"
              />
              <div>
                <div className="font-medium">Ollama</div>
                <div className="text-sm text-gray-500">使用本地 Ollama 模型 {settings.hasOllamaEndpoint ? '✓ 已設定端點' : '✗ 未設定端點'}</div>
              </div>
            </label>
          </div>
        </div>

        {/* Ollama Settings */}
        {settings.provider === 'ollama' && (
          <div className="space-y-4 pt-4 border-t">
            <div>
              <label className="block text-sm font-medium mb-2">Ollama Endpoint</label>
              <input
                type="text"
                value={settings.ollamaEndpoint || ''}
                onChange={(e) => handleEndpointChange(e.target.value)}
                placeholder="http://localhost:11434"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Model</label>
              <input
                type="text"
                value={settings.minimaxModel || ''}
                onChange={(e) => handleModelChange(e.target.value)}
                placeholder="llama3"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Test Result */}
        {testResult && (
          <div
            className={`flex items-center gap-2 p-3 rounded-lg ${
              testResult.success
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {testResult.success ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <XCircle className="h-5 w-5" />
            )}
            {testResult.message}
          </div>
        )}

        {/* Save Result */}
        {saveResult && (
          <div
            className={`flex items-center gap-2 p-3 rounded-lg ${
              saveResult === '設定已儲存'
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {saveResult === '設定已儲存' ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <XCircle className="h-5 w-5" />
            )}
            {saveResult}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                儲存中...
              </>
            ) : (
              '儲存設定'
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing}
          >
            {testing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                測試中...
              </>
            ) : (
              '測試連線'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}