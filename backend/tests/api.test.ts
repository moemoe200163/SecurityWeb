import { describe, it, expect, beforeAll } from 'vitest';
import { TEST_API_KEY } from './setup.js';

// Test configuration. The API must be running and reachable on localhost.
const API_BASE = process.env.TEST_API_BASE || 'http://localhost:4000';

interface TestResponse<T = unknown> {
  data?: T;
  error?: string;
  status: number;
}

async function apiRequest<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  includeAuth = true
): Promise<TestResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (includeAuth) headers['X-API-Key'] = TEST_API_KEY;

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    const data = text ? (JSON.parse(text) as unknown) : undefined;

    return {
      data: data as T | undefined,
      error: response.ok ? undefined : (data as { error?: string } | undefined)?.error,
      status: response.status,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Request failed',
      status: 0,
    };
  }
}

beforeAll(async () => {
  // Sanity: the API must be reachable before running real assertions.
  const health = await fetch(`${API_BASE}/health`).catch(() => null);
  if (!health || !health.ok) {
    throw new Error(
      `Backend not reachable at ${API_BASE}. Start it (e.g. docker compose up -d backend) before running tests.`,
    );
  }
});

describe('W1: Health', () => {
  it('GET /health returns ok', async () => {
    const res = await fetch(`${API_BASE}/health`);
    expect(res.ok).toBe(true);
    const data = (await res.json()) as { status: string };
    expect(data.status).toBe('ok');
  });
});

describe('W2: Tools (whitelist + RBAC)', () => {
  it('GET /api/tools/templates returns approved+enabled templates', async () => {
    const res = await apiRequest<{ templates: Array<{ id: string; isApproved?: boolean; isEnabled?: boolean }> }>(
      'GET',
      '/api/tools/templates',
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data?.templates)).toBe(true);
    expect(res.data!.templates.length).toBeGreaterThan(0);
    // The default listing should only contain enabled+approved templates.
    for (const t of res.data!.templates) {
      expect(t.isEnabled).toBe(true);
      expect(t.isApproved).toBe(true);
    }
  });

  it('GET /api/tools/templates requires API key', async () => {
    const res = await apiRequest('GET', '/api/tools/templates', undefined, false);
    expect(res.status).toBe(401);
  });

  it('POST /api/tools/execute rejects unknown template with 400', async () => {
    const res = await apiRequest('POST', '/api/tools/execute', {
      template_id: 'definitely_not_a_real_template',
      params: { target: '127.0.0.1' },
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/tools/execute rejects disabled template (sql_dump is seeded as disabled)', async () => {
    const res = await apiRequest('POST', '/api/tools/execute', {
      template_id: 'sql_dump',
      params: { url: 'http://127.0.0.1/' },
    });
    // Disabled templates must be rejected with 400 (validation/permission).
    expect([400, 403]).toContain(res.status);
    expect(res.error?.toLowerCase()).toMatch(/disabled|not approved|not found|not allowed/);
  });

  it('POST /api/tools/execute rejects missing required params', async () => {
    // nmap_basic requires `target`.
    const res = await apiRequest('POST', '/api/tools/execute', {
      template_id: 'nmap_basic',
      params: {},
    });
    expect([400, 500]).toContain(res.status);
  });

  it('POST /api/tools/execute rejects unapproved params (extra field)', async () => {
    const res = await apiRequest('POST', '/api/tools/execute', {
      template_id: 'nmap_basic',
      params: { target: '127.0.0.1', extra_evil_flag: '--something-bad' },
    });
    expect(res.status).toBe(400);
  });

  it('GET /api/tools/executions returns user executions', async () => {
    const res = await apiRequest<{ executions: unknown[] }>('GET', '/api/tools/executions');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data?.executions)).toBe(true);
  });

  it('GET /api/tools/templates/:id returns single template', async () => {
    const res = await apiRequest<{ template: { id: string } }>('GET', '/api/tools/templates/nmap_basic');
    expect(res.status).toBe(200);
    expect(res.data?.template.id).toBe('nmap_basic');
  });

  it('GET /api/tools/templates/:id returns 404 for missing template', async () => {
    const res = await apiRequest('GET', '/api/tools/templates/does_not_exist');
    expect(res.status).toBe(404);
  });
});

