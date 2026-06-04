/**
 * API Client - 連接後端 API
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const API_KEY_STORAGE = 'api_key';

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Read the X-API-Key from localStorage. Centralized here so callers don't
 * sprinkle `localStorage.getItem('api_key')` across the codebase.
 */
export function getApiKey(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(API_KEY_STORAGE) || '';
}

export function setApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  if (key) window.localStorage.setItem(API_KEY_STORAGE, key);
  else window.localStorage.removeItem(API_KEY_STORAGE);
}

export function clearApiKey(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(API_KEY_STORAGE);
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** When true, attach X-API-Key from localStorage. Default true. */
  requireAuth?: boolean;
  signal?: AbortSignal;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, requireAuth = false, signal } = options;

  const headers: Record<string, string> = {};

  if (requireAuth) {
    const key = getApiKey();
    if (!key) {
      throw new ApiError('Missing API key. Please sign in again.', 401);
    }
    headers['X-API-Key'] = key;
  }

  const config: RequestInit = {
    method,
    headers,
    ...(signal ? { signal } : {}),
  };

  if (body !== undefined && body !== null) {
    headers['Content-Type'] = 'application/json';
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, config);

  const text = await response.text();
  const data = text ? safeJsonParse(text) : undefined;

  if (!response.ok) {
    const message =
      (data as { error?: string; message?: string } | undefined)?.error ||
      (data as { message?: string } | undefined)?.message ||
      `HTTP ${response.status}`;
    throw new ApiError(message, response.status, data);
  }

  return data as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// Types
export interface SessionResponse {
  sessionId: string;
  status: string;
  currentStep: number;
  message: string;
}

export interface SessionDetail {
  id: string;
  module: string;
  input: unknown;
  status: string;
  createdAt: string;
  updatedAt: string;
  steps: StepDetail[];
  messages: MessageDetail[];
}

export interface StepDetail {
  id: string;
  order: number;
  title: string;
  status: 'pending' | 'running' | 'success' | 'error';
  content?: string;
  codeBlock?: string;
  toolCalls?: unknown[];
  timestamp?: string;
}

