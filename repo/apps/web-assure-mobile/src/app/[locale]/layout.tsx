/**
 * Root layout -- web-assure-mobile
 * Reference : task-1.4.7 Sprint 4 Phase 1
 *
 * Server Component. Exposes :
 *   - Document <html lang dir data-theme="assure-mobile">
 *   - Fonts via next/font/google (Montserrat + Noto Naskh Arabic)
 *   - NextIntlClientProvider (locale + messages)
 *   - Providers wrapper ('use client' QueryClient + Theme + Sentry)
 *   - OfflineBanner + UpdateAvailableBanner (PWA)
 *   - Mobile bottom navigation layout
 *   - Apple mobile web app meta
 */
import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Montserrat, Noto_Naskh_Arabic, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { ThemeProvider } from 'next-themes';
import { Providers } from '@/components/providers';
import { OfflineBanner } from '@/components/OfflineBanner';
import { UpdateAvailableBanner } from '@/components/UpdateAvailableBanner';
import { routing } from '@/i18n/routing';
import '@/app/globals.css';

const montserrat = Montserrat({
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '600', '700', '800', '900'],
  variable: '--font-montserrat',
  display: 'swap',
  preload: true,
});

const notoNaskhArabic = Noto_Naskh_Arabic({
  subsets: ['arabic'],
  weight: ['400', '700'],
  variable: '--font-arabic',
  display: 'swap',
  preload: true,
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-mono',
  display: 'swap',
  preload: false,
});

const RTL_LOCALES = new Set<string>(['ar', 'ar-MA']);

type LocaleParams = { locale: string };

export async function generateStaticParams(): Promise<LocaleParams[]> {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<LocaleParams> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    title: { default: t('title.default'), template: `%s | ${t('title.brand')}` },
    description: t('description'),
    applicationName: 'Skalean Assure',
    authors: [{ name: 'Skalean InsurTech' }],
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3006'),
    robots: { index: false, follow: false },
    icons: {
      icon: '/favicon.svg',
      apple: '/icons/apple-touch-icon.png',
    },
    manifest: '/manifest.webmanifest',
    alternates: {
      canonical: `/${locale}`,
      languages: { fr: '/fr', 'ar-MA': '/ar-MA', ar: '/ar' },
    },
    other: {
      'apple-mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-status-bar-style': 'black-translucent',
      'apple-mobile-web-app-title': 'Skalean Assure',
      'mobile-web-app-capable': 'yes',
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#2D5773' },
    { media: '(prefers-color-scheme: dark)', color: '#1A2730' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

interface RootLayoutProps {
  children: React.ReactNode;
  params: Promise<LocaleParams>;
}

export default async function RootLayout({ children, params }: RootLayoutProps) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages({ locale });
  const dir = RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';

  return (
    <html
      lang={locale}
      dir={dir}
      data-theme="assure-mobile"
      className={`${montserrat.variable} ${notoNaskhArabic.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <NextIntlClientProvider locale={locale} messages={messages} timeZone="Africa/Casablanca">
            <Providers locale={locale}>
              <OfflineBanner />
              <div className="flex min-h-screen flex-col pb-safe-bottom">
                {children}
              </div>
              <UpdateAvailableBanner />
              {/* Mobile bottom navigation */}
              <nav
                className="fixed bottom-0 left-0 right-0 z-40 border-t bg-card pb-safe-bottom"
                aria-label="Navigation mobile assure"
                style={{ borderColor: '#2D5773/20' }}
              >
                <div className="flex items-center justify-around px-2 py-2">
                  <a
                    href={`/${locale}`}
                    className="flex flex-col items-center gap-0.5 px-3 py-1 text-xs font-medium text-muted-foreground hover:text-primary"
                  >
                    Accueil
                  </a>
                  <a
                    href={`/${locale}/sinistres`}
                    className="flex flex-col items-center gap-0.5 px-3 py-1 text-xs font-medium text-muted-foreground hover:text-primary"
                  >
                    Sinistres
                  </a>
                  <a
                    href={`/${locale}/polices`}
                    className="flex flex-col items-center gap-0.5 px-3 py-1 text-xs font-medium text-muted-foreground hover:text-primary"
                  >
                    Polices
                  </a>
                  <a
                    href={`/${locale}/garage`}
                    className="flex flex-col items-center gap-0.5 px-3 py-1 text-xs font-medium text-muted-foreground hover:text-primary"
                  >
                    Garage
                  </a>
                  <a
                    href={`/${locale}/profil`}
                    className="flex flex-col items-center gap-0.5 px-3 py-1 text-xs font-medium text-muted-foreground hover:text-primary"
                  >
                    Profil
                  </a>
                </div>
              </nav>
            </Providers>
          </NextIntlClientProvider>
          <Toaster position={dir === 'rtl' ? 'top-left' : 'top-right'} richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