describe('W3: Alerts + RBAC', () => {
  it('GET /api/alerts returns demo alerts', async () => {
    const res = await apiRequest<{ alerts: unknown[]; total: number }>('GET', '/api/alerts?limit=10');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data?.alerts)).toBe(true);
    expect(res.data!.total).toBeGreaterThan(0);
  });

  it('GET /api/alerts requires API key', async () => {
    const res = await apiRequest('GET', '/api/alerts', undefined, false);
    expect(res.status).toBe(401);
  });

  it('GET /api/alerts supports pagination', async () => {
    const res = await apiRequest<{ alerts: unknown[]; limit: number; offset: number }>(
      'GET',
      '/api/alerts?limit=2&offset=0',
    );
    expect(res.status).toBe(200);
    expect(res.data?.limit).toBe(2);
    expect(res.data?.offset).toBe(0);
    expect(res.data!.alerts.length).toBeLessThanOrEqual(2);
  });

  it('GET /api/alerts supports status filter', async () => {
    const res = await apiRequest<{ alerts: Array<{ status: string }> }>('GET', '/api/alerts?status=new');
    expect(res.status).toBe(200);
    for (const a of res.data?.alerts ?? []) {
      expect(a.status).toBe('new');
    }
  });

  it('GET /api/alerts/:id returns single alert', async () => {
    const list = await apiRequest<{ alerts: Array<{ id: string }> }>('GET', '/api/alerts?limit=1');
    expect(list.status).toBe(200);
    const id = list.data?.alerts?.[0]?.id;
    expect(id).toBeDefined();

    const res = await apiRequest<{ alert: { id: string } }>('GET', `/api/alerts/${id}`);
    expect(res.status).toBe(200);
    expect(res.data?.alert.id).toBe(id);
  });

  it('GET /api/alerts/:id returns 404 for unknown id', async () => {
    const res = await apiRequest('GET', '/api/alerts/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});

describe('W4: Investigation workspace (SOC + Alerts investigate flow)', () => {
  it('GET /api/soc/sessions returns sessions', async () => {
    const res = await apiRequest<{ sessions: unknown[] }>('GET', '/api/soc/sessions');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data?.sessions)).toBe(true);
  });

  it('POST /api/soc/analyze creates a session', async () => {
    const res = await apiRequest<{ sessionId: string; status: string }>('POST', '/api/soc/analyze', {
      type: 'simulation',
      rawContent: 'Test alert content',
    });
    expect(res.status).toBe(201);
    expect(res.data?.sessionId).toBeDefined();
    expect(res.data?.status).toBeDefined();
  });

  it('POST /api/alerts/:id/investigate creates a real session (not just echoing alertId)', async () => {
    const list = await apiRequest<{ alerts: Array<{ id: string }> }>('GET', '/api/alerts?limit=1');
    expect(list.status).toBe(200);
    const alertId = list.data?.alerts?.[0]?.id;
    expect(alertId).toBeDefined();

    const res = await apiRequest<{ session_id: string; alert_id: string; type: string }>(
      'POST',
      `/api/alerts/${alertId}/investigate`,
      { type: 'threat' },
    );
    expect(res.status).toBe(200);
    // session_id must be a fresh UUID, NOT the alert id itself.
    expect(res.data?.session_id).toBeDefined();
    expect(res.data?.session_id).not.toBe(alertId);
    expect(res.data?.alert_id).toBe(alertId);
  });

  it('POST /api/alerts/:id/investigate returns 404 for unknown alert', async () => {
    const res = await apiRequest('POST', '/api/alerts/00000000-0000-0000-0000-000000000000/investigate', {
      type: 'threat',
    });
    expect(res.status).toBe(404);
  });
});

describe('W5: Dashboard metrics', () => {
  it('GET /api/dashboard/stats returns metrics', async () => {
    const res = await apiRequest<{ metrics: Record<string, unknown> }>('GET', '/api/dashboard/stats');
    expect(res.status).toBe(200);
    expect(res.data?.metrics).toBeDefined();
  });

  it('GET /api/dashboard/stats exposes alerts and tools counts', async () => {
    const res = await apiRequest<{ metrics: Record<string, unknown> }>('GET', '/api/dashboard/stats');
    expect(res.status).toBe(200);
    expect(res.data?.metrics).toHaveProperty('alerts');
    expect(res.data?.metrics).toHaveProperty('tools');
  });

  it('GET /api/dashboard/stats/timeline returns timeline data', async () => {
    const res = await apiRequest<{ timeline: unknown }>('GET', '/api/dashboard/stats/timeline');
    expect(res.status).toBe(200);
    expect(res.data?.timeline).toBeDefined();
  });
});
