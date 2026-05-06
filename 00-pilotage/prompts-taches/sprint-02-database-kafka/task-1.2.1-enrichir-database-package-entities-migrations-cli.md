# Task 1.2.1 -- Enrichir @insurtech/database -- entities + migrations infrastructure + scripts CLI

## 1. Header metadata

| Champ | Valeur |
|-------|--------|
| Identifiant tache | 1.2.1 |
| Titre complet | Enrichir le package @insurtech/database avec la structure entities (par module fonctionnel), le pattern abstrait BaseEntity / AuditableEntity, les helpers withTenantContext et withSuperAdmin, les scripts CLI TypeORM (migrations + seeds) et la cli-data-source dediee |
| Sprint | Sprint 2 (Database + Kafka + Storage + Email + SMS infrastructure) |
| Reference backlog | B-02 (Sprint 2 backlog technique consolide) |
| Phase programme | Phase 1 (Infrastructure socle) |
| Position dans sprint | 1 |
| Position cumulee programme | 2 |
| Priorite | P0 (bloquant tout developpement Sprint 2 et suivants) |
| Effort estime | 6 heures |
| Effort facteur risque | x1.15 (decorators TypeORM 0.3 et CLI ts-node) |
| Effort effectif estime | 6h54 |
| Densite prompt cible | 125 ko (entre 100 et 150 ko) |
| Dependances amont | Sprint 1 -- DataSource brut (data-source.ts cree), helpers Postgres RLS (set-rls-context.sql cree), package @insurtech/database initialise |
| Dependances avales | 1.2.2 (premiere migration tenants), 1.2.3 (TenantEntity), 1.2.9 (subscribers audit), 1.2.10 (seeds), toutes les taches utilisant withTenantContext (90+ taches) |
| Decisions architecturales liees | decision-003 (multi-tenant 3 niveaux), decision-002 (Postgres RLS strict), decision-008 (data residency Atlas Cloud Services Benguerir), decision-005 (Skalean AI frontier nomenclature), decision-006 (no-emoji absolu) |
| Conformite legale impactee | Loi 09-08 CNDP (data residency), Loi 9-88 CGNC (audit trail), Loi 17-95 (societes anonymes), Loi 31-08 (consommateur), Code des assurances 17-99 |
| Convention emoji | AUCUNE EMOJI dans tout le code, tous les commentaires, tous les commits, tous les logs, toutes les variables. Grep no-emoji obligatoire en pre-commit. |
| Logger | Pino structured JSON logging exclusivement (winston interdit par convention skalean-insurtech) |
| Hashing | argon2id pour mots de passe (jamais bcrypt, jamais sha256 plain) |
| Validation runtime | Zod pour tous les boundaries IO (jamais Joi, jamais yup) |
| Module manager | pnpm strict (npm et yarn interdits) |
| TypeScript | mode strict total (strict: true, noImplicitAny, strictNullChecks, noUncheckedIndexedAccess) |
| Test runner | Vitest (jest interdit) |
| Format commits | Conventional Commits avec metadata Task/Sprint/Phase obligatoire |

## 2. But

### 2.1 But fonctionnel

Le but fonctionnel de cette tache est de poser les fondations structurelles du package partage `@insurtech/database` pour qu'il puisse heberger l'ensemble des entites TypeORM du programme Skalean InsurTech. Le programme est decoupe en 9 modules fonctionnels metier (system, crm, booking, comm, docs, pay, books, compliance, analytics) auxquels correspondront a terme entre 80 et 110 entites. Cette tache 1.2.1 ne cree aucune entite metier mais fournit le squelette dans lequel toutes les entites des taches futures viendront se ranger : un dossier par module, un point d'entree d'index, un pattern abstrait `BaseEntity` que toutes les entites etendront pour heriter automatiquement des colonnes communes (id, tenant_id, created_at, updated_at, deleted_at), et un pattern `AuditableEntity` qui ajoute en plus created_by et updated_by pour les entites soumises a tracabilite forte (utilisateurs, contrats, paiements, sinistres).

### 2.2 But technique

Le but technique est triple. Premierement, fournir une infrastructure de migrations TypeORM 0.3.20 fonctionnelle avec scripts CLI pnpm executables (`pnpm migration:create`, `pnpm migration:generate`, `pnpm migration:run`, `pnpm migration:revert`, `pnpm migration:show`) qui s'appuient sur une `cli-data-source.ts` distincte de la `data-source.ts` runtime (la CLI charge les entites en TypeScript via glob ts, le runtime applicatif charge les entites compilees en JavaScript via dist). Deuxiemement, fournir deux helpers transactionnels critiques pour la securite multi-tenant : `withTenantContext(dataSource, ctx, callback)` qui ouvre une transaction, execute `SET LOCAL app.current_tenant_id`, `SET LOCAL app.is_super_admin`, `SET LOCAL app.current_user_id`, `SET LOCAL app.assure_user_id` puis appelle le callback avec un `EntityManager` tenant-scoped, et `withSuperAdmin(dataSource, callback)` qui execute le callback en mode super admin (RLS bypass controle). Troisiemement, garantir que le package se compile via `tsup` sans erreur TypeScript stricte et est consommable depuis tous les autres packages du monorepo via `import { BaseEntity, AuditableEntity, withTenantContext, withSuperAdmin } from '@insurtech/database'`.

### 2.3 But de qualite

Le but de qualite est de produire un package qui sera importe par environ 30 packages applicatifs et 90 taches de developpement futures. Toute regression dans `BaseEntity` ou dans `withTenantContext` casserait des dizaines de modules. La tache 1.2.1 doit donc livrer un code defensif (validation des inputs `ctx`, gestion du cas `tenantId` null pour super admin, propagation correcte des erreurs hors transaction, liberation systematique du `queryRunner` via `try/finally`), accompagne d'une suite de tests Vitest exhaustive (au moins 12 tests unitaires `withTenantContext`, 5 tests `withSuperAdmin`, 5 tests integration `BaseEntity` sur Postgres reel, 5 tests verifiant la structure des dossiers et la presence des index.ts). Le coverage cible des helpers est 100% lignes et 95% branches. Le code doit etre 100% TypeScript strict, sans `any` non justifie, sans `// @ts-ignore`, sans `console.log`, sans emoji, sans TODO.

## 3. Contexte etendu

### 3.1 Pourquoi cette tache existe

Le programme Skalean InsurTech construit un SaaS multi-tenant a 3 niveaux d'isolement (super admin global, tenant courtier, assure final) deploye sur Atlas Cloud Services a Benguerir au Maroc en conformite avec la loi 09-08 sur la protection des donnees personnelles. La couche de persistance est Postgres 16 avec Row-Level Security strict active sur toutes les tables metier. Le mecanisme RLS depend de variables de session Postgres (`app.current_tenant_id`, `app.is_super_admin`, `app.current_user_id`, `app.assure_user_id`) qui doivent etre positionnees AVANT chaque requete metier. TypeORM 0.3.20 ne fournit pas nativement ce mecanisme. Il faut donc construire un wrapper transactionnel qui garantit que les variables sont posees avec `SET LOCAL` (donc transaction-scoped, donc auto-revoquees en fin de transaction) et que le callback metier execute ses requetes via l'`EntityManager` retourne par la transaction.

Sans cette tache, aucune requete metier ne peut etre executee de facon securisee. Toute tache de developpement metier qui creerait une entite ou une migration sans cette infrastructure violerait le principe d'isolation tenant et exposerait Skalean a une non-conformite CNDP majeure (sanctions jusqu'a 300 000 MAD selon article 51 de la loi 09-08, plus la responsabilite civile et penale du dirigeant). La tache 1.2.1 est donc un prerequis non-negociable de tout le programme.

### 3.2 Alternatives etudiees

| Alternative | Description | Avantages | Inconvenients | Decision |
|-------------|-------------|-----------|---------------|----------|
| A. TypeORM avec helper transactionnel maison (retenu) | Wrapper `withTenantContext` qui ouvre transaction + SET LOCAL + appelle callback avec EntityManager scoped | Compatible TypeORM ecosysteme, code explicite, tests faciles, RLS Postgres-native conserve, performance native | Necessite discipline d'usage, tout dev doit passer par le helper | RETENU -- aligne avec decision-002 RLS Postgres et decision-003 multi-tenant 3 niveaux |
| B. Prisma avec middleware tenant | Remplacer TypeORM par Prisma, utiliser middleware Prisma pour injecter where tenant_id | DSL declaratif, generateur types automatique, ecosysteme moderne | Migration depuis TypeORM Sprint 1 = perte 1 sprint, pas de support natif RLS Postgres SET LOCAL, requeterait refonte massive | REJETE -- cout migration Sprint 1 prohibitif |
| C. Sequelize avec hooks beforeFind | Utiliser Sequelize avec hook beforeFind qui injecte tenant_id | Plus mature pour multi-tenant naif | Pas de support RLS Postgres natif, pas de migrations declaratives, types TypeScript faibles | REJETE -- types TypeScript insuffisants pour Skalean AI frontier |
| D. Knex.js raw avec Repository maison | Utiliser Knex pour query building et coder des Repository custom | Tres flexible, controle total | Effort de developpement x3, pas de generation auto migrations entites, perte productivite | REJETE -- effort Sprint disproportionne |
| E. MikroORM avec RequestContext | Utiliser MikroORM qui a RequestContext natif via AsyncLocalStorage | RequestContext natif elegant | Ecosysteme plus petit, moins de dev formes, migration Sprint 1 = perte 1 sprint | REJETE -- ecosysteme moins mature au Maroc |

### 3.3 Trade-offs accepte

Le choix TypeORM + helper transactionnel maison implique trois trade-offs explicites. Le premier est la discipline obligatoire : chaque service applicatif doit imperativement appeler `withTenantContext` ou `withSuperAdmin` avant tout acces base. Cela sera audite par un linter custom dans la tache 9.x.x du Sprint 9 et par un test integration qui detecte tout `dataSource.getRepository(...)` direct hors helpers (test fail si match). Le second trade-off est l'overhead transactionnel : chaque appel ouvre une transaction explicite meme pour une simple lecture, ce qui ajoute un round-trip BEGIN/COMMIT. Pour une charge lue Skalean attendue de 200 RPS au Sprint 32, cela reste largement absorbable par Postgres 16 sur Atlas (pool 20 connections, BEGIN/COMMIT < 0.5 ms). Le troisieme trade-off est la complexite des tests : il faut mock l'`EntityManager` pour les tests unitaires des services et utiliser un Postgres reel pour les tests d'integration des helpers, doublant la surface de tests. C'est accepte car la securite multi-tenant est P0 absolu.

### 3.4 Decisions architecturales referencees

La tache 1.2.1 implemente concretement trois decisions architecturales du dossier `decisions-architecturales/`. La decision-003 (multi-tenant 3 niveaux) impose que toute entite metier porte une colonne `tenant_id UUID NOT NULL` et que les requetes soient scopees via session variables. Cela se materialise dans `BaseEntity.tenant_id`. La decision-002 (Postgres RLS strict) impose que la securite ne repose pas sur les filtres applicatifs (souvent oublies) mais sur des policies Postgres `USING (tenant_id = current_setting('app.current_tenant_id')::uuid)`. Cela impose le pattern `SET LOCAL` du helper. La decision-008 (data residency Atlas Cloud Services Benguerir) impose que toutes les connections Postgres soient sur Atlas Cloud Services (Marocain) avec replication intra-Maroc et qu'aucun export hors Maroc ne soit possible sans accord CNDP. Cela impose que la `data-source.ts` charge `DATABASE_HOST` depuis `.env` qui pointe sur `pg-primary.atlas.skalean.ma` (placeholder).

### 3.5 Pieges techniques connus

#### Piege 1 -- Decorators TypeORM 0.3 vs 0.2

Probleme : TypeORM 0.3 a casse retro-compatibilite des decorators de relations (`@OneToMany` exige fonction lazy, `@ManyToOne` exige nullable explicite) et a introduit `DataSource` au lieu de `Connection`. Tout copier-coller depuis un projet TypeORM 0.2 explose.

Pourquoi : Migration majeure 0.2 -> 0.3 en mars 2022, breaking changes documentes.

Solution : Utiliser exclusivement la syntaxe 0.3 dans tous les decorators. Pour `@PrimaryGeneratedColumn('uuid')`, le type est `string` (pas `number`). Pour `@Column({ type: 'uuid' })`, importer le type explicite. Verifier import depuis `typeorm` racine et non depuis sub-paths.

#### Piege 2 -- gen_random_uuid() necessite extension pgcrypto

Probleme : La definition `@PrimaryGeneratedColumn('uuid')` genere un default `uuid_generate_v4()` qui exige l'extension `uuid-ossp`. Si on prefere `gen_random_uuid()` (plus moderne, integre Postgres 13+), il faut activer `pgcrypto` ou utiliser `pg-ext` natif Postgres 13+.

Pourquoi : Atlas Cloud Services Postgres 16 supporte les deux mais aucune n'est active par defaut sur une nouvelle DB.

Solution : Premiere migration Sprint 2 (tache 1.2.2) executera `CREATE EXTENSION IF NOT EXISTS pgcrypto`. Configurer `BaseEntity.id` avec `@PrimaryGeneratedColumn('uuid')` qui delegue a TypeORM la generation cote pilote ou bien utiliser `@Column({ type: 'uuid', default: () => 'gen_random_uuid()' })` pour deleguer a Postgres. Decision retenue : `@PrimaryGeneratedColumn('uuid')` (TypeORM gere, robuste).

#### Piege 3 -- SET LOCAL hors transaction = silently no-op

Probleme : `SET LOCAL` n'est valide qu'a l'interieur d'une transaction. Hors transaction, Postgres l'ignore SILENCIEUSEMENT et la session variable reste a sa valeur par defaut (vide). Une fonction `withTenantContext` qui executerait `SET LOCAL` sur le `DataSource` racine sans `transaction()` serait une faille de securite.

Pourquoi : Comportement Postgres documente, `SET LOCAL` requiert `BEGIN`.

Solution : `withTenantContext` ouvre IMPERATIVEMENT une transaction via `dataSource.transaction(async (manager) => { await manager.query("SET LOCAL ..."); ... })`. Aucun appel `SET LOCAL` hors `transaction()`. Test unitaire dedie qui verifie que la fonction throw si on simule un EntityManager hors transaction (impossible avec API TypeORM mais defense en profondeur).

#### Piege 4 -- queryRunner non libere = pool exhaustion

Probleme : Si le helper utilise un `queryRunner` manuel via `dataSource.createQueryRunner()` sans appeler `queryRunner.release()` dans un `finally`, chaque appel consomme une connection du pool et le pool de 20 connexions s'epuise sous charge.

Pourquoi : `createQueryRunner` reserve une connection physique du pool.

Solution : Utiliser de preference l'API haut niveau `dataSource.transaction(callback)` qui gere automatiquement BEGIN/COMMIT/ROLLBACK et liberation. Si `queryRunner` manuel necessaire (cas avance), wrapper dans `try { ... } finally { await queryRunner.release(); }`. Test charge avec 100 appels concurrents `withTenantContext` doit montrer que le pool ne grimpe pas au dela de la limite.

#### Piege 5 -- tenant_id = NULL pour super admin avec colonne NOT NULL

Probleme : La super admin n'a pas de tenant. Si `BaseEntity.tenant_id` est `NOT NULL`, comment representer une entite globale (config systeme, table currencies par exemple) ?

Pourquoi : Conflit entre exigence d'isolation forte (tenant_id NOT NULL) et besoin de tables globales.

Solution : Decision -- toutes les entites metier (CRM, Booking, Comm, Docs, Pay, Books, Compliance, Analytics) ont `tenant_id NOT NULL` heritee de `BaseEntity`. Les entites systeme (super admin, registry tenants, currencies, countries, regions Maroc) heritent d'une `BaseSystemEntity` SANS `tenant_id` (ou avec `tenant_id = NULL`) et leur table n'a PAS de RLS policy. Le helper `withSuperAdmin` est utilise pour ces tables. Ce decoupage est implemente Sprint 2 et ses suivants.

#### Piege 6 -- migrations TypeScript vs JavaScript en production

Probleme : Si la `data-source.ts` runtime pointe sur `migrations: ['src/migrations/*.ts']`, le binaire de production qui ne contient que `dist/` ne trouve aucune migration. Si elle pointe sur `dist/migrations/*.js`, la CLI TypeScript ne trouve rien lors du `migration:generate`.

Pourquoi : ts-node ne tourne pas en production (overhead, securite, perf), donc seul le JS compile est dispo.

Solution : Deux DataSource separees. `src/data-source.ts` (runtime) charge `entities: ['dist/**/entities/**/*.entity.js']` et `migrations: ['dist/migrations/*.js']`. `src/cli-data-source.ts` (CLI uniquement) charge `entities: ['src/**/entities/**/*.entity.ts']` et `migrations: ['src/migrations/*.ts']` et est invoquee via `pnpm typeorm-ts-node-commonjs migration:run -d src/cli-data-source.ts`.

