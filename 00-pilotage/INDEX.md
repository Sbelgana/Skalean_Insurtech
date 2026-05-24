# INDEX -- Assurflow v3.0 (anciennement Skalean_Insurtech v2.2)

**Version** : 3.0.0 -- Foundation Migration Sprint 7.5a livre (2026-05-24)
**Date** : Mai 2026
**Statut** : LIVRE -- Triade B/C/V complete (105 fichiers / 4.9 Mo) + Sprint 7.5a foundation v3.0
**Audit qualite** : 98.0% GO (cf `audits/AUDIT-TRIADE-BCV-REPORT.md`)
**AUCUNE EMOJI AUTORISEE**

> **NOTE v3.0 (2026-05-24)** : Sprint 7.5a + Sprint 7 + Pause #5 + Sprint 7.5b LIVRES.
> - Sprint 7.5a Foundation v3.0 : 26 roles + 7 cross-tenant types + 130 permissions
> - Sprint 7 RBAC v3.0 complete : RbacService + 4 ABAC policies + audit + cache Redis distribue
> - Pause #5 validation runtime : 11/11 cibles PASS + 5 bugs fixes (migration NOW() + grants + DB reset)
> - Sprint 7.5b Foundation Packages : @insurtech/expertise + @insurtech/tow + 3 entities Expert (RLS)
> - Decisions strategiques 011-015 formalisees (rebrand Skalean/Assurflow, ecosystem 6 acteurs, expert ACAPS, PartsHub, Demo Day 30/06/2026)
> - Tags Git : `sprint-7.5a-complete-v3-foundation` + `sprint-07-complete-v3` + `pause-5-validation-complete` + `sprint-7.5b-complete-v3-foundation-packages`
> - Tests cumules : ~1718 PASS (auth 591 + api 885 + database 95 + 28 expertise/tow + 6 insure RLS + 14 RLS apps/api + bootstrap 22)
> - Sprint 8 ready : CRM + Booking sur architecture v3.0 propre
> - References : `meta-prompts/B-7.5a-*.md` + `meta-prompts/B-7.5b-*.md` + `decisions/011-*.md` a `015-*.md` + `pause-5-validation-runtime.md`

**Changelog v2.2 FINAL** :
- 35 meta-prompts B-XX (specifications detaillees Option B) -- 1.4 Mo
- 35 orchestrateurs C-XX (orchestration Cowork detaillee) -- 1.2 Mo
- 35 verifications V-XX (criteres P0/P1/P2 + auto-reparation) -- 1.7 Mo
- 10 decisions strategiques formalisees (decisions/)
- Atlas Cloud Services Benguerir -- cloud souverain MA (decision-008)
- HANDOFF-EQUIPE.md -- guide onboarding complet equipe

**Changelog v2.2 (initial)** :
- Restructuration : passage de 10 phases (v2.0) a **7 phases**
- Decision-007 AI-defere : Skalean AI client deplace vers Phase 7 (Sprint 29-31)
- Decision-010 Insure Connecteurs defere : ancien B-15 -> nouveau B-32 (Phase 7 Sprint 4)
- Cascade renumerotation : tous sprints anciens 16-29 decales -1
- Ajout 9eme app : `mcp-server` (port 4001 -- expose tools metier a Skalean AI)
- 35 sprints Option B densifies (1355 ko / 461 taches detaillees)

---

## VUE GLOBALE DU PROJET

skalean-insurtech est une plateforme InsurTech marocaine composee de :
- **2 SaaS B2B principaux** : Skalean Broker (vente assurance) et Skalean Garage (gestion sinistres)
- **1 application admin Skalean** : Skalean InsurTech Admin
- **3 apps clientes** : Customer Portal (prospects), Mon Espace Assure (desktop + PWA mobile)
- **1 API backend** unifiant tout (NestJS sur port 4000)
- **1 MCP server** expose tools metier a Skalean AI (port 4001 -- NOUVEAU v2.2)

Le projet est entierement autonome (depot Git separe, monorepo, DB, auth) et consomme Skalean AI uniquement comme service externe (REST + MCP).

