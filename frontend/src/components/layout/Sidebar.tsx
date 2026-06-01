'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Shield,
  Search,
  Network,
  ChevronRight,
  Home,
  Menu,
  X,
  Terminal,
  Settings,
  Sun,
  Moon,
  Monitor,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ModuleType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useStepStore } from '@/stores/stepStore';

interface NavChild {
  label: string;
  href: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  module: ModuleType | 'tools' | 'alerts';
  children?: NavChild[];
}

const navigation: NavItem[] = [
  {
    label: '首頁儀表板',
    href: '/',
    icon: <Home className="h-5 w-5" />,
    module: 'soc',
  },
  {
    label: '工具平台',
    href: '/tools',
    icon: <Terminal className="h-5 w-5" />,
    module: 'tools',
  },
  {
    label: '告警中心',
    href: '/alerts',
    icon: <AlertTriangle className="h-5 w-5" />,
    module: 'alerts',
  },
  {
    label: '歷史記錄',
    href: '/history',
    icon: <FileText className="h-5 w-5" />,
    module: 'soc',
  },
  {
    label: 'SOC 告警分析',
    href: '/soc/analyze',
    icon: <Shield className="h-5 w-5" />,
    module: 'soc',
    children: [
      { label: '深度調查', href: '/soc/analyze' },
      { label: '分析Demo', href: '/soc/demo' },
    ],
  },
  {
    label: '威脅情報調查',
    href: '/threat/investigate',
    icon: <Search className="h-5 w-5" />,
    module: 'threat',
    children: [
      { label: 'IP/域名查詢', href: '/threat/investigate' },
      { label: 'IP 黑名單', href: '/threat/blacklist' },
      { label: 'BGP 路由查詢', href: '/threat/bgp' },
    ],
  },
  {
    label: '滲透測試輔助',
    href: '/pentest/assist',
    icon: <Network className="h-5 w-5" />,
    module: 'pentest',
    children: [
      { label: '新建任務', href: '/pentest/assist' },
      { label: '分析Demo', href: '/pentest/demo' },
    ],
  },
];

const moduleColors: Record<string, { active: string; hover: string }> = {
  soc: { active: 'bg-[var(--soc)]/10 text-[var(--soc)] border-[var(--soc)]', hover: 'hover:bg-[var(--soc)]/5' },
  threat: { active: 'bg-[var(--threat)]/10 text-[var(--threat)] border-[var(--threat)]', hover: 'hover:bg-[var(--threat)]/5' },
  pentest: { active: 'bg-[var(--pentest)]/10 text-[var(--pentest)] border-[var(--pentest)]', hover: 'hover:bg-[var(--pentest)]/5' },
  tools: { active: 'bg-[var(--terminal-green)]/10 text-[var(--terminal-green)] border-[var(--terminal-green)]', hover: 'hover:bg-[var(--terminal-green)]/5' },
  alerts: { active: 'bg-red-500/10 text-red-500 border-red-500', hover: 'hover:bg-red-500/5' },
};

const themeOptions = [
  { value: 'light', label: '淺色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '系統', icon: Monitor },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const theme = useStepStore((state) => state.theme);
  const toggleTheme = useStepStore((state) => state.toggleTheme);

  const isActive = (href: string) => pathname === href;
  const isParentActive = (nav: NavItem) => {
    if (isActive(nav.href)) return true;
    return nav.children?.some((child) => isActive(child.href)) ?? false;
  };

  const closeMobile = () => setIsMobileOpen(false);

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    if (theme !== newTheme) {
      toggleTheme();
    }
  };

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'bg-background flex flex-col h-full fixed md:static inset-y-0 left-0 z-50 transition-transform duration-300',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="p-4 border-b flex items-center justify-between bg-background">
          <Link href="/" className="flex items-center gap-2" onClick={closeMobile}>
            <Shield className="h-6 w-6 text-blue-600" />
            <span className="font-semibold text-lg text-foreground">安全智能體</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={closeMobile}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navigation.map((nav) => {
            const parentActive = isParentActive(nav);
            const colors = moduleColors[nav.module] || moduleColors.soc;

            return (
              <div key={nav.href} className="space-y-1">
                <Link
                  href={nav.href}
                  onClick={closeMobile}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                    parentActive
                      ? colors.active + ' border-l-2'
                      : 'text-[var(--sidebar-foreground)] ' + colors.hover
                  )}
                >
                  {nav.icon}
                  {nav.label}
                </Link>
                {nav.children && parentActive && (
                  <div className="ml-8 space-y-1">
                    {nav.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={closeMobile}
                        className={cn(
                          'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all duration-150',
                          isActive(child.href)
                            ? 'text-[var(--sidebar-primary)] font-medium'
                            : 'text-[var(--muted-foreground)] hover:text-[var(--sidebar-foreground)]'
                        )}
                      >
                        <ChevronRight className="h-3 w-3" />
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer with Settings */}
        <div className="p-4 border-t bg-background">
          {/* Theme Selector */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-muted-foreground">主題</span>
            <div className="flex items-center gap-1 p-1 rounded-lg bg-muted">
              <button
                onClick={() => handleThemeChange('light')}
                className={cn(
                  'p-1.5 rounded-md transition-all',
                  theme === 'light' ? 'bg-background shadow-sm' : 'hover:bg-background/50'
                )}
                title="淺色"
              >
                <Sun className="h-4 w-4 text-muted-foreground" />
              </button>
              <button
                onClick={() => handleThemeChange('dark')}
                className={cn(
                  'p-1.5 rounded-md transition-all',
                  theme === 'dark' ? 'bg-background shadow-sm' : 'hover:bg-background/50'
                )}
                title="深色"
              >
                <Moon className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Settings Link */}
          <Link
            href="/settings"
            onClick={closeMobile}
            className={cn(
              'flex items-center gap-2 text-xs transition-colors',
              isActive('/settings')
                ? 'text-[var(--terminal-amber)]'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Settings className="h-4 w-4" />
            <span>設定</span>
          </Link>

          <div className="text-xs text-muted-foreground mt-3">
            安全智能體 v1.0
          </div>
        </div>
      </aside>
    </>
  );
}