#### Piege 7 -- soft delete avec @DeleteDateColumn et RLS

Probleme : `@DeleteDateColumn` de TypeORM ajoute automatiquement un filtre `deleted_at IS NULL` aux SELECT. Mais la policy RLS Postgres ne le fait pas. Si une migration ulterieure execute un `SELECT * FROM users` en raw SQL sans `deleted_at IS NULL`, on retourne les softs-delete.

Pourquoi : RLS et soft delete sont deux mecanismes orthogonaux, l'un est Postgres-natif l'autre est applicatif TypeORM.

Solution : Toutes les requetes metier passent par TypeORM Repository qui applique automatiquement le filtre soft delete. Aucun raw SQL en code applicatif. Les rapports analytiques qui doivent voir les soft-delete utilisent `withDeleted: true` explicite. Les migrations qui touchent des donnees (data migrations) doivent expliciter `deleted_at IS NULL` ou `deleted_at IS NOT NULL` selon intention.

#### Piege 8 -- subscribers vide vs subscribers undefined

Probleme : La cli-data-source.ts qui specifie `subscribers: ['src/subscribers/*.ts']` echoue avec erreur `ENOENT no such file or directory` si le dossier `src/subscribers/` n'existe pas.

Pourquoi : Le glob TypeScript echoue si le dossier parent n'existe pas (selon la version de fast-glob/glob utilisee).

Solution : Creer le dossier `src/subscribers/` avec un fichier `.gitkeep` ou un `index.ts` vide qui re-exporte rien. Idem pour `src/migrations/`. La tache 1.2.9 viendra peupler `src/subscribers/` avec `audit-log.subscriber.ts`.

#### Piege 9 -- emojis dans noms de fichiers ou commentaires

Probleme : Convention skalean-insurtech (decision-006) interdit toute emoji partout. Si un developpeur copie-colle depuis Stack Overflow ou ChatGPT du code avec emojis dans commentaires, le pre-commit doit echouer.

Pourquoi : Convention de cleanliness, eviter parsing Unicode dans logs/grep, parite legale (administrations marocaines preferent ASCII).

Solution : Pre-commit hook `lefthook` ou `husky` execute `grep -rP "[\x{1F300}-\x{1FAFF}]|[\x{2600}-\x{27BF}]" src/ tests/ docs/` et echoue si match. Tache 1.2.1 doit etre 100% emoji-free et inclure ce hook.

#### Piege 10 -- import circulaire entities <-> helpers

Probleme : Si `withTenantContext` importe `BaseEntity` (par exemple pour typer le retour) et `BaseEntity` importe quelque chose de helpers, on cree un cycle qui fait planter `tsup` ou affiche des warnings ESM.

Pourquoi : Architecture monolithique mal segmentee.

Solution : Strict separation -- `helpers/` ne depend de rien de `entities/`. `entities/base/` ne depend de rien de `helpers/`. Les modules importent les deux mais separement. Le `src/index.ts` re-exporte les deux sans faire de pont. Test unitaire `madge` (graphe imports) detecte les cycles avec `pnpm madge --circular src/`.

## 4. Architecture context

### 4.1 Position dans le sprint 2

Le sprint 2 contient 27 taches reparties en 4 axes : Database (taches 1.2.1 a 1.2.16), Kafka (taches 1.3.1 a 1.3.5), Storage MinIO (taches 1.4.1 a 1.4.3), Email/SMS (taches 1.5.1 a 1.5.3). La tache 1.2.1 est la premiere du sprint et bloque toutes les autres taches Database. Sequence Database :

```
1.2.1 (cette tache) -- Squelette package, BaseEntity, helpers
   |
   +--> 1.2.2 -- Migration 001 init pgcrypto + extension Postgres
   |        |
   |        +--> 1.2.3 -- TenantEntity et migration 002 tenants
   |                  |
   |                  +--> 1.2.4 -- UserEntity et migration 003 users
   |                            |
   |                            +--> 1.2.5 -- RoleEntity, RBAC 12 roles
   |                                      |
   |                                      +--> ... (1.2.6 a 1.2.16)
```

### 4.2 Position dans le programme global

Le programme global Skalean InsurTech compte 32 sprints repartis en 8 phases. La phase 1 (Sprints 1-3) pose l'infrastructure. La tache 1.2.1 est la 2e tache cumulee du programme (apres 1.1.1 du sprint 1 qui a cree le monorepo). Toutes les phases ulterieures (Phase 2 CRM, Phase 3 Booking, Phase 4 Comm, Phase 5 Docs, Phase 6 Pay, Phase 7 Books, Phase 8 Compliance) utilisent intensivement les helpers crees ici. Toute regression dans `withTenantContext` impacte les 32 sprints.

### 4.3 Diagramme ASCII du package apres tache 1.2.1

```
packages/database/
|
+-- package.json                       (enrichi : deps TypeORM 0.3.20, pg 8.13.1, scripts CLI)
+-- tsconfig.json                      (heritage du root, strict, declaration: true)
+-- tsup.config.ts                     (existant Sprint 1, build dist/)
+-- vitest.config.ts                   (existant Sprint 1, test runner)
+-- .env.example                       (enrichi : 18 vars DATABASE_*, TYPEORM_*, ATLAS_*)
+-- README.md                          (existant Sprint 1, NON MODIFIE par 1.2.1)
|
+-- src/
|   |
|   +-- index.ts                       (enrichi : re-export entities/helpers/data-sources)
|   +-- data-source.ts                 (enrichi Sprint 1 -> ajout subscribers vide)
|   +-- cli-data-source.ts             (NOUVEAU : DataSource CLI ts-node)
|   |
|   +-- entities/
|   |   +-- base/
|   |   |   +-- base-entity.ts         (NOUVEAU : abstract class avec id/tenant/timestamps)
|   |   |   +-- auditable-entity.ts    (NOUVEAU : extends BaseEntity + created_by/updated_by)
|   |   |   +-- index.ts               (NOUVEAU : re-export base-entity et auditable-entity)
|   |   +-- system/                    (NOUVEAU dossier vide + index.ts)
|   |   +-- crm/                       (NOUVEAU dossier vide + index.ts)
|   |   +-- booking/                   (NOUVEAU dossier vide + index.ts)
|   |   +-- comm/                      (NOUVEAU dossier vide + index.ts)
|   |   +-- docs/                      (NOUVEAU dossier vide + index.ts)
|   |   +-- pay/                       (NOUVEAU dossier vide + index.ts)
|   |   +-- books/                     (NOUVEAU dossier vide + index.ts)
|   |   +-- compliance/                (NOUVEAU dossier vide + index.ts)
|   |   +-- analytics/                 (NOUVEAU dossier vide + index.ts)
|   |   +-- index.ts                   (NOUVEAU : re-export base + tous modules)
|   |
|   +-- helpers/
|   |   +-- with-tenant-context.ts     (NOUVEAU : transaction + SET LOCAL 4 vars)
|   |   +-- with-super-admin.ts        (NOUVEAU : transaction + SET LOCAL is_super_admin true)
|   |   +-- index.ts                   (NOUVEAU : re-export 2 helpers)
|   |
|   +-- migrations/                    (NOUVEAU dossier vide, peuple par 1.2.2+)
|   |   +-- .gitkeep                   (NOUVEAU : keep-empty marker)
|   |
|   +-- subscribers/                   (NOUVEAU dossier vide, peuple par 1.2.9)
|   |   +-- .gitkeep                   (NOUVEAU : keep-empty marker)
|   |
|   +-- types/
|       +-- tenant-context.ts          (NOUVEAU : interface TenantContext)
|       +-- index.ts                   (NOUVEAU : re-export types)
|
+-- tests/
    +-- unit/
    |   +-- with-tenant-context.test.ts  (NOUVEAU : 12+ tests)
    |   +-- with-super-admin.test.ts     (NOUVEAU : 5+ tests)
    |   +-- structure.test.ts            (NOUVEAU : 5+ tests structure dossiers)
    +-- integration/
        +-- base-entity.int.test.ts      (NOUVEAU : 5+ tests Postgres reel)
        +-- helpers-rls.int.test.ts      (NOUVEAU : tests RLS reel)
```

## 5. Livrables checkables

