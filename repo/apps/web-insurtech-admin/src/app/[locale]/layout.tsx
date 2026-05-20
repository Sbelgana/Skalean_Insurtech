/**
 * Root layout -- web-insurtech-admin
 * Reference : task-1.4.4 Sprint 4 Phase 1
 *
 * Server Component. Exposes :
 *   - Document <html lang dir data-theme="admin">
 *   - Fonts via next/font/google (Montserrat + Noto Naskh Arabic)
 *   - NextIntlClientProvider (locale + messages)
 *   - Providers wrapper ('use client' QueryClient + Theme + Sentry)
 *   - Admin sidebar layout
 *   - AdminBranding component
 */
import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Montserrat, Noto_Naskh_Arabic, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { ThemeProvider } from 'next-themes';
import { Providers } from '@/components/providers';
import { AdminBranding } from '@/components/AdminBranding';
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
    applicationName: 'Skalean Admin',
    authors: [{ name: 'Skalean InsurTech' }],
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
    robots: { index: false, follow: false },
    icons: { icon: '/favicon.svg', apple: '/icons/apple-touch-icon.png' },
    manifest: '/manifest.webmanifest',
    alternates: {
      canonical: `/${locale}`,
      languages: { fr: '/fr', 'ar-MA': '/ar-MA', ar: '/ar' },
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#1A2730' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
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
      data-theme="admin"
      className={`${montserrat.variable} ${notoNaskhArabic.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <NextIntlClientProvider locale={locale} messages={messages} timeZone="Africa/Casablanca">
            <Providers locale={locale}>
              <div className="flex min-h-screen">
                <aside className="hidden w-64 flex-col border-r bg-card lg:flex" style={{ borderColor: '#1A2730/20' }}>
                  <div className="flex h-16 items-center border-b px-6" style={{ borderColor: '#1A2730/20' }}>
                    <AdminBranding />
                  </div>
                  <nav className="flex-1 space-y-1 p-4" aria-label="Navigation admin">
                    <a href={`/${locale}`} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
                      Tableau de bord
                    </a>
                    <a href={`/${locale}/tenants`} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
                      Tenants
                    </a>
                    <a href={`/${locale}/monitoring`} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
                      Monitoring
                    </a>
                    <a href={`/${locale}/reports`} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
                      Rapports
                    </a>
                    <a href={`/${locale}/conformite`} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
                      Conformite
                    </a>
                  </nav>
                </aside>
                <div className="flex flex-1 flex-col">
                  {children}
                </div>
              </div>
            </Providers>
          </NextIntlClientProvider>
          <Toaster position={dir === 'rtl' ? 'top-left' : 'top-right'} richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
