# Modules Metier Skalean InsurTech v2.2

Ce dossier contient les 19 modules metier de l'API. Au Sprint 3 Tache 1.3.2,
chaque module est un stub `@Module({})` vide. Les sprints suivants enrichissent
chaque module avec controllers, services, repositories, guards, etc.

## Liste des 19 modules

| Module          | Sprint   | Description                                              |
|-----------------|----------|----------------------------------------------------------|
| auth            | 5        | Argon2id + JWT jose + MFA TOTP + WebAuthn + sessions     |
| tenant          | 6        | Multi-tenant 3 niveaux + RLS Postgres subscribers        |
| rbac            | 7        | 12 roles + RolesGuard + decorator @Roles()               |
| crm             | 8        | Contacts + companies + deals + activities                |
| booking         | 8        | Appointments + calendar + rooms                          |
| comm            | 9        | WhatsApp Cloud API + Email SES + SMS Twilio + 4 locales  |
| docs            | 10       | S3 + PDF generation + access logs                        |
| signature       | 10       | Barid eSign + ANRT TSA (loi 43-20)                       |
| pay             | 11       | 6 passerelles MA (CMI, MTC, HPS, Naps, etc.)             |
| books           | 12       | CGNC compliance + factures DGI                           |
| compliance      | 12       | ACAPS + AMC + CNDP                                       |
| analytics       | 13       | ClickHouse + dashboards                                  |
| insure          | 14       | Vertical Insure (products, quotes, policies)             |
| repair          | 19       | Vertical Repair (claims, estimations, repairs)           |
| assure          | 19       | Backend assure-portal + assure-mobile                    |
| prospect        | 18       | Backend customer-portal (SEO, signup)                    |
| admin           | 27       | Backend admin Skalean (super_admin_platform)             |
| skalean-ai      | 30       | REST client vers Skalean AI service (decision-005)       |
| mcp             | 31       | Routes proxy vers apps/mcp-server                        |

Total : 19 modules.

## Convention

- Chaque module est dans son propre dossier `apps/api/src/modules/{nom}/`.
- Le fichier principal est `{nom}.module.ts`.
- Les controllers, services, sub-modules sont ajoutes par sprint correspondant.
- Aucun module metier n'est `@Global()`. Seuls les transverses (Config, Database,
  Redis, Kafka, Logger) sont globaux.
- Les modules metier ne se referencent pas directement entre eux : communication
  via Kafka events (Sprint 2 Tache 1.2.10).

## Reference

- Meta-prompt B-03 Sprint 3 : `00-pilotage/meta-prompts/B-03-sprint-03-api-bootstrap.md`.
- decision-002 multi-tenant : `00-pilotage/decisions/002-multi-tenant-3-niveaux.md`.
- decision-003 NestJS : `00-pilotage/decisions/003-framework-backend-nestjs.md`.
