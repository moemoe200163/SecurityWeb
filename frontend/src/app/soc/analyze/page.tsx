'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useStepStore } from '@/stores/stepStore';
import { SOCAnalysisWorkspace } from '@/components/soc/SOCAnalysisWorkspace';

function AnalyzeContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');
  return <SOCAnalysisWorkspace initialSessionId={sessionId || undefined} />;
}

export default function SOCAnalyzePage() {
  const { setCurrentModule } = useStepStore();

  useEffect(() => {
    setCurrentModule('soc');
  }, [setCurrentModule]);

  return (
    <Suspense fallback={<div className="p-8 text-center">載入中...</div>}>
      <AnalyzeContent />
    </Suspense>
  );
}
