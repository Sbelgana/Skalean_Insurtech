/**
 * PermissionsMatrix -- Sprint 7 Tache 2.3.2.
 *
 * Matrice exhaustive Role -> Permissions[] directes (sans heritage).
 *
 * Heritage resolu par HierarchyResolver (hierarchy-resolver.ts) :
 *   broker_admin -> broker_user -> broker_assistant
 *   garage_admin -> [garage_chef, garage_comptable, garage_commercial]
 *   garage_chef -> garage_technicien
 *
 * super_admin_platform : wildcard '*' = bypass total via RbacService.canAccess.
 * analyst_support : read-only universal subset.
 *
 * Reference source verite : RBAC_WILDCARD + Permission catalog Sprint 7 Tache 2.3.1.
 */

import { AuthRole } from '../types/auth-roles.js';
import { Permission, type PermissionValue } from './permissions.enum.js';
import { RBAC_WILDCARD } from './rbac-constants.js';

export type PermissionsMatrixEntry =
  | readonly PermissionValue[]
  | readonly [typeof RBAC_WILDCARD];

/**
 * Matrice principale : associe chaque role a ses permissions directes.
 * TypeScript force exhaustivite via Record<AuthRole, ...>.
 *
 * Validation boot-time (matrix-validator) verifie :
 *   - Permissions appartiennent au catalog Sprint 7 Tache 2.3.1
 *   - Wildcard '*' uniquement super_admin_platform
 *   - Permissions _own attribuees a roles compatibles
 *   - Aucune duplication intra-role
 */
