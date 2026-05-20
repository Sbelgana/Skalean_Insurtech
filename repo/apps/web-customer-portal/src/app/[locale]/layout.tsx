/**
 * Root layout -- web-customer-portal
 * Reference : task-1.4.5 + task-1.4.15 Sprint 4 Phase 1
 *
 * Public marketing layout: PublicLayout from @insurtech/shared-ui.
 * MarketingHeader + MarketingFooter. No authentication required.
 */
import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Montserrat, Noto_Naskh_Arabic, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { ThemeProvider } from 'next-themes';
import { PublicLayout } from '@insurtech/shared-ui';
import { Providers } from '@/components/providers';
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
    applicationName: 'Skalean Assurance',
    authors: [{ name: 'Skalean InsurTech' }],
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3004'),
    robots: { index: true, follow: true },
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
      data-theme="public"
      className={`${montserrat.variable} ${notoNaskhArabic.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <NextIntlClientProvider locale={locale} messages={messages} timeZone="Africa/Casablanca">
            <Providers locale={locale}>
              <PublicLayout>
                {children}
              </PublicLayout>
            </Providers>
          </NextIntlClientProvider>
          <Toaster position={dir === 'rtl' ? 'top-left' : 'top-right'} richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
