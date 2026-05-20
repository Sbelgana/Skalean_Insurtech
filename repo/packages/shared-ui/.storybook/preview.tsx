/**
 * Storybook 8.4 preview config -- @insurtech/shared-ui
 * Reference: task-1.4.16 Sprint 4 Phase 1
 *
 * Decorators:
 *   1. withThemeByClassName -- light/dark via html class
 *   2. NextIntlClientProvider -- i18n fr/ar-MA/ar
 *   3. lang + dir attribute on html element
 *
 * Global toolbar: locale (fr/ar-MA/ar), direction (ltr/rtl/auto)
 */
import type { Preview } from '@storybook/react';
import { withThemeByClassName } from '@storybook/addon-themes';
import { NextIntlClientProvider } from 'next-intl';
import React from 'react';
import '../src/styles/globals.css';

const messages = {
  fr: {
    common: { hello: 'Bonjour', save: 'Enregistrer', cancel: 'Annuler', loading: 'Chargement...' },
  },
  ar: {
    common: { hello: 'مرحبا', save: 'حفظ', cancel: 'إلغاء', loading: 'جار...' },
  },
  'ar-MA': {
    common: { hello: 'سلام', save: 'سجل', cancel: 'لغي', loading: 'كيدير...' },
  },
} as const;

const preview: Preview = {
  parameters: {
    layout: 'centered',
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
      expanded: true,
    },
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#1A2730' },
        { name: 'sky', value: '#B0CEE2' },
      ],
    },
    viewport: {
      viewports: {
        mobile1: { name: 'Small mobile', styles: { width: '320px', height: '568px' } },
        mobile2: { name: 'Large mobile', styles: { width: '414px', height: '896px' } },
        tablet: { name: 'Tablet', styles: { width: '768px', height: '1024px' } },
        desktop: { name: 'Desktop', styles: { width: '1280px', height: '720px' } },
      },
    },
    a11y: {
      element: '#storybook-root',
      config: {
        rules: [
          { id: 'aria-hidden-focus', enabled: false },
          { id: 'color-contrast', enabled: true },
        ],
      },
      options: {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      },
      manual: false,
    },
    docs: {
      toc: { contentsSelector: '.sbdocs-content', headingSelector: 'h2, h3' },
    },
  },
  globalTypes: {
    locale: {
      name: 'Locale',
      description: 'i18n locale',
      defaultValue: 'fr',
      toolbar: {
        icon: 'globe',
        items: [
          { value: 'fr', title: 'Francais' },
          { value: 'ar-MA', title: 'Darija (ar-MA)' },
          { value: 'ar', title: 'Arabe classique (ar)' },
        ],
        dynamicTitle: true,
      },
    },
    direction: {
      name: 'Direction',
      defaultValue: 'auto',
      toolbar: {
        icon: 'paragraph',
        items: [
          { value: 'ltr', title: 'LTR' },
          { value: 'rtl', title: 'RTL' },
          { value: 'auto', title: 'Auto (locale)' },
        ],
      },
    },
  },
  decorators: [
    withThemeByClassName({
      themes: { light: 'light', dark: 'dark' },
      defaultTheme: 'light',
    }),
    (Story, ctx) => {
      const locale = (ctx.globals.locale as string | undefined) ?? 'fr';
      const rawDir = ctx.globals.direction as string | undefined;
      const dir =
        rawDir === 'auto' || rawDir === undefined
          ? locale === 'ar' || locale === 'ar-MA'
            ? 'rtl'
            : 'ltr'
          : rawDir;

      React.useEffect(() => {
        document.documentElement.setAttribute('lang', locale);
        document.documentElement.setAttribute('dir', dir);
      }, [locale, dir]);

      const localeMessages = messages[locale as keyof typeof messages] ?? messages.fr;

      return (
        <NextIntlClientProvider locale={locale} messages={localeMessages}>
          <div lang={locale} dir={dir} style={{ padding: '1rem' }}>
            <Story />
          </div>
        </NextIntlClientProvider>
      );
    },
  ],
};

export default preview;
