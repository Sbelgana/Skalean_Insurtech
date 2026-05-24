/**
 * Catalog ~130 permissions Assurflow v3.0 (Sprint 7.5a Foundation extension).
 *
 * Sprint 7 / Tache 2.3.1 : 90 perms v2.2.
 * Sprint 7.5a / Tache 7.5a.6 : +40 perms v3.0 (carrier 15 + expertise 10 + tow 8 + parts 7).
 *
 * Convention naming : {module}.{resource}.{action}
 *   module : 24 modules (auth, tenant, crm, booking, comm, docs, signature, pay,
 *            books, compliance, analytics, insure, repair, stock, hr, admin,
 *            cross_tenant, sky, mcp, public, carrier, expertise, tow, parts)
 *   resource : entite metier (contacts, polices, sinistres, ...)
 *   action : read, read_own, read_all, read_assigned, create, create_own, update,
 *            update_own, delete, assign, approve, reject, cancel, etc.
 *
 * Style : `export const Permission = {...} as const` (jamais enum, decision interne).
 * References : decision-012 + decision-013 + decision-014.
 */

export const Permission = {
  // === AUTH (10) -- Sprint 5 ===
  AUTH_USERS_CREATE: 'auth.users.create',
  AUTH_USERS_READ: 'auth.users.read',
  AUTH_USERS_UPDATE: 'auth.users.update',
  AUTH_USERS_DELETE: 'auth.users.delete',
  AUTH_ROLES_ASSIGN: 'auth.roles.assign',
  AUTH_ROLES_REVOKE: 'auth.roles.revoke',
  AUTH_SESSIONS_READ_OWN: 'auth.sessions.read_own',
  AUTH_SESSIONS_REVOKE_OWN: 'auth.sessions.revoke_own',
  AUTH_SESSIONS_REVOKE_ALL: 'auth.sessions.revoke_all',
  AUTH_MFA_MANAGE: 'auth.mfa.manage',

  // === TENANT (5) -- Sprint 6 ===
  TENANT_SETTINGS_READ: 'tenant.settings.read',
  TENANT_SETTINGS_UPDATE: 'tenant.settings.update',
  TENANT_USERS_INVITE: 'tenant.users.invite',
  TENANT_BRANDING_UPDATE: 'tenant.branding.update',
  TENANT_BILLING_READ: 'tenant.billing.read',

  // === CRM (21) -- Sprint 8 (8.4 added CLOSE + OVERRIDE_WORKFLOW ; 8.5 added INTERACTIONS_READ + SOFT_DELETE + RESTORE) ===
  CRM_CONTACTS_READ: 'crm.contacts.read',
  CRM_CONTACTS_READ_OWN: 'crm.contacts.read_own',
  CRM_CONTACTS_CREATE: 'crm.contacts.create',
  CRM_CONTACTS_UPDATE: 'crm.contacts.update',
  CRM_CONTACTS_UPDATE_OWN: 'crm.contacts.update_own',
  CRM_CONTACTS_DELETE: 'crm.contacts.delete',
  CRM_CONTACTS_EXPORT: 'crm.contacts.export',
  CRM_COMPANIES_READ: 'crm.companies.read',
  CRM_COMPANIES_CREATE: 'crm.companies.create',
  CRM_COMPANIES_UPDATE: 'crm.companies.update',
  CRM_COMPANIES_DELETE: 'crm.companies.delete',
  CRM_DEALS_READ: 'crm.deals.read',
  CRM_DEALS_CREATE: 'crm.deals.create',
  CRM_DEALS_UPDATE: 'crm.deals.update',
  CRM_DEALS_DELETE: 'crm.deals.delete',
  CRM_DEALS_CLOSE: 'crm.deals.close',
  CRM_DEALS_OVERRIDE_WORKFLOW: 'crm.deals.override_workflow',
  CRM_PIPELINES_MANAGE: 'crm.pipelines.manage',
  CRM_INTERACTIONS_CREATE: 'crm.interactions.create',
  CRM_INTERACTIONS_READ: 'crm.interactions.read',
  CRM_INTERACTIONS_SOFT_DELETE: 'crm.interactions.soft_delete',
  CRM_INTERACTIONS_RESTORE: 'crm.interactions.restore',

  // === BOOKING (7) -- Sprint 8 ===
  BOOKING_ROOMS_READ: 'booking.rooms.read',
  BOOKING_ROOMS_MANAGE: 'booking.rooms.manage',
  BOOKING_APPOINTMENTS_READ: 'booking.appointments.read',
  BOOKING_APPOINTMENTS_READ_OWN: 'booking.appointments.read_own',
  BOOKING_APPOINTMENTS_CREATE: 'booking.appointments.create',
  BOOKING_APPOINTMENTS_UPDATE: 'booking.appointments.update',
  BOOKING_APPOINTMENTS_DELETE: 'booking.appointments.delete',
  BOOKING_CALENDAR_SYNC: 'booking.calendar.sync',

  // === COMM (5) -- Sprint 9 ===
  COMM_MESSAGES_SEND: 'comm.messages.send',
  COMM_MESSAGES_READ: 'comm.messages.read',
  COMM_MESSAGES_READ_OWN: 'comm.messages.read_own',
  COMM_TEMPLATES_MANAGE: 'comm.templates.manage',
  COMM_CONVERSATIONS_READ: 'comm.conversations.read',

  // === DOCS (6) -- Sprint 10 ===
  DOCS_DOCUMENTS_READ: 'docs.documents.read',
  DOCS_DOCUMENTS_READ_OWN: 'docs.documents.read_own',
  DOCS_DOCUMENTS_CREATE: 'docs.documents.create',
  DOCS_DOCUMENTS_UPDATE: 'docs.documents.update',
  DOCS_DOCUMENTS_DELETE: 'docs.documents.delete',
  DOCS_SIGNATURES_READ: 'docs.signatures.read',

  // === SIGNATURE (4) -- Sprint 10 ===
  SIGNATURE_REQUESTS_CREATE: 'signature.requests.create',
  SIGNATURE_REQUESTS_READ: 'signature.requests.read',
  SIGNATURE_REQUESTS_CANCEL: 'signature.requests.cancel',
  SIGNATURE_CERTIFICATES_READ: 'signature.certificates.read',

  // === PAY (7) -- Sprint 11 ===
  PAY_TRANSACTIONS_READ: 'pay.transactions.read',
  PAY_TRANSACTIONS_READ_OWN: 'pay.transactions.read_own',
  PAY_TRANSACTIONS_CREATE: 'pay.transactions.create',
  PAY_TRANSACTIONS_RECONCILE: 'pay.transactions.reconcile',
  PAY_REFUNDS_CREATE: 'pay.refunds.create',
  PAY_REFUNDS_READ: 'pay.refunds.read',
  PAY_GATEWAYS_CONFIG: 'pay.gateways.config',

  // === BOOKS (8) -- Sprint 12 ===
  BOOKS_INVOICES_READ: 'books.invoices.read',
  BOOKS_INVOICES_CREATE: 'books.invoices.create',
  BOOKS_INVOICES_UPDATE: 'books.invoices.update',
  BOOKS_INVOICES_DELETE: 'books.invoices.delete',
  BOOKS_JOURNALS_READ: 'books.journals.read',
  BOOKS_ACCOUNTS_MANAGE: 'books.accounts.manage',
  BOOKS_TAX_DECLARATIONS_CREATE: 'books.tax_declarations.create',
  BOOKS_SAFTMA_EXPORT: 'books.saftma.export',

  // === COMPLIANCE (5) -- Sprint 12 ===
  COMPLIANCE_ACAPS_REPORTS_GENERATE: 'compliance.acaps_reports.generate',
  COMPLIANCE_DGI_EXPORT: 'compliance.dgi.export',
  COMPLIANCE_AML_ALERTS_REVIEW: 'compliance.aml_alerts.review',
  COMPLIANCE_CNDP_PURGE_EXECUTE: 'compliance.cndp_purge.execute',
  COMPLIANCE_AUDIT_TRAIL_READ: 'compliance.audit_trail.read',

  // === ANALYTICS (3) -- Sprint 13 ===
  ANALYTICS_DASHBOARDS_READ: 'analytics.dashboards.read',
  ANALYTICS_DASHBOARDS_READ_OWN: 'analytics.dashboards.read_own',
  ANALYTICS_REPORTS_EXPORT: 'analytics.reports.export',

  // === INSURE Vertical Broker (11) -- Sprint 14-15 ===
  INSURE_POLICIES_READ_ALL: 'insure.policies.read_all',
  INSURE_POLICIES_READ_OWN: 'insure.policies.read_own',
  INSURE_POLICIES_CREATE: 'insure.policies.create',
  INSURE_POLICIES_UPDATE: 'insure.policies.update',
  INSURE_POLICIES_CANCEL: 'insure.policies.cancel',
  INSURE_POLICIES_RESILIATE: 'insure.policies.resiliate',
  INSURE_AVENANTS_CREATE: 'insure.avenants.create',
  INSURE_QUOTES_GENERATE: 'insure.quotes.generate',
  INSURE_QUOTES_READ: 'insure.quotes.read',
  INSURE_COMMISSIONS_READ: 'insure.commissions.read',
  INSURE_CONNECTORS_CONFIG: 'insure.connectors.config',

  // === REPAIR Vertical Garage (14) -- Sprint 19-21 ===
  REPAIR_SINISTRES_READ: 'repair.sinistres.read',
  REPAIR_SINISTRES_READ_OWN: 'repair.sinistres.read_own',
  REPAIR_SINISTRES_READ_ASSIGNED: 'repair.sinistres.read_assigned',
  REPAIR_SINISTRES_CREATE: 'repair.sinistres.create',
  REPAIR_SINISTRES_CREATE_OWN: 'repair.sinistres.create_own',
  REPAIR_SINISTRES_ASSIGN: 'repair.sinistres.assign',
  REPAIR_SINISTRES_CLOSE: 'repair.sinistres.close',
  REPAIR_DIAGNOSTICS_CREATE: 'repair.diagnostics.create',
  REPAIR_DIAGNOSTICS_UPDATE: 'repair.diagnostics.update',
  REPAIR_DEVIS_READ: 'repair.devis.read',
  REPAIR_DEVIS_CREATE: 'repair.devis.create',
  REPAIR_DEVIS_APPROVE: 'repair.devis.approve',
  REPAIR_REPARATIONS_START: 'repair.reparations.start',
  REPAIR_REPARATIONS_COMPLETE: 'repair.reparations.complete',
  REPAIR_PHOTOS_UPLOAD: 'repair.photos.upload',
  REPAIR_WARRANTIES_READ: 'repair.warranties.read',

  // === STOCK (4) -- Sprint 13 ===
  STOCK_ITEMS_READ: 'stock.items.read',
  STOCK_ITEMS_MANAGE: 'stock.items.manage',
  STOCK_ITEMS_USE: 'stock.items.use',
  STOCK_MOVEMENTS_READ: 'stock.movements.read',

  // === HR (5) -- Sprint 13 ===
  HR_EMPLOYEES_READ: 'hr.employees.read',
  HR_EMPLOYEES_MANAGE: 'hr.employees.manage',
  HR_CONTRACTS_MANAGE: 'hr.contracts.manage',
  HR_PAYSLIPS_READ_OWN: 'hr.payslips.read_own',
  HR_ASSIGNMENTS_CREATE: 'hr.assignments.create',

  // === ADMIN Super Admin Skalean (9) -- Sprint 26 ===
  ADMIN_TENANTS_LIST: 'admin.tenants.list',
  ADMIN_TENANTS_CREATE: 'admin.tenants.create',
  ADMIN_TENANTS_SUSPEND: 'admin.tenants.suspend',
  ADMIN_TENANTS_PURGE: 'admin.tenants.purge',
  ADMIN_USERS_LIST_ALL: 'admin.users.list_all',
  ADMIN_REPORTS_ACAPS_GENERATE: 'admin.reports.acaps_generate',
  ADMIN_IMPERSONATE_USER: 'admin.impersonate.user',
  ADMIN_AUDIT_READ: 'admin.audit.read',
  ADMIN_SYSTEM_HEALTH: 'admin.system.health',

  // === CROSS_TENANT (5) -- Sprint 25-26 ===
  CROSS_TENANT_SHARE_STATUS_READ: 'cross_tenant.share_status.read',
  CROSS_TENANT_API_AUTHENTICATE: 'cross_tenant.api.authenticate',
  CROSS_TENANT_DISPATCHED_RECEIVE: 'cross_tenant.dispatched.receive',
  CROSS_TENANT_BROKER_TO_GARAGE_ASSIGN: 'cross_tenant.broker_to_garage.assign',
  CROSS_TENANT_ASSURE_TO_GARAGE_VISIT: 'cross_tenant.assure_to_garage.visit',

  // === SKY Skalean AI (3) -- Sprint 31 ===
  SKY_CONVERSATIONS_READ_OWN: 'sky.conversations.read_own',
  SKY_TOOLS_INVOKE: 'sky.tools.invoke',
  SKY_ANALYTICS_READ: 'sky.analytics.read',

  // === MCP Server (2) -- Sprint 30 ===
  MCP_TOOLS_DISCOVER: 'mcp.tools.discover',
  MCP_TOOLS_INVOKE: 'mcp.tools.invoke',

  // === PUBLIC Prospect (4) ===
  PUBLIC_PRODUCTS_READ: 'public.products.read',
  PUBLIC_QUOTES_GENERATE: 'public.quotes.generate',
  PUBLIC_KYC_SUBMIT: 'public.kyc.submit',
  PUBLIC_PAYMENTS_PROCESS: 'public.payments.process',

  // ==========================================================================
  // v3.0 NEW MODULES (Sprint 7.5a Foundation Migration, decision-012/013/014)
  // ==========================================================================

  // === CARRIER (15) -- Sprint 7.5a, decision-012 carrier roles ===
  CARRIER_DASHBOARD_READ: 'carrier.dashboard.read',
  CARRIER_CLAIMS_READ: 'carrier.claims.read',
  CARRIER_CLAIMS_READ_ALL: 'carrier.claims.read_all',
  CARRIER_PAYMENT_APPROVE_L1: 'carrier.payment.approve_level1',
  CARRIER_PAYMENT_APPROVE_L2: 'carrier.payment.approve_level2',
  CARRIER_PAYMENT_APPROVE_L3: 'carrier.payment.approve_level3',
  CARRIER_PAYMENT_APPROVE_L4: 'carrier.payment.approve_level4',
  CARRIER_PAYMENT_REJECT: 'carrier.payment.reject',
  CARRIER_EXPERTS_DESIGNATE: 'carrier.experts.designate',
  CARRIER_EXPERTS_READ_POOL: 'carrier.experts.read_pool',
  CARRIER_EXPERTS_EVALUATE: 'carrier.experts.evaluate',
  CARRIER_PARTNERS_READ_STATS: 'carrier.partners.read_stats',
  CARRIER_COMPLIANCE_REPORTS_GENERATE: 'carrier.compliance_reports.generate',
  CARRIER_FRAUD_ALERTS_READ: 'carrier.fraud_alerts.read',
  CARRIER_BROKERS_MANAGE: 'carrier.brokers.manage',

  // === EXPERTISE (10) -- Sprint 7.5a, decision-013 expert workflow ===
  EXPERTISE_MISSIONS_READ: 'expertise.missions.read',
  EXPERTISE_MISSIONS_ACCEPT: 'expertise.missions.accept',
  EXPERTISE_MISSIONS_REJECT: 'expertise.missions.reject',
  EXPERTISE_EXECUTE: 'expertise.work.execute',
  EXPERTISE_VALIDATE_QUOTE: 'expertise.quote.validate',
  EXPERTISE_MODIFY_QUOTE: 'expertise.quote.modify',
  EXPERTISE_REJECT_QUOTE: 'expertise.quote.reject',
  EXPERTISE_REPORT_CREATE: 'expertise.report.create',
  EXPERTISE_REPORT_SIGN: 'expertise.report.sign',
  EXPERTISE_HONORAIRES_INVOICE: 'expertise.honoraires.invoice',

  // === TOW (8) -- Sprint 7.5a, decision-012 tow tenant roles ===
  TOW_MISSIONS_READ_AVAILABLE: 'tow.missions.read_available',
  TOW_MISSIONS_ACCEPT: 'tow.missions.accept',
  TOW_MISSIONS_REJECT: 'tow.missions.reject',
  TOW_MISSIONS_COMPLETE: 'tow.missions.complete',
  TOW_VEHICLE_PHOTOS_UPLOAD: 'tow.vehicle_photos.upload',
  TOW_AVAILABILITY_TOGGLE: 'tow.availability.toggle',
  TOW_EARNINGS_READ: 'tow.earnings.read',
  TOW_DRIVERS_MANAGE: 'tow.drivers.manage',

  // === PARTS HUB (7) -- Sprint 7.5a, decision-014 garage_parts_manager ===
  PARTS_SUPPLIERS_READ: 'parts.suppliers.read',
  PARTS_SUPPLIERS_ADD_FAVORITE: 'parts.suppliers.add_to_favorites',
  PARTS_ORDERS_CREATE: 'parts.orders.create',
  PARTS_ORDERS_READ: 'parts.orders.read',
  PARTS_ORDERS_CANCEL: 'parts.orders.cancel_within_window',
  PARTS_COMMISSION_VIEW: 'parts.commission.view_dashboard',
  PARTS_INVOICES_READ: 'parts.invoices.read',
} as const;

/** Union litterale ~130 valeurs permissions Assurflow v3.0. */
export type PermissionValue = (typeof Permission)[keyof typeof Permission];

/** Liste runtime de toutes les valeurs permissions. */
export const ALL_PERMISSIONS: readonly PermissionValue[] = Object.freeze(
  Object.values(Permission),
);

/** Compte runtime des permissions (utilise par tests et dashboards). */
export const PERMISSIONS_COUNT = Object.keys(Permission).length;

/** Map inverse cle UPPER_SNAKE -> valeur lower.dot. Utile debug. */
export const PermissionKeys = Object.freeze(
  Object.keys(Permission) as Array<keyof typeof Permission>,
);
