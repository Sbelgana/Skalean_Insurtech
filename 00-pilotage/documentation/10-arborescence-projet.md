# Arborescence Projet Skalean_Insurtech

**Version** : v2.2
**Date** : Mai 2026
**Statut** : VALIDE -- 35 sprints meta-prompts livres

**Changelog v2.2** :
- Restructuration 7 phases (vs 10 v2.0)
- Cascade renumerotation B-15 -> B-32 (decision-010 Insure Connecteurs defere)
- Ajout 9eme app : `mcp-server` (port 4001)
- Mise a jour meta-prompts list complete v2.2
- Etat actuel : 35/35 sprints livres en Option B

---

## Vue d'Ensemble

Le dossier racine `Skalean_Insurtech/` contient deux sous-dossiers strictement separes :

```
Skalean_Insurtech/
├── 00-pilotage/        # Gestion programme : meta-prompts, plans, audits, decisions
└── repo/               # Code source produit : ce que Claude Cowork construit
```

Principe : 00-pilotage non versionne Git, repo versionne Git. Cowork modifie uniquement repo/.

---

## 1. Meta-prompts B-XX v2.2 (35 sprints)

```
00-pilotage/meta-prompts/
│
│  Phase 1 -- Bootstrap Infrastructure (4 sprints)
├── B-01-sprint-01-bootstrap.md
├── B-02-sprint-02-database-kafka.md
├── B-03-sprint-03-api-bootstrap.md
├── B-04-sprint-04-frontend-bootstrap.md
│
│  Phase 2 -- Securite (3 sprints)
├── B-05-sprint-05-auth-foundations.md
├── B-06-sprint-06-multi-tenant.md
├── B-07-sprint-07-rbac.md
│
│  Phase 3 -- Modules Horizontaux (6 sprints)
├── B-08-sprint-08-crm-booking.md
├── B-09-sprint-09-comm-wa-email.md
├── B-10-sprint-10-docs-signature.md
├── B-11-sprint-11-pay-ma-multi.md
├── B-12-sprint-12-books-compliance.md
├── B-13-sprint-13-analytics-stock-hr.md
│
│  Phase 4 -- Vertical Insure (5 sprints)
├── B-14-sprint-14-insure-foundation.md
├── B-15-sprint-15-insure-lifecycle-police.md      # ex-Connecteurs, devenu Lifecycle Avance
├── B-16-sprint-16-web-broker-app.md
├── B-17-sprint-17-web-customer-portal.md
├── B-18-sprint-18-web-assure-portal-mobile.md
│
│  Phase 5 -- Vertical Repair (7 sprints)
├── B-19-sprint-19-vertical-repair-foundation.md
├── B-20-sprint-20-ia-estimation-photos.md          # Mock pendant dev (decision-007)
├── B-21-sprint-21-sinistre-workflow.md
├── B-22-sprint-22-web-garage-app.md
├── B-23-sprint-23-web-garage-mobile.md
├── B-24-sprint-24-flux-sinistre-client.md          # Flux M8 end-to-end
├── B-25-sprint-25-cross-tenant-framework.md         # 3 types tenants Repair
│
│  Phase 6 -- Admin Platform (3 sprints)
├── B-26-sprint-26-admin-foundation.md
├── B-27-sprint-27-tenants-management.md
├── B-28-sprint-28-admin-reports-compliance.md
│
│  Phase 7 -- Hardening + Integrations + Pilote (7 sprints)
├── B-29-sprint-29-skalean-ai-rest.md               # AI swap Mock -> Real (decision-007)
├── B-30-sprint-30-skalean-ai-mcp.md                # MCP server port 4001
├── B-31-sprint-31-agent-sky.md                     # Sky multilingue 4 langues
├── B-32-sprint-32-insure-connecteurs.md            # NOUVEAU position (decision-010)
├── B-33-sprint-33-pentest-securite.md
├── B-34-sprint-34-performance-scaling.md
└── B-35-sprint-35-pilote-marrakech-go-live.md      # SPRINT FINAL
```

Total : 35 fichiers Option B v2.2 (1355 ko / 461 taches detaillees).

---

## 2. Arborescence repo/ (Code Produit)

