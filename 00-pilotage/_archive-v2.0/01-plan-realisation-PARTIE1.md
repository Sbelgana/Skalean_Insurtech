# [DEPRECATED v2.0] -- 01-plan-realisation-PARTIE1.md

> **AVERTISSEMENT** : Ce document est **DEPRECATED** depuis le passage v2.0 -> v2.2.
> 
> Il reflette la structure ancienne **10 phases / 32 sprints v1.0** (puis 35 sprints v2.0 avec ajout 3 apps clientes).
> 
> La structure actuelle v2.2 est **7 phases / 35 sprints** (cf. decision-007 AI-defere + decision-010 Insure Connecteurs cascade).
> 
> **Source de verite v2.2** : les 35 fichiers `meta-prompts/phase-B-tasks/B-XX-sprint-XX-*.md` font autorite.
> 
> Voir aussi :
> - `INDEX.md` (navigation v2.2)
> - `documentation/8-skalean-insurtech-prompt-master.md` (document maitre v2.2)
> - `documentation/9-roadmap-execution.md` (ordre execution v2.2)
> - `decisions/010-insure-connecteurs-deferred.md` (cascade renumerotation)
> 
> **Ne PAS utiliser pour generation prompts taches** -- utiliser meta-prompts B-XX a la place.
> 
> Conserve ici pour reference historique uniquement (Phase A audit).

---

# PLAN DE REALISATION skalean-insurtech

## Programme complet -- 10 phases, 32 sprints, ~480 taches

**Date** : Mai 2026
**Projet** : skalean-insurtech (depot Git independant)
**Statut** : Plan operationnel pret a executer
**Prerequis externe** : Skalean AI accessible via API et MCP (les 3 modules : Automate, Chat, Agents)

---

## 1. CONTEXTE STRATEGIQUE

`skalean-insurtech` est un projet entierement nouveau, construit from scratch, avec son propre depot Git, son propre monorepo, sa propre base de donnees, son propre systeme d'authentification multi-tenant, son propre billing. Il est conceptuellement filiale de l'ecosysteme Skalean mais techniquement autonome.

### Composition du projet

Le projet livre trois produits SaaS interconnectes :

1. **Skalean Broker** : SaaS de courtage digital multi-assureurs au Maroc
2. **Skalean Garage** : SaaS de gestion sinistres pour garages agrees au Maroc
3. **Skalean InsurTech Admin** : Dashboard d'administration pour gerer les clients courtiers et garagistes, leurs reports, leurs KPIs, et la gestion commerciale globale

Plus deux dashboards verticaux dedies au sein de Broker et Garage :

4. **Broker Admin Dashboard** : KPIs et pilotage pour les courtiers (interne au SaaS Broker)
5. **Garage Admin Dashboard** : KPIs et pilotage pour les garagistes (interne au SaaS Garage)

### Frontiere avec Skalean AI

Skalean AI est consomme exclusivement comme service externe via les trois modules existants :

- **Automate** : workflows et automatisation (n8n etendu de Skalean AI)
- **Chat** : LLMs multi-providers, agent Sky en Darija/Francais/Arabe classique, RAG, vector stores
- **Agents** : agents IA configurables pour scoring, recommandation, anti-fraude, analyse photos

Aucun code IA, aucun LLM, aucun vector store, aucun MCP n'est duplique dans skalean-insurtech. Tous les besoins IA passent par appels HTTP/MCP vers Skalean AI. Cette frontiere est stricte : si un sprint InsurTech a besoin d'IA, il consomme Skalean AI ou il ne fait pas le travail.

### Reconstruction infrastructure

Tout le reste est construit dans skalean-insurtech :

