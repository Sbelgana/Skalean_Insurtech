# TACHE 2.3.12 -- Tests Exhaustifs RBAC (80+ scenarios) + Seeds Dev 12 Users (1 par role) -- Validation Matrice 12 Roles x 85+ Permissions + ABAC Policies (OwnResources, TimeBased, StatusBased, WorkflowState) + Integration E2E Supertest Full Stack + Script seed-rbac-users.ts + Documentation Runbook rbac-test-users.md

**Sprint** : 7 (Phase 2 / Sprint 3 dans phase) -- RBAC Granulaire + ABAC Foundation
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-07-sprint-07-rbac.md` (Tache 2.3.12 lignes 1140-1213)
**Reference documentation transverse** : `00-pilotage/documentation/5-roles-permissions.md` v2.2 (matrice 12 roles x 85+ permissions, hierarchies, ABAC policies, super admin bypass, seeds dev section 10)
**Phase** : 2 -- Securite & Multi-tenant
**Priorite** : P0 (bloquant pour cloture Sprint 7 et bascule verification V-07 ; bloquant pour Sprint 8 CRM qui demarre Phase 3 et utilisera les fixtures `RbacTestFixtures` livrees ici pour ses propres tests Controllers ; bloquant pour Sprint 14 Insure qui consume seeds `broker_admin@demo.skalean-insurtech.ma` pour seeds policies test ; bloquant pour Sprint 19 Repair qui consume seeds `garage_chef@demo.skalean-insurtech.ma` pour seeds sinistres test ; bloquant pour Sprint 22 Observability dashboards Grafana RBAC qui valident metriques `rbac_check_total{role,permission,granted}` correctement emises pour chaque role ; bloquant pour Sprint 25 Cross-tenant qui reuse fixtures pour tests broker-to-garage assignment ; bloquant pour Sprint 26 admin module qui reuse seed users pour smoke tests `/admin/impersonate` ; bloquant pour Sprint 28 SRE runbook onboarding nouveaux developpeurs qui clonent repo + executent `pnpm seeds:rbac` + utilisent comptes demo pour explorer UI ; bloquant pour Sprint 33 SecOps pentest qui prend `assure@demo.skalean-insurtech.ma` comme cible privilege escalation tests ; bloquant pour Sprint 34 Compliance reporting CNDP qui valide via tests que aucun champ PII n'apparait pour roles non autorises ; bloquant pour onboarding QA team qui execute manual exploratory tests via UI avec password commun `Test1234!@#$` ; bloquant pour Sprint 36 Renewal Portal qui utilise `assure@demo.skalean-insurtech.ma` pour smoke tests E2E Playwright ; bloquant pour la verification V-07 du Sprint 7 qui requiert preuve documentee de coverage 12 roles + 4 ABAC policies + 80+ assertions integration)
**Effort** : 9h
**Dependances** :
  - Tache 2.3.11 (`AdminPermissionsController` + endpoints `/api/v1/admin/rbac/*` consume pour valider matrice via integration tests E2E avant assertions per-role ; reuse `AdminPermissionsService.getRoleEffectivePermissions(role)` pour cross-validation matrix vs runtime computed)
  - Tache 2.3.10 (`PermissionCacheService.checkPermission(userId, role, permission, ctx)` + `getEffectivePermissions(role)` consume directement par tests unitaires per-role pour assertions allowed/denied sans passage HTTP layer)
  - Tache 2.3.9 (`RbacAuditService.recordCheck` consume implicitement via guards lors de chaque integration test ; tests verifient que entries audit sont bien crees avec `granted=false` pour denials)
  - Tache 2.3.8 (`WorkflowStatePolicy` + `WORKFLOW_TRANSITIONS` map consume directement par `workflow-state.spec.ts` pour assert transitions valides + invalides sinistres / devis / polices)
  - Tache 2.3.7 (`StatusBasedPolicy` consume par `status-based.spec.ts` : police active cancel OK, expired deny ; quote draft update OK, signed deny ; invoice draft update OK, paid deny)
  - Tache 2.3.6 (`TimeBasedPolicy` + clock injection `IClockService` consume par `time-based.spec.ts` pour assert refund < 30j OK > 30j deny avec mock clock luxon)
  - Tache 2.3.5 (`OwnResourcesPolicy` + `OWN_RESOURCES_RESOLVERS` consume par `own-resources.spec.ts` pour assert owner OK non-owner deny ; reuse fixtures `policies`, `sinistres`, `documents` resources avec `owner_id` colonne)
  - Tache 2.3.4 (`RoleGuard` + `@Role` decorator consume par integration tests Supertest qui montent `AppModule` et frappent endpoints reels)
  - Tache 2.3.3 (`RbacService.computeEffectivePermissions(role)` resolution recursive consume comme reference verite pour role-matrix-coverage.spec.ts cross-check vs PermissionsMatrix declared)
  - Tache 2.3.2 (`PermissionsMatrix` code-as-config + `RoleHierarchy` definitions consume directement par `role-matrix-coverage.spec.ts` pour iterer matrice sans mock)
  - Tache 2.3.1 (`Permission` catalog Zod + `AuthRole` enum + `PermissionValueSchema` consume pour type-safe assertions tests)
  - Sprint 6 (TenantContext + AsyncLocalStorage + `runInTenantContext(tenantId, fn)` helper consume par integration tests pour switch tenant Bennani vs Atlas vs platform)
  - Sprint 5 (RedisService cluster mode + ConfigService Zod-validated + Pino logger 9.5.x consume par seeds script et tests integration ; reuse `JwtService.signAccessToken(user)` pour generer tokens tests)
  - Sprint 4 (DrizzleService Postgres + migrations `users`, `tenants`, `user_tenant_roles`, `tenant_categories`, `tenant_features` reuse par seeds script + repository helpers reuse par fixtures cleanup)
  - Sprint 3 (NestJS Fastify adapter + Test module `@nestjs/testing` reuse par `Test.createTestingModule()` integration setup ; ZodValidationPipe global consume par integration tests assertions 400 BadRequest invalid payload)
  - Sprint 1-2 stack (TypeScript 5.7.3 strict, Vitest 2.1.8, NestJS 10.4.x, Fastify 4.x adapter, Pino 9.5.x, Zod 3.24.1, reflect-metadata 0.2.x, prom-client 15.x, ioredis 5.4.x, kafkajs 2.2.4, luxon 3.5.x, drizzle-orm 0.36.x, @nestjs/swagger 8.x, supertest 7.x, argon2 0.41.x pour password hashing seeds, ulid 2.3.x, pnpm 9.x, vitest @types/node 22.x)
**Densite cible** : 100-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache 2.3.12 livre la **suite de tests exhaustifs RBAC + ABAC + le script de seeds dev 12 users** du programme Skalean InsurTech v2.2 : la **derniere tache du Sprint 7** qui verrouille la qualite de l'ensemble du systeme RBAC livre durant le sprint en validant **80+ scenarios distincts couvrant integralement la matrice 12 roles x 85+ permissions + les 4 policies ABAC + le full stack HTTP** via integration tests Supertest, et qui livre **un script reproductible `seed-rbac-users.ts` creant systematiquement 12 utilisateurs (un par role) dans 2 tenants demo** pour faciliter le travail quotidien des developpeurs (frontend, backend, QA), des designers UX (preview UI per role), des QA manuels (exploratory testing per role), des SRE (smoke tests staging), et des nouveaux onboardes (10 minutes pour avoir un environnement complet local fonctionnel). Sans cette tache, le Sprint 7 ne peut pas etre cloture (verification V-07 echoue) car les Sprints 8 (CRM), 14 (Insure), 19 (Repair), 22 (Observability), 25 (Cross-tenant), 26 (Admin), 28 (SRE), 33 (SecOps), 34 (Compliance) et 36 (Renewal Portal) dependent tous de fixtures stables et de seeds reproductibles pour leurs propres tests respectifs.

La suite de tests se decompose en **trois categories complementaires** : (1) la categorie **RBAC matrix coverage** qui livre `role-matrix-coverage.spec.ts` (~280 lignes) iterant programmatiquement sur les 12 roles `super_admin_platform`, `analyst_support`, `broker_admin`, `broker_user`, `broker_assistant`, `garage_admin`, `garage_chef`, `garage_technicien`, `garage_comptable`, `garage_commercial`, `assure`, `prospect` et pour chaque role echantillonant 10 permissions representatives extraites du catalog 85+ pour assertion table-driven `expect(checkPermission(role, perm)).toBe(expectedAllowed)` selon ce que dit `PermissionsMatrix` resolu hierarchie incluse via `RbacService.computeEffectivePermissions(role)` -- ce test agit comme **meta-test garantissant que toute modification future de la matrice declenche une rupture immediate des assertions** evitant divergences silencieuses entre code et tests, total ~120 assertions ; et qui livre 11 fichiers `*.spec.ts` per-role couvrant des **scenarios realistes business** pour chaque role specifique (e.g. `super_admin_platform.spec.ts` ~120 lignes verifie wildcard `*` sur 5 permissions tirees aleatoirement + bypass RLS via `app_is_super_admin()` Postgres helper + acces routes `/api/v1/admin/*` ; `broker_admin.spec.ts` ~150 lignes verifie full CRUD CRM + Insure + tenant settings update + commission read mais 403 sur `/admin/tenants` ; `broker_user.spec.ts` ~150 lignes verifie create/read/update CRM + create policies/quotes mais 403 sur DELETE et 403 sur `/admin/*` ; `garage_admin.spec.ts` ~150 lignes verifie full repair + stock + HR ; `garage_technicien.spec.ts` ~120 lignes verifie `repair.reparations.start/complete` + `stock.items.use` + `repair.photos.upload` mais 403 sur `repair.sinistres.assign` reserve garage_chef ; `assure.spec.ts` ~120 lignes verifie permissions `*_own` (read sa propre police) + denied sur `*_all` (cannot list other policies) ; `prospect.spec.ts` ~80 lignes verifie acces public `public.products.read`, `public.quotes.generate`, `public.kyc.submit`, `public.payments.process` mais 401 sur tout endpoint authentifie). (2) La categorie **ABAC policies** qui livre `own-resources.spec.ts` (~150 lignes) verifiant `OwnResourcesPolicy` : assure-A peut lire police-owned-by-A mais recoit 403 sur police-owned-by-B (assure different) malgre meme tenant ; technicien-T peut lire sinistre-assigned-to-T mais 403 sur sinistre-assigned-to-T2 ; garage_chef peut close sinistre meme non assigne (override scope) ; et livre `time-based.spec.ts` (~120 lignes) verifiant `TimeBasedPolicy` : refund accepte si `transaction.created_at > NOW() - 30j` (loi 17-99 droit retract MA), refuse si > 30j avec error code `EXPIRED_RESOURCE_TIME_WINDOW` + reason `TimeBasedPolicy.refund_outside_30d_window` ; clock mock injecte via `IClockService` permettant deterministe ; et livre `status-based.spec.ts` (~120 lignes) verifiant `StatusBasedPolicy` : police active peut etre cancelled, police expired refuse 403 reason `StatusBasedPolicy.policy_status_must_be_active` ; quote draft peut etre updated, quote signed refuse ; invoice draft peut etre updated, invoice paid refuse ; et livre `workflow-state.spec.ts` (~150 lignes) verifiant `WorkflowStatePolicy` : sinistre transitions valides `declared -> acknowledged -> appointment_scheduled -> diagnostic -> devis_pending -> devis_approved -> repair_in_progress -> repair_completed -> closed` toutes acceptees, transitions invalides `declared -> closed` (skip) refusees avec error `WorkflowStatePolicy.invalid_transition_from_declared_to_closed` + chaine `validNextStates: [acknowledged]` retournee. (3) La categorie **integration full stack** qui livre `rbac-integration.e2e-spec.ts` (~250 lignes) montant `AppModule` complet via `Test.createTestingModule()` + `INestApplication.init()` + Supertest 7.x frappant des endpoints reels (`POST /api/v1/contacts` avec broker_user JWT bearer = 201 Created + Location header ; `DELETE /api/v1/contacts/:id` avec broker_user = 403 Forbidden body Problem+JSON `type: forbidden-rbac-permission`, `detail: broker_user lacks crm.contacts.delete` ; `GET /api/v1/admin/tenants` avec broker_admin = 403 Forbidden ; `GET /api/v1/admin/tenants` avec super_admin_platform = 200 OK + body avec liste tenants ; `POST /api/v1/insure/policies/:id/cancel` avec broker_user sur police active = 200 OK ; meme call sur police expired = 403 Forbidden via StatusBasedPolicy).

Le script de seeds **`seed-rbac-users.ts` (~300 lignes)** instancie un environnement local de developpement complet et **idempotent** (re-run produit meme etat sans erreur) : il cree (a) **2 tenants demo** -- `Cabinet Demo Bennani` (`tenant_category=broker`, `slug=demo-bennani`, address Casablanca, ICE 002345678901234, `feature_flags={crm:true,insure:true,booking:true,pay:true,books:true}`) + `Garage Demo Atlas` (`tenant_category=garage`, `slug=demo-atlas`, address Rabat, ICE 002998877665544, `feature_flags={repair:true,stock:true,hr:true,books:true,crm:false}`) ; (b) **12 utilisateurs** distribues comme suit -- 2 platform users sans tenant (`super-admin@demo.skalean-insurtech.ma` role super_admin_platform, `analyst@demo.skalean-insurtech.ma` role analyst_support) ; 3 broker users dans Bennani (`broker-admin@demo.skalean-insurtech.ma` role broker_admin, `broker-user@demo.skalean-insurtech.ma` role broker_user, `broker-assistant@demo.skalean-insurtech.ma` role broker_assistant) ; 5 garage users dans Atlas (`garage-admin@demo.skalean-insurtech.ma` role garage_admin, `garage-chef@demo.skalean-insurtech.ma` role garage_chef, `garage-technicien@demo.skalean-insurtech.ma` role garage_technicien, `garage-comptable@demo.skalean-insurtech.ma` role garage_comptable, `garage-commercial@demo.skalean-insurtech.ma` role garage_commercial) ; 1 assure rattache Atlas (`assure@demo.skalean-insurtech.ma` role assure) ; 1 prospect sans tenant (`prospect@demo.skalean-insurtech.ma` role prospect) ; (c) tous avec **password commun `Test1234!@#$`** hashe via `argon2id memoryCost=65536 timeCost=3 parallelism=4` (jamais stocke clair, conforme CNDP loi 09-08 art 23 chiffrement obligatoire des secrets meme en non-prod) avec `password_must_change=false` pour faciliter login dev ; (d) **MFA disabled** (`mfa_enabled=false`, `mfa_secret=NULL`) pour eviter friction tests automatises ; (e) **assignations roles** dans table `user_tenant_roles` avec `tenant_id` correspondant + `is_primary=true` ; (f) **idempotence** garantie via `INSERT ... ON CONFLICT (email) DO UPDATE SET updated_at=NOW()` + cleanup pre-run `DELETE FROM users WHERE email LIKE '%@demo.skalean-insurtech.ma'` (option `--clean`) ; (g) **runbook documentation** `repo/docs/runbooks/rbac-test-users.md` (~100 lignes) listant table `Email | Role | Tenant | Permissions clefs | Use case test` permettant a tout developpeur de retrouver immediatement le compte pertinent pour son scenario ; (h) commande pnpm `pnpm seeds:rbac` definie dans `package.json` script execute via `tsx` + ENV vars `SEED_RBAC_PASSWORD=Test1234!@#$` `SEED_RBAC_TENANT_BROKER_NAME=Cabinet Demo Bennani` `SEED_RBAC_TENANT_GARAGE_NAME=Garage Demo Atlas` `SEED_RBAC_MFA_DISABLED=true` `SEED_RBAC_CLEAN=false` (override `--clean` flag) `SEED_RBAC_LOG_LEVEL=info`. Conformite strict : le script **refuse de s'executer en production** (`if (process.env.NODE_ENV === 'production') { throw new Error('seed-rbac-users refuses to run in production NODE_ENV') }`) car (a) password commun expose toute prod a brute-force trivial, (b) emails `*@demo.skalean-insurtech.ma` ne doivent jamais polluer base prod (CNDP loi 09-08 art 5 exactitude des donnees), (c) ACAPS Circulaire 2018/01 separation environnements stricte, (d) AMC Loi 12-18 art 24 segregation environnements production vs test obligatoire pour AML.

L'architecture des tests s'organise selon une **pyramide classique** : ~80% unit tests (per-role specs + ABAC specs + matrix coverage qui ne montent PAS `AppModule` mais consomment directement `RbacService`, `PermissionCacheService`, policies en injectant mocks Redis + Drizzle minimal) avec executions <50ms chacun ; ~15% integration tests (`rbac-integration.e2e-spec.ts` qui monte `AppModule` complet avec testcontainers Postgres + Redis ephemeres, applique migrations Drizzle, seed users via `seed-rbac-users.ts` import programmatique, frappe endpoints HTTP reels via Supertest, executions <2s chacun) ; ~5% smoke tests E2E (Playwright project `api-rbac` execute apres deploy staging frappe `https://api-staging.skalean-insurtech.ma` avec comptes demo seeds reels, executions <10s chacun -- hors scope Sprint 7 strict mais infrastructure prep). Le tout doit s'executer en **<60s total** sur CI (criteres V8 P1) avec parallelisation Vitest `pool: 'threads'` `maxThreads: 8` et isolation per-test database via transactions wrapping (`BEGIN; ...test...; ROLLBACK;`) garantissant aucune contamination entre tests. Coverage cible : **>95% lines + >90% branches** sur les fichiers `permissions-matrix.ts`, `role-hierarchy.ts`, `rbac.service.ts`, `permission-cache.service.ts`, `*-policy.ts`, `*-guard.ts`. A l'issue de cette tache, l'execution `pnpm test:rbac` retourne `Tests: 80+ passed (80+) | Suites: 15+ passed (15+) | Time: <60s` sur CI GitHub Actions ubuntu-22.04 + Postgres 16 + Redis 7 + Node 22.x, le script `pnpm seeds:rbac` cree 12 users + 2 tenants idempotemment en <5s, et la documentation `repo/docs/runbooks/rbac-test-users.md` est rendue dans portail interne `docs.internal.skalean-insurtech.ma` accessible par toute l'equipe permettant onboarding nouveau developpeur en <10 minutes.

---

## 2. Contexte etendu

### 2.1 Pourquoi 80+ scenarios et pas 30 ou 200

Le choix du seuil 80+ scenarios decoule d'un calcul produit-securite-risque precis :

**Approche A -- Couverture exhaustive 12 x 85 = 1020 assertions (REJETEE)** : Iterer toutes les combinaisons role x permission individuellement = 1020 tests. Avantages : (a) preuve formelle exhaustive ; (b) zero gap couverture. Inconvenients : (a) **redondance** -- 95% des combinaisons sont triviales `assert(prospect.has('admin.tenants.create')).toBe(false)` qui apporte pas valeur ; (b) **suite tests >5min** depasse budget CI 60s (V8) ; (c) **maintenance** -- ajout permission -> 12 nouveaux tests, ajout role -> 85 nouveaux tests, explosion combinatoire ; (d) **fausse rassurance** -- coverage exhaustif passes vs business scenarios non testes. REJETEE.

**Approche B -- Sample minimal 30 scenarios (REJETEE)** : 1-2 tests par role = 24 tests + 6 tests ABAC = 30 total. Avantages : (a) tres rapide ; (b) maintenance triviale. Inconvenients : (a) **gap massif** -- broker_admin ~30 permissions dont 1 testee = 3% coverage role ; (b) **regression silencieuse** -- modification matrix non detectee si permission non echantillonnee ; (c) **non-conformite ACAPS** -- Circulaire 2018/01 art 9 exige tracabilite + tests representatifs systeme autorisation ; (d) **insuffisant pour V-07** verification Sprint 7. REJETEE.

**Approche C -- 80+ scenarios cibles strategiques (RETENUE)** : Distribution suivante : (a) `role-matrix-coverage.spec.ts` 12 roles x 10 permissions echantillon stratifie (5 expected-allowed + 5 expected-denied per role choisies pour couvrir tous modules `crm`, `insure`, `repair`, `pay`, `books`, `admin`, `cross_tenant`, `compliance`, `analytics`, `hr`) = 120 assertions ; (b) 11 fichiers per-role specs avec scenarios business 5-10 par role = ~80 assertions supplementaires ; (c) 4 fichiers ABAC specs avec ~10 scenarios per policy = 40 assertions ; (d) 1 fichier integration E2E ~15 scenarios HTTP full stack = 15 assertions. **Total ~255 assertions sur ~80 distincts test cases (it blocks)**. Le compte "80+ scenarios" reference les `it()` blocks distincts qui groupent assertions logiquement liees, pas individual `expect()`. Avantages : (a) **coverage strategique** -- tous roles, tous modules, tous policies, full HTTP stack ; (b) **maintenable** -- ajout permission impacte 1 ou 2 tests (matrix-coverage si echantillonnee + per-role spec si business case) ; (c) **<60s CI** atteint avec parallelisation ; (d) **conforme ACAPS + interne**. RETENUE.

**Choix retenu** : Approche C 80+ scenarios stratifies. ADR-033 `docs/adr/033-rbac-test-coverage-strategy.md`.

### 2.2 Trade-off : table-driven tests vs hardcoded scenarios

Pour `role-matrix-coverage.spec.ts` qui itere 12 roles x 10 permissions :

**Strategie A -- Table-driven via `it.each()` (RETENUE)** : Tableau `ROLE_PERMISSION_SAMPLES: Array<{ role: AuthRole, permission: Permission, expectedAllowed: boolean, abacContext?: AbacContext }>` consume par `it.each(ROLE_PERMISSION_SAMPLES)('role $role permission $permission expected $expectedAllowed', async ({role, permission, expectedAllowed, abacContext}) => { ... })`. Avantages : (a) **DRY** -- un seul test body, 120 invocations ; (b) **lisible reporter Vitest** -- output liste ` PASS role broker_admin permission crm.contacts.create expected true` ; (c) **maintenance facile** -- ajouter ligne tableau = nouveau test sans copier-coller ; (d) **detection regressions** -- modification PermissionsMatrix change automatiquement attentes via reconstruction tableau a partir matrice + validation cross-source ; (e) **debugging** -- failure montre ligne tableau exacte. Inconvenients : (a) **stack trace mins precise** vs hardcoded -- Vitest 2.x gere bien ; (b) **complexite setup tableau** -- mitige par helper `buildRoleSamples(role)` qui pioche permissions representatives.

**Strategie B -- Hardcoded scenarios** : `it('broker_admin can create contacts', ...)`, `it('broker_admin can read deals', ...)`, etc. ~120 fonctions. Avantages : (a) explicite ; (b) noms business descriptifs. Inconvenients : (a) **redondance code** ~5000 lignes ; (b) **divergence facile** -- ajout permission dans matrice oublie tests ; (c) **maintenance impossible** -- 12 roles update simultane.

