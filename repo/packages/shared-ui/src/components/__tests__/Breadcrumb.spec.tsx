import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Breadcrumb } from '../Breadcrumb';

vi.mock('next/navigation', () => ({ usePathname: () => '/fr/contacts/123' }));
vi.mock('next-intl', () => ({
  useLocale: () => 'fr',
  useTranslations: () => (k: string, o?: { fallback?: string }) => o?.fallback ?? k,
}));

describe('Breadcrumb', () => {
  it('auto-builds items from pathname', () => {
    render(<Breadcrumb />);
    expect(screen.getByText('Accueil')).toBeInTheDocument();
    expect(screen.getByText('Contacts')).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
  });

  it('uses dynamicSegments override for ids', () => {
    render(<Breadcrumb dynamicSegments={{ '123': 'Mohammed Alami' }} />);
    expect(screen.getByText('Mohammed Alami')).toBeInTheDocument();
    expect(screen.queryByText('123')).not.toBeInTheDocument();
  });

  it('last item is non-clickable with aria-current', () => {
    render(<Breadcrumb />);
    const last = screen.getByText('123');
    expect(last).toHaveAttribute('aria-current', 'page');
    expect(last.tagName).toBe('SPAN');
  });

  it('uses manual items prop when provided', () => {
    render(<Breadcrumb items={[{ label: 'Home', href: '/fr' }, { label: 'Custom Page' }]} />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Custom Page')).toBeInTheDocument();
  });
});
