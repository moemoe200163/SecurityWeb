'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { InvestigationWorkspace } from '@/components/investigation/InvestigationWorkspace';

// UUID v1-5 format (case-insensitive). Backend Prisma uses @default(uuid())
// for Session.id, so anything else is either a typo or a probe.
const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function InvestigationPage() {
  const params = useParams();
  const raw = params.sessionId;
  // params can be string | string[]; normalise and validate before passing down.
  const sessionId = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';
  const isValid = sessionId.length > 0 && SESSION_ID_PATTERN.test(sessionId);

  if (!isValid) {
    return (
      <div className="p-8 text-center text-sm text-[var(--muted-foreground)]">
        <p>無效的工作階段 ID：<code className="font-mono">{sessionId}</code></p>
        <p className="mt-2 text-xs">請從歷史記錄或告警中心選擇有效 session。</p>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="p-8 text-center">Loading investigation workspace...</div>}>
      <InvestigationWorkspace sessionId={sessionId} />
    </Suspense>
  );
}