- Monorepo pnpm + Turborepo
- Authentification, multi-tenant, RBAC
- Base de donnees PostgreSQL + Redis
- Event bus Kafka
- Billing avec multi-passerelles paiement marocaines
- Compliance ACAPS automatisee
- Conformite loi 09-08 (CNDP) et loi 43-20 (signature electronique)
- Modules horizontaux (CRM, Booking, Comm, Docs, Pay, Books, Compliance, Analytics)
- Modules verticaux (Insure, Repair)
- 5 applications web (Broker, Garage, InsurTech Admin, Broker Admin, Garage Admin)
- App mobile PWA technicien (Garage)

---

## 2. PRINCIPES DIRECTEURS

### 2.1 Stack technique normee

Stack imposee, identique pour tous les sprints :

- **Monorepo** : pnpm 9.15.0 + Turborepo 2.4.0 (jamais npm ni yarn)
- **Runtime** : Node.js 22.20.0 LTS, TypeScript 5.7.3 strict mode
- **Backend** : NestJS 10.4.x
- **Frontend** : Next.js 15 + React 19 + shadcn/ui + Tailwind 4
- **Base de donnees** : PostgreSQL 16 + TypeORM 0.3.x
- **Cache** : Redis 7.4
- **Event bus** : Kafka 3.7
- **Validation** : Zod 3.23 (jamais class-validator)
- **Logger** : Pino 9.x via `this.logger` (jamais console.log)
- **Hash** : argon2id (jamais bcrypt)
- **Tests** : Vitest 2.x + Playwright 1.48 (E2E)
- **State front** : Zustand + TanStack Query 5
- **Real-time** : Socket.io 4.8
- **Documentation UI** : Storybook 8
- **Observabilite** : Sentry + Pino + Grafana
- **CI/CD** : GitHub Actions
- **Conteneurisation** : Docker + Kubernetes
- **Cloud** : Provider hebergement Maroc (conformite loi 09-08 CNDP)

### 2.2 Regles absolues skalean-insurtech

Ces regles sont strictement appliquees dans CHAQUE tache, sans exception :

- **Multi-tenant** : chaque query DB filtre par `tenant_id`, header `x-tenant-id` obligatoire sur tout endpoint authentifie
- **Validation** : Zod uniquement, jamais class-validator
- **Logger** : Pino via `this.logger`, jamais console.log, jamais new Logger()
- **Events** : Kafka sur topics `insurtech.events.*` pour chaque action metier
- **RBAC** : decorateurs `@Roles()` + `RolesGuard` + `TenantGuard` sur chaque endpoint
- **Tests** : Vitest, chaque fichier `.ts` a son `.spec.ts` correspondant
- **Types** : TypeScript strict, aucun `any` implicite, aucun `any` explicite sans justification
- **Hash** : argon2id, jamais bcrypt
- **Package manager** : pnpm uniquement
- **Imports internes** : `@insurtech/shared-*` pour les packages partages
- **Aucune emoji** : dans le code, les commentaires, les logs, les messages de commit, les fichiers documentation

### 2.3 Regles specifiques InsurTech Maroc

- **Audit ACAPS** : chaque ecriture sur tables `insure_*`, `repair_*`, `pay_*` declenche une entree dans `compliance_acaps_audits`
- **Donnees Maroc** : aucune donnee assure, police, sinistre, paiement ne transite hors datacenter Maroc
- **Multilinguisme** : toute communication assure (notifications, emails, WhatsApp) supporte FR, Darija, Arabe classique
- **Anti-fraude** : interfaces acceptant montants ou photos passent par scoring statistique
- **Conformite loi 43-20** : signatures electroniques utilisent uniquement le module `docs-signature-ma` avec tiers de confiance certifie
- **Conformite loi 09-08** : consentement explicite RGPD-CNDP obligatoire, procedures de purge sur demande
- **Multi-passerelles paiement** : aucune dependance unique a une passerelle. Orchestration de 6 passerelles avec fallback automatique

### 2.4 Service Skalean AI -- contrat de consommation

Skalean AI est appele via deux mecanismes :

