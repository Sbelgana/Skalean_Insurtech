/**
 * Sidebar navigation items -- web-broker
 * Sprint 17 complétera la navigation courtier complète.
 * Reference : task-1.4.15 Sprint 4 Phase 1
 */
import type { SidebarSection } from '@insurtech/shared-ui';
import {
  LayoutDashboard,
  FileText,
  AlertTriangle,
  Users,
  BarChart2,
  Settings,
} from 'lucide-react';

export const brokerSidebarItems: SidebarSection[] = [
  {
    title: 'Navigation',
    items: [
      { label: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Polices', href: '/polices', icon: FileText },
      { label: 'Sinistres', href: '/sinistres', icon: AlertTriangle },
      { label: 'Clients', href: '/clients', icon: Users },
    ],
  },
  {
    title: 'Gestion',
    items: [
      { label: 'Rapports', href: '/rapports', icon: BarChart2 },
      { label: 'Parametres', href: '/parametres', icon: Settings },
    ],
  },
];
