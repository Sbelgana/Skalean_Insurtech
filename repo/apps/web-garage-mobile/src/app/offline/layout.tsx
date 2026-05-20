/**
 * Offline layout -- web-garage-mobile
 * Reference : task-1.4.3 Sprint 4 Phase 1
 *
 * Layout minimal pour la page offline (hors contexte [locale]).
 * Pas de next-intl ici : cette page est servie par le SW sans locale.
 */
export default function OfflineLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