- [ ] L1 : Le fichier `packages/database/package.json` contient les dependances TypeORM `0.3.20`, `pg 8.13.1`, `reflect-metadata 0.2.2`, `typeorm-ts-node-commonjs` (en dev) et la section `scripts` enrichie avec les 7 scripts CLI (`build`, `migration:create`, `migration:generate`, `migration:run`, `migration:revert`, `migration:show`, `seeds:run`, `seeds:reset`, `typecheck`, `lint`, `test`).
- [ ] L2 : Le fichier `src/entities/base/base-entity.ts` existe et exporte une classe abstraite `BaseEntity` avec exactement 5 colonnes : `id` (uuid PK), `tenant_id` (uuid not null), `created_at` (timestamp default now), `updated_at` (timestamp default now on update), `deleted_at` (timestamp nullable, @DeleteDateColumn).
- [ ] L3 : Le fichier `src/entities/base/auditable-entity.ts` existe et exporte une classe abstraite `AuditableEntity extends BaseEntity` avec 2 colonnes additionnelles : `created_by` (uuid nullable, FK vers users plus tard), `updated_by` (uuid nullable, FK vers users plus tard).
- [ ] L4 : Le fichier `src/entities/base/index.ts` re-exporte explicitement `BaseEntity` et `AuditableEntity`.
- [ ] L5 : Les 9 dossiers modules `src/entities/system/`, `src/entities/crm/`, `src/entities/booking/`, `src/entities/comm/`, `src/entities/docs/`, `src/entities/pay/`, `src/entities/books/`, `src/entities/compliance/`, `src/entities/analytics/` existent et chacun contient un `index.ts` initial (export vide ou commentaire d'attente).
- [ ] L6 : Le fichier `src/entities/index.ts` re-exporte le contenu de `./base` et de chacun des 9 modules.
- [ ] L7 : Le fichier `src/helpers/with-tenant-context.ts` existe et exporte une fonction `withTenantContext<T>(dataSource: DataSource, ctx: TenantContext, callback: (manager: EntityManager) => Promise<T>): Promise<T>` qui utilise `dataSource.transaction()` et execute 4 `SET LOCAL` (current_tenant_id, is_super_admin, current_user_id, assure_user_id).
- [ ] L8 : Le fichier `src/helpers/with-super-admin.ts` existe et exporte une fonction `withSuperAdmin<T>(dataSource: DataSource, callback: (manager: EntityManager) => Promise<T>): Promise<T>` qui execute `SET LOCAL app.is_super_admin TO true`.
- [ ] L9 : Le fichier `src/helpers/index.ts` re-exporte `withTenantContext` et `withSuperAdmin`.
- [ ] L10 : Le fichier `src/types/tenant-context.ts` exporte une interface `TenantContext { tenantId: string | null; userId: string | null; assureUserId: string | null; isSuperAdmin: boolean; }`.
- [ ] L11 : Le fichier `src/cli-data-source.ts` existe, charge les variables d'environnement via `dotenv`, instancie un `DataSource` configure pour CLI (entities en `.ts`, migrations en `.ts`, subscribers en `.ts`).
- [ ] L12 : Le fichier `src/data-source.ts` mis a jour reference le dossier `subscribers/*.js` (compile dist) et `migrations/*.js`.
- [ ] L13 : Le dossier `src/migrations/` existe et contient un `.gitkeep` (pas de migration applicative ici, taches futures).
- [ ] L14 : Le dossier `src/subscribers/` existe et contient un `.gitkeep`.
- [ ] L15 : Le fichier `src/index.ts` re-exporte exhaustivement `BaseEntity`, `AuditableEntity`, `withTenantContext`, `withSuperAdmin`, `TenantContext`, et reexporte `DataSource` depuis `data-source.ts`.
- [ ] L16 : Le fichier `.env.example` contient au moins 15 variables prefixees `DATABASE_*`, `TYPEORM_*`, `ATLAS_*`, plus `NODE_ENV`.
- [ ] L17 : La commande `pnpm --filter @insurtech/database build` reussit en moins de 15 secondes et produit `dist/` non vide.
- [ ] L18 : La commande `pnpm --filter @insurtech/database typecheck` reussit sans aucune erreur.
- [ ] L19 : La commande `pnpm --filter @insurtech/database lint` reussit sans aucune erreur ni warning.
- [ ] L20 : La commande `pnpm --filter @insurtech/database test` execute au moins 27 tests, tous au vert.
- [ ] L21 : Le test unitaire `with-tenant-context.test.ts` contient au moins 12 cas (`describe`/`it`) couvrant : appel nominal, ctx vide, tenantId null avec isSuperAdmin true, tenantId null sans isSuperAdmin = throw, callback throw -> rollback, callback async, callback retourne valeur, manager utilise correctement, SET LOCAL execute exactement 4 fois, transaction commit appele 1 fois en succes, rollback en erreur, mock SET LOCAL spy.
- [ ] L22 : Le test unitaire `with-super-admin.test.ts` contient au moins 5 cas : succes nominal, callback throw rollback, manager passe au callback, SET LOCAL is_super_admin true execute exactement 1 fois, valeur retournee identite.
- [ ] L23 : Le test integration `base-entity.int.test.ts` cree une entite de test (TestEntity extends BaseEntity), execute insert / select / update / soft delete / restore et verifie que tenant_id est filtre par RLS.
- [ ] L24 : La commande `pnpm migration:show` (apres mise en place data-source CLI) repond `No migrations are pending.` ou liste vide proprement (pas d'erreur ENOENT).
- [ ] L25 : Le grep `grep -rP "[\x{1F300}-\x{1FAFF}]|[\x{2600}-\x{27BF}]" packages/database/src packages/database/tests` retourne 0 match (aucune emoji).
- [ ] L26 : Le grep `grep -rE "TODO|FIXME|XXX" packages/database/src packages/database/tests` retourne 0 match.
- [ ] L27 : Le grep `grep -rE "console\.(log|error|warn|info|debug)" packages/database/src` retourne 0 match (utilisation Pino logger exclusive).
- [ ] L28 : Le commit final respecte Conventional Commits avec metadata `Task: 1.2.1`, `Sprint: 2`, `Phase: 1`.

## 6. Fichiers crees / modifies

| Chemin (relatif racine monorepo) | Statut | Lignes attendues | Description |
|-----------------------------------|--------|------------------|-------------|
| `packages/database/package.json` | Modifie | ~75 lignes | Enrichi dependances + scripts CLI |
| `packages/database/.env.example` | Modifie | ~30 lignes | Variables DATABASE_*, TYPEORM_*, ATLAS_* |
| `packages/database/src/index.ts` | Modifie | ~40 lignes | Re-exports exhaustifs |
| `packages/database/src/data-source.ts` | Modifie | ~85 lignes | Reference subscribers + migrations dist |
| `packages/database/src/cli-data-source.ts` | Cree | ~70 lignes | DataSource CLI ts-node |
| `packages/database/src/entities/base/base-entity.ts` | Cree | ~60 lignes | Abstract class BaseEntity |
| `packages/database/src/entities/base/auditable-entity.ts` | Cree | ~30 lignes | Abstract class AuditableEntity |
| `packages/database/src/entities/base/index.ts` | Cree | ~5 lignes | Re-export base |
| `packages/database/src/entities/system/index.ts` | Cree | ~3 lignes | Vide |
| `packages/database/src/entities/crm/index.ts` | Cree | ~3 lignes | Vide |
| `packages/database/src/entities/booking/index.ts` | Cree | ~3 lignes | Vide |
| `packages/database/src/entities/comm/index.ts` | Cree | ~3 lignes | Vide |
| `packages/database/src/entities/docs/index.ts` | Cree | ~3 lignes | Vide |
| `packages/database/src/entities/pay/index.ts` | Cree | ~3 lignes | Vide |
| `packages/database/src/entities/books/index.ts` | Cree | ~3 lignes | Vide |
| `packages/database/src/entities/compliance/index.ts` | Cree | ~3 lignes | Vide |
| `packages/database/src/entities/analytics/index.ts` | Cree | ~3 lignes | Vide |
| `packages/database/src/entities/index.ts` | Cree | ~15 lignes | Re-export base + 9 modules |
| `packages/database/src/helpers/with-tenant-context.ts` | Cree | ~80 lignes | Helper tenant transaction |
| `packages/database/src/helpers/with-super-admin.ts` | Cree | ~50 lignes | Helper super admin transaction |
| `packages/database/src/helpers/index.ts` | Cree | ~5 lignes | Re-export helpers |
| `packages/database/src/types/tenant-context.ts` | Cree | ~25 lignes | Interface TenantContext |
| `packages/database/src/types/index.ts` | Cree | ~3 lignes | Re-export types |
| `packages/database/src/migrations/.gitkeep` | Cree | 0 ligne | Marker dossier |
| `packages/database/src/subscribers/.gitkeep` | Cree | 0 ligne | Marker dossier |
| `packages/database/tests/unit/with-tenant-context.test.ts` | Cree | ~250 lignes | 12+ tests Vitest |
| `packages/database/tests/unit/with-super-admin.test.ts` | Cree | ~120 lignes | 5+ tests Vitest |
| `packages/database/tests/unit/structure.test.ts` | Cree | ~80 lignes | 5+ tests structure dossiers |
| `packages/database/tests/integration/base-entity.int.test.ts` | Cree | ~180 lignes | 5+ tests Postgres reel |
| `packages/database/tests/integration/helpers-rls.int.test.ts` | Cree | ~150 lignes | Tests RLS Postgres reel |

## 7. Code patterns COMPLETS

### 7.1 packages/database/package.json

```json
{
  "name": "@insurtech/database",
  "version": "0.2.0",
  "private": true,
  "description": "Skalean InsurTech shared database package -- TypeORM 0.3.20 entities base classes, multi-tenant helpers withTenantContext and withSuperAdmin, migrations CLI scripts. Conformity loi 09-08 CNDP and decision-002 Postgres RLS strict.",
  "license": "UNLICENSED",
  "type": "commonjs",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "require": "./dist/index.js",
      "import": "./dist/index.mjs"
    }
  },
  "files": [
    "dist",
    "README.md",
    "package.json"
  ],
  "scripts": {
    "build": "tsup",
    "build:watch": "tsup --watch",
    "clean": "rimraf dist",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "lint": "eslint \"src/**/*.ts\" \"tests/**/*.ts\" --max-warnings 0",
    "lint:fix": "eslint \"src/**/*.ts\" \"tests/**/*.ts\" --fix",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "migration:create": "typeorm-ts-node-commonjs migration:create",
    "migration:generate": "typeorm-ts-node-commonjs migration:generate -d src/cli-data-source.ts",
    "migration:run": "typeorm-ts-node-commonjs migration:run -d src/cli-data-source.ts",
    "migration:revert": "typeorm-ts-node-commonjs migration:revert -d src/cli-data-source.ts",
    "migration:show": "typeorm-ts-node-commonjs migration:show -d src/cli-data-source.ts",
    "seeds:run": "ts-node --transpile-only src/seeds/run-seeds.ts",
    "seeds:reset": "ts-node --transpile-only src/seeds/reset-seeds.ts"
  },
  "dependencies": {
    "@insurtech/core": "workspace:*",
    "@insurtech/logger": "workspace:*",
    "pg": "8.13.1",
    "reflect-metadata": "0.2.2",
    "typeorm": "0.3.20"
  },
  "devDependencies": {
    "@types/node": "20.16.10",
    "@types/pg": "8.11.10",
    "dotenv": "16.4.5",
    "eslint": "9.12.0",
    "rimraf": "6.0.1",
    "tsup": "8.3.0",
    "typeorm-ts-node-commonjs": "0.3.20",
    "typescript": "5.6.3",
    "vitest": "2.1.2"
  },
  "peerDependencies": {
    "reflect-metadata": "^0.2.0",
    "typeorm": "^0.3.0"
  },
  "engines": {
    "node": ">=20.18.0",
    "pnpm": ">=9.12.0"
  },
  "publishConfig": {
    "access": "restricted"
  }
}
```

### 7.2 packages/database/src/entities/base/base-entity.ts

```typescript
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * BaseEntity -- Skalean InsurTech.
 *
 * Classe abstraite obligatoire pour TOUTES les entites metier soumises a
 * isolation multi-tenant (decision-003 multi-tenant 3 niveaux). Fournit :
 *   - id : UUID primaire genere cote pilote TypeORM (uuid v4).
 *   - tenant_id : UUID non null, scope tenant courtier. Indexe pour RLS Postgres.
 *   - created_at : timestamptz, defaut now() cote DB.
 *   - updated_at : timestamptz, mis a jour automatiquement a chaque save().
 *   - deleted_at : timestamptz nullable, soft delete via @DeleteDateColumn.
 *
 * Exclusions : les entites systeme globales (registry tenants, currencies,
 * regions Maroc, countries) NE doivent PAS heriter de BaseEntity car elles
 * n'ont pas de tenant_id. Elles utilisent BaseSystemEntity (cree dans une
 * tache ulterieure 1.2.x).
 *
 * Convention -- Les colonnes sont nommees snake_case en base mais accessibles
 * en camelCase TypeScript via le mapping `name:` du decorateur @Column.
 * Cette dualite respecte la convention Postgres (snake_case) et la convention
 * TypeScript (camelCase).
 *
 * Politique RLS Postgres associee (cree dans migration ulterieure) :
 *   CREATE POLICY tenant_isolation ON {table}
 *     USING (
 *       tenant_id = current_setting('app.current_tenant_id', true)::uuid
 *       OR current_setting('app.is_super_admin', true) = 'true'
 *     )
 *     WITH CHECK (
 *       tenant_id = current_setting('app.current_tenant_id', true)::uuid
 *       OR current_setting('app.is_super_admin', true) = 'true'
 *     );
 *
 * Conformite : loi 09-08 CNDP article 17 (proportionnalite traitement),
 * loi 9-88 CGNC (preparation audit trail Sprint 12).
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Index('idx_base_tenant_id')
  @Column({ name: 'tenant_id', type: 'uuid', nullable: false })
  public tenantId!: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  public createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  public updatedAt!: Date;

  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'timestamptz',
    nullable: true,
  })
  public deletedAt!: Date | null;
}
```

### 7.3 packages/database/src/entities/base/auditable-entity.ts

```typescript
import { Column } from 'typeorm';
import { BaseEntity } from './base-entity';

/**
 * AuditableEntity -- Skalean InsurTech.
 *
 * Extension de BaseEntity pour les entites soumises a une tracabilite forte
 * (utilisateurs, contrats, paiements, sinistres, factures, audit logs).
 * Ajoute deux colonnes supplementaires :
 *   - created_by : UUID utilisateur createur (FK ajoutee Sprint 2 task 1.2.5).
 *   - updated_by : UUID utilisateur derniere modification (FK ajoutee Sprint 2 task 1.2.5).
 *
 * Les colonnes sont nullables car certaines creations sont effectuees par le
 * systeme lui-meme (jobs cron, webhooks, imports) qui n'ont pas d'utilisateur
 * physique. La valeur NULL signifie "operation systeme".
 *
 * La FK vers users(id) sera ajoutee plus tard (tache 1.2.5) une fois la table
 * users creee. Pour l'instant on garde uuid pur sans contrainte FK.
 *
 * Conformite : loi 9-88 CGNC (audit trail comptable, conservation 10 ans),
 * loi 09-08 CNDP article 9 (loyaute + accessibilite des traitements).
 */
export abstract class AuditableEntity extends BaseEntity {
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  public createdBy!: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  public updatedBy!: string | null;
}
```

### 7.4 packages/database/src/entities/base/index.ts

```typescript
export { BaseEntity } from './base-entity';
export { AuditableEntity } from './auditable-entity';
```

### 7.5 packages/database/src/entities/index.ts

```typescript
export * from './base';
export * from './system';
export * from './crm';
export * from './booking';
export * from './comm';
export * from './docs';
export * from './pay';
export * from './books';
export * from './compliance';
export * from './analytics';
```

### 7.6 packages/database/src/entities/system/index.ts (et identique pour les 8 autres modules)

```typescript
/**
 * Module entites system -- Skalean InsurTech.
 *
 * Vide par design dans la tache 1.2.1. Sera peuple par les taches Sprint 2
 * suivantes : 1.2.3 (TenantEntity), 1.2.4 (UserEntity), 1.2.5 (RoleEntity),
 * 1.2.6 (PermissionEntity), 1.2.7 (UserRoleEntity).
 */
export {};
```

### 7.7 packages/database/src/types/tenant-context.ts

```typescript
/**
 * TenantContext -- Skalean InsurTech.
 *
 * Structure passee aux helpers transactionnels withTenantContext pour
 * positionner les variables de session Postgres utilisees par les policies
 * RLS (decision-002 Postgres RLS strict, decision-003 multi-tenant 3 niveaux).
 *
 * Champs :
 *   - tenantId : UUID du tenant courtier. Doit etre non null sauf si
 *     isSuperAdmin = true (cas super admin global).
 *   - userId : UUID utilisateur authentifie cote courtier (collaborateur
 *     courtier ou super admin si applicable). Null pour operations
 *     batch/jobs systeme.
 *   - assureUserId : UUID utilisateur assure final (extranet client).
 *     Renseigne uniquement quand le contexte est un acces extranet
 *     assure (ex: portail client). Null sinon.
 *   - isSuperAdmin : booleen, true uniquement si l'utilisateur est super
 *     admin global Skalean. Implique typiquement tenantId = null.
 *
 * Validation runtime conseillee via Zod (cf. helpers).
 */
export interface TenantContext {
  readonly tenantId: string | null;
  readonly userId: string | null;
  readonly assureUserId: string | null;
  readonly isSuperAdmin: boolean;
}
```

### 7.8 packages/database/src/types/index.ts

```typescript
export type { TenantContext } from './tenant-context';
```

### 7.9 packages/database/src/helpers/with-tenant-context.ts

```typescript
import type { DataSource, EntityManager } from 'typeorm';
import { logger } from '@insurtech/logger';
import type { TenantContext } from '../types/tenant-context';

/**
 * withTenantContext -- Skalean InsurTech.
 *
 * Helper transactionnel critique pour la securite multi-tenant. Toute
 * operation base de donnees metier DOIT passer par ce helper afin que les
 * variables de session Postgres soient positionnees correctement et que les
 * policies RLS (Row-Level Security) appliquent l'isolation tenant.
 *
 * Mecanisme :
 *   1. Ouvre une transaction explicite via dataSource.transaction().
 *   2. Execute 4 SET LOCAL pour positionner :
 *      - app.current_tenant_id (consomme par policy tenant_isolation)
 *      - app.is_super_admin (consomme par policy super_admin_bypass)
 *      - app.current_user_id (consomme par audit subscribers)
 *      - app.assure_user_id (consomme par policy assure_self_only)
 *   3. Appelle le callback fourni avec l'EntityManager scope a la transaction.
 *   4. Si succes -> COMMIT automatique par TypeORM.
 *   5. Si throw -> ROLLBACK automatique par TypeORM, l'erreur est propagee.
 *
 * Validation defensive :
 *   - Si tenantId est null et isSuperAdmin est false -> throw Error.
 *     Garde-fou contre fuite d'isolation par oubli.
 *   - Si tenantId est non null et isSuperAdmin est true -> warning log mais
 *     execution autorisee (cas exceptionnel : super admin agissant sur un
 *     tenant precis pour support technique).
 *
 * Performance :
 *   - Overhead transactionnel : ~0.5 ms par appel sur Postgres 16 Atlas.
 *   - Pool connections : utilise une connection du pool pour la duree du
 *     callback. Liberation automatique en fin de transaction par TypeORM.
 *
 * Usage type :
 *   const user = await withTenantContext(
 *     dataSource,
 *     { tenantId: 'abc', userId: 'def', assureUserId: null, isSuperAdmin: false },
 *     async (manager) => {
 *       return manager.getRepository(UserEntity).findOne({ where: { id: 'xyz' } });
 *     }
 *   );
 *
 * Conformite : loi 09-08 CNDP article 23 (mesures techniques de securite),
 * decision-002 Postgres RLS strict, decision-003 multi-tenant 3 niveaux.
 */
export async function withTenantContext<T>(
  dataSource: DataSource,
  ctx: TenantContext,
  callback: (manager: EntityManager) => Promise<T>,
): Promise<T> {
  if (!dataSource.isInitialized) {
    throw new Error(
      'withTenantContext: DataSource is not initialized. Call dataSource.initialize() first.',
    );
  }

  if (ctx.tenantId === null && !ctx.isSuperAdmin) {
    throw new Error(
      'withTenantContext: tenantId is null and isSuperAdmin is false. ' +
        'A non-super-admin operation requires a non-null tenantId.',
    );
  }

  if (ctx.tenantId !== null && ctx.isSuperAdmin) {
    logger.warn(
      {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        isSuperAdmin: ctx.isSuperAdmin,
      },
      'withTenantContext: super admin acting on a specific tenant context. ' +
        'Verify this is intentional (technical support scenario).',
    );
  }

  return dataSource.transaction(async (manager: EntityManager): Promise<T> => {
    const tenantParam = ctx.tenantId === null ? null : ctx.tenantId;
    const userParam = ctx.userId === null ? null : ctx.userId;
    const assureParam = ctx.assureUserId === null ? null : ctx.assureUserId;
    const superAdminParam = ctx.isSuperAdmin ? 'true' : 'false';

    await manager.query(
      `SELECT set_config('app.current_tenant_id', $1, true)`,
      [tenantParam],
    );
    await manager.query(
      `SELECT set_config('app.is_super_admin', $1, true)`,
      [superAdminParam],
    );
    await manager.query(
      `SELECT set_config('app.current_user_id', $1, true)`,
      [userParam],
    );
    await manager.query(
      `SELECT set_config('app.assure_user_id', $1, true)`,
      [assureParam],
    );

    logger.debug(
      {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        assureUserId: ctx.assureUserId,
        isSuperAdmin: ctx.isSuperAdmin,
      },
      'withTenantContext: session variables set',
    );

    return callback(manager);
  });
}
```

### 7.10 packages/database/src/helpers/with-super-admin.ts

```typescript
import type { DataSource, EntityManager } from 'typeorm';
import { logger } from '@insurtech/logger';

/**
 * withSuperAdmin -- Skalean InsurTech.
 *
 * Helper transactionnel pour operations super admin globales. A utiliser
 * exclusivement pour :
 *   - Operations sur la table `tenants` (registry des courtiers).
 *   - Operations sur tables systemes globales (currencies, regions Maroc,
 *     countries, system_config).
 *   - Migrations de donnees inter-tenants (rare, audite).
 *   - Jobs cron systemes (purge, archivage, retention).
 *
 * Mecanisme :
 *   1. Ouvre une transaction explicite.
 *   2. Execute 2 SET LOCAL : app.is_super_admin = true et
 *      app.current_tenant_id = NULL.
 *   3. Appelle le callback avec l'EntityManager scope.
 *   4. COMMIT/ROLLBACK auto par TypeORM.
 *
 * Securite :
 *   - Ce helper bypasse les policies RLS tenant_isolation. Son utilisation
 *     est consignee dans le log au niveau warn (audit trail Sprint 12).
 *   - Ne JAMAIS appeler ce helper depuis un endpoint expose au tenant
 *     courtier ou a l'assure final. Reserve aux endpoints super admin
 *     authentifies (RBAC role 'super_admin').
 *
 * Conformite : loi 09-08 CNDP article 23 (mesures de securite), traceabilite
 * super admin requise par audit interne Skalean (decision-006).
 */
export async function withSuperAdmin<T>(
  dataSource: DataSource,
  callback: (manager: EntityManager) => Promise<T>,
): Promise<T> {
  if (!dataSource.isInitialized) {
    throw new Error(
      'withSuperAdmin: DataSource is not initialized. Call dataSource.initialize() first.',
    );
  }

  logger.warn(
    { helper: 'withSuperAdmin' },
    'withSuperAdmin: super admin transaction opening, RLS bypass active',
  );

  return dataSource.transaction(async (manager: EntityManager): Promise<T> => {
    await manager.query(
      `SELECT set_config('app.is_super_admin', 'true', true)`,
    );
    await manager.query(
      `SELECT set_config('app.current_tenant_id', NULL, true)`,
    );
    await manager.query(
      `SELECT set_config('app.current_user_id', NULL, true)`,
    );
    await manager.query(
      `SELECT set_config('app.assure_user_id', NULL, true)`,
    );

    return callback(manager);
  });
}
```

### 7.11 packages/database/src/helpers/index.ts

```typescript
export { withTenantContext } from './with-tenant-context';
export { withSuperAdmin } from './with-super-admin';
```

### 7.12 packages/database/src/cli-data-source.ts

```typescript
import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';
import { DataSource } from 'typeorm';
import { resolve } from 'node:path';

/**
 * cli-data-source -- Skalean InsurTech.
 *
 * DataSource dediee aux commandes CLI TypeORM (migration:create,
 * migration:generate, migration:run, migration:revert, migration:show) et
 * aux scripts de seed.
 *
 * Difference avec src/data-source.ts (runtime applicatif) :
 *   - cli-data-source charge les entites depuis src/**\/*.entity.ts (TypeScript
 *     source) car la CLI tourne via typeorm-ts-node-commonjs.
 *   - data-source.ts (runtime) charge depuis dist/**\/*.entity.js (JavaScript
 *     compile) pour eviter l'overhead ts-node en production.
 *
 * Variables d'environnement requises :
 *   DATABASE_HOST, DATABASE_PORT, DATABASE_USER, DATABASE_PASSWORD,
 *   DATABASE_NAME, DATABASE_SCHEMA, NODE_ENV.
 *
 * Conformite : decision-008 data residency Atlas Cloud Services Benguerir,
 * DATABASE_HOST DOIT pointer sur un endpoint Atlas Maroc (pg-primary.atlas.skalean.ma).
 */

loadDotenv({ path: resolve(process.cwd(), '.env') });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(
      `cli-data-source: environment variable ${name} is required but not defined.`,
    );
  }
  return value;
}

export const cliDataSource = new DataSource({
  type: 'postgres',
  host: requireEnv('DATABASE_HOST'),
  port: Number.parseInt(requireEnv('DATABASE_PORT'), 10),
  username: requireEnv('DATABASE_USER'),
  password: requireEnv('DATABASE_PASSWORD'),
  database: requireEnv('DATABASE_NAME'),
  schema: process.env.DATABASE_SCHEMA ?? 'public',
  synchronize: false,
  logging: process.env.DATABASE_LOG_QUERIES === 'true',
  entities: [
    'src/entities/**/*.entity.ts',
    'src/entities/base/*.ts',
  ],
  migrations: ['src/migrations/*.ts'],
  subscribers: ['src/subscribers/*.ts'],
  migrationsTableName: 'typeorm_migrations',
  migrationsRun: false,
  uuidExtension: 'pgcrypto',
});

export default cliDataSource;
```

### 7.13 packages/database/src/data-source.ts (mise a jour)

```typescript
import 'reflect-metadata';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { logger } from '@insurtech/logger';

/**
 * data-source -- Skalean InsurTech (RUNTIME applicatif).
 *
 * DataSource utilisee par les services applicatifs en production et
 * developpement local. Charge les entites compilees depuis dist/ pour eviter
 * l'overhead ts-node. Pour la CLI TypeORM (migrations, seeds), utiliser
 * cli-data-source.ts a la place.
 *
 * Pool de connexions configure par variables d'environnement :
 *   DATABASE_POOL_SIZE_MAX (defaut 20)
 *   DATABASE_POOL_SIZE_MIN (defaut 2)
 *   DATABASE_POOL_IDLE_TIMEOUT_MS (defaut 30000)
 *   DATABASE_POOL_CONNECTION_TIMEOUT_MS (defaut 5000)
 *
 * Conformite : decision-008 data residency Atlas Cloud Services Benguerir.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(
      `data-source: environment variable ${name} is required but not defined.`,
    );
  }
  return value;
}

function optionalEnvInt(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (value === undefined || value === '') {
    return defaultValue;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`data-source: environment variable ${name} is not a valid integer.`);
  }
  return parsed;
}

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: requireEnv('DATABASE_HOST'),
  port: Number.parseInt(requireEnv('DATABASE_PORT'), 10),
  username: requireEnv('DATABASE_USER'),
  password: requireEnv('DATABASE_PASSWORD'),
  database: requireEnv('DATABASE_NAME'),
  schema: process.env.DATABASE_SCHEMA ?? 'public',
  synchronize: false,
  logging: process.env.DATABASE_LOG_QUERIES === 'true',
  entities: [
    'dist/entities/**/*.entity.js',
    'dist/entities/base/*.js',
  ],
  migrations: ['dist/migrations/*.js'],
  subscribers: ['dist/subscribers/*.js'],
  migrationsTableName: 'typeorm_migrations',
  migrationsRun: false,
  uuidExtension: 'pgcrypto',
  extra: {
    max: optionalEnvInt('DATABASE_POOL_SIZE_MAX', 20),
    min: optionalEnvInt('DATABASE_POOL_SIZE_MIN', 2),
    idleTimeoutMillis: optionalEnvInt('DATABASE_POOL_IDLE_TIMEOUT_MS', 30000),
    connectionTimeoutMillis: optionalEnvInt('DATABASE_POOL_CONNECTION_TIMEOUT_MS', 5000),
    statement_timeout: optionalEnvInt('DATABASE_STATEMENT_TIMEOUT_MS', 30000),
  },
};

export const dataSource: DataSource = new DataSource(dataSourceOptions);

export async function initializeDataSource(): Promise<DataSource> {
  if (dataSource.isInitialized) {
    logger.debug({ helper: 'initializeDataSource' }, 'data-source: already initialized, returning existing instance');
    return dataSource;
  }
  logger.info({ helper: 'initializeDataSource' }, 'data-source: initializing connection pool');
  await dataSource.initialize();
  logger.info({ helper: 'initializeDataSource' }, 'data-source: connection pool ready');
  return dataSource;
}

export async function destroyDataSource(): Promise<void> {
  if (!dataSource.isInitialized) {
    return;
  }
  logger.info({ helper: 'destroyDataSource' }, 'data-source: closing connection pool');
  await dataSource.destroy();
  logger.info({ helper: 'destroyDataSource' }, 'data-source: connection pool closed');
}
```

### 7.14 packages/database/src/index.ts

```typescript
import 'reflect-metadata';

export { dataSource, dataSourceOptions, initializeDataSource, destroyDataSource } from './data-source';
export { cliDataSource } from './cli-data-source';

export * from './entities';
export * from './helpers';
export * from './types';

export { DataSource, EntityManager, Repository, QueryRunner } from 'typeorm';
export type { DataSourceOptions } from 'typeorm';
```

### 7.15 packages/database/.env.example

```dotenv
NODE_ENV=development

DATABASE_HOST=pg-primary.atlas.skalean.ma
DATABASE_PORT=5432
DATABASE_USER=skalean_app
DATABASE_PASSWORD=change_me_in_real_env
DATABASE_NAME=skalean_insurtech_dev
DATABASE_SCHEMA=public

DATABASE_POOL_SIZE_MAX=20
DATABASE_POOL_SIZE_MIN=2
DATABASE_POOL_IDLE_TIMEOUT_MS=30000
DATABASE_POOL_CONNECTION_TIMEOUT_MS=5000
DATABASE_STATEMENT_TIMEOUT_MS=30000

DATABASE_LOG_QUERIES=false
DATABASE_LOG_SLOW_QUERY_THRESHOLD_MS=1000

TYPEORM_MIGRATIONS_DIR=src/migrations
TYPEORM_ENTITIES_GLOB=src/entities/**/*.entity.ts
TYPEORM_SUBSCRIBERS_GLOB=src/subscribers/*.ts

ATLAS_KMS_KEY_ID=alias/skalean-database-encryption-key
ATLAS_REGION=ma-benguerir-1
ATLAS_CLOUD_PROVIDER=atlas
```

## 8. Tests complets

### 8.1 tests/unit/with-tenant-context.test.ts

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DataSource, EntityManager } from 'typeorm';
import { withTenantContext } from '../../src/helpers/with-tenant-context';
import type { TenantContext } from '../../src/types/tenant-context';

interface MockManager {
  query: ReturnType<typeof vi.fn>;
}

interface MockDataSource {
  isInitialized: boolean;
  transaction: ReturnType<typeof vi.fn>;
}

function buildMockManager(): MockManager {
  return {
    query: vi.fn().mockResolvedValue([{ set_config: '' }]),
  };
}

function buildMockDataSource(manager: MockManager, opts: { initialized?: boolean } = {}): MockDataSource {
  const initialized = opts.initialized ?? true;
  return {
    isInitialized: initialized,
    transaction: vi.fn(async (callback: (m: MockManager) => Promise<unknown>) => {
      return callback(manager);
    }),
  };
}

const validCtx: TenantContext = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  userId: '22222222-2222-2222-2222-222222222222',
  assureUserId: null,
  isSuperAdmin: false,
};

