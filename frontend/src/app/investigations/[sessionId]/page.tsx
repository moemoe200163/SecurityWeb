'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { InvestigationWorkspace } from '@/components/investigation/InvestigationWorkspace';

export default function InvestigationPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  return (
    <Suspense fallback={<div className="p-8 text-center">Loading investigation workspace...</div>}>
      <InvestigationWorkspace sessionId={sessionId} />
    </Suspense>
  );
}
