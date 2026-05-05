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
    throw new Error(error.error || `HTTP ${response.status}`);
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

// API Functions
export const api = {
  // SOC
  soc: {
    async analyze(input: { alertId?: string; rawContent?: string; type?: 'simulation' | 'live' }): Promise<SessionResponse> {
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
    async assist(input: { target: string; scope: string; testType: string; type?: 'simulation' | 'live' }): Promise<SessionResponse> {
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
  },

  // Health check
  async health(): Promise<{ status: string; timestamp: string }> {
    return request('/health');
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
