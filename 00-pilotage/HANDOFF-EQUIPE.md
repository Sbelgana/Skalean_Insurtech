# HANDOFF EQUIPE skalean-insurtech v2.2

**Programme** : Skalean InsurTech Maroc -- Plateforme insurance + repair multi-tenant
**Version livraison** : v2.2 (Option B detaillee)
**Date livraison** : Mai 2026
**Statut** : PRET pour execution Sprint 1
**AUCUNE EMOJI AUTORISEE** (decision-006 ABSOLU)

---

## 1. Vue d'ensemble du livrable

Ce package contient le **programme complet de developpement** sur 35 sprints (~12 mois 2 devs FTE) pour livrer la plateforme Skalean InsurTech end-to-end.

### Stats globales

| Metric | Valeur |
|---|---|
| Sprints livres | 35 / 35 |
| Phases | 7 |
| Total taches | 462 |
| Total criteres validation | 2 727 |
| Effort cumul | ~2 720 heures (~12 mois 2 devs FTE) |
| Tests E2E cumul estime | 5 284+ scenarios |
| Decisions strategiques | 10 / 10 formalisees |
| Lois MA conformes | 9 / 9 |
| Volume documentation | 4.9 Mo |
| Score audit qualite | **98.0% GO** |

---

## 2. Architecture du livrable

```
Skalean_Insurtech/
├── README.md + INDEX.md                   # Navigation principale
├── HANDOFF-EQUIPE.md                      # Ce fichier
│
├── audits/                                # Audits qualite
│   ├── AUDIT-V2.0-COHERENCE-REPORT.md
│   ├── AUDIT-V2.2-COHERENCE-REPORT.md
│   └── AUDIT-TRIADE-BCV-REPORT.md         # 98.0% GO -- valide pour execution
│
├── decisions/                             # 10 decisions strategiques
│   ├── 001-monorepo-structure.md
│   ├── 002-multi-tenant-3-niveaux.md
│   ├── 003-typeorm-vs-prisma.md
│   ├── 004-kafka-vs-rabbitmq.md
│   ├── 005-skalean-ai-frontier.md
│   ├── 006-no-emoji-policy.md             # ABSOLU
│   ├── 007-ai-3-deferred-sprints.md
│   ├── 008-data-residency-maroc.md        # Atlas Cloud Services Benguerir
│   ├── 009-signature-loi-43-20.md
│   └── 010-insure-connecteurs-deferred.md
│
├── documentation/                         # 13 fichiers reference v2.2
│   ├── 1-stack-technique.yaml             # Stack complet versionnee
│   ├── 2-variables-environnement.env      # Variables env (29 ko)
│   ├── 3-schemas-database-PARTIE1.sql     # Schema initial
│   ├── 3-schemas-database-PARTIE2.sql     # Schema metier
│   ├── 3-schemas-database-PARTIE3.sql     # Schema admin/transversal
│   ├── 3-schemas-database-v2.2-additions.sql  # 12 nouvelles tables v2.2
│   ├── 4-templates-generation.md          # 21 patterns code (incl. v2.2 MCP/Sky)
│   ├── 5-roles-permissions.md             # 12 roles x 85+ permissions
│   ├── 6-metriques-validation.md          # Seuils chiffres + Lighthouse
│   ├── 7-glossaire-exemples.md            # ~210 termes
│   ├── 8-skalean-insurtech-prompt-master.md  # Prompt master (22 ko)
│   ├── 9-roadmap-execution.md             # Roadmap 35 sprints
│   └── 10-arborescence-projet.md          # Arborescence cible
│
└── meta-prompts/                          # CŒUR du livrable
    ├── meta-prompts/                       # 35 specs detailled (B-XX)
    │   ├── B-01-sprint-01-bootstrap.md   ...
    │   └── B-35-sprint-35-pilote-marrakech-go-live.md
    │
    ├── orchestrateurs/                     # 35 orchestrateurs detailled (C-XX)
    │   ├── README.md
    │   ├── C-01-sprint-01-bootstrap.md   ...
    │   └── C-35-sprint-35-pilote-marrakech-go-live.md
    │
    └── verifications/                      # 35 verifications detailled (V-XX)
        ├── README.md
        ├── V-01-sprint-01-bootstrap.md   ...
        └── V-35-sprint-35-pilote-marrakech-go-live.md
```

