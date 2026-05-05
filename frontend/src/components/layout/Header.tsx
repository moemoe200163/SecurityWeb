'use client';

import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStepStore } from '@/stores/stepStore';

const moduleTitles: Record<string, string> = {
  soc: 'SOC 告警分析',
  threat: '威脅情報調查',
  pentest: '滲透測試輔助',
};

export function Header() {
  const currentModule = useStepStore((state) => state.currentModule);
  const isExecuting = useStepStore((state) => state.isExecuting);
  const theme = useStepStore((state) => state.theme);
  const toggleTheme = useStepStore((state) => state.toggleTheme);

  return (
    <header className="h-14 border-b bg-white px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-gray-900">
          安全智能體 · {moduleTitles[currentModule]}
        </h1>
        {isExecuting && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
            分析中
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="text-gray-600"
        >
          {theme === 'light' ? (
            <Moon className="h-5 w-5" />
          ) : (
            <Sun className="h-5 w-5" />
          )}
        </Button>
      </div>
    </header>
  );
}
