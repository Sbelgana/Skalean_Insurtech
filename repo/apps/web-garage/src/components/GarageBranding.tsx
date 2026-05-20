'use client';

/**
 * GarageBranding component -- web-garage
 * Reference : task-1.4.1 Sprint 4 Phase 1
 *
 * Affiche le logo garage avec icone Wrench (lucide-react) et wordmark Skalean Garage.
 * Aucune emoji (decision-006).
 */
import { Wrench } from 'lucide-react';

export function GarageBranding() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#2D5773]">
        <Wrench className="h-5 w-5 text-white" aria-label="cle a molette" />
      </div>
      <span className="font-semibold text-foreground">Skalean Garage</span>
    </div>
  );
}
