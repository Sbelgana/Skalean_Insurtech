# SKALEAN-INSURTECH PROMPT MASTER -- DOCUMENT MAITRE v2.2

**Version** : 2.2.0
**Date** : Mai 2026
**Statut** : ALIGNE v2.2 -- 35 sprints / 7 phases / 9 apps
**AUCUNE EMOJI AUTORISEE**

**Changelog v2.2** :
- Restructuration 7 phases (vs 10 v2.0)
- Ajout 9eme app : mcp-server (port 4001 -- expose tools metier a Skalean AI)
- Decision-007 AI-defere : Skalean AI client (REST + MCP + Sky agent) Phase 7 Sprint 29-31
- Decision-010 cascade : Insure Connecteurs deplace B-15 -> B-32 (Phase 7 Sprint 4)
- Sprint count : 32 -> 35 (3 apps clientes + Cross-Tenant Framework + Skalean AI defere)
- 461 taches detaillees Option B (vs ~470 v2.0 estimees)

---

## 1. INTRODUCTION ET VISION

### 1.1 Objectif principal

Ce document maitre coordonne la generation coherente des prompts du projet skalean-insurtech, plateforme InsurTech composee de :
- **2 SaaS metiers B2B** : Skalean Broker (vente assurance) + Skalean Garage (gestion sinistres)
- **1 application admin** : Skalean InsurTech Admin
- **3 applications clientes** : web-customer-portal (prospects) + web-assure-portal (desktop) + web-assure-mobile (PWA)
- **1 API NestJS** : backend unifiant tout (port 4000)
- **1 MCP server** : expose tools metier a Skalean AI agents (port 4001 -- NOUVEAU v2.2)

Le projet est entierement autonome (depot Git separe, monorepo, DB, auth multi-tenant 3 niveaux). Skalean AI est consomme exclusivement comme service externe via REST + MCP (Model Context Protocol).

Chaque tache est concue pour etre executee en une session Claude Code autonome. Le programme totalise **461 taches reparties en 35 sprints organises en 7 phases sur 12 mois calendrier**.

### 1.2 Differentiation marche MA

Skalean InsurTech est **premiere plateforme InsurTech complete au Maroc** avec :
- **Workflow M8** (Sprint 24) : declaration sinistre -> dispatch garage -> reparation **sans courtier actif** dans la chaine
- **Multi-tenant strict 3 niveaux** : Platform / Customer Tenant / Assure L3
- **3 types tenants Repair** (Sprint 25) : Atlas (Skalean) + managed_partner + api_partner
- **Compliance native** : 4 regulators MA (ACAPS / DGI / AMC / CNDP)
- **Conformite legale** : 9+ lois MA respectees (43-20 / 09-08 / 17-99 / 9-88 / 43-05 / etc.)
- **AI integration** : Skalean AI REST + MCP server + Agent Sky multilingue 4 langues
- **Pattern AI-defere** : Mock realistic Sprint 20 -> Real Sprint 29 swap one-line config

---

## 2. LES 9 APPLICATIONS v2.2

| App | Port | Domaine | Audience | Auth |
|-----|------|---------|----------|------|
| api | 4000 | api.skalean-insurtech.ma | Backend toutes apps | varies |
| web-insurtech-admin | 3000 | admin.skalean-insurtech.ma | SuperAdminPlatform, AnalystSupport | obligatoire + MFA |
| web-broker | 3001 | broker.skalean-insurtech.ma | Courtiers, Souscripteurs, Comptables | obligatoire |
| web-garage | 3002 | garage.skalean-insurtech.ma | ChefAtelier, Receptionniste, Comptable | obligatoire |
| web-garage-mobile | 3003 | garage-app.skalean-insurtech.ma | Technicien (PWA + WebAuthn) | obligatoire |
| web-customer-portal | 3004 | assurance.skalean-insurtech.ma | Prospects publics | facultative |
| web-assure-portal | 3005 | mon-espace.skalean-insurtech.ma | Assures connectes desktop | obligatoire (OTP) |
| web-assure-mobile | 3006 | mon-espace.skalean-insurtech.ma | Assures mobile (PWA) | obligatoire (OTP) |
| **mcp-server** | **4001** | **mcp.skalean-insurtech.ma** | **Skalean AI agents (Sky)** | **MCP tokens** |

---

## 3. LES 12 ROLES UTILISATEURS