**1. API REST classique** pour les operations synchrones simples :
- POST `/skalean-ai/chat/completions` -- LLM multi-provider (Sky, GPT-4, Claude)
- POST `/skalean-ai/agents/{agent_id}/invoke` -- agent IA configure (scoring, anti-fraude)
- POST `/skalean-ai/automate/{workflow_id}/trigger` -- declencher un workflow n8n

**2. MCP** pour les operations long-running ou interactives :
- Connexion MCP au serveur Skalean AI exposant outils (tools), ressources (resources), prompts
- Utilise pour : analyse photos longue, conversations multi-tour, generation de documents structures

L'authentification utilise un token API specifique a skalean-insurtech, signe par Skalean AI. Le token est rotable et rate-limite. Les latences cibles sont : LLM chat < 3s, agent IA < 5s, workflow Automate < 30s, MCP analyse photos < 60s.

---

## 3. ARCHITECTURE TECHNIQUE skalean-insurtech

### 3.1 Structure du monorepo

Le depot `skalean-insurtech` est organise selon la structure suivante :

```
skalean-insurtech/                          # Racine monorepo (depot GitHub independant)
  .nvmrc                                    # Node 22.20.0
  .node-version
  .npmrc                                    # Configuration pnpm
  .gitignore
  .gitattributes                            # LF obligatoire
  package.json                              # Racine workspaces
  pnpm-workspace.yaml
  turbo.json
  README.md
  apps/
    api/                                    # API NestJS principale
      package.json                          # @insurtech/api
    web-broker/                             # SaaS courtiers
      package.json                          # @insurtech/web-broker
    web-garage/                             # SaaS garages
      package.json                          # @insurtech/web-garage
    web-garage-mobile/                      # PWA technicien Garage
      package.json                          # @insurtech/web-garage-mobile
    web-insurtech-admin/                    # Admin Skalean InsurTech
      package.json                          # @insurtech/web-insurtech-admin
  packages/
    shared-types/                           # Types TS partages
      package.json                          # @insurtech/shared-types
    shared-config/                          # Lecture .env, validation Zod
      package.json                          # @insurtech/shared-config
    shared-utils/                           # Utilitaires (hash, formatage, dates)
      package.json                          # @insurtech/shared-utils
    shared-events/                          # Schemas et publishers Kafka
      package.json                          # @insurtech/shared-events
    shared-ui/                              # Components shadcn/ui partages
      package.json                          # @insurtech/shared-ui
    shared-skalean-ai-client/               # Client Skalean AI (API + MCP)
      package.json                          # @insurtech/shared-skalean-ai-client
    database/                               # TypeORM entities, migrations
      package.json                          # @insurtech/database
    auth/                                   # Auth multi-tenant + RBAC
      package.json                          # @insurtech/auth
    horizontal-crm/                         # Module CRM
      package.json                          # @insurtech/horizontal-crm
    horizontal-booking/                     # Module Booking
      package.json                          # @insurtech/horizontal-booking
    horizontal-comm-wa/                     # Module WhatsApp Business
      package.json                          # @insurtech/horizontal-comm-wa
    horizontal-comm-email/                  # Module email transactionnel
      package.json                          # @insurtech/horizontal-comm-email
    horizontal-docs-signature-ma/           # Signature loi 43-20
      package.json                          # @insurtech/horizontal-docs-signature-ma
    horizontal-pay-ma/                      # Multi-passerelles paiement MA
      package.json                          # @insurtech/horizontal-pay-ma
    horizontal-books/                       # Comptabilite legere MA
      package.json                          # @insurtech/horizontal-books
    horizontal-compliance-acaps/            # Conformite ACAPS
      package.json                          # @insurtech/horizontal-compliance-acaps
    horizontal-analytics/                   # Reporting et BI
      package.json                          # @insurtech/horizontal-analytics
    horizontal-stock-parts/                 # Gestion pieces detachees
      package.json                          # @insurtech/horizontal-stock-parts
    horizontal-hr-techniciens/              # Gestion equipe atelier
      package.json                          # @insurtech/horizontal-hr-techniciens
    vertical-insure/                        # Vertical assurance
      package.json                          # @insurtech/vertical-insure
    vertical-repair/                        # Vertical reparation
      package.json                          # @insurtech/vertical-repair
  infrastructure/
    docker/                                 # Dockerfiles, docker-compose
    k8s/                                    # Manifests Kubernetes
    terraform/                              # Provisionnement cloud
    scripts/                                # Scripts ops, migrations, seeds
  prompts/                                  # Prompts pour Claude Code
    sprints/                                # Prompts complets et orchestrateurs
    tasks/                                  # Prompts taches individuelles
    verifications/                          # Verifications automatiques
  docs/                                     # Documentation technique et metier
```

