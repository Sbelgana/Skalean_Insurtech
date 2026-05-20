import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SelfServiceLayout } from '../SelfServiceLayout';

vi.mock('next/navigation', () => ({ usePathname: () => '/fr' }));
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

describe('SelfServiceLayout', () => {
  it('renders content without sidebar', () => {
    render(<SelfServiceLayout><div>content</div></SelfServiceLayout>);
    expect(screen.getByText('content')).toBeInTheDocument();
    // No sidebar navigation
    expect(screen.queryByRole('navigation', { name: /Navigation principale$/i })).not.toBeInTheDocument();
  });

  it('applies large base font (text-lg)', () => {
    const { container } = render(<SelfServiceLayout><div /></SelfServiceLayout>);
    expect((container.firstChild as HTMLElement).className).toContain('text-lg');
  });

  it('content is constrained to max-w-3xl', () => {
    render(<SelfServiceLayout><div data-testid="ct" /></SelfServiceLayout>);
    const main = screen.getByRole('main');
    expect(main.className).toContain('max-w-3xl');
  });

  it('renders banner and contentinfo roles', () => {
    render(<SelfServiceLayout><div /></SelfServiceLayout>);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });
});
