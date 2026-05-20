import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BottomTabs } from '../BottomTabs';
import { Home, Bell, User } from 'lucide-react';

vi.mock('next/navigation', () => ({ usePathname: () => '/fr/notifications' }));
vi.mock('next-intl', () => ({ useLocale: () => 'fr' }));

describe('BottomTabs', () => {
  const tabs = [
    { label: 'Accueil', href: '/', icon: Home },
    { label: 'Notifs', href: '/notifications', icon: Bell, badge: 3 },
    { label: 'Profil', href: '/profile', icon: User },
  ];

  it('renders 3 tabs as links', () => {
    render(<BottomTabs tabs={tabs} />);
    expect(screen.getAllByRole('link')).toHaveLength(3);
  });

  it('marks active tab via aria-current', () => {
    render(<BottomTabs tabs={tabs} />);
    const active = screen.getByText('Notifs').closest('a');
    expect(active).toHaveAttribute('aria-current', 'page');
  });

  it('renders badge count', () => {
    render(<BottomTabs tabs={tabs} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('caps badge at 99+', () => {
    render(<BottomTabs tabs={[{ label: 'X', href: '/x', icon: Home, badge: 150 }]} />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('has md:hidden class for mobile-only display', () => {
    render(<BottomTabs tabs={tabs} />);
    const nav = screen.getByRole('navigation');
    expect(nav.className).toContain('md:hidden');
  });
});
