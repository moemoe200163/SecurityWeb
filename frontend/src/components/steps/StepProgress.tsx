'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Step } from '@/lib/types';

interface StepProgressProps {
  steps: Step[];
  currentStepIndex: number;
}

export function StepProgress({ steps, currentStepIndex }: StepProgressProps) {
  return (
    <div className="bg-white border-b px-6 py-4">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = step.status === 'success';
          const isCurrent = index === currentStepIndex && step.status === 'running';
          const isPending = step.status === 'pending';

          return (
            <div key={step.id} className="flex items-center flex-1">
              {/* Step indicator */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300',
                    isCompleted && 'bg-green-500 text-white',
                    isCurrent && 'bg-blue-500 text-white ring-4 ring-blue-100',
                    isPending && 'bg-gray-100 text-gray-400 border-2 border-gray-200'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <span
                  className={cn(
                    'mt-1.5 text-xs font-medium',
                    isCompleted && 'text-green-600',
                    isCurrent && 'text-blue-600',
                    isPending && 'text-gray-400'
                  )}
                >
                  {step.title}
                </span>
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-2 -mt-5 transition-colors duration-300',
                    steps[index + 1].status !== 'pending' ? 'bg-green-500' : 'bg-gray-200'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