```
repo/
│
├── apps/                                                # 9 apps deployables v2.2
│   ├── api/                                             # NestJS backend, port 4000
│   ├── web-insurtech-admin/                             # port 3000 -- Admin Skalean
│   ├── web-broker/                                      # port 3001 -- Courtiers
│   ├── web-garage/                                      # port 3002 -- Chefs garages
│   ├── web-garage-mobile/                               # port 3003 -- Techniciens PWA + WebAuthn
│   ├── web-customer-portal/                             # port 3004 -- Prospects SEO + ISR
│   ├── web-assure-portal/                               # port 3005 -- Assures desktop
│   ├── web-assure-mobile/                               # port 3006 -- Assures PWA mobile
│   └── mcp-server/                                      # port 4001 -- NOUVEAU v2.2 (MCP tools)
│
├── packages/                                            # ~21 packages partages v2.2
│   │  Modules metier
│   ├── auth/                                            # Argon2id + JWT + MFA + RBAC + WebAuthn
│   ├── database/                                        # TypeORM 0.3 + entities + migrations + RLS
│   ├── crm/                                             # Contacts + companies + deals + pipelines
│   ├── booking/                                         # Rooms + appointments + calendar sync
│   ├── comm/                                            # WhatsApp + Email + templates 4 locales
│   ├── docs/                                            # S3 + PDF + access logs
│   ├── signature/                                       # Barid eSign + ANRT TSA RFC 3161
│   ├── pay/                                             # 6 passerelles MA
│   ├── books/                                           # CGNC + factures DGI + SAFT-MA
│   ├── compliance/                                      # ACAPS + AMC + CNDP
│   ├── analytics/                                       # ClickHouse + dashboards
│   ├── insure/                                          # Vertical Broker
│   ├── repair/                                          # Vertical Garage
│   ├── stock/                                           # Stock pieces + FIFO
│   ├── hr/                                              # Employees + paie CNSS/AMO/IR
│   │  AI integration v2.2
│   ├── sky/                                             # Agent Sky orchestrator (Sprint 31)
│   ├── sky-ui/                                          # Chat widget shared 3 apps (Sprint 31)
│   │  Shared
│   ├── assure-shared/                                   # Components shared (Sprint 18)
│   ├── shared-types/
│   ├── shared-config/
│   ├── shared-utils/
│   ├── shared-ui/                                       # shadcn/ui + theme Sofidemy
│   ├── shared-pwa/                                      # Service worker + offline
│   └── shared-maps/                                     # Mapbox GL JS wrapper
│
├── infrastructure/
│   ├── docker/
│   ├── scripts/
│   ├── observability/                                   # Sprint 34
│   ├── cloudflare/                                      # Sprint 34
│   ├── aws/                                             # Sprint 34
│   └── terraform/                                       # Sprint 35
│
├── docs/
│   ├── architecture/                                    # ADR-001 a ADR-010
│   ├── api/                                             # Swagger generated
│   ├── runbooks/                                        # Sprint 33+
│   ├── security/                                        # Sprint 33
│   └── pilote/                                          # Sprint 35
│
├── load-tests/                                          # Sprint 34 (K6 + chaos)
├── .github/workflows/                                   # CI/CD + security + load tests
├── .husky/                                              # Git hooks
├── .vscode/
└── package.json + pnpm-workspace.yaml + turbo.json + ...
```

---

## 3. Conventions Naming

### Meta-prompts sprint
```
B-XX-sprint-XX-{kebab-case-titre}.md
```

### Orchestrateurs (a generer post Phase A)
```
C-XX-sprint-XX-orchestration.md
```

### Verifications (a generer post Phase A)
```
V-XX-sprint-XX-verification.md
```

### Prompts de tache (generes par Cowork)
```
task-X.Y.Z-{kebab-case-titre}.md
```
- X = Phase (1-7)
- Y = Sprint dans la phase (1-N)
- Z = Tache dans le sprint (1-N)

### Mapping numerotation v2.2 (Sprint cumul -> task X.Y.Z)