---

## 3. Comprendre la triade B/C/V

Pour **chaque sprint**, le programme livre 3 fichiers complementaires :

### B-XX (Specifications detaillees)
- **Quoi** faire pendant le sprint
- 12-16 taches X.Y.Z avec : metadonnees + But + Contexte + Livrables checkables + Fichiers crees + Notes implementation + Criteres validation V1-V10
- ~30-50 ko chacun
- **Lecture obligatoire** par developpeurs au debut du sprint

### C-XX (Orchestrateurs Cowork)
- **Comment** orchestrer le sprint pour Claude Code / Cowork
- Sequence taches + commit Conventional Commits + validation incrementale
- Regles absolues skalean-insurtech (multi-tenant, Zod, Pino, no-emoji, etc.)
- ~30-45 ko chacun
- **Consume par Cowork** pour execution automatisee

### V-XX (Verifications post-sprint)
- **Valider** automatiquement le sprint
- Bash scripts avec criteres P0/P1/P2 + auto-reparation + rapport markdown
- ~35-70 ko chacun
- **Lance par Cowork** apres execution toutes les taches
- Produit `sprint{N}-verify-report.md` avec score GO/GO CONDITIONNEL/NO-GO

### Workflow execution Sprint N

```
1. Saad/Lead lance Sprint N
   |
   v
2. Cowork lit C-{N} (orchestrateur)
   |
   v
3. Cowork genere prompts-taches/sprint-{N}/task-X.Y.Z-prompt.md depuis B-{N}
   |
   v
4. Cowork execute taches sequentielles :
   - Lit task-X.Y.Z-prompt.md
   - Modifie repo/ (code + tests)
   - Compile (pnpm tsc --noEmit)
   - Tests (pnpm vitest run)
   - Commit Conventional Commits
   |
   v
5. Apres derniere tache : Cowork lance V-{N}
   |
   v
6. V-{N} produit sprint{N}-verify-report.md
   |
   v
Score >= 95% : GO -> Sprint N+1
Score 85-94% : GO CONDITIONNEL -> hot fix
Score < 85%  : NO-GO -> reprise sprint
```

---

## 4. Roadmap 35 sprints

### Phase 1 -- Bootstrap Infrastructure (4 sprints, ~325h)

| # | Sprint | Apport |
|---|--------|--------|
| 1 | Bootstrap Infrastructure | Monorepo + Docker + 9 apps stubs + 21 packages |
| 2 | Database + Kafka | Schema 32 tables + 30+ topics Kafka KRaft |
| 3 | API Bootstrap NestJS | API NestJS + Swagger + Pino + tests |
| 4 | Frontend Bootstrap | 8 apps Next.js + i18n + PWA + shadcn/ui |

### Phase 2 -- Securite (3 sprints, ~225h)

| # | Sprint | Apport |
|---|--------|--------|
| 5 | Auth Foundations | argon2id + JWT RS256 + MFA TOTP + sessions |
| 6 | Multi-Tenant 3 Niveaux | RLS isolation 0 leak cross-tenant |
| 7 | RBAC Granulaire | 12 roles x 85+ permissions + 80+ tests scenarios |

### Phase 3 -- Modules Horizontaux (6 sprints, ~460h)

| # | Sprint | Apport |
|---|--------|--------|
| 8 | CRM + Booking | Lifecycle prospect -> client + bookings |
| 9 | Comm WhatsApp + Email | Templates 4 locales + WA Business + Resend |
| 10 | Docs + Signature 43-20 | Barid eSign + ANRT TSA RFC 3161 |
| 11 | Pay Multi-Passerelles MA | 6 gateways (CMI/YouCan/PayZone/Inwi/Orange/M-Wallet) |
| 12 | Books + Compliance MA | CGNC + ACAPS + DGI SAFT-MA + AMC |
| 13 | Analytics + Stock + HR | ClickHouse OLAP + dashboards + paie CNSS/AMO |

