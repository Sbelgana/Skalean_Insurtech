/**
 * AssureBranding -- web-assure-mobile
 * Reference : task-1.4.7 Sprint 4 Phase 1
 *
 * Composant de marque assure mobile.
 * Icone FileText + libelle "Skalean Assure".
 * decision-006 : aucune emoji.
 */
import { FileText } from 'lucide-react';

interface AssureBrandingProps {
  className?: string;
}

export function AssureBranding({ className }: AssureBrandingProps) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <div
        className="flex h-8 w-8 items-center justify-center rounded-md"
        style={{ backgroundColor: '#2D5773' }}
        aria-hidden="true"
      >
        <FileText className="h-4 w-4 text-white" strokeWidth={2} />
      </div>
      <span className="text-base font-extrabold tracking-tight" style={{ color: '#1A2730' }}>
        Skalean Assure
      </span>
    </div>
  );
}