| Sprint cumul | task prefix | Phase | Sprint dans phase |
|---|---|---|---|
| 1 (Bootstrap) | task-1.1.X | 1 | 1 |
| 2 (DB+Kafka) | task-1.2.X | 1 | 2 |
| 3 (API NestJS) | task-1.3.X | 1 | 3 |
| 4 (Frontend) | task-1.4.X | 1 | 4 |
| 5 (Auth) | task-2.1.X | 2 | 1 |
| 6 (Multi-tenant) | task-2.2.X | 2 | 2 |
| 7 (RBAC) | task-2.3.X | 2 | 3 |
| 8 (CRM+Booking) | task-3.1.X | 3 | 1 |
| 9 (Comm) | task-3.2.X | 3 | 2 |
| 10 (Docs+Signature) | task-3.3.X | 3 | 3 |
| 11 (Pay) | task-3.4.X | 3 | 4 |
| 12 (Books+Compliance) | task-3.5.X | 3 | 5 |
| 13 (Analytics+Stock+HR) | task-3.6.X | 3 | 6 |
| 14 (Insure Foundation) | task-4.1.X | 4 | 1 |
| 15 (Insure Lifecycle) | task-4.2.X | 4 | 2 |
| 16 (Web Broker) | task-4.3.X | 4 | 3 |
| 17 (Web Customer) | task-4.4.X | 4 | 4 |
| 18 (Web Assure) | task-4.5.X | 4 | 5 |
| 19 (Repair Foundation) | task-5.1.X | 5 | 1 |
| 20 (IA Estimation) | task-5.2.X | 5 | 2 |
| 21 (Sinistre Workflow) | task-5.3.X | 5 | 3 |
| 22 (Web Garage) | task-5.4.X | 5 | 4 |
| 23 (Web Garage Mobile) | task-5.5.X | 5 | 5 |
| 24 (Flux M8) | task-5.6.X | 5 | 6 |
| 25 (Cross-Tenant) | task-5.7.X | 5 | 7 |
| 26 (Admin Foundation) | task-6.1.X | 6 | 1 |
| 27 (Tenants Mgmt) | task-6.2.X | 6 | 2 |
| 28 (Admin Reports) | task-6.3.X | 6 | 3 |
| 29 (Skalean AI REST) | task-7.1.X | 7 | 1 |
| 30 (Skalean AI MCP) | task-7.2.X | 7 | 2 |
| 31 (Agent Sky) | task-7.3.X | 7 | 3 |
| 32 (Insure Connecteurs) | task-7.4.X | 7 | 4 |
| 33 (Pentest) | task-7.5.X | 7 | 5 |
| 34 (Performance) | task-7.6.X | 7 | 6 |
| 35 (Pilote) | task-7.7.X | 7 | 7 |

### Decisions
```
NNN-{kebab-case-titre}.md
```
3 chiffres (001 a 010).

### ADR (dans repo/docs/architecture/)
```
ADR-NNN-{kebab-case-titre}.md
```
Synchroniser 10 ADR avec 10 decisions strategiques.

---

## 4. Workflow Cowork

1. Lecture meta-prompt B-XX
2. Generation prompts taches X.Y.Z (par Cowork)
3. Execution taches modifiant repo/
4. Verification V-XX
5. Orchestration finale C-XX

Regle d'or : Cowork ne modifie JAMAIS 00-pilotage/. Il LIT les meta-prompts et ECRIT dans repo/.

---

## 5. Etat Actuel (Mai 2026)

| Element | Statut |
|---------|--------|
| INDEX.md | OK v2.2 FINAL detaillee |
| README.md | OK v2.2 FINAL detaillee |
| HANDOFF-EQUIPE.md | OK NOUVEAU v2.2 |
| AUDIT-V2.2-COHERENCE-REPORT.md | OK produit |
| AUDIT-TRIADE-BCV-REPORT.md | **OK 98.0% GO** |
| plan-realisation/ (3 PARTIES) | OK plans v2.0 archives |
| meta-prompts/ (35 sprints B-XX) | **OK 35/35 Option B v2.2 detailled** |
| orchestrateurs/ (35 sprints C-XX) | **OK 35/35 detailled** |
| verifications/ (35 sprints V-XX) | **OK 35/35 detailled** |
| documentation/ (13 fichiers) | OK v2.2 |
| templates/ (4 templates) | OK |
| audits/ (3 audits) | OK |
| decisions/ (10 decisions + INDEX) | OK 10/10 |
| _archive-v2.0/ | OK (3 plans v2.0 deprecies) |
| prompts-taches/ | VIDE -- generes par Cowork au demarrage chaque sprint |
| repo/ | VIDE -- a construire Sprint 1 par Cowork |

---

Fin du document arborescence projet v2.2.