**Statistiques v2.2** :
- **9 applications** (api + 7 web + mcp-server)
- 8 dashboards utilisateur
- ~21 packages internes (16 metier + 5 shared + sky/sky-ui/assure-shared)
- **35 sprints** planifies en **7 phases**
- **461 taches developpeur** (Option B densifie)
- 69+ tables PostgreSQL
- **12 roles utilisateurs** (super_admin / analyst / 3 broker / 5 garage / assure / prospect)
- **3 types tenants Repair** (Atlas / managed_partner / api_partner -- decision Sprint 25)
- 3 flux principaux (vente en ligne, vente en agence, sinistre client M8)
- **5 connecteurs assureurs** (Wafa P1 + Atlanta + Saham + RMA + AXA -- Sprint 32 defere decision-010)
- **6 passerelles paiement** marocaines (CMI, YouCan Pay, PayZone, Inwi Money, Orange Money, M-Wallet BAM)
- **4 langues Sky agent** : fr / ar-MA (darija) / ar (classique) / en
- **4 regulators MA** integres : ACAPS / DGI / AMC / CNDP
- 12 mois de programme jusqu'au Go-Live pilote Marrakech

---

## ARCHITECTURE DOCUMENTAIRE v2.2

```
Skalean_Insurtech/
|
|-- INDEX.md                              # Ce fichier (navigation v2.2)
|-- README.md                             # Vue projet rapide v2.2
|-- AUDIT-V2.2-COHERENCE-REPORT.md        # Audit cross-fichiers v2.2 (recent)
|
|-- documentation/
|   |-- 1-stack-technique.yaml            # Stack v2.2 (9 apps + mcp-server + deps Sky/MCP)
|   |-- 2-variables-environnement.env     # Variables v2.2 (MCP_* + VAPID + OAuth2)
|   |-- 3-schemas-database-PARTIE1.sql    # Schema systeme + horizontaux (32 tables)
|   |-- 3-schemas-database-PARTIE2.sql    # Schema verticaux + admin (30 tables)
|   |-- 3-schemas-database-PARTIE3.sql    # Schema flux clients v2.0 (7 tables)
|   |-- 4-templates-generation.md         # Patterns 1-21 (v2.2 ajoute MCP/Sky/AI-defere)
|   |-- 5-roles-permissions.md            # Matrix 12 roles x 85+ permissions
|   |-- 6-metriques-validation.md         # KPIs + Lighthouse cibles per app
|   |-- 7-glossaire-exemples.md           # ~200 termes (v2.2 ajoute MCP/Sky/M8)
|   |-- 8-skalean-insurtech-prompt-master.md  # Document maitre v2.2 (7 phases)
|   |-- 9-roadmap-execution.md            # Ordre execution v2.2 + AI-defere Sprint 29-31
|   |-- 10-arborescence-projet.md         # Structure projet v2.2 (9 apps)
|
|-- meta-prompts/
|   |-- meta-prompts/                       # 35 meta-prompts Option B v2.2 (B-01 a B-35)
|   |-- orchestrateurs/                     # 35 orchestrateurs C-XX detailled
|   |-- verifications/                      # 35 verifications V-XX detailled
|
|-- audits/
|   |-- AUDIT-V2.0-COHERENCE-REPORT.md    # Audit historique v2.0
|   |-- AUDIT-V2.2-COHERENCE-REPORT.md    # Audit recent v2.2 (cross-fichiers)
|
|-- decisions/
|   |-- 001-monorepo-structure.md
|   |-- 002-multi-tenant-3-niveaux.md
|   |-- 003-typeorm-vs-prisma.md
|   |-- 004-kafka-vs-rabbitmq.md
|   |-- 005-skalean-ai-frontier.md
|   |-- 006-no-emoji-policy.md
|   |-- 007-ai-3-deferred-sprints.md      # Pattern AI-defere Mock Sprint 20 -> Real Sprint 29
|   |-- 008-data-residency-maroc.md       # CNDP loi 09-08
|   |-- 009-signature-loi-43-20.md        # Conformite legale signature
|   |-- 010-insure-connecteurs-deferred.md  # NOUVEAU v2.2 -- B-15 -> B-32 cascade
|
|-- _archive-v2.0/                        # Documents v2.0 deprecies (reference historique)
|   |-- 01-plan-realisation-PARTIE1.md    # DEPRECATED -- 35 sprints B-XX font autorite
|   |-- 01-plan-realisation-PARTIE2.md    # DEPRECATED
|   |-- 01-plan-realisation-PARTIE3.md    # DEPRECATED
|
|-- templates/
|   |-- 02-template-sprint.md             # Format sprint consolide
|   |-- 03-template-task.md               # Format tache individuelle
|   |-- 04-template-verification.md       # Format verification automatique
|   |-- 05-template-orchestrateur.md      # Format orchestrateur Cowork
```