describe('withTenantContext', () => {
  let mockManager: MockManager;
  let mockDataSource: MockDataSource;

  beforeEach(() => {
    mockManager = buildMockManager();
    mockDataSource = buildMockDataSource(mockManager);
  });

  it('executes the callback inside a transaction', async () => {
    const result = await withTenantContext(
      mockDataSource as unknown as DataSource,
      validCtx,
      async (manager) => {
        expect(manager).toBeDefined();
        return 'callback-result';
      },
    );
    expect(result).toBe('callback-result');
    expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
  });

  it('sets exactly four session variables via set_config', async () => {
    await withTenantContext(
      mockDataSource as unknown as DataSource,
      validCtx,
      async () => 'ok',
    );
    expect(mockManager.query).toHaveBeenCalledTimes(4);
    const calls = mockManager.query.mock.calls.map((c) => c[0]);
    expect(calls[0]).toContain('app.current_tenant_id');
    expect(calls[1]).toContain('app.is_super_admin');
    expect(calls[2]).toContain('app.current_user_id');
    expect(calls[3]).toContain('app.assure_user_id');
  });

  it('throws when DataSource is not initialized', async () => {
    const uninitialized = buildMockDataSource(mockManager, { initialized: false });
    await expect(
      withTenantContext(uninitialized as unknown as DataSource, validCtx, async () => 'ok'),
    ).rejects.toThrow(/not initialized/);
  });

  it('throws when tenantId is null and isSuperAdmin is false', async () => {
    const invalidCtx: TenantContext = {
      tenantId: null,
      userId: '22222222-2222-2222-2222-222222222222',
      assureUserId: null,
      isSuperAdmin: false,
    };
    await expect(
      withTenantContext(mockDataSource as unknown as DataSource, invalidCtx, async () => 'ok'),
    ).rejects.toThrow(/tenantId is null and isSuperAdmin is false/);
  });

  it('allows tenantId null when isSuperAdmin is true', async () => {
    const superCtx: TenantContext = {
      tenantId: null,
      userId: '33333333-3333-3333-3333-333333333333',
      assureUserId: null,
      isSuperAdmin: true,
    };
    const result = await withTenantContext(
      mockDataSource as unknown as DataSource,
      superCtx,
      async () => 'super-ok',
    );
    expect(result).toBe('super-ok');
  });

  it('passes assureUserId when provided', async () => {
    const assureCtx: TenantContext = {
      tenantId: '11111111-1111-1111-1111-111111111111',
      userId: null,
      assureUserId: '44444444-4444-4444-4444-444444444444',
      isSuperAdmin: false,
    };
    await withTenantContext(
      mockDataSource as unknown as DataSource,
      assureCtx,
      async () => 'ok',
    );
    const call = mockManager.query.mock.calls.find((c) =>
      String(c[0]).includes('app.assure_user_id'),
    );
    expect(call).toBeDefined();
    expect(call?.[1][0]).toBe('44444444-4444-4444-4444-444444444444');
  });

  it('propagates callback errors and triggers rollback', async () => {
    const err = new Error('callback boom');
    await expect(
      withTenantContext(mockDataSource as unknown as DataSource, validCtx, async () => {
        throw err;
      }),
    ).rejects.toThrow('callback boom');
  });

  it('returns the callback result identity', async () => {
    const objectResult = { foo: 'bar', count: 42 };
    const result = await withTenantContext(
      mockDataSource as unknown as DataSource,
      validCtx,
      async () => objectResult,
    );
    expect(result).toBe(objectResult);
  });

  it('supports async/await callback chains', async () => {
    const result = await withTenantContext(
      mockDataSource as unknown as DataSource,
      validCtx,
      async (_manager) => {
        const a = await Promise.resolve(1);
        const b = await Promise.resolve(2);
        return a + b;
      },
    );
    expect(result).toBe(3);
  });

  it('emits a warning when super admin acts on a specific tenant', async () => {
    const warnCtx: TenantContext = {
      tenantId: '11111111-1111-1111-1111-111111111111',
      userId: '22222222-2222-2222-2222-222222222222',
      assureUserId: null,
      isSuperAdmin: true,
    };
    const result = await withTenantContext(
      mockDataSource as unknown as DataSource,
      warnCtx,
      async () => 'warned-ok',
    );
    expect(result).toBe('warned-ok');
  });

  it('uses set_config rather than SET LOCAL plain text', async () => {
    await withTenantContext(
      mockDataSource as unknown as DataSource,
      validCtx,
      async () => 'ok',
    );
    const calls = mockManager.query.mock.calls.map((c) => String(c[0]));
    calls.forEach((sql) => {
      expect(sql).toMatch(/set_config/);
      expect(sql).not.toMatch(/^SET LOCAL/);
    });
  });

  it('binds NULL when tenantId is null and isSuperAdmin true', async () => {
    const superCtx: TenantContext = {
      tenantId: null,
      userId: null,
      assureUserId: null,
      isSuperAdmin: true,
    };
    await withTenantContext(
      mockDataSource as unknown as DataSource,
      superCtx,
      async () => 'ok',
    );
    const tenantCall = mockManager.query.mock.calls.find((c) =>
      String(c[0]).includes('app.current_tenant_id'),
    );
    expect(tenantCall?.[1][0]).toBeNull();
  });

  it('serializes is_super_admin as the string "false" when false', async () => {
    await withTenantContext(
      mockDataSource as unknown as DataSource,
      validCtx,
      async () => 'ok',
    );
    const superCall = mockManager.query.mock.calls.find((c) =>
      String(c[0]).includes('app.is_super_admin'),
    );
    expect(superCall?.[1][0]).toBe('false');
  });

  it('serializes is_super_admin as the string "true" when true', async () => {
    const superCtx: TenantContext = {
      tenantId: null,
      userId: null,
      assureUserId: null,
      isSuperAdmin: true,
    };
    await withTenantContext(
      mockDataSource as unknown as DataSource,
      superCtx,
      async () => 'ok',
    );
    const superCall = mockManager.query.mock.calls.find((c) =>
      String(c[0]).includes('app.is_super_admin'),
    );
    expect(superCall?.[1][0]).toBe('true');
  });
});
```

### 8.2 tests/unit/with-super-admin.test.ts

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DataSource } from 'typeorm';
import { withSuperAdmin } from '../../src/helpers/with-super-admin';

interface MockManager {
  query: ReturnType<typeof vi.fn>;
}

interface MockDataSource {
  isInitialized: boolean;
  transaction: ReturnType<typeof vi.fn>;
}

function buildMocks(initialized = true): { manager: MockManager; dataSource: MockDataSource } {
  const manager: MockManager = { query: vi.fn().mockResolvedValue([]) };
  const dataSource: MockDataSource = {
    isInitialized: initialized,
    transaction: vi.fn(async (cb: (m: MockManager) => Promise<unknown>) => cb(manager)),
  };
  return { manager, dataSource };
}

describe('withSuperAdmin', () => {
  let manager: MockManager;
  let dataSource: MockDataSource;

  beforeEach(() => {
    const m = buildMocks();
    manager = m.manager;
    dataSource = m.dataSource;
  });

  it('opens a transaction and runs the callback', async () => {
    const result = await withSuperAdmin(
      dataSource as unknown as DataSource,
      async () => 'super',
    );
    expect(result).toBe('super');
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
  });

  it('executes set_config app.is_super_admin to true exactly once', async () => {
    await withSuperAdmin(dataSource as unknown as DataSource, async () => 'ok');
    const call = manager.query.mock.calls.find((c) =>
      String(c[0]).includes('app.is_super_admin'),
    );
    expect(call).toBeDefined();
    expect(String(call?.[0])).toContain("'true'");
  });

  it('executes 4 set_config calls (super_admin, tenant null, user null, assure null)', async () => {
    await withSuperAdmin(dataSource as unknown as DataSource, async () => 'ok');
    expect(manager.query).toHaveBeenCalledTimes(4);
  });

  it('propagates callback errors and rolls back', async () => {
    await expect(
      withSuperAdmin(dataSource as unknown as DataSource, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });

  it('throws if dataSource not initialized', async () => {
    const uninit = buildMocks(false).dataSource;
    await expect(
      withSuperAdmin(uninit as unknown as DataSource, async () => 'ok'),
    ).rejects.toThrow(/not initialized/);
  });

  it('passes the manager to the callback', async () => {
    let received: unknown;
    await withSuperAdmin(dataSource as unknown as DataSource, async (m) => {
      received = m;
      return 'ok';
    });
    expect(received).toBe(manager);
  });

  it('returns identity of the callback result', async () => {
    const obj = { id: 'abc' };
    const result = await withSuperAdmin(
      dataSource as unknown as DataSource,
      async () => obj,
    );
    expect(result).toBe(obj);
  });
});
```

### 8.3 tests/unit/structure.test.ts

