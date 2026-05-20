'use client';

/**
 * Error boundary -- web-garage-mobile
 * Sprint 7 connectera Sentry pour le reporting d'erreurs.
 * Reference : task-1.4.15 Sprint 4 Phase 1
 */
import { useEffect } from 'react';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary] web-garage-mobile:', error);
    }
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex flex-col items-center gap-3">
        <span className="text-6xl font-extrabold text-destructive">500</span>
        <h1 className="text-2xl font-semibold">Une erreur est survenue</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {error.digest
            ? `Code erreur : ${error.digest}`
            : 'Veuillez reessayer ou contacter le support si le probleme persiste.'}
        </p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Reessayer
      </button>
    </div>
  );
}
