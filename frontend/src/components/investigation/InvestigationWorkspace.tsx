'use client';

import { useEffect, useState } from 'react';
import { api, ApiError, type SessionDetail, type Evidence } from '@/lib/api';
import { ApiKeyRequired } from '@/components/ui/ApiKeyRequired';
import { PageHero } from '@/components/layout/PageHero';
import { VolcanoStepCard } from '@/components/soc/VolcanoStepCard';
import { AddToInvestigation } from '@/components/ui/AddToInvestigation';
import {
  Shield,
  AlertTriangle,
  FileText,
  Loader2,
  ExternalLink,
  Clock,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Step as StepType, ToolCall } from '@/lib/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractIOCs(rawContent: string): { ips: string[]; domains: string[]; hashes: string[] } {
  const ipRegex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
  const domainRegex = /\b[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}\b/g;
  const hashRegex = /\b[a-fA-F0-9]{32,64}\b/g;

  const ips = [...new Set(rawContent.match(ipRegex) || [])];
  const domains = [
    ...new Set(
      (rawContent.match(domainRegex) || []).filter(
        (d) => !d.endsWith('.json') && !d.endsWith('.txt') && d.includes('.'),
      ),
    ),
  ];
  const hashes = [...new Set(rawContent.match(hashRegex) || [])];

  return { ips, domains, hashes };
}

async function loadSessionFromAnyModule(
  sessionId: string,
): Promise<{ session: SessionDetail; module: string } | null> {
  const modules = [
    { name: 'soc', getter: api.soc.getSession },
    { name: 'threat', getter: api.threat.getSession },
    { name: 'pentest', getter: api.pentest.getSession },
  ] as const;

  for (const mod of modules) {
    try {
      const res = await mod.getter(sessionId);
      return { session: res.session, module: mod.name };
    } catch {
      continue;
    }
  }
  return null;
}

