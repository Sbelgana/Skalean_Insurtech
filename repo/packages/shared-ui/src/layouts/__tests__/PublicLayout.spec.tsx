import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PublicLayout } from '../PublicLayout';

vi.mock('next/navigation', () => ({ usePathname: () => '/fr' }));
vi.mock('next-intl', () => ({
  useLocale: () => 'fr',
  useTranslations: () => (k: string, o?: { fallback?: string }) => o?.fallback ?? k,
}));

describe('PublicLayout', () => {
  it('renders MarketingHeader and Footer', () => {
    render(<PublicLayout><div>hero</div></PublicLayout>);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByText('hero')).toBeInTheDocument();
  });

  it('does not render UserMenu (no auth)', () => {
    render(<PublicLayout><div /></PublicLayout>);
    expect(screen.queryByLabelText(/menu utilisateur/i)).not.toBeInTheDocument();
  });

  it('footer has ACAPS and CNDP mentions', () => {
    render(<PublicLayout><div /></PublicLayout>);
    // Use link role to target the specific anchor elements in the legal bar
    expect(screen.getByRole('link', { name: 'ACAPS' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'CNDP' })).toBeInTheDocument();
  });

  it('renders CTA link', () => {
    render(<PublicLayout ctaLabel="Devis gratuit"><div /></PublicLayout>);
    const cta = screen.getByText('Devis gratuit');
    expect(cta).toBeInTheDocument();
  });
});