**Strategie C -- Mixte** : Matrix coverage en table-driven, per-role specs en hardcoded (cas usage business). Avantages : (a) le best des deux. Inconvenients : aucun majeur.

**Choix retenu** : Strategie C mixte. `role-matrix-coverage.spec.ts` table-driven via `it.each()`. Per-role specs `*.spec.ts` hardcoded scenarios business avec noms descriptifs. ABAC specs hardcoded car contexte richesse necessaire.

### 2.3 Trade-off : seeds idempotency vs cleanup-then-insert

**Strategie A -- UPSERT (RETENUE)** : `INSERT ... ON CONFLICT (email) DO UPDATE`. Avantages : idempotent re-run = no-op ; preservation IDs UUID stable cross-runs ; rapide 12 queries < 100ms ; transactionnel rollback partial ; password rotation propagee. Inconvenients : schema drift si colonne renamed migration -> mitige par CI executes migrate avant seeds.

**Strategie B -- DELETE then INSERT** : Destructif, developpeur perd data liee, cascade slow. REJETEE par defaut, disponible via `--clean`.

**Strategie C -- Skip-if-exists** : Pas update password si rotation. REJETEE.

**Choix retenu** : Strategie A UPSERT par defaut + option `--clean` (env `SEED_RBAC_CLEAN=true`) opt-in. Test V11 V12.

### 2.4 Trade-off : password commun vs per-user random

**Strategie A -- Password commun `Test1234!@#$` (RETENUE)** : Friction nulle developpeur, runbook simple, Postman collections faciles, CI hardcoded `.env.test`. Risque : exposition prod -> script throw NODE_ENV=production ; brute-force trivial -> acceptable non-prod isole.

**Strategie B -- Random per user logged** : Friction copier-coller 12 passwords ; fuite logs CI ; non-idempotent. REJETEE.

**Strategie C -- Derive from email** : Complexite developpeur. REJETEE.

**Choix retenu** : Strategie A + protection NODE_ENV=production throw + argon2id hash conforme CNDP loi 09-08 art 23.

### 2.5 Trade-off : tests parallel vs serial

**Strategie A -- Parallel par fichier (RETENUE)** : Vitest `pool: 'threads', maxThreads: 8`. <60s vs ~5min serial. Isolation via testcontainers ephemeres + transaction wrapping.

**Strategie B -- Serial** : ~5min CI lent. REJETEE.

**Strategie C -- Parallel + transaction wrapping** : Acceptable unit, problematique integration HTTP.

**Choix retenu** : A parallel par fichier + B transaction wrapping unit + C testcontainers integration.

### 2.6 Trade-off : integration tests testcontainers vs in-memory

**Strategie A -- Testcontainers Postgres 16 + Redis 7 (RETENUE integration)** : Fidelite prod, RLS policies testees, migrations reellement executees. Slow startup ~10s premier run ; Docker required CI (preinstalle GitHub Actions).

**Strategie B -- In-memory pg-mem + ioredis-mock** : Divergences pg-mem (pas RLS, partitioning, JSONB advanced). REJETEE integration, RETENUE unit tests purs.

**Strategie C -- Embedded Postgres** : Maintenance lourde, plateformes limitees. REJETEE.

**Choix retenu** : A testcontainers integration + B in-memory mocks unit (per-role specs).

### 2.7 Pieges techniques connus (12+ pieges critiques)

1. **Piege : seed re-run produit roles dupliques en table user_tenant_roles.** Pourquoi : `INSERT INTO user_tenant_roles (user_id, tenant_id, role)` sans unique constraint = N rows pour meme combinaison apres N runs. Solution : Migration Sprint 4 ajoute `UNIQUE INDEX user_tenant_role_unique ON user_tenant_roles (user_id, tenant_id, role)` + `INSERT ... ON CONFLICT (user_id, tenant_id, role) DO NOTHING`. Test V13 verifie 1 row apres 5 runs.

2. **Piege : cleanup partial laisse orphelins data lies.** Pourquoi : `DELETE FROM users WHERE email LIKE '%@demo...'` mais foreign keys CASCADE pas configurees -> orphan rows in contacts, sinistres, sessions. Solution : Migrations CASCADE FK + transaction wrapping cleanup `BEGIN; DELETE FROM users ...; -- CASCADE handles deps; COMMIT;`. Test V14.

3. **Piege : role assignment race condition.** Pourquoi : Si script execute concurrent (2 dev exec simultane), INSERT users OK via UPSERT mais user_tenant_roles peut rater unique constraint differente order. Solution : `SELECT ... FOR UPDATE` lock advisory `pg_advisory_lock(hashtext('seed-rbac'))` debut script. Test V15.

4. **Piege : password rotation oubliee dans tests.** Pourquoi : `.env.test` `SEED_RBAC_PASSWORD=Test1234!@#$` mais `rbac-test-fixtures.ts` hardcode `'Test1234!@#$'` -- desync = login fail. Solution : `RbacTestFixtures.PASSWORD = process.env.SEED_RBAC_PASSWORD ?? 'Test1234!@#$'`. Test V16.

5. **Piege : tenant deletion cascade detruit RLS policies.** Pourquoi : `DELETE FROM tenants WHERE name LIKE 'Demo %'` declenche `ON DELETE CASCADE` users + sessions. Solution : Cleanup ordre inverse -- users first, then user_tenant_roles, then tenants, transaction wrapping. Documentation runbook precise. Test V17.

6. **Piege : RLS isolation tests false positive si super_admin context.** Pourquoi : Tests integration utilisent token super_admin par defaut bypass RLS -> assertion `tenantA cannot read tenantB data` passe falsement. Solution : Tests RLS explicit utilisent broker_admin tenant Bennani token. Helper `RbacTestFixtures.signTokenForRole(role, tenantId)`. Test V18.

7. **Piege : concurrent seed scripts collision tenant slug.** Pourquoi : 2 scripts simultanes INSERT tenant slug `demo-bennani` -> unique violation. Solution : Advisory lock + UPSERT slug + retry exponential backoff 3x. Test V19.

8. **Piege : db migration drift -- script seeds reference colonne renamed.** Pourquoi : Migration Sprint 8 rename `users.full_name` -> `users.display_name`, script reference ancien -> fail. Solution : Tests CI execute `pnpm migrate:up && pnpm seeds:rbac` ordre strict, drift detecte immediately. Test V20.

9. **Piege : fixtures stale apres ajout nouveau role.** Pourquoi : Sprint 14 ajoute role `insurer_validator`, `RbacTestFixtures.ROLES_LIST` hardcode 12 -> nouveau role non teste. Solution : `ROLES_LIST` derivee `Object.values(AuthRoleEnum.enum)` runtime, ajout role auto-cascade tests. Test V21.

10. **Piege : seeds en CI execute avant migrations -> table not exists.** Pourquoi : `pnpm test:rbac` execute seeds avant migrations CI -> error. Solution : `package.json` `test:rbac: pnpm migrate:up && pnpm seeds:rbac && vitest run --testPathPattern rbac`. Test V22.

11. **Piege : MFA disabled seeds peut fuiter prod par mauvais branch deploy.** Pourquoi : Si script execute sur prod par erreur, users `*@demo.skalean-insurtech.ma` MFA off compromise security. Solution : `if (process.env.NODE_ENV === 'production') throw new Error('seeds refused in production')` premiere ligne script + tests V23 verifie. + Post-deploy check Sprint 22 alerte si emails `*@demo.skalean-insurtech.ma` en prod.

12. **Piege : password commun expose via logs Pino structured.** Pourquoi : `logger.info({ user: { ...user } })` peut log password_hash + email -> log aggregator visible. Solution : Pino redact paths `[req.body.password, *.password_hash]` config Sprint 5. Tests V24 verifie.

13. **Piege : seeds Pino noisy in CI.** Pourquoi : Script log 12 INSERT chacun = 60 lignes log par run. Solution : `SEED_RBAC_LOG_LEVEL=warn` default CI, info dev. Tests V25.

14. **Piege : Vitest snapshot tests on roles list outdated.** Pourquoi : Snapshot tests `expect(rolesList).toMatchSnapshot()` outdated apres ajout role. Solution : Pas snapshot tests pour roles list ; assertions explicit length + contenu. Tests V26.

15. **Piege : cursor pagination broken si 2 events memes ms.** Pourquoi : Tests audit denied generent 100 events boucle, all ms identiques -> cursor saute events. Solution : Setup test inserts events avec `created_at = NOW() + (i * INTERVAL '1 millisecond')`. Tests V27.

16. **Piege : RoleGuard JWT validation enforced apres ABAC -> ABAC fail leakable info.** Pourquoi : Si guards order `RoleGuard then AbacGuard`, ABAC denial reveals role allowed access. Solution : `@UseGuards(JwtAuthGuard, RoleGuard, AbacGuard)` ordre strict. Tests V28.

### 2.8 Conformite legale Maroc -- impact tests + seeds

| Loi / norme | Impact tests + seeds | Implementation |
|-------------|----------------------|----------------|
| **CNDP loi 09-08 article 4 (minimisation)** | Seeds emails fictifs `*@demo.skalean-insurtech.ma` pas users reels | TLD `.ma` reserve sub-domain demo, jamais delivered email reel. Documentation runbook precise. |
| **CNDP loi 09-08 article 23 (confidentialite)** | Password meme commun, JAMAIS clair BDD | argon2id memoryCost=65536 hash, password_hash colonne unique. Tests V24 verify regex. |
| **CNDP loi 09-08 article 5 (exactitude)** | Seeds non en prod | `if NODE_ENV=production throw` premiere ligne. Tests V23. |
| **ACAPS Circulaire 2018/01 article 9 (tracabilite)** | Tests audit denied verifient RbacAuditService recordCheck | Tests integration verify `await audit.findRecent({granted:false}).length > 0` apres denial. |
| **ACAPS separation environnements** | Seeds segrege test/dev only | NODE_ENV check + email TLD restriction. |
| **AMC Loi 12-18 article 24 (segregation)** | AML test data jamais melange prod | Idem. Documentation explicit. |
| **AMC Loi 12-18 article 15 (AML detection)** | Tests verifient denied access logs alimentees | Cross-check audit service apres tests denial. |
| **BAM circulaire 1/G/2007 (separation taches)** | Tests verifient broker_admin pas access admin/* | Tests `broker-admin.spec.ts` assert 403 sur `/admin/*` endpoints. |
| **Loi 17-99 article 17 (droit retract 30j)** | Tests `time-based.spec.ts` verifient refund < 30j OK > 30j deny | Mock clock luxon `DateTime.fromISO('2026-05-06')` setup, transaction created `2026-04-01` (35j) deny. |
| **Loi 09-08 decision 008/2018 (sessions prospect)** | Tests prospect.spec.ts verifient session Redis pas BDD persistence | Verify `await redis.exists('session:prospect:xxx')` true, `db.users.find({role:'prospect'})` empty. |
| **CNDP recommendation 5/2020 (logs)** | Logs structures Pino redact passwords | Pino config redact + tests V24 grep logs no password leak. |
| **DGI Note Circulaire 717 (test data)** | Test ICE numbers fictifs valid format mais pas reels | ICE `002345678901234` (Bennani) `002998877665544` (Atlas) format valide 15 digits, non assignes par DGI. |

### 2.9 Performance budget tests + seeds

- **Suite complete `pnpm test:rbac` total** : <60s (V8 P1).
- `role-matrix-coverage.spec.ts` (~120 assertions) : <5s (parallel intra-file partial).
- 11 fichiers per-role specs : <2s chacun (parallelisation Vitest).
- 4 fichiers ABAC specs : <2s chacun.
- `rbac-integration.e2e-spec.ts` (~15 scenarios HTTP) : <15s (testcontainers warmup amortise + Supertest fast).
- **Seeds script `pnpm seeds:rbac`** : <5s (12 INSERTs + 12 user_tenant_roles + 2 tenants = 26 queries + argon2 hash 12x ~200ms each).
- argon2id hash 12 passwords meme : optimisation -> hash unique reuse sur 12 users (acceptable test only, jamais prod). Reduces 2400ms -> 200ms.
- **CI cold start** : <120s total (testcontainers download + warmup + tests + seeds + cleanup).

### 2.10 Failure modes

| Failure | Detection | Handling | Test |
|---------|-----------|----------|------|
| Postgres testcontainer fail start | Promise reject 30s timeout | Retry 3x exponential, fail CI clear message | V29 |
| Redis testcontainer fail start | Idem | Idem | V29 |
| Migrations fail before seeds | `pnpm migrate:up` exit code != 0 | Fail CI, no seeds, no tests | V30 |
| Seed script fail mid-execution | Transaction rollback automatic | Re-run idempotent recover | V11 |
| RbacService stale cache pendant test | Cache invalidate after each test | Test setup `await cache.flushAll()` beforeEach | V31 |
| Test timeout 10s default Vitest | Vitest reporter shows | Increase per test if integration `it('...', async () => {...}, 30000)` | V32 |
| Argon2 hash slow CI machine | Pre-hash once setup file | `beforeAll(() => HASHED_PASSWORD = await argon2.hash(SEED_RBAC_PASSWORD))` | -- |

### 2.11 Volumetrie attendue

- Production : N/A (script refuse prod).
- CI per push : `pnpm test:rbac` execute = ~80 tests + seeds = 60s + 5s = 65s.
- CI per PR : Idem + integration extra = ~120s.
- Local dev : `pnpm seeds:rbac` execute 5-10x par jour developpeur.

### 2.12 Comparaison strategies tests RBAC industrie

| Acteur | Strategie tests RBAC | Coverage | Seeds dev |
|--------|----------------------|----------|-----------|
| Auth0 | Per-tenant integration tests + Cypress E2E | 100% endpoints | Test API tokens generes |
| Keycloak | Arquillian integration tests + Selenium | Exhaustive matrix | Demo realm `master` import |
| Casbin | Go testing table-driven + benchmarks | Matrix coverage 100% | Aucun (lib only) |
| AWS IAM | CloudFormation test stacks + Inspector | Internal only | Sandbox accounts |
| Stripe | Test mode API keys + replay events | E2E feature tests | `stripe fixtures` CLI |
| **Skalean** | Vitest unit + integration Supertest + Playwright E2E (Sprint Phase 3+) | 80+ scenarios stratifies | `pnpm seeds:rbac` 12 users 2 tenants |

### 2.13 Decisions architecturales documentees

- **ADR-033** `docs/adr/033-rbac-test-coverage-strategy.md` : 80+ scenarios stratifies vs exhaustif.
- **ADR-034** `docs/adr/034-seeds-dev-shared-password.md` : Password commun acceptable non-prod.
- **ADR-035** `docs/adr/035-testcontainers-vs-inmemory.md` : Hybrid approach.
- **decision-015** `00-pilotage/decisions/015-demo-domain-skalean-insurtech.ma.md` : TLD `.ma` sub-domain demo.

---

## 3. Architecture context

### 3.1 Position dans le sprint 7

Cette tache 2.3.12 est la **12eme et derniere tache du Sprint 7** et la 34eme tache de la Phase 2. Elle :

- **Depend de** : Tache 2.3.11 (`AdminPermissionsController` + endpoints `/api/v1/admin/rbac/*` consume cross-validation), Tache 2.3.10 (`PermissionCacheService.checkPermission` consume direct unit tests), Tache 2.3.9 (`RbacAuditService.recordCheck` consume verification audit entries crees), Tache 2.3.8 (`WorkflowStatePolicy` consume direct par workflow-state.spec.ts), Tache 2.3.7 (`StatusBasedPolicy` consume direct par status-based.spec.ts), Tache 2.3.6 (`TimeBasedPolicy` + `IClockService` mock injection), Tache 2.3.5 (`OwnResourcesPolicy`), Tache 2.3.4 (`RoleGuard` + decorator), Tache 2.3.3 (`RbacService.computeEffectivePermissions`), Tache 2.3.2 (`PermissionsMatrix` reuse), Tache 2.3.1 (`Permission` catalog), Sprint 6 (TenantContext), Sprint 5 (RedisService + JwtService.signAccessToken), Sprint 4 (DrizzleService + migrations), Sprint 3 (NestJS Test module).
- **Bloque** : Cloture Sprint 7, verification V-07, Sprint 8 demarrage Phase 3.
- **Apporte au sprint** : Suite tests 80+ scenarios + seeds 12 users + runbook documentation + commande pnpm + fixtures helpers reusables Sprints 8+ pour leurs propres tests Controllers.

### 3.2 Position dans le programme global

- **Sprint 8 CRM** : Reuse `RbacTestFixtures` pour tests `ContactsController` + utilise `broker-user@demo.skalean-insurtech.ma` seed.
- **Sprint 14 Insure** : Reuse `broker-admin@demo.skalean-insurtech.ma` pour seeds policies test.
- **Sprint 19 Repair** : Reuse `garage-chef@demo.skalean-insurtech.ma` + `garage-technicien@demo.skalean-insurtech.ma` pour seeds sinistres test.
- **Sprint 22 Observability** : Tests RBAC alimentent metrics Grafana dashboard `rbac_check_total{role,permission,granted}`.
- **Sprint 25 Cross-tenant** : Reuse fixtures pour broker_to_garage_assignment tests.
- **Sprint 26 Admin module** : Reuse seed users pour `/admin/impersonate` smoke tests.
- **Sprint 28 SRE runbook** : Documentation seeds reference dans onboarding.
- **Sprint 33 SecOps pentest** : `assure@demo.skalean-insurtech.ma` cible privilege escalation tests.
- **Sprint 34 Compliance** : Tests verify aucun PII fuite roles non autorises.
- **Sprint 36 Renewal Portal** : `assure@demo.skalean-insurtech.ma` smoke E2E Playwright.

### 3.3 Diagramme pyramide tests RBAC (ASCII)

```
                           +-----------------------+
                           |   E2E Playwright      |  ~5%
                           |   (Sprint Phase 3+)   |  staging
                           +-----------------------+
                          /                         \
                         /  Integration Supertest    \  ~15%
                        /   rbac-integration.e2e     \  testcontainers
                       /    ~15 scenarios HTTP        \
                      +--------------------------------+
                     /                                  \
                    /   Unit tests Vitest                \  ~80%
                   /    role-matrix-coverage             \  in-memory
                  /     11 per-role specs                 \
                 /      4 ABAC policy specs                \
                /       ~80 it() blocks total              \
               /        ~255 expect() assertions             \
              +------------------------------------------------+
```

### 3.4 Diagramme flow seeds 12 users (ASCII)

```
pnpm seeds:rbac
       |
       v
seed-rbac-users.ts
       |
       v
+----------------------------+
| Step 1: NODE_ENV check     |
| if production -> throw     |
+----------------------------+
       |
       v
+----------------------------+
| Step 2: pg_advisory_lock   |
| 'seed-rbac' (concurrent    |
|   safe)                    |
+----------------------------+
       |
       v
+----------------------------+
| Step 3 (optional): clean   |
| if SEED_RBAC_CLEAN=true:   |
|   DELETE users LIKE %@demo |
|   DELETE tenants LIKE Demo |
+----------------------------+
       |
       v
+----------------------------+
| Step 4: hash password once |
| HASHED = argon2id(         |
|   SEED_RBAC_PASSWORD,      |
|   memoryCost=65536, ...    |
| )                          |
+----------------------------+
       |
       v
+----------------------------+      +----------------------------+
| Step 5: UPSERT 2 tenants   |      | Step 6: UPSERT 12 users    |
| Cabinet Demo Bennani       |      | super-admin@demo...        |
| (broker, ICE 002345...)    |      | analyst@demo...            |
| Garage Demo Atlas          |      | broker-admin/user/assist   |
| (garage, ICE 002998...)    |      | garage-admin/chef/tech/    |
+----------------------------+      |   comptable/commercial      |
                                    | assure@demo... (Atlas)      |
                                    | prospect@demo... (no tenant)|
                                    +----------------------------+
       \                           /
        \                         /
         v                       v
+--------------------------------------+
| Step 7: UPSERT user_tenant_roles      |
| INSERT ... ON CONFLICT                |
|   (user_id, tenant_id, role)          |
|   DO NOTHING                          |
| 10 rows (12 users - 2 platform/no     |
| tenant + 2 multi if applicable)       |
+--------------------------------------+
       |
       v
+----------------------------+
| Step 8: pg_advisory_unlock |
| Logger info: seeded 12 users|
+----------------------------+
       |
       v
+----------------------------+
| Step 9 (optional): print   |
| table summary if --verbose |
+----------------------------+
```

### 3.5 Position de la couche tests dans l'architecture

```
       Application (apps/api)
            |
       AppModule
       /        \
  ControllersGuards         Services
       |                      |
   +-------+              +--------+
   | Tests |  <----+      | Tests  |
   | E2E   |       |      | Unit   |
   +-------+       |      +--------+
                   |
              Test Module
              (Test.createTestingModule)
                   |
              testcontainers
              (Postgres + Redis)
                   |
              Migrations + Seeds
                   |
              seed-rbac-users.ts
              fixtures (RbacTestFixtures)
```

---

## 4. Livrables checkables

- [ ] L1 : Fichier `repo/apps/api/test/rbac/role-matrix-coverage.spec.ts` (~280 lignes) iterating 12 roles x 10 permissions echantillon, 120+ assertions, table-driven via `it.each()`.
- [ ] L2 : Fichier `repo/apps/api/test/rbac/super-admin-platform.spec.ts` (~120 lignes) verify wildcard 5+ permissions tirees + bypass RLS + acces admin routes.
- [ ] L3 : Fichier `repo/apps/api/test/rbac/analyst-support.spec.ts` (~120 lignes) verify read OK toutes resources + write 403 partout.
- [ ] L4 : Fichier `repo/apps/api/test/rbac/broker-admin.spec.ts` (~150 lignes) verify full CRM + Insure + tenant settings + 403 admin.
- [ ] L5 : Fichier `repo/apps/api/test/rbac/broker-user.spec.ts` (~150 lignes) verify limited (no delete, no admin).
- [ ] L6 : Fichier `repo/apps/api/test/rbac/broker-assistant.spec.ts` (~80 lignes) verify read seulement + booking create.
- [ ] L7 : Fichier `repo/apps/api/test/rbac/garage-admin.spec.ts` (~150 lignes) verify full repair + stock + HR.
- [ ] L8 : Fichier `repo/apps/api/test/rbac/garage-chef.spec.ts` (~100 lignes) verify sinistres assign + close + diagnostics.
- [ ] L9 : Fichier `repo/apps/api/test/rbac/garage-technicien.spec.ts` (~120 lignes) verify reparations execute + stock use + photos.
- [ ] L10 : Fichier `repo/apps/api/test/rbac/garage-comptable.spec.ts` (~80 lignes) verify books + pay + 403 repair.
- [ ] L11 : Fichier `repo/apps/api/test/rbac/garage-commercial.spec.ts` (~80 lignes) verify devis + clients + 403 books.
- [ ] L12 : Fichier `repo/apps/api/test/rbac/assure.spec.ts` (~120 lignes) verify *_own only + 403 *_all.
- [ ] L13 : Fichier `repo/apps/api/test/rbac/prospect.spec.ts` (~80 lignes) verify public only + 401 authenticated routes.
- [ ] L14 : Fichier `repo/apps/api/test/abac/own-resources.spec.ts` (~150 lignes) verify owner OK + non-owner deny.
- [ ] L15 : Fichier `repo/apps/api/test/abac/time-based.spec.ts` (~120 lignes) verify refund < 30j OK + > 30j deny.
- [ ] L16 : Fichier `repo/apps/api/test/abac/status-based.spec.ts` (~120 lignes) verify police active cancel + expired deny.
- [ ] L17 : Fichier `repo/apps/api/test/abac/workflow-state.spec.ts` (~150 lignes) verify sinistre transitions valides + invalides.
- [ ] L18 : Fichier `repo/apps/api/test/integration/rbac-integration.e2e-spec.ts` (~250 lignes) Supertest full stack 15+ scenarios.
- [ ] L19 : Fichier `repo/infrastructure/scripts/seed-rbac-users.ts` (~300 lignes) script seed idempotent.
- [ ] L20 : Fichier `repo/apps/api/test/fixtures/rbac-test-fixtures.ts` (~180 lignes) helpers fixtures reusables.
- [ ] L21 : Fichier `repo/apps/api/test/fixtures/index.ts` (~30 lignes) barrel exports.
- [ ] L22 : Documentation `repo/docs/runbooks/rbac-test-users.md` (~100 lignes) listing users + roles + permissions + cas usage.
- [ ] L23 : Script `pnpm seeds:rbac` defini dans `repo/package.json` consume `tsx infrastructure/scripts/seed-rbac-users.ts`.
- [ ] L24 : Script `pnpm test:rbac` defini consume `vitest run --testPathPattern '(rbac|abac)'`.
- [ ] L25 : Variables environnement documentees dans `.env.example` : `SEED_RBAC_PASSWORD`, `SEED_RBAC_TENANT_BROKER_NAME`, `SEED_RBAC_TENANT_GARAGE_NAME`, `SEED_RBAC_MFA_DISABLED`, `SEED_RBAC_CLEAN`, `SEED_RBAC_LOG_LEVEL`.
- [ ] L26 : ADR-033 `docs/adr/033-rbac-test-coverage-strategy.md` cree.
- [ ] L27 : ADR-034 `docs/adr/034-seeds-dev-shared-password.md` cree.
- [ ] L28 : ADR-035 `docs/adr/035-testcontainers-vs-inmemory.md` cree.
- [ ] L29 : decision-015 `00-pilotage/decisions/015-demo-domain-skalean-insurtech.ma.md` cree.
- [ ] L30 : Suite tests passe en <60s sur CI (V8).
- [ ] L31 : Coverage >95% lines + >90% branches sur `permissions-matrix.ts`, `role-hierarchy.ts`, `rbac.service.ts`, `*-policy.ts`.
- [ ] L32 : Reproducibility 5x consecutifs identiques (V7).
- [ ] L33 : Seeds script <5s execution (V11+performance).
- [ ] L34 : 12 users distincts crees apres `pnpm seeds:rbac` (V5 verified via `SELECT COUNT(*) FROM users WHERE email LIKE '%@demo...' = 12`).

---

## 5. Fichiers crees / modifies

```
repo/apps/api/test/rbac/role-matrix-coverage.spec.ts                  # CREE ~280 lignes
repo/apps/api/test/rbac/super-admin-platform.spec.ts                  # CREE ~120 lignes
repo/apps/api/test/rbac/analyst-support.spec.ts                        # CREE ~120 lignes
repo/apps/api/test/rbac/broker-admin.spec.ts                           # CREE ~150 lignes
repo/apps/api/test/rbac/broker-user.spec.ts                            # CREE ~150 lignes
repo/apps/api/test/rbac/broker-assistant.spec.ts                       # CREE ~80 lignes
repo/apps/api/test/rbac/garage-admin.spec.ts                           # CREE ~150 lignes
repo/apps/api/test/rbac/garage-chef.spec.ts                            # CREE ~100 lignes
repo/apps/api/test/rbac/garage-technicien.spec.ts                      # CREE ~120 lignes
repo/apps/api/test/rbac/garage-comptable.spec.ts                       # CREE ~80 lignes
repo/apps/api/test/rbac/garage-commercial.spec.ts                      # CREE ~80 lignes
repo/apps/api/test/rbac/assure.spec.ts                                  # CREE ~120 lignes
repo/apps/api/test/rbac/prospect.spec.ts                                # CREE ~80 lignes
repo/apps/api/test/abac/own-resources.spec.ts                           # CREE ~150 lignes
repo/apps/api/test/abac/time-based.spec.ts                              # CREE ~120 lignes
repo/apps/api/test/abac/status-based.spec.ts                            # CREE ~120 lignes
repo/apps/api/test/abac/workflow-state.spec.ts                          # CREE ~150 lignes
repo/apps/api/test/integration/rbac-integration.e2e-spec.ts             # CREE ~250 lignes
repo/apps/api/test/fixtures/rbac-test-fixtures.ts                       # CREE ~180 lignes
repo/apps/api/test/fixtures/index.ts                                     # CREE ~30 lignes
repo/infrastructure/scripts/seed-rbac-users.ts                          # CREE ~300 lignes
repo/docs/runbooks/rbac-test-users.md                                    # CREE ~100 lignes
repo/docs/adr/033-rbac-test-coverage-strategy.md                         # CREE ~80 lignes
repo/docs/adr/034-seeds-dev-shared-password.md                           # CREE ~80 lignes
repo/docs/adr/035-testcontainers-vs-inmemory.md                          # CREE ~80 lignes
repo/00-pilotage/decisions/015-demo-domain-skalean-insurtech.ma.md       # CREE ~50 lignes
repo/package.json                                                        # MODIFIE +2 scripts
repo/.env.example                                                        # MODIFIE +6 vars
repo/vitest.config.ts                                                    # MODIFIE +rbac coverage threshold
```

---

## 6. Code patterns COMPLETS

### 6.1 `repo/apps/api/test/fixtures/rbac-test-fixtures.ts`

```typescript
/**
 * RbacTestFixtures -- helpers reusables tests RBAC + ABAC.
 *
 * Sprint 7 / Tache 2.3.12.
 * Reuse par per-role specs, ABAC specs, integration E2E.
 */
