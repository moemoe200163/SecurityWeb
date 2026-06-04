import { prisma } from '../db/client.js';

// ─── Provider definitions ────────────────────────────────────────────

export type ProviderId = 'minimax' | 'openai' | 'anthropic' | 'xiaomi' | 'ollama';

export type HealthStatus =
  | 'not_configured'
  | 'healthy'
  | 'auth_error'
  | 'billing_error'
  | 'permission_error'
  | 'model_error'
  | 'rate_limited'
  | 'endpoint_error'
  | 'timeout'
  | 'unknown_error';

export interface ProviderConfig {
  id: ProviderId;
  displayName: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  enabled: boolean;
  authHeader: string;       // header name for auth
  authPrefix: string;       // prefix before key value (e.g. "Bearer ", "")
  endpointPath: string;     // path to call for health check
  apiShape: 'openai-chat' | 'anthropic-messages' | 'ollama';
}

export interface HealthCheckResult {
  provider: ProviderId;
  status: HealthStatus;
  ok: boolean;
  latencyMs: number;
  model: string;
  baseUrl: string;
  checkedAt: string;
  message: string;
  safeError: string | null;
}

// ─── Setting key helpers ─────────────────────────────────────────────

function key(id: string, suffix: string) {
  return `LLM_${id.toUpperCase()}_${suffix}`;
}

// ─── Provider defaults ───────────────────────────────────────────────

const PROVIDER_DEFAULTS: Record<ProviderId, Partial<ProviderConfig>> = {
  minimax: {
    displayName: 'MiniMax',
    baseUrl: 'https://api.minimax.io/v1',
    model: 'MiniMax-Text-01',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
    endpointPath: '/chat/completions',
    apiShape: 'openai-chat',
  },
  openai: {
    displayName: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
    endpointPath: '/chat/completions',
    apiShape: 'openai-chat',
  },
  anthropic: {
    displayName: 'Claude (Anthropic)',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-20250514',
    authHeader: 'x-api-key',
    authPrefix: '',
    endpointPath: '/v1/messages',
    apiShape: 'anthropic-messages',
  },
  xiaomi: {
    displayName: 'Xiaomi MiMo',
    baseUrl: 'https://api.xiaomimimo.com/v1',
    model: 'MiMo-7B-RL',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
    endpointPath: '/chat/completions',
    apiShape: 'openai-chat',
  },
  ollama: {
    displayName: 'Ollama (Local)',
    baseUrl: 'http://localhost:11434',
    model: 'llama3',
    authHeader: '',
    authPrefix: '',
    endpointPath: '/api/tags',
    apiShape: 'ollama',
  },
};

// ─── Read config from DB ────────────────────────────────────────────

export async function getProviderConfig(id: ProviderId): Promise<ProviderConfig> {
  const defaults = PROVIDER_DEFAULTS[id];
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: [key(id, 'BASE_URL'), key(id, 'API_KEY'), key(id, 'MODEL'), key(id, 'ENABLED')] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    id,
    displayName: defaults.displayName!,
    baseUrl: map.get(key(id, 'BASE_URL')) || defaults.baseUrl!,
    model: map.get(key(id, 'MODEL')) || defaults.model!,
    apiKey: map.get(key(id, 'API_KEY')) || '',
    enabled: map.get(key(id, 'ENABLED')) !== 'false',
    authHeader: defaults.authHeader!,
    authPrefix: defaults.authPrefix!,
    endpointPath: defaults.endpointPath!,
    apiShape: defaults.apiShape!,
  };
}

export async function getAllProviderConfigs(): Promise<ProviderConfig[]> {
  const ids: ProviderId[] = ['minimax', 'openai', 'anthropic', 'xiaomi', 'ollama'];
  return Promise.all(ids.map(getProviderConfig));
}

// ─── Save provider config to DB ─────────────────────────────────────