### 3.2 Conventions de nommage

**Packages** :
- `@insurtech/shared-<nom>` pour les utilitaires transversaux
- `@insurtech/horizontal-<nom>` ou `@insurtech/horizontal-<nom>-ma` pour les modules horizontaux
- `@insurtech/vertical-<nom>` pour les modules verticaux
- `@insurtech/web-<nom>` pour les apps Next.js
- `@insurtech/api` pour l'API NestJS principale

**Tables PostgreSQL** :
- `<module>_<entite>` (ex : `insure_polices`, `repair_sinistres`, `pay_transactions`)
- Tables systeme : `auth_users`, `auth_tenants`, `auth_roles`, `compliance_acaps_audits`

**Topics Kafka** :
- `insurtech.events.<vertical>.<entite>.<action>` (ex : `insurtech.events.insure.police.created`)
- `insurtech.events.system.<action>` pour les events systeme (ex : `insurtech.events.system.tenant.created`)

**Endpoints API** :
- REST : `/api/v1/<module>/<resource>` (ex : `/api/v1/insure/polices`)
- WebSocket : `/ws/<module>` (ex : `/ws/insure`)

**Variables d'environnement** :
- Prefixe `INSURTECH_` pour les variables specifiques au projet
- Prefixe `SKALEAN_AI_` pour les variables de connexion au service externe

### 3.3 Multi-tenant en 3 niveaux

Le systeme multi-tenant skalean-insurtech a trois niveaux hierarchiques :

- **Niveau 0 -- Plateforme** : Skalean InsurTech (administration globale)
- **Niveau 1 -- Client SaaS** : un cabinet de courtage OU un garage agree (un tenant client)
- **Niveau 2 -- Utilisateurs** : utilisateurs internes du cabinet ou garage (multi-utilisateur par tenant)

Plus une notion croisee :
- **Cross-tenant authorization** : un sinistre qui implique un courtier (tenant A) ET un garage (tenant B) utilise un mecanisme d'autorisation cross-tenant introduit en Phase 7.

Chaque requete authentifiee porte le header `x-tenant-id` qui identifie le tenant client niveau 1. Le `TenantGuard` valide la coherence entre le tenant du token JWT et le tenant du header. Les utilisateurs niveau 2 heritent du tenant_id de leur tenant parent.

### 3.4 Numerotation X.Y.Z

Toute la numerotation du projet suit le pattern strict :

- **X** = Phase (1 a 10)
- **Y** = Sprint dans la phase (1, 2, 3, ...)
- **Z** = Tache dans le sprint (1, 2, 3, ...)

Exemples :
- `1.1.1` = premiere tache du premier sprint de la Phase 1 (Infrastructure)
- `4.3.7` = septieme tache du troisieme sprint de la Phase 4 (Modules horizontaux)
- `10.1.5` = cinquieme tache du seul sprint de la Phase 10 (Pilote Marrakech)

Les fichiers prompts utilisent ce pattern dans leur nom :
- `task-X.Y.Z-prompt.md`
- `sprint-{cumul}-prompt-complet.md` ou `{cumul}` est le numero cumule absolu (1 a 32)
- `verify-sprint-{cumul}.md`
- `orchestrateur-sprint-{cumul}.md`

