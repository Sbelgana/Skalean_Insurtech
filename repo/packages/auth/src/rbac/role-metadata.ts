/**
 * Metadata 26 roles (v3.0) : descriptions FR/EN/AR, niveau, type.
 *
 * Sprint 7 / Tache 2.3.1 (12 roles v2.2) -- etendu Sprint 7.5a (14 roles v3.0).
 */

import { AuthRole } from '../types/auth-roles.js';

export type RoleLevel = 1 | 2 | 3 | 4 | 5;

export interface RoleMeta {
  readonly value: string;
  readonly descriptionFr: string;
  readonly descriptionEn: string;
  readonly descriptionAr: string;
  readonly level: RoleLevel;
  readonly tenantType: 'platform' | 'broker' | 'garage' | 'carrier' | 'expert' | 'tow' | 'l3' | 'public';
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
  [AuthRole.GaragePartsManager]: {
    value: AuthRole.GaragePartsManager,
    descriptionFr: 'Responsable pieces garage (PartsHub : fournisseurs, commandes, commissions)',
    descriptionEn: 'Garage parts manager (PartsHub : suppliers, orders, commissions)',
    descriptionAr: 'مسؤول قطع الغيار (PartsHub : الموردون، الطلبات، العمولات)',
    level: 4,
    tenantType: 'garage',
    defaultPermissionsCount: 15,
  },
  [AuthRole.CarrierAdmin]: {
    value: AuthRole.CarrierAdmin,
    descriptionFr: 'Admin compagnie assurance (CRUD complet tenant carrier)',
    descriptionEn: 'Insurance carrier admin (full CRUD tenant carrier)',
    descriptionAr: 'مسؤول شركة التأمين (CRUD كامل لمستأجر شركة التأمين)',
    level: 3,
    tenantType: 'carrier',
    defaultPermissionsCount: 50,
  },
  [AuthRole.CarrierClaimsManager]: {
    value: AuthRole.CarrierClaimsManager,
    descriptionFr: 'Responsable sinistres compagnie (designe experts, approuve indemnisations)',
    descriptionEn: 'Carrier claims manager (designates experts, approves payouts)',
    descriptionAr: 'مدير المطالبات بشركة التأمين (تعيين الخبراء، اعتماد التعويضات)',
    level: 4,
    tenantType: 'carrier',
    defaultPermissionsCount: 25,
  },
  [AuthRole.CarrierFinance]: {
    value: AuthRole.CarrierFinance,
    descriptionFr: 'Finance compagnie (workflow approbation paiements multi-niveaux)',
    descriptionEn: 'Carrier finance (multi-level payment approval workflow)',
    descriptionAr: 'مالية شركة التأمين (سير عمل اعتماد المدفوعات متعدد المستويات)',
    level: 4,
    tenantType: 'carrier',
    defaultPermissionsCount: 15,
  },
  [AuthRole.CarrierCompliance]: {
    value: AuthRole.CarrierCompliance,
    descriptionFr: 'Compliance compagnie (reporting ACAPS, fraude, audit)',
    descriptionEn: 'Carrier compliance (ACAPS reporting, fraud, audit)',
    descriptionAr: 'الامتثال بشركة التأمين (تقارير ACAPS، الاحتيال، التدقيق)',
    level: 4,
    tenantType: 'carrier',
    defaultPermissionsCount: 12,
  },
  [AuthRole.CarrierExpertManager]: {
    value: AuthRole.CarrierExpertManager,
    descriptionFr: 'Gestion pool experts compagnie (designation, evaluation)',
    descriptionEn: 'Carrier expert pool manager (designation, evaluation)',
    descriptionAr: 'مدير مجموعة الخبراء بشركة التأمين (التعيين، التقييم)',
    level: 4,
    tenantType: 'carrier',
    defaultPermissionsCount: 10,
  },
  [AuthRole.CarrierPartnerManager]: {
    value: AuthRole.CarrierPartnerManager,
    descriptionFr: 'Gestion partenaires courtiers/garages compagnie',
    descriptionEn: 'Carrier broker/garage partner manager',
    descriptionAr: 'مدير الشركاء (الوسطاء والمرآب) بشركة التأمين',
    level: 4,
    tenantType: 'carrier',
    defaultPermissionsCount: 10,
  },
  [AuthRole.ExpertIndependent]: {
    value: AuthRole.ExpertIndependent,
    descriptionFr: 'Expert automobile independant agree ACAPS (personne physique)',
    descriptionEn: 'Independent automobile expert ACAPS-licensed (individual)',
    descriptionAr: 'خبير سيارات مستقل معتمد من ACAPS (فرد)',
    level: 3,
    tenantType: 'expert',
    defaultPermissionsCount: 25,
  },
  [AuthRole.ExpertFirmAdmin]: {
    value: AuthRole.ExpertFirmAdmin,
    descriptionFr: 'Admin cabinet expertise multi-associes',
    descriptionEn: 'Multi-associate expert firm admin',
    descriptionAr: 'مسؤول مكتب الخبرة متعدد الشركاء',
    level: 3,
    tenantType: 'expert',
    defaultPermissionsCount: 30,
  },
  [AuthRole.ExpertAssociate]: {
    value: AuthRole.ExpertAssociate,
    descriptionFr: 'Expert associe cabinet expertise',
    descriptionEn: 'Expert firm associate',
    descriptionAr: 'خبير شريك بمكتب الخبرة',
    level: 4,
    tenantType: 'expert',
    defaultPermissionsCount: 20,
  },
  [AuthRole.ExpertCarrierInternal]: {
    value: AuthRole.ExpertCarrierInternal,
    descriptionFr: 'Expert salarie interne compagnie assurance',
    descriptionEn: 'Carrier internal salaried expert',
    descriptionAr: 'خبير داخلي موظف بشركة التأمين',
    level: 4,
    tenantType: 'expert',
    defaultPermissionsCount: 20,
  },
  [AuthRole.TowAdmin]: {
    value: AuthRole.TowAdmin,
    descriptionFr: 'Admin operateur de remorquage',
    descriptionEn: 'Tow operator admin',
    descriptionAr: 'مسؤول مشغل القطر',
    level: 3,
    tenantType: 'tow',
    defaultPermissionsCount: 30,
  },
  [AuthRole.TowDispatcher]: {
    value: AuthRole.TowDispatcher,
    descriptionFr: 'Dispatcher remorquage (assigne missions aux conducteurs)',
    descriptionEn: 'Tow dispatcher (assigns missions to drivers)',
    descriptionAr: 'موزع القطر (يوزع المهام على السائقين)',
    level: 4,
    tenantType: 'tow',
    defaultPermissionsCount: 15,
  },
  [AuthRole.TowDriver]: {
    value: AuthRole.TowDriver,
    descriptionFr: 'Conducteur remorquage (PWA mobile, execute missions)',
    descriptionEn: 'Tow driver (PWA mobile, executes missions)',
    descriptionAr: 'سائق القطر (PWA المحمول، ينفذ المهام)',
    level: 4,
    tenantType: 'tow',
    defaultPermissionsCount: 10,
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
