import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Topbar } from '../Topbar';

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string, o?: { fallback?: string }) => o?.fallback ?? k,
}));
vi.mock('../../hooks/useSidebarOpen', () => ({
  useSidebarOpen: Object.assign(
    () => ({ isOpen: true, isDrawerOpen: false, hasHydrated: true, toggle: vi.fn(), setDrawerOpen: vi.fn() }),
    { persist: { rehydrate: vi.fn() }, setState: vi.fn(), getState: () => ({}) },
  ),
}));

describe('Topbar', () => {
  it('renders provided slots', () => {
    render(
      <Topbar
        breadcrumb={<span>bc</span>}
        actions={<button type="button">action</button>}
        userMenu={<span>um</span>}
        notificationBell={<span>nb</span>}
      />,
    );
    expect(screen.getByText('um')).toBeInTheDocument();
    expect(screen.getByText('nb')).toBeInTheDocument();
  });

  it('is sticky top-0', () => {
    render(<Topbar />);
    const banner = screen.getByRole('banner');
    expect(banner.className).toContain('sticky');
    expect(banner.className).toContain('top-0');
  });

  it('shows hamburger when showHamburger=true', () => {
    render(<Topbar showHamburger={true} />);
    expect(screen.getByLabelText('Ouvrir le menu')).toBeInTheDocument();
  });

  it('does not show hamburger when showHamburger=false', () => {
    render(<Topbar showHamburger={false} />);
    expect(screen.queryByLabelText('Ouvrir le menu')).not.toBeInTheDocument();
  });
});
