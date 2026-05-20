/**
 * Sidebar navigation items -- web-garage
 * Sprint 21 complétera la navigation garage complète.
 * Reference : task-1.4.15 Sprint 4 Phase 1
 */
import type { SidebarSection } from '@insurtech/shared-ui';
import {
  LayoutDashboard,
  Wrench,
  Car,
  Users,
  ClipboardList,
  Settings,
} from 'lucide-react';

export const garageSidebarItems: SidebarSection[] = [
  {
    title: 'Navigation',
    items: [
      { label: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Ordres de reparation', href: '/reparations', icon: Wrench },
      { label: 'Vehicules', href: '/vehicules', icon: Car },
      { label: 'Clients', href: '/clients', icon: Users },
      { label: 'Devis', href: '/devis', icon: ClipboardList },
    ],
  },
  {
    title: 'Gestion',
    items: [
      { label: 'Parametres', href: '/parametres', icon: Settings },
    ],
  },
];