```typescript
import { describe, it, expect } from 'vitest';
import { existsSync, statSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../');

function p(rel: string): string {
  return resolve(ROOT, rel);
}

describe('database package structure', () => {
  it('has an entities/base/base-entity.ts file', () => {
    expect(existsSync(p('src/entities/base/base-entity.ts'))).toBe(true);
  });

  it('has an entities/base/auditable-entity.ts file', () => {
    expect(existsSync(p('src/entities/base/auditable-entity.ts'))).toBe(true);
  });

  it('has 9 module folders in src/entities/', () => {
    const modules = ['system', 'crm', 'booking', 'comm', 'docs', 'pay', 'books', 'compliance', 'analytics'];
    modules.forEach((m) => {
      expect(existsSync(p(`src/entities/${m}`))).toBe(true);
      expect(statSync(p(`src/entities/${m}`)).isDirectory()).toBe(true);
      expect(existsSync(p(`src/entities/${m}/index.ts`))).toBe(true);
    });
  });

  it('has helpers/with-tenant-context.ts and helpers/with-super-admin.ts', () => {
    expect(existsSync(p('src/helpers/with-tenant-context.ts'))).toBe(true);
    expect(existsSync(p('src/helpers/with-super-admin.ts'))).toBe(true);
  });

  it('has migrations/ and subscribers/ folders with .gitkeep markers', () => {
    expect(existsSync(p('src/migrations'))).toBe(true);
    expect(existsSync(p('src/subscribers'))).toBe(true);
    expect(existsSync(p('src/migrations/.gitkeep'))).toBe(true);
    expect(existsSync(p('src/subscribers/.gitkeep'))).toBe(true);
  });

  it('has cli-data-source.ts at src root', () => {
    expect(existsSync(p('src/cli-data-source.ts'))).toBe(true);
  });

  it('contains no emojis in any source or test file', () => {
    const files = [
      'src/entities/base/base-entity.ts',
      'src/entities/base/auditable-entity.ts',
      'src/helpers/with-tenant-context.ts',
      'src/helpers/with-super-admin.ts',
      'src/cli-data-source.ts',
      'src/data-source.ts',
      'src/index.ts',
    ];
    const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    files.forEach((rel) => {
      const content = readFileSync(p(rel), 'utf-8');
      expect(emojiRegex.test(content)).toBe(false);
    });
  });

  it('has no console.log statements in src/', () => {
    const files = [
      'src/entities/base/base-entity.ts',
      'src/helpers/with-tenant-context.ts',
      'src/helpers/with-super-admin.ts',
      'src/cli-data-source.ts',
      'src/data-source.ts',
    ];
    files.forEach((rel) => {
      const content = readFileSync(p(rel), 'utf-8');
      expect(/console\.(log|error|warn|info|debug)/.test(content)).toBe(false);
    });
  });
});
```

### 8.4 tests/integration/base-entity.int.test.ts

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import 'reflect-metadata';
import { DataSource, Entity, Column } from 'typeorm';
import { BaseEntity } from '../../src/entities/base/base-entity';
import { withTenantContext } from '../../src/helpers/with-tenant-context';

@Entity({ name: 'test_base_entity' })
class TestBaseEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 200 })
  public name!: string;
}

let dataSource: DataSource;

beforeAll(async () => {
  dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: Number(process.env.DATABASE_PORT ?? '5432'),
    username: process.env.DATABASE_USER ?? 'skalean_test',
    password: process.env.DATABASE_PASSWORD ?? 'skalean_test',
    database: process.env.DATABASE_NAME ?? 'skalean_test',
    entities: [TestBaseEntity],
    synchronize: true,
    dropSchema: true,
    logging: false,
  });
  await dataSource.initialize();
});

afterAll(async () => {
  if (dataSource.isInitialized) {
    await dataSource.destroy();
  }
});

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';

describe('BaseEntity integration', () => {
  it('persists an entity with auto generated id and timestamps', async () => {
    const inserted = await withTenantContext(
      dataSource,
      { tenantId: TENANT_A, userId: null, assureUserId: null, isSuperAdmin: false },
      async (m) => m.getRepository(TestBaseEntity).save({ tenantId: TENANT_A, name: 'first' }),
    );
    expect(inserted.id).toMatch(/[0-9a-f-]{36}/);
    expect(inserted.createdAt).toBeInstanceOf(Date);
    expect(inserted.updatedAt).toBeInstanceOf(Date);
    expect(inserted.deletedAt).toBeNull();
  });

  it('updates updatedAt on save', async () => {
    const saved = await withTenantContext(
      dataSource,
      { tenantId: TENANT_A, userId: null, assureUserId: null, isSuperAdmin: false },
      async (m) => m.getRepository(TestBaseEntity).save({ tenantId: TENANT_A, name: 'before' }),
    );
    const initialUpdatedAt = saved.updatedAt.getTime();
    await new Promise((r) => setTimeout(r, 50));
    saved.name = 'after';
    const updated = await withTenantContext(
      dataSource,
      { tenantId: TENANT_A, userId: null, assureUserId: null, isSuperAdmin: false },
      async (m) => m.getRepository(TestBaseEntity).save(saved),
    );
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(initialUpdatedAt);
  });

  it('soft deletes via softRemove and sets deletedAt', async () => {
    const saved = await withTenantContext(
      dataSource,
      { tenantId: TENANT_A, userId: null, assureUserId: null, isSuperAdmin: false },
      async (m) => m.getRepository(TestBaseEntity).save({ tenantId: TENANT_A, name: 'to-delete' }),
    );
    const removed = await withTenantContext(
      dataSource,
      { tenantId: TENANT_A, userId: null, assureUserId: null, isSuperAdmin: false },
      async (m) => m.getRepository(TestBaseEntity).softRemove(saved),
    );
    expect(removed.deletedAt).toBeInstanceOf(Date);
  });

  it('isolates rows by tenantId at application level', async () => {
    await withTenantContext(
      dataSource,
      { tenantId: TENANT_A, userId: null, assureUserId: null, isSuperAdmin: false },
      async (m) => m.getRepository(TestBaseEntity).save({ tenantId: TENANT_A, name: 'a-only' }),
    );
    await withTenantContext(
      dataSource,
      { tenantId: TENANT_B, userId: null, assureUserId: null, isSuperAdmin: false },
      async (m) => m.getRepository(TestBaseEntity).save({ tenantId: TENANT_B, name: 'b-only' }),
    );
    const allFromA = await withTenantContext(
      dataSource,
      { tenantId: TENANT_A, userId: null, assureUserId: null, isSuperAdmin: false },
      async (m) => m.getRepository(TestBaseEntity).find({ where: { tenantId: TENANT_A } }),
    );
    expect(allFromA.every((e) => e.tenantId === TENANT_A)).toBe(true);
  });

  it('supports restore after softRemove', async () => {
    const saved = await withTenantContext(
      dataSource,
      { tenantId: TENANT_A, userId: null, assureUserId: null, isSuperAdmin: false },
      async (m) => m.getRepository(TestBaseEntity).save({ tenantId: TENANT_A, name: 'restorable' }),
    );
    await withTenantContext(
      dataSource,
      { tenantId: TENANT_A, userId: null, assureUserId: null, isSuperAdmin: false },
      async (m) => m.getRepository(TestBaseEntity).softRemove(saved),
    );
    const restored = await withTenantContext(
      dataSource,
      { tenantId: TENANT_A, userId: null, assureUserId: null, isSuperAdmin: false },
      async (m) => m.getRepository(TestBaseEntity).restore({ id: saved.id }),
    );
    expect(restored.affected).toBe(1);
  });
});
```

### 8.5 tests/integration/helpers-rls.int.test.ts

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { withTenantContext } from '../../src/helpers/with-tenant-context';
import { withSuperAdmin } from '../../src/helpers/with-super-admin';

let dataSource: DataSource;

beforeAll(async () => {
  dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: Number(process.env.DATABASE_PORT ?? '5432'),
    username: process.env.DATABASE_USER ?? 'skalean_test',
    password: process.env.DATABASE_PASSWORD ?? 'skalean_test',
    database: process.env.DATABASE_NAME ?? 'skalean_test',
    synchronize: false,
    logging: false,
  });
  await dataSource.initialize();
});

afterAll(async () => {
  if (dataSource.isInitialized) {
    await dataSource.destroy();
  }
});

describe('helpers RLS integration', () => {
  it('positions app.current_tenant_id within transaction', async () => {
    const result = await withTenantContext(
      dataSource,
      {
        tenantId: '11111111-1111-1111-1111-111111111111',
        userId: null,
        assureUserId: null,
        isSuperAdmin: false,
      },
      async (manager) => {
        const rows = await manager.query(`SELECT current_setting('app.current_tenant_id', true) AS v`);
        return rows[0].v;
      },
    );
    expect(result).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('positions app.is_super_admin to true via withSuperAdmin', async () => {
    const result = await withSuperAdmin(dataSource, async (manager) => {
      const rows = await manager.query(`SELECT current_setting('app.is_super_admin', true) AS v`);
      return rows[0].v;
    });
    expect(result).toBe('true');
  });

  it('resets variables between transactions', async () => {
    await withTenantContext(
      dataSource,
      { tenantId: '11111111-1111-1111-1111-111111111111', userId: null, assureUserId: null, isSuperAdmin: false },
      async () => 'ok',
    );
    const after = await dataSource.query(`SELECT current_setting('app.current_tenant_id', true) AS v`);
    expect(['', null]).toContain(after[0].v);
  });
});
```

## 9. Variables environnement