export interface MessageDetail {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

// IP Reputation Types
export interface IpReputationResult {
  ip: string;
  status: 'malicious' | 'suspicious' | 'normal' | 'unknown';
  threatLevel: 'high' | 'medium' | 'low' | 'none';
  confidenceScore: number | null;
  countryCode?: string;
  countryName?: string;
  isp?: string;
  domain?: string;
  usageType?: string;
  totalReports?: number;
  isWhitelisted?: boolean;
  sources: Array<{
    name: string;
    listCount?: number;
    confidenceScore?: number;
    totalReports?: number;
    lastReported?: string;
    pulseCount?: number;
  }>;
  cached: boolean;
  updatedAt: string;
}

export interface IpReputationStats {
  total: number;
  malicious: number;
  suspicious: number;
  normal: number;
  unknown: number;
}

export interface BgpUpdate {
  id: string;
  prefix: string;
  asPath: string | null;
  peerAsn: string | null;
  originAsn: string | null;
  timestamp: string;
  type: 'A' | 'W';
  source: string | null;
  country: string | null;
  org: string | null;
  hijack_suspicion: boolean;
  suspicion_level: 'none' | 'low' | 'medium' | 'high';
  suspicion_reasons: string[];
}

export interface BgpQueryResult {
  data: BgpUpdate[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface BgpStats {
  totalUpdates: number;
  announces: number;
  withdraws: number;
  uniquePrefixes: number;
  uniqueAsns: number;
  since: string;
}

export interface UrlHausResult {
  domain: string;
  malicious: boolean;
  status: 'online' | 'offline' | 'unknown' | 'clean';
  threatType: string | null;
  blacklists: Array<{ name: string; count: number; lastseen: string | null }>;
  urlCount: number;
  lastSeen: string | null;
  firstSeen: string | null;
  cannedResponse: unknown;
  cached: boolean;
  updatedAt: string;
}

export interface OtxPulse {
  id: string;
  name: string;
  description: string;
  tags: string[];
  created: string;
  modified: string;
  indicatorCount: number;
}

export interface OtxCheckResult {
  indicator: string;
  type: string;
  pulseCount: number;
  pulses: OtxPulse[];
  country: string | null;
  city: string | null;
  asn: string | null;
  hostname: string | null;
  url: string | null;
  mimeType: string | null;
  dhash: string | null;
  ssdeep: string | null;
  fileType: string | null;
  fileSize: number | null;
  malware: unknown;
  analysis: unknown;
  ufdst: unknown;
  cached: boolean;
  updatedAt: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Evidence {
  id: string;
  sessionId: string;
  alertId: string | null;
  toolExecutionId: string | null;
  type: 'tool' | 'intelligence' | 'manual' | 'ai';
  title: string;
  content: string;
  data: unknown;
  createdById: string | null;
  createdAt: string;
}

// API Functions
export const api = {
  // SOC (protected)
  soc: {
    async analyze(input: { alertId?: string; rawContent?: string }): Promise<SessionResponse> {
      return request<SessionResponse>('/api/soc/analyze', {
        method: 'POST',
        body: input,
        requireAuth: true,
      });
    },
    async getSessions(): Promise<{ sessions: SessionDetail[] }> {
      return request('/api/soc/sessions', { requireAuth: true });
    },
    async getSession(id: string): Promise<{ session: SessionDetail }> {
      return request(`/api/soc/sessions/${id}`, { requireAuth: true });
    },
    async sendMessage(sessionId: string, content: string): Promise<{ message: MessageDetail }> {
      return request(`/api/soc/sessions/${sessionId}/messages`, {
        method: 'POST',
        body: { content },
        requireAuth: true,
      });
    },
  },

  // Threat (protected)
  threat: {
    async investigate(input: { type: 'ip' | 'domain' | 'hash'; value: string; type2?: 'simulation' | 'live' }): Promise<SessionResponse> {
      return request<SessionResponse>('/api/threat/investigate', {
        method: 'POST',
        body: input,
        requireAuth: true,
      });
    },
    async getSessions(): Promise<{ sessions: SessionDetail[] }> {
      return request('/api/threat/sessions', { requireAuth: true });
    },
    async getSession(id: string): Promise<{ session: SessionDetail }> {
      return request(`/api/threat/sessions/${id}`, { requireAuth: true });
    },
    async sendMessage(sessionId: string, content: string): Promise<{ message: MessageDetail }> {
      return request(`/api/threat/sessions/${sessionId}/messages`, {
        method: 'POST',
        body: { content },
        requireAuth: true,
      });
    },
  },

  // Pentest (protected)
  pentest: {
    async assist(input: {
      template?: string;
      target: string;
      scope?: string;
      testType?: string;
      ports?: string;
      intensity?: string;
      url?: string;
      auth?: string;
      cookies?: string;
      endpoint?: string;
      method?: string;
      headers?: string;
      service?: string;
      username?: string;
      customInput?: string;
      timeLimit?: string;
      authorizationConfirmed?: boolean;
      authorizationOwner?: string;
      authorizationScope?: string;
      authorizationExpiresAt?: string;
    }): Promise<SessionResponse> {
      return request<SessionResponse>('/api/pentest/assist', {
        method: 'POST',
        body: input,
        requireAuth: true,
      });
    },
    async getSessions(): Promise<{ sessions: SessionDetail[] }> {
      return request('/api/pentest/sessions', { requireAuth: true });
    },
    async getSession(id: string): Promise<{ session: SessionDetail }> {
      return request(`/api/pentest/sessions/${id}`, { requireAuth: true });
    },
    async sendMessage(sessionId: string, content: string): Promise<{ message: MessageDetail }> {
      return request(`/api/pentest/sessions/${sessionId}/messages`, {
        method: 'POST',
        body: { content },
        requireAuth: true,
      });
    },
    async downloadReport(sessionId: string): Promise<Blob> {
      const key = getApiKey();
      if (!key) throw new ApiError('Missing API key.', 401);
      const response = await fetch(`${API_BASE}/api/report/${sessionId}/pdf`, {
        headers: { 'X-API-Key': key },
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new ApiError(text || 'Failed to download report', response.status);
      }
      return response.blob();
    },
    async getReportData(sessionId: string): Promise<{
      sessionId: string;
      createdAt: string;
      status: string;
      input: Record<string, string>;
      steps: Array<{ title: string; content: string; status: string }>;
      vulnerabilities: Array<{ name: string; description: string; riskLevel: string; cvss: string; cve?: string }>;
      riskAssessment: { scope: string; attackVector: string; impact: string };
      remediation: { shortTerm: string[]; longTerm: string[] };
      summary: { critical: number; high: number; medium: number; low: number; info: number };
    }> {
      return request(`/api/report/${sessionId}/json`, { requireAuth: true });
    },
  },

  // IP Reputation (protected)
  ip: {
    async check(ip: string, forceRefresh = false): Promise<IpReputationResult> {
      const params = new URLSearchParams({ ip });
      if (forceRefresh) params.set('forceRefresh', 'true');
      return request<IpReputationResult>(`/api/ip/check?${params}`, { requireAuth: true });
    },
    async history(): Promise<{ history: IpReputationResult[] }> {
      return request('/api/ip/history', { requireAuth: true });
    },
    async stats(): Promise<IpReputationStats> {
      return request('/api/ip/stats', { requireAuth: true });
    },
    async blacklist(params: {
      page?: number;
      limit?: number;
      status?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: string;
    }): Promise<{ data: IpReputationResult[]; pagination: PaginationInfo }> {
      const query = new URLSearchParams();
      if (params.page) query.set('page', String(params.page));
      if (params.limit) query.set('limit', String(params.limit));
      if (params.status) query.set('status', params.status);
      if (params.search) query.set('search', params.search);
      if (params.sortBy) query.set('sortBy', params.sortBy);
      if (params.sortOrder) query.set('sortOrder', params.sortOrder);
      return request(`/api/ip/blacklist?${query}`, { requireAuth: true });
    },
  },

  // BGP (protected)
  bgp: {
    async query(params: {
      prefix?: string;
      asn?: string;
      page?: number;
      limit?: number;
      start_time?: string;
    }): Promise<BgpQueryResult> {
      const query = new URLSearchParams();
      if (params.prefix) query.set('prefix', params.prefix);
      if (params.asn) query.set('asn', params.asn);
      if (params.page) query.set('page', String(params.page));
      if (params.limit) query.set('limit', String(params.limit));
      if (params.start_time) query.set('start_time', params.start_time);
      return request(`/api/bgp/query?${query}`, { requireAuth: true });
    },
    async stats(): Promise<BgpStats> {
      return request('/api/bgp/stats', { requireAuth: true });
    },
    async lookup(resource: string): Promise<{ resource: string; type: string; announced: boolean; asns: { asn: number; holder: string; country?: string }[]; block: { resource: string; desc: string } | null }> {
      const query = new URLSearchParams({ resource });
      return request(`/api/bgp/lookup?${query}`, { requireAuth: true });
    },
    async whois(asn: string): Promise<{ asn: string; holder: string; country: string; block: string }> {
      return request(`/api/bgp/whois/${encodeURIComponent(asn)}`, { requireAuth: true });
    },
    async prefixes(asn: string): Promise<{ prefixes: Array<{ prefix: string; type: 'ipv4' | 'ipv6' }> }> {
      return request(`/api/bgp/prefixes/${encodeURIComponent(asn)}`, { requireAuth: true });
    },
  },

  // URLhaus (protected)
  urlhaus: {
    async check(domain: string, forceRefresh = false): Promise<UrlHausResult> {
      const params = new URLSearchParams({ domain });
      if (forceRefresh) params.set('forceRefresh', 'true');
      return request<UrlHausResult>(`/api/urlhaus/check?${params}`, { requireAuth: true });
    },
    async recent(limit = 10): Promise<{ urls: unknown[]; generated_at: string }> {
      return request(`/api/urlhaus/recent?limit=${limit}`, { requireAuth: true });
    },
  },

  // OTX / AlienVault (protected)
  otx: {
    async check(indicator: string, type: 'IPv4' | 'IPv6' | 'domain' | 'hostname' | 'file' | 'url' = 'domain', forceRefresh = false): Promise<OtxCheckResult> {
      const params = new URLSearchParams({ indicator, type });
      if (forceRefresh) params.set('forceRefresh', 'true');
      return request<OtxCheckResult>(`/api/otx/check?${params}`, { requireAuth: true });
    },
    async pulse(pulseId: string): Promise<unknown> {
      return request(`/api/otx/pulse/${pulseId}`, { requireAuth: true });
    },
    async search(keyword: string): Promise<{ results: unknown[]; count: number }> {
      return request(`/api/otx/search?keyword=${encodeURIComponent(keyword)}`, { requireAuth: true });
    },
  },

  // Settings
  settings: {
    async getAI(): Promise<{
      provider: string;
      minimaxApiKey?: string;
      minimaxApiEndpoint?: string;
      minimaxModel?: string;
      ollamaEndpoint?: string;
      hasMinimaxKey: boolean;
      hasOllamaEndpoint: boolean;
    }> {
      return request('/api/settings/ai');
    },
    async updateAI(data: {
      provider?: string;
      minimaxApiKey?: string;
      minimaxApiEndpoint?: string;
      minimaxModel?: string;
      ollamaEndpoint?: string;
    }): Promise<{ success: boolean; message?: string }> {
      return request('/api/settings/ai', { method: 'POST', body: data });
    },
    async testAI(data: { provider: string; ollamaEndpoint?: string }): Promise<{ success: boolean; message: string }> {
      return request('/api/settings/ai/test', { method: 'POST', body: data });
    },

    // LLM Provider management
    async listLLMProviders(): Promise<{
      providers: Array<{
        id: string;
        displayName: string;
        baseUrl: string;
        model: string;
        enabled: boolean;
        hasKey: boolean;
        keyPreview: string | null;
      }>;
      active: string;
    }> {
      return request('/api/settings/llm/providers', { requireAuth: true });
    },
    async updateLLMProvider(provider: string, data: {
      baseUrl?: string;
      model?: string;
      apiKey?: string;
      enabled?: boolean;
    }): Promise<{ success: boolean; provider: Record<string, unknown> }> {
      return request(`/api/settings/llm/providers/${provider}`, { method: 'PUT', body: data, requireAuth: true });
    },
    async testLLMProvider(provider: string): Promise<{
      provider: string;
      status: string;
      ok: boolean;
      latencyMs: number;
      model: string;
      baseUrl: string;
      checkedAt: string;
      message: string;
      safeError: string | null;
    }> {
      return request(`/api/settings/llm/providers/${provider}/test`, { method: 'POST', requireAuth: true });
    },
    async selectLLMProvider(provider: string): Promise<{ success: boolean; active: string }> {
      return request(`/api/settings/llm/providers/${provider}/select`, { method: 'POST', requireAuth: true });
    },
  },

  // Health check
  async health(): Promise<{ status: string; timestamp: string }> {
    return request('/health');
  },

  // Tools (protected: requires X-API-Key)
  tools: {
    async listTemplates(includeDisabled = false): Promise<{
      templates: Array<{
        id: string;
        name: string;
        tool: string;
        description?: string;
        commandTemplate: string;
        allowedParams: Record<string, string[]>;
        riskLevel: string;
        isApproved: boolean;
        isEnabled: boolean;
        createdAt: string;
        createdBy: string;
      }>;
    }> {
      const qs = includeDisabled ? '?include_disabled=true' : '';
      return request(`/api/tools/templates${qs}`, { requireAuth: true });
    },
    async getTemplate(id: string): Promise<{ template: Record<string, unknown> }> {
      return request(`/api/tools/templates/${id}`, { requireAuth: true });
    },
    async listExecutions(params: { limit?: number; offset?: number; status?: string } = {}): Promise<{
      executions: Array<Record<string, unknown>>;
      total: number;
      limit: number;
      offset: number;
    }> {
      const query = new URLSearchParams();
      if (params.limit !== undefined) query.set('limit', String(params.limit));
      if (params.offset !== undefined) query.set('offset', String(params.offset));
      if (params.status) query.set('status', params.status);
      const qs = query.toString() ? `?${query}` : '';
      return request(`/api/tools/executions${qs}`, { requireAuth: true });
    },
    async execute(input: {
      template_id: string;
      params: Record<string, string>;
      session_id?: string;
    }): Promise<{
      execution_id: string;
      success: boolean;
      output?: string;
      error?: string;
      duration_ms?: number;
    }> {
      return request('/api/tools/execute', {
        method: 'POST',
        body: input,
        requireAuth: true,
      });
    },
  },

  // Alerts (protected: requires X-API-Key)
  alerts: {
    async list(params: { status?: string; severity?: string; source?: string; limit?: number; offset?: number } = {}): Promise<{
      alerts: Array<Record<string, unknown>>;
      total: number;
      limit: number;
      offset: number;
    }> {
      const query = new URLSearchParams();
      if (params.status) query.set('status', params.status);
      if (params.severity) query.set('severity', params.severity);
      if (params.source) query.set('source', params.source);
      if (params.limit !== undefined) query.set('limit', String(params.limit));
      if (params.offset !== undefined) query.set('offset', String(params.offset));
      const qs = query.toString() ? `?${query}` : '';
      return request(`/api/alerts${qs}`, { requireAuth: true });
    },
    async get(id: string): Promise<{ alert: Record<string, unknown> }> {
      return request(`/api/alerts/${id}`, { requireAuth: true });
    },
    async importOne(input: {
      source: string;
      title: string;
      severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
      raw_content: string;
      normalized_fields?: unknown;
      ai_verdict?: string;
    }): Promise<{ alert: Record<string, unknown> }> {
      return request('/api/alerts/import', {
        method: 'POST',
        body: input,
        requireAuth: true,
      });
    },
    async updateStatus(id: string, input: { status?: string; human_verdict?: string }): Promise<{ alert: Record<string, unknown> }> {
      return request(`/api/alerts/${id}/status`, {
        method: 'PATCH',
        body: input,
        requireAuth: true,
      });
    },
    async submitFeedback(
      id: string,
      input: {
        session_id?: string;
        ai_verdict: string;
        correct_verdict: string;
        error_reason?: string;
        lesson?: string;
      }
    ): Promise<{ feedback: Record<string, unknown> }> {
      return request(`/api/alerts/${id}/feedback`, {
        method: 'POST',
        body: input,
        requireAuth: true,
      });
    },
    async investigate(id: string, type: 'soc' | 'threat' | 'pentest' = 'threat'): Promise<{
      message: string;
      session_id: string;
      alert_id: string;
      type: string;
    }> {
      return request(`/api/alerts/${id}/investigate`, {
        method: 'POST',
        body: { type },
        requireAuth: true,
      });
    },
  },

  // Dashboard (protected: requires X-API-Key)
  dashboard: {
    async stats(): Promise<{ metrics: Record<string, unknown>; recentExecutions?: unknown[]; recentAlerts?: unknown[] }> {
      return request('/api/dashboard/stats', { requireAuth: true });
    },
    async timeline(days = 7): Promise<{ timeline: Record<string, unknown> }> {
      return request(`/api/dashboard/stats/timeline?days=${days}`, { requireAuth: true });
    },
    async report(alertId: string): Promise<Record<string, unknown>> {
      return request(`/api/dashboard/report/${alertId}`, { requireAuth: true });
    },
  },

  // Evidence (protected: requires X-API-Key)
  evidence: {
    async add(sessionId: string, input: {
      type: 'tool' | 'intelligence' | 'manual' | 'ai';
      title: string;
      content: string;
      data?: unknown;
      alertId?: string;
      toolExecutionId?: string;
    }): Promise<{ evidence: Evidence }> {
      return request(`/api/sessions/${sessionId}/evidence`, {
        method: 'POST',
        body: input,
        requireAuth: true,
      });
    },
    async list(sessionId: string): Promise<{ evidence: Evidence[] }> {
      return request(`/api/sessions/${sessionId}/evidence`, {
        requireAuth: true,
      });
    },
    async remove(sessionId: string, evidenceId: string): Promise<{ success: boolean }> {
      return request(`/api/sessions/${sessionId}/evidence/${evidenceId}`, {
        method: 'DELETE',
        requireAuth: true,
      });
    },
  },

  // Get all sessions (combined from all modules)
  async getAllSessions(): Promise<SessionDetail[]> {
    try {
      const [soc, threat, pentest] = await Promise.all([
        this.soc.getSessions().catch(() => ({ sessions: [] })),
        this.threat.getSessions().catch(() => ({ sessions: [] })),
        this.pentest.getSessions().catch(() => ({ sessions: [] })),
      ]);
      return [...soc.sessions, ...threat.sessions, ...pentest.sessions].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch {
      return [];
    }
  },

  // API Key self-service (protected: requires X-API-Key)
  me: {
    getApiKey: () => request<{
      prefix: string | null;
      createdAt: string | null;
      revokedAt: string | null;
      expiresAt: string | null;
    }>('/api/me/api-key', { requireAuth: true }),

    rotateApiKey: () => request<{
      plaintext: string;
      metadata: { prefix: string; createdAt: string; revokedAt: null; expiresAt: null };
    }>('/api/me/api-key/rotate', { method: 'POST', requireAuth: true }),
  },

  // Admin API key management (protected: requires X-API-Key)
  adminKeys: {
    list: () => request<{
      keys: Array<{
        prefix: string | null;
        createdAt: string | null;
        revokedAt: string | null;
        expiresAt: string | null;
        user: { id: string; email: string; role: string };
      }>;
    }>('/api/admin/keys', { requireAuth: true }),

    rotate: (userId: string) => request<{
      plaintext: string;
      metadata: { prefix: string; createdAt: string; revokedAt: null; expiresAt: null };
    }>(`/api/admin/keys/${userId}/rotate`, { method: 'POST', requireAuth: true }),

    revoke: async (userId: string) => {
      await request<null>(`/api/admin/keys/${userId}`, {
        method: 'DELETE',
        requireAuth: true,
      });
    },
  },

  // Admin retention (protected: requires X-API-Key + admin role)
  adminRetention: {
    status: () =>
      request<{
        counts: { auditLog: number; toolExecution: number; bgpUpdate: number };
        lastRunAt: string | null;
        lastResult: {
          auditLogsDeleted: number;
          toolExecutionsTrimmed: number;
          bgpUpdatesDeleted: number;
        } | null;
        policy: { auditLogDays: number; toolExecutionDays: number; bgpUpdateDays: number };
      }>('/api/admin/retention/status', { requireAuth: true }),

    run: (
      dryRun: boolean,
      config?: { auditLogDays?: number; toolExecutionDays?: number; bgpUpdateDays?: number }
    ) =>
      request<
        | {
            mode: 'dry-run';
            preview: {
              auditLogsWouldDelete: number;
              toolExecutionsWouldTrim: number;
              bgpUpdatesWouldDelete: number;
            };
            ranAt: string;
          }
        | {
            mode: 'execute';
            result: {
              auditLogsDeleted: number;
              toolExecutionsTrimmed: number;
              bgpUpdatesDeleted: number;
            };
            ranAt: string;
          }
      >(`/api/admin/retention/run${dryRun ? '?dryRun=true' : ''}`, {
        method: 'POST',
        body: config ?? {},
        requireAuth: true,
      }),
  },
};

// Polling utility for session status
export function pollSession(
  sessionId: string,
  module: 'soc' | 'threat' | 'pentest',
  onUpdate: (session: SessionDetail) => void,
  options?: { interval?: number; onAuthError?: () => void }
): () => void {
  const interval = options?.interval ?? 2000;
  const onAuthError = options?.onAuthError;
  let stopped = false;

  const poll = async () => {
    if (stopped) return;

    try {
      let response: { session: SessionDetail };
      if (module === 'soc') response = await api.soc.getSession(sessionId);
      else if (module === 'threat') response = await api.threat.getSession(sessionId);
      else response = await api.pentest.getSession(sessionId);

      onUpdate(response.session);

      if (response.session.status === 'completed') {
        stopped = true;
      }
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        stopped = true;
        onAuthError?.();
        return;
      }
      console.error('Polling error:', error);
    }
  };

  const intervalId = setInterval(poll, interval);
  poll();

  return () => {
    stopped = true;
    clearInterval(intervalId);
  };
}

/**
 * Centralised auth-error check. Returns true when the error is an ApiError
 * with HTTP 401 (unauthenticated) or 403 (forbidden) status.
 */
export function isAuthError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}
