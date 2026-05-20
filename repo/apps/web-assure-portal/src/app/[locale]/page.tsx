/**
 * Landing placeholder -- web-assure-portal
 * Reference : task-1.4.6 Sprint 4 Phase 1
 *
 * Sprint 20 remplacera ce placeholder par le dashboard assure.
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

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: '#B0CEE2' }}>
          {t('title')}
        </h1>
        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </div>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <article className="rounded-xl border bg-card p-5 shadow-sm">
          <span className="block h-2 w-12 rounded-full" style={{ backgroundColor: '#B0CEE2' }} />
          <h2 className="mt-3 text-base font-semibold">{t('palette.primary')}</h2>
          <p className="mt-1 font-mono text-sm text-muted-foreground">#B0CEE2</p>
        </article>
        <article className="rounded-xl border bg-card p-5 shadow-sm">
          <span className="block h-2 w-12 rounded-full" style={{ backgroundColor: '#1A2730' }} />
          <h2 className="mt-3 text-base font-semibold">{t('palette.secondary')}</h2>
          <p className="mt-1 font-mono text-sm text-muted-foreground">#1A2730</p>
        </article>
        <article className="rounded-xl border bg-card p-5 shadow-sm">
          <span className="block h-2 w-12 rounded-full" style={{ backgroundColor: '#E95D2C' }} />
          <h2 className="mt-3 text-base font-semibold">{t('palette.accent')}</h2>
          <p className="mt-1 font-mono text-sm text-muted-foreground">#E95D2C</p>
        </article>
        <article className="rounded-xl border bg-card p-5 shadow-sm">
          <span className="block h-2 w-12 rounded-full" style={{ backgroundColor: '#2D5773' }} />
          <h2 className="mt-3 text-base font-semibold">{t('palette.acaps')}</h2>
          <p className="mt-1 font-mono text-sm text-muted-foreground">#2D5773</p>
        </article>
      </section>

      <section className="mt-8 rounded-xl border bg-muted/30 p-5">
        <p className="text-sm text-muted-foreground">{t('placeholder.banner')}</p>
        <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
          Sprint 20 implementera dashboard assure ici
        </p>
      </section>
    </div>
  );
}