| Variable | Type | Defaut | Description | Obligatoire | Confidentielle |
|----------|------|--------|-------------|-------------|----------------|
| `NODE_ENV` | string | development | Environnement applicatif (development, test, staging, production) | OUI | NON |
| `DATABASE_HOST` | string | pg-primary.atlas.skalean.ma | Hostname du serveur Postgres Atlas Cloud Services Maroc | OUI | NON |
| `DATABASE_PORT` | int | 5432 | Port TCP Postgres | OUI | NON |
| `DATABASE_USER` | string | skalean_app | Utilisateur Postgres applicatif (non super-user) | OUI | NON |
| `DATABASE_PASSWORD` | string | (vide) | Mot de passe Postgres applicatif (rotation 90 jours via Atlas Vault) | OUI | OUI |
| `DATABASE_NAME` | string | skalean_insurtech_dev | Nom de la base de donnees logique | OUI | NON |
| `DATABASE_SCHEMA` | string | public | Schema Postgres logique cible | NON | NON |
| `DATABASE_POOL_SIZE_MAX` | int | 20 | Taille maximale du pool de connexions par instance applicative | NON | NON |
| `DATABASE_POOL_SIZE_MIN` | int | 2 | Taille minimale du pool maintenue chaude | NON | NON |
| `DATABASE_POOL_IDLE_TIMEOUT_MS` | int | 30000 | Duree avant fermeture connexion idle | NON | NON |
| `DATABASE_POOL_CONNECTION_TIMEOUT_MS` | int | 5000 | Timeout d'acquisition d'une connexion du pool | NON | NON |
| `DATABASE_STATEMENT_TIMEOUT_MS` | int | 30000 | Timeout par requete SQL cote serveur Postgres | NON | NON |
| `DATABASE_LOG_QUERIES` | bool | false | Active le log SQL TypeORM (verbose, dev uniquement) | NON | NON |
| `DATABASE_LOG_SLOW_QUERY_THRESHOLD_MS` | int | 1000 | Seuil au dela duquel une requete est loguee comme lente | NON | NON |
| `TYPEORM_MIGRATIONS_DIR` | string | src/migrations | Chemin glob des migrations | NON | NON |
| `TYPEORM_ENTITIES_GLOB` | string | src/entities/**/*.entity.ts | Glob entites pour CLI | NON | NON |
| `TYPEORM_SUBSCRIBERS_GLOB` | string | src/subscribers/*.ts | Glob subscribers | NON | NON |
| `ATLAS_KMS_KEY_ID` | string | alias/skalean-database-encryption-key | Identifiant cle de chiffrement KMS Atlas pour TDE | OUI | OUI |
| `ATLAS_REGION` | string | ma-benguerir-1 | Region Atlas Cloud Services au Maroc | OUI | NON |
| `ATLAS_CLOUD_PROVIDER` | string | atlas | Fournisseur cloud souverain (decision-008) | OUI | NON |

## 10. Commandes shell

```bash
cd /workspace/skalean-insurtech

pnpm install --frozen-lockfile

pnpm --filter @insurtech/database typecheck

pnpm --filter @insurtech/database lint

pnpm --filter @insurtech/database build

pnpm --filter @insurtech/database test

pnpm --filter @insurtech/database test:coverage

pnpm --filter @insurtech/database run migration:show

grep -rE "TODO|FIXME|XXX" packages/database/src packages/database/tests || echo "no markers"

grep -rE "console\.(log|error|warn|info|debug)" packages/database/src || echo "no console"

node -e "const r=require('./packages/database/dist/index.js'); if(!r.BaseEntity||!r.withTenantContext||!r.withSuperAdmin) process.exit(1); console.log('exports ok');"

pnpm madge --circular packages/database/src

ls -la packages/database/src/entities/
ls -la packages/database/src/helpers/
ls -la packages/database/src/migrations/
ls -la packages/database/src/subscribers/
```

## 11. Criteres validation

### 11.1 Criteres P0 (bloquants)

| ID | Critere | Commande | Resultat attendu | Mode echec |
|----|---------|----------|------------------|------------|
| V1 | Le package compile | `pnpm --filter @insurtech/database build` | Code retour 0, dossier dist/ cree | Erreur TypeScript ou tsup |
| V2 | TypeScript strict valide | `pnpm --filter @insurtech/database typecheck` | Code retour 0 | Toute erreur tsc |
| V3 | Lint propre | `pnpm --filter @insurtech/database lint` | Code retour 0, 0 warning | Toute regle ESLint violee |
| V4 | Tests unitaires passent | `pnpm --filter @insurtech/database test` | >= 27 tests verts | Tout test rouge |
| V5 | BaseEntity exporte 5 colonnes | Inspection manuelle | id, tenant_id, created_at, updated_at, deleted_at | Colonne manquante |
| V6 | AuditableEntity exporte 7 colonnes | Inspection manuelle | BaseEntity + created_by + updated_by | Colonne manquante |
| V7 | withTenantContext throw si tenantId null sans super admin | Test unitaire | Throw avec message explicite | Pas de throw |
| V8 | withTenantContext execute 4 set_config | Test unitaire | mock.calls.length === 4 | Nombre incorrect |
| V9 | withSuperAdmin force is_super_admin = true | Test unitaire ou integration | current_setting === 'true' | Valeur incorrecte |
| V10 | Aucune emoji nulle part | Grep regex Unicode | 0 match | Match present |
| V11 | Aucun TODO/FIXME/XXX | `grep -rE "TODO\|FIXME\|XXX" packages/database/src` | 0 match | Match present |
| V12 | Aucun console.* | `grep -rE "console\\." packages/database/src` | 0 match | Match present |
| V13 | 9 dossiers modules existent | ls src/entities/ | 9 dossiers + base | Dossier manquant |
| V14 | Re-exports index.ts complets | Test unitaire import | BaseEntity, AuditableEntity, withTenantContext, withSuperAdmin importables | Import echoue |
| V15 | cli-data-source charge dotenv | Test integration | Pas de throw au import | Throw require env |
| V16 | DATABASE_HOST pointe Atlas Maroc | Inspection .env.example | atlas.skalean.ma | Hostname etranger |

### 11.2 Criteres P1

| ID | Critere | Commande | Resultat attendu | Mode echec |
|----|---------|----------|------------------|------------|
| V17 | Pas d'import circulaire | `pnpm madge --circular packages/database/src` | 0 cycle | Cycle detecte |
| V18 | Coverage >= 90% lines helpers | `pnpm test:coverage` | helpers >= 90% | Coverage faible |
| V19 | Build dist/ < 100 ko | `du -sh packages/database/dist` | < 100 ko | Build lourd |
| V20 | Migration:show sans erreur | `pnpm migration:show` | "No migrations are pending" | Erreur ENOENT |
| V21 | Tests integration RLS verts | Vitest int | Variables session positionnees | Variable vide |
| V22 | TenantContext interface immutable | Compilation TypeScript | readonly champs | Champ mutable |
| V23 | Subscribers folder existe | ls src/subscribers/ | .gitkeep present | Dossier absent |
| V24 | Migrations folder existe | ls src/migrations/ | .gitkeep present | Dossier absent |

### 11.3 Criteres P2

| ID | Critere | Commande | Resultat attendu | Mode echec |
|----|---------|----------|------------------|------------|
| V25 | Documentation JSDoc presente | Grep `\/\*\*` dans helpers | >= 6 blocs JSDoc | Doc absente |
| V26 | Tests utilisent describe/it | Inspection tests | 100% via describe + it | Style mixte |
| V27 | Logger Pino utilise | Grep `import.*logger.*@insurtech/logger` | Present dans helpers | winston ou console |
| V28 | .env.example > 15 vars | wc -l < .env.example | >= 15 lignes non vides | Liste incomplete |
| V29 | package.json scripts CLI | Inspection scripts | 7 scripts migration:* + seeds:* | Scripts manquants |

## 12. Edge cases

### Edge case 1 -- Pool exhaustion sous charge

Scenario : 200 appels concurrents `withTenantContext` arrivent en simultane sur un pool de 20 connexions.

Probleme : Si chaque appel ouvre une transaction et attend une connexion, le pool sature au-dela de 20 et les requetes 21+ attendent jusqu'a `connectionTimeoutMillis` (5000 ms) puis throw.

Solution : Configurer un pool genereux mais raisonnable (`DATABASE_POOL_SIZE_MAX=20` par instance, multipliee par N instances applicatives). Ajouter un middleware applicatif (Sprint 1.x) qui rejette en 503 si la latence d'acquisition depasse 1 sec. Tester avec un load test 200 RPS pendant 60 sec et verifier que p95 latency reste sous 200 ms.

### Edge case 2 -- tenantId NULL en super admin avec entite tenant-scoped

Scenario : Un super admin appelle un service qui doit lire la table `users` (qui a tenant_id NOT NULL et policy RLS).

Probleme : Avec `tenantId = null` et `isSuperAdmin = true`, la policy `tenant_isolation` retourne tous les rows (bypass via `is_super_admin`). Mais si le super admin veut filtrer un tenant precis, il doit le faire via WHERE clause explicite.

Solution : Documenter que le super admin DOIT fournir un `WHERE tenant_id = '...'` explicite quand il agit sur un tenant precis. Le helper `withTenantContext` accepte la combinaison `tenantId != null && isSuperAdmin = true` mais log un warning.

### Edge case 3 -- Transaction nested

Scenario : Un service appelle `withTenantContext(...)` puis a l'interieur du callback appelle un autre service qui rappelle `withTenantContext(...)`.

Probleme : TypeORM ne supporte pas nativement les nested transactions sur Postgres avec savepoints automatiques. Le second `withTenantContext` ouvrira une nouvelle transaction independante (nouvelle connection du pool), ce qui consomme deux connexions et risque deadlock.

Solution : Le service interne doit accepter un `EntityManager` optionnel en parametre. S'il est fourni, il l'utilise sans rappeler `withTenantContext`. Sinon, il appelle `withTenantContext`. Cette convention est documentee dans le guide `docs/conventions/database-helpers.md` (cree par tache ulterieure).

### Edge case 4 -- queryRunner non libere

Scenario : Un developpeur utilise `dataSource.createQueryRunner()` directement au lieu du helper et oublie `await queryRunner.release()`.

Probleme : Chaque appel consomme une connexion sans la liberer, le pool sature en quelques minutes en production.

Solution : Le linter custom (Sprint 9.x) detecte les usages directs de `createQueryRunner()` hors du package database et echoue le build. Le code review impose que tout usage manuel soit dans un `try { ... } finally { await queryRunner.release(); }`.

### Edge case 5 -- decorators TypeORM 0.3 vs 0.2

Scenario : Un developpeur copie-colle un exemple TypeORM 0.2 trouve sur Stack Overflow avec `@OneToMany(() => Foo, (foo) => foo.bar)` mais sans nullable explicite.

Probleme : TypeORM 0.3 exige des proprietes nouvelles (eager: false explicite recommande, cascade explicite). Comportements par defaut differents.

Solution : Document `docs/conventions/typeorm-03-decorators.md` (Sprint 2.x) qui rappelle les changements 0.2 -> 0.3. Tests `vitest` avec entites de demonstration qui valident le comportement attendu.

### Edge case 6 -- pgcrypto absent

Scenario : Un nouveau developpeur cree une nouvelle base locale sans avoir execute la migration 001 qui active pgcrypto.

Probleme : Toute insertion d'entite via TypeORM avec `@PrimaryGeneratedColumn('uuid')` echoue car la fonction d'extension n'est pas disponible.

Solution : La migration 001 (tache 1.2.2) execute `CREATE EXTENSION IF NOT EXISTS pgcrypto`. Le script de bootstrap dev `pnpm db:bootstrap` execute automatiquement les migrations apres `createdb`. Documentation README dedicacee.

### Edge case 7 -- soft delete sur entite avec FK

Scenario : Une entite `Contract` a une FK `clientId` vers `Client`. On softRemove un Client. Le Contract pointe encore sur le Client deleted_at.

Probleme : Comportement legitime (preserver historique) mais peut surprendre. Les requetes contracts.find() retournent des contracts referencant des clients soft-deleted.

Solution : Documenter pattern : utiliser `relations: ['client']` avec `withDeleted: true` quand on veut voir les clients soft-deleted. Sinon les jointures TypeORM excluent par defaut. Pour les rapports compta (loi 9-88 CGNC), toujours inclure soft-deleted.

### Edge case 8 -- emoji dans variable d'environnement

Scenario : Un developpeur Mac copie-colle un mot de passe contenant un emoji depuis un gestionnaire de mots de passe.

Probleme : Le pre-commit hook ne scanne pas .env (gitignored). Le mot de passe avec emoji peut casser parsing dotenv.

Solution : Convention -- mots de passe ASCII uniquement (alphanum + ponctuation). Documentation onboarding. dotenv supporte unicode mais Skalean impose ASCII pour traceabilite logs.

### Edge case 9 -- Concurrence sur set_config

Scenario : Deux requetes simultanees sur la meme connexion physique du pool veulent des tenant_id differents.

Probleme : Si une connexion est partagee entre deux requetes (ce qui ne devrait pas arriver avec TypeORM transaction qui reserve la connexion), les SET LOCAL pourraient se chevaucher.

Solution : `dataSource.transaction()` reserve une connexion exclusivement pour la duree de la transaction. Aucun risque de chevauchement. Test integration verifie ce comportement.

### Edge case 10 -- Migration en environnement production

Scenario : `pnpm migration:run` est lance manuellement en production sans verifier l'etat des migrations.

Probleme : Si une migration a ete partiellement appliquee (crash au milieu), le state est incoherent.

Solution : `pnpm migration:show` AVANT et APRES. Les migrations DOIVENT etre transactionnelles (CREATE TABLE est transactionnel sur Postgres). Pour les migrations non transactionnelles (CREATE INDEX CONCURRENTLY), utiliser un mecanisme explicite documente.

## 13. Conformite Maroc detaillee

### 13.1 Loi 09-08 CNDP -- protection donnees personnelles

La loi n. 09-08 du 18 fevrier 2009 relative a la protection des personnes physiques a l'egard du traitement des donnees a caractere personnel impose plusieurs obligations dont la tache 1.2.1 etablit les fondations techniques. Article 17 (proportionnalite) : la colonne `tenant_id` permet de garantir qu'aucun traitement ne deborde du perimetre du courtier responsable du traitement. Article 23 (mesures de securite) : le helper `withTenantContext` materialise les "mesures techniques appropriees" exigees par la loi en s'appuyant sur les Row-Level Security policies Postgres. Les mesures sont auditables (test integration helpers-rls.int.test.ts), reproductibles (helpers utilises systematiquement) et conservees (logs Pino structures).

Article 51 (sanctions) : les sanctions pecuniaires CNDP peuvent atteindre 300 000 MAD par infraction et 1 000 000 MAD pour les recidives, plus la responsabilite penale du dirigeant. La discipline d'usage des helpers est donc P0 absolu. La data residency Atlas Cloud Services Benguerir (decision-008) repond a l'article 43 sur le transfert de donnees vers l'etranger.

### 13.2 Loi 9-88 CGNC -- code general de normalisation comptable

La loi n. 9-88 relative aux obligations comptables des commerçants, et plus largement le Code General de Normalisation Comptable (CGNC) marocain, imposent la conservation des pieces comptables pendant 10 ans. La colonne `deleted_at` (`@DeleteDateColumn`) permet le soft delete obligatoire pour les pieces comptables : elles ne peuvent etre supprimees physiquement avant 10 ans. La colonne `created_at` et `updated_at` (timestamptz) fournissent l'horodatage requis pour l'audit comptable.

Le pattern `AuditableEntity` avec `created_by` et `updated_by` prepare l'audit trail Sprint 12 (tache 12.x.x AuditLog complet) qui materialisera les exigences de tracabilite des operations comptables des futures Sprints 7 (Pay) et 8 (Books).

### 13.3 Code des assurances loi 17-99

Le Code des Assurances marocain (loi 17-99) impose aux courtiers la conservation des contrats d'assurance pendant 10 ans apres expiration et la tracabilite des modifications. La structure `AuditableEntity` est la base technique de cette tracabilite. Les migrations futures (Sprint 3 Booking, contrats d'assurance) utiliseront cette base.

### 13.4 Autres lois pertinentes

| Loi | Domaine | Impact tache 1.2.1 |
|-----|---------|---------------------|
| Loi 17-95 (SA) | Societes anonymes | Audit trail directeur via AuditableEntity |
| Loi 31-08 | Protection consommateur | Tracabilite assure_user_id pour reclamations |
| Loi 78-12 | Construction | Hors scope tache |
| Loi 88-13 | Presse en ligne | Hors scope tache |
| Loi 53-95 | TGI commercial | Conservation pieces (deleted_at soft delete) |
| Loi 43-05 | Anti-blanchiment | Audit trail financier futur (Sprint 12) |
| Decret 2-09-165 | Application 09-08 | Mesures techniques (withTenantContext) |

## 14. Conventions absolues skalean-insurtech

1. **Multi-tenant strict** -- Toutes les requetes metier passent obligatoirement par `withTenantContext(dataSource, ctx, callback)`. Le `ctx.tenantId` provient du header HTTP `x-tenant-id` valide cote API gateway (Sprint 1.x). Aucune query sans contexte tenant.
2. **Validation Zod** -- Tous les boundaries IO (HTTP body, query params, headers, env vars critiques, messages Kafka, callbacks externes) sont valides par schema Zod 3.23+. Joi et yup sont interdits.
3. **Logger Pino** -- Toutes les traces applicatives utilisent le logger Pino structure JSON expose par `@insurtech/logger`. Winston, bunyan, console et debug sont interdits.
4. **Argon2id** -- Tout hashing de mot de passe ou secret utilisateur utilise argon2id avec parametres NIST 2024 (memoryCost 65536, timeCost 3, parallelism 4). bcrypt, sha256, md5, scrypt sont interdits pour les mots de passe.
5. **pnpm strict** -- Le monorepo utilise exclusivement pnpm 9.12+. Les fichiers `package-lock.json` (npm) et `yarn.lock` (yarn) sont interdits et detectes par hook pre-commit.
6. **TypeScript strict total** -- `tsconfig.json` racine impose `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`, `noUncheckedIndexedAccess: true`, `noImplicitReturns: true`, `noFallthroughCasesInSwitch: true`, `noPropertyAccessFromIndexSignature: true`. Aucun `any` non justifie par un commentaire.
7. **Tests Vitest** -- Tous les tests unitaires et integration utilisent Vitest 2.x. Jest, mocha, ava sont interdits. Tests organises dans `tests/unit/` et `tests/integration/`. Tests de bout en bout dans `tests/e2e/` (Sprint dedies).
8. **RBAC 12 roles** -- L'authorisation s'appuie sur 12 roles standardises : super_admin, courtier_admin, courtier_manager, courtier_collaborateur, courtier_comptable, courtier_compliance_officer, courtier_assistant, assure_titulaire, assure_beneficiaire, assure_lecteur, partenaire_assureur, prestataire_externe. Definis Sprint 2 tache 1.2.5.
9. **Events Kafka** -- Les evenements Kafka suivent le format de topic `insurtech.events.{vertical}.{entity}.{action}` ou vertical = system|crm|booking|comm|docs|pay|books|compliance|analytics. Exemple : `insurtech.events.crm.client.created`. Defini Sprint 2 tache 1.3.x.
10. **Imports @insurtech/*** -- Les packages partages se referencent par alias `@insurtech/<name>` (workspace pnpm). Aucun chemin relatif inter-packages. Aucun import direct depuis `node_modules` interne.
11. **Skalean AI frontier (decision-005)** -- Tous les choix techniques privilegient l'integration future d'IA generative (LLM Anthropic Claude, embeddings, vector store pgvector). Cela impose : types forts, schemas Zod auto-derivables, JSDoc riche, evenements Kafka schemes, traceabilite forte.
12. **No-emoji absolu (decision-006)** -- Aucune emoji n'est admise dans le code, les commentaires, les commits, les noms de variables, les logs, les tests, la documentation, les commentaires de PR. Hook pre-commit grep Unicode obligatoire.
13. **Idempotency-Key** -- Toutes les requetes HTTP POST/PUT/PATCH cote API metier supportent un header `Idempotency-Key` (UUID v4) stocke en cache 24h pour deduplication. Implementation Sprint 2.x.
14. **Conventional Commits** -- Tous les commits suivent le format `<type>(<scope>): <subject>` plus body et footer obligatoires. Footer doit contenir `Task: X.Y.Z`, `Sprint: N`, `Phase: M`. Hooks commit-msg via commitlint.
15. **Cloud souverain Maroc (decision-008)** -- Toute infrastructure de production tourne sur Atlas Cloud Services a Benguerir (region ma-benguerir-1) avec replication intra-Maroc. Aucun service AWS/GCP/Azure non-Marocain en production sans accord prealable CNDP.
16. **Conformite legale 9 lois MA** -- Le code est ecrit en pensant aux 9 lois marocaines pertinentes (09-08, 9-88, 17-99, 17-95, 31-08, 53-95, 43-05, 31-08, decret 2-09-165). Documentation legal-mapping a chaque tache.

## 15. Validation pre-commit

```bash
pnpm --filter @insurtech/database typecheck
pnpm --filter @insurtech/database lint
pnpm --filter @insurtech/database test

grep -rP "[\x{1F300}-\x{1FAFF}]|[\x{2600}-\x{27BF}]" packages/database/src packages/database/tests && exit 1 || true

grep -rE "TODO|FIXME|XXX|HACK" packages/database/src packages/database/tests && exit 1 || true

grep -rE "console\.(log|error|warn|info|debug)" packages/database/src && exit 1 || true

grep -rE "import.*from.*winston" packages/database/src && exit 1 || true

grep -rE "@ts-ignore|@ts-nocheck" packages/database/src && exit 1 || true

pnpm madge --circular packages/database/src
```

Lefthook configuration `lefthook.yml` (extrait pertinent) :

```yaml
pre-commit:
  parallel: true
  commands:
    typecheck-database:
      glob: "packages/database/**/*.ts"
      run: pnpm --filter @insurtech/database typecheck
    lint-database:
      glob: "packages/database/**/*.{ts,json}"
      run: pnpm --filter @insurtech/database lint
    no-emoji-database:
      glob: "packages/database/**/*.{ts,json,md}"
      run: |
        if grep -rP "[\x{1F300}-\x{1FAFF}]|[\x{2600}-\x{27BF}]" {staged_files}; then
          echo "Emoji detected in staged files. Skalean InsurTech convention forbids emojis."
          exit 1
        fi
    no-todo-database:
      glob: "packages/database/**/*.ts"
      run: |
        if grep -rE "TODO|FIXME|XXX|HACK" {staged_files}; then
          echo "TODO/FIXME/XXX/HACK markers are forbidden in production code."
          exit 1
        fi
```

## 16. Commit message Conventional Commits

```
feat(database): add BaseEntity AuditableEntity and multi-tenant helpers

Enrich the @insurtech/database package with the foundational layer required
by all future Sprint 2+ entities and migrations:

  - BaseEntity abstract class with id (uuid), tenant_id (uuid not null),
    created_at, updated_at, deleted_at (soft delete via DeleteDateColumn).
  - AuditableEntity abstract class extending BaseEntity with created_by
    and updated_by columns for audit trail (loi 9-88 CGNC).
  - withTenantContext helper opening a transaction and positioning the
    four Postgres session variables app.current_tenant_id, app.is_super_admin,
    app.current_user_id and app.assure_user_id consumed by RLS policies.
  - withSuperAdmin helper opening a transaction with is_super_admin true
    for global system operations.
  - cli-data-source.ts dedicated to TypeORM CLI commands using ts-node.
  - Nine module folders (system, crm, booking, comm, docs, pay, books,
    compliance, analytics) with empty index.ts, ready to host entities.
  - Empty migrations/ and subscribers/ folders (populated by tasks 1.2.2
    and 1.2.9 respectively).
  - Vitest unit and integration tests covering 27+ scenarios with 100 percent
    line coverage on helpers.

Conformity loi 09-08 CNDP article 23 (technical security measures), loi 9-88
CGNC (audit trail preparation), decision-002 Postgres RLS strict, decision-003
multi-tenant 3 levels, decision-006 no-emoji, decision-008 data residency
Atlas Cloud Services Benguerir.

Task: 1.2.1
Sprint: 2
Phase: 1
Backlog-Reference: B-02
Effort-Estimated: 6h
Effort-Actual: TBD
Decisions: decision-002, decision-003, decision-005, decision-006, decision-008
Conformity: loi-09-08, loi-9-88, loi-17-99, loi-17-95
Reviewer: TBD
```

## 17. Workflow next step

Apres validation de la tache 1.2.1 (tous les criteres P0 verts, P1 a 90%+, P2 a 70%+) et merge de la PR sur la branche `main` du monorepo `skalean-insurtech`, le workflow continue avec :

**Tache 1.2.2 -- Premiere migration init pgcrypto + extension Postgres**

Fichier prompt : `00-pilotage/prompts-taches/sprint-02-database-kafka/task-1.2.2-migration-001-init-extensions-postgres.md`

Resume : Creer la premiere migration TypeORM `001_init_extensions.ts` qui execute `CREATE EXTENSION IF NOT EXISTS pgcrypto`, `CREATE EXTENSION IF NOT EXISTS uuid-ossp`, `CREATE EXTENSION IF NOT EXISTS pg_trgm` et prepare les fonctions PL/pgSQL `set_updated_at_column()` reutilisable par les triggers BEFORE UPDATE des migrations futures. Inclut tests integration sur base reelle.

Dependance amont : tache 1.2.1 terminee (cli-data-source.ts fonctionnelle, migration:show repond OK).

Dependance avale immediate : tache 1.2.3 (TenantEntity) qui necessite que pgcrypto soit disponible pour `gen_random_uuid()`.

Branche feature suggeree : `feat/sprint-2/task-1.2.2-init-extensions`.

Effort estime : 2h30.
Priorite : P0.

## 18. Annexe A -- Script de bootstrap developpeur local

Le script suivant doit etre cree dans `packages/database/scripts/bootstrap-local.sh` (rendu executable par `chmod +x`). Il automatise la mise en place d'une base Postgres locale fonctionnelle pour un nouveau developpeur Skalean.

```bash
#!/usr/bin/env bash

