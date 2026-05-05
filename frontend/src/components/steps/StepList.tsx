'use client';

import { StepCard } from './StepCard';
import type { Step } from '@/lib/types';

interface StepListProps {
  steps: Step[];
}

export function StepList({ steps }: StepListProps) {
  return (
    <div className="space-y-4">
      {steps.map((step, index) => (
        <StepCard key={step.id} step={step} isLast={index === steps.length - 1} />
      ))}
    </div>
  );
}