---

## PARCOURS DE LECTURE RECOMMANDE

### Pour comprendre la vision globale

1. **`8-skalean-insurtech-prompt-master.md`** -- Document maitre v2.2 (7 phases + 9 apps + 3 flux)
2. **`README.md`** -- Vue projet rapide v2.2
3. **`AUDIT-V2.2-COHERENCE-REPORT.md`** -- Etat d'avancement actuel
4. **`9-roadmap-execution.md`** -- Ordre execution + AI-defere strategy

### Pour comprendre l'architecture technique

1. **`1-stack-technique.yaml`** -- Versions et dependances (9 apps)
2. **`3-schemas-database-PARTIE1/2/3.sql`** -- Modele de donnees complet
3. **`4-templates-generation.md`** -- Patterns code recurrents (1-21)
4. **`2-variables-environnement.env`** -- Variables d'environnement
5. **`10-arborescence-projet.md`** -- Structure dossiers cible

### Pour generer les prompts de taches

1. **Pour un sprint donne** : ouvrir `meta-prompts/B-{NN}-sprint-{NN}-{nom}.md`
2. **Pour comprendre la structure d'une tache** : lire `templates/03-template-task.md`
3. **Pour generer les fichiers task individuels** : utiliser le meta-prompt avec Claude Sonnet 4.6 ou Opus 4.7 (Cowork)

### Pour les developpeurs

1. **`README.md`** -- Setup local + 9 apps
2. **`1-stack-technique.yaml`** -- Stack
3. **Section Conventions du `8-master.md`** -- Nommage tables, endpoints, events
4. **`5-roles-permissions.md`** -- Matrix 12 roles x permissions

---

## NAVIGATION RAPIDE PAR PHASE v2.2 (7 PHASES)

### Phase 1 -- Bootstrap Infrastructure (Sprints 1-4)

| Sprint | Cumul | Theme | Meta-prompt |
|--------|-------|-------|-------------|
| 1.1 | 1 | Bootstrap monorepo | B-01 |
| 1.2 | 2 | Database + Kafka | B-02 |
| 1.3 | 3 | API bootstrap NestJS | B-03 |
| 1.4 | 4 | Frontend bootstrap (8 apps Next.js + 5 packages shared) | B-04 |

### Phase 2 -- Securite & Multi-tenant (Sprints 5-7)

| Sprint | Cumul | Theme | Meta-prompt |
|--------|-------|-------|-------------|
| 2.1 | 5 | Auth foundations (argon2id + JWT + MFA) | B-05 |
| 2.2 | 6 | Multi-tenant 3 niveaux (Platform / Tenant / L3 Assure) | B-06 |
| 2.3 | 7 | RBAC granulaire (12 roles x 85+ permissions) | B-07 |

### Phase 3 -- Modules Horizontaux (Sprints 8-13)

| Sprint | Cumul | Theme | Meta-prompt |
|--------|-------|-------|-------------|
| 3.1 | 8 | CRM + Booking | B-08 |
| 3.2 | 9 | Comm WhatsApp + Email | B-09 |
| 3.3 | 10 | Docs + Signature loi 43-20 | B-10 |
| 3.4 | 11 | Pay multi-passerelles MA (CMI/YouCan/PayZone/Mobile) | B-11 |
| 3.5 | 12 | Books + Compliance ACAPS/DGI/AMC | B-12 |
| 3.6 | 13 | Analytics ClickHouse + Stock + HR | B-13 |

### Phase 4 -- Vertical Insure (Skalean Broker ERP) (Sprints 14-18)

| Sprint | Cumul | Theme | Meta-prompt |
|--------|-------|-------|-------------|
| 4.1 | 14 | Insure Foundation (7 entities + tarification basique lookup) | B-14 |
| 4.2 | 15 | Insure Lifecycle Avance (transferts/flottes/endossements/queue/provisional) | B-15 |
| 4.3 | 16 | Web Broker App (port 3001) | B-16 |
| 4.4 | 17 | Web Customer Portal (vente en ligne SEO -- port 3004) | B-17 |
| 4.5 | 18 | Web Assure Portal + Mobile PWA (ports 3005 + 3006) | B-18 |