| Role | Type | Niveau acces |
|------|------|--------------|
| super_admin_platform | Skalean staff | Bypass RLS + admin/* (MFA + impersonation Sprint 26) |
| analyst_support | Skalean staff | admin/* read-only |
| broker_admin | Tenant cabinet | Tenant CRUD complete |
| broker_user | Tenant cabinet | Polices CRUD limit |
| broker_assistant | Tenant cabinet | Read + create limited |
| garage_admin | Tenant garage | Garage CRUD complete |
| garage_chef | Tenant garage | Sinistres assign + close |
| garage_technicien | Tenant garage | Reparations execute (PWA mobile) |
| garage_comptable | Tenant garage | Books + Pay |
| garage_commercial | Tenant garage | Devis + clients |
| assure | L3 user | Read own polices/sinistres |
| prospect | Public | Browse public products + simulator |

Voir `5-roles-permissions.md` pour matrice 12 roles x 85+ permissions.

---

## 4. LES 3 TYPES TENANTS REPAIR (Sprint 25)

| Type | Nom | Description |
|------|-----|-------------|
| Type 1 Atlas | Skalean Atlas | Garage interne Skalean (premier seed Sprint 19) -- full ERP + management |
| Type 2 Managed Partner | Garages partenaires geres | Utilisent Skalean Garage ERP avec data isolation stricte |
| Type 3 API Partner | Garages externes | Passerelle API integration leur ERP existant (limited capabilities) |

CapabilitiesMatrix granular per type. CrossTenantSharingService pour read-only views shared.

---

## 5. LES 3 FLUX UTILISATEUR PRINCIPAUX

### 5.1 Flux 1 -- Vente en ligne (web-customer-portal)

Prospect public -> simulator tarification instantane -> comparateur 3-5 options -> souscription wizard 4 etapes (data + KYC + paiement + signature) -> document provisoire 7 jours TTL -> validation broker (file SLA 24h) -> police definitive.

**Conversion cible** : 15%+ prospect -> assure.

### 5.2 Flux 2 -- Vente en agence (web-broker)

Courtier saisit devis -> cotation lookup Sprint 14 (real-time API Sprint 32) -> devis PDF email client -> souscription -> Barid eSign + paiement comptoir -> creation compte client -> police signed PDF, **tout < 30 minutes**.

### 5.3 Flux 3 -- Sinistre client M8 (web-assure-mobile)

Assure declare sur PWA mobile -> photos + geolocation + voix darija transcrite -> routage direct garage choisi (Atlas + partenaires Sprint 25) -> garage prend en charge A->Z -> courtier voit lecture seule sans intervention.

**Premier flux marche MA sans courtier actif dans la chaine de traitement**.
**Cible** : sinistre traite end-to-end < 24h (vs 5 jours initial marche).

---

## 6. ARCHITECTURE TECHNIQUE

### 6.1 Stack principale

- **Monorepo** : pnpm 9.15 + Turborepo 2.4
- **Runtime** : Node.js 22.20 LTS, TypeScript 5.7 strict
- **Backend** : NestJS 10.4 + Fastify
- **Frontend** : Next.js 15 + React 19 + Tailwind 4 + shadcn/ui
- **DB** : PostgreSQL 16 + TypeORM 0.3 + PgBouncer + RLS multi-tenant 3 niveaux
- **Cache** : Redis 7.4 (cluster prod)
- **Events** : Apache Kafka 3.7 KRaft
- **PWA** : Serwist (modern Workbox alternative pour Next.js 15)
- **Maps** : Mapbox GL JS 3.x
- **AI** : @modelcontextprotocol/sdk + Vercel AI SDK + react-markdown
- **Document** : react-pdf + Barid eSign + ANRT TSA RFC 3161
- **Tests** : Vitest 2.1 + Playwright 1.49 + axe-core
- **Observability** : Pino + OpenTelemetry + Datadog/Grafana Cloud
- **CI/CD** : GitHub Actions + Husky + Biome 1.9

Voir `1-stack-technique.yaml` pour liste exhaustive.

### 6.2 Multi-tenant 3 niveaux + RLS

**Niveau 1 -- Platform** : super_admin_platform / analyst_support (bypass RLS via `app_is_super_admin()`)
**Niveau 2 -- Customer Tenant** : cabinet courtier OR garage tenant (`x-tenant-id` header mandatory + RLS via `app_current_tenant()`)
**Niveau 3 -- Assure L3** : `app_assure_user_id` filter additionnel sur routes `/api/v1/assure/*`

Cross-tenant authorizations (Sprint 25) : 3 types (broker_to_garage_assignment / assure_to_garage_visit / multi_tenant_user_access).

### 6.3 Conventions transverses

**Header obligatoire** : `x-tenant-id` partout sauf `/api/v1/public/*` et `/api/v1/admin/*`
**Validation** : Zod uniquement (vs class-validator deprecated)
**Logger** : Pino structured + PII redaction
**Hash password** : argon2id (vs bcrypt/scrypt)
**JWT signing** : RS256 + key rotation 90 jours
**Encryption at rest** : AES-256-GCM (KMS AWS / Azure)
**Events Kafka topic** : `insurtech.events.{vertical}.{entity}.{action}` (Sprint 2 catalog 30+ topics)
**Audit trail** : tous CUD + ACAPS-relevant operations preserve 10 ans
**Idempotency-Key** : Header obligatoire mutations + tools MCP write

### 6.4 Conventions naming

**Tables BD** :
- `auth_*` (auth/multi-tenant)
- `crm_*`, `booking_*`, `comm_*`, `docs_*`, `pay_*`, `books_*`, `compliance_*`, `analytics_*`, `stock_*`, `hr_*`
- `insure_*` (Vertical Broker -- decision design v2.2 : naming english `insure_policies`/`insure_quotes`/`insure_renewals` etc.)
- `repair_*` (Vertical Garage -- decision design v2.2 : naming english `repair_garages`/`repair_diagnostics`/`repair_orders`/`repair_invoices`/`repair_warranties` etc.)
- `admin_*`, `billing_*`, `cross_tenant_*`
- `sky_*` (Sprint 31 -- conversations + messages Agent Sky)
- `mcp_*` (Sprint 30 -- MCP client credentials + audit)

**Endpoints REST** :
- `/api/v1/{module}/{resource}` -- CRUD standard tenant context
- `/api/v1/admin/*` -- super admin only (bypass RLS)
- `/api/v1/assure/*` -- L3 routes
- `/api/v1/public/*` -- pas d'auth
- `/api/v1/sky/*` -- Sprint 31 chatbot
- `/mcp/v1/*` -- Sprint 30 MCP server (port 4001)

**Events Kafka** :
- `insurtech.events.insure.policy.created`
- `insurtech.events.repair.sinistre.dispatched`
- `insurtech.events.sky.conversation.completed`
- etc.

---

## 7. CONFORMITE MA

### 7.1 Loi 09-08 (CNDP -- Protection donnees personnelles)

**Sprint 6** : Multi-tenant strict + RLS isolation 0 leak
**Sprint 8** : Procedure purge tenant data (anonymize PII + preserve audit_log)
**Sprint 17** : Pas de PII persistee DB pour prospects avant inscription (sessions Redis TTL 30min)
**Notification breach** : sous 72h CNDP
**Hosting production** : **Atlas Cloud Services Benguerir** (cloud souverain MA -- DC1 Tier III + DC2 Tier IV Uptime Institute -- ISO 27001/SOC2/PCI DSS/HIPAA -- decision-008). ACAPS et Barid Maroc deja clients Atlas Cloud Services -> coherence ecosystem regulators MA + facilite audits.

### 7.2 Loi 43-20 (Signature electronique)

**Sprint 10** : Tiers de confiance certifie marocain (Barid eSign Poste Maroc) + Hash SHA-512 + Horodatage qualifie ANRT TSA RFC 3161 + Archivage legal 10 ans Atlas Cloud Services Object Storage Benguerir (immutable bucket + DC1/DC2 redondance).

### 7.3 Loi 17-99 (Assurance MA -- droit retract 30j)

**Sprint 15** : Resiliation anticipee avec computation remboursement pro-rata. Droit retractation 30 jours post-souscription.

### 7.4 CGNC Plan Comptable Marocain (loi 9-88)

**Sprint 12** : Plan comptable classes 1-9 + ecritures auto depuis events Pay + Export SAFT-MA pour controles DGI.

### 7.5 Loi 43-05 (Anti-blanchiment AMC)

**Sprint 12** : AML monitoring + SAR generation + declaration soupcon AMC.

### 7.6 ACAPS (Programme Emergence)

**Sprint 12 + 28** : Reports trimestriel + annuel solvabilite. Cas d'usage 02 (comparaison), 03 (souscription), 04 (CRM), 07 (sinistres). Audit trail systematique sur ecritures critiques.

**Decision-010** : ACAPS Programme Emergence ne demande pas integration assureurs reels (defere a Sprint 32 sans impact reglementaire).

### 7.7 Conformite financiere

- **TVA MA** : 5 taux (0% / 7% / 10% / 14% / 20%) -- Sprint 12
- **CNSS** : 4.48% taux salarial -- Sprint 13 paie
- **AMO** : 2.26% -- Sprint 13 paie
- **BAM** : limit 100k MAD + 3D Secure obligatoire transactions -- Sprint 11
- **PCI-DSS** : compliance pour stockage tokens cartes -- Sprint 11
- **RGS niveau 2** : Reglement General Securite -- Sprint 33

---

## 8. STRATEGIES DEFEREES (decisions-007 + 010)

### 8.1 AI-defere strategy (decision-007)

**Pattern Mock -> Real swap** :
- **Sprint 20 (Phase 5)** : `MockIaEstimationClient` -- mock realistic data (60h dev)
- **Sprint 29 (Phase 7)** : `SkaleanAiVisionClient` -- real Skalean AI integration (70h dev)
- **Swap** : `IA_ESTIMATION_PROVIDER=mock -> skalean_ai` (one-line config)

**Activation gradual rollout** :
- Sprint 29 : 10% trafic real / 90% mock
- Sprint 30 : 50/50
- Sprint 31 : 100% real
- Rollback procedure < 60s switch back

**Pourquoi defere** :
1. API Skalean AI peut evoluer pendant Phase 5-6 dev
2. Cout : real calls couteux pendant dev (mock gratuit)
3. Tests deterministes (mock retourne data consistente)
4. Pas de bloquant flows downstream (Sprint 21, 22, 24)

### 8.2 Ecosystem-defere strategy (decision-010)

**Pattern lookup -> connecteurs reels** :
- **Sprint 14 (Phase 4)** : Tarification via lookup tables (data assureurs cached)
- **Sprint 32 (Phase 7)** : Tarification via 5 connecteurs API real-time (Wafa+Atlanta+Saham+RMA+AXA)
- **Adapter pattern** : `TarificationOrchestrator` route lookup vs API si dispo

**Pourquoi defere** :
1. Partenariats commerciaux + sandboxes acquisition AVANT integration
2. API maturity variable (Wafa moderne ; AXA/RMA partiel)
3. ACAPS Programme Emergence ne demande pas connecteurs reels
4. Pilote 1 assureur Wafa suffisant Sprint 35

**Mitigation Phase 4-6** :
- Tarification lookup Sprint 14 (10-20% off acceptable)
- Souscription : signature Skalean fonctionne sans push assureur
- Sinistres : declaration interne Skalean
- ACAPS reports : donnees internes Skalean

---

## 9. CRITERES DE SUCCES PROJET v2.2

### 9.1 Criteres techniques

- 100% des criteres P0 des 35 sprints sont PASS
- Pentest externe (Sprint 33) sans vulnerabilite High ou Critical residuelle
- Performance : 1000+ tenants concurrents avec p95 < 150ms
- Disponibilite : 99.9% sur les 30 jours de pilote
- Couverture tests : 85%+ globale, 90%+ sur modules critiques (auth, pay, compliance, customer-portal)
- **Lighthouse PWA score >= 95** sur web-garage-mobile et web-assure-mobile (cible 100)
- **Lighthouse Performance >= 95** sur web-customer-portal
- **Lighthouse SEO 100** sur web-customer-portal
- **Multi-tenant isolation tests** : 50+ scenarios passent (Sprint 33)

### 9.2 Criteres business

- Pilote Marrakech 30 jours reussi avec satisfaction > 4/5 et NPS > 30
- Au moins 2 cabinets de courtage pilotes signatures et utilisateurs actifs
- **Au moins 100 prospects** ayant utilise web-customer-portal pour cotation
- **Au moins 50 polices** vendues end-to-end via flux online (cible 30+)
- **Au moins 30 sinistres** traites end-to-end via flux M8 (Sprint 35)
- Delai sinistre moyen < 24h (vs 5 jours initial)
- Delai souscription police < 5 minutes (vs 48h initial)
- **Conversion prospect -> assure** via web-customer-portal >= 15%
- **1 assureur Wafa** connecte via API Sprint 32 (cible Phase 8+ : 5 assureurs)
- Conformite ACAPS attestee par audit externe
- Conformite CNDP loi 09-08 attestee

### 9.3 Criteres organisationnels

- Equipe technique : 2 devs FTE minimum + freelance backup
- Documentation : 100% sprints avec runbooks + ADR
- Tests E2E : 480+ scenarios cumules
- Code review : 100% PR review obligatoire
- CI/CD : green sur main 95% du temps

### 9.4 Criteres AI integration v2.2

- Sky agent multilingue 4 langues operational (Sprint 31)
- 15+ tools MCP exposes Sprint 30
- Skalean AI cost monitoring + budget alerts (Sprint 29)
- Sky conversations : success rate > 70% queries resolved sans escalade humain

---

## 10. REGLES DE GENERATION DES PROMPTS DE TACHES

### 10.1 Format Option B (v2.2 -- adopte 35/35 sprints)

Chaque tache suit la structure :
1. **Metadonnees** (Phase / Sprint / Priorite / Effort / Dependencies)
2. **But** (1 phrase claire)
3. **Contexte** (pourquoi cette tache)
4. **Livrables checkables** (10-25 items checkables)
5. **Fichiers crees / modifies** (avec lignes estimees)
6. **Stack imposee** (versions exactes Sprint)
7. **Pattern critique** (code TypeScript inline si pattern specifique a skalean-insurtech)
8. **Notes implementation** (pieges, choix non-evidents)
9. **Criteres validation V1-V10** (avec priorites P0/P1/P2)

### 10.2 Patterns code inline

Code TypeScript inline UNIQUEMENT pour patterns specifiques skalean-insurtech (cf. `4-templates-generation.md` patterns 1-21 v2.2). Voir patterns 18-21 v2.2 nouveaux : MCP server tool definition / Sky agent system prompt / Skalean AI REST avec circuit breaker / AI-defere swap pattern (DI factory).

### 10.3 No-emoji absolute (decision-006)

**0 emoji** dans toute la generation. Verifie via regex unicode 1F000-1FFFF + custom script `check-no-emoji.sh` pre-commit hook + CI verification.

### 10.4 Conventions multi-tenant

Tous services metier suivent **Pattern 1** (Service NestJS standard) avec :
- Multi-tenant filter sur chaque query (RLS Postgres + TypeORM Subscriber TenantIdInjector)
- Validation Zod en debut de methode
- Audit ACAPS sur create/update/delete
- Event Kafka publie sur action metier

---

## 11. STRUCTURE DOCUMENTAIRE v2.2

```
skalean-insurtech-plan/
├── INDEX.md                       # Navigation v2.2
├── README.md                      # Vue projet rapide v2.2
├── AUDIT-V2.2-COHERENCE-REPORT.md # Audit cross-fichiers v2.2
│
├── _archive-v2.0/                 # Documents v2.0 deprecies
│   ├── 01-plan-realisation-PARTIE1.md  # DEPRECATED
│   ├── 02-plan-realisation-PARTIE2.md  # DEPRECATED
│   └── 03-plan-realisation-PARTIE3.md  # DEPRECATED
│
├── meta-prompts/
│   ├── phase-B-tasks/             # 35 sprints Option B v2.2 (livres)
│   ├── phase-C-orchestration/     # 35 orchestrateurs (a generer post Phase A)
│   └── phase-V-verification/      # 35 verifications (a generer post Phase A)
│
├── documentation/                 # 11 documents reference v2.2
│   ├── 1-stack-technique.yaml     # 9 apps + deps
│   ├── 2-variables-environnement.env  # MCP_* + VAPID + OAuth2
│   ├── 3-schemas-database-PARTIE1/2/3.sql  # 69+ tables
│   ├── 4-templates-generation.md  # Patterns 1-21
│   ├── 5-roles-permissions.md     # 12 roles x 85+ permissions
│   ├── 6-metriques-validation.md  # KPIs + Lighthouse cibles per app
│   ├── 7-glossaire-exemples.md    # ~200 termes
│   ├── 8-skalean-insurtech-prompt-master.md  # CE DOCUMENT v2.2
│   ├── 9-roadmap-execution.md     # Ordre execution + AI-defere
│   └── 10-arborescence-projet.md  # Structure projet v2.2
│
├── audits/
├── decisions/                     # 10 decisions strategiques (avec decision-010)
└── templates/                     # Format meta-prompts
```

---

## 12. INSTRUCTIONS POUR CLAUDE CODE / COWORK

### 12.1 Prerequis avant generation

Cowork doit lire **dans cet ordre** avant de generer prompts taches :
1. `INDEX.md` (navigation v2.2)
2. `8-skalean-insurtech-prompt-master.md` (CE document)
3. `meta-prompts/phase-B-tasks/B-XX-sprint-XX-*.md` (sprint specifique)
4. `4-templates-generation.md` (patterns code reutilisables)
5. `5-roles-permissions.md` (matrice permissions)
6. `decisions/` (10 decisions strategiques)

### 12.2 Regle d'or modification fichiers

**Cowork ne modifie JAMAIS `00-pilotage/`**. Il :
- LIT meta-prompts + prompts taches + verifications
- ECRIT dans `repo/` (code apps + packages + infra + docs techniques)
- GENERE prompts taches dans `00-pilotage/prompts-taches/` lorsque demande explicit

### 12.3 Workflow standard

1. **Lecture meta-prompt B-XX** Sprint X
2. **Generation prompts taches** : Cowork genere `task-X.Y.Z-*.md` dans `prompts-taches/sprint-XX-*/`
3. **Execution taches** : Cowork execute chaque task et modifie `repo/` selon livrables
4. **Verification V-XX** : checks automatiques sprint complet
5. **Orchestration C-XX** : validation finale sprint + handoff sprint suivant

### 12.4 Multi-tenant context obligatoire

Tout service metier injecte automatique :
- `TenantContext` via AsyncLocalStorage (Sprint 6)
- `SET LOCAL app.current_tenant_id` Postgres avant chaque transaction
- Audit log : tenant_id + user_id + traceId

### 12.5 No-emoji + format Option B

- 0 emoji dans toute generation
- Format Option B obligatoire : Metadonnees / But / Contexte / Livrables checkables / Fichiers crees / Stack imposee / Notes / Criteres V1-V10 P0/P1/P2

---

## 13. EVOLUTION ET MAINTENANCE

Ce document maitre est le **point d'ancrage de tout le projet**. Toute modification majeure doit etre repercutee :
1. D'abord ici (8-master.md)
2. Puis dans documents reference associes (1-stack / 2-env / 3-schemas / etc.)
3. Puis dans fichiers tache impactes
4. Audit cross-fichiers final pour valider coherence

Les revisions du document maitre suivent une numerotation semantique :
- v1.0.0 : version initiale (5 apps SaaS / 9 phases)
- v2.0.0 : 8 apps + 3 flux + 35 sprints / 10 phases
- v2.1.0 : densification Option B (en cours)
- **v2.2.0 : version actuelle -- 9 apps + 7 phases + 35 sprints + decision-007/010 cascade**

---

## 14. DECISIONS STRATEGIQUES (10 decisions)

| # | Titre | Sprint impact |
|---|-------|---------------|
| 001 | Monorepo pnpm + Turborepo | Sprint 1 |
| 002 | Multi-tenant 3 niveaux + RLS | Sprint 1, 6, 25 |
| 003 | TypeORM 0.3 vs Prisma | Sprint 1, 2 |
| 004 | Kafka KRaft vs RabbitMQ | Sprint 1, 2 |
| 005 | Skalean AI Frontier model | Sprint 29-31 |
| 006 | No-emoji policy absolute | Tous sprints |
| 007 | AI defere (Mock Sprint 20 -> Real Sprint 29) | Sprint 20, 29 |
| 008 | Data residency Maroc strict | Sprint 6, 10, 12 |
| 009 | Signature Barid eSign + ANRT | Sprint 10 |
| **010** | **Insure Connecteurs defere Phase 7** | **Sprint 32 (B-15 origine)** |

Voir `decisions/` pour documents complets.

---

## 15. CHECKLIST VALIDATION DOCUMENT MAITRE v2.2

- [x] 7 phases (vs 10 v2.0)
- [x] 9 apps (vs 8 v2.0 -- ajout mcp-server)
- [x] 35 sprints / 461 taches Option B
- [x] decision-007 AI-defere integre
- [x] decision-010 cascade integre
- [x] 12 roles utilisateurs
- [x] 3 types tenants Repair (Sprint 25)
- [x] Conformite 4 regulators MA (ACAPS / DGI / AMC / CNDP)
- [x] 3 flux utilisateur principaux
- [x] No-emoji absolute (decision-006)
- [x] Pattern Multi-tenant 3 niveaux
- [x] Strategy AI-defere documentee
- [x] Strategy ecosystem-defere documentee
- [x] Criteres succes business v2.2
- [x] Cascade renumerotation B-15 -> B-32 documentee

---

**Fin du document `8-skalean-insurtech-prompt-master.md` v2.2.0.**

**Document central -- toute autre documentation skalean-insurtech doit etre coherente avec ce document.**
