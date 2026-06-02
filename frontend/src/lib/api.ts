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

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

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

// API Functions
export const api = {
  // SOC
  soc: {
    async analyze(input: { alertId?: string; rawContent?: string }): Promise<SessionResponse> {
      return request<SessionResponse>('/api/soc/analyze', {
        method: 'POST',
        body: input,
      });
    },
    async getSessions(): Promise<{ sessions: SessionDetail[] }> {
      return request('/api/soc/sessions');
    },
    async getSession(id: string): Promise<{ session: SessionDetail }> {
      return request(`/api/soc/sessions/${id}`);
    },
    async sendMessage(sessionId: string, content: string): Promise<{ message: MessageDetail }> {
      return request(`/api/soc/sessions/${sessionId}/messages`, {
        method: 'POST',
        body: { content },
      });
    },
  },

  // Threat
  threat: {
    async investigate(input: { type: 'ip' | 'domain' | 'hash'; value: string; type2?: 'simulation' | 'live' }): Promise<SessionResponse> {
      return request<SessionResponse>('/api/threat/investigate', {
        method: 'POST',
        body: input,
      });
    },
    async getSessions(): Promise<{ sessions: SessionDetail[] }> {
      return request('/api/threat/sessions');
    },
    async getSession(id: string): Promise<{ session: SessionDetail }> {
      return request(`/api/threat/sessions/${id}`);
    },
    async sendMessage(sessionId: string, content: string): Promise<{ message: MessageDetail }> {
      return request(`/api/threat/sessions/${sessionId}/messages`, {
        method: 'POST',
        body: { content },
      });
    },
  },

  // Pentest
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
      });
    },
    async getSessions(): Promise<{ sessions: SessionDetail[] }> {
      return request('/api/pentest/sessions');
    },
    async getSession(id: string): Promise<{ session: SessionDetail }> {
      return request(`/api/pentest/sessions/${id}`);
    },
    async sendMessage(sessionId: string, content: string): Promise<{ message: MessageDetail }> {
      return request(`/api/pentest/sessions/${sessionId}/messages`, {
        method: 'POST',
        body: { content },
      });
    },
    async downloadReport(sessionId: string): Promise<Blob> {
      const response = await fetch(`${API_BASE}/api/report/${sessionId}/pdf`);
      if (!response.ok) {
        throw new Error('Failed to download report');
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
      return request(`/api/report/${sessionId}/json`);
    },
  },

  // IP Reputation
  ip: {
    async check(ip: string, forceRefresh = false): Promise<IpReputationResult> {
      const params = new URLSearchParams({ ip });
      if (forceRefresh) params.set('forceRefresh', 'true');
      return request<IpReputationResult>(`/api/ip/check?${params}`);
    },
    async history(): Promise<{ history: IpReputationResult[] }> {
      return request('/api/ip/history');
    },
    async stats(): Promise<IpReputationStats> {
      return request('/api/ip/stats');
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
      return request(`/api/ip/blacklist?${query}`);
    },
  },

  // BGP
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
      return request(`/api/bgp/query?${query}`);
    },
    async stats(): Promise<BgpStats> {
      return request('/api/bgp/stats');
    },
  },

  // URLhaus
  urlhaus: {
    async check(domain: string, forceRefresh = false): Promise<UrlHausResult> {
      const params = new URLSearchParams({ domain });
      if (forceRefresh) params.set('forceRefresh', 'true');
      return request<UrlHausResult>(`/api/urlhaus/check?${params}`);
    },
    async recent(limit = 10): Promise<{ urls: unknown[]; generated_at: string }> {
      return request(`/api/urlhaus/recent?limit=${limit}`);
    },
  },

  // OTX (AlienVault)
  otx: {
    async check(indicator: string, type: 'IPv4' | 'IPv6' | 'domain' | 'hostname' | 'file' | 'url' = 'domain', forceRefresh = false): Promise<OtxCheckResult> {
      const params = new URLSearchParams({ indicator, type });
      if (forceRefresh) params.set('forceRefresh', 'true');
      return request<OtxCheckResult>(`/api/otx/check?${params}`);
    },
    async pulse(pulseId: string): Promise<unknown> {
      return request(`/api/otx/pulse/${pulseId}`);
    },
    async search(keyword: string): Promise<{ results: unknown[]; count: number }> {
      return request(`/api/otx/search?keyword=${encodeURIComponent(keyword)}`);
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
};

// Polling utility for session status
export function pollSession(
  sessionId: string,
  module: 'soc' | 'threat' | 'pentest',
  onUpdate: (session: SessionDetail) => void,
  interval = 2000
): () => void {
  let stopped = false;

  const poll = async () => {
    if (stopped) return;

    try {
      let response: { session: SessionDetail };
      if (module === 'soc') response = await api.soc.getSession(sessionId);
      else if (module === 'threat') response = await api.threat.getSession(sessionId);
      else response = await api.pentest.getSession(sessionId);

      onUpdate(response.session);

      // Stop polling when completed
      if (response.session.status === 'completed') {
        stopped = true;
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  };

  const intervalId = setInterval(poll, interval);
  poll(); // Initial call

  // Return cleanup function
  return () => {
    stopped = true;
    clearInterval(intervalId);
  };
}
