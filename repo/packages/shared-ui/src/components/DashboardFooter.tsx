/**
 * DashboardFooter -- minimal copyright + build version footer.
 * Reference : task-1.4.14 Sprint 4 Phase 1
 */
export function DashboardFooter() {
  const year = new Date().getFullYear();
  const buildHash = process.env.NEXT_PUBLIC_BUILD_HASH ?? 'dev';

  return (
    <footer
      role="contentinfo"
      className="border-t px-4 py-3 text-xs text-muted-foreground flex items-center justify-between"
    >
      <span>(c) {year} Skalean Sofidemy InsurTech</span>
      <span className="font-mono">v{buildHash}</span>
    </footer>
  );
}