export async function saveProviderConfig(config: ProviderConfig): Promise<void> {
  const updates: Array<{ key: string; value: string; desc: string }> = [
    { key: key(config.id, 'BASE_URL'), value: config.baseUrl, desc: `${config.displayName} base URL` },
    { key: key(config.id, 'MODEL'), value: config.model, desc: `${config.displayName} model` },
    { key: key(config.id, 'ENABLED'), value: String(config.enabled), desc: `${config.displayName} enabled` },
  ];
  // Only save apiKey if provided (don't overwrite with empty)
  if (config.apiKey) {
    updates.push({ key: key(config.id, 'API_KEY'), value: config.apiKey, desc: `${config.displayName} API key` });
  }
  for (const u of updates) {
    await prisma.systemSetting.upsert({
      where: { key: u.key },
      update: { value: u.value, desc: u.desc },
      create: { key: u.key, value: u.value, desc: u.desc },
    });
  }
}

// ─── Health check implementations ────────────────────────────────────

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function classifyError(status: number, body: string): HealthStatus {
  if (status === 401 || status === 403) return 'auth_error';
  if (status === 402) return 'billing_error';
  if (status === 404) return 'model_error';
  if (status === 429) return 'rate_limited';
  if (status === 400 && /model/i.test(body)) return 'model_error';
  return 'unknown_error';
}

function okResult(config: ProviderConfig, latencyMs: number): HealthCheckResult {
  return {
    provider: config.id,
    status: 'healthy',
    ok: true,
    latencyMs,
    model: config.model,
    baseUrl: config.baseUrl,
    checkedAt: new Date().toISOString(),
    message: 'Provider responded successfully.',
    safeError: null,
  };
}

function errResult(config: ProviderConfig, status: HealthStatus, latencyMs: number, msg: string): HealthCheckResult {
  const messages: Record<HealthStatus, string> = {
    not_configured: 'API key not configured.',
    healthy: 'OK.',
    auth_error: 'API key is invalid or revoked.',
    billing_error: 'Billing issue or insufficient credits.',
    permission_error: 'Insufficient permissions for this model.',
    model_error: 'Model not found or not accessible.',
    rate_limited: 'Rate limited. Try again later.',
    endpoint_error: 'Base URL is unreachable.',
    timeout: 'Request timed out.',
    unknown_error: 'Unexpected error.',
  };
  return {
    provider: config.id,
    status,
    ok: false,
    latencyMs,
    model: config.model,
    baseUrl: config.baseUrl,
    checkedAt: new Date().toISOString(),
    message: messages[status],
    safeError: msg,
  };
}

// ─── Test: OpenAI-compatible (MiniMax, OpenAI, Xiaomi) ───────────────

async function testOpenAICompatible(config: ProviderConfig): Promise<HealthCheckResult> {
  if (!config.apiKey) return errResult(config, 'not_configured', 0, 'No API key set.');

  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const body = JSON.stringify({
    model: config.model,
    messages: [{ role: 'user', content: 'Reply with only: ok' }],
    max_tokens: 8,
  });

  const start = Date.now();
  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [config.authHeader]: `${config.authPrefix}${config.apiKey}`,
      },
      body,
    });
    const latencyMs = Date.now() - start;
    const text = await res.text();

    if (res.ok) return okResult(config, latencyMs);

    // Fallback: some providers don't support max_tokens → try max_completion_tokens
    if (res.status === 400 && /max_tokens/i.test(text)) {
      const fallbackBody = body.replace('"max_tokens":8', '"max_completion_tokens":8');
      const res2 = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [config.authHeader]: `${config.authPrefix}${config.apiKey}`,
        },
        body: fallbackBody,
      });
      const latency2 = Date.now() - start;
      if (res2.ok) return okResult(config, latency2);
      const text2 = await res2.text();
      return errResult(config, classifyError(res2.status, text2), latency2, truncate(text2));
    }

    return errResult(config, classifyError(res.status, text), latencyMs, truncate(text));
  } catch (e: unknown) {
    const latencyMs = Date.now() - start;
    if (e instanceof Error && e.name === 'AbortError') {
      return errResult(config, 'timeout', latencyMs, 'Request timed out after 15s.');
    }
    return errResult(config, 'endpoint_error', latencyMs, e instanceof Error ? e.message : 'Network error');
  }
}

// ─── Test: Anthropic Messages API ───────────────────────────────────

