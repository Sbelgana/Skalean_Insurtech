/**
 * Metadata 12 roles : descriptions FR/EN/AR, niveau, type.
 *
 * Sprint 7 / Tache 2.3.1.
 */

import { AuthRole } from '../types/auth-roles.js';

export type RoleLevel = 1 | 2 | 3 | 4 | 5;

export interface RoleMeta {
  readonly value: string;
  readonly descriptionFr: string;
  readonly descriptionEn: string;
  readonly descriptionAr: string;
  readonly level: RoleLevel;
  readonly tenantType: 'platform' | 'broker' | 'garage' | 'l3' | 'public';
  /** Estimation count permissions par defaut (pour dashboards admin). */
  readonly defaultPermissionsCount: number;
}

export const RoleMetadata: Record<string, RoleMeta> = {
  [AuthRole.SuperAdminPlatform]: {
    value: AuthRole.SuperAdminPlatform,
    descriptionFr: 'Admin plateforme Skalean (acces transverse tous tenants)',
    descriptionEn: 'Skalean platform admin (transverse access all tenants)',
    descriptionAr: 'مسؤول منصة سكالين (وصول عبر كل المستأجرين)',
    level: 1,
    tenantType: 'platform',
    defaultPermissionsCount: 999, // wildcard
  },
  [AuthRole.AnalystSupport]: {
    value: AuthRole.AnalystSupport,
    descriptionFr: 'Analyste support Skalean (read-only transverse)',
    descriptionEn: 'Skalean support analyst (transverse read-only)',
    descriptionAr: 'محلل دعم سكالين (قراءة فقط عبر المستأجرين)',
    level: 2,
    tenantType: 'platform',
    defaultPermissionsCount: 35,
  },
  [AuthRole.BrokerAdmin]: {
    value: AuthRole.BrokerAdmin,
    descriptionFr: 'Admin cabinet courtier (CRUD complet tenant broker)',
    descriptionEn: 'Broker office admin (full CRUD tenant broker)',
    descriptionAr: 'مسؤول مكتب الوسيط (CRUD كامل لمستأجر الوسيط)',
    level: 3,
    tenantType: 'broker',
    defaultPermissionsCount: 60,
  },
  [AuthRole.BrokerUser]: {
    value: AuthRole.BrokerUser,
    descriptionFr: 'Courtier souscripteur (acces polices/devis assignes)',
    descriptionEn: 'Subscribing broker (assigned policies/quotes access)',
    descriptionAr: 'وسيط مكتتب (وصول للوثائق المسندة)',
    level: 4,
    tenantType: 'broker',
    defaultPermissionsCount: 30,
  },
  [AuthRole.BrokerAssistant]: {
    value: AuthRole.BrokerAssistant,
    descriptionFr: 'Assistant administratif courtier',
    descriptionEn: 'Broker administrative assistant',
    descriptionAr: 'مساعد إداري للوسيط',
    level: 4,
    tenantType: 'broker',
    defaultPermissionsCount: 20,
  },
  [AuthRole.GarageAdmin]: {
    value: AuthRole.GarageAdmin,
    descriptionFr: 'Admin garage (CRUD complet tenant garage)',
    descriptionEn: 'Garage admin (full CRUD tenant garage)',
    descriptionAr: 'مسؤول المرآب (CRUD كامل لمستأجر المرآب)',
    level: 3,
    tenantType: 'garage',
    defaultPermissionsCount: 55,
  },
  [AuthRole.GarageChef]: {
    value: AuthRole.GarageChef,
    descriptionFr: 'Chef d atelier garage (assigne sinistres, approuve devis)',
    descriptionEn: 'Garage workshop manager (assigns sinistres, approves devis)',
    descriptionAr: 'مدير ورشة المرآب (تعيين المطالبات، الموافقة على العروض)',
    level: 4,
    tenantType: 'garage',
    defaultPermissionsCount: 35,
  },
  [AuthRole.GarageTechnicien]: {
    value: AuthRole.GarageTechnicien,
    descriptionFr: 'Technicien garage (execute reparations PWA mobile)',
    descriptionEn: 'Garage technician (PWA mobile repairs)',
    descriptionAr: 'فني المرآب (إصلاحات PWA المحمول)',
    level: 4,
    tenantType: 'garage',
    defaultPermissionsCount: 20,
  },
  [AuthRole.GarageComptable]: {
    value: AuthRole.GarageComptable,
    descriptionFr: 'Comptable garage (gere comptabilite + paiements)',
    descriptionEn: 'Garage accountant (manages books + payments)',
    descriptionAr: 'محاسب المرآب (يدير الكتب والمدفوعات)',
    level: 4,
    tenantType: 'garage',
    defaultPermissionsCount: 25,
  },
  [AuthRole.GarageCommercial]: {
    value: AuthRole.GarageCommercial,
    descriptionFr: 'Commercial garage (gere devis client)',
    descriptionEn: 'Garage commercial staff (manages client devis)',
    descriptionAr: 'تجاري المرآب (يدير عروض العملاء)',
    level: 4,
    tenantType: 'garage',
    defaultPermissionsCount: 20,
  },
  [AuthRole.Assure]: {
    value: AuthRole.Assure,
    descriptionFr: 'Assure final (acces ses polices/sinistres uniquement)',
    descriptionEn: 'End assured (access own polices/sinistres only)',
    descriptionAr: 'المؤمن النهائي (الوصول إلى الوثائق/المطالبات الخاصة فقط)',
    level: 5,
    tenantType: 'l3',
    defaultPermissionsCount: 15,
  },
  [AuthRole.Prospect]: {
    value: AuthRole.Prospect,
    descriptionFr: 'Prospect public non authentifie (catalogue + simulator)',
    descriptionEn: 'Public prospect not authenticated (catalog + simulator)',
    descriptionAr: 'احتمال عام غير مصادق (الكتالوج + المحاكي)',
    level: 5,
    tenantType: 'public',
    defaultPermissionsCount: 4,
  },
};

/** Liste roles ordonnes par level descendant (super admin top). */
export const ROLES_BY_LEVEL: readonly string[] = Object.freeze(
  Object.entries(RoleMetadata)
    .sort(([, a], [, b]) => a.level - b.level)
    .map(([role]) => role),
);
