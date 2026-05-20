'use client';

/**
 * Sidebar -- collapsible navigation sidebar with sections and role filtering.
 * On mobile (<md) renders as a Radix-style Sheet drawer via SheetTrigger.
 * Reference : task-1.4.14 Sprint 4 Phase 1
 */
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { ChevronLeft, ChevronRight, Menu, type LucideIcon } from 'lucide-react';
import { cn } from '../lib/cn.js';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from './ui/sheet.js';
import { TooltipProvider, TooltipRoot, TooltipTrigger, TooltipContent } from './ui/tooltip.js';
import { useSidebarOpen } from '../hooks/useSidebarOpen.js';

// ---- Public types ----------------------------------------------------------

export interface SidebarItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number | string;
  requiredRoles?: string[];
  external?: boolean;
}

export interface SidebarSection {
  title?: string;
  items: SidebarItem[];
}

// ---- Helpers ---------------------------------------------------------------

function stripLocale(pathname: string, locale: string): string {
  const prefix = `/${locale}`;
  return pathname.startsWith(prefix) ? pathname.slice(prefix.length) || '/' : pathname;
}

function filterByRole(sections: SidebarSection[], userRoles?: string[]): SidebarSection[] {
  if (!userRoles || userRoles.length === 0) return sections;
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.requiredRoles || item.requiredRoles.some((r) => userRoles.includes(r)),
      ),
    }))
    .filter((section) => section.items.length > 0);
}

// ---- Inner sidebar content -------------------------------------------------

function SidebarContent({
  sections,
  userRoles,
  logo,
  collapsed,
  onItemClick,
}: {
  sections: SidebarSection[];
  userRoles?: string[] | undefined;
  logo?: React.ReactNode | undefined;
  collapsed: boolean;
  onItemClick?: (() => void) | undefined;
}) {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('navigation');
  const filteredSections = React.useMemo(() => filterByRole(sections, userRoles), [sections, userRoles]);
  const localPathname = stripLocale(pathname, locale);

  return (
    <nav
      role="navigation"
      aria-label={t('sidebarLabel', { fallback: 'Navigation principale' } as Parameters<typeof t>[1])}
      className="flex h-full flex-col"
    >
      {/* Logo area */}
      <div className="flex h-16 shrink-0 items-center border-b px-4">
        {logo && !collapsed && <div className="flex-1 truncate">{logo}</div>}
        {logo && collapsed && <div className="mx-auto">{logo}</div>}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto py-4">
        {filteredSections.map((section, sIdx) => (
          <div key={sIdx} className="mb-6">
            {section.title && !collapsed && (
              <h3 className="px-4 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </h3>
            )}
            <ul className="space-y-1 px-2">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  localPathname === item.href || localPathname.startsWith(item.href + '/');
                const link = (
                  <Link
                    href={item.external ? item.href : `/${locale}${item.href}`}
                    {...(onItemClick ? { onClick: onItemClick } : {})}
                    {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      'hover:bg-accent hover:text-accent-foreground',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isActive && 'bg-accent text-accent-foreground',
                      collapsed && 'justify-center px-2',
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                    {!collapsed && item.badge !== undefined && (
                      <span className="ms-auto rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );

                return (
                  <li key={item.href}>
                    {collapsed ? (
                      <TooltipRoot>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right">{item.label}</TooltipContent>
                      </TooltipRoot>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

// ---- Sidebar component -----------------------------------------------------

interface SidebarProps {
  sections: SidebarSection[];
  userRoles?: string[] | undefined;
  logo?: React.ReactNode | undefined;
  className?: string | undefined;
}

export function Sidebar({ sections, userRoles, logo, className }: SidebarProps) {
  const { isOpen, toggle, isDrawerOpen, setDrawerOpen, hasHydrated } = useSidebarOpen();
  const collapsed = hasHydrated && !isOpen;

  return (
    <TooltipProvider delayDuration={300}>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col border-e bg-background transition-[width] duration-200',
          hasHydrated && isOpen ? 'w-64' : 'w-16',
          className,
        )}
      >
        <SidebarContent
          sections={sections}
          userRoles={userRoles}
          logo={logo}
          collapsed={collapsed}
        />
        <div className="border-t p-2">
          <button
            type="button"
            onClick={toggle}
            aria-label={isOpen ? 'Reduire la sidebar' : 'Etendre la sidebar'}
            className="flex w-full items-center justify-center rounded-md p-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isOpen ? (
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      <Sheet open={isDrawerOpen} onOpenChange={setDrawerOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Ouvrir le menu"
            className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </SheetTrigger>
        <SheetContent side="start" className="w-72 p-0">
          <SheetTitle className="sr-only">Menu de navigation</SheetTitle>
          <SidebarContent
            sections={sections}
            userRoles={userRoles}
            logo={logo}
            collapsed={false}
            onItemClick={() => setDrawerOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}