### Phase 4 -- Vertical Insure -- Skalean Broker ERP (5 sprints, ~395h)

| # | Sprint | Apport |
|---|--------|--------|
| 14 | Insure Foundation | 7 entities + tarification lookup tables |
| 15 | Insure Lifecycle Avance | Transferts + flottes + queue evenements |
| 16 | Web Broker App (3001) | SaaS B2B courtiers production-ready |
| 17 | Web Customer Portal | Vente en ligne SEO Lighthouse 95+ |
| 18 | Web Assure Portal + Mobile | Desktop + PWA Lighthouse 100 |

### Phase 5 -- Vertical Repair -- Skalean Garage ERP (7 sprints, ~510h)

| # | Sprint | Apport |
|---|--------|--------|
| 19 | Vertical Repair Foundation | 5 entities + Atlas seed Type 1 tenant |
| 20 | IA Estimation Photos (Mock) | MockIaEstimationClient swap-ready Sprint 29 |
| 21 | Sinistre Workflow | States machine + split facturation insurer/customer |
| 22 | Web Garage App (3002) | SaaS B2B garages production-ready |
| 23 | Web Garage Mobile PWA | Technicien atelier + WebAuthn biometric |
| 24 | Flux Sinistre Client M8 | **Premier marche MA end-to-end < 24h** |
| 25 | Cross-Tenant Framework | 3 types tenants Repair (Type 1/2/3) |

### Phase 6 -- Admin Platform (3 sprints, ~210h)

| # | Sprint | Apport |
|---|--------|--------|
| 26 | Admin Foundation | web-insurtech-admin + impersonation |
| 27 | Tenants Management | Onboarding wizard + billing |
| 28 | Admin Reports + Compliance | Reports 4 regulators MA |

### Phase 7 -- Hardening + Integrations + Pilote (7 sprints, ~595h)

| # | Sprint | Apport |
|---|--------|--------|
| 29 | Skalean AI REST | Swap Mock -> Real Skalean AI integration |
| 30 | Skalean AI MCP Server | Port 4001 -- 15+ tools metier exposed |
| 31 | Agent Sky Multilingue | 4 langues (fr/ar-MA/ar/en) -- 4 apps |
| 32 | Insure Connecteurs | 5 connecteurs reels (Wafa+Atlanta+Saham+RMA+AXA) |
| 33 | Pentest Securite | Audit externe + 0 critical/high + ASVS Level 2 |
| 34 | Performance Scaling | Load 1000+ tenants + chaos + SLOs validated |
| 35 | **Pilote Marrakech + Go-Live** | 4 semaines pilote + Go-Live commercial |

---

## 5. Quick Start -- Demarrer Sprint 1

### Prerequis equipe

- 2 devs full-stack TypeScript senior (Node.js + React + PostgreSQL)
- 1 lead tech (Saad / CTO) pour decisions techniques
- 1 product owner (Abla / CEO) pour priorites business
- Cowork (claude-code CLI) installe sur machines dev
- Comptes acces : GitHub, Atlas Cloud Services, Skalean AI, Barid eSign sandbox

### Setup environnement local

```bash
# 1. Cloner repo (a creer Sprint 1)
git clone git@github.com:skalean/skalean-insurtech.git
cd skalean-insurtech

# 2. Importer le programme dans 00-pilotage/
mkdir -p 00-pilotage/
# Copier le contenu de Skalean_Insurtech/ ici

# 3. Verifier prerequis Node + pnpm
node --version  # >= 22.11.0
pnpm --version  # >= 9.x

# 4. Lecture obligatoire
cat 00-pilotage/HANDOFF-EQUIPE.md       # Ce fichier
cat 00-pilotage/decisions/006-no-emoji-policy.md  # ABSOLU
cat 00-pilotage/documentation/8-skalean-insurtech-prompt-master.md  # 22 ko
```

