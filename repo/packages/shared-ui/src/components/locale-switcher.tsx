'use client';

/**
 * LocaleSwitcher -- stub minimal (Tache 1.4.8 implementera composant complet)
 * Reference : Tache 1.4.1 web-broker bootstrap
 */
import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { useTransition } from 'react';

interface LocaleSwitcherProps {
  className?: string;
}

export function LocaleSwitcher({ className }: LocaleSwitcherProps) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const locales = ['fr', 'ar-MA', 'ar'] as const;
  const localeLabels: Record<string, string> = {
    fr: 'Francais',
    'ar-MA': 'Darija',
    ar: 'Arabe',
  };

  function handleChange(newLocale: string) {
    startTransition(() => {
      const segments = pathname.split('/');
      segments[1] = newLocale;
      router.replace(segments.join('/'));
    });
  }

  return (
    <div className={className} role="navigation" aria-label="Choix de langue">
      <button
        type="button"
        aria-label="langue"
        disabled={isPending}
        className="flex items-center gap-1 rounded border px-2 py-1 text-sm"
      >
        {localeLabels[locale] ?? locale}
      </button>
      <ul role="menu">
        {locales.map((loc) => (
          <li key={loc} role="none">
            <button
              role="menuitem"
              type="button"
              onClick={() => handleChange(loc)}
              className="block w-full px-3 py-1 text-sm text-left"
            >
              {localeLabels[loc]}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
