/**
 * About page -- web-customer-portal (SSG)
 * Reference : task-1.4.5 Sprint 4 Phase 1
 *
 * Page SSG statique. Sprint 19 implementera le contenu complet.
 */
import { setRequestLocale } from 'next-intl/server';

export const dynamic = 'force-static';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function AboutPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="container mx-auto px-6 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: '#1A2730' }}>
        A propos de Skalean Assurance
      </h1>
      <p className="mt-4 text-muted-foreground">
        Skalean InsurTech est une plateforme marocaine de gestion de l'assurance. Sprint 19 completera cette page.
      </p>
    </div>
  );
}
