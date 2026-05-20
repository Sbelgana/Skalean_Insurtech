/**
 * Sidebar navigation items -- web-insurtech-admin
 * Sprint 8 complétera la navigation admin complète avec RBAC.
 * Reference : task-1.4.15 Sprint 4 Phase 1
 */
import type { SidebarSection } from '@insurtech/shared-ui';
import {
  LayoutDashboard,
  Building,
  Users,
  Package,
  Activity,
  FileText,
  Shield,
  Settings,
} from 'lucide-react';

export const adminSidebarItems: SidebarSection[] = [
  {
    title: 'Administration',
    items: [
      { label: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard },
      {
        label: 'Tenants',
        href: '/tenants',
        icon: Building,
        requiredRoles: ['admin', 'super-admin'],
      },
      {
        label: 'Utilisateurs',
        href: '/utilisateurs',
        icon: Users,
        requiredRoles: ['admin', 'super-admin'],
      },
      { label: 'Produits', href: '/produits', icon: Package },
    ],
  },
  {
    title: 'Systeme',
    items: [
      { label: 'Monitoring', href: '/monitoring', icon: Activity },
      { label: 'Rapports', href: '/rapports', icon: FileText },
      { label: 'Conformite', href: '/conformite', icon: Shield },
      {
        label: 'Parametres',
        href: '/parametres',
        icon: Settings,
        requiredRoles: ['admin', 'super-admin'],
      },
    ],
  },
];
