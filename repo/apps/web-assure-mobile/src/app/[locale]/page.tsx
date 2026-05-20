/**
 * Landing placeholder -- web-assure-mobile
 * Reference : task-1.4.7 Sprint 4 Phase 1
 *
 * Sprint 21 remplacera ce placeholder par le dashboard assure mobile.
 * Mobile-first : navigation bas de page, grille 2 colonnes.
 */
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LocaleSwitcher } from '@insurtech/shared-ui/components/locale-switcher';
import { ThemeToggle } from '@insurtech/shared-ui/components/theme-toggle';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'home' });
  const tMobile = await getTranslations({ locale, namespace: 'mobile' });

  return (
    <main className="min-h-screen pb-safe-bottom">
      <header className="flex items-center justify-between gap-4 px-4 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-md font-bold text-white"
            style={{ backgroundColor: '#2D5773' }}
            aria-label="Skalean Assure"
          >
            A
          </div>
          <h1 className="text-lg font-extrabold tracking-tight text-primary">
            {t('title')}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 px-4 py-4">
        <article className="rounded-xl border bg-card p-4 shadow-sm">
          <span className="block h-1.5 w-12 rounded-full" style={{ backgroundColor: '#2D5773' }} />
          <h2 className="mt-3 text-sm font-semibold">{tMobile('declarerSinistre')}</h2>
        </article>
        <article className="rounded-xl border bg-card p-4 shadow-sm">
          <span className="block h-1.5 w-12 rounded-full" style={{ backgroundColor: '#1A2730' }} />
          <h2 className="mt-3 text-sm font-semibold">{tMobile('mesAssurances')}</h2>
        </article>
        <article className="rounded-xl border bg-card p-4 shadow-sm">
          <span className="block h-1.5 w-12 rounded-full" style={{ backgroundColor: '#B0CEE2' }} />
          <h2 className="mt-3 text-sm font-semibold">{tMobile('localiserGarage')}</h2>
        </article>
        <article className="rounded-xl border bg-card p-4 shadow-sm">
          <span className="block h-1.5 w-12 rounded-full" style={{ backgroundColor: '#E95D2C' }} />
          <h2 className="mt-3 text-sm font-semibold">{tMobile('photosAccident')}</h2>
        </article>
      </section>

      <section className="mx-4 mt-2 rounded-xl border bg-muted/30 p-4">
        <p className="text-xs text-muted-foreground">{t('placeholder.banner')}</p>
        <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
          Sprint 21 implementera dashboard assure mobile ici
        </p>
      </section>
    </main>
  );
}
