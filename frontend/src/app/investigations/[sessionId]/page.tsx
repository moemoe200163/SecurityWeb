'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { SOCAnalysisWorkspace } from '@/components/soc/SOCAnalysisWorkspace';

export default function InvestigationPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  return (
    <Suspense fallback={<div className="p-8 text-center">載入調查工作台...</div>}>
      <SOCAnalysisWorkspace initialSessionId={sessionId} />
    </Suspense>
  );
}
