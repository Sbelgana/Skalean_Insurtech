'use client';
/**
 * AssureBranding -- web-assure-portal
 * Reference : task-1.4.6 Sprint 4 Phase 1
 *
 * Logo + wordmark du portail self-service assure.
 * decision-006 : aucune emoji.
 */
import { FileText } from 'lucide-react';

export function AssureBranding() {
  return (
    <div className="flex items-center gap-2" aria-label="Mon Espace Skalean">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-md"
        style={{ backgroundColor: '#B0CEE2' }}
        aria-hidden="true"
      >
        <FileText className="h-5 w-5" style={{ color: '#1A2730' }} strokeWidth={2} />
      </div>
      <span
        className="text-base font-extrabold tracking-tight"
        style={{ color: '#1A2730' }}
      >
        Mon Espace Skalean
      </span>
    </div>
  );
}