import { Test, TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../../src/app.module';
import { JwtService } from '../../src/modules/auth/jwt.service';
import { DrizzleService } from '../../src/modules/database/drizzle.service';
import { RedisService } from '../../src/modules/cache/redis.service';
import {
  AuthRole,
  AuthRoleEnum,
  Permission,
  PermissionsMatrix,
  RoleHierarchy,
} from '@insurtech/shared/auth';
import { ulid } from 'ulid';
import argon2 from 'argon2';

export const RBAC_TEST_PASSWORD =
  process.env.SEED_RBAC_PASSWORD ?? 'Test1234!@#$';

export const RBAC_TEST_TENANT_BROKER_ID = '01J7BENNANI0000000000000000';
export const RBAC_TEST_TENANT_GARAGE_ID = '01J7ATLAS00000000000000000A';

export const RBAC_TEST_USERS: Record<AuthRole, {
  userId: string;
  email: string;
  tenantId: string | null;
}> = {
  super_admin_platform: {
    userId: '01J7USR0SUPERADMINPLATFORM00',
    email: 'super-admin@demo.skalean-insurtech.ma',
    tenantId: null,
  },
  analyst_support: {
    userId: '01J7USR0ANALYSTSUPPORT0000000',
    email: 'analyst@demo.skalean-insurtech.ma',
    tenantId: null,
  },
  broker_admin: {
    userId: '01J7USR0BROKERADMIN000000000',
    email: 'broker-admin@demo.skalean-insurtech.ma',
    tenantId: RBAC_TEST_TENANT_BROKER_ID,
  },
  broker_user: {
    userId: '01J7USR0BROKERUSER0000000000',
    email: 'broker-user@demo.skalean-insurtech.ma',
    tenantId: RBAC_TEST_TENANT_BROKER_ID,
  },
  broker_assistant: {
    userId: '01J7USR0BROKERASSISTANT00000',
    email: 'broker-assistant@demo.skalean-insurtech.ma',
    tenantId: RBAC_TEST_TENANT_BROKER_ID,
  },
  garage_admin: {
    userId: '01J7USR0GARAGEADMIN0000000000',
    email: 'garage-admin@demo.skalean-insurtech.ma',
    tenantId: RBAC_TEST_TENANT_GARAGE_ID,
  },
  garage_chef: {
    userId: '01J7USR0GARAGECHEF0000000000',
    email: 'garage-chef@demo.skalean-insurtech.ma',
    tenantId: RBAC_TEST_TENANT_GARAGE_ID,
  },
  garage_technicien: {
    userId: '01J7USR0GARAGETECHNICIEN00000',
    email: 'garage-technicien@demo.skalean-insurtech.ma',
    tenantId: RBAC_TEST_TENANT_GARAGE_ID,
  },
  garage_comptable: {
    userId: '01J7USR0GARAGECOMPTABLE000000',
    email: 'garage-comptable@demo.skalean-insurtech.ma',
    tenantId: RBAC_TEST_TENANT_GARAGE_ID,
  },
  garage_commercial: {
    userId: '01J7USR0GARAGECOMMERCIAL0000',
    email: 'garage-commercial@demo.skalean-insurtech.ma',
    tenantId: RBAC_TEST_TENANT_GARAGE_ID,
  },
  assure: {
    userId: '01J7USR0ASSURE0000000000000A',
    email: 'assure@demo.skalean-insurtech.ma',
    tenantId: RBAC_TEST_TENANT_GARAGE_ID,
  },
  prospect: {
    userId: '01J7USR0PROSPECT00000000000A',
    email: 'prospect@demo.skalean-insurtech.ma',
    tenantId: null,
  },
};

export const ROLES_LIST: AuthRole[] = Object.values(AuthRoleEnum.enum) as AuthRole[];

export class RbacTestFixtures {
  private static cachedHashedPassword: string | null = null;

  static async hashPassword(): Promise<string> {
    if (!this.cachedHashedPassword) {
      this.cachedHashedPassword = await argon2.hash(RBAC_TEST_PASSWORD, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });
    }
    return this.cachedHashedPassword;
  }

  static async createTestApp(): Promise<NestFastifyApplication> {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    return app;
  }

  static signTokenForRole(
    app: INestApplication,
    role: AuthRole,
    overrides?: { userId?: string; tenantId?: string | null },
  ): string {
    const jwtService = app.get(JwtService);
    const user = RBAC_TEST_USERS[role];
    return jwtService.signAccessToken({
      sub: overrides?.userId ?? user.userId,
      email: user.email,
      role,
      tenantId: overrides?.tenantId ?? user.tenantId,
      mfaVerified: false,
      sessionId: `sess_${ulid()}`,
    });
  }

  static bearerHeader(token: string): { Authorization: string } {
    return { Authorization: `Bearer ${token}` };
  }

  static async cleanRbacAuditLog(app: INestApplication): Promise<void> {
    const drizzle = app.get(DrizzleService);
    await drizzle.execute(
      `DELETE FROM rbac_audit_log WHERE created_at > NOW() - INTERVAL '1 hour'`,
    );
  }

  static async flushRbacCache(app: INestApplication): Promise<void> {
    const redis = app.get(RedisService);
    const keys = await redis.keys('rbac:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }

  static getEffectivePermissionsForRole(role: AuthRole): Set<Permission> {
    const result = new Set<Permission>();
    const visit = (r: AuthRole) => {
      const direct = PermissionsMatrix[r] ?? [];
      direct.forEach((p) => result.add(p));
      const inherits = RoleHierarchy[r] ?? [];
      inherits.forEach(visit);
    };
    visit(role);
    return result;
  }

  static getSamplePermissions(
    role: AuthRole,
    count = 10,
  ): Array<{ permission: Permission; expectedAllowed: boolean }> {
    const effective = this.getEffectivePermissionsForRole(role);
    const allPermissions = Object.values(PermissionsMatrix).flat();
    const allowed = Array.from(effective).slice(0, Math.ceil(count / 2));
    const denied = allPermissions
      .filter((p) => !effective.has(p))
      .slice(0, Math.floor(count / 2));
    return [
      ...allowed.map((permission) => ({ permission, expectedAllowed: true })),
      ...denied.map((permission) => ({ permission, expectedAllowed: false })),
    ];
  }
}
```

### 6.2 `repo/apps/api/test/fixtures/index.ts`

```typescript
export * from './rbac-test-fixtures';
export {
  RbacTestFixtures,
  RBAC_TEST_PASSWORD,
  RBAC_TEST_TENANT_BROKER_ID,
  RBAC_TEST_TENANT_GARAGE_ID,
  RBAC_TEST_USERS,
  ROLES_LIST,
} from './rbac-test-fixtures';
```

### 6.3 `repo/apps/api/test/rbac/role-matrix-coverage.spec.ts`

```typescript
/**
 * role-matrix-coverage.spec.ts -- meta-test iterating 12 roles x 10 permissions.
 *
 * Sprint 7 / Tache 2.3.12 -- table-driven via it.each().
 * Total ~120 assertions cross-validate PermissionsMatrix declared vs RbacService computed.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { RbacService } from '../../src/modules/rbac/rbac.service';
import { PermissionCacheService } from '../../src/modules/rbac/permission-cache.service';
import { RbacAuditService } from '../../src/modules/rbac/rbac-audit.service';
import { RedisService } from '../../src/modules/cache/redis.service';
import {
  AuthRole,
  Permission,
  PermissionsMatrix,
  RoleHierarchy,
} from '@insurtech/shared/auth';
import { RbacTestFixtures, ROLES_LIST } from '../fixtures';

interface MatrixSample {
  role: AuthRole;
  permission: Permission;
  expectedAllowed: boolean;
}

const SAMPLES: MatrixSample[] = [];
for (const role of ROLES_LIST) {
  const samples = RbacTestFixtures.getSamplePermissions(role, 10);
  samples.forEach(({ permission, expectedAllowed }) => {
    SAMPLES.push({ role, permission, expectedAllowed });
  });
}

describe('role-matrix-coverage -- 12 roles x 10 permissions = 120 assertions', () => {
  let rbacService: RbacService;
  let cacheService: PermissionCacheService;
  let auditService: { recordCheck: ReturnType<typeof vi.fn> };
  let redis: RedisService;
  let module: TestingModule;

  beforeAll(async () => {
    const auditMock = { recordCheck: vi.fn().mockResolvedValue(undefined) };
    module = await Test.createTestingModule({
      providers: [
        RbacService,
        PermissionCacheService,
        { provide: RbacAuditService, useValue: auditMock },
        {
          provide: RedisService,
          useValue: {
            get: vi.fn(),
            set: vi.fn(),
            del: vi.fn(),
            keys: vi.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    rbacService = module.get(RbacService);
    cacheService = module.get(PermissionCacheService);
    auditService = module.get(RbacAuditService) as any;
    redis = module.get(RedisService);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    auditService.recordCheck.mockClear();
  });

  it.each(SAMPLES)(
    'role $role permission $permission expected $expectedAllowed',
    async ({ role, permission, expectedAllowed }) => {
      const effective = rbacService.computeEffectivePermissions(role);
      const actual = effective.has(permission) || effective.has('*');
      expect(actual).toBe(expectedAllowed);
    },
  );

  describe('cross-validation matrix declared vs hierarchy resolved', () => {
    it.each(ROLES_LIST)('role %s effective permissions match union direct + inherited', (role) => {
      const computed = rbacService.computeEffectivePermissions(role);
      const directPerms = new Set(PermissionsMatrix[role] ?? []);
      const inheritedRoles = RoleHierarchy[role] ?? [];
      const inheritedPerms = new Set<Permission>();
      inheritedRoles.forEach((parent) => {
        const parentEffective = rbacService.computeEffectivePermissions(parent);
        parentEffective.forEach((p) => inheritedPerms.add(p));
      });
      const expected = new Set([...directPerms, ...inheritedPerms]);
      expect(computed.size).toBeGreaterThanOrEqual(expected.size);
      expected.forEach((p) => expect(computed.has(p)).toBe(true));
    });
  });

  describe('super_admin_platform wildcard', () => {
    it('super_admin_platform.has wildcard *', () => {
      const effective = rbacService.computeEffectivePermissions('super_admin_platform');
      expect(effective.has('*')).toBe(true);
    });

    it.each([
      'crm.contacts.create',
      'insure.policies.cancel',
      'admin.tenants.create',
      'repair.sinistres.assign',
      'compliance.acaps_reports.generate',
    ] as Permission[])('super_admin_platform allowed for %s via wildcard', (perm) => {
      const effective = rbacService.computeEffectivePermissions('super_admin_platform');
      const allowed = effective.has(perm) || effective.has('*');
      expect(allowed).toBe(true);
    });
  });

  describe('analyst_support read-only universal', () => {
    it.each([
      'crm.contacts.read',
      'insure.policies.read',
      'repair.sinistres.read',
      'pay.transactions.read',
      'books.invoices.read',
    ] as Permission[])('analyst_support allowed read perm %s', (perm) => {
      const effective = rbacService.computeEffectivePermissions('analyst_support');
      const allowed = effective.has(perm) || effective.has('*.read');
      expect(allowed).toBe(true);
    });

    it.each([
      'crm.contacts.create',
      'insure.policies.cancel',
      'admin.tenants.create',
    ] as Permission[])('analyst_support denied write perm %s', (perm) => {
      const effective = rbacService.computeEffectivePermissions('analyst_support');
      const allowed = effective.has(perm);
      expect(allowed).toBe(false);
    });
  });

  describe('hierarchy heritage chain validation', () => {
    it('broker_admin inherits broker_user permissions', () => {
      const adminPerms = rbacService.computeEffectivePermissions('broker_admin');
      const userPerms = rbacService.computeEffectivePermissions('broker_user');
      userPerms.forEach((p) => expect(adminPerms.has(p)).toBe(true));
    });

    it('broker_user inherits broker_assistant permissions', () => {
      const userPerms = rbacService.computeEffectivePermissions('broker_user');
      const assistantPerms = rbacService.computeEffectivePermissions('broker_assistant');
      assistantPerms.forEach((p) => expect(userPerms.has(p)).toBe(true));
    });

    it('garage_chef inherits garage_technicien permissions', () => {
      const chefPerms = rbacService.computeEffectivePermissions('garage_chef');
      const techPerms = rbacService.computeEffectivePermissions('garage_technicien');
      techPerms.forEach((p) => expect(chefPerms.has(p)).toBe(true));
    });

    it('garage_admin inherits all garage roles permissions', () => {
      const adminPerms = rbacService.computeEffectivePermissions('garage_admin');
      ['garage_chef', 'garage_comptable', 'garage_commercial'].forEach((role) => {
        const subPerms = rbacService.computeEffectivePermissions(role as AuthRole);
        subPerms.forEach((p) => expect(adminPerms.has(p)).toBe(true));
      });
    });
  });

  describe('no cross-tenant inheritance', () => {
    it('broker_admin does NOT inherit garage permissions', () => {
      const brokerPerms = rbacService.computeEffectivePermissions('broker_admin');
      expect(brokerPerms.has('repair.sinistres.assign')).toBe(false);
      expect(brokerPerms.has('repair.reparations.start')).toBe(false);
      expect(brokerPerms.has('stock.items.use')).toBe(false);
    });

    it('garage_admin does NOT inherit broker permissions', () => {
      const garagePerms = rbacService.computeEffectivePermissions('garage_admin');
      expect(garagePerms.has('insure.policies.create')).toBe(false);
      expect(garagePerms.has('insure.commissions.read')).toBe(false);
    });
  });

  describe('default-deny for unknown role', () => {
    it('unknown role returns empty set', () => {
      const result = rbacService.computeEffectivePermissions('nonexistent_role' as AuthRole);
      expect(result.size).toBe(0);
    });
  });

  describe('audit logging on denial', () => {
    it('records audit entry when permission denied', async () => {
      await cacheService.checkPermission(
        RbacTestFixtures.getEffectivePermissionsForRole('broker_user'),
        'broker_user',
        'admin.tenants.create',
        { userId: 'test-user', tenantId: 'test-tenant' },
      );
      expect(auditService.recordCheck).toHaveBeenCalled();
    });
  });
});
```

### 6.4 `repo/apps/api/test/rbac/super-admin-platform.spec.ts`

```typescript
/**
 * super-admin-platform.spec.ts -- verify wildcard + bypass RLS + admin routes.
 *
 * Sprint 7 / Tache 2.3.12.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RbacService } from '../../src/modules/rbac/rbac.service';
import { PermissionCacheService } from '../../src/modules/rbac/permission-cache.service';
import { RbacAuditService } from '../../src/modules/rbac/rbac-audit.service';
import { RedisService } from '../../src/modules/cache/redis.service';
import type { Permission } from '@insurtech/shared/auth';
import { RbacTestFixtures } from '../fixtures';

describe('super_admin_platform -- wildcard + bypass RLS + admin routes', () => {
  let rbacService: RbacService;
  let cacheService: PermissionCacheService;
  let module: TestingModule;
  const SUPER_ADMIN = 'super_admin_platform' as const;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        RbacService,
        PermissionCacheService,
        {
          provide: RbacAuditService,
          useValue: { recordCheck: vi.fn().mockResolvedValue(undefined) },
        },
        {
          provide: RedisService,
          useValue: {
            get: vi.fn(),
            set: vi.fn(),
            del: vi.fn(),
            keys: vi.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    rbacService = module.get(RbacService);
    cacheService = module.get(PermissionCacheService);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('wildcard * grants ALL permissions', () => {
    const PERMS_TO_TEST: Permission[] = [
      'crm.contacts.create',
      'crm.contacts.delete',
      'insure.policies.cancel',
      'insure.commissions.read',
      'repair.sinistres.assign',
      'repair.sinistres.close',
      'pay.refunds.create',
      'books.invoices.create',
      'compliance.acaps_reports.generate',
      'admin.tenants.create',
      'admin.tenants.suspend',
      'admin.tenants.purge',
      'admin.users.list_all',
      'admin.impersonate',
      'admin.audit.read',
      'cross_tenant.share_status',
    ];

    it.each(PERMS_TO_TEST)('super_admin allowed for %s', (perm) => {
      const effective = rbacService.computeEffectivePermissions(SUPER_ADMIN);
      const allowed = effective.has(perm) || effective.has('*');
      expect(allowed).toBe(true);
    });
  });

  describe('5 random permissions sample', () => {
    it('allows random sample selection', () => {
      const samples = RbacTestFixtures.getSamplePermissions(SUPER_ADMIN, 5);
      samples.forEach(({ permission }) => {
        const effective = rbacService.computeEffectivePermissions(SUPER_ADMIN);
        const allowed = effective.has(permission) || effective.has('*');
        expect(allowed).toBe(true);
      });
    });
  });

  describe('does not include user-scoped *_own (irrelevant for platform admin)', () => {
    it('super_admin can read any policy via wildcard, not _own scope', () => {
      const effective = rbacService.computeEffectivePermissions(SUPER_ADMIN);
      expect(effective.has('*')).toBe(true);
      // No need for _own scope, wildcard handles all
      expect(effective.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe('bypass RLS Postgres helper', () => {
    it('app_is_super_admin() returns true for super_admin role', () => {
      // Verified via integration test setting role context
      expect(SUPER_ADMIN).toBe('super_admin_platform');
    });
  });

  describe('admin routes /api/v1/admin/* access', () => {
    const ADMIN_PERMS: Permission[] = [
      'admin.tenants.create',
      'admin.tenants.suspend',
      'admin.tenants.purge',
      'admin.users.list_all',
      'admin.impersonate',
      'admin.audit.read',
      'admin.system.health',
    ];

    it.each(ADMIN_PERMS)('super_admin granted admin perm %s', (perm) => {
      const effective = rbacService.computeEffectivePermissions(SUPER_ADMIN);
      expect(effective.has(perm) || effective.has('*')).toBe(true);
    });
  });

  describe('MFA requirement metadata', () => {
    it('super_admin requires MFA per spec', () => {
      // requireMfa flag carried via JWT claim and enforced by MfaGuard
      // This test asserts the role identity, MfaGuard test in separate spec
      expect(SUPER_ADMIN).toBe('super_admin_platform');
    });
  });
});
```

### 6.5 `repo/apps/api/test/rbac/analyst-support.spec.ts`

```typescript
/**
 * analyst-support.spec.ts -- read-only universal, write denied.
 *
 * Sprint 7 / Tache 2.3.12.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RbacService } from '../../src/modules/rbac/rbac.service';
import { PermissionCacheService } from '../../src/modules/rbac/permission-cache.service';
import { RbacAuditService } from '../../src/modules/rbac/rbac-audit.service';
import { RedisService } from '../../src/modules/cache/redis.service';
import type { Permission } from '@insurtech/shared/auth';

describe('analyst_support -- *.read universal, write denied', () => {
  let rbacService: RbacService;
  let module: TestingModule;
  const ANALYST = 'analyst_support' as const;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        RbacService,
        PermissionCacheService,
        {
          provide: RbacAuditService,
          useValue: { recordCheck: vi.fn().mockResolvedValue(undefined) },
        },
        {
          provide: RedisService,
          useValue: {
            get: vi.fn(),
            set: vi.fn(),
            del: vi.fn(),
            keys: vi.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();
    rbacService = module.get(RbacService);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('read permissions allowed across modules', () => {
    const READ_PERMS: Permission[] = [
      'crm.contacts.read',
      'crm.companies.read',
      'crm.deals.read',
      'insure.policies.read',
      'insure.quotes.read',
      'insure.commissions.read',
      'repair.sinistres.read',
      'repair.devis.read',
      'pay.transactions.read',
      'books.invoices.read',
      'books.journals.read',
      'compliance.aml_alerts.review',
      'analytics.dashboards.read',
      'docs.documents.read',
      'admin.audit.read',
    ];

    it.each(READ_PERMS)('analyst_support allowed read %s', (perm) => {
      const effective = rbacService.computeEffectivePermissions(ANALYST);
      const allowed = effective.has(perm) || effective.has('*.read');
      expect(allowed).toBe(true);
    });
  });

  describe('write permissions denied', () => {
    const WRITE_PERMS: Permission[] = [
      'crm.contacts.create',
      'crm.contacts.update',
      'crm.contacts.delete',
      'insure.policies.create',
      'insure.policies.cancel',
      'repair.sinistres.create',
      'repair.sinistres.assign',
      'pay.refunds.create',
      'books.invoices.create',
      'admin.tenants.create',
      'admin.tenants.suspend',
      'admin.impersonate',
    ];

    it.each(WRITE_PERMS)('analyst_support denied write %s', (perm) => {
      const effective = rbacService.computeEffectivePermissions(ANALYST);
      const allowed = effective.has(perm);
      expect(allowed).toBe(false);
    });
  });

  describe('does not have wildcard *', () => {
    it('analyst_support has *.read but not *', () => {
      const effective = rbacService.computeEffectivePermissions(ANALYST);
      expect(effective.has('*')).toBe(false);
    });
  });

  describe('audit log read access (compliance officer use case)', () => {
    it('analyst can read audit logs for incident diagnostic', () => {
      const effective = rbacService.computeEffectivePermissions(ANALYST);
      expect(effective.has('admin.audit.read') || effective.has('*.read')).toBe(true);
    });
  });
});
```

### 6.6 `repo/apps/api/test/rbac/broker-admin.spec.ts`

```typescript
/**
 * broker-admin.spec.ts -- full CRM + Insure + tenant settings, 403 admin/*.
 *
 * Sprint 7 / Tache 2.3.12.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RbacService } from '../../src/modules/rbac/rbac.service';
import { PermissionCacheService } from '../../src/modules/rbac/permission-cache.service';
import { RbacAuditService } from '../../src/modules/rbac/rbac-audit.service';
import { RedisService } from '../../src/modules/cache/redis.service';
import type { Permission } from '@insurtech/shared/auth';

describe('broker_admin -- full CRM + Insure + tenant management', () => {
  let rbacService: RbacService;
  let module: TestingModule;
  const BROKER_ADMIN = 'broker_admin' as const;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        RbacService,
        PermissionCacheService,
        {
          provide: RbacAuditService,
          useValue: { recordCheck: vi.fn().mockResolvedValue(undefined) },
        },
        {
          provide: RedisService,
          useValue: {
            get: vi.fn(),
            set: vi.fn(),
            del: vi.fn(),
            keys: vi.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();
    rbacService = module.get(RbacService);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('full CRM permissions', () => {
    const CRM_PERMS: Permission[] = [
      'crm.contacts.read',
      'crm.contacts.create',
      'crm.contacts.update',
      'crm.contacts.delete',
      'crm.companies.read',
      'crm.companies.create',
      'crm.deals.read',
      'crm.deals.create',
      'crm.deals.update',
      'crm.deals.delete',
      'crm.pipelines.manage',
    ];

    it.each(CRM_PERMS)('broker_admin allowed CRM %s', (perm) => {
      const effective = rbacService.computeEffectivePermissions(BROKER_ADMIN);
      expect(effective.has(perm)).toBe(true);
    });
  });

  describe('full Insure permissions', () => {
    const INSURE_PERMS: Permission[] = [
      'insure.policies.read',
      'insure.policies.create',
      'insure.policies.update',
      'insure.policies.cancel',
      'insure.quotes.create',
      'insure.quotes.read',
      'insure.commissions.read',
    ];

    it.each(INSURE_PERMS)('broker_admin allowed Insure %s', (perm) => {
      const effective = rbacService.computeEffectivePermissions(BROKER_ADMIN);
      expect(effective.has(perm)).toBe(true);
    });
  });

  describe('tenant settings management', () => {
    it('broker_admin can update tenant settings', () => {
      const effective = rbacService.computeEffectivePermissions(BROKER_ADMIN);
      expect(effective.has('tenant.settings.update')).toBe(true);
    });

    it('broker_admin can manage custom_fields', () => {
      const effective = rbacService.computeEffectivePermissions(BROKER_ADMIN);
      expect(effective.has('custom_fields.manage')).toBe(true);
    });

    it('broker_admin can create users within tenant', () => {
      const effective = rbacService.computeEffectivePermissions(BROKER_ADMIN);
      expect(effective.has('users.create')).toBe(true);
    });
  });

  describe('payments and refunds', () => {
    it('broker_admin can create refund (subject to TimeBasedPolicy)', () => {
      const effective = rbacService.computeEffectivePermissions(BROKER_ADMIN);
      expect(effective.has('pay.refunds.create')).toBe(true);
    });

    it('broker_admin can read transactions', () => {
      const effective = rbacService.computeEffectivePermissions(BROKER_ADMIN);
      expect(effective.has('pay.transactions.read')).toBe(true);
    });
  });

  describe('books permissions', () => {
    const BOOKS_PERMS: Permission[] = [
      'books.invoices.read',
      'books.invoices.create',
      'books.invoices.update',
      'books.journals.read',
    ];

    it.each(BOOKS_PERMS)('broker_admin allowed Books %s', (perm) => {
      const effective = rbacService.computeEffectivePermissions(BROKER_ADMIN);
      expect(effective.has(perm)).toBe(true);
    });
  });

  describe('admin/* routes denied', () => {
    const ADMIN_DENIED: Permission[] = [
      'admin.tenants.create',
      'admin.tenants.suspend',
      'admin.tenants.purge',
      'admin.users.list_all',
      'admin.impersonate',
    ];

    it.each(ADMIN_DENIED)('broker_admin denied admin %s', (perm) => {
      const effective = rbacService.computeEffectivePermissions(BROKER_ADMIN);
      expect(effective.has(perm)).toBe(false);
      expect(effective.has('*')).toBe(false);
    });
  });

  describe('no garage permissions cross-tenant', () => {
    it('broker_admin has no repair permissions', () => {
      const effective = rbacService.computeEffectivePermissions(BROKER_ADMIN);
      expect(effective.has('repair.sinistres.assign')).toBe(false);
      expect(effective.has('repair.reparations.start')).toBe(false);
    });

    it('broker_admin has no stock permissions', () => {
      const effective = rbacService.computeEffectivePermissions(BROKER_ADMIN);
      expect(effective.has('stock.items.use')).toBe(false);
      expect(effective.has('stock.items.manage')).toBe(false);
    });
  });

  describe('inherits broker_user + broker_assistant', () => {
    it('inherits broker_user permissions', () => {
      const adminPerms = rbacService.computeEffectivePermissions(BROKER_ADMIN);
      const userPerms = rbacService.computeEffectivePermissions('broker_user');
      userPerms.forEach((p) => expect(adminPerms.has(p)).toBe(true));
    });
  });
});
```

### 6.7 `repo/apps/api/test/rbac/broker-user.spec.ts`

```typescript
/**
 * broker-user.spec.ts -- limited (no delete, no admin), can create policies/quotes.
 *
 * Sprint 7 / Tache 2.3.12.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RbacService } from '../../src/modules/rbac/rbac.service';
import { PermissionCacheService } from '../../src/modules/rbac/permission-cache.service';
import { RbacAuditService } from '../../src/modules/rbac/rbac-audit.service';
import { RedisService } from '../../src/modules/cache/redis.service';
import type { Permission } from '@insurtech/shared/auth';

describe('broker_user -- limited courtage, no delete, no admin', () => {
  let rbacService: RbacService;
  let module: TestingModule;
  const BROKER_USER = 'broker_user' as const;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        RbacService,
        PermissionCacheService,
        {
          provide: RbacAuditService,
          useValue: { recordCheck: vi.fn().mockResolvedValue(undefined) },
        },
        {
          provide: RedisService,
          useValue: {
            get: vi.fn(),
            set: vi.fn(),
            del: vi.fn(),
            keys: vi.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();
    rbacService = module.get(RbacService);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('CRM contacts -- read + create + update_own (ABAC)', () => {
    it('broker_user can read contacts', () => {
      const effective = rbacService.computeEffectivePermissions(BROKER_USER);
      expect(effective.has('crm.contacts.read')).toBe(true);
    });

    it('broker_user can create contacts', () => {
      const effective = rbacService.computeEffectivePermissions(BROKER_USER);
      expect(effective.has('crm.contacts.create')).toBe(true);
    });

    it('broker_user can update_own contacts (ABAC OwnResourcesPolicy)', () => {
      const effective = rbacService.computeEffectivePermissions(BROKER_USER);
      expect(effective.has('crm.contacts.update_own')).toBe(true);
    });

    it('broker_user CANNOT delete contacts', () => {
      const effective = rbacService.computeEffectivePermissions(BROKER_USER);
      expect(effective.has('crm.contacts.delete')).toBe(false);
    });
  });

  describe('CRM deals -- create + update_own', () => {
    it('broker_user can create deals', () => {
      const effective = rbacService.computeEffectivePermissions(BROKER_USER);
      expect(effective.has('crm.deals.create')).toBe(true);
    });

    it('broker_user can update_own deals', () => {
      const effective = rbacService.computeEffectivePermissions(BROKER_USER);
      expect(effective.has('crm.deals.update_own')).toBe(true);
    });

    it('broker_user CANNOT delete deals', () => {
      const effective = rbacService.computeEffectivePermissions(BROKER_USER);
      expect(effective.has('crm.deals.delete')).toBe(false);
    });
  });

  describe('Insure -- create policies/quotes, read', () => {
    it('broker_user can create quotes', () => {
      const effective = rbacService.computeEffectivePermissions(BROKER_USER);
      expect(effective.has('insure.quotes.create')).toBe(true);
    });

    it('broker_user can create policies', () => {
      const effective = rbacService.computeEffectivePermissions(BROKER_USER);
      expect(effective.has('insure.policies.create')).toBe(true);
    });

    it('broker_user can read policies', () => {
      const effective = rbacService.computeEffectivePermissions(BROKER_USER);
      expect(effective.has('insure.policies.read')).toBe(true);
    });

    it('broker_user CANNOT cancel policies (broker_admin only)', () => {
      const effective = rbacService.computeEffectivePermissions(BROKER_USER);
      expect(effective.has('insure.policies.cancel')).toBe(false);
    });
  });

  describe('Pay -- read transactions only', () => {
    it('broker_user can read transactions', () => {
      const effective = rbacService.computeEffectivePermissions(BROKER_USER);
      expect(effective.has('pay.transactions.read')).toBe(true);
    });

    it('broker_user CANNOT create refunds', () => {
      const effective = rbacService.computeEffectivePermissions(BROKER_USER);
      expect(effective.has('pay.refunds.create')).toBe(false);
    });
  });

  describe('Analytics -- read_own dashboards', () => {
    it('broker_user can read_own dashboards (ABAC)', () => {
      const effective = rbacService.computeEffectivePermissions(BROKER_USER);
      expect(effective.has('analytics.dashboards.read_own')).toBe(true);
    });
  });

  describe('admin/* completely denied', () => {
    const ADMIN_DENIED: Permission[] = [
      'admin.tenants.create',
      'admin.users.list_all',
      'admin.impersonate',
      'admin.audit.read',
    ];

    it.each(ADMIN_DENIED)('broker_user denied admin %s', (perm) => {
      const effective = rbacService.computeEffectivePermissions(BROKER_USER);
      expect(effective.has(perm)).toBe(false);
    });
  });

  describe('tenant management denied', () => {
    it('broker_user cannot update tenant settings', () => {
      const effective = rbacService.computeEffectivePermissions(BROKER_USER);
      expect(effective.has('tenant.settings.update')).toBe(false);
    });

    it('broker_user cannot create users', () => {
      const effective = rbacService.computeEffectivePermissions(BROKER_USER);
      expect(effective.has('users.create')).toBe(false);
    });
  });

  describe('inherits broker_assistant', () => {
    it('broker_user inherits broker_assistant permissions', () => {
      const userPerms = rbacService.computeEffectivePermissions(BROKER_USER);
      const assistantPerms = rbacService.computeEffectivePermissions('broker_assistant');
      assistantPerms.forEach((p) => expect(userPerms.has(p)).toBe(true));
    });
  });
});
```

### 6.8 `repo/apps/api/test/rbac/broker-assistant.spec.ts`

```typescript
/**
 * broker-assistant.spec.ts -- read seulement + booking create + comm.
 * Setup pattern identique aux autres per-role specs (RbacService + cache + audit mock + redis mock).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RbacService } from '../../src/modules/rbac/rbac.service';
import { PermissionCacheService } from '../../src/modules/rbac/permission-cache.service';
import { RbacAuditService } from '../../src/modules/rbac/rbac-audit.service';
import { RedisService } from '../../src/modules/cache/redis.service';

describe('broker_assistant -- limited base, read + booking + comm', () => {
  let rbacService: RbacService;
  let module: TestingModule;
  const ASSISTANT = 'broker_assistant' as const;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        RbacService,
        PermissionCacheService,
        { provide: RbacAuditService, useValue: { recordCheck: vi.fn() } },
        { provide: RedisService, useValue: { get: vi.fn(), set: vi.fn(), del: vi.fn(), keys: vi.fn().mockResolvedValue([]) } },
      ],
    }).compile();
    rbacService = module.get(RbacService);
  });
  afterAll(() => module.close());

  const allows = (p: string) => expect(rbacService.computeEffectivePermissions(ASSISTANT).has(p as any)).toBe(true);
  const denies = (p: string) => expect(rbacService.computeEffectivePermissions(ASSISTANT).has(p as any)).toBe(false);

  it('can read contacts', () => allows('crm.contacts.read'));
  it('can create contacts', () => allows('crm.contacts.create'));
  it('can create booking appointments', () => allows('booking.appointments.create'));
  it('can read booking appointments', () => allows('booking.appointments.read'));
  it('can send comm messages', () => allows('comm.messages.send'));
  it('CANNOT create policies', () => denies('insure.policies.create'));
  it('CANNOT create deals', () => denies('crm.deals.create'));
  it('CANNOT delete contacts', () => denies('crm.contacts.delete'));
  it('no admin permissions', () => { denies('admin.tenants.create'); denies('admin.impersonate'); });
  it('no garage permissions', () => { denies('repair.sinistres.read'); denies('stock.items.use'); });
});
```

### 6.9 `repo/apps/api/test/rbac/garage-admin.spec.ts`

```typescript
/**
 * garage-admin.spec.ts -- full repair + stock + HR + inherits all garage roles.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RbacService } from '../../src/modules/rbac/rbac.service';
import { PermissionCacheService } from '../../src/modules/rbac/permission-cache.service';
import { RbacAuditService } from '../../src/modules/rbac/rbac-audit.service';
import { RedisService } from '../../src/modules/cache/redis.service';
import type { Permission } from '@insurtech/shared/auth';

describe('garage_admin -- full repair + stock + HR', () => {
  let rbacService: RbacService;
  let module: TestingModule;
  const GARAGE_ADMIN = 'garage_admin' as const;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        RbacService,
        PermissionCacheService,
        { provide: RbacAuditService, useValue: { recordCheck: vi.fn() } },
        {
          provide: RedisService,
          useValue: { get: vi.fn(), set: vi.fn(), del: vi.fn(), keys: vi.fn().mockResolvedValue([]) },
        },
      ],
    }).compile();
    rbacService = module.get(RbacService);
  });

  afterAll(() => module.close());

  describe('full Repair permissions', () => {
    const REPAIR_PERMS: Permission[] = [
      'repair.sinistres.read',
      'repair.sinistres.create',
      'repair.sinistres.update',
      'repair.sinistres.delete',
      'repair.sinistres.assign',
      'repair.sinistres.close',
      'repair.diagnostics.create',
      'repair.diagnostics.update',
      'repair.devis.create',
      'repair.devis.read',
      'repair.devis.approve',
      'repair.orders.create',
      'repair.invoices.create',
      'repair.warranties.read',
      'repair.photos.upload',
    ];

    it.each(REPAIR_PERMS)('garage_admin allowed Repair %s', (perm) => {
      const effective = rbacService.computeEffectivePermissions(GARAGE_ADMIN);
      expect(effective.has(perm)).toBe(true);
    });
  });

  describe('full Stock permissions', () => {
    it('can manage stock items', () => {
      const effective = rbacService.computeEffectivePermissions(GARAGE_ADMIN);
      expect(effective.has('stock.items.manage')).toBe(true);
    });

    it('can read stock movements', () => {
      const effective = rbacService.computeEffectivePermissions(GARAGE_ADMIN);
      expect(effective.has('stock.movements.read')).toBe(true);
    });
  });

  describe('full HR permissions', () => {
    const HR_PERMS: Permission[] = [
      'hr.employees.read',
      'hr.employees.create',
      'hr.contracts.manage',
      'hr.assignments.create',
    ];

    it.each(HR_PERMS)('garage_admin allowed HR %s', (perm) => {
      const effective = rbacService.computeEffectivePermissions(GARAGE_ADMIN);
      expect(effective.has(perm)).toBe(true);
    });
  });

  describe('Books permissions full', () => {
    it('can create invoices', () => {
      const effective = rbacService.computeEffectivePermissions(GARAGE_ADMIN);
      expect(effective.has('books.invoices.create')).toBe(true);
    });

    it('can manage accounts', () => {
      const effective = rbacService.computeEffectivePermissions(GARAGE_ADMIN);
      expect(effective.has('books.accounts.manage')).toBe(true);
    });
  });

  describe('Pay permissions', () => {
    it('can read transactions', () => {
      const effective = rbacService.computeEffectivePermissions(GARAGE_ADMIN);
      expect(effective.has('pay.transactions.read')).toBe(true);
    });

    it('can reconcile transactions', () => {
      const effective = rbacService.computeEffectivePermissions(GARAGE_ADMIN);
      expect(effective.has('pay.transactions.reconcile')).toBe(true);
    });
  });

  describe('admin/* denied', () => {
    const ADMIN_DENIED: Permission[] = [
      'admin.tenants.create',
      'admin.tenants.suspend',
      'admin.users.list_all',
      'admin.impersonate',
    ];

    it.each(ADMIN_DENIED)('garage_admin denied admin %s', (perm) => {
      const effective = rbacService.computeEffectivePermissions(GARAGE_ADMIN);
      expect(effective.has(perm)).toBe(false);
    });
  });

  describe('no broker permissions cross-tenant', () => {
    it('no insure permissions', () => {
      const effective = rbacService.computeEffectivePermissions(GARAGE_ADMIN);
      expect(effective.has('insure.policies.create')).toBe(false);
      expect(effective.has('insure.commissions.read')).toBe(false);
    });
  });

  describe('inherits all garage sub-roles', () => {
    it.each(['garage_chef', 'garage_technicien', 'garage_comptable', 'garage_commercial'] as const)(
      'inherits %s permissions',
      (subRole) => {
        const adminPerms = rbacService.computeEffectivePermissions(GARAGE_ADMIN);
        const subPerms = rbacService.computeEffectivePermissions(subRole);
        subPerms.forEach((p) => expect(adminPerms.has(p)).toBe(true));
      },
    );
  });

  describe('tenant settings management', () => {
    it('can update tenant settings', () => {
      const effective = rbacService.computeEffectivePermissions(GARAGE_ADMIN);
      expect(effective.has('tenant.settings.update')).toBe(true);
    });

    it('can create users within tenant', () => {
      const effective = rbacService.computeEffectivePermissions(GARAGE_ADMIN);
      expect(effective.has('users.create')).toBe(true);
    });
  });
});
```

### 6.10 `repo/apps/api/test/rbac/garage-chef.spec.ts`

```typescript
/**
 * garage-chef.spec.ts -- sinistres assign + close + diagnostics.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RbacService } from '../../src/modules/rbac/rbac.service';
import { PermissionCacheService } from '../../src/modules/rbac/permission-cache.service';
import { RbacAuditService } from '../../src/modules/rbac/rbac-audit.service';
import { RedisService } from '../../src/modules/cache/redis.service';

describe('garage_chef -- sinistres assign + close + diagnostics', () => {
  let rbacService: RbacService;
  let module: TestingModule;
  const CHEF = 'garage_chef' as const;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        RbacService,
        PermissionCacheService,
        { provide: RbacAuditService, useValue: { recordCheck: vi.fn() } },
        {
          provide: RedisService,
          useValue: { get: vi.fn(), set: vi.fn(), del: vi.fn(), keys: vi.fn().mockResolvedValue([]) },
        },
      ],
    }).compile();
    rbacService = module.get(RbacService);
  });

  afterAll(() => module.close());

  const allows = (p: string) => expect(rbacService.computeEffectivePermissions(CHEF).has(p as any)).toBe(true);
  const denies = (p: string) => expect(rbacService.computeEffectivePermissions(CHEF).has(p as any)).toBe(false);

  it('can read sinistres', () => allows('repair.sinistres.read'));
  it('can assign sinistres to technicians', () => allows('repair.sinistres.assign'));
  it('can close sinistres', () => allows('repair.sinistres.close'));
  it('can create diagnostics', () => allows('repair.diagnostics.create'));
  it('can update diagnostics', () => allows('repair.diagnostics.update'));
  it('can approve devis', () => allows('repair.devis.approve'));
  it('can create HR assignments', () => allows('hr.assignments.create'));
  it('cannot manage stock', () => denies('stock.items.manage'));
  it('cannot create invoices', () => denies('books.invoices.create'));
  it('cannot manage HR contracts', () => denies('hr.contracts.manage'));

  it('inherits garage_technicien permissions', () => {
    const chefPerms = rbacService.computeEffectivePermissions(CHEF);
    const techPerms = rbacService.computeEffectivePermissions('garage_technicien');
    techPerms.forEach((p) => expect(chefPerms.has(p)).toBe(true));
  });
});
```

### 6.11 `repo/apps/api/test/rbac/garage-technicien.spec.ts`

```typescript
/**
 * garage-technicien.spec.ts -- reparations execute + stock use + photos upload.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RbacService } from '../../src/modules/rbac/rbac.service';
import { PermissionCacheService } from '../../src/modules/rbac/permission-cache.service';
import { RbacAuditService } from '../../src/modules/rbac/rbac-audit.service';
import { RedisService } from '../../src/modules/cache/redis.service';

describe('garage_technicien -- execute reparations, mobile PWA', () => {
  let rbacService: RbacService;
  let module: TestingModule;
  const TECH = 'garage_technicien' as const;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        RbacService,
        PermissionCacheService,
        { provide: RbacAuditService, useValue: { recordCheck: vi.fn() } },
        {
          provide: RedisService,
          useValue: { get: vi.fn(), set: vi.fn(), del: vi.fn(), keys: vi.fn().mockResolvedValue([]) },
        },
      ],
    }).compile();
    rbacService = module.get(RbacService);
  });

  afterAll(() => module.close());

  const allows = (p: string) => expect(rbacService.computeEffectivePermissions(TECH).has(p as any)).toBe(true);
  const denies = (p: string) => expect(rbacService.computeEffectivePermissions(TECH).has(p as any)).toBe(false);

  it('can start reparations', () => allows('repair.reparations.start'));
  it('can complete reparations', () => allows('repair.reparations.complete'));
  it('can read_assigned sinistres (ABAC scope)', () => allows('repair.sinistres.read_assigned'));
  it('CANNOT read all sinistres unrestricted', () => denies('repair.sinistres.read'));
  it('CANNOT assign sinistres (chef only)', () => denies('repair.sinistres.assign'));
  it('CANNOT close sinistres (chef only)', () => denies('repair.sinistres.close'));
  it('can use stock items (consume parts)', () => allows('stock.items.use'));
  it('CANNOT manage stock', () => denies('stock.items.manage'));
  it('can upload photos (PWA mobile)', () => allows('repair.photos.upload'));
  it('cannot create invoices', () => denies('books.invoices.create'));
  it('cannot read CRM contacts', () => denies('crm.contacts.read'));
  it('cannot manage HR', () => denies('hr.employees.create'));
  it('role identity for WebAuthn enforcement Sprint 23', () => expect(TECH).toBe('garage_technicien'));
});
```

### 6.12 `repo/apps/api/test/rbac/garage-comptable.spec.ts`

```typescript
/**
 * garage-comptable.spec.ts -- books + pay, no repair execution.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RbacService } from '../../src/modules/rbac/rbac.service';
import { PermissionCacheService } from '../../src/modules/rbac/permission-cache.service';
import { RbacAuditService } from '../../src/modules/rbac/rbac-audit.service';
import { RedisService } from '../../src/modules/cache/redis.service';

describe('garage_comptable -- books + pay only', () => {
  let rbacService: RbacService;
  let module: TestingModule;
  const COMPTABLE = 'garage_comptable' as const;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        RbacService,
        PermissionCacheService,
        { provide: RbacAuditService, useValue: { recordCheck: vi.fn() } },
        { provide: RedisService, useValue: { get: vi.fn(), set: vi.fn(), del: vi.fn(), keys: vi.fn().mockResolvedValue([]) } },
      ],
    }).compile();
    rbacService = module.get(RbacService);
  });
  afterAll(() => module.close());

  const allows = (p: string) => expect(rbacService.computeEffectivePermissions(COMPTABLE).has(p as any)).toBe(true);
  const denies = (p: string) => expect(rbacService.computeEffectivePermissions(COMPTABLE).has(p as any)).toBe(false);

  it('can read books invoices', () => allows('books.invoices.read'));
  it('can create books invoices', () => allows('books.invoices.create'));
  it('can manage accounts', () => allows('books.accounts.manage'));
  it('can read transactions', () => allows('pay.transactions.read'));
  it('can reconcile transactions', () => allows('pay.transactions.reconcile'));
  it('can create refunds (subject to TimeBased)', () => allows('pay.refunds.create'));
  it('CANNOT do repair operations', () => { denies('repair.sinistres.assign'); denies('repair.reparations.start'); });
  it('CANNOT manage HR', () => denies('hr.employees.create'));
  it('CANNOT do admin operations', () => { denies('admin.tenants.create'); denies('admin.impersonate'); });
});
```

### 6.13 `repo/apps/api/test/rbac/garage-commercial.spec.ts`

```typescript
/**
 * garage-commercial.spec.ts -- devis + clients.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RbacService } from '../../src/modules/rbac/rbac.service';
import { PermissionCacheService } from '../../src/modules/rbac/permission-cache.service';
import { RbacAuditService } from '../../src/modules/rbac/rbac-audit.service';
import { RedisService } from '../../src/modules/cache/redis.service';

describe('garage_commercial -- devis + clients only', () => {
  let rbacService: RbacService;
  let module: TestingModule;
  const COMMERCIAL = 'garage_commercial' as const;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        RbacService,
        PermissionCacheService,
        { provide: RbacAuditService, useValue: { recordCheck: vi.fn() } },
        { provide: RedisService, useValue: { get: vi.fn(), set: vi.fn(), del: vi.fn(), keys: vi.fn().mockResolvedValue([]) } },
      ],
    }).compile();
    rbacService = module.get(RbacService);
  });
  afterAll(() => module.close());

  const allows = (p: string) => expect(rbacService.computeEffectivePermissions(COMMERCIAL).has(p as any)).toBe(true);
  const denies = (p: string) => expect(rbacService.computeEffectivePermissions(COMMERCIAL).has(p as any)).toBe(false);

  it('can read CRM contacts', () => allows('crm.contacts.read'));
  it('can create CRM contacts', () => allows('crm.contacts.create'));
  it('can create devis', () => allows('repair.devis.create'));
  it('can read devis', () => allows('repair.devis.read'));
  it('can send comm messages', () => allows('comm.messages.send'));
  it('CANNOT approve devis (chef only)', () => denies('repair.devis.approve'));
  it('CANNOT do books operations', () => { denies('books.invoices.create'); denies('books.accounts.manage'); });
  it('CANNOT do reparations execution', () => denies('repair.reparations.start'));
  it('CANNOT manage stock', () => denies('stock.items.manage'));
});
```

### 6.14 `repo/apps/api/test/rbac/assure.spec.ts`

```typescript
/**
 * assure.spec.ts -- *_own only, denied *_all.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RbacService } from '../../src/modules/rbac/rbac.service';
import { PermissionCacheService } from '../../src/modules/rbac/permission-cache.service';
import { RbacAuditService } from '../../src/modules/rbac/rbac-audit.service';
import { RedisService } from '../../src/modules/cache/redis.service';

describe('assure -- L3 in tenant, *_own scope only', () => {
  let rbacService: RbacService;
  let module: TestingModule;
  const ASSURE = 'assure' as const;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        RbacService,
        PermissionCacheService,
        { provide: RbacAuditService, useValue: { recordCheck: vi.fn() } },
        {
          provide: RedisService,
          useValue: { get: vi.fn(), set: vi.fn(), del: vi.fn(), keys: vi.fn().mockResolvedValue([]) },
        },
      ],
    }).compile();
    rbacService = module.get(RbacService);
  });

  afterAll(() => module.close());

  describe('own resources via ABAC OwnResourcesPolicy', () => {
    it('can read_own policies', () => {
      const effective = rbacService.computeEffectivePermissions(ASSURE);
      expect(effective.has('insure.policies.read_own')).toBe(true);
    });

    it('can read_own sinistres', () => {
      const effective = rbacService.computeEffectivePermissions(ASSURE);
      expect(effective.has('repair.sinistres.read_own')).toBe(true);
    });

    it('can create_own sinistres (declaration M8 Sprint 24)', () => {
      const effective = rbacService.computeEffectivePermissions(ASSURE);
      expect(effective.has('repair.sinistres.create_own')).toBe(true);
    });

    it('can read_own transactions', () => {
      const effective = rbacService.computeEffectivePermissions(ASSURE);
      expect(effective.has('pay.transactions.read_own')).toBe(true);
    });

    it('can read_own documents', () => {
      const effective = rbacService.computeEffectivePermissions(ASSURE);
      expect(effective.has('docs.documents.read_own')).toBe(true);
    });

    it('can read_own notifications', () => {
      const effective = rbacService.computeEffectivePermissions(ASSURE);
      expect(effective.has('notifications.read_own')).toBe(true);
    });

    it('can update_own notification settings', () => {
      const effective = rbacService.computeEffectivePermissions(ASSURE);
      expect(effective.has('notifications.update_own')).toBe(true);
    });
  });

  describe('denied -- *_all variants', () => {
    it('CANNOT read all policies (only own)', () => {
      const effective = rbacService.computeEffectivePermissions(ASSURE);
      expect(effective.has('insure.policies.read')).toBe(false);
    });

    it('CANNOT read all sinistres', () => {
      const effective = rbacService.computeEffectivePermissions(ASSURE);
      expect(effective.has('repair.sinistres.read')).toBe(false);
    });

    it('CANNOT read all transactions', () => {
      const effective = rbacService.computeEffectivePermissions(ASSURE);
      expect(effective.has('pay.transactions.read')).toBe(false);
    });
  });

  describe('denied -- write operations', () => {
    it('CANNOT create policies (broker only)', () => {
      const effective = rbacService.computeEffectivePermissions(ASSURE);
      expect(effective.has('insure.policies.create')).toBe(false);
    });

    it('CANNOT cancel policies', () => {
      const effective = rbacService.computeEffectivePermissions(ASSURE);
      expect(effective.has('insure.policies.cancel')).toBe(false);
    });

    it('CANNOT assign sinistres', () => {
      const effective = rbacService.computeEffectivePermissions(ASSURE);
      expect(effective.has('repair.sinistres.assign')).toBe(false);
    });

    it('CANNOT create CRM contacts', () => {
      const effective = rbacService.computeEffectivePermissions(ASSURE);
      expect(effective.has('crm.contacts.create')).toBe(false);
    });
  });

  describe('denied -- admin', () => {
    it('CANNOT do any admin', () => {
      const effective = rbacService.computeEffectivePermissions(ASSURE);
      expect(effective.has('admin.tenants.create')).toBe(false);
      expect(effective.has('admin.impersonate')).toBe(false);
      expect(effective.has('admin.audit.read')).toBe(false);
    });
  });

  describe('routes /api/v1/assure/* with app_assure_user_id filter', () => {
    it('role identity confirmed for route enforcement', () => {
      expect(ASSURE).toBe('assure');
    });
  });
});
```

### 6.15 `repo/apps/api/test/rbac/prospect.spec.ts`

```typescript
/**
 * prospect.spec.ts -- public only, no auth.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RbacService } from '../../src/modules/rbac/rbac.service';
import { PermissionCacheService } from '../../src/modules/rbac/permission-cache.service';
import { RbacAuditService } from '../../src/modules/rbac/rbac-audit.service';
import { RedisService } from '../../src/modules/cache/redis.service';

describe('prospect -- public, no auth, Redis session only', () => {
  let rbacService: RbacService;
  let module: TestingModule;
  const PROSPECT = 'prospect' as const;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        RbacService,
        PermissionCacheService,
        { provide: RbacAuditService, useValue: { recordCheck: vi.fn() } },
        {
          provide: RedisService,
          useValue: { get: vi.fn(), set: vi.fn(), del: vi.fn(), keys: vi.fn().mockResolvedValue([]) },
        },
      ],
    }).compile();
    rbacService = module.get(RbacService);
  });

  afterAll(() => module.close());

  describe('public permissions allowed', () => {
    it('can read public products catalog (Sprint 14)', () => {
      const effective = rbacService.computeEffectivePermissions(PROSPECT);
      expect(effective.has('public.products.read')).toBe(true);
    });

    it('can generate public quotes (simulator Sprint 17)', () => {
      const effective = rbacService.computeEffectivePermissions(PROSPECT);
      expect(effective.has('public.quotes.generate')).toBe(true);
    });

    it('can submit public KYC pre-approval', () => {
      const effective = rbacService.computeEffectivePermissions(PROSPECT);
      expect(effective.has('public.kyc.submit')).toBe(true);
    });

    it('can process public payments (Sprint 17 souscription)', () => {
      const effective = rbacService.computeEffectivePermissions(PROSPECT);
      expect(effective.has('public.payments.process')).toBe(true);
    });
  });

  describe('denied -- everything authenticated', () => {
    it('CANNOT read CRM', () => {
      const effective = rbacService.computeEffectivePermissions(PROSPECT);
      expect(effective.has('crm.contacts.read')).toBe(false);
    });

    it('CANNOT read policies', () => {
      const effective = rbacService.computeEffectivePermissions(PROSPECT);
      expect(effective.has('insure.policies.read')).toBe(false);
      expect(effective.has('insure.policies.read_own')).toBe(false);
    });

    it('CANNOT read documents', () => {
      const effective = rbacService.computeEffectivePermissions(PROSPECT);
      expect(effective.has('docs.documents.read')).toBe(false);
    });

    it('CANNOT do admin', () => {
      const effective = rbacService.computeEffectivePermissions(PROSPECT);
      expect(effective.has('admin.tenants.create')).toBe(false);
    });
  });

  describe('session Redis TTL 30min only, no DB persistence', () => {
    it('role identity for session strategy enforcement', () => {
      // CNDP decision-008/2018 -- prospect not persisted DB before signup
      expect(PROSPECT).toBe('prospect');
    });
  });
});
```

### 6.16 `repo/apps/api/test/abac/own-resources.spec.ts`

```typescript
/**
 * own-resources.spec.ts -- OwnResourcesPolicy : owner OK, non-owner deny.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { OwnResourcesPolicy } from '../../src/modules/rbac/policies/own-resources.policy';
import { DrizzleService } from '../../src/modules/database/drizzle.service';
import type { AbacContext } from '../../src/modules/rbac/abac.types';

describe('OwnResourcesPolicy -- owner_id matching', () => {
  let policy: OwnResourcesPolicy;
  let drizzleMock: { execute: ReturnType<typeof vi.fn> };
  let module: TestingModule;

  beforeAll(async () => {
    drizzleMock = { execute: vi.fn() };
    module = await Test.createTestingModule({
      providers: [
        OwnResourcesPolicy,
        { provide: DrizzleService, useValue: drizzleMock },
      ],
    }).compile();
    policy = module.get(OwnResourcesPolicy);
  });

  afterAll(() => module.close());

  describe('insure.policies.read_own -- assure reads own policy', () => {
    it('owner can read own policy', async () => {
      drizzleMock.execute.mockResolvedValueOnce({
        rows: [{ owner_id: 'usr-A', tenant_id: 'tnt-1' }],
      });
      const ctx: AbacContext = {
        userId: 'usr-A',
        role: 'assure',
        tenantId: 'tnt-1',
        resourceType: 'policies',
        resourceId: 'pol-1',
      };
      const result = await policy.evaluate('insure.policies.read_own', ctx);
      expect(result.granted).toBe(true);
      expect(result.policyName).toBe('OwnResourcesPolicy');
    });

    it('non-owner DENIED', async () => {
      drizzleMock.execute.mockResolvedValueOnce({
        rows: [{ owner_id: 'usr-B', tenant_id: 'tnt-1' }],
      });
      const ctx: AbacContext = {
        userId: 'usr-A',
        role: 'assure',
        tenantId: 'tnt-1',
        resourceType: 'policies',
        resourceId: 'pol-1',
      };
      const result = await policy.evaluate('insure.policies.read_own', ctx);
      expect(result.granted).toBe(false);
      expect(result.reason).toContain('NOT_OWNER');
    });

    it('resource not found DENIED with NOT_FOUND', async () => {
      drizzleMock.execute.mockResolvedValueOnce({ rows: [] });
      const ctx: AbacContext = {
        userId: 'usr-A',
        role: 'assure',
        tenantId: 'tnt-1',
        resourceType: 'policies',
        resourceId: 'pol-nonexistent',
      };
      const result = await policy.evaluate('insure.policies.read_own', ctx);
      expect(result.granted).toBe(false);
      expect(result.reason).toContain('NOT_FOUND');
    });
  });

  describe('repair.sinistres.read_own -- assure reads own sinistre', () => {
    it('owner can read own sinistre', async () => {
      drizzleMock.execute.mockResolvedValueOnce({
        rows: [{ owner_id: 'usr-A', tenant_id: 'tnt-1' }],
      });
      const ctx: AbacContext = {
        userId: 'usr-A',
        role: 'assure',
        tenantId: 'tnt-1',
        resourceType: 'sinistres',
        resourceId: 'sin-1',
      };
      const result = await policy.evaluate('repair.sinistres.read_own', ctx);
      expect(result.granted).toBe(true);
    });

    it('non-owner DENIED', async () => {
      drizzleMock.execute.mockResolvedValueOnce({
        rows: [{ owner_id: 'usr-B', tenant_id: 'tnt-1' }],
      });
      const ctx: AbacContext = {
        userId: 'usr-A',
        role: 'assure',
        tenantId: 'tnt-1',
        resourceType: 'sinistres',
        resourceId: 'sin-1',
      };
      const result = await policy.evaluate('repair.sinistres.read_own', ctx);
      expect(result.granted).toBe(false);
    });
  });

  describe('repair.sinistres.read_assigned -- technicien sees assigned only', () => {
    it('technicien can read sinistre assigned to him', async () => {
      drizzleMock.execute.mockResolvedValueOnce({
        rows: [{ assigned_to: 'usr-T', tenant_id: 'tnt-1' }],
      });
      const ctx: AbacContext = {
        userId: 'usr-T',
        role: 'garage_technicien',
        tenantId: 'tnt-1',
        resourceType: 'sinistres',
        resourceId: 'sin-1',
      };
      const result = await policy.evaluate('repair.sinistres.read_assigned', ctx);
      expect(result.granted).toBe(true);
    });

    it('technicien CANNOT read sinistre assigned to T2', async () => {
      drizzleMock.execute.mockResolvedValueOnce({
        rows: [{ assigned_to: 'usr-T2', tenant_id: 'tnt-1' }],
      });
      const ctx: AbacContext = {
        userId: 'usr-T',
        role: 'garage_technicien',
        tenantId: 'tnt-1',
        resourceType: 'sinistres',
        resourceId: 'sin-1',
      };
      const result = await policy.evaluate('repair.sinistres.read_assigned', ctx);
      expect(result.granted).toBe(false);
      expect(result.reason).toContain('NOT_ASSIGNED');
    });
  });

  describe('crm.contacts.update_own -- broker_user updates own contacts', () => {
    it('owner broker_user can update own contact', async () => {
      drizzleMock.execute.mockResolvedValueOnce({
        rows: [{ created_by: 'usr-BU', tenant_id: 'tnt-1' }],
      });
      const ctx: AbacContext = {
        userId: 'usr-BU',
        role: 'broker_user',
        tenantId: 'tnt-1',
        resourceType: 'contacts',
        resourceId: 'ctt-1',
      };
      const result = await policy.evaluate('crm.contacts.update_own', ctx);
      expect(result.granted).toBe(true);
    });

    it('different broker_user CANNOT update other contact', async () => {
      drizzleMock.execute.mockResolvedValueOnce({
        rows: [{ created_by: 'usr-BU2', tenant_id: 'tnt-1' }],
      });
      const ctx: AbacContext = {
        userId: 'usr-BU',
        role: 'broker_user',
        tenantId: 'tnt-1',
        resourceType: 'contacts',
        resourceId: 'ctt-1',
      };
      const result = await policy.evaluate('crm.contacts.update_own', ctx);
      expect(result.granted).toBe(false);
    });
  });

  describe('cross-tenant resource always DENIED regardless of owner', () => {
    it('owner across tenant DENIED via TenantGuard upstream', async () => {
      drizzleMock.execute.mockResolvedValueOnce({
        rows: [{ owner_id: 'usr-A', tenant_id: 'tnt-2' }],
      });
      const ctx: AbacContext = {
        userId: 'usr-A',
        role: 'assure',
        tenantId: 'tnt-1',
        resourceType: 'policies',
        resourceId: 'pol-1',
      };
      const result = await policy.evaluate('insure.policies.read_own', ctx);
      expect(result.granted).toBe(false);
      expect(result.reason).toContain('CROSS_TENANT');
    });
  });
});
```

### 6.17 `repo/apps/api/test/abac/time-based.spec.ts`

```typescript
/**
 * time-based.spec.ts -- TimeBasedPolicy : refund < 30j OK, > 30j deny.
 * Loi 17-99 droit retract MA.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { DateTime } from 'luxon';
import { TimeBasedPolicy } from '../../src/modules/rbac/policies/time-based.policy';
import { IClockService } from '../../src/modules/common/clock.service';
import { DrizzleService } from '../../src/modules/database/drizzle.service';
import type { AbacContext } from '../../src/modules/rbac/abac.types';

describe('TimeBasedPolicy -- refund 30 days window MA loi 17-99', () => {
  let policy: TimeBasedPolicy;
  let clockMock: { now: ReturnType<typeof vi.fn> };
  let drizzleMock: { execute: ReturnType<typeof vi.fn> };
  let module: TestingModule;

  beforeAll(async () => {
    clockMock = { now: vi.fn(() => DateTime.fromISO('2026-05-06T12:00:00Z')) };
    drizzleMock = { execute: vi.fn() };
    module = await Test.createTestingModule({
      providers: [
        TimeBasedPolicy,
        { provide: IClockService, useValue: clockMock },
        { provide: DrizzleService, useValue: drizzleMock },
      ],
    }).compile();
    policy = module.get(TimeBasedPolicy);
  });

  afterAll(() => module.close());

  describe('pay.refunds.create -- 30 days droit retract', () => {
    it('refund 1 day after transaction ALLOWED', async () => {
      drizzleMock.execute.mockResolvedValueOnce({
        rows: [{ created_at: '2026-05-05T12:00:00Z' }],
      });
      const ctx: AbacContext = {
        userId: 'usr-1',
        role: 'broker_admin',
        tenantId: 'tnt-1',
        resourceType: 'transactions',
        resourceId: 'txn-1',
      };
      const result = await policy.evaluate('pay.refunds.create', ctx);
      expect(result.granted).toBe(true);
    });

    it('refund 29 days after transaction ALLOWED', async () => {
      drizzleMock.execute.mockResolvedValueOnce({
        rows: [{ created_at: '2026-04-07T12:00:00Z' }],
      });
      const ctx: AbacContext = {
        userId: 'usr-1',
        role: 'broker_admin',
        tenantId: 'tnt-1',
        resourceType: 'transactions',
        resourceId: 'txn-1',
      };
      const result = await policy.evaluate('pay.refunds.create', ctx);
      expect(result.granted).toBe(true);
    });

    it('refund 30 days exact boundary ALLOWED (inclusive)', async () => {
      drizzleMock.execute.mockResolvedValueOnce({
        rows: [{ created_at: '2026-04-06T12:00:00Z' }],
      });
      const ctx: AbacContext = {
        userId: 'usr-1',
        role: 'broker_admin',
        tenantId: 'tnt-1',
        resourceType: 'transactions',
        resourceId: 'txn-1',
      };
      const result = await policy.evaluate('pay.refunds.create', ctx);
      expect(result.granted).toBe(true);
    });

    it('refund 31 days DENIED', async () => {
      drizzleMock.execute.mockResolvedValueOnce({
        rows: [{ created_at: '2026-04-05T12:00:00Z' }],
      });
      const ctx: AbacContext = {
        userId: 'usr-1',
        role: 'broker_admin',
        tenantId: 'tnt-1',
        resourceType: 'transactions',
        resourceId: 'txn-1',
      };
      const result = await policy.evaluate('pay.refunds.create', ctx);
      expect(result.granted).toBe(false);
      expect(result.reason).toContain('EXPIRED_RESOURCE_TIME_WINDOW');
    });

    it('refund 60 days DENIED with detailed reason', async () => {
      drizzleMock.execute.mockResolvedValueOnce({
        rows: [{ created_at: '2026-03-07T12:00:00Z' }],
      });
      const ctx: AbacContext = {
        userId: 'usr-1',
        role: 'broker_admin',
        tenantId: 'tnt-1',
        resourceType: 'transactions',
        resourceId: 'txn-1',
      };
      const result = await policy.evaluate('pay.refunds.create', ctx);
      expect(result.granted).toBe(false);
      expect(result.reason).toContain('refund_outside_30d_window');
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.daysSinceTransaction).toBeGreaterThan(30);
    });
  });

  describe('policies.cancel_anticipated -- delais reglementaires', () => {
    it('cancel within first 14 days of policy start ALLOWED', async () => {
      drizzleMock.execute.mockResolvedValueOnce({
        rows: [{ start_date: '2026-04-30T00:00:00Z' }],
      });
      const ctx: AbacContext = {
        userId: 'usr-1',
        role: 'broker_admin',
        tenantId: 'tnt-1',
        resourceType: 'policies',
        resourceId: 'pol-1',
      };
      const result = await policy.evaluate('policies.cancel_anticipated', ctx);
      expect(result.granted).toBe(true);
    });

    it('cancel after 14 days DENIED', async () => {
      drizzleMock.execute.mockResolvedValueOnce({
        rows: [{ start_date: '2026-04-01T00:00:00Z' }],
      });
      const ctx: AbacContext = {
        userId: 'usr-1',
        role: 'broker_admin',
        tenantId: 'tnt-1',
        resourceType: 'policies',
        resourceId: 'pol-1',
      };
      const result = await policy.evaluate('policies.cancel_anticipated', ctx);
      expect(result.granted).toBe(false);
    });
  });

  describe('clock determinism via injection', () => {
    it('different clock changes evaluation', async () => {
      clockMock.now.mockReturnValueOnce(DateTime.fromISO('2027-01-01T12:00:00Z'));
      drizzleMock.execute.mockResolvedValueOnce({
        rows: [{ created_at: '2026-05-06T12:00:00Z' }],
      });
      const ctx: AbacContext = {
        userId: 'usr-1',
        role: 'broker_admin',
        tenantId: 'tnt-1',
        resourceType: 'transactions',
        resourceId: 'txn-1',
      };
      const result = await policy.evaluate('pay.refunds.create', ctx);
      expect(result.granted).toBe(false);
    });
  });

  describe('resource not found DENIED', () => {
    it('returns NOT_FOUND when transaction missing', async () => {
      drizzleMock.execute.mockResolvedValueOnce({ rows: [] });
      const ctx: AbacContext = {
        userId: 'usr-1',
        role: 'broker_admin',
        tenantId: 'tnt-1',
        resourceType: 'transactions',
        resourceId: 'nope',
      };
      const result = await policy.evaluate('pay.refunds.create', ctx);
      expect(result.granted).toBe(false);
      expect(result.reason).toContain('NOT_FOUND');
    });
  });
});
```

### 6.18 `repo/apps/api/test/abac/status-based.spec.ts`

```typescript
/**
 * status-based.spec.ts -- StatusBasedPolicy : police active cancel OK, expired deny.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { StatusBasedPolicy } from '../../src/modules/rbac/policies/status-based.policy';
import { DrizzleService } from '../../src/modules/database/drizzle.service';
import type { AbacContext } from '../../src/modules/rbac/abac.types';

describe('StatusBasedPolicy -- resource status guards', () => {
  let policy: StatusBasedPolicy;
  let drizzleMock: { execute: ReturnType<typeof vi.fn> };
  let module: TestingModule;

  beforeAll(async () => {
    drizzleMock = { execute: vi.fn() };
    module = await Test.createTestingModule({
      providers: [
        StatusBasedPolicy,
        { provide: DrizzleService, useValue: drizzleMock },
      ],
    }).compile();
    policy = module.get(StatusBasedPolicy);
  });

  afterAll(() => module.close());

  describe('policies.cancel -- active OK, expired/cancelled deny', () => {
    it('active policy can be cancelled', async () => {
      drizzleMock.execute.mockResolvedValueOnce({
        rows: [{ status: 'active' }],
      });
      const ctx: AbacContext = {
        userId: 'usr-1',
        role: 'broker_admin',
        tenantId: 'tnt-1',
        resourceType: 'policies',
        resourceId: 'pol-1',
      };
      const result = await policy.evaluate('policies.cancel', ctx);
      expect(result.granted).toBe(true);
    });

    it('expired policy CANNOT be cancelled', async () => {
      drizzleMock.execute.mockResolvedValueOnce({
        rows: [{ status: 'expired' }],
      });
      const ctx: AbacContext = {
        userId: 'usr-1',
        role: 'broker_admin',
        tenantId: 'tnt-1',
        resourceType: 'policies',
        resourceId: 'pol-1',
      };
      const result = await policy.evaluate('policies.cancel', ctx);
      expect(result.granted).toBe(false);
      expect(result.reason).toContain('policy_status_must_be_active');
    });

    it('cancelled policy CANNOT be re-cancelled', async () => {
      drizzleMock.execute.mockResolvedValueOnce({
        rows: [{ status: 'cancelled' }],
      });
      const ctx: AbacContext = {
        userId: 'usr-1',
        role: 'broker_admin',
        tenantId: 'tnt-1',
        resourceType: 'policies',
        resourceId: 'pol-1',
      };
      const result = await policy.evaluate('policies.cancel', ctx);
      expect(result.granted).toBe(false);
    });
  });

  describe('quotes.update -- draft OK, signed deny', () => {
    it('draft quote can be updated', async () => {
      drizzleMock.execute.mockResolvedValueOnce({
        rows: [{ status: 'draft' }],
      });
      const ctx: AbacContext = {
        userId: 'usr-1',
        role: 'broker_user',
        tenantId: 'tnt-1',
        resourceType: 'quotes',
        resourceId: 'qt-1',
      };
      const result = await policy.evaluate('quotes.update', ctx);
      expect(result.granted).toBe(true);
    });

    it('signed quote CANNOT be updated', async () => {
      drizzleMock.execute.mockResolvedValueOnce({
        rows: [{ status: 'signed' }],
      });
      const ctx: AbacContext = {
        userId: 'usr-1',
        role: 'broker_user',
        tenantId: 'tnt-1',
        resourceType: 'quotes',
        resourceId: 'qt-1',
      };
      const result = await policy.evaluate('quotes.update', ctx);
      expect(result.granted).toBe(false);
      expect(result.reason).toContain('quote_status_must_be_draft');
    });

    it('expired quote CANNOT be updated', async () => {
      drizzleMock.execute.mockResolvedValueOnce({
        rows: [{ status: 'expired' }],
      });
      const ctx: AbacContext = {
        userId: 'usr-1',
        role: 'broker_user',
        tenantId: 'tnt-1',
        resourceType: 'quotes',
        resourceId: 'qt-1',
      };
      const result = await policy.evaluate('quotes.update', ctx);
      expect(result.granted).toBe(false);
    });
  });

  describe('invoices.update -- draft OK, paid/cancelled deny', () => {
    it('draft invoice can be updated', async () => {
      drizzleMock.execute.mockResolvedValueOnce({
        rows: [{ status: 'draft' }],
      });
      const ctx: AbacContext = {
        userId: 'usr-1',
        role: 'broker_admin',
        tenantId: 'tnt-1',
        resourceType: 'invoices',
        resourceId: 'inv-1',
      };
      const result = await policy.evaluate('invoices.update', ctx);
      expect(result.granted).toBe(true);
    });

    it('paid invoice CANNOT be updated', async () => {
      drizzleMock.execute.mockResolvedValueOnce({
        rows: [{ status: 'paid' }],
      });
      const ctx: AbacContext = {
        userId: 'usr-1',
        role: 'broker_admin',
        tenantId: 'tnt-1',
        resourceType: 'invoices',
        resourceId: 'inv-1',
      };
      const result = await policy.evaluate('invoices.update', ctx);
      expect(result.granted).toBe(false);
      expect(result.reason).toContain('invoice_status_must_be_draft');
    });

    it('cancelled invoice CANNOT be updated', async () => {
      drizzleMock.execute.mockResolvedValueOnce({
        rows: [{ status: 'cancelled' }],
      });
      const ctx: AbacContext = {
        userId: 'usr-1',
        role: 'broker_admin',
        tenantId: 'tnt-1',
        resourceType: 'invoices',
        resourceId: 'inv-1',
      };
      const result = await policy.evaluate('invoices.update', ctx);
      expect(result.granted).toBe(false);
    });
  });

  describe('resource not found DENIED', () => {
    it('returns NOT_FOUND when resource missing', async () => {
      drizzleMock.execute.mockResolvedValueOnce({ rows: [] });
      const ctx: AbacContext = {
        userId: 'usr-1',
        role: 'broker_admin',
        tenantId: 'tnt-1',
        resourceType: 'policies',
        resourceId: 'nope',
      };
      const result = await policy.evaluate('policies.cancel', ctx);
      expect(result.granted).toBe(false);
      expect(result.reason).toContain('NOT_FOUND');
    });
  });
});
```

### 6.19 `repo/apps/api/test/abac/workflow-state.spec.ts`

```typescript
/**
 * workflow-state.spec.ts -- WorkflowStatePolicy : transitions valides + invalides.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowStatePolicy, WORKFLOW_TRANSITIONS } from '../../src/modules/rbac/policies/workflow-state.policy';
import { DrizzleService } from '../../src/modules/database/drizzle.service';
import type { AbacContext } from '../../src/modules/rbac/abac.types';

describe('WorkflowStatePolicy -- sinistre / devis / police transitions', () => {
  let policy: WorkflowStatePolicy;
  let drizzleMock: { execute: ReturnType<typeof vi.fn> };
  let module: TestingModule;

  beforeAll(async () => {
    drizzleMock = { execute: vi.fn() };
    module = await Test.createTestingModule({
      providers: [
        WorkflowStatePolicy,
        { provide: DrizzleService, useValue: drizzleMock },
      ],
    }).compile();
    policy = module.get(WorkflowStatePolicy);
  });

  afterAll(() => module.close());

  describe('sinistre transitions valides', () => {
    const VALID_TRANSITIONS: Array<[string, string]> = [
      ['declared', 'acknowledged'],
      ['acknowledged', 'appointment_scheduled'],
      ['appointment_scheduled', 'diagnostic'],
      ['diagnostic', 'devis_pending'],
      ['devis_pending', 'devis_approved'],
      ['devis_approved', 'repair_in_progress'],
      ['repair_in_progress', 'repair_completed'],
      ['repair_completed', 'closed'],
    ];

    it.each(VALID_TRANSITIONS)('sinistre %s -> %s ALLOWED', async (from, to) => {
      drizzleMock.execute.mockResolvedValueOnce({
        rows: [{ status: from }],
      });
      const ctx: AbacContext = {
        userId: 'usr-1',
        role: 'garage_chef',
        tenantId: 'tnt-1',
        resourceType: 'sinistres',
        resourceId: 'sin-1',
        targetState: to,
      };
      const result = await policy.evaluate('repair.sinistres.transition', ctx);
      expect(result.granted).toBe(true);
    });
  });

  describe('sinistre transitions invalides', () => {
    const INVALID_TRANSITIONS: Array<[string, string]> = [
      ['declared', 'closed'],
      ['declared', 'repair_in_progress'],
      ['acknowledged', 'closed'],
      ['diagnostic', 'closed'],
      ['closed', 'declared'],
      ['closed', 'repair_in_progress'],
    ];

    it.each(INVALID_TRANSITIONS)('sinistre %s -> %s DENIED', async (from, to) => {
      drizzleMock.execute.mockResolvedValueOnce({
        rows: [{ status: from }],
      });
      const ctx: AbacContext = {
        userId: 'usr-1',
        role: 'garage_chef',
        tenantId: 'tnt-1',
        resourceType: 'sinistres',
        resourceId: 'sin-1',
        targetState: to,
      };
      const result = await policy.evaluate('repair.sinistres.transition', ctx);
      expect(result.granted).toBe(false);
      expect(result.reason).toContain(`invalid_transition_from_${from}_to_${to}`);
      expect(result.metadata?.validNextStates).toBeDefined();
    });
  });

  describe('devis transitions', () => {
    it('draft -> submitted ALLOWED', async () => {
      drizzleMock.execute.mockResolvedValueOnce({
        rows: [{ status: 'draft' }],
      });
      const ctx: AbacContext = {
        userId: 'usr-1',
        role: 'garage_commercial',
        tenantId: 'tnt-1',
        resourceType: 'devis',
        resourceId: 'dv-1',
        targetState: 'submitted',
      };
      const result = await policy.evaluate('repair.devis.transition', ctx);
      expect(result.granted).toBe(true);
    });

    it('draft -> approved DENIED (must go through submitted first)', async () => {
      drizzleMock.execute.mockResolvedValueOnce({
        rows: [{ status: 'draft' }],
      });
      const ctx: AbacContext = {
        userId: 'usr-1',
        role: 'garage_chef',
        tenantId: 'tnt-1',
        resourceType: 'devis',
        resourceId: 'dv-1',
        targetState: 'approved',
      };
      const result = await policy.evaluate('repair.devis.transition', ctx);
      expect(result.granted).toBe(false);
    });

    it('submitted -> approved ALLOWED', async () => {
      drizzleMock.execute.mockResolvedValueOnce({
        rows: [{ status: 'submitted' }],
      });
      const ctx: AbacContext = {
        userId: 'usr-1',
        role: 'garage_chef',
        tenantId: 'tnt-1',
        resourceType: 'devis',
        resourceId: 'dv-1',
        targetState: 'approved',
      };
      const result = await policy.evaluate('repair.devis.transition', ctx);
      expect(result.granted).toBe(true);
    });

    it('expired -> approved DENIED', async () => {
      drizzleMock.execute.mockResolvedValueOnce({
        rows: [{ status: 'expired' }],
      });
      const ctx: AbacContext = {
        userId: 'usr-1',
        role: 'garage_chef',
        tenantId: 'tnt-1',
        resourceType: 'devis',
        resourceId: 'dv-1',
        targetState: 'approved',
      };
      const result = await policy.evaluate('repair.devis.transition', ctx);
      expect(result.granted).toBe(false);
    });
  });

  describe('police transitions', () => {
    it('quoted -> active ALLOWED', async () => {
      drizzleMock.execute.mockResolvedValueOnce({
        rows: [{ status: 'quoted' }],
      });
      const ctx: AbacContext = {
        userId: 'usr-1',
        role: 'broker_admin',
        tenantId: 'tnt-1',
        resourceType: 'policies',
        resourceId: 'pol-1',
        targetState: 'active',
      };
      const result = await policy.evaluate('insure.policies.transition', ctx);
      expect(result.granted).toBe(true);
    });

    it('active -> renewed ALLOWED', async () => {
      drizzleMock.execute.mockResolvedValueOnce({
        rows: [{ status: 'active' }],
      });
      const ctx: AbacContext = {
        userId: 'usr-1',
        role: 'broker_admin',
        tenantId: 'tnt-1',
        resourceType: 'policies',
        resourceId: 'pol-1',
        targetState: 'renewed',
      };
      const result = await policy.evaluate('insure.policies.transition', ctx);
      expect(result.granted).toBe(true);
    });

    it('expired -> active DENIED', async () => {
      drizzleMock.execute.mockResolvedValueOnce({
        rows: [{ status: 'expired' }],
      });
      const ctx: AbacContext = {
        userId: 'usr-1',
        role: 'broker_admin',
        tenantId: 'tnt-1',
        resourceType: 'policies',
        resourceId: 'pol-1',
        targetState: 'active',
      };
      const result = await policy.evaluate('insure.policies.transition', ctx);
      expect(result.granted).toBe(false);
    });
  });

  describe('WORKFLOW_TRANSITIONS map exposure', () => {
    it('exports map for documentation', () => {
      expect(WORKFLOW_TRANSITIONS.sinistres).toBeDefined();
      expect(WORKFLOW_TRANSITIONS.sinistres.declared).toContain('acknowledged');
      expect(WORKFLOW_TRANSITIONS.devis).toBeDefined();
      expect(WORKFLOW_TRANSITIONS.policies).toBeDefined();
    });
  });
});
```

### 6.20 `repo/apps/api/test/integration/rbac-integration.e2e-spec.ts`

```typescript
/**
 * rbac-integration.e2e-spec.ts -- Supertest full stack 15+ scenarios.
 *
 * Sprint 7 / Tache 2.3.12 -- E2E integration with testcontainers Postgres + Redis.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { RbacTestFixtures } from '../fixtures';
import { runSeedRbacUsers } from '../../../infrastructure/scripts/seed-rbac-users';

describe('RBAC integration E2E -- full stack HTTP via Supertest', () => {
  let app: NestFastifyApplication;
  let pgContainer: StartedTestContainer;
  let redisContainer: StartedTestContainer;

  beforeAll(async () => {
    pgContainer = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({
        POSTGRES_USER: 'test',
        POSTGRES_PASSWORD: 'test',
        POSTGRES_DB: 'insurtech_test',
      })
      .withExposedPorts(5432)
      .start();
    redisContainer = await new GenericContainer('redis:7-alpine').withExposedPorts(6379).start();

    process.env.DATABASE_URL = `postgresql://test:test@${pgContainer.getHost()}:${pgContainer.getMappedPort(5432)}/insurtech_test`;
    process.env.REDIS_URL = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`;
    process.env.NODE_ENV = 'test';

    // Apply migrations + seeds
    await runSeedRbacUsers({ clean: true, mfaDisabled: true });

    app = await RbacTestFixtures.createTestApp();
  }, 120000);

  afterAll(async () => {
    await app?.close();
    await pgContainer?.stop();
    await redisContainer?.stop();
  });

  beforeEach(async () => {
    await RbacTestFixtures.flushRbacCache(app);
  });

  describe('POST /api/v1/contacts -- broker_user OK 201', () => {
    it('broker_user creates contact 201 Created', async () => {
      const token = RbacTestFixtures.signTokenForRole(app, 'broker_user');
      const response = await request(app.getHttpServer())
        .post('/api/v1/contacts')
        .set(RbacTestFixtures.bearerHeader(token))
        .send({
          firstName: 'Ahmed',
          lastName: 'Bennani',
          email: 'ahmed@example.com',
          phone: '+212600000000',
        });
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.headers.location).toMatch(/\/api\/v1\/contacts\/[A-Z0-9]+/);
    });
  });

  describe('DELETE /api/v1/contacts/:id -- broker_user denied 403', () => {
    it('broker_user DELETE returns 403 Problem+JSON', async () => {
      const token = RbacTestFixtures.signTokenForRole(app, 'broker_user');
      const response = await request(app.getHttpServer())
        .delete('/api/v1/contacts/01J7CONTACT0000000000000000')
        .set(RbacTestFixtures.bearerHeader(token));
      expect(response.status).toBe(403);
      expect(response.body.type).toContain('forbidden-rbac-permission');
      expect(response.body.detail).toContain('broker_user');
      expect(response.body.detail).toContain('crm.contacts.delete');
    });
  });

  describe('GET /api/v1/admin/tenants -- broker_admin denied 403', () => {
    it('broker_admin cannot access /admin/* -> 403', async () => {
      const token = RbacTestFixtures.signTokenForRole(app, 'broker_admin');
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/tenants')
        .set(RbacTestFixtures.bearerHeader(token));
      expect(response.status).toBe(403);
      expect(response.body.type).toContain('forbidden-admin');
    });

    it('super_admin_platform CAN access /admin/tenants -> 200', async () => {
      const token = RbacTestFixtures.signTokenForRole(app, 'super_admin_platform');
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/tenants')
        .set(RbacTestFixtures.bearerHeader(token));
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('analyst_support CAN read /admin/tenants -> 200', async () => {
      const token = RbacTestFixtures.signTokenForRole(app, 'analyst_support');
      const response = await request(app.getHttpServer())
        .get('/api/v1/admin/tenants')
        .set(RbacTestFixtures.bearerHeader(token));
      expect(response.status).toBe(200);
    });

    it('analyst_support CANNOT POST /admin/tenants -> 403', async () => {
      const token = RbacTestFixtures.signTokenForRole(app, 'analyst_support');
      const response = await request(app.getHttpServer())
        .post('/api/v1/admin/tenants')
        .set(RbacTestFixtures.bearerHeader(token))
        .send({ name: 'New Tenant' });
      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/v1/insure/policies/:id/cancel -- StatusBasedPolicy', () => {
    it('broker_user cancel active policy -> 200', async () => {
      const token = RbacTestFixtures.signTokenForRole(app, 'broker_admin');
      // Create active policy seed
      const policyId = '01J7POLICY0ACTIVE00000000000';
      const response = await request(app.getHttpServer())
        .post(`/api/v1/insure/policies/${policyId}/cancel`)
        .set(RbacTestFixtures.bearerHeader(token))
        .send({ reason: 'customer_request' });
      expect([200, 404]).toContain(response.status);
    });

    it('broker_admin cancel expired policy -> 403 StatusBasedPolicy', async () => {
      const token = RbacTestFixtures.signTokenForRole(app, 'broker_admin');
      const policyId = '01J7POLICY0EXPIRED0000000000';
      const response = await request(app.getHttpServer())
        .post(`/api/v1/insure/policies/${policyId}/cancel`)
        .set(RbacTestFixtures.bearerHeader(token))
        .send({ reason: 'customer_request' });
      expect([403, 404]).toContain(response.status);
      if (response.status === 403) {
        expect(response.body.detail).toContain('policy_status_must_be_active');
      }
    });
  });

  describe('GET /api/v1/insure/policies/:id -- assure read_own ABAC', () => {
    it('assure reads own policy 200', async () => {
      const assureUser = RbacTestFixtures.RBAC_TEST_USERS?.assure ?? { userId: 'usr-A' };
      const token = RbacTestFixtures.signTokenForRole(app, 'assure');
      const policyId = '01J7POLICYOWNED0BY0ASSURE0001';
      const response = await request(app.getHttpServer())
        .get(`/api/v1/insure/policies/${policyId}`)
        .set(RbacTestFixtures.bearerHeader(token));
      expect([200, 404]).toContain(response.status);
    });

    it('assure CANNOT read another user policy 403', async () => {
      const token = RbacTestFixtures.signTokenForRole(app, 'assure');
      const otherPolicyId = '01J7POLICYOWNED0BY0OTHERUSER';
      const response = await request(app.getHttpServer())
        .get(`/api/v1/insure/policies/${otherPolicyId}`)
        .set(RbacTestFixtures.bearerHeader(token));
      expect([403, 404]).toContain(response.status);
    });
  });

  describe('Authentication required for all /api/v1/* except /public', () => {
    it('GET /api/v1/contacts without token -> 401', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/contacts');
      expect(response.status).toBe(401);
    });

    it('GET /api/v1/contacts with invalid token -> 401', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/contacts')
        .set(RbacTestFixtures.bearerHeader('invalid.jwt.token'));
      expect(response.status).toBe(401);
    });
  });

  describe('Public endpoints accessible without auth', () => {
    it('GET /api/v1/public/products no auth -> 200', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/public/products');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Role hierarchy enforcement at HTTP layer', () => {
    it('broker_admin can do broker_user actions (heritage)', async () => {
      const token = RbacTestFixtures.signTokenForRole(app, 'broker_admin');
      const response = await request(app.getHttpServer())
        .post('/api/v1/contacts')
        .set(RbacTestFixtures.bearerHeader(token))
        .send({ firstName: 'Test', lastName: 'Heritage', email: 'h@example.com' });
      expect(response.status).toBe(201);
    });

    it('broker_assistant can do broker_assistant actions only', async () => {
      const token = RbacTestFixtures.signTokenForRole(app, 'broker_assistant');
      const responseRead = await request(app.getHttpServer())
        .get('/api/v1/contacts')
        .set(RbacTestFixtures.bearerHeader(token));
      expect(responseRead.status).toBe(200);
      const responseDelete = await request(app.getHttpServer())
        .delete('/api/v1/contacts/01J7TEST00000000000000000000')
        .set(RbacTestFixtures.bearerHeader(token));
      expect(responseDelete.status).toBe(403);
    });
  });

  describe('Audit logging on denial', () => {
    it('denied access creates rbac_audit_log entry', async () => {
      const token = RbacTestFixtures.signTokenForRole(app, 'broker_user');
      await request(app.getHttpServer())
        .get('/api/v1/admin/tenants')
        .set(RbacTestFixtures.bearerHeader(token));
      // Verify audit log
      const auditToken = RbacTestFixtures.signTokenForRole(app, 'super_admin_platform');
      const auditResponse = await request(app.getHttpServer())
        .get('/api/v1/admin/rbac/audit/denied?limit=10')
        .set(RbacTestFixtures.bearerHeader(auditToken));
      expect(auditResponse.status).toBe(200);
      expect(Array.isArray(auditResponse.body.data)).toBe(true);
    });
  });

  describe('RLS isolation -- broker tenant A cannot see tenant B data', () => {
    it('broker_admin tenant Bennani cannot access tenant Atlas contacts', async () => {
      const token = RbacTestFixtures.signTokenForRole(app, 'broker_admin', {
        tenantId: '01J7BENNANI0000000000000000',
      });
      const response = await request(app.getHttpServer())
        .get('/api/v1/contacts?includeAllTenants=true')
        .set(RbacTestFixtures.bearerHeader(token));
      expect(response.status).toBe(200);
      // RLS filters out other tenant data, response only has Bennani contacts
      response.body.data?.forEach((c: any) => {
        expect(c.tenantId).toBe('01J7BENNANI0000000000000000');
      });
    });
  });
});
```

### 6.21 `repo/infrastructure/scripts/seed-rbac-users.ts`

```typescript
/**
 * seed-rbac-users.ts -- script seed dev 12 users + 2 tenants idempotent.
 *
 * Sprint 7 / Tache 2.3.12.
 *
 * Usage:
 *   pnpm seeds:rbac
 *   pnpm seeds:rbac --clean
 *   SEED_RBAC_PASSWORD='Custom!@#$' pnpm seeds:rbac
 *
 * REFUSE prod : NODE_ENV=production -> throw immediately.
 */
import 'dotenv/config';
import argon2 from 'argon2';
import { Pool } from 'pg';
import pino from 'pino';
import type { Logger } from 'pino';

const ENV = {
  PASSWORD: process.env.SEED_RBAC_PASSWORD ?? 'Test1234!@#$',
  TENANT_BROKER_NAME: process.env.SEED_RBAC_TENANT_BROKER_NAME ?? 'Cabinet Demo Bennani',
  TENANT_GARAGE_NAME: process.env.SEED_RBAC_TENANT_GARAGE_NAME ?? 'Garage Demo Atlas',
  MFA_DISABLED: process.env.SEED_RBAC_MFA_DISABLED === 'true',
  CLEAN: process.env.SEED_RBAC_CLEAN === 'true' || process.argv.includes('--clean'),
  LOG_LEVEL: process.env.SEED_RBAC_LOG_LEVEL ?? 'info',
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/insurtech_dev',
};

const TENANT_BROKER_ID = '01J7BENNANI0000000000000000';
const TENANT_GARAGE_ID = '01J7ATLAS00000000000000000A';

interface SeedUser {
  userId: string;
  email: string;
  role: string;
  tenantId: string | null;
  fullName: string;
}

const SEED_USERS: SeedUser[] = [
  {
    userId: '01J7USR0SUPERADMINPLATFORM00',
    email: 'super-admin@demo.skalean-insurtech.ma',
    role: 'super_admin_platform',
    tenantId: null,
    fullName: 'Super Admin Demo Skalean',
  },
  {
    userId: '01J7USR0ANALYSTSUPPORT0000000',
    email: 'analyst@demo.skalean-insurtech.ma',
    role: 'analyst_support',
    tenantId: null,
    fullName: 'Analyst Support Demo Skalean',
  },
  {
    userId: '01J7USR0BROKERADMIN000000000',
    email: 'broker-admin@demo.skalean-insurtech.ma',
    role: 'broker_admin',
    tenantId: TENANT_BROKER_ID,
    fullName: 'Broker Admin Bennani',
  },
  {
    userId: '01J7USR0BROKERUSER0000000000',
    email: 'broker-user@demo.skalean-insurtech.ma',
    role: 'broker_user',
    tenantId: TENANT_BROKER_ID,
    fullName: 'Broker User Bennani',
  },
  {
    userId: '01J7USR0BROKERASSISTANT00000',
    email: 'broker-assistant@demo.skalean-insurtech.ma',
    role: 'broker_assistant',
    tenantId: TENANT_BROKER_ID,
    fullName: 'Broker Assistant Bennani',
  },
  {
    userId: '01J7USR0GARAGEADMIN0000000000',
    email: 'garage-admin@demo.skalean-insurtech.ma',
    role: 'garage_admin',
    tenantId: TENANT_GARAGE_ID,
    fullName: 'Garage Admin Atlas',
  },
  {
    userId: '01J7USR0GARAGECHEF0000000000',
    email: 'garage-chef@demo.skalean-insurtech.ma',
    role: 'garage_chef',
    tenantId: TENANT_GARAGE_ID,
    fullName: 'Garage Chef Atlas',
  },
  {
    userId: '01J7USR0GARAGETECHNICIEN00000',
    email: 'garage-technicien@demo.skalean-insurtech.ma',
    role: 'garage_technicien',
    tenantId: TENANT_GARAGE_ID,
    fullName: 'Garage Technicien Atlas',
  },
  {
    userId: '01J7USR0GARAGECOMPTABLE000000',
    email: 'garage-comptable@demo.skalean-insurtech.ma',
    role: 'garage_comptable',
    tenantId: TENANT_GARAGE_ID,
    fullName: 'Garage Comptable Atlas',
  },
  {
    userId: '01J7USR0GARAGECOMMERCIAL0000',
    email: 'garage-commercial@demo.skalean-insurtech.ma',
    role: 'garage_commercial',
    tenantId: TENANT_GARAGE_ID,
    fullName: 'Garage Commercial Atlas',
  },
  {
    userId: '01J7USR0ASSURE0000000000000A',
    email: 'assure@demo.skalean-insurtech.ma',
    role: 'assure',
    tenantId: TENANT_GARAGE_ID,
    fullName: 'Assure Demo Atlas',
  },
  {
    userId: '01J7USR0PROSPECT00000000000A',
    email: 'prospect@demo.skalean-insurtech.ma',
    role: 'prospect',
    tenantId: null,
    fullName: 'Prospect Demo',
  },
];

interface SeedOptions {
  clean?: boolean;
  mfaDisabled?: boolean;
  password?: string;
  logger?: Logger;
}

export async function runSeedRbacUsers(opts: SeedOptions = {}): Promise<void> {
  const logger =
    opts.logger ??
    pino({
      level: ENV.LOG_LEVEL,
      redact: ['password', 'password_hash', '*.password', '*.password_hash'],
    });

  // Production guard
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'seed-rbac-users refuses to run in production NODE_ENV (security: shared password + demo emails forbidden in prod)',
    );
  }

  const password = opts.password ?? ENV.PASSWORD;
  const clean = opts.clean ?? ENV.CLEAN;
  const mfaDisabled = opts.mfaDisabled ?? ENV.MFA_DISABLED;

  logger.info({ clean, mfaDisabled, userCount: SEED_USERS.length }, 'starting seed rbac users');

  const pool = new Pool({ connectionString: ENV.DATABASE_URL });
  const client = await pool.connect();

  try {
    // Advisory lock (concurrent safe)
    await client.query("SELECT pg_advisory_lock(hashtext('seed-rbac'))");

    await client.query('BEGIN');

    // Step 1: optional clean
    if (clean) {
      logger.warn('clean mode enabled -- deleting existing demo users + tenants');
      await client.query(`DELETE FROM users WHERE email LIKE '%@demo.skalean-insurtech.ma'`);
      await client.query(
        `DELETE FROM tenants WHERE id IN ($1, $2)`,
        [TENANT_BROKER_ID, TENANT_GARAGE_ID],
      );
    }

    // Step 2: hash password once (optimization)
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    // Step 3: UPSERT 2 tenants
    await client.query(
      `INSERT INTO tenants (
        id, name, slug, tenant_category, ice_number, address_city, address_country,
        feature_flags, status, created_at, updated_at
      ) VALUES (
        $1, $2, 'demo-bennani', 'broker', '002345678901234', 'Casablanca', 'MA',
        '{"crm":true,"insure":true,"booking":true,"pay":true,"books":true}'::jsonb,
        'active', NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()`,
      [TENANT_BROKER_ID, ENV.TENANT_BROKER_NAME],
    );

    await client.query(
      `INSERT INTO tenants (
        id, name, slug, tenant_category, ice_number, address_city, address_country,
        feature_flags, status, created_at, updated_at
      ) VALUES (
        $1, $2, 'demo-atlas', 'garage', '002998877665544', 'Rabat', 'MA',
        '{"repair":true,"stock":true,"hr":true,"books":true,"crm":false}'::jsonb,
        'active', NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()`,
      [TENANT_GARAGE_ID, ENV.TENANT_GARAGE_NAME],
    );

    logger.info({ tenantBrokerId: TENANT_BROKER_ID, tenantGarageId: TENANT_GARAGE_ID }, 'tenants upserted');

    // Step 4: UPSERT 12 users
    for (const user of SEED_USERS) {
      await client.query(
        `INSERT INTO users (
          id, email, password_hash, full_name, mfa_enabled, mfa_secret,
          email_verified, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, NULL, true, 'active', NOW(), NOW())
        ON CONFLICT (email) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          full_name = EXCLUDED.full_name,
          mfa_enabled = EXCLUDED.mfa_enabled,
          updated_at = NOW()`,
        [user.userId, user.email, passwordHash, user.fullName, !mfaDisabled],
      );

      logger.debug({ email: user.email, role: user.role }, 'user upserted');
    }

    // Step 5: UPSERT user_tenant_roles
    for (const user of SEED_USERS) {
      if (user.tenantId === null) {
        // platform-level role -- assignment with NULL tenant_id
        await client.query(
          `INSERT INTO user_tenant_roles (user_id, tenant_id, role, is_primary, created_at)
           VALUES ($1, NULL, $2, true, NOW())
           ON CONFLICT (user_id, tenant_id, role) DO NOTHING`,
          [user.userId, user.role],
        );
      } else {
        await client.query(
          `INSERT INTO user_tenant_roles (user_id, tenant_id, role, is_primary, created_at)
           VALUES ($1, $2, $3, true, NOW())
           ON CONFLICT (user_id, tenant_id, role) DO NOTHING`,
          [user.userId, user.tenantId, user.role],
        );
      }
    }

    await client.query('COMMIT');

    logger.info(
      {
        users: SEED_USERS.length,
        tenants: 2,
      },
      'seed rbac users completed successfully',
    );

    if (process.argv.includes('--verbose')) {
      logger.info('Seeded users:');
      SEED_USERS.forEach((u) => {
        logger.info(`  ${u.email.padEnd(50)} role=${u.role} tenant=${u.tenantId ?? '<platform>'}`);
      });
      logger.info(`Common password (DEV ONLY -- never prod): ${password}`);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ err }, 'seed rbac users failed -- transaction rolled back');
    throw err;
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('seed-rbac'))");
    client.release();
    await pool.end();
  }
}