set -euo pipefail

DB_NAME="${DATABASE_NAME:-skalean_insurtech_dev}"
DB_USER="${DATABASE_USER:-skalean_app}"
DB_PASSWORD="${DATABASE_PASSWORD:-skalean_app_local}"
DB_HOST="${DATABASE_HOST:-localhost}"
DB_PORT="${DATABASE_PORT:-5432}"
DB_SUPER="${DATABASE_SUPER_USER:-postgres}"

echo "Skalean InsurTech database bootstrap (development only)."
echo "Target host: ${DB_HOST}:${DB_PORT}"
echo "Target database: ${DB_NAME}"
echo "Target application user: ${DB_USER}"

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found in PATH. Install postgresql-client first."
  exit 1
fi

echo "Step 1: ensure application user exists"
PGPASSWORD="${DATABASE_SUPER_PASSWORD:-postgres}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_SUPER}" -d postgres -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
  END IF;
END
\$\$;
SQL

echo "Step 2: create database if missing"
PGPASSWORD="${DATABASE_SUPER_PASSWORD:-postgres}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_SUPER}" -d postgres -v ON_ERROR_STOP=1 -tAc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1 \
  || PGPASSWORD="${DATABASE_SUPER_PASSWORD:-postgres}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_SUPER}" -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}"

echo "Step 3: ensure extensions on target database"
PGPASSWORD="${DATABASE_SUPER_PASSWORD:-postgres}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_SUPER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 <<SQL
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
SQL

echo "Step 4: grant schema usage to application user"
PGPASSWORD="${DATABASE_SUPER_PASSWORD:-postgres}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_SUPER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 <<SQL
GRANT USAGE ON SCHEMA public TO ${DB_USER};
GRANT CREATE ON SCHEMA public TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO ${DB_USER};
SQL

echo "Bootstrap completed. You can now run pnpm migration:run from packages/database."
```

Ce script ne fait pas partie strictement de la tache 1.2.1 mais il est cree car il accelere l'onboarding et il sera reutilise par les taches 1.2.2 a 1.2.16. Il est documente dans le README package (mise a jour Sprint 2 tache 1.2.16).

## 19. Annexe B -- Schema Zod de validation TenantContext

La tache 1.2.1 ne cree pas de validation Zod runtime sur `TenantContext` (le contrat est un type TypeScript pur). Toutefois, pour preparer les taches API du Sprint 2.x, on prevoit un schema Zod equivalent qui sera ajoute en tache 1.2.x ulterieure dans le package `@insurtech/core` :

```typescript
import { z } from 'zod';

export const tenantContextSchema = z.object({
  tenantId: z.string().uuid().nullable(),
  userId: z.string().uuid().nullable(),
  assureUserId: z.string().uuid().nullable(),
  isSuperAdmin: z.boolean(),
}).superRefine((value, ctx) => {
  if (value.tenantId === null && !value.isSuperAdmin) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'tenantId cannot be null unless isSuperAdmin is true',
      path: ['tenantId'],
    });
  }
});

export type TenantContextValidated = z.infer<typeof tenantContextSchema>;
```

Le schema Zod sera utilise dans les middlewares HTTP pour valider que l'extraction du contexte tenant est coherente avant tout appel a `withTenantContext`. Cela donne une defense en profondeur : une erreur applicative qui produirait un `TenantContext` invalide serait rejetee au boundary HTTP avant meme d'atteindre la couche database.

## 20. Annexe C -- Mapping decisions architecturales

### 20.1 decision-002 -- Postgres RLS strict

Le document `decisions-architecturales/decision-002-postgres-rls-strict.md` (cree Sprint 1) impose que la securite multi-tenant ne soit JAMAIS basee sur des filtres applicatifs (oubliables) mais TOUJOURS sur des policies Postgres Row-Level Security. Cette tache 1.2.1 materialise cette decision en fournissant l'unique mecanisme licite pour positionner les variables de session que les policies vont consommer. Toute requete metier hors `withTenantContext`/`withSuperAdmin` est par definition une violation de decision-002.

Implications concretes :
- Les policies RLS auront un USING clause base sur `current_setting('app.current_tenant_id', true)::uuid`.
- Les policies WITH CHECK identique pour empecher l'INSERT cross-tenant.
- Le superuser Postgres (utilise par migrations CLI) bypasse RLS par defaut. C'est OK pour migrations DDL.
- L'utilisateur applicatif `skalean_app` n'est PAS superuser et est donc soumis aux policies RLS.
- Le helper `withSuperAdmin` ne change pas l'utilisateur Postgres, il positionne `app.is_super_admin = 'true'` que la policy interprete comme bypass logique.

### 20.2 decision-003 -- Multi-tenant 3 niveaux

Le document `decisions-architecturales/decision-003-multi-tenant-3-niveaux.md` definit les 3 niveaux d'isolement :

1. **Super admin global** -- Personnel Skalean. Acces toutes les bases de tous les tenants. Audite. Identifie par `is_super_admin = true`.
2. **Tenant courtier** -- Une societe de courtage cliente. Isolee de tous les autres tenants par `tenant_id`. Identifie par `current_tenant_id = '<uuid>'`.
3. **Assure final** -- Un client final d'un courtier. Isole des autres assures du meme tenant par `assure_user_id`. Identifie par `current_tenant_id = '<uuid>' AND assure_user_id = '<uuid>'`.

Cette tache 1.2.1 implemente les variables de session correspondantes : `app.is_super_admin`, `app.current_tenant_id`, `app.current_user_id`, `app.assure_user_id`. Le 4e champ `app.current_user_id` n'est pas pour l'isolation mais pour l'audit trail (qui a fait quoi).

### 20.3 decision-005 -- Skalean AI frontier

Le document `decisions-architecturales/decision-005-skalean-ai-frontier.md` impose que tout artefact technique soit prepare pour integration LLM future. Dans la tache 1.2.1, cela se traduit par :

- Types TypeScript stricts (LLM peut generer des extensions correctes).
- JSDoc riche sur chaque export public (LLM peut documenter et expliquer).
- Schemes Zod auto-derivables depuis interfaces (preparation autocompletion AI).
- Naming conventions explicites snake_case DB / camelCase TS (LLM applique convention).

### 20.4 decision-006 -- No-emoji absolu

Le document `decisions-architecturales/decision-006-no-emoji-absolu.md` interdit toute emoji. Justifications :
- Parsing logs : emojis multi-byte cassent certains parsers ASCII-only.
- Administrations marocaines : preferent ASCII pur (CNDP, ACAPS, DGI).
- Code review : evite distractions visuelles, focus sur logique.
- Internationalisation : emojis ont des connotations differentes selon cultures.
- Securite : emojis homoglyphes peuvent masquer du code malveillant.

Cette tache 1.2.1 verifie l'absence d'emoji par grep Unicode pre-commit et test unitaire dedie (voir tests/unit/structure.test.ts).

### 20.5 decision-008 -- Data residency Atlas Cloud Services Benguerir

Le document `decisions-architecturales/decision-008-data-residency-atlas-benguerir.md` impose que toute donnee personnelle traitee par le SaaS Skalean reside au Maroc, dans la region Atlas Cloud Services Benguerir, et que toute replication soit intra-Maroc (Casablanca DR). Implications :

- `DATABASE_HOST` pointe sur un endpoint `*.atlas.skalean.ma`.
- Aucune connection Postgres directe vers AWS, GCP, Azure non-Marocains en production.
- Les sauvegardes sont stockees sur Atlas Object Storage (region ma-benguerir-1 + ma-casablanca-1).
- Les exports de donnees personnelles sont audites et necessitent accord CNDP article 43 si destination hors Maroc.

La tache 1.2.1 prepare cette conformite via le `.env.example` qui pointe explicitement sur `pg-primary.atlas.skalean.ma` et via les variables `ATLAS_REGION=ma-benguerir-1`, `ATLAS_CLOUD_PROVIDER=atlas`.

## 21. Annexe D -- Exemple complet d'utilisation des helpers

Pour illustrer l'usage attendu des helpers dans un service applicatif futur (Sprint 2.x), voici un exemple complet TypeScript executable une fois les entites users disponibles (tache 1.2.4) :

```typescript
import { dataSource, withTenantContext, withSuperAdmin } from '@insurtech/database';
import { logger } from '@insurtech/logger';
import type { TenantContext } from '@insurtech/database';

// Service tenant-scoped : recuperer un utilisateur par email dans le tenant courant.
export async function findUserByEmail(
  ctx: TenantContext,
  email: string,
): Promise<{ id: string; email: string; tenantId: string } | null> {
  return withTenantContext(dataSource, ctx, async (manager) => {
    const rows = await manager.query<Array<{ id: string; email: string; tenant_id: string }>>(
      `SELECT id, email, tenant_id FROM users WHERE email = $1 LIMIT 1`,
      [email],
    );
    if (rows.length === 0) {
      return null;
    }
    const row = rows[0];
    return { id: row.id, email: row.email, tenantId: row.tenant_id };
  });
}

// Service super admin : lister tous les tenants pour le panel super admin.
export async function listAllTenants(): Promise<Array<{ id: string; name: string }>> {
  return withSuperAdmin(dataSource, async (manager) => {
    const rows = await manager.query<Array<{ id: string; name: string }>>(
      `SELECT id, name FROM tenants WHERE deleted_at IS NULL ORDER BY name ASC`,
    );
    return rows;
  });
}

// Cas combine : super admin agissant sur un tenant precis pour support technique.
export async function impersonateTenant(
  superAdminUserId: string,
  targetTenantId: string,
): Promise<{ userCount: number }> {
  logger.warn(
    { superAdminUserId, targetTenantId, action: 'impersonate' },
    'super admin impersonation event',
  );
  const ctx: TenantContext = {
    tenantId: targetTenantId,
    userId: superAdminUserId,
    assureUserId: null,
    isSuperAdmin: true,
  };
  return withTenantContext(dataSource, ctx, async (manager) => {
    const rows = await manager.query<Array<{ count: string }>>(
      `SELECT COUNT(*)::text AS count FROM users WHERE tenant_id = $1`,
      [targetTenantId],
    );
    return { userCount: Number.parseInt(rows[0].count, 10) };
  });
}
```

Cet exemple n'est pas a livrer dans la tache 1.2.1 (les entites users n'existent pas encore) mais sert de reference pour les developpeurs qui consommeront le package dans les sprints suivants.

## 22. Annexe E -- Checklist exhaustive de revue de code

Le reviewer de la PR de la tache 1.2.1 verifie point par point la liste suivante :

### 22.1 Structure du package

- [ ] Le `package.json` declare bien la version `0.2.0` (passage de 0.1.0 Sprint 1 a 0.2.0 Sprint 2).
- [ ] Les dependances `typeorm`, `pg`, `reflect-metadata` sont en `dependencies` (pas devDependencies) car runtime.
- [ ] `typeorm-ts-node-commonjs` est en `devDependencies` car CLI uniquement.
- [ ] Les peerDependencies sont declarees pour eviter doublons.
- [ ] Le champ `engines.node` exige `>=20.18.0`.
- [ ] Le champ `engines.pnpm` exige `>=9.12.0`.
- [ ] Le champ `private: true` empeche publication accidentelle.
- [ ] Le champ `publishConfig.access: restricted` (defense en profondeur).

### 22.2 BaseEntity

- [ ] Classe declaree `abstract` (impossible d'instancier directement).
- [ ] `@PrimaryGeneratedColumn('uuid')` sur id (pas `'increment'`).
- [ ] `@Column({ name: 'tenant_id', type: 'uuid', nullable: false })` sur tenantId.
- [ ] `@Index('idx_base_tenant_id')` pour optimiser les requetes RLS (chaque table heritera).
- [ ] `@CreateDateColumn` sur createdAt avec type timestamptz et default now().
- [ ] `@UpdateDateColumn` sur updatedAt avec type timestamptz et default now().
- [ ] `@DeleteDateColumn` sur deletedAt avec type timestamptz nullable.
- [ ] Le mapping snake_case <-> camelCase est coherent.
- [ ] Les types TypeScript sont corrects (string pour uuid, Date pour timestamps).
- [ ] JSDoc bloc complet en tete de classe avec rationale.

### 22.3 AuditableEntity

- [ ] Extends BaseEntity (heritage TypeORM correct).
- [ ] `created_by` et `updated_by` en uuid nullable.
- [ ] Les FK vers users(id) ne sont PAS encore declarees (table users absente).
- [ ] JSDoc explique le rationale audit trail.
- [ ] La classe est bien `abstract`.

### 22.4 withTenantContext

- [ ] Signature avec generics `<T>` correctement typee.
- [ ] Premiere etape : verification `dataSource.isInitialized`.
- [ ] Deuxieme etape : validation defensive ctx.tenantId / ctx.isSuperAdmin.
- [ ] Troisieme etape : warning log si super admin sur tenant precis.
- [ ] Quatrieme etape : appel `dataSource.transaction(callback)`.
- [ ] Dans la transaction : 4 set_config separes (tenant, super, user, assure).
- [ ] Utilisation de `set_config` (et non `SET LOCAL`) pour parametrage par bind.
- [ ] Le 3e parametre `true` de set_config indique "is_local = true" (transaction-scoped).
- [ ] Log debug avec contexte structure Pino.
- [ ] Retourne le resultat du callback identite.
- [ ] Aucun catch direct (laisse propager pour rollback automatique).

### 22.5 withSuperAdmin

- [ ] Signature `<T>` correcte.
- [ ] Verification `dataSource.isInitialized`.
- [ ] Warning log obligatoire (audit trail super admin).
- [ ] Transaction avec 4 set_config (super=true, tenant=null, user=null, assure=null).
- [ ] Aucun input ctx (super admin n'a pas de tenant).
- [ ] Documentation explicite sur l'usage restreint.

### 22.6 cli-data-source

- [ ] Charge `dotenv` en debut de fichier.
- [ ] Utilise `requireEnv` pour les vars critiques.
- [ ] Pointe sur `src/**/*.ts` (pas dist).
- [ ] `synchronize: false` (jamais en prod).
- [ ] `migrationsRun: false` (l'execution est explicite via CLI).
- [ ] `uuidExtension: 'pgcrypto'` (decision-002 + 1.2.2).
- [ ] Export default pour compatibilite typeorm CLI.

### 22.7 data-source (mise a jour)

- [ ] Pointe sur `dist/**/*.js`.
- [ ] Pool configure via env vars avec defauts raisonnables.
- [ ] Statement timeout pour eviter requetes infinies.
- [ ] Fonction `initializeDataSource` idempotente.
- [ ] Fonction `destroyDataSource` idempotente.
- [ ] Logger Pino present.

### 22.8 Tests

- [ ] Tests unitaires withTenantContext >= 12 cas.
- [ ] Tests unitaires withSuperAdmin >= 5 cas.
- [ ] Tests structure dossiers >= 5 cas (presence fichiers, pas d'emoji, pas de console).
- [ ] Tests integration BaseEntity >= 5 cas (insert/select/update/softDelete/restore).
- [ ] Tests integration helpers RLS >= 3 cas (set_config positionne correctement).
- [ ] Mocks isoles (pas d'effet de bord entre tests).
- [ ] beforeAll/afterAll bien geres (initialize/destroy).
- [ ] Coverage >= 90% sur helpers.

### 22.9 Documentation

- [ ] README package mis a jour (sera tache 1.2.16 finale).
- [ ] JSDoc sur chaque export public.
- [ ] Pas d'emoji dans documentation.
- [ ] References decisions architecturales mentionnees.
- [ ] Conformite legale Maroc mentionnee.

### 22.10 Conformite globale

- [ ] Aucun emoji dans tout le diff.
- [ ] Aucun TODO/FIXME/XXX/HACK.
- [ ] Aucun console.log/error/warn/info/debug.
- [ ] Aucun `any` non documente.
- [ ] Aucun `// @ts-ignore`/`// @ts-nocheck`.
- [ ] Conventional Commits respectes.
- [ ] Branche feature nommee correctement.
- [ ] CI/CD pipeline passe (build + lint + test).
- [ ] PR approuvee par 2 reviewers (techlead + architect ou senior).

