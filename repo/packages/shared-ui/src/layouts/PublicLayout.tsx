/**
 * PublicLayout -- marketing / SEO public layout with transparent header.
 * No authentication. No theme toggle (SSG charted Skalean Sofidemy).
 * Used by: web-customer-portal (3004).
 * Reference : task-1.4.14 Sprint 4 Phase 1
 */
import * as React from 'react';
import { MarketingHeader } from '../components/MarketingHeader.js';
import { MarketingFooter } from '../components/MarketingFooter.js';

export interface PublicLayoutProps {
  localeSwitcher?: React.ReactNode;
  ctaHref?: string;
  ctaLabel?: string;
  children: React.ReactNode;
}

export function PublicLayout({
  localeSwitcher,
  ctaHref = '/quote',
  ctaLabel = 'Devis gratuit',
  children,
}: PublicLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingHeader
        localeSwitcher={localeSwitcher}
        ctaHref={ctaHref}
        ctaLabel={ctaLabel}
      />
      <main role="main" className="flex-1">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