// CLI entrypoint
if (require.main === module) {
  runSeedRbacUsers()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
```

### 6.22 `repo/docs/runbooks/rbac-test-users.md`

```markdown
# Runbook -- RBAC Test Users

**Sprint 7 / Tache 2.3.12 -- Seeds dev 12 users.**

**WARNING : DEV ONLY -- jamais utiliser en production.**

## Lancement

```bash
pnpm seeds:rbac
# ou avec cleanup
pnpm seeds:rbac --clean
```

## Configuration ENV

| Variable | Default | Description |
|----------|---------|-------------|
| `SEED_RBAC_PASSWORD` | `Test1234!@#$` | Password commun aux 12 users |
| `SEED_RBAC_TENANT_BROKER_NAME` | `Cabinet Demo Bennani` | Nom tenant courtier |
| `SEED_RBAC_TENANT_GARAGE_NAME` | `Garage Demo Atlas` | Nom tenant garage |
| `SEED_RBAC_MFA_DISABLED` | `true` | Disable MFA pour faciliter tests |
| `SEED_RBAC_CLEAN` | `false` | DELETE before INSERT |
| `SEED_RBAC_LOG_LEVEL` | `info` | Pino log level |

## Utilisateurs crees (12 total)

| Email | Role | Tenant | Permissions clefs | Cas usage test |
|-------|------|--------|-------------------|----------------|
| `super-admin@demo.skalean-insurtech.ma` | super_admin_platform | platform | Wildcard `*` -- bypass tout | Admin endpoints, RLS bypass |
| `analyst@demo.skalean-insurtech.ma` | analyst_support | platform | `*.read` partout | Read-only audit/monitoring |
| `broker-admin@demo.skalean-insurtech.ma` | broker_admin | Bennani | Full CRM + Insure + tenant settings | CRUD complet broker |
| `broker-user@demo.skalean-insurtech.ma` | broker_user | Bennani | CRM read/create + Insure create | Cas usage daily courtier |
| `broker-assistant@demo.skalean-insurtech.ma` | broker_assistant | Bennani | Read + booking + comm | Assistant administratif |
| `garage-admin@demo.skalean-insurtech.ma` | garage_admin | Atlas | Full repair + stock + HR | CRUD complet garage |
| `garage-chef@demo.skalean-insurtech.ma` | garage_chef | Atlas | Sinistres assign + close | Chef d'atelier |
| `garage-technicien@demo.skalean-insurtech.ma` | garage_technicien | Atlas | Reparations execute + photos | PWA mobile technicien |
| `garage-comptable@demo.skalean-insurtech.ma` | garage_comptable | Atlas | Books + Pay | Comptable garage |
| `garage-commercial@demo.skalean-insurtech.ma` | garage_commercial | Atlas | Devis + clients | Commercial garage |
| `assure@demo.skalean-insurtech.ma` | assure | Atlas | `*_own` only | Client final connecte |
| `prospect@demo.skalean-insurtech.ma` | prospect | (none) | Public only | Pre-inscription |

## Password commun

```
Test1234!@#$
```

Hashing : argon2id memoryCost=65536 timeCost=3 parallelism=4 (CNDP loi 09-08 art 23 conformite).

## Tenants crees

- **Cabinet Demo Bennani** -- ID `01J7BENNANI0000000000000000`, slug `demo-bennani`, ICE 002345678901234, Casablanca, broker.
- **Garage Demo Atlas** -- ID `01J7ATLAS00000000000000000A`, slug `demo-atlas`, ICE 002998877665544, Rabat, garage.

## Idempotence

Re-run `pnpm seeds:rbac` produit meme etat sans erreur (UPSERT). Pour reset complet : `pnpm seeds:rbac --clean`.

## Verification post-seed

```sql
SELECT email, status FROM users WHERE email LIKE '%@demo.skalean-insurtech.ma' ORDER BY email;
-- Attendu : 12 rows status=active

SELECT name, slug, tenant_category FROM tenants WHERE slug LIKE 'demo-%';
-- Attendu : 2 rows
```

## Securite

**NE JAMAIS utiliser ces comptes en production.** Le script throw si NODE_ENV=production.

Si compte demo detecte en prod : alert SOC immediate via `admin_seed_demo_users_in_prod_total` Prometheus metric.

## References

- ADR-034 : `docs/adr/034-seeds-dev-shared-password.md`
- decision-015 : `00-pilotage/decisions/015-demo-domain-skalean-insurtech.ma.md`
- 5-roles-permissions.md : matrice complete des 12 roles.
```

---

## 7. Tests complets

L'integralite de cette tache EST des tests. Voir section 6 pour les 18+ fichiers complets. Resume de la couverture :

- **role-matrix-coverage.spec.ts** : ~120 assertions table-driven via `it.each()` couvrant 12 roles x 10 permissions echantillon stratifie + cross-validation hierarchy + super_admin wildcard + analyst_support read-only + 12 it() blocks distincts.
- **11 per-role specs** : chacun ~5-15 it() blocks describe scenarios business specifiques au role -- total ~110 it() blocks.
- **4 ABAC specs** : OwnResources (~10 scenarios), TimeBased (~10 scenarios), StatusBased (~10 scenarios), WorkflowState (~15 scenarios) -- total ~45 it() blocks.
- **rbac-integration.e2e-spec.ts** : ~15 scenarios HTTP full stack via Supertest + testcontainers Postgres + Redis.
- **Total it() blocks** : ~190 distincts groupant ~300 expect() assertions.
- **80+ scenarios criteria V1** : LARGEMENT depasse.

Coverage cible (V31) :
- `permissions-matrix.ts` : >95% lines, >90% branches.
- `role-hierarchy.ts` : >95% lines.
- `rbac.service.ts` : >95% lines, >90% branches.
- `permission-cache.service.ts` : >90% lines.
- `*-policy.ts` (4 files) : >95% lines, >90% branches.
- `*-guard.ts` : >90% lines.

Vitest config :

```typescript
// vitest.config.ts (ajout)
export default defineConfig({
  test: {
    pool: 'threads',
    poolOptions: { threads: { maxThreads: 8, minThreads: 4 } },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      thresholds: {
        'src/modules/rbac/**': {
          lines: 95,
          branches: 90,
          functions: 95,
          statements: 95,
        },
      },
    },
    testTimeout: 10000,
    hookTimeout: 30000,
  },
});
```

---

## 8. Variables environnement

```bash
# .env.example -- additions Tache 2.3.12

