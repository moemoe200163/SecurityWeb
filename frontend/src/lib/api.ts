/**
 * API Client - 連接後端 API
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const config: RequestInit = {
    method,
    headers,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorMessage = error.message || error.error || `HTTP ${response.status}`;
    throw new Error(errorMessage);
  }

  return response.json();
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
      const response = await fetch(`/api/report/${sessionId}/pdf`);
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
