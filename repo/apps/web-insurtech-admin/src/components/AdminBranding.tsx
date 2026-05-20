'use client';
/**
 * AdminBranding -- web-insurtech-admin
 * Reference : task-1.4.4 Sprint 4 Phase 1
 *
 * Logo + wordmark de la plateforme SuperAdmin.
 * decision-006 : aucune emoji.
 */
import { Shield } from 'lucide-react';

export function AdminBranding() {
  return (
    <div className="flex items-center gap-2" aria-label="Skalean Admin">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-md"
        style={{ backgroundColor: '#1A2730' }}
        aria-hidden="true"
      >
        <Shield className="h-5 w-5 text-white" strokeWidth={2} />
      </div>
      <span
        className="text-base font-extrabold tracking-tight"
        style={{ color: '#1A2730' }}
      >
        Skalean Admin
      </span>
    </div>
  );
}
