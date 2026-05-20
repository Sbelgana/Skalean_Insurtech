// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import * as React from 'react';
import { LocaleSwitcher } from '../LocaleSwitcher';

const messages = { locale: { switcherAria: 'Changer langue', listAria: 'Liste langues', current: 'Langue : {name}' } };

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('page=3'),
}));
vi.mock('../../i18n/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/contacts',
}));

describe('LocaleSwitcher', () => {
  function wrap(locale = 'fr') {
    return (
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="Africa/Casablanca">
        <LocaleSwitcher />
      </NextIntlClientProvider>
    );
  }

  it('renders current locale native name', () => {
    render(wrap('fr'));
    expect(screen.getByText('Francais')).toBeDefined();
  });

  it('opens dropdown on click', () => {
    render(wrap('fr'));
    const button = screen.getByRole('button', { name: /changer/i });
    fireEvent.click(button);
    expect(screen.getByRole('listbox')).toBeDefined();
  });

  it('renders 3 locale options when open', () => {
    render(wrap('fr'));
    fireEvent.click(screen.getByRole('button', { name: /changer/i }));
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3);
  });

  it('marks current locale as selected', () => {
    render(wrap('ar-MA'));
    fireEvent.click(screen.getByRole('button'));
    const selected = screen.getAllByRole('option').find(
      (el) => el.getAttribute('aria-selected') === 'true',
    );
    expect(selected).toBeDefined();
  });

  it('sets cookie NEXT_LOCALE on locale change', () => {
    render(wrap('fr'));
    fireEvent.click(screen.getByRole('button', { name: /changer/i }));
    const options = screen.getAllByRole('option');
    const arMAOption = options[1];
    if (arMAOption) {
      fireEvent.click(arMAOption);
    }
    expect(document.cookie).toContain('NEXT_LOCALE');
  });
});
