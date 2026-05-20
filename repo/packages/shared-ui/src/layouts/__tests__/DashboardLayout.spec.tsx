import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DashboardLayout } from '../DashboardLayout';
import { Users } from 'lucide-react';

vi.mock('next/navigation', () => ({ usePathname: () => '/fr/contacts' }));
vi.mock('next-intl', () => ({
  useLocale: () => 'fr',
  useTranslations: () => (k: string, o?: { fallback?: string }) => o?.fallback ?? k,
}));
vi.mock('next-themes', () => ({ useTheme: () => ({ theme: 'light', setTheme: vi.fn() }) }));
vi.mock('../../hooks/useSidebarOpen', () => ({
  useSidebarOpen: Object.assign(
    () => ({ isOpen: true, isDrawerOpen: false, hasHydrated: true, toggle: vi.fn(), setDrawerOpen: vi.fn() }),
    { persist: { rehydrate: vi.fn() } },
  ),
}));

describe('DashboardLayout', () => {
  const sections = [
    { title: 'Ops', items: [{ label: 'Contacts', href: '/contacts', icon: Users }] },
  ];

  it('renders Sidebar + Topbar + content', () => {
    render(<DashboardLayout sidebarItems={sections}><div>page-content</div></DashboardLayout>);
    expect(screen.getByText('page-content')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('renders hamburger trigger for mobile drawer', () => {
    render(<DashboardLayout sidebarItems={sections}><div /></DashboardLayout>);
    // Both Topbar and Sidebar expose a hamburger/drawer trigger with this label
    const triggers = screen.getAllByLabelText('Ouvrir le menu');
    expect(triggers.length).toBeGreaterThan(0);
  });

  it('renders breadcrumb navigation', () => {
    render(<DashboardLayout sidebarItems={sections}><div /></DashboardLayout>);
    // The Topbar wraps the <nav> in a <div> -- both carry aria-label; use role to target the <nav>
    expect(screen.getByRole('navigation', { name: /ariane/i })).toBeInTheDocument();
  });

  it('filters sidebar items by userRoles', () => {
    const protectedSections = [
      {
        items: [
          { label: 'Admin', href: '/admin', icon: Users, requiredRoles: ['admin'] },
        ],
      },
    ];
    const { rerender } = render(
      <DashboardLayout sidebarItems={protectedSections} userRoles={['user']}>
        <div />
      </DashboardLayout>,
    );
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();

    rerender(
      <DashboardLayout sidebarItems={protectedSections} userRoles={['admin']}>
        <div />
      </DashboardLayout>,
    );
    expect(screen.getAllByText('Admin').length).toBeGreaterThan(0);
  });
});
