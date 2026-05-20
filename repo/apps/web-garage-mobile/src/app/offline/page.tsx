/**
 * Offline fallback page -- web-garage-mobile
 * Reference : task-1.4.3 Sprint 4 Phase 1
 *
 * Page affichee par le service worker quand une navigation echoue hors ligne.
 * Pas de prefix locale : accessible directement a /offline par next-pwa fallbacks.config.
 * Layout minimal inline car hors contexte next-intl.
 */
export const metadata = {
  title: 'Hors ligne -- Skalean Garage Mobile',
  robots: { index: false },
};

export default function OfflinePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1A2730',
        color: '#ffffff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '1.5rem',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 12,
          backgroundColor: '#2D5773',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: 28,
          marginBottom: '1.5rem',
        }}
      >
        M
      </div>
      <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>
        Mode hors ligne
      </h1>
      <p
        style={{
          marginTop: '0.75rem',
          fontSize: '0.9rem',
          color: '#B0CEE2',
          maxWidth: 320,
        }}
      >
        Vous etes actuellement hors ligne. Les modifications seront synchronisees lors du retour de la connexion.
      </p>
    </main>
  );
}
