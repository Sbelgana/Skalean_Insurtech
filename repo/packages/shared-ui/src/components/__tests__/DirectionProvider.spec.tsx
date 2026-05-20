// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import * as React from 'react';
import { DirectionProvider } from '../DirectionProvider';

describe('DirectionProvider', () => {
  function wrap(locale: string, children: React.ReactNode) {
    return (
      <NextIntlClientProvider locale={locale} messages={{}} timeZone="Africa/Casablanca">
        <DirectionProvider>{children}</DirectionProvider>
      </NextIntlClientProvider>
    );
  }

  it('sets dir=rtl for ar', () => {
    render(wrap('ar', <div>Test</div>));
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('sets dir=rtl for ar-MA', () => {
    render(wrap('ar-MA', <div>Test</div>));
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('sets dir=ltr for fr', () => {
    render(wrap('fr', <div>Test</div>));
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('toggles class rtl/ltr on html', () => {
    render(wrap('ar', <div>Test</div>));
    expect(document.documentElement.classList.contains('rtl')).toBe(true);
    expect(document.documentElement.classList.contains('ltr')).toBe(false);
  });
});