async function testAnthropic(config: ProviderConfig): Promise<HealthCheckResult> {
  if (!config.apiKey) return errResult(config, 'not_configured', 0, 'No API key set.');

  const url = `${config.baseUrl.replace(/\/$/, '')}/v1/messages`;
  const body = JSON.stringify({
    model: config.model,
    max_tokens: 8,
    messages: [{ role: 'user', content: 'Reply with only: ok' }],
  });

  const start = Date.now();
  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body,
    });
    const latencyMs = Date.now() - start;
    const text = await res.text();

    if (res.ok) return okResult(config, latencyMs);

    return errResult(config, classifyError(res.status, text), latencyMs, truncate(text));
  } catch (e: unknown) {
    const latencyMs = Date.now() - start;
    if (e instanceof Error && e.name === 'AbortError') {
      return errResult(config, 'timeout', latencyMs, 'Request timed out after 15s.');
    }
    return errResult(config, 'endpoint_error', latencyMs, e instanceof Error ? e.message : 'Network error');
  }
}

// ─── Test: Ollama ───────────────────────────────────────────────────

async function testOllama(config: ProviderConfig): Promise<HealthCheckResult> {
  const baseUrl = config.baseUrl.replace(/\/$/, '');

  // Step 1: Check if Ollama is reachable via /api/tags
  const start = Date.now();
  try {
    const tagsRes = await fetchWithTimeout(`${baseUrl}/api/tags`, { method: 'GET' });
    if (!tagsRes.ok) {
      const latencyMs = Date.now() - start;
      return errResult(config, 'endpoint_error', latencyMs, `Ollama unreachable: ${tagsRes.status}`);
    }
  } catch (e: unknown) {
    const latencyMs = Date.now() - start;
    if (e instanceof Error && e.name === 'AbortError') {
      return errResult(config, 'timeout', latencyMs, 'Ollama unreachable (timeout).');
    }
    return errResult(config, 'endpoint_error', latencyMs, e instanceof Error ? e.message : 'Network error');
  }

  // Step 2: Test with selected model via /api/chat
  const chatUrl = `${baseUrl}/api/chat`;
  const body = JSON.stringify({
    model: config.model,
    messages: [{ role: 'user', content: 'Reply with only: ok' }],
    stream: false,
  });

  const startChat = Date.now();
  try {
    const res = await fetchWithTimeout(chatUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }, 30000); // Ollama can be slower
    const latencyMs = Date.now() - startChat;
    const text = await res.text();

    if (res.ok) return okResult(config, latencyMs);

    // 404 usually means model not found
    if (res.status === 404) {
      return errResult(config, 'model_error', latencyMs, `Model "${config.model}" not found. Pull it with: ollama pull ${config.model}`);
    }
    return errResult(config, classifyError(res.status, text), latencyMs, truncate(text));
  } catch (e: unknown) {
    const latencyMs = Date.now() - startChat;
    if (e instanceof Error && e.name === 'AbortError') {
      return errResult(config, 'timeout', latencyMs, 'Chat request timed out after 30s.');
    }
    return errResult(config, 'endpoint_error', latencyMs, e instanceof Error ? e.message : 'Network error');
  }
}

// ─── Main test dispatcher ────────────────────────────────────────────

export async function testProvider(id: ProviderId): Promise<HealthCheckResult> {
  const config = await getProviderConfig(id);

  switch (config.apiShape) {
    case 'openai-chat':
      return testOpenAICompatible(config);
    case 'anthropic-messages':
      return testAnthropic(config);
    case 'ollama':
      return testOllama(config);
    default:
      return errResult(config, 'unknown_error', 0, `Unknown API shape for provider ${id}`);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

function truncate(s: string, max = 200): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

// ─── Safe metadata (no secrets) ──────────────────────────────────────

export interface ProviderSafeMeta {
  id: ProviderId;
  displayName: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
  hasKey: boolean;
  keyPreview: string | null; // e.g. "sk-f2c9...ABCD"
}

export async function getAllProvidersSafe(): Promise<ProviderSafeMeta[]> {
  const configs = await getAllProviderConfigs();
  return configs.map((c) => ({
    id: c.id,
    displayName: c.displayName,
    baseUrl: c.baseUrl,
    model: c.model,
    enabled: c.enabled,
    hasKey: !!c.apiKey,
    keyPreview: c.apiKey ? maskKey(c.apiKey) : null,
  }));
}

function maskKey(key: string): string {
  if (key.length <= 8) return '••••••••';
  return key.slice(0, 4) + '••••' + key.slice(-4);
}
