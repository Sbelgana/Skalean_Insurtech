'use client';

/**
 * BottomTabs -- mobile bottom navigation bar (visible only on <md).
 * 2-5 tabs recommended (Apple HIG / Material Design constraint).
 * safe-area-inset-bottom applied for iOS notch.
 * Reference : task-1.4.14 Sprint 4 Phase 1
 */
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { type LucideIcon } from 'lucide-react';
import { cn } from '../lib/cn.js';

export interface TabItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number | string;
}

interface BottomTabsProps {
  tabs: TabItem[];
  className?: string;
}

function stripLocale(pathname: string, locale: string): string {
  const prefix = `/${locale}`;
  return pathname.startsWith(prefix) ? pathname.slice(prefix.length) || '/' : pathname;
}

export function BottomTabs({ tabs, className }: BottomTabsProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const localPathname = stripLocale(pathname, locale);

  if (process.env.NODE_ENV === 'development' && (tabs.length < 2 || tabs.length > 5)) {
    console.warn('[BottomTabs] Recommended 2-5 tabs, got', tabs.length);
  }

  return (
    <nav
      role="navigation"
      aria-label="Navigation principale mobile"
      className={cn(
        'md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-background',
        'pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1',
        'shadow-[0_-1px_3px_rgba(0,0,0,0.05)]',
        className,
      )}
    >
      <ul className="flex items-stretch justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            localPathname === tab.href || localPathname.startsWith(tab.href + '/');
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={`/${locale}${tab.href}`}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-0.5 px-2 py-2 min-h-[3.5rem]',
                  'text-xs font-medium transition-colors',
                  'hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <span className="relative">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                  {tab.badge !== undefined && (
                    <span
                      aria-label={`${String(tab.badge)} non lus`}
                      className="absolute -top-1 -end-2 min-w-[1.25rem] h-5 rounded-full bg-destructive px-1 text-[10px] leading-5 font-semibold text-destructive-foreground text-center"
                    >
                      {typeof tab.badge === 'number' && tab.badge > 99 ? '99+' : tab.badge}
                    </span>
                  )}
                </span>
                <span className="truncate max-w-full">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
