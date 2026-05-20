/**
 * Bottom tab navigation items -- web-assure-mobile
 * Sprint 22 complétera la navigation assure mobile complète.
 * Reference : task-1.4.15 Sprint 4 Phase 1
 */
import type { TabItem } from '@insurtech/shared-ui';
import { Home, FileText, AlertTriangle, User } from 'lucide-react';

export const assureMobileTabs: TabItem[] = [
  { label: 'Accueil', href: '/', icon: Home },
  { label: 'Polices', href: '/polices', icon: FileText },
  { label: 'Sinistres', href: '/sinistres', icon: AlertTriangle },
  { label: 'Profil', href: '/profil', icon: User },
];
