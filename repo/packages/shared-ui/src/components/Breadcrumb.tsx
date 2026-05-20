'use client';

/**
 * Breadcrumb -- auto-generates breadcrumb items from usePathname().
 * Accepts optional `items` prop to override auto-generation.
 * Reference : task-1.4.14 Sprint 4 Phase 1
 */
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '../lib/cn.js';

export interface BreadcrumbItem {
  label: string;
  href?: string | undefined;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[] | undefined;
  dynamicSegments?: Record<string, string> | undefined;
  className?: string | undefined;
}

function autoBuild(
  pathname: string,
  locale: string,
  dynamicSegments: Record<string, string>,
  homeLabel: string,
): BreadcrumbItem[] {
  const prefix = `/${locale}`;
  const path = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname;
  const segments = path.split('/').filter(Boolean);
  const result: BreadcrumbItem[] = [{ label: homeLabel, href: `/${locale}` }];
  let acc = `/${locale}`;
  segments.forEach((seg, idx) => {
    acc += `/${seg}`;
    const label =
      dynamicSegments[seg] ?? (seg.charAt(0).toUpperCase() + seg.slice(1));
    if (idx < segments.length - 1) {
      result.push({ label, href: acc });
    } else {
      result.push({ label });
    }
  });
  return result;
}

export function Breadcrumb({ items, dynamicSegments = {}, className }: BreadcrumbProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('breadcrumb');
  const homeLabel = t('home' as Parameters<typeof t>[0], { fallback: 'Accueil' } as Parameters<typeof t>[1]);
  const ariaLabel = t('label' as Parameters<typeof t>[0], { fallback: "Fil d'ariane" } as Parameters<typeof t>[1]);
  const computedItems = items ?? autoBuild(pathname, locale, dynamicSegments, homeLabel);

  return (
    <nav aria-label={ariaLabel} className={cn('flex items-center', className)}>
      <ol className="flex items-center flex-wrap gap-1 text-sm">
        {computedItems.map((item, idx) => {
          const isLast = idx === computedItems.length - 1;
          return (
            <li key={idx} className="flex items-center gap-1">
              {idx === 0 && <Home className="h-3.5 w-3.5 me-1" aria-hidden="true" />}
              {idx > 0 && (
                <ChevronRight
                  className="h-3.5 w-3.5 text-muted-foreground rtl:rotate-180"
                  aria-hidden="true"
                />
              )}
              {isLast || !item.href ? (
                <span
                  aria-current="page"
                  className="font-medium text-foreground truncate max-w-[200px]"
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:underline truncate max-w-[200px]"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
