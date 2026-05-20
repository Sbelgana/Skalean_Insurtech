import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Sidebar } from '../Sidebar';
import { Users, Settings } from 'lucide-react';
import { useSidebarOpen } from '../../hooks/useSidebarOpen';

vi.mock('next/navigation', () => ({ usePathname: () => '/fr/contacts' }));
vi.mock('next-intl', () => ({
  useLocale: () => 'fr',
  useTranslations: () => (k: string, o?: { fallback?: string }) => o?.fallback ?? k,
}));

// Partial mock -- preserve real store API but expose setState for tests
vi.mock('../../hooks/useSidebarOpen', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../hooks/useSidebarOpen')>();
  return mod;
});

describe('Sidebar', () => {
  beforeEach(() => {
    useSidebarOpen.setState({
      isOpen: true,
      isDrawerOpen: false,
      hasHydrated: true,
    });
  });

  const sections = [
    { title: 'Ops', items: [{ label: 'Contacts', href: '/contacts', icon: Users }] },
    {
      title: 'Admin',
      items: [{ label: 'Settings', href: '/settings', icon: Settings, requiredRoles: ['admin'] }],
    },
  ];

  it('renders sections and items', () => {
    render(<Sidebar sections={sections} />);
    expect(screen.getAllByText('Contacts').length).toBeGreaterThan(0);
  });

  it('marks active item via aria-current', () => {
    render(<Sidebar sections={sections} />);
    const links = screen.getAllByText('Contacts');
    const link = links[0]?.closest('a');
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('filters items by userRoles', () => {
    render(<Sidebar sections={sections} userRoles={['user']} />);
    expect(screen.queryAllByText('Settings').length).toBe(0);
  });

  it('toggles collapse on button click', () => {
    render(<Sidebar sections={sections} />);
    const btn = screen.getByLabelText(/Reduire la sidebar/i);
    fireEvent.click(btn);
    expect(useSidebarOpen.getState().isOpen).toBe(false);
  });
});