/** Convert API StepDetail to the local Step type expected by VolcanoStepCard. */
function toStep(s: SessionDetail['steps'][number], index: number): StepType {
  return {
    id: s.id || String(index + 1),
    title: s.title,
    status: s.status,
    content: s.content,
    codeBlock: s.codeBlock,
    toolCalls: (s.toolCalls || []) as ToolCall[],
    timestamp: s.timestamp,
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InvestigationWorkspaceProps {
  sessionId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InvestigationWorkspace({ sessionId }: InvestigationWorkspaceProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [module, setModule] = useState('');
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [alertData, setAlertData] = useState<Record<string, unknown> | null>(null);
  const [humanVerdict, setHumanVerdict] = useState('');
  const [status, setStatus] = useState('');

  // Load session + evidence + alert
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await loadSessionFromAnyModule(sessionId);
        if (cancelled || !result) {
          setError('Session not found');
          setLoading(false);
          return;
        }

        setSession(result.session);
        setModule(result.module);
        setStatus(result.session.status);

        // Load evidence (non-blocking)
        api.evidence
          .list(sessionId)
          .then((evRes) => {
            if (!cancelled) setEvidence(evRes.evidence);
          })
          .catch(() => {
            /* Evidence may not exist yet */
          });

        // Load linked alert (non-blocking)
        const input = result.session.input as Record<string, unknown> | undefined;
        if (input && typeof input === 'object' && input.alertId) {
          api.alerts
            .get(input.alertId as string)
            .then((alertRes) => {
              if (!cancelled) setAlertData(alertRes.alert);
            })
            .catch(() => {
              /* Alert may not exist */
            });
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError && err.status === 401) {
            setAuthError(true);
          } else {
            setError(err instanceof Error ? err.message : 'Failed to load');
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Derived data -----------------------------------------------------------
  const inputRecord = (session?.input ?? {}) as Record<string, unknown>;
  const rawContent = (inputRecord.rawContent as string) || (inputRecord.raw_content as string) || '';
  const iocs = extractIOCs(rawContent);

  const steps = session?.steps || [];
  const messages = session?.messages || [];

  // Render: loading --------------------------------------------------------
  if (authError) {
    return <ApiKeyRequired />;
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--terminal-green)]" />
      </div>
    );
  }

  // Render: error ----------------------------------------------------------
  if (error || !session) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="h-12 w-12 text-yellow-500" />
        <p className="text-[var(--muted-foreground)]">{error || 'Investigation session not found'}</p>
        <Button variant="outline" onClick={() => window.history.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  // Render: main workspace -------------------------------------------------
  return (
    <div className="h-full flex flex-col">
      {/* Hero */}
      <PageHero
        icon={<Shield className="h-8 w-8 text-[var(--terminal-green)]" />}
        title="Investigation Workspace"
        subtitle={`INVESTIGATION / ${module.toUpperCase()}`}
        command={`investigate --session ${sessionId.slice(0, 8)}`}
      />

      {/* Status bar */}
      <div className="bg-[var(--card)] border-y border-[var(--border)] px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant={status === 'completed' ? 'default' : 'secondary'}>
              {status === 'completed' ? 'Completed' : 'In Progress'}
            </Badge>
            <span className="text-sm text-[var(--muted-foreground)]">
              Session: {sessionId.slice(0, 12)}...
            </span>
            <span className="text-sm text-[var(--muted-foreground)]">
              {steps.length} steps / {evidence.length} evidence
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 3-Column Layout                                                   */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Alert Context + IOCs */}
        <aside
          className="w-80 flex-shrink-0 border-r border-[var(--border)] overflow-auto bg-[var(--card)]/50"
          aria-label="Alert context and IOCs"
        >
          <div className="p-4 space-y-4">
            {/* Alert Summary */}
            {alertData && (
              <section className="space-y-2" aria-labelledby="alert-summary-heading">
                <h3
                  id="alert-summary-heading"
                  className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2"
                >
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  Alert Summary
                </h3>
                <div className="rounded-lg border border-[var(--border)] p-3 space-y-2 text-sm">
                  <div>
                    <span className="text-[var(--muted-foreground)]">Title: </span>
                    <span className="text-[var(--foreground)]">{alertData.title as string}</span>
                  </div>
                  <div>
                    <span className="text-[var(--muted-foreground)]">Severity: </span>
                    <Badge
                      variant={
                        alertData.severity === 'critical' ? 'destructive' : 'secondary'
                      }
                    >
                      {alertData.severity as string}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-[var(--muted-foreground)]">Status: </span>
                    <span className="text-[var(--foreground)]">{alertData.status as string}</span>
                  </div>
                  {typeof alertData.ai_verdict === 'string' && alertData.ai_verdict && (
                    <div>
                      <span className="text-[var(--muted-foreground)]">AI Verdict: </span>
                      <span className="text-[var(--foreground)]">
                        {alertData.ai_verdict}
                      </span>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* IOC List */}
            {(iocs.ips.length > 0 || iocs.domains.length > 0 || iocs.hashes.length > 0) && (
              <section className="space-y-2" aria-labelledby="ioc-heading">
                <h3
                  id="ioc-heading"
                  className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2"
                >
                  <Search className="h-4 w-4 text-blue-500" />
                  IOC List
                </h3>
                <div className="rounded-lg border border-[var(--border)] p-3 space-y-3 text-sm">
                  {iocs.ips.length > 0 && (
                    <div>
                      <span className="text-[var(--muted-foreground)] text-xs">IP Addresses</span>
                      <div className="mt-1 space-y-1">
                        {iocs.ips.map((ip) => (
                          <div
                            key={ip}
                            className="font-mono text-xs text-[var(--foreground)] bg-[var(--muted)] rounded px-2 py-1"
                          >
                            {ip}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {iocs.domains.length > 0 && (
                    <div>
                      <span className="text-[var(--muted-foreground)] text-xs">Domains</span>
                      <div className="mt-1 space-y-1">
                        {iocs.domains.map((d) => (
                          <div
                            key={d}
                            className="font-mono text-xs text-[var(--foreground)] bg-[var(--muted)] rounded px-2 py-1"
                          >
                            {d}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {iocs.hashes.length > 0 && (
                    <div>
                      <span className="text-[var(--muted-foreground)] text-xs">Hashes</span>
                      <div className="mt-1 space-y-1">
                        {iocs.hashes.slice(0, 3).map((h) => (
                          <div
                            key={h}
                            className="font-mono text-[10px] text-[var(--foreground)] bg-[var(--muted)] rounded px-2 py-1 break-all"
                          >
                            {h}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Raw Content */}
            {rawContent && (
              <section className="space-y-2" aria-labelledby="raw-content-heading">
                <h3
                  id="raw-content-heading"
                  className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2"
                >
                  <FileText className="h-4 w-4 text-purple-500" />
                  Raw Content
                </h3>
                <div className="rounded-lg border border-[var(--border)] p-3">
                  <pre className="text-xs text-[var(--muted-foreground)] whitespace-pre-wrap font-mono max-h-64 overflow-auto">
                    {rawContent.slice(0, 2000)}
                    {rawContent.length > 2000 && '\n\n... (truncated)'}
                  </pre>
                </div>
              </section>
            )}

            {/* Empty state */}
            {!alertData && iocs.ips.length === 0 && !rawContent && (
              <div className="text-center py-8 text-[var(--muted-foreground)] text-sm">
                <p>No alert context available</p>
              </div>
            )}
          </div>
        </aside>

        {/* Middle Panel: Timeline */}
        <main className="flex-1 overflow-auto" aria-label="Investigation timeline">
          <div className="p-6 max-w-3xl mx-auto space-y-6">
            {/* Steps */}
            {steps.length > 0 && (
              <section className="space-y-4" aria-labelledby="steps-heading">
                <h3 id="steps-heading" className="text-sm font-semibold text-[var(--foreground)]">
                  Investigation Steps
                </h3>
                {steps.map((step, index) => (
                  <VolcanoStepCard
                    key={step.id}
                    step={toStep(step, index)}
                    stepNumber={index + 1}
                    isLast={index === steps.length - 1}
                  />
                ))}
              </section>
            )}

            {/* Evidence Items */}
            {evidence.length > 0 && (
              <section className="space-y-4" aria-labelledby="evidence-heading">
                <h3 id="evidence-heading" className="text-sm font-semibold text-[var(--foreground)]">
                  Investigation Evidence
                </h3>
                <div className="space-y-3">
                  {evidence.map((ev) => (
                    <div
                      key={ev.id}
                      className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              ev.type === 'tool'
                                ? 'default'
                                : ev.type === 'intelligence'
                                  ? 'secondary'
                                  : 'outline'
                            }
                          >
                            {ev.type === 'tool'
                              ? 'Tool'
                              : ev.type === 'intelligence'
                                ? 'Intel'
                                : ev.type === 'ai'
                                  ? 'AI'
                                  : 'Manual'}
                          </Badge>
                          <span className="text-sm font-medium text-[var(--foreground)]">
                            {ev.title}
                          </span>
                        </div>
                        <time
                          className="text-xs text-[var(--muted-foreground)]"
                          dateTime={ev.createdAt}
                        >
                          {new Date(ev.createdAt).toLocaleString()}
                        </time>
                      </div>
                      <pre className="text-xs text-[var(--muted-foreground)] whitespace-pre-wrap font-mono bg-[var(--muted)] rounded p-2 max-h-48 overflow-auto">
                        {ev.content}
                      </pre>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Messages */}
            {messages.length > 0 && (
              <section className="space-y-4" aria-labelledby="messages-heading">
                <h3 id="messages-heading" className="text-sm font-semibold text-[var(--foreground)]">
                  Conversation Log
                </h3>
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        'rounded-lg p-4 text-sm',
                        msg.role === 'user'
                          ? 'bg-[var(--primary)]/10 border border-[var(--primary)]/20 ml-8'
                          : 'bg-[var(--card)] border border-[var(--border)] mr-8',
                      )}
                    >
                      <div className="text-xs text-[var(--muted-foreground)] mb-1">
                        {msg.role === 'user' ? 'User' : 'AI Assistant'}
                      </div>
                      <div className="text-[var(--foreground)] whitespace-pre-wrap">
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Empty state */}
            {steps.length === 0 && evidence.length === 0 && messages.length === 0 && (
              <div className="text-center py-16 text-[var(--muted-foreground)]">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No investigation data yet</p>
              </div>
            )}
          </div>
        </main>

        {/* Right Panel: Actions */}
        <aside
          className="w-80 flex-shrink-0 border-l border-[var(--border)] overflow-auto bg-[var(--card)]/50"
          aria-label="Actions and verdicts"
        >
          <div className="p-4 space-y-4">
            {/* AI Verdict */}
            {typeof inputRecord.aiVerdict === 'string' && inputRecord.aiVerdict && (
              <section className="space-y-2" aria-labelledby="ai-verdict-heading">
                <h3
                  id="ai-verdict-heading"
                  className="text-sm font-semibold text-[var(--foreground)]"
                >
                  AI Verdict
                </h3>
                <div className="rounded-lg border border-[var(--border)] p-3 text-sm text-[var(--foreground)]">
                  {inputRecord.aiVerdict}
                </div>
              </section>
            )}

            {/* Human Verdict */}
            <section className="space-y-2" aria-labelledby="human-verdict-heading">
              <h3
                id="human-verdict-heading"
                className="text-sm font-semibold text-[var(--foreground)]"
              >
                Human Verdict
              </h3>
              <select
                value={humanVerdict}
                onChange={(e) => setHumanVerdict(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 text-sm text-[var(--foreground)]"
                aria-label="Select human verdict"
              >
                <option value="">Not yet determined</option>
                <option value="true_positive">True Positive</option>
                <option value="false_positive">False Positive</option>
                <option value="attempted">Attempted Attack</option>
                <option value="ignored">Ignored</option>
              </select>
            </section>

            {/* Status */}
            <section className="space-y-2" aria-labelledby="status-heading">
              <h3
                id="status-heading"
                className="text-sm font-semibold text-[var(--foreground)]"
              >
                Status
              </h3>
              <div className="rounded-lg border border-[var(--border)] p-3">
                <Badge variant={status === 'completed' ? 'default' : 'secondary'}>
                  {status === 'completed' ? 'Completed' : 'Investigating'}
                </Badge>
              </div>
            </section>

            {/* Add Evidence */}
            <section className="space-y-2" aria-labelledby="add-evidence-heading">
              <h3
                id="add-evidence-heading"
                className="text-sm font-semibold text-[var(--foreground)]"
              >
                Add Evidence
              </h3>
              <AddToInvestigation
                sessionId={sessionId}
                type="tool"
                data={{ note: 'Manually added investigation evidence' }}
              />
            </section>

            {/* Report Actions */}
            <section className="space-y-2" aria-labelledby="report-heading">
              <h3
                id="report-heading"
                className="text-sm font-semibold text-[var(--foreground)]"
              >
                Report Actions
              </h3>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => {
                    const content = messages
                      .filter((m) => m.role === 'assistant')
                      .map((m) => m.content)
                      .join('\n\n');
                    navigator.clipboard.writeText(content);
                  }}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Copy Report
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => {
                    window.open(`/api/report/${sessionId}/pdf`, '_blank');
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}
