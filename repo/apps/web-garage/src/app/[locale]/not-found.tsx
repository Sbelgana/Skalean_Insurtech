/**
 * 404 Not Found page -- web-garage
 * Reference : task-1.4.15 Sprint 4 Phase 1
 */
import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex flex-col items-center gap-3">
        <span className="text-6xl font-extrabold text-primary">404</span>
        <h1 className="text-2xl font-semibold">Page non trouvee</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          La page que vous cherchez n&apos;existe pas ou a ete deplacee.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Retour a l&apos;accueil
      </Link>
    </div>
  );
}