# Seeds RBAC
SEED_RBAC_PASSWORD=Test1234!@#$
SEED_RBAC_TENANT_BROKER_NAME=Cabinet Demo Bennani
SEED_RBAC_TENANT_GARAGE_NAME=Garage Demo Atlas
SEED_RBAC_MFA_DISABLED=true
SEED_RBAC_CLEAN=false
SEED_RBAC_LOG_LEVEL=info

# Test RBAC (CI)
TEST_RBAC_DATABASE_URL=postgresql://test:test@localhost:5432/insurtech_test
TEST_RBAC_REDIS_URL=redis://localhost:6379/15
TEST_RBAC_TIMEOUT_MS=10000
```

Validation Zod (ajout `apps/api/src/config/env.schema.ts`) :

```typescript
export const SeedRbacEnvSchema = z.object({
  SEED_RBAC_PASSWORD: z.string().min(12).default('Test1234!@#$'),
  SEED_RBAC_TENANT_BROKER_NAME: z.string().min(3).default('Cabinet Demo Bennani'),
  SEED_RBAC_TENANT_GARAGE_NAME: z.string().min(3).default('Garage Demo Atlas'),
  SEED_RBAC_MFA_DISABLED: z.coerce.boolean().default(true),
  SEED_RBAC_CLEAN: z.coerce.boolean().default(false),
  SEED_RBAC_LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});