### Phase 5 -- Vertical Repair (Skalean Garage ERP) (Sprints 19-25)

| Sprint | Cumul | Theme | Meta-prompt |
|--------|-------|-------|-------------|
| 5.1 | 19 | Vertical Repair Foundation (Skalean Atlas seed) | B-19 |
| 5.2 | 20 | IA Estimation Photos (mock realistic + DI swap Sprint 29) | B-20 |
| 5.3 | 21 | Sinistre Workflow detaille | B-21 |
| 5.4 | 22 | Web Garage App (port 3002) | B-22 |
| 5.5 | 23 | Web Garage Mobile PWA technicien (port 3003 + WebAuthn biometric) | B-23 |
| 5.6 | 24 | Flux Sinistre Client M8 end-to-end (cross-tenant routing) | B-24 |
| 5.7 | 25 | Cross-Tenant Framework (3 types tenants Repair) | B-25 |

### Phase 6 -- Admin Platform (Sprints 26-28)

| Sprint | Cumul | Theme | Meta-prompt |
|--------|-------|-------|-------------|
| 6.1 | 26 | Admin Foundation (web-insurtech-admin port 3000 + impersonation) | B-26 |
| 6.2 | 27 | Tenants Management (onboarding wizard + billing + lifecycle) | B-27 |
| 6.3 | 28 | Admin Reports + Compliance (ACAPS / DGI / AMC / CNDP exports) | B-28 |

### Phase 7 -- Hardening + Integrations + Pilote (Sprints 29-35)

| Sprint | Cumul | Theme | Meta-prompt |
|--------|-------|-------|-------------|
| 7.1 | 29 | Skalean AI REST integration (swap Mock Sprint 20 -- decision-007) | B-29 |
| 7.2 | 30 | Skalean AI MCP server (port 4001 -- 15 tools metier) | B-30 |
| 7.3 | 31 | Agent Sky multilingue (4 langues -- 3 apps) | B-31 |
| 7.4 | 32 | Insure Connecteurs Assureurs (5 connecteurs Wafa+Atlanta+Saham+RMA+AXA -- decision-010) | B-32 |
| 7.5 | 33 | Pentest Securite (audit externe + ASVS Level 2) | B-33 |
| 7.6 | 34 | Performance Scaling (load + chaos engineering + SLOs) | B-34 |
| 7.7 | 35 | Pilote Marrakech + Go-Live (50-200 users / 4 semaines) | B-35 |

---

## NAVIGATION PAR FONCTIONNALITE

### Authentification et autorisation

- Sprint 5 (Auth foundations argon2id + JWT) -- B-05
- Sprint 6 (Multi-tenant 3 niveaux + RLS) -- B-06
- Sprint 7 (RBAC 12 roles x 85+ permissions) -- B-07
- Sprint 25 (Cross-tenant framework 3 types) -- B-25

### Skalean AI integration (decision-007 AI-defere)

- Sprint 20 (IA Estimation Photos -- mock realistic) -- B-20
- Sprint 29 (Skalean AI REST -- swap Mock vers Real) -- B-29
- Sprint 30 (Skalean AI MCP server -- 15 tools) -- B-30
- Sprint 31 (Agent Sky multilingue 4 langues) -- B-31

### Vente d'assurance (Skalean Broker ERP)

- Sprint 14 (Foundation -- 7 entities + lookup tables) -- B-14
- Sprint 15 (Lifecycle avance -- transferts + flottes + queue) -- B-15
- Sprint 16 (Web Broker App) -- B-16
- Sprint 17 (Web Customer Portal vente en ligne SEO) -- B-17
- Sprint 32 (Connecteurs assureurs reels -- decision-010 defere) -- B-32

### Espace assure (post-souscription)

- Sprint 18 (Web Assure Portal + Mobile PWA) -- B-18
- Sprint 24 (Declaration sinistre M8 + choix garage) -- B-24

### Gestion sinistres (Skalean Garage ERP)

- Sprint 19 (Foundation -- Skalean Atlas + 6 entities) -- B-19
- Sprint 20 (IA Estimation Photos -- mock pendant dev) -- B-20
- Sprint 21 (Sinistre Workflow detaille) -- B-21
- Sprint 22 (Web Garage App) -- B-22
- Sprint 23 (Web Garage Mobile PWA technicien) -- B-23
- Sprint 24 (Flux M8 end-to-end client -> garage) -- B-24
- Sprint 25 (Cross-Tenant 3 types -- Atlas/managed/api) -- B-25

