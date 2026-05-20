/**
 * Bottom tab navigation items -- web-garage-mobile
 * Sprint 21 complétera la navigation technicien mobile complète.
 * Reference : task-1.4.15 Sprint 4 Phase 1
 */
import type { TabItem } from '@insurtech/shared-ui';
import { Home, Wrench, QrCode, User } from 'lucide-react';

export const garageMobileTabs: TabItem[] = [
  { label: 'Accueil', href: '/', icon: Home },
  { label: 'Reparations', href: '/reparations', icon: Wrench },
  { label: 'Scanner', href: '/scanner', icon: QrCode },
  { label: 'Profil', href: '/profil', icon: User },
];