### Lancement Sprint 1

```bash
# Cowork lit l'orchestrateur Sprint 1
cat 00-pilotage/orchestrateurs/C-01-sprint-01-bootstrap.md

# Cowork CLI lance execution Sprint 1
claude-code \
  --orchestrator 00-pilotage/orchestrateurs/C-01-sprint-01-bootstrap.md \
  --reference-prompt 00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md \
  --verification 00-pilotage/verifications/V-01-sprint-01-bootstrap.md

# Apres Sprint 1 termine :
cat sprint01-verify-report.md
# Score >= 95% : GO -> demarrer Sprint 2
```

---

## 6. Regles absolues skalean-insurtech (NON-NEGOCIABLES)

### Conventions techniques

- **Multi-tenant** : `tenant_id` filter automatique + header `x-tenant-id` obligatoire (sauf `/api/v1/public/*` et `/api/v1/admin/*`)
- **Validation** : Zod uniquement (JAMAIS class-validator)
- **Logger** : Pino via `this.logger` (JAMAIS `console.log`, JAMAIS `new Logger()`)
- **Events** : Kafka `insurtech.events.{vertical}.{entity}.{action}` pour chaque action metier
- **RBAC** : `@Roles()` + `RolesGuard` + `TenantGuard` sur chaque endpoint
- **Tests** : Vitest, chaque `.ts` a un `.spec.ts` (coverage >= 85% global, 90% modules critiques)
- **Types** : TypeScript strict, AUCUN `any` implicite, `noUncheckedIndexedAccess: true`
- **Hash password** : argon2id (JAMAIS bcrypt, JAMAIS scrypt)
- **JWT** : RS256 + key rotation 90 jours
- **Encryption at rest** : AES-256-GCM (Atlas Cloud Services KMS)
- **Package manager** : pnpm (JAMAIS npm ou yarn)
- **Imports** : `@insurtech/*` pour packages partages
- **Skalean AI** : utilise UNIQUEMENT via `@insurtech/sky` ou MCP client
- **AUCUNE EMOJI** dans code/commentaires/logs (decision-006 ABSOLU)
- **Idempotency-Key** : header obligatoire pour mutations + tools MCP write
- **Conventional Commits** : tous commits suivent `<type>(scope): description`

### Conformite InsurTech Maroc (9 lois)

- **Audit ACAPS** : ecritures `insure_*`, `repair_*`, `pay_*` declenchent `compliance_acaps_audits` (10 ans retention)
- **Loi 09-08 CNDP** : aucune donnee assure ne transite hors Atlas Cloud Services Benguerir
- **Loi 43-20** : signatures via `@insurtech/signature` (Barid eSign + ANRT TSA RFC 3161)
- **Loi 17-99 article 9** : droit retract 30j B2C tracable
- **Loi 9-88** : ecritures CGNC + SAFT-MA export DGI
- **Loi 43-05** : AML monitoring + SAR generation AMC
- **TVA MA** : 5 taux (0/7/10/14/20%) -- Sprint 12
- **CNSS/AMO** : 4.48% / 2.26% -- Sprint 13 paie
- **BAM** : limit 100k MAD + 3D Secure obligatoire (Sprint 11)
- **Notification breach** : sous 72h CNDP + Atlas Cloud Services SOC

### Multilinguisme (fr/ar-MA/ar/en)

- Toute communication assure (notifications/emails/WhatsApp/Sky) supporte les 4 langues
- ar-MA = darija marocaine (vernaculaire) ; ar = arabe classique
- Sky agent (Sprint 31) : 16 prompts (4 apps x 4 locales)

---

## 7. Decisions strategiques (10/10)

