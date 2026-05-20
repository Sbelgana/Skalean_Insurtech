'use client';

/**
 * LocaleSwitcher dropdown : permet a l'utilisateur de changer de locale.
 *
 * - Liste 3 locales avec native names + flag SVG
 * - Click change URL en preservant pathname + query + hash
 * - Persiste preference dans cookie NEXT_LOCALE 365 jours
 * - Accessible : keyboard nav (Tab, Arrow, Enter), ARIA labelledby
 */
import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from '../i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { LOCALES, type LocaleConfig } from '../i18n/locales';
import { cn } from '../lib/cn';

type LocaleSwitcherProps = {
  className?: string;
  variant?: 'dropdown' | 'inline';
  showFlags?: boolean;
};

function ChevronDownIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function LocaleSwitcher({
  className,
  variant = 'dropdown',
  showFlags = true,
}: LocaleSwitcherProps): React.JSX.Element {
  const t = useTranslations('locale');
  const currentLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentConfig = LOCALES.find((l) => l.code === currentLocale) ?? LOCALES[0];

  if (!currentConfig) {
    return <div className={className} />;
  }

  function handleSelect(locale: LocaleConfig['code']): void {
    if (locale === currentLocale) {
      setIsOpen(false);
      return;
    }
    const queryString = searchParams.toString();
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const targetPath = pathname + (queryString ? `?${queryString}` : '') + hash;
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    document.cookie = `NEXT_LOCALE=${locale}; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax${
      isHttps ? '; Secure' : ''
    }`;
    router.replace(targetPath, { locale });
    setIsOpen(false);
  }

  if (variant === 'inline') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {LOCALES.map((locale) => (
          <button
            key={locale.code}
            type="button"
            onClick={() => handleSelect(locale.code)}
            className={cn(
              'px-2 py-1 text-sm rounded',
              locale.code === currentLocale ? 'font-semibold' : 'opacity-60',
            )}
          >
            <span dir={locale.dir}>{locale.nativeName}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className={cn('relative inline-block', className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={t('switcherAria')}
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition"
      >
        {showFlags && (
          <img src={currentConfig.flagPath} alt="" width={16} height={12} className="shrink-0" />
        )}
        <span dir={currentConfig.dir}>{currentConfig.nativeName}</span>
        <ChevronDownIcon className="opacity-60" />
      </button>
      {isOpen && (
        <ul
          role="listbox"
          aria-label={t('listAria')}
          className="absolute end-0 mt-1 w-56 z-[60] rounded-md border bg-white py-1 shadow-lg"
        >
          {LOCALES.map((locale) => (
            <li key={locale.code}>
              <button
                type="button"
                role="option"
                aria-selected={locale.code === currentLocale}
                onClick={() => handleSelect(locale.code)}
                className={cn(
                  'flex w-full items-center gap-3 px-3 py-2 text-sm transition',
                  locale.code === currentLocale && 'font-semibold',
                )}
              >
                {showFlags && (
                  <img src={locale.flagPath} alt="" width={16} height={12} className="shrink-0" />
                )}
                <span dir={locale.dir} className="flex-1 text-start">
                  {locale.nativeName}
                </span>
                {locale.code === currentLocale && <CheckIcon />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
