'use client';

/**
 * MarketingHeader -- transparent-on-hero navigation header for public pages.
 * Becomes solid + blur on scroll > 80px.
 * Reference : task-1.4.14 Sprint 4 Phase 1
 */
import * as React from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Menu, X } from 'lucide-react';
import { LogoSkalean } from './LogoSkalean.js';
import { cn } from '../lib/cn.js';

interface MarketingHeaderProps {
  localeSwitcher?: React.ReactNode;
  ctaHref: string;
  ctaLabel: string;
}

const navLinks = [
  { key: 'auto', href: '/auto' },
  { key: 'habitation', href: '/habitation' },
  { key: 'sante', href: '/sante' },
  { key: 'compare', href: '/comparateur' },
  { key: 'about', href: '/apropos' },
  { key: 'contact', href: '/contact' },
] as const;

export function MarketingHeader({ localeSwitcher, ctaHref, ctaLabel }: MarketingHeaderProps) {
  const [scrolled, setScrolled] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const locale = useLocale();
  const t = useTranslations('publicNav');

  React.useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setScrolled(window.scrollY > 80));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <header
      role="banner"
      className={cn(
        'sticky top-0 z-40 transition-all duration-200',
        scrolled
          ? 'bg-background/90 backdrop-blur-md border-b shadow-sm'
          : 'bg-transparent border-b border-transparent',
      )}
    >
      <div className="mx-auto max-w-7xl flex h-16 items-center justify-between px-4 md:px-6">
        <Link
          href={`/${locale}`}
          className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
        >
          <LogoSkalean className="h-8 w-auto" />
        </Link>

        <nav
          role="navigation"
          aria-label={t('label' as Parameters<typeof t>[0], { fallback: 'Menu principal' } as Parameters<typeof t>[1])}
          className="hidden md:flex items-center gap-1"
        >
          {navLinks.map((l) => (
            <Link
              key={l.key}
              href={`/${locale}${l.href}`}
              className="px-3 py-2 text-sm font-medium rounded-md hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t(l.key as Parameters<typeof t>[0], { fallback: l.key } as Parameters<typeof t>[1])}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {localeSwitcher}
          <Link
            href={`/${locale}${ctaHref}`}
            className="hidden sm:inline-flex items-center justify-center h-10 px-4 rounded-md bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {ctaLabel}
          </Link>
          <button
            type="button"
            className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-accent"
            aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t bg-background">
          <nav className="flex flex-col p-2" aria-label="Menu mobile">
            {navLinks.map((l) => (
              <Link
                key={l.key}
                href={`/${locale}${l.href}`}
                className="px-4 py-3 rounded-md hover:bg-accent text-sm font-medium"
                onClick={() => setMobileOpen(false)}
              >
                {t(l.key as Parameters<typeof t>[0], { fallback: l.key } as Parameters<typeof t>[1])}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