Le numero cumule absolu permet de classer les sprints par ordre temporel : Sprint 1 = 1.1, Sprint 2 = 1.2, ..., Sprint 5 = 2.1, Sprint 8 = 3.1, etc.

---

## 4. PHASE 1 -- INFRASTRUCTURE ET FONDATIONS (4 SPRINTS)

**Objectif phase** : Etablir le squelette du monorepo, la base de donnees, l'event bus, l'observabilite, et la chaine CI/CD. Aucune logique metier dans cette phase.

**Pourquoi en premiere position** : sans monorepo configure, sans DB operationnelle, sans event bus, sans CI, aucune autre phase ne peut demarrer.

**Prerequis externes** : depot GitHub cree, comptes cloud provisionnes, comptes Sentry / Grafana actifs.

**Cumul sprints** : Sprints 1 a 4.

### Sprint 1.1 (cumul 1) -- Bootstrap monorepo et CI

**Objectif sprint** : Initialiser le monorepo pnpm + Turborepo, configurer les outils de qualite, mettre en place le pipeline CI minimal.

**Taches** (12) :

- 1.1.1 Initialisation monorepo pnpm + Turborepo (structure, package.json racine, pnpm-workspace.yaml, turbo.json)
- 1.1.2 Configuration TypeScript strict partagee (tsconfig.base.json + tsconfig per package)
- 1.1.3 Configuration ESLint + Prettier partagee
- 1.1.4 Configuration Vitest globale + utilities
- 1.1.5 Husky + lint-staged + commitlint (Conventional Commits)
- 1.1.6 Package `@insurtech/shared-types` initial avec types primitifs
- 1.1.7 Package `@insurtech/shared-config` avec lecture .env Zod-validee
- 1.1.8 Package `@insurtech/shared-utils` avec utilitaires de base
- 1.1.9 Pipeline GitHub Actions CI : lint + tests + build
- 1.1.10 Documentation README.md projet + CONTRIBUTING.md
- 1.1.11 Configuration .gitattributes (LF) et .gitignore complet
- 1.1.12 Tests fumee : tous les packages compilent et leurs tests passent

**Pourquoi cet ordre** : on ne peut pas configurer ESLint avant pnpm (1.1.3 apres 1.1.1). On ne peut pas faire la CI avant d'avoir des packages a tester (1.1.9 apres 1.1.6-1.1.8).

### Sprint 1.2 (cumul 2) -- Base de donnees et event bus

**Objectif sprint** : Provisionner PostgreSQL, Redis, Kafka. Mettre en place TypeORM avec migrations.

**Taches** (13) :

- 1.2.1 Docker Compose dev : PostgreSQL 16, Redis 7.4, Kafka 3.7, Zookeeper
- 1.2.2 Package `@insurtech/database` avec TypeORM 0.3 configure
- 1.2.3 Convention migrations : timestamp + nom + reversible
- 1.2.4 Migration initiale : schema `auth_*` (tenants, users, roles, sessions)
- 1.2.5 Package `@insurtech/shared-events` avec schemas Zod des events
- 1.2.6 Service Kafka publisher generique (`KafkaPublisher`)
- 1.2.7 Service Kafka consumer generique (`KafkaConsumer`) avec retry et DLQ
- 1.2.8 Service Redis cache generique avec TTL et invalidation
- 1.2.9 Health checks : DB, Redis, Kafka exposes via `/health`
- 1.2.10 Seeds dev : tenant Skalean Admin + super admin user
- 1.2.11 Tests integration TypeORM (transactionalisation des tests)
- 1.2.12 Tests integration Kafka (avec ephemere broker test)
- 1.2.13 Documentation operations : restore DB, replay events Kafka