| # | Decision | Reference |
|---|----------|-----------|
| 001 | Monorepo pnpm + Turborepo | `decisions/001-monorepo-structure.md` |
| 002 | Multi-Tenant 3 Niveaux RLS | `decisions/002-multi-tenant-3-niveaux.md` |
| 003 | TypeORM 0.3 (vs Prisma) | `decisions/003-typeorm-vs-prisma.md` |
| 004 | Kafka KRaft (vs RabbitMQ) | `decisions/004-kafka-vs-rabbitmq.md` |
| 005 | Skalean AI Frontier strict | `decisions/005-skalean-ai-frontier.md` |
| 006 | **No-emoji policy ABSOLU** | `decisions/006-no-emoji-policy.md` |
| 007 | AI-defere Mock -> Real | `decisions/007-ai-3-deferred-sprints.md` |
| 008 | **Atlas Cloud Services Benguerir** (cloud souverain MA) | `decisions/008-data-residency-maroc.md` |
| 009 | Barid eSign + ANRT (loi 43-20) | `decisions/009-signature-loi-43-20.md` |
| 010 | Insure Connecteurs defere Phase 7 | `decisions/010-insure-connecteurs-deferred.md` |

Lecture obligatoire : decision-006 (no-emoji) + decision-008 (Atlas Cloud Services).

---

## 8. Validation et reception

### Audit qualite triade B/C/V

- **Score** : 98.0% GO
- **Verifications PASS** : 50/51
- **P0 FAIL** : 0
- **P1 WARN** : 0 (corrigees)
- **P2 INFO** : 1 (forward refs roadmap intentionnel)

Voir `audits/AUDIT-TRIADE-BCV-REPORT.md`.

### Critical path Phase 1 -> Phase 4

Sprints critiques bloquants :
- Sprint 1 (foundation) : erreurs ici impact tous suivants
- Sprint 6 (multi-tenant) : 0 leak cross-tenant non-negociable
- Sprint 24 (flux M8) : premier marche MA, exposure differentiation
- Sprint 33 (pentest) : BLOQUE Sprint 35 si critical/high findings
- Sprint 35 (pilote) : 4 semaines duree (vs 2 sem standard) + suivi post

### Premier sprint critique Sprint 6

Sprint 6 active multi-tenant 3 niveaux + RLS Postgres helpers (`app_current_tenant()`, `app_is_super_admin()`, `app_can_access_tenant()`). **Tous les sprints suivants en dependent**. Verification obligatoire : 50+ tests RLS isolation 0 leak.

---

## 9. Contacts et escalation

| Role | Personne | Responsabilite |
|------|----------|----------------|
| CTO | Saad | Decisions techniques + sprints planning |
| CEO | Abla | Priorites business + go/no-go phases |
| Lead Dev | TBD | Execution sprints + Cowork operation |
| QA Lead | TBD | Validation V-XX + tests E2E |

### Escalation matrix

- **NO-GO sprint** -> Saad/Abla decision (cut scope OR delai)
- **Critical/high pentest finding** (Sprint 33) -> Pause Sprint 35 immediate
- **Atlas Cloud Services downtime** -> Procedure DR Tier IV (DC2 Benguerir)
- **Skalean AI budget alerts** -> Saad notification 50%/75%/90%

### Slack channels recommandes

- `#insurtech-dev` -- developpement quotidien
- `#insurtech-pilote` -- pilote Marrakech (Sprint 35)
- `#insurtech-incidents` -- incidents production

---

## 10. Roadmap post-livraison Sprint 35

Apres pilote Marrakech (Sprint 35) :

- **Phase 8** : Generalisation autres villes MA (Casa, Rabat, Tanger)
- **Phase 9** : Connecteurs assureurs additionnels (>5)
- **Phase 10** : Internationalisation (Tunisie, Algerie, Senegal)
- **Phase 11** : IA-powered features (tarification dynamic, anti-fraude advanced)

Cf `documentation/9-roadmap-execution.md` pour vision long terme.

---

**Fin du HANDOFF-EQUIPE skalean-insurtech v2.2.**

Bonne execution !

---

*Document genere automatiquement le {date}. Version v2.2 -- toute modification doit passer par PR + review CTO.*