export const PermissionsMatrix: Record<AuthRole, PermissionsMatrixEntry> = {
  // ===========================================================================
  // PLATFORM (Niveau 1)
  // ===========================================================================

  [AuthRole.SuperAdminPlatform]: [RBAC_WILDCARD] as const,

  /**
   * analyst_support : read-only universal cross-tenant.
   * Sprint 6 Tache 2.2.10 SuperAdminGuard enforce read-only HTTP method.
   */
  [AuthRole.AnalystSupport]: [
    Permission.ADMIN_TENANTS_LIST,
    Permission.ADMIN_USERS_LIST_ALL,
    Permission.ADMIN_AUDIT_READ,
    Permission.ADMIN_SYSTEM_HEALTH,
    Permission.ANALYTICS_DASHBOARDS_READ,
    Permission.ANALYTICS_REPORTS_EXPORT,
    Permission.CRM_CONTACTS_READ,
    Permission.CRM_DEALS_READ,
    Permission.CRM_COMPANIES_READ,
    Permission.COMPLIANCE_AUDIT_TRAIL_READ,
    Permission.COMPLIANCE_AML_ALERTS_REVIEW,
    Permission.INSURE_POLICIES_READ_ALL,
    Permission.PAY_TRANSACTIONS_READ,
    Permission.PAY_REFUNDS_READ,
    Permission.BOOKS_INVOICES_READ,
    Permission.BOOKS_JOURNALS_READ,
    Permission.REPAIR_SINISTRES_READ,
    Permission.REPAIR_DEVIS_READ,
    Permission.DOCS_DOCUMENTS_READ,
    Permission.DOCS_SIGNATURES_READ,
  ] as const,

  // ===========================================================================
  // TENANT BROKER (Niveau 2)
  // ===========================================================================

  /**
   * broker_admin : Admin cabinet courtier
   * CRUD complet CRM + Insure + Books + Tenant users
   * Herite (via HierarchyResolver) : broker_user + broker_assistant
   */
  [AuthRole.BrokerAdmin]: [
    // CRM CRUD complet
    Permission.CRM_CONTACTS_READ,
    Permission.CRM_CONTACTS_CREATE,
    Permission.CRM_CONTACTS_UPDATE,
    Permission.CRM_CONTACTS_DELETE,
    Permission.CRM_CONTACTS_EXPORT,
    Permission.CRM_COMPANIES_READ,
    Permission.CRM_COMPANIES_CREATE,
    Permission.CRM_COMPANIES_UPDATE,
    Permission.CRM_COMPANIES_DELETE,
    Permission.CRM_DEALS_READ,
    Permission.CRM_DEALS_CREATE,
    Permission.CRM_DEALS_UPDATE,
    Permission.CRM_DEALS_DELETE,
    Permission.CRM_PIPELINES_MANAGE,
    Permission.CRM_INTERACTIONS_CREATE,
    // Booking complet
    Permission.BOOKING_ROOMS_READ,
    Permission.BOOKING_ROOMS_MANAGE,
    Permission.BOOKING_APPOINTMENTS_READ,
    Permission.BOOKING_APPOINTMENTS_CREATE,
    Permission.BOOKING_APPOINTMENTS_UPDATE,
    Permission.BOOKING_APPOINTMENTS_DELETE,
    Permission.BOOKING_CALENDAR_SYNC,
    // Insure CRUD polices + quotes + commissions
    Permission.INSURE_POLICIES_READ_ALL,
    Permission.INSURE_POLICIES_CREATE,
    Permission.INSURE_POLICIES_UPDATE,
    Permission.INSURE_POLICIES_CANCEL,
    Permission.INSURE_POLICIES_RESILIATE,
    Permission.INSURE_AVENANTS_CREATE,
    Permission.INSURE_QUOTES_GENERATE,
    Permission.INSURE_QUOTES_READ,
    Permission.INSURE_COMMISSIONS_READ,
    // Books + Pay
    Permission.BOOKS_INVOICES_READ,
    Permission.BOOKS_INVOICES_CREATE,
    Permission.BOOKS_INVOICES_UPDATE,
    Permission.BOOKS_JOURNALS_READ,
    Permission.BOOKS_TAX_DECLARATIONS_CREATE,
    Permission.BOOKS_SAFTMA_EXPORT,
    Permission.PAY_TRANSACTIONS_READ,
    Permission.PAY_TRANSACTIONS_RECONCILE,
    Permission.PAY_REFUNDS_CREATE,
    Permission.PAY_REFUNDS_READ,
    // Tenant management
    Permission.TENANT_SETTINGS_READ,
    Permission.TENANT_SETTINGS_UPDATE,
    Permission.TENANT_USERS_INVITE,
    Permission.TENANT_BRANDING_UPDATE,
    Permission.TENANT_BILLING_READ,
    Permission.AUTH_USERS_CREATE,
    Permission.AUTH_USERS_READ,
    Permission.AUTH_USERS_UPDATE,
    Permission.AUTH_ROLES_ASSIGN,
    Permission.AUTH_ROLES_REVOKE,
    Permission.AUTH_SESSIONS_REVOKE_ALL,
    // Analytics
    Permission.ANALYTICS_DASHBOARDS_READ,
    Permission.ANALYTICS_REPORTS_EXPORT,
    // Comm
    Permission.COMM_MESSAGES_SEND,
    Permission.COMM_MESSAGES_READ,
    Permission.COMM_TEMPLATES_MANAGE,
    Permission.COMM_CONVERSATIONS_READ,
    // Docs + Signature
    Permission.DOCS_DOCUMENTS_READ,
    Permission.DOCS_DOCUMENTS_CREATE,
    Permission.DOCS_DOCUMENTS_UPDATE,
    Permission.DOCS_DOCUMENTS_DELETE,
    Permission.DOCS_SIGNATURES_READ,
    Permission.SIGNATURE_REQUESTS_CREATE,
    Permission.SIGNATURE_REQUESTS_READ,
    Permission.SIGNATURE_REQUESTS_CANCEL,
    Permission.SIGNATURE_CERTIFICATES_READ,
    // Cross-tenant (broker initie)
    Permission.CROSS_TENANT_BROKER_TO_GARAGE_ASSIGN,
    Permission.CROSS_TENANT_SHARE_STATUS_READ,
  ] as const,

  /**
   * broker_user : Courtier souscripteur
   * CRM read_own + quotes/polices creation
   * Herite (via HierarchyResolver) : broker_assistant
   */
  [AuthRole.BrokerUser]: [
    Permission.CRM_CONTACTS_READ_OWN,
    Permission.CRM_CONTACTS_CREATE,
    Permission.CRM_CONTACTS_UPDATE_OWN,
    Permission.CRM_DEALS_READ,
    Permission.CRM_DEALS_CREATE,
    Permission.CRM_DEALS_UPDATE,
    Permission.CRM_INTERACTIONS_CREATE,
    Permission.INSURE_QUOTES_GENERATE,
    Permission.INSURE_QUOTES_READ,
    Permission.INSURE_POLICIES_READ_OWN,
    Permission.INSURE_POLICIES_CREATE,
    Permission.PAY_TRANSACTIONS_READ_OWN,
    Permission.BOOKS_INVOICES_READ,
    Permission.DOCS_DOCUMENTS_READ_OWN,
    Permission.DOCS_DOCUMENTS_CREATE,
    Permission.ANALYTICS_DASHBOARDS_READ_OWN,
    Permission.COMM_MESSAGES_SEND,
    Permission.COMM_MESSAGES_READ_OWN,
    Permission.BOOKING_APPOINTMENTS_READ_OWN,
    Permission.BOOKING_APPOINTMENTS_CREATE,
    Permission.BOOKING_APPOINTMENTS_UPDATE,
    Permission.AUTH_SESSIONS_READ_OWN,
    Permission.AUTH_SESSIONS_REVOKE_OWN,
    Permission.AUTH_MFA_MANAGE,
  ] as const,

  /**
   * broker_assistant : Assistant administratif cabinet
   * Read + creation contacts, booking, comm
   */
  [AuthRole.BrokerAssistant]: [
    Permission.CRM_CONTACTS_READ_OWN,
    Permission.CRM_CONTACTS_CREATE,
    Permission.INSURE_QUOTES_GENERATE,
    Permission.BOOKING_APPOINTMENTS_CREATE,
    Permission.BOOKING_APPOINTMENTS_READ_OWN,
    Permission.COMM_MESSAGES_SEND,
    Permission.COMM_MESSAGES_READ_OWN,
    Permission.DOCS_DOCUMENTS_READ_OWN,
    Permission.DOCS_DOCUMENTS_CREATE,
    Permission.AUTH_SESSIONS_READ_OWN,
    Permission.AUTH_SESSIONS_REVOKE_OWN,
    Permission.AUTH_MFA_MANAGE,
  ] as const,

  // ===========================================================================
  // TENANT GARAGE (Niveau 2)
  // ===========================================================================

  /**
   * garage_admin : Admin garage
   * CRUD complet Repair + Stock + HR + Books + Pay
   * Herite (via HierarchyResolver) : [garage_chef, garage_comptable, garage_commercial]
   */
  [AuthRole.GarageAdmin]: [
    // CRM clients garage
    Permission.CRM_CONTACTS_READ,
    Permission.CRM_CONTACTS_CREATE,
    Permission.CRM_CONTACTS_UPDATE,
    Permission.CRM_CONTACTS_DELETE,
    Permission.CRM_COMPANIES_READ,
    Permission.CRM_COMPANIES_CREATE,
    Permission.CRM_COMPANIES_UPDATE,
    Permission.CRM_INTERACTIONS_CREATE,
    // Repair complet
    Permission.REPAIR_SINISTRES_READ,
    Permission.REPAIR_SINISTRES_CREATE,
    Permission.REPAIR_SINISTRES_ASSIGN,
    Permission.REPAIR_SINISTRES_CLOSE,
    Permission.REPAIR_DEVIS_READ,
    Permission.REPAIR_DEVIS_CREATE,
    Permission.REPAIR_DEVIS_APPROVE,
    Permission.REPAIR_REPARATIONS_START,
    Permission.REPAIR_REPARATIONS_COMPLETE,
    Permission.REPAIR_DIAGNOSTICS_CREATE,
    Permission.REPAIR_DIAGNOSTICS_UPDATE,
    Permission.REPAIR_PHOTOS_UPLOAD,
    Permission.REPAIR_WARRANTIES_READ,
    // Stock complet
    Permission.STOCK_ITEMS_READ,
    Permission.STOCK_ITEMS_MANAGE,
    Permission.STOCK_ITEMS_USE,
    Permission.STOCK_MOVEMENTS_READ,
    // HR complet
    Permission.HR_EMPLOYEES_READ,
    Permission.HR_EMPLOYEES_MANAGE,
    Permission.HR_CONTRACTS_MANAGE,
    Permission.HR_ASSIGNMENTS_CREATE,
    // Books + Pay
    Permission.BOOKS_INVOICES_READ,
    Permission.BOOKS_INVOICES_CREATE,
    Permission.BOOKS_INVOICES_UPDATE,
    Permission.BOOKS_ACCOUNTS_MANAGE,
    Permission.PAY_TRANSACTIONS_READ,
    Permission.PAY_REFUNDS_CREATE,
    // Tenant management
    Permission.TENANT_SETTINGS_READ,
    Permission.TENANT_SETTINGS_UPDATE,
    Permission.TENANT_USERS_INVITE,
    Permission.TENANT_BRANDING_UPDATE,
    Permission.TENANT_BILLING_READ,
    Permission.AUTH_USERS_CREATE,
    Permission.AUTH_USERS_READ,
    Permission.AUTH_USERS_UPDATE,
    Permission.AUTH_ROLES_ASSIGN,
    Permission.AUTH_ROLES_REVOKE,
    Permission.AUTH_SESSIONS_REVOKE_ALL,
    // Docs + Signature
    Permission.DOCS_DOCUMENTS_READ,
    Permission.DOCS_DOCUMENTS_CREATE,
    Permission.DOCS_DOCUMENTS_DELETE,
    Permission.SIGNATURE_REQUESTS_CREATE,
    Permission.SIGNATURE_REQUESTS_READ,
    // Comm
    Permission.COMM_MESSAGES_SEND,
    Permission.COMM_MESSAGES_READ,
    Permission.COMM_TEMPLATES_MANAGE,
    // Analytics
    Permission.ANALYTICS_DASHBOARDS_READ,
    Permission.ANALYTICS_REPORTS_EXPORT,
    // Cross-tenant
    Permission.CROSS_TENANT_DISPATCHED_RECEIVE,
    Permission.CROSS_TENANT_SHARE_STATUS_READ,
  ] as const,

  /**
   * garage_chef : Chef d'atelier
   * Sinistres assign+close, Devis approve, Diagnostics
   * Herite (via HierarchyResolver) : garage_technicien
   */
  [AuthRole.GarageChef]: [
    Permission.REPAIR_SINISTRES_READ,
    Permission.REPAIR_SINISTRES_ASSIGN,
    Permission.REPAIR_SINISTRES_CLOSE,
    Permission.REPAIR_DEVIS_READ,
    Permission.REPAIR_DEVIS_APPROVE,
    Permission.REPAIR_DIAGNOSTICS_CREATE,
    Permission.REPAIR_DIAGNOSTICS_UPDATE,
    Permission.REPAIR_REPARATIONS_START,
    Permission.REPAIR_REPARATIONS_COMPLETE,
    Permission.HR_ASSIGNMENTS_CREATE,
    Permission.STOCK_ITEMS_READ,
    Permission.STOCK_MOVEMENTS_READ,
    Permission.COMM_MESSAGES_SEND,
    Permission.DOCS_DOCUMENTS_READ,
    Permission.AUTH_SESSIONS_READ_OWN,
    Permission.AUTH_SESSIONS_REVOKE_OWN,
    Permission.AUTH_MFA_MANAGE,
  ] as const,

  /**
   * garage_technicien : Technicien atelier (PWA mobile)
   * Reparations execute uniquement sur sinistres ASSIGNES
   */
  [AuthRole.GarageTechnicien]: [
    Permission.REPAIR_SINISTRES_READ_ASSIGNED,
    Permission.REPAIR_REPARATIONS_START,
    Permission.REPAIR_REPARATIONS_COMPLETE,
    Permission.STOCK_ITEMS_USE,
    Permission.STOCK_ITEMS_READ,
    Permission.REPAIR_PHOTOS_UPLOAD,
    Permission.REPAIR_DIAGNOSTICS_CREATE,
    Permission.AUTH_SESSIONS_READ_OWN,
    Permission.AUTH_SESSIONS_REVOKE_OWN,
    Permission.AUTH_MFA_MANAGE,
  ] as const,

  /**
   * garage_comptable : Comptable garage
   */
  [AuthRole.GarageComptable]: [
    Permission.BOOKS_INVOICES_READ,
    Permission.BOOKS_INVOICES_CREATE,
    Permission.BOOKS_INVOICES_UPDATE,
    Permission.BOOKS_INVOICES_DELETE,
    Permission.BOOKS_JOURNALS_READ,
    Permission.BOOKS_ACCOUNTS_MANAGE,
    Permission.BOOKS_TAX_DECLARATIONS_CREATE,
    Permission.BOOKS_SAFTMA_EXPORT,
    Permission.PAY_TRANSACTIONS_READ,
    Permission.PAY_TRANSACTIONS_RECONCILE,
    Permission.PAY_REFUNDS_CREATE,
    Permission.PAY_REFUNDS_READ,
    Permission.COMPLIANCE_AML_ALERTS_REVIEW,
    Permission.AUTH_SESSIONS_READ_OWN,
    Permission.AUTH_SESSIONS_REVOKE_OWN,
    Permission.AUTH_MFA_MANAGE,
  ] as const,

  /**
   * garage_commercial : Commercial garage
   */
  [AuthRole.GarageCommercial]: [
    Permission.CRM_CONTACTS_READ,
    Permission.CRM_CONTACTS_CREATE,
    Permission.CRM_CONTACTS_UPDATE_OWN,
    Permission.CRM_INTERACTIONS_CREATE,
    Permission.REPAIR_DEVIS_READ,
    Permission.REPAIR_DEVIS_CREATE,
    Permission.COMM_MESSAGES_SEND,
    Permission.COMM_MESSAGES_READ,
    Permission.BOOKING_APPOINTMENTS_CREATE,
    Permission.BOOKING_APPOINTMENTS_READ_OWN,
    Permission.AUTH_SESSIONS_READ_OWN,
    Permission.AUTH_SESSIONS_REVOKE_OWN,
    Permission.AUTH_MFA_MANAGE,
  ] as const,

  // ===========================================================================
  // ASSURE L3 (Niveau 3)
  // ===========================================================================

  /**
   * assure : Client final
   * Read SES propres ressources via ABAC owner filter
   */
  [AuthRole.Assure]: [
    Permission.INSURE_POLICIES_READ_OWN,
    Permission.REPAIR_SINISTRES_READ_OWN,
    Permission.REPAIR_SINISTRES_CREATE_OWN,
    Permission.PAY_TRANSACTIONS_READ_OWN,
    Permission.DOCS_DOCUMENTS_READ_OWN,
    Permission.COMM_MESSAGES_READ_OWN,
    Permission.SKY_CONVERSATIONS_READ_OWN,
    Permission.AUTH_SESSIONS_READ_OWN,
    Permission.AUTH_SESSIONS_REVOKE_OWN,
    Permission.AUTH_MFA_MANAGE,
    Permission.BOOKING_APPOINTMENTS_READ_OWN,
    Permission.BOOKING_APPOINTMENTS_CREATE,
  ] as const,

  // ===========================================================================
  // PROSPECT (Public)
  // ===========================================================================

  /**
   * prospect : Public sans auth persistante
   * Routes /api/v1/public/* avec session Redis TTL 30min
   */
  [AuthRole.Prospect]: [
    Permission.PUBLIC_PRODUCTS_READ,
    Permission.PUBLIC_QUOTES_GENERATE,
    Permission.PUBLIC_KYC_SUBMIT,
    Permission.PUBLIC_PAYMENTS_PROCESS,
  ] as const,

  // ===========================================================================
  // v3.0 NEW ROLES (Sprint 7 reprise -- Tache 2.3.2, populated post-Sprint 7.5a)
  //
  // Permissions directes des 14 nouveaux roles v3.0 (decision-012/013/014).
  // L'heritage via RoleHierarchy DAG (Sprint 7.5a.2) ajoute automatiquement
  // les permissions des enfants. Exemple : carrier_admin herite des 5 enfants
  // (claims_manager + finance + compliance + expert_manager + partner_manager)
  // donc cette entree liste UNIQUEMENT les permissions admin direct.
  // ===========================================================================

  /**
   * garage_parts_manager : PartsHub (decision-014).
   * Sibling de garage_chef/comptable/commercial sous garage_admin.
   * Permissions : 7 perms du module parts + comm de base + auth sessions.
   */
  [AuthRole.GaragePartsManager]: [
    Permission.PARTS_SUPPLIERS_READ,
    Permission.PARTS_SUPPLIERS_ADD_FAVORITE,
    Permission.PARTS_ORDERS_CREATE,
    Permission.PARTS_ORDERS_READ,
    Permission.PARTS_ORDERS_CANCEL,
    Permission.PARTS_COMMISSION_VIEW,
    Permission.PARTS_INVOICES_READ,
    Permission.COMM_MESSAGES_SEND,
    Permission.COMM_MESSAGES_READ_OWN,
    Permission.AUTH_SESSIONS_READ_OWN,
    Permission.AUTH_SESSIONS_REVOKE_OWN,
    Permission.AUTH_MFA_MANAGE,
  ] as const,

  // -------------- CARRIER (decision-012) --------------

  /**
   * carrier_admin : Admin compagnie d'assurance, CRUD complet tenant carrier.
   * Herite (via HierarchyResolver) : claims_manager + finance + compliance +
   * expert_manager + partner_manager.
   * Direct : tenant management + auth users + analytics global.
   */
  [AuthRole.CarrierAdmin]: [
    Permission.CARRIER_DASHBOARD_READ,
    Permission.TENANT_SETTINGS_READ,
    Permission.TENANT_SETTINGS_UPDATE,
    Permission.TENANT_USERS_INVITE,
    Permission.TENANT_BRANDING_UPDATE,
    Permission.TENANT_BILLING_READ,
    Permission.AUTH_USERS_CREATE,
    Permission.AUTH_USERS_READ,
    Permission.AUTH_USERS_UPDATE,
    Permission.AUTH_ROLES_ASSIGN,
    Permission.AUTH_ROLES_REVOKE,
    Permission.AUTH_SESSIONS_REVOKE_ALL,
    Permission.ANALYTICS_DASHBOARDS_READ,
    Permission.ANALYTICS_REPORTS_EXPORT,
    Permission.COMM_MESSAGES_SEND,
    Permission.COMM_MESSAGES_READ,
    Permission.COMM_TEMPLATES_MANAGE,
    Permission.DOCS_DOCUMENTS_READ,
    Permission.DOCS_DOCUMENTS_CREATE,
  ] as const,

  /**
   * carrier_claims_manager : Responsable sinistres compagnie.
   * Designe experts, lit claims, approuve workflow (paiements deleges au finance).
   */
  [AuthRole.CarrierClaimsManager]: [
    Permission.CARRIER_DASHBOARD_READ,
    Permission.CARRIER_CLAIMS_READ,
    Permission.CARRIER_CLAIMS_READ_ALL,
    Permission.CARRIER_EXPERTS_DESIGNATE,
    Permission.CARRIER_EXPERTS_READ_POOL,
    Permission.INSURE_POLICIES_READ_ALL,
    Permission.COMM_MESSAGES_SEND,
    Permission.COMM_MESSAGES_READ,
    Permission.DOCS_DOCUMENTS_READ,
    Permission.AUTH_SESSIONS_READ_OWN,
    Permission.AUTH_SESSIONS_REVOKE_OWN,
    Permission.AUTH_MFA_MANAGE,
  ] as const,

  /**
   * carrier_finance : Finance compagnie, workflow approbation paiements 4 niveaux.
   */
  [AuthRole.CarrierFinance]: [
    Permission.CARRIER_DASHBOARD_READ,
    Permission.CARRIER_PAYMENT_APPROVE_L1,
    Permission.CARRIER_PAYMENT_APPROVE_L2,
    Permission.CARRIER_PAYMENT_APPROVE_L3,
    Permission.CARRIER_PAYMENT_APPROVE_L4,
    Permission.CARRIER_PAYMENT_REJECT,
    Permission.PAY_TRANSACTIONS_READ,
    Permission.PAY_REFUNDS_READ,
    Permission.BOOKS_INVOICES_READ,
    Permission.BOOKS_JOURNALS_READ,
    Permission.ANALYTICS_DASHBOARDS_READ,
    Permission.AUTH_SESSIONS_READ_OWN,
    Permission.AUTH_SESSIONS_REVOKE_OWN,
    Permission.AUTH_MFA_MANAGE,
  ] as const,

  /**
   * carrier_compliance : Reporting ACAPS + fraude + audit.
   */
  [AuthRole.CarrierCompliance]: [
    Permission.CARRIER_DASHBOARD_READ,
    Permission.CARRIER_COMPLIANCE_REPORTS_GENERATE,
    Permission.CARRIER_FRAUD_ALERTS_READ,
    Permission.COMPLIANCE_ACAPS_REPORTS_GENERATE,
    Permission.COMPLIANCE_AML_ALERTS_REVIEW,
    Permission.COMPLIANCE_AUDIT_TRAIL_READ,
    Permission.ANALYTICS_DASHBOARDS_READ,
    Permission.ANALYTICS_REPORTS_EXPORT,
    Permission.AUTH_SESSIONS_READ_OWN,
    Permission.AUTH_SESSIONS_REVOKE_OWN,
    Permission.AUTH_MFA_MANAGE,
  ] as const,

  /**
   * carrier_expert_manager : Gestion du pool experts (designation + evaluation).
   */
  [AuthRole.CarrierExpertManager]: [
    Permission.CARRIER_DASHBOARD_READ,
    Permission.CARRIER_EXPERTS_DESIGNATE,
    Permission.CARRIER_EXPERTS_READ_POOL,
    Permission.CARRIER_EXPERTS_EVALUATE,
    Permission.ANALYTICS_DASHBOARDS_READ,
    Permission.COMM_MESSAGES_SEND,
    Permission.AUTH_SESSIONS_READ_OWN,
    Permission.AUTH_SESSIONS_REVOKE_OWN,
    Permission.AUTH_MFA_MANAGE,
  ] as const,

  /**
   * carrier_partner_manager : Gestion partenaires courtiers + garages.
   */
  [AuthRole.CarrierPartnerManager]: [
    Permission.CARRIER_DASHBOARD_READ,
    Permission.CARRIER_PARTNERS_READ_STATS,
    Permission.CARRIER_BROKERS_MANAGE,
    Permission.ANALYTICS_DASHBOARDS_READ,
    Permission.COMM_MESSAGES_SEND,
    Permission.AUTH_SESSIONS_READ_OWN,
    Permission.AUTH_SESSIONS_REVOKE_OWN,
    Permission.AUTH_MFA_MANAGE,
  ] as const,

  // -------------- EXPERT (decision-013) --------------

  /**
   * expert_independent : Expert automobile independant ACAPS-licensed.
   * Personne physique standalone. Permissions completes workflow expertise.
   */
  [AuthRole.ExpertIndependent]: [
    Permission.EXPERTISE_MISSIONS_READ,
    Permission.EXPERTISE_MISSIONS_ACCEPT,
    Permission.EXPERTISE_MISSIONS_REJECT,
    Permission.EXPERTISE_EXECUTE,
    Permission.EXPERTISE_VALIDATE_QUOTE,
    Permission.EXPERTISE_MODIFY_QUOTE,
    Permission.EXPERTISE_REJECT_QUOTE,
    Permission.EXPERTISE_REPORT_CREATE,
    Permission.EXPERTISE_REPORT_SIGN,
    Permission.EXPERTISE_HONORAIRES_INVOICE,
    Permission.DOCS_DOCUMENTS_READ,
    Permission.DOCS_DOCUMENTS_CREATE,
    Permission.SIGNATURE_REQUESTS_CREATE,
    Permission.SIGNATURE_CERTIFICATES_READ,
    Permission.COMM_MESSAGES_SEND,
    Permission.COMM_MESSAGES_READ,
    Permission.AUTH_SESSIONS_READ_OWN,
    Permission.AUTH_SESSIONS_REVOKE_OWN,
    Permission.AUTH_MFA_MANAGE,
  ] as const,

  /**
   * expert_firm_admin : Admin cabinet expertise multi-associes.
   * Herite (via HierarchyResolver) : expert_associate.
   * Direct : tenant management + auth users.
   */
  [AuthRole.ExpertFirmAdmin]: [
    Permission.EXPERTISE_HONORAIRES_INVOICE,
    Permission.TENANT_SETTINGS_READ,
    Permission.TENANT_SETTINGS_UPDATE,
    Permission.TENANT_USERS_INVITE,
    Permission.TENANT_BILLING_READ,
    Permission.AUTH_USERS_CREATE,
    Permission.AUTH_USERS_READ,
    Permission.AUTH_USERS_UPDATE,
    Permission.AUTH_ROLES_ASSIGN,
    Permission.AUTH_ROLES_REVOKE,
    Permission.AUTH_SESSIONS_REVOKE_ALL,
    Permission.ANALYTICS_DASHBOARDS_READ,
    Permission.BOOKS_INVOICES_READ,
    Permission.BOOKS_INVOICES_CREATE,
  ] as const,

  /**
   * expert_associate : Expert associe cabinet, execute missions.
   * Pas de gestion tenant/users (delegue firm_admin).
   */
  [AuthRole.ExpertAssociate]: [
    Permission.EXPERTISE_MISSIONS_READ,
    Permission.EXPERTISE_MISSIONS_ACCEPT,
    Permission.EXPERTISE_MISSIONS_REJECT,
    Permission.EXPERTISE_EXECUTE,
    Permission.EXPERTISE_VALIDATE_QUOTE,
    Permission.EXPERTISE_MODIFY_QUOTE,
    Permission.EXPERTISE_REJECT_QUOTE,
    Permission.EXPERTISE_REPORT_CREATE,
    Permission.EXPERTISE_REPORT_SIGN,
    Permission.DOCS_DOCUMENTS_READ,
    Permission.DOCS_DOCUMENTS_CREATE,
    Permission.SIGNATURE_REQUESTS_CREATE,
    Permission.COMM_MESSAGES_SEND,
    Permission.COMM_MESSAGES_READ_OWN,
    Permission.AUTH_SESSIONS_READ_OWN,
    Permission.AUTH_SESSIONS_REVOKE_OWN,
    Permission.AUTH_MFA_MANAGE,
  ] as const,

  /**
   * expert_carrier_internal : Expert salarie interne compagnie.
   * Pas d'invoice honoraires (salaire) + lecture insure policies (carrier scope).
   */
  [AuthRole.ExpertCarrierInternal]: [
    Permission.EXPERTISE_MISSIONS_READ,
    Permission.EXPERTISE_MISSIONS_ACCEPT,
    Permission.EXPERTISE_EXECUTE,
    Permission.EXPERTISE_VALIDATE_QUOTE,
    Permission.EXPERTISE_MODIFY_QUOTE,
    Permission.EXPERTISE_REJECT_QUOTE,
    Permission.EXPERTISE_REPORT_CREATE,
    Permission.EXPERTISE_REPORT_SIGN,
    Permission.INSURE_POLICIES_READ_ALL,
    Permission.DOCS_DOCUMENTS_READ,
    Permission.DOCS_DOCUMENTS_CREATE,
    Permission.COMM_MESSAGES_SEND,
    Permission.COMM_MESSAGES_READ,
    Permission.AUTH_SESSIONS_READ_OWN,
    Permission.AUTH_SESSIONS_REVOKE_OWN,
    Permission.AUTH_MFA_MANAGE,
  ] as const,

  // -------------- TOW (decision-012) --------------

  /**
   * tow_admin : Admin operateur de remorquage.
   * Herite (via HierarchyResolver) : tow_dispatcher (qui herite tow_driver).
   * Direct : tenant management + earnings global + drivers manage.
   */
  [AuthRole.TowAdmin]: [
    Permission.TOW_EARNINGS_READ,
    Permission.TOW_DRIVERS_MANAGE,
    Permission.TENANT_SETTINGS_READ,
    Permission.TENANT_SETTINGS_UPDATE,
    Permission.TENANT_USERS_INVITE,
    Permission.TENANT_BILLING_READ,
    Permission.AUTH_USERS_CREATE,
    Permission.AUTH_USERS_READ,
    Permission.AUTH_USERS_UPDATE,
    Permission.AUTH_ROLES_ASSIGN,
    Permission.AUTH_ROLES_REVOKE,
    Permission.AUTH_SESSIONS_REVOKE_ALL,
    Permission.ANALYTICS_DASHBOARDS_READ,
    Permission.ANALYTICS_REPORTS_EXPORT,
  ] as const,

  /**
   * tow_dispatcher : Assigne missions aux conducteurs.
   * Herite (via HierarchyResolver) : tow_driver.
   * Direct : missions read available + drivers visibility partielle.
   */
  [AuthRole.TowDispatcher]: [
    Permission.TOW_MISSIONS_READ_AVAILABLE,
    Permission.COMM_MESSAGES_SEND,
    Permission.COMM_MESSAGES_READ,
    Permission.DOCS_DOCUMENTS_READ,
    Permission.ANALYTICS_DASHBOARDS_READ_OWN,
  ] as const,

  /**
   * tow_driver : Conducteur, execute missions (PWA mobile).
   * Base : missions terrain + photos + availability.
   */
  [AuthRole.TowDriver]: [
    Permission.TOW_MISSIONS_READ_AVAILABLE,
    Permission.TOW_MISSIONS_ACCEPT,
    Permission.TOW_MISSIONS_REJECT,
    Permission.TOW_MISSIONS_COMPLETE,
    Permission.TOW_VEHICLE_PHOTOS_UPLOAD,
    Permission.TOW_AVAILABILITY_TOGGLE,
    Permission.TOW_EARNINGS_READ,
    Permission.COMM_MESSAGES_SEND,
    Permission.COMM_MESSAGES_READ_OWN,
    Permission.AUTH_SESSIONS_READ_OWN,
    Permission.AUTH_SESSIONS_REVOKE_OWN,
    Permission.AUTH_MFA_MANAGE,
  ] as const,
};

/** Type derive : nombre de roles dans la matrice. */
export type PermissionsMatrixKeys = keyof typeof PermissionsMatrix;

/** Liste figee des 26 roles dans la matrice (v3.0 Sprint 7.5a). */
export const ALL_ROLES_IN_MATRIX = Object.keys(PermissionsMatrix) as readonly AuthRole[];

/**
 * Retourne les permissions DIRECTES d'un role (sans heritage).
 * Pour permissions effectives, utiliser HierarchyResolver.getEffectivePermissions().
 */
export function getDirectPermissions(role: AuthRole): PermissionsMatrixEntry {
  return PermissionsMatrix[role];
}

/**
 * Test si un role a le wildcard '*'. Utilise par RbacService.canAccess pour bypass total.
 */
export function hasWildcardPermission(role: AuthRole): boolean {
  const entry = PermissionsMatrix[role];
  return entry.length === 1 && entry[0] === RBAC_WILDCARD;
}

/** Compte permissions directes pour stats/debug. */
export function countDirectPermissions(role: AuthRole): number {
  return PermissionsMatrix[role].length;
}
