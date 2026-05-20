/**
 * Products page -- web-customer-portal (ISR)
 * Reference : task-1.4.5 Sprint 4 Phase 1
 *
 * Page ISR : revalidee toutes les heures. Sprint 19 implementera le catalogue complet.
 */
import { setRequestLocale } from 'next-intl/server';

// ISR: revalidate every hour
export const revalidate = 3600;

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function ProductsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="container mx-auto px-6 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: '#1A2730' }}>
        Nos Produits d'Assurance
      </h1>
      <p className="mt-4 text-muted-foreground">
        Decouvrez notre gamme complete de produits d'assurance. Sprint 19 completera ce catalogue.
      </p>
      <section className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-xl border bg-card p-6 shadow-sm">
          <span className="block h-2 w-12 rounded-full" style={{ backgroundColor: '#E95D2C' }} />
          <h2 className="mt-4 text-lg font-semibold">Assurance Auto</h2>
          <p className="mt-2 text-sm text-muted-foreground">Protegez votre vehicule avec nos formules flexibles.</p>
        </article>
        <article className="rounded-xl border bg-card p-6 shadow-sm">
          <span className="block h-2 w-12 rounded-full" style={{ backgroundColor: '#B0CEE2' }} />
          <h2 className="mt-4 text-lg font-semibold">Assurance Habitation</h2>
          <p className="mt-2 text-sm text-muted-foreground">Securisez votre logement et vos biens.</p>
        </article>
        <article className="rounded-xl border bg-card p-6 shadow-sm">
          <span className="block h-2 w-12 rounded-full" style={{ backgroundColor: '#2D5773' }} />
          <h2 className="mt-4 text-lg font-semibold">Assurance Sante</h2>
          <p className="mt-2 text-sm text-muted-foreground">Prenez soin de votre sante et celle de votre famille.</p>
        </article>
      </section>
    </div>
  );
}
