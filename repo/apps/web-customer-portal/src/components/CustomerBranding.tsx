'use client';
/**
 * CustomerBranding -- web-customer-portal
 * Reference : task-1.4.5 Sprint 4 Phase 1
 *
 * Logo + wordmark du portail public.
 * decision-006 : aucune emoji.
 */
import { Shield } from 'lucide-react';

export function CustomerBranding() {
  return (
    <div className="flex items-center gap-2" aria-label="Skalean Assurance">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-md"
        style={{ backgroundColor: '#E95D2C' }}
        aria-hidden="true"
      >
        <Shield className="h-5 w-5 text-white" strokeWidth={2} />
      </div>
      <span
        className="text-base font-extrabold tracking-tight"
        style={{ color: '#1A2730' }}
      >
        Skalean Assurance
      </span>
    </div>
  );
}
