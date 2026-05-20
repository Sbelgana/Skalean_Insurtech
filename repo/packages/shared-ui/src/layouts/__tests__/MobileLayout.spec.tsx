import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MobileLayout } from '../MobileLayout';
import { Home, Search, User } from 'lucide-react';

vi.mock('next/navigation', () => ({ usePathname: () => '/fr' }));
vi.mock('next-intl', () => ({
  useLocale: () => 'fr',
  useTranslations: () => (k: string, o?: { fallback?: string }) => o?.fallback ?? k,
}));

describe('MobileLayout', () => {
  const tabs = [
    { label: 'Accueil', href: '/', icon: Home },
    { label: 'Recherche', href: '/search', icon: Search },
    { label: 'Profil', href: '/profile', icon: User },
  ];

  it('renders BottomTabs with labels', () => {
    render(<MobileLayout tabs={tabs}><div>page</div></MobileLayout>);
    expect(screen.getByText('Accueil')).toBeInTheDocument();
    expect(screen.getByText('page')).toBeInTheDocument();
  });

  it('main has safe-area bottom padding', () => {
    render(<MobileLayout tabs={tabs}><div /></MobileLayout>);
    const main = screen.getByRole('main');
    expect(main.style.paddingBottom).toContain('env(safe-area-inset-bottom)');
  });

  it('renders banner and main roles', () => {
    render(<MobileLayout tabs={tabs}><div /></MobileLayout>);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});