**Pourquoi cet ordre** : on ne peut pas faire de migrations avant TypeORM (1.2.4 apres 1.2.2). Les services Kafka generiques (1.2.6, 1.2.7) viennent avant les seeds qui en dependent (1.2.10).

### Sprint 1.3 (cumul 3) -- API NestJS et observabilite

**Objectif sprint** : Bootstrap de l'application API NestJS avec logger Pino, Sentry, et endpoints de base.

**Taches** (12) :

- 1.3.1 Initialisation app `@insurtech/api` (NestJS 10.4, structure modulaire)
- 1.3.2 Configuration Pino logger global avec contexte structurel (tenant_id, request_id, user_id)
- 1.3.3 Integration Sentry pour erreurs non-catchees + traces APM
- 1.3.4 Middleware request-id (correlation ID transverse)
- 1.3.5 Filter d'exceptions global avec mapping vers reponses HTTP normalisees
- 1.3.6 Pipe de validation Zod global
- 1.3.7 Interceptor de logging des requetes/reponses (avec redaction des champs sensibles)
- 1.3.8 Configuration Swagger / OpenAPI documentation auto
- 1.3.9 Endpoint `/health` (readiness + liveness)
- 1.3.10 Endpoint `/metrics` (Prometheus format pour Grafana)
- 1.3.11 Tests E2E API : healthcheck, validation, gestion erreurs
- 1.3.12 Documentation API : README.md de l'app api + comment lancer en local

**Pourquoi cet ordre** : NestJS bootstrap (1.3.1) avant tout le reste. Logger (1.3.2) avant Sentry (1.3.3) parce que Sentry log via Pino. Pipes/Interceptors (1.3.6, 1.3.7) avant Swagger (1.3.8) parce que Swagger documente les pipes.

### Sprint 1.4 (cumul 4) -- Frontend bootstrap et UI Kit

**Objectif sprint** : Initialiser les 5 apps Next.js + le package shared-ui avec Storybook.

**Taches** (14) :

- 1.4.1 Initialisation app `@insurtech/web-broker` (Next.js 15 + App Router + TypeScript)
- 1.4.2 Initialisation app `@insurtech/web-garage`
- 1.4.3 Initialisation app `@insurtech/web-garage-mobile` (PWA configuree)
- 1.4.4 Initialisation app `@insurtech/web-insurtech-admin`
- 1.4.5 Package `@insurtech/shared-ui` avec shadcn/ui + Tailwind 4
- 1.4.6 Theme partage : couleurs (orange E95D2C, navy 1A2730, sky B0CEE2, acaps 2D5773), typographie Montserrat
- 1.4.7 Components primitifs partages : Button, Input, Select, Modal, DataTable
- 1.4.8 Layout partage AppShell avec sidebar + header + breadcrumbs
- 1.4.9 Storybook 8 configure avec tous les composants documentes
- 1.4.10 Package `@insurtech/shared-skalean-ai-client` initial (squelette client API et MCP)
- 1.4.11 i18n setup pour FR + Darija (ar-MA) + Arabe classique (ar)
- 1.4.12 RTL support pour Arabe (mirroring layout)
- 1.4.13 Tests visuels (Chromatic ou equivalent) sur les composants Storybook
- 1.4.14 Tests E2E Playwright basiques sur chaque app (navigation, page d'accueil)

**Pourquoi cet ordre** : shared-ui (1.4.5) avant les composants (1.4.7) qui en dependent. Theme (1.4.6) avant components (1.4.7). i18n (1.4.11) avant RTL (1.4.12). Storybook (1.4.9) apres composants (1.4.7).

**Verification fin Phase 1** : Le monorepo compile entierement, les CI passent au vert, les 5 apps demarrent en local, la base de donnees est seedee, Kafka publish/consume fonctionne, Sentry recoit les erreurs test. Score requis : 95% PASS.

---

(Suite : Phases 2 a 4 dans la partie 1bis, Phases 5 a 7 dans la partie 2, Phases 8 a 10 dans la partie 3)
