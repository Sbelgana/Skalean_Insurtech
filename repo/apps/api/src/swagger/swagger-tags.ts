/**
 * Catalog Swagger tags par module (21 tags : 20 metier + Public).
 *
 * Reference : decision-006.
 * Tache : 1.3.9 (Sprint 3 / Phase 1).
 */

export interface SwaggerTag {
  name: string;
  description: string;
  externalDocs?: { description: string; url: string };
}

export const SWAGGER_TAGS: readonly SwaggerTag[] = [
  // Transverses
  {
    name: 'Health',
    description: 'Liveness/readiness probes Kubernetes (Tache 1.3.10).',
  },
  {
    name: 'Auth',
    description: 'Authentication Argon2id + JWT + MFA + WebAuthn. Sprint 5.',
  },
  {
    name: 'Tenant',
    description: 'Multi-tenant 3 niveaux + RLS Postgres. Sprint 6.',
  },
  {
    name: 'RBAC',
    description: '12 roles + RolesGuard + permissions. Sprint 7.',
  },

  // Metier core
  {
    name: 'CRM',
    description: 'Contacts, companies, deals, activities. Sprint 8.',
  },
  {
    name: 'Booking',
    description: 'Appointments, calendar, rooms. Sprint 8.',
  },
  {
    name: 'Comm',
    description: 'WhatsApp Cloud API + AWS SES + Twilio SMS + 4 locales. Sprint 9.',
  },
  {
    name: 'Docs',
    description: 'S3 upload/download + PDF generation + access logs. Sprint 10.',
  },
  {
    name: 'Signature',
    description: 'Barid eSign + ANRT TSA (loi 43-20). Sprint 10.',
  },
  {
    name: 'Pay',
    description: '6 passerelles MA (CMI, MTC, HPS, Naps, etc.). Sprint 11.',
  },
  {
    name: 'Books',
    description: 'CGNC compliance + factures DGI. Sprint 12.',
  },
  {
    name: 'Compliance',
    description: 'ACAPS + AMC + CNDP audit logs. Sprint 12.',
  },
  {
    name: 'Analytics',
    description: 'ClickHouse dashboards + aggregations. Sprint 13.',
  },

  // Verticales
  {
    name: 'Insure',
    description: 'Vertical Broker : products, quotes, policies. Sprint 14.',
  },
  {
    name: 'Repair',
    description: 'Vertical Garage : claims, estimations, repairs. Sprint 19.',
  },

  // Frontends
  {
    name: 'Assure',
    description: 'Backend pour assure-portal + assure-mobile (PWA). Sprint 19.',
  },
  {
    name: 'Prospect',
    description: 'Backend customer-portal (SEO, signup). Sprint 18.',
  },
  {
    name: 'Admin',
    description: 'Backend admin Skalean (super_admin_platform). Sprint 27.',
  },

  // AI
  {
    name: 'SkaleanAI',
    description: 'REST client vers Skalean AI service (decision-005 frontier). Sprint 30.',
  },
  {
    name: 'MCP',
    description: 'MCP tools metier expose au chatbot Sky. Sprint 31.',
  },

  // Public
  {
    name: 'Public',
    description: 'Endpoints publics sans auth (catalogue produits, signup). /api/v1/public/*.',
  },
] satisfies SwaggerTag[];

/**
 * Retourne un tag par son nom.
 */
export function getTagByName(name: string): SwaggerTag | undefined {
  return SWAGGER_TAGS.find((t) => t.name === name);
}

/**
 * Retourne la liste des noms de tags.
 */
export function getTagNames(): string[] {
  return SWAGGER_TAGS.map((t) => t.name);
}