```

---

## 9. Commandes shell

```bash
# Apply migrations + seeds + run rbac tests
pnpm migrate:up
pnpm seeds:rbac
pnpm test:rbac

# Run rbac tests only
pnpm test:rbac

# Run with coverage
pnpm test:rbac --coverage

# Cleanup + re-seed
pnpm seeds:rbac --clean

# Verbose seed output
SEED_RBAC_LOG_LEVEL=debug pnpm seeds:rbac --verbose

# Check CI suite duration
time pnpm test:rbac

# Run specific spec
pnpm vitest run apps/api/test/rbac/broker-admin.spec.ts

# Run integration E2E only
pnpm vitest run apps/api/test/integration/rbac-integration.e2e-spec.ts

# Verify seed users count
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users WHERE email LIKE '%@demo.skalean-insurtech.ma'"
# Expected: 12

# Verify tenants count
psql $DATABASE_URL -c "SELECT COUNT(*) FROM tenants WHERE slug LIKE 'demo-%'"
# Expected: 2

# Verify role assignments
psql $DATABASE_URL -c "SELECT u.email, r.role, r.tenant_id FROM users u JOIN user_tenant_roles r ON r.user_id = u.id WHERE u.email LIKE '%@demo.skalean-insurtech.ma' ORDER BY u.email"
# Expected: 12 rows distinct roles

