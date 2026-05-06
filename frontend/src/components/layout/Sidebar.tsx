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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ModuleType } from '@/lib/types';
import { Button } from '@/components/ui/button';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  children?: { label: string; href: string }[];
}

const navigation: Record<ModuleType, NavItem> = {
  soc: {
    label: 'SOC 告警分析',
    href: '/soc/analyze',
    icon: <Shield className="h-5 w-5" />,
    children: [
      { label: '深度調查', href: '/soc/analyze' },
      { label: '快速分析處置', href: '/soc/quick' },
      { label: '歷史分析記錄', href: '/soc/history' },
    ],
  },
  threat: {
    label: '威脅情報調查',
    href: '/threat/investigate',
    icon: <Search className="h-5 w-5" />,
    children: [
      { label: 'IP/域名查詢', href: '/threat/investigate' },
      { label: 'IP 黑名單', href: '/threat/blacklist' },
      { label: 'BGP Tools', href: '/threat/bgp' },
    ],
  },
  pentest: {
    label: '滲透測試輔助',
    href: '/pentest/assist',
    icon: <Network className="h-5 w-5" />,
    children: [
      { label: '新建任務', href: '/pentest/assist' },
      { label: '任務歷史', href: '/pentest/history' },
    ],
  },
};

export function Sidebar() {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const isActive = (href: string) => pathname === href;
  const isParentActive = (nav: NavItem) => {
    if (isActive(nav.href)) return true;
    return nav.children?.some((child) => isActive(child.href)) ?? false;
  };

  const closeMobile = () => setIsMobileOpen(false);

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
          'w-64 border-r bg-white flex flex-col h-full fixed md:static inset-y-0 left-0 z-50 transition-transform duration-300',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="p-4 border-b flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2" onClick={closeMobile}>
            <Shield className="h-6 w-6 text-blue-600" />
            <span className="font-semibold text-lg">安全智能體</span>
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
          <Link
            href="/"
            onClick={closeMobile}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive('/')
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-700 hover:bg-gray-100'
            )}
          >
            <Home className="h-4 w-4" />
            首頁儀表板
          </Link>

          {(Object.keys(navigation) as ModuleType[]).map((key) => {
            const nav = navigation[key];
            const parentActive = isParentActive(nav);

            return (
              <div key={key} className="space-y-1">
                <Link
                  href={nav.href}
                  onClick={closeMobile}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    parentActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-100'
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
                          'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors',
                          isActive(child.href)
                            ? 'text-blue-600 font-medium'
                            : 'text-gray-500 hover:text-gray-700'
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

        {/* Footer */}
        <div className="p-4 border-t text-xs text-gray-500">
          安全智能體 v1.0
        </div>
      </aside>
    </>
  );
}
