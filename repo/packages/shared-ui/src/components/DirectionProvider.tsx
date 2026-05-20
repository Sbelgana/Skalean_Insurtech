'use client';

/**
 * DirectionProvider : synchronise l'attribut dir sur <html> avec la locale courante.
 *
 * Cote serveur, <html dir={dir}> est deja rendu correctement par layout.tsx.
 * Ce composant est un filet de securite client pour changements dynamiques.
 */
import * as React from 'react';
import { useLocale } from 'next-intl';
import { isRtl, getDirection } from '../i18n/routing';

type DirectionProviderProps = {
  children: React.ReactNode;
};

export function DirectionProvider({ children }: DirectionProviderProps): React.JSX.Element {
  const locale = useLocale();
  const dir = getDirection(locale);

  React.useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const html = document.documentElement;
    if (html.dir !== dir) {
      html.dir = dir;
    }
    if (html.lang !== locale) {
      html.lang = locale;
    }
    html.classList.toggle('rtl', isRtl(locale));
    html.classList.toggle('ltr', !isRtl(locale));
  }, [locale, dir]);

  return <>{children}</>;
}

export function useRtlDirection(): 'ltr' | 'rtl' {
  const locale = useLocale();
  return getDirection(locale);
}

export function useIsRtl(): boolean {
  const locale = useLocale();
  return isRtl(locale);
}