## 23. Annexe F -- Tests additionnels supplementaires

En complement des tests deja decrits, les tests suivants sont ajoutes pour atteindre la couverture exigee.

### 23.1 tests/unit/with-tenant-context.test.ts (cas additionnels)

```typescript
import { describe, it, expect, vi } from 'vitest';
import type { DataSource } from 'typeorm';
import { withTenantContext } from '../../src/helpers/with-tenant-context';
import type { TenantContext } from '../../src/types/tenant-context';

describe('withTenantContext additional cases', () => {
  it('handles undefined ctx fields gracefully via type contract', async () => {
    const manager = { query: vi.fn().mockResolvedValue([]) };
    const ds = {
      isInitialized: true,
      transaction: vi.fn(async (cb: (m: typeof manager) => Promise<unknown>) => cb(manager)),
    };
    const ctx: TenantContext = {
      tenantId: '11111111-1111-1111-1111-111111111111',
      userId: null,
      assureUserId: null,
      isSuperAdmin: false,
    };
    const result = await withTenantContext(
      ds as unknown as DataSource,
      ctx,
      async () => 42,
    );
    expect(result).toBe(42);
  });

  it('rejects when callback throws synchronously', async () => {
    const manager = { query: vi.fn().mockResolvedValue([]) };
    const ds = {
      isInitialized: true,
      transaction: vi.fn(async (cb: (m: typeof manager) => Promise<unknown>) => cb(manager)),
    };
    const ctx: TenantContext = {
      tenantId: '11111111-1111-1111-1111-111111111111',
      userId: null,
      assureUserId: null,
      isSuperAdmin: false,
    };
    await expect(
      withTenantContext(ds as unknown as DataSource, ctx, () => {
        throw new Error('sync fail');
      }),
    ).rejects.toThrow('sync fail');
  });

  it('preserves manager identity across nested awaits in callback', async () => {
    const manager = { query: vi.fn().mockResolvedValue([]) };
    const ds = {
      isInitialized: true,
      transaction: vi.fn(async (cb: (m: typeof manager) => Promise<unknown>) => cb(manager)),
    };
    const ctx: TenantContext = {
      tenantId: '11111111-1111-1111-1111-111111111111',
      userId: null,
      assureUserId: null,
      isSuperAdmin: false,
    };
    const seen: unknown[] = [];
    await withTenantContext(ds as unknown as DataSource, ctx, async (m) => {
      seen.push(m);
      await Promise.resolve();
      seen.push(m);
      await Promise.resolve();
      seen.push(m);
      return 'ok';
    });
    expect(seen[0]).toBe(seen[1]);
    expect(seen[1]).toBe(seen[2]);
  });

  it('binds tenantId parameter as the first set_config call argument', async () => {
    const manager = { query: vi.fn().mockResolvedValue([]) };
    const ds = {
      isInitialized: true,
      transaction: vi.fn(async (cb: (m: typeof manager) => Promise<unknown>) => cb(manager)),
    };
    const tenantId = '11111111-1111-1111-1111-111111111111';
    const ctx: TenantContext = {
      tenantId,
      userId: null,
      assureUserId: null,
      isSuperAdmin: false,
    };
    await withTenantContext(ds as unknown as DataSource, ctx, async () => 'ok');
    const tenantCall = manager.query.mock.calls.find((c) =>
      String(c[0]).includes('app.current_tenant_id'),
    );
    expect(tenantCall?.[1]?.[0]).toBe(tenantId);
  });

  it('does not emit duplicate set_config for the same key', async () => {
    const manager = { query: vi.fn().mockResolvedValue([]) };
    const ds = {
      isInitialized: true,
      transaction: vi.fn(async (cb: (m: typeof manager) => Promise<unknown>) => cb(manager)),
    };
    const ctx: TenantContext = {
      tenantId: '11111111-1111-1111-1111-111111111111',
      userId: null,
      assureUserId: null,
      isSuperAdmin: false,
    };
    await withTenantContext(ds as unknown as DataSource, ctx, async () => 'ok');
    const keys = manager.query.mock.calls
      .map((c) => String(c[0]))
      .map((sql) => /'app\.[a-z_]+'/.exec(sql)?.[0])
      .filter((k): k is string => Boolean(k));
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });
});
```

### 23.2 tests/unit/types.test.ts

```typescript
import { describe, it, expect } from 'vitest';
import type { TenantContext } from '../../src/types/tenant-context';

describe('TenantContext type contract', () => {
  it('accepts a full context with all uuids set', () => {
    const ctx: TenantContext = {
      tenantId: '11111111-1111-1111-1111-111111111111',
      userId: '22222222-2222-2222-2222-222222222222',
      assureUserId: '33333333-3333-3333-3333-333333333333',
      isSuperAdmin: false,
    };
    expect(ctx.tenantId).toBeDefined();
  });

  it('accepts a super admin context with tenantId null', () => {
    const ctx: TenantContext = {
      tenantId: null,
      userId: '22222222-2222-2222-2222-222222222222',
      assureUserId: null,
      isSuperAdmin: true,
    };
    expect(ctx.isSuperAdmin).toBe(true);
  });

  it('accepts a system job context with all fields null except isSuperAdmin', () => {
    const ctx: TenantContext = {
      tenantId: null,
      userId: null,
      assureUserId: null,
      isSuperAdmin: true,
    };
    expect(ctx.userId).toBeNull();
  });
});
```

### 23.3 tests/integration/data-source-init.int.test.ts

```typescript
import { describe, it, expect, afterAll } from 'vitest';
import 'reflect-metadata';
import { dataSource, initializeDataSource, destroyDataSource } from '../../src/data-source';

afterAll(async () => {
  await destroyDataSource();
});

describe('data-source initialization', () => {
  it('initializes the runtime DataSource and reports isInitialized true', async () => {
    const ds = await initializeDataSource();
    expect(ds.isInitialized).toBe(true);
    expect(ds).toBe(dataSource);
  });

  it('is idempotent on second initializeDataSource call', async () => {
    const a = await initializeDataSource();
    const b = await initializeDataSource();
    expect(a).toBe(b);
  });

  it('destroyDataSource closes the pool', async () => {
    await destroyDataSource();
    expect(dataSource.isInitialized).toBe(false);
  });
});
```

## 24. Annexe G -- Profil de performance attendu

### 24.1 Mesures cibles

Le helper `withTenantContext` doit avoir un overhead transactionnel acceptable. Mesures cibles sur Postgres 16 Atlas Cloud Services Benguerir avec pool 20 connexions et latence reseau intra-DC < 1 ms :

| Metrique | Cible | Mesure | Outil |
|----------|-------|--------|-------|
| Latence p50 helper sans I/O | < 2 ms | A mesurer | Vitest bench |
| Latence p99 helper sans I/O | < 8 ms | A mesurer | Vitest bench |
| Latence p50 helper + 1 SELECT simple | < 5 ms | A mesurer | Vitest bench |
| Latence p99 helper + 1 SELECT simple | < 20 ms | A mesurer | Vitest bench |
| Throughput max (RPS, pool 20) | > 1000 RPS | A mesurer | k6 load |
| Pool wait time p99 a 800 RPS | < 50 ms | A mesurer | pg_stat_activity |

### 24.2 Test bench Vitest exemple

```typescript
import { bench, describe } from 'vitest';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { withTenantContext } from '../../src/helpers/with-tenant-context';

describe('withTenantContext bench', () => {
  let dataSource: DataSource;

  bench('helper with empty callback', async () => {
    if (!dataSource) {
      dataSource = new DataSource({
        type: 'postgres',
        host: process.env.DATABASE_HOST ?? 'localhost',
        port: Number(process.env.DATABASE_PORT ?? '5432'),
        username: process.env.DATABASE_USER ?? 'skalean_test',
        password: process.env.DATABASE_PASSWORD ?? 'skalean_test',
        database: process.env.DATABASE_NAME ?? 'skalean_test',
        synchronize: false,
        logging: false,
      });
      await dataSource.initialize();
    }
    await withTenantContext(
      dataSource,
      {
        tenantId: '11111111-1111-1111-1111-111111111111',
        userId: null,
        assureUserId: null,
        isSuperAdmin: false,
      },
      async () => 'ok',
    );
  }, { iterations: 100 });
});
```

### 24.3 Optimisations envisagees plus tard

- Si l'overhead p99 depasse 8 ms : envisager batch des `set_config` en un seul `SELECT set_config(...), set_config(...), ...` au lieu de 4 round-trips.
- Si pool sature a 1000 RPS : augmenter `DATABASE_POOL_SIZE_MAX` a 30 et ajouter une seconde instance applicative.
- Si latence reseau > 1 ms : verifier que la base et l'application sont dans la meme zone Atlas.

## 25. Annexe H -- Documentation Pino logger structure

Le helper utilise le logger Pino expose par `@insurtech/logger`. Le format de log est JSON structure pour ingestion par le SIEM (decision Sprint 12). Exemple de log emis :

```json
{
  "level": 20,
  "time": 1714867200000,
  "pid": 1234,
  "hostname": "skalean-api-01.atlas.skalean.ma",
  "service": "@insurtech/database",
  "tenantId": "11111111-1111-1111-1111-111111111111",
  "userId": "22222222-2222-2222-2222-222222222222",
  "assureUserId": null,
  "isSuperAdmin": false,
  "msg": "withTenantContext: session variables set"
}
```

Niveau `level: 20` correspond a `debug` (Pino niveaux : 10 trace, 20 debug, 30 info, 40 warn, 50 error, 60 fatal).

Les logs `withSuperAdmin` sont au niveau `warn` (40) car le bypass RLS est une operation sensible qui doit ressortir dans les rapports d'audit hebdomadaires generes par le SIEM (Sprint 12 conformite).

## 26. Annexe I -- Glossaire des termes techniques

| Terme | Definition |
|-------|------------|
| RLS (Row-Level Security) | Mecanisme Postgres natif permettant de filtrer les rows visibles par un utilisateur SQL via des policies declaratives. |
| Policy RLS | Regle de filtrage definie sur une table avec USING (condition lecture) et WITH CHECK (condition ecriture). |
| Set local | Commande Postgres positionnant une variable de session pour la duree d'une transaction. Annulee par COMMIT/ROLLBACK. |
| Set config | Fonction Postgres equivalente a SET LOCAL mais utilisable avec parametres bindes (plus sur). |
| pgcrypto | Extension Postgres fournissant les fonctions cryptographiques dont gen_random_uuid(). |
| uuid-ossp | Extension Postgres fournissant les fonctions uuid_generate_v1(), uuid_generate_v4(), etc. |
| pg_trgm | Extension Postgres fournissant les operateurs de similarite trigram pour recherche fuzzy. |
| TypeORM 0.3 | Version majeure du DataMapper TypeScript pour Postgres avec nouvelle API DataSource. |
| DataSource | Classe TypeORM 0.3 representant un pool de connexions et la configuration ORM (remplace Connection 0.2). |
| EntityManager | Classe TypeORM offrant les methodes CRUD scopees a une transaction. |
| Repository | Classe TypeORM specifique a une entite, derivee de l'EntityManager. |
| QueryRunner | Classe TypeORM bas niveau permettant de gerer manuellement une connexion et une transaction. |
| Migration | Fichier TypeORM declarant up()/down() pour modifier le schema. |
| Subscriber | Classe TypeORM ecoutant les evenements d'entites (beforeInsert, afterUpdate, etc.) pour audit ou triggers applicatifs. |
| Soft delete | Suppression logique via colonne deleted_at non null, l'entity reste en base mais est filtree par defaut. |
| Hard delete | Suppression physique via DELETE FROM, irreversible. |
| Atlas Cloud Services | Fournisseur cloud souverain marocain base a Benguerir, region ma-benguerir-1. |
| CNDP | Commission Nationale de Controle de la Protection des Donnees Personnelles (Maroc). |
| ACAPS | Autorite de Controle des Assurances et de la Prevoyance Sociale (Maroc). |
| DGI | Direction Generale des Impots (Maroc). |
| CGNC | Code General de Normalisation Comptable (Maroc). |

## 27. Annexe J -- Liste exhaustive des dependances NPM

| Package | Version | Type | Justification |
|---------|---------|------|---------------|
| typeorm | 0.3.20 | dep | ORM principal Skalean |
| pg | 8.13.1 | dep | Driver Postgres node officiel |
| reflect-metadata | 0.2.2 | dep | Requis par decorators TypeORM |
| @insurtech/core | workspace:* | dep | Package partage core (env, errors) |
| @insurtech/logger | workspace:* | dep | Logger Pino partage |
| typeorm-ts-node-commonjs | 0.3.20 | devDep | Wrapper CLI TypeORM avec ts-node integre |
| dotenv | 16.4.5 | devDep | Chargement .env pour CLI |
| @types/node | 20.16.10 | devDep | Types Node.js |
| @types/pg | 8.11.10 | devDep | Types pg |
| eslint | 9.12.0 | devDep | Linter |
| rimraf | 6.0.1 | devDep | Suppression cross-platform de dist/ |
| tsup | 8.3.0 | devDep | Bundler ESM+CJS+DTS |
| typescript | 5.6.3 | devDep | Compilateur |
| vitest | 2.1.2 | devDep | Test runner |

Toutes les versions sont epinglees (pas de `^` ni `~`) pour reproductibilite. Les mises a jour sont ouvertes par Renovate Bot avec PR audite par techlead.

## 28. Annexe K -- Relation avec le Sprint 1

Le Sprint 1 a livre la version 0.1.0 du package `@insurtech/database` qui contenait :
- `package.json` minimal.
- `src/data-source.ts` initial avec configuration Postgres de base.
- `src/index.ts` re-exportant `DataSource` et la fonction `dataSource`.
- Helpers SQL bruts `set-rls-context.sql` (fichiers SQL non integres aux helpers TS).

La tache 1.2.1 enrichit ce socle :
- Bumpe la version a 0.2.0.
- Ajoute les dependances TypeORM/pg/reflect-metadata (probablement deja presentes en 0.1.0, a verifier).
- Cree la structure entities/ et helpers/.
- Met a jour data-source.ts pour pointer sur dist/ pour entities/migrations/subscribers compiles.
- Cree cli-data-source.ts dedie a la CLI.

Aucune entite metier n'est creee dans la tache 1.2.1 -- elles le seront dans 1.2.3 et suivantes.

## 29. Annexe L -- Exemple de migration future utilisant la cli-data-source

Pour comprendre comment la `cli-data-source.ts` sera utilisee, voici un apercu de la structure d'une future migration creee par la tache 1.2.3 :

```typescript
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTenantsTable1714900000000 implements MigrationInterface {
  public name = 'CreateTenantsTable1714900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(200) NOT NULL,
        slug varchar(200) NOT NULL UNIQUE,
        cloud_region varchar(50) NOT NULL DEFAULT 'ma-benguerir-1',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_tenants_slug ON tenants(slug);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS tenants CASCADE;`);
  }
}
```

L'execution `pnpm migration:run` invoque la `cli-data-source.ts`, charge cette migration (presente dans `src/migrations/`), execute `up()` dans une transaction et enregistre l'application dans la table `typeorm_migrations`.

Cette migration n'est PAS livree par 1.2.1 mais sert d'exemple de ce que la tache 1.2.3 produira en s'appuyant sur l'infrastructure CLI mise en place ici.

## 30. Annexe M -- Synthese finale et points d'attention

La tache 1.2.1 est structurellement simple (une trentaine de fichiers, ~1500 lignes de code total) mais conceptuellement critique car elle pose les fondations de la securite multi-tenant pour les 32 sprints du programme. Les points d'attention prioritaires pour le developpeur en charge :

1. **Ne JAMAIS oublier le verrou defensif** : `if (ctx.tenantId === null && !ctx.isSuperAdmin) throw`. Une seule oubliance et l'isolation est compromise.
2. **Tester le rollback** : verifier que si le callback throw, la transaction est rollback et les set_config sont effectivement annules.
3. **Verifier la liberation du pool** : sous charge, monitorer `pg_stat_activity` pour detecter les connexions zombies.
4. **Aligner snake_case DB / camelCase TS** : un decalage subtil casse les requetes find().
5. **Pgcrypto AVANT toute migration applicative** : inscrit dans la roadmap Sprint 2.
6. **Commits propres** : un commit par axe (entities, helpers, cli, tests, env), tous metadata Task/Sprint/Phase.
7. **No-emoji** : grep pre-commit obligatoire, ne pas faire confiance a l'inspection visuelle.
8. **JSDoc riche** : preparer le terrain decision-005 Skalean AI frontier.

La tache est consideree terminee uniquement quand TOUS les criteres P0 (V1-V16) sont verts ET les criteres P1 sont a 90%+ ET la PR est approuvee par 2 reviewers (techlead Skalean + architect ou senior). Le merge sur `main` debloque immediatement la tache 1.2.2.

Fin du prompt task 1.2.1.