### Paiement et finance

- Sprint 11 (Pay multi-passerelles MA) -- B-11
- Sprint 12 (Books CGNC + Compliance ACAPS/DGI/AMC) -- B-12

### Compliance et signature

- Sprint 10 (Loi 43-20 signature electronique Barid + ANRT) -- B-10
- Sprint 12 (Compliance ACAPS automatise + DGI SAFT-MA + AMC AML) -- B-12
- Sprint 28 (Admin Reports + Compliance exports) -- B-28

### Communication client

- Sprint 9 (WhatsApp + Email + multilingue 4 templates) -- B-09

### CRM et organisation interne

- Sprint 8 (CRM + Booking) -- B-08
- Sprint 13 (Stock + HR + Analytics ClickHouse) -- B-13

### Admin Skalean Platform

- Sprint 26 (Admin Foundation + impersonation + monitoring) -- B-26
- Sprint 27 (Tenants Management + onboarding wizard) -- B-27
- Sprint 28 (ACAPS + DGI + AMC + CNDP reports) -- B-28

### Hardening + Pilote

- Sprint 33 (Pentest externe + ASVS Level 2 + multi-tenant 50+ scenarios) -- B-33
- Sprint 34 (Performance + scaling + chaos engineering) -- B-34
- Sprint 35 (Pilote Marrakech + Go-Live) -- B-35

---

## DOCUMENTS DE REFERENCE PAR USAGE

### Pour comprendre les flux metier

- `8-skalean-insurtech-prompt-master.md` section "LES 3 FLUX UTILISATEUR PRINCIPAUX"
- `7-glossaire-exemples.md` pour les termes specifiques (M8, Atlas, etc.)

### Pour generer des migrations DB

- `3-schemas-database-PARTIE1.sql` -- systeme et horizontaux (32 tables)
- `3-schemas-database-PARTIE2.sql` -- verticaux et admin (30 tables)
- `3-schemas-database-PARTIE3.sql` -- flux clients (7 tables) + sky_* nouvelles tables
- Total : **69+ tables**

### Pour configurer un environnement

- `2-variables-environnement.env` -- template complet de variables (avec MCP_* + VAPID + OAuth2 v2.2)
- `1-stack-technique.yaml` -- versions exactes a utiliser (9 apps)

### Pour ecrire du code

- `4-templates-generation.md` -- patterns 1-21 (v2.2 ajoute MCP server / Sky agent / AI-defere swap)
- `5-roles-permissions.md` -- matrix permissions
- `8-master.md` section Conventions -- nommage tables, endpoints, events

### Pour le pilote Marrakech

- `B-35-sprint-35-pilote-marrakech-go-live.md` -- specifications complete pilote
- `decisions/010-insure-connecteurs-deferred.md` -- strategie 1 assureur Wafa
- `9-roadmap-execution.md` -- timeline + dependencies

---

## ETAT DU PROGRAMME (Mai 2026)

| Element | Statut |
|---------|--------|
| **35 sprints meta-prompts B-XX Option B v2.2** | **OK COMPLETS** (1355 ko / 461 taches) |
| INDEX.md / README.md / 8-master / 10-arborescence / 1-stack / 9-roadmap v2.2 | EN COURS Phase A |
| 35 orchestrateurs C-XX | A produire post Phase A |
| 35 verifications V-XX | A produire post Phase A |
| Audit V2.2 coherence | OK PRODUIT |
| 10 decisions strategiques | OK 10/10 (avec decision-010) |
| Prompts taches individuels (~470 fichiers) | A produire par Cowork (Sprint par sprint) |
| Code repo/ | A produire Sprint 1+ par Cowork |

---

## NEXT STEPS

**Phase A en cours** : alignement documentation racine v2.2 (14 actions P0).

**Apres Phase A complete** :
1. Phase B (8 actions P1)
2. Phase C (8 actions P2 -- optionnel)
3. Generation orchestrateurs C-XX (35 fichiers)
4. Generation verifications V-XX (35 fichiers)
5. Onboarding Cowork pour generation prompts taches individuels
6. Demarrage execution Sprint 1 (Bootstrap)

---

**Pour la documentation complete, voir `documentation/8-skalean-insurtech-prompt-master.md` v2.2.**

**Fin de l'INDEX.md v2.2.**