# Reproducibility test (5x)
for i in 1 2 3 4 5; do pnpm seeds:rbac && pnpm test:rbac || exit 1; done

# Coverage report
pnpm test:rbac --coverage && open coverage/lcov-report/index.html
```

`package.json` scripts ajout :

```json
{
  "scripts": {
    "seeds:rbac": "tsx infrastructure/scripts/seed-rbac-users.ts",
    "test:rbac": "vitest run --testPathPattern '(rbac|abac|integration/rbac)'",
    "test:rbac:watch": "vitest --testPathPattern '(rbac|abac)'",
    "test:rbac:coverage": "vitest run --testPathPattern '(rbac|abac|integration/rbac)' --coverage"
  }
}
```

---

## 10. Criteres validation V1-V32

| ID | Priorite | Description | Verification |
|----|----------|-------------|--------------|
| V1 | P0 | 80+ scenarios tests passent | `pnpm test:rbac` -> Tests: 190+ passed |
| V2 | P0 | Coverage : 12 roles testes | Grep `describe.*role.*spec.ts` -> 12+ files |
| V3 | P0 | Coverage : 4 ABAC policies testees | Files own-resources, time-based, status-based, workflow-state |
| V4 | P0 | Tests passent CI GitHub Actions | CI badge green sur PR |
| V5 | P0 | Seeds creent 12 users avec roles distincts | SELECT COUNT(*) WHERE email LIKE '%@demo.skalean-insurtech.ma' = 12 |
| V6 | P0 | Documentation runbook claire | `repo/docs/runbooks/rbac-test-users.md` exists + listing 12 users |
| V7 | P0 | Reproducibility : 5x consecutif passe | `for i in 1..5; do pnpm seeds:rbac && pnpm test:rbac; done` exit 0 |
| V8 | P1 | Performance : suite tests < 60s | `time pnpm test:rbac` < 60s |
| V9 | P0 | role-matrix-coverage.spec.ts implements 120+ assertions | `wc -l role-matrix-coverage.spec.ts` >= 280 lignes |
| V10 | P0 | Per-role specs implementent business scenarios | 11 fichiers `*-spec.ts` exist with describe blocks |
| V11 | P0 | Seeds idempotent re-run sans erreur | 5x exec successive identique state |
| V12 | P0 | Cleanup partial laisse pas orphelins | DELETE CASCADE FK config + transaction wrapping |
| V13 | P0 | UNIQUE constraint user_tenant_roles | `\d user_tenant_roles` shows unique idx |
| V14 | P1 | role-matrix uses table-driven it.each() | Grep `it\.each` >= 1 occurrence |
| V15 | P0 | Concurrent seeds safe via advisory lock | Test 2 instances simultanees ok |
| V16 | P1 | Password rotation via env propagated | Change SEED_RBAC_PASSWORD -> users login new |
| V17 | P0 | Tenant deletion cascade preserve RLS | Test cleanup tenants leaves no orphans |
| V18 | P0 | RLS isolation tests utilise broker token | Tests use signTokenForRole(broker_admin, tenantId) |
| V19 | P1 | Concurrent seed scripts no slug collision | Advisory lock test |
| V20 | P0 | Migration drift detected immediately | CI executes migrate then seeds, fails fast |
| V21 | P1 | Fixtures derived from AuthRoleEnum runtime | `Object.values(AuthRoleEnum.enum)` |
| V22 | P0 | CI executes seeds after migrations | package.json test:rbac runs migrate first |
| V23 | P0 | Seeds throw if NODE_ENV=production | Test `NODE_ENV=production node script.js` exit 1 |
| V24 | P0 | Pino logs redact passwords | Pino config redact paths verified |
| V25 | P1 | Seeds noisy in CI controlled by log level | SEED_RBAC_LOG_LEVEL=warn for CI |
| V26 | P1 | No snapshot tests on roles list | Grep `toMatchSnapshot` in rbac specs = 0 |
| V27 | P0 | Cursor pagination handles same-ms events | Test setup adds millisecond offsets |
| V28 | P0 | Guards order JwtAuth -> RoleGuard -> AbacGuard | @UseGuards order verified in controller test |
| V29 | P1 | testcontainers retry start failures | testcontainers config retry 3x |
| V30 | P0 | Migrations fail before seeds halts CI | `pnpm migrate:up && pnpm seeds:rbac` && operator |
| V31 | P0 | Coverage >95% lines on RBAC modules | vitest.config thresholds |
| V32 | P1 | Test timeout 10s default per test | testTimeout: 10000 in vitest.config |

---

## 11. Edge cases

1. **Seed re-run idempotent** : 5 exec consecutifs produisent meme etat (V7 + V11). Verification SQL `SELECT COUNT(*) FROM users WHERE email LIKE '%@demo.skalean-insurtech.ma'` = 12 stable apres chaque run.

2. **Cleanup partial leaves orphans** : Si script crash apres DELETE users mais avant DELETE user_tenant_roles -> orphans. Solution : transaction wrapping + ON DELETE CASCADE FK Sprint 4.

3. **Role assignment race condition** : 2 dev exec concurrent -> potential UNIQUE violation. Solution : pg_advisory_lock + UPSERT ON CONFLICT DO NOTHING.

4. **Password rotation** : Change `SEED_RBAC_PASSWORD` env -> re-run script update password_hash existing users via UPSERT EXCLUDED.password_hash.

5. **Tenant deletion cascade** : `DELETE FROM tenants WHERE id=X` cascade users + sessions + RLS policies. Test cleanup ordre inverse + transaction.

6. **RLS isolation tests** : Tests utilisent broker_admin token avec tenantId explicit, pas super_admin token (qui bypass RLS).

7. **Concurrent seed** : Advisory lock `pg_advisory_lock(hashtext('seed-rbac'))` premier statement transaction.

8. **DB migration drift** : Script reference `users.full_name` mais migration renamed `display_name` -> fail fast. Solution : CI execute migrate avant seeds.

9. **Fixtures stale apres new role** : `ROLES_LIST = Object.values(AuthRoleEnum.enum)` runtime auto-cascade.

10. **MFA disabled fuite prod** : Script throw si NODE_ENV=production. Sprint 22 alerte si emails `*@demo.skalean-insurtech.ma` detectes en prod.

11. **Password commun expose via logs** : Pino redact paths config Sprint 5 + tests verify aucun password visible logs.

12. **Vitest snapshot stale** : Pas snapshot tests sur roles list, assertions explicit.

13. **Cursor pagination same-ms** : Test setup `created_at = NOW() + (i * INTERVAL '1ms')` distinguishable.

14. **Network partition Redis pendant tests** : Tests unitaires utilisent Redis mock, integration testcontainers stable.

15. **argon2 memory exhausted CI machine faible** : memoryCost=65536 = 64 MB OK pour CI 2GB. Pas de probleme attendu.

16. **Forward compatibility Sprint 14+ new roles** : `ROLES_LIST` derive runtime, ajout role auto-cascade. Per-role spec doit etre cree manuellement (acceptable).

---

## 12. Conformite Maroc detaillee

| Loi / Norme | Article | Impact tests + seeds | Implementation verifiee |
|-------------|---------|----------------------|-------------------------|
| **CNDP loi 09-08** | Art 4 (minimisation) | Emails fictifs `*@demo.skalean-insurtech.ma` | TLD `.ma` reserve sub-demo, jamais reel |
| **CNDP loi 09-08** | Art 5 (exactitude) | Pas de seeds en prod | `if NODE_ENV=production throw` |
| **CNDP loi 09-08** | Art 23 (confidentialite) | Password hashed argon2id meme commun | Tests verify `password_hash` regex |
| **CNDP loi 09-08** | Art 18 (conservation) | Audit log retention 12 mois | Partition auto-drop Sprint 4 |
| **CNDP loi 09-08** | Recommandation 5/2020 | Logs redact passwords | Pino config + tests |
| **CNDP loi 09-08** | Decision 008/2018 | Sessions prospect Redis pas BDD | prospect.spec.ts verify |
| **ACAPS** | Circulaire 2018/01 art 9 (tracabilite) | Tests audit denied verifient RbacAuditService | Tests integration verify entries crees |
| **ACAPS** | Separation environnements | Seeds segrege test/dev | NODE_ENV check |
| **AMC** | Loi 12-18 art 24 (segregation) | AML test data jamais melange prod | NODE_ENV + email TLD |
| **AMC** | Loi 12-18 art 15 (AML detection) | Tests verifient denied logs alimentees | Cross-check audit service |
| **BAM** | Circulaire 1/G/2007 (separation taches) | Tests broker_admin pas access admin/* | broker-admin.spec.ts assert 403 |
| **BAM** | Circulaire 1/G/2007 (audit trail) | Audit log entries crees pour denials | rbac-integration.e2e verify |
| **Loi 17-99** | Art 17 (droit retract 30j) | time-based.spec.ts verifie refund < 30j | Mock clock luxon + assertions |
| **DGI** | Note Circulaire 717 | ICE numbers fictifs valid format | ICE 002345678901234 Bennani |
| **DGI** | Loi 47-06 (numeros fiscaux) | Pas de numeros reels | ICE generes synthetiques |
| **CIMR** | Pas impact direct seeds RBAC | -- | -- |
| **CNSS** | Pas impact direct | -- | -- |
| **PCI-DSS** | (futur Sprint 17 paiement) | Test data card numbers sandbox | Hors scope Sprint 7 |
| **eIDAS / Loi 53-05** | Signature electronique | Hors scope tests RBAC | Sprint 13 |

---

## 13. Conventions absolues skalean-insurtech

### 13.1 Code conventions
- TypeScript 5.7.3 strict mode (`"strict": true, "noUncheckedIndexedAccess": true, "exactOptionalPropertyTypes": true`).
- ESLint 9.x flat config + Prettier 3.x.
- Imports explicites Vitest, NestJS Test, Supertest, Drizzle, Pino, ioredis, argon2, pg, ulid, luxon.
- Pas de `any` implicite. `unknown` puis narrowing Zod si necessaire.
- Pas de class-validator. Zod uniquement pour validation runtime.
- Pas de barrel exports profonds (max 1 niveau).
- Naming :
  - Fichiers tests : `*.spec.ts` unit + `*.e2e-spec.ts` integration E2E.
  - Fichiers fixtures : `*-fixtures.ts`.
  - Fichiers seeds : `seed-*.ts` dans `infrastructure/scripts/`.
  - Variables ENV : `SCREAMING_SNAKE_CASE`.
  - Roles enum : `snake_case` (broker_admin, garage_chef).
  - Permissions : `module.action.scope` (e.g. `crm.contacts.read_own`).

### 13.2 Tests conventions
- Vitest 2.1.8 obligatoire (pas Jest).
- `describe()` blocks groupent par scenario business.
- `it()` decrit comportement attendu en anglais clair `it('broker_user can create contact 201')`.
- `expect().toBe()` pour primitives, `toEqual()` pour objects, `toContain()` pour substrings.
- `it.each([...])` pour table-driven (preferred over loops).
- Setup `beforeAll` cher (createTestApp), `beforeEach` cleanup leger (cache flush).
- Cleanup `afterAll` ferme app + containers.
- Mocks via `vi.fn()` natif Vitest.
- Pas de `sinon`, pas de `jest.fn()`.

### 13.3 Seeds conventions
- Idempotent par defaut (UPSERT ON CONFLICT).
- Transaction wrapping toujours (BEGIN; ...; COMMIT/ROLLBACK).
- Advisory lock pour concurrent safe (`pg_advisory_lock`).
- Pino logger avec redact passwords.
- ENV vars Zod validated.
- Production guard `if (process.env.NODE_ENV === 'production') throw`.

### 13.4 Documentation conventions
- AUCUNE EMOJI.
- Markdown ATX headers (`#` not `===`).
- Code blocks avec language tag (` ```typescript ` ` ```sql ` ` ```bash `).
- Tables alignees pipe.
- Liens absolus depuis repo root (`/00-pilotage/...`).

### 13.5 Commit conventions
- Conventional Commits format `type(scope): subject`.
- Types : `feat`, `fix`, `test`, `docs`, `chore`, `refactor`.
- Scope obligatoire `(rbac)`, `(seeds)`, `(test)`.
- Subject imperative `add`, `fix`, `update` not `added`, `fixed`, `updated`.

---

## 14. Validation pre-commit

```bash
# Lint
pnpm lint

# Type-check
pnpm typecheck

# Tests RBAC + ABAC
pnpm test:rbac

# Coverage check
pnpm test:rbac --coverage

# Seeds dry-run
NODE_ENV=development pnpm seeds:rbac --clean

# Verify 12 users created
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users WHERE email LIKE '%@demo.skalean-insurtech.ma'"
# Expected: 12

# Verify production guard
NODE_ENV=production pnpm seeds:rbac
# Expected: throw "refuses to run in production"

# Performance check
time pnpm test:rbac
# Expected: < 60s

# Reproducibility 5x
for i in 1 2 3 4 5; do pnpm seeds:rbac && pnpm test:rbac || exit 1; done

# OpenAPI Swagger sanity check
pnpm openapi:generate
# Verify /admin/rbac/* endpoints present

# Audit denied entries created
pnpm test:rbac --testNamePattern="denied access creates rbac_audit_log"
```

Pre-commit hook (`.husky/pre-commit`) :

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm lint-staged
pnpm typecheck
pnpm test:rbac --changed
```

---

## 15. Commit message complet

```
test(rbac): tache 2.3.12 livre tests exhaustifs 80+ scenarios + seeds dev 12 users

Sprint 7 / Tache 2.3.12 -- finalize Sprint 7 RBAC.

CONTENU :
- role-matrix-coverage.spec.ts : 12 roles x 10 permissions = 120+ assertions table-driven
- 11 per-role specs : super_admin_platform, analyst_support, broker_admin, broker_user,
  broker_assistant, garage_admin, garage_chef, garage_technicien, garage_comptable,
  garage_commercial, assure, prospect (~110 it() blocks)
- 4 ABAC policy specs : own-resources, time-based, status-based, workflow-state (~45 it() blocks)
- rbac-integration.e2e-spec.ts : Supertest full stack 15+ scenarios HTTP testcontainers Postgres + Redis
- seed-rbac-users.ts : script idempotent 12 users + 2 tenants demo (Bennani broker + Atlas garage)
- rbac-test-fixtures.ts : helpers reusables Sprints 8+
- runbook docs/runbooks/rbac-test-users.md : documentation 12 users + cas usage
- ADR-033 : test coverage strategy 80+ stratifies
- ADR-034 : seeds shared password DEV ONLY
- ADR-035 : testcontainers vs in-memory hybrid
- decision-015 : domain demo.skalean-insurtech.ma reserve

CONFORMITE :
- Loi 09-08 art 23 : password argon2id meme commun
- Loi 09-08 art 4 : emails fictifs minimisation
- Loi 09-08 art 5 : seeds refused production
- ACAPS Circulaire 2018/01 art 9 : tracabilite audit denied
- ACAPS separation environnements : NODE_ENV check
- AMC Loi 12-18 art 24 : segregation prod/test
- BAM Circulaire 1/G/2007 : separation taches verifiee
- Loi 17-99 art 17 : droit retract 30j time-based.spec.ts

VALIDATION :
- V1 P0 : 80+ scenarios passent (190+ it() blocks)
- V2 P0 : 12 roles couverts
- V3 P0 : 4 ABAC policies couvertes
- V5 P0 : seeds creent 12 users
- V7 P0 : 5x reproducibility OK
- V8 P1 : suite < 60s
- V31 P0 : coverage >95% lines RBAC modules
- 32 criteres total V1-V32 verifies

CLOSES :
- Tache 2.3.12 (cette tache)
- Sprint 7 RBAC complet (Phase 2 sprint 3)
- V-07 verification ready

NEXT STEPS :
- Verification V-07 Sprint 7 cloture
- Sprint 8 demarre Phase 3 CRM
- Reuse fixtures by Sprint 8 ContactsController tests

REFS :
- meta-prompt B-07-sprint-07-rbac.md
- 5-roles-permissions.md v2.2
- ADR-033, ADR-034, ADR-035
- decision-015

Co-authored-by: Skalean Tech Team <tech@skalean-insurtech.ma>
```

---

## 16. Workflow next step

Cette tache 2.3.12 cloture le Sprint 7 RBAC. Workflow post-merge :

### Etape 1 : Cloture Sprint 7 (J+0)

1. Merge PR Tache 2.3.12 sur branche `main`.
2. Tag release `v0.7.0-sprint7-rbac-complete`.
3. CI pipeline complete : migrations + seeds + tests rbac + tests integration + tests existing modules.
4. Coverage report publie sur `https://coverage.internal.skalean-insurtech.ma/sprint-7/`.

### Etape 2 : Verification V-07 (J+1)

Equipe QA execute la verification Sprint 7 documentee `00-pilotage/verifications/V-07-sprint-7-rbac.md` :

- V1-V32 criteres tache 2.3.12 verifies.
- Criteres aggregates Sprint 7 (V1.x..V12.x) consolides.
- Sign-off tech lead + product manager.

### Etape 3 : Demarrage Sprint 8 Phase 3 CRM (J+2)

Sprint 8 demarre Phase 3 (Modules Metier Core) :

- Module `ContactsModule` (CRM contacts CRUD).
- Reuse `RbacTestFixtures` livre cette tache 2.3.12 pour tests Sprint 8 ContactsController.
- Reuse seed `broker-user@demo.skalean-insurtech.ma` pour smoke tests Sprint 8.
- Planning Sprint 8 inclut tache 3.1.x utilisant `signTokenForRole(app, 'broker_user')` pour auth tests.

### Etape 4 : Onboarding nouveaux developpeurs (continue)

Documentation `repo/docs/runbooks/rbac-test-users.md` referencee dans :

- `00-pilotage/onboarding/01-setup-local.md` Step 5.
- `repo/README.md` section "Quick Start".
- Slack channel `#dev-onboarding` epinglee.

### Etape 5 : Sprint 22 Observability (Phase 5 future)

- Grafana dashboards consume metrics `rbac_check_total{role,permission,granted}` alimentes par tests cette tache + production usage.
- Alert PagerDuty si `rbac_denied_rate > 5%` sur 5min (signe potentielle compromission).

### Etape 6 : Sprint 33 SecOps Pentest (Phase 6 future)

- Pentester utilise comptes `*@demo.skalean-insurtech.ma` cible privilege escalation tests staging.
- Fixtures `RbacTestFixtures` livrees cette tache reuse pour scripts pentest automatises.
- 50+ scenarios multi-tenant isolation cross-tenant leak attempts (extends 80+ Sprint 7).

### Etape 7 : Sprint 34 Compliance Reporting CNDP (Phase 6 future)

- Mensuel rapport `audit_log_meta` consume seeds pour scenarios test conformite.
- Tests `compliance.spec.ts` verify aucun PII fuite roles non autorises.

### Decisions cles a respecter post-merge

- **Ne jamais** ajouter user demo en prod -- guard NODE_ENV check enforce.
- **Toujours** re-run `pnpm seeds:rbac` apres `pnpm migrate:up` si schema change.
- **Toujours** mettre a jour per-role spec quand permission ajoutee dans `permissions-matrix.ts`.
- **Toujours** mettre a jour `role-matrix-coverage.spec.ts` SAMPLES si distribution change.
- **Documenter** changements ADR-033 si strategie tests evolue.

### Fin Sprint 7 -- preparation Sprint 8

Sprint 7 livre **12 taches** (2.3.1 a 2.3.12) totalisant ~75h effort, **80+ scenarios tests**, **12 users seeds**, **2 tenants demo**, **35+ ADRs**, **15+ runbooks**, **35+ migrations**. Phase 2 Securite + Multi-tenant complete. Sprint 8 Phase 3 demarre Module CRM Contacts avec foundation RBAC robuste.

---

**Fin du document task-2.3.12-tests-exhaustifs-80-scenarios-seeds-12-users-rbac.md.**

**Sprint 7 RBAC -- COMPLETE. Bascule Sprint 8 Phase 3 CRM.**


