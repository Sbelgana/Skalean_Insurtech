# TACHE 1.1.4 -- PostgreSQL 16 + 5 Extensions + 6 Helpers SQL Multi-Tenant 3 Niveaux

**Sprint** : 1 (Phase 1 / Sprint 1 dans phase) -- Bootstrap Infrastructure
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md` (Tache 1.1.4)
**Phase** : 1 -- Bootstrap Infrastructure
**Priorite** : P0 (bloquant absolu pour Sprint 2 entites + RLS policies, Sprint 6 multi-tenant runtime, et tous les sprints qui touchent a la DB)
**Effort** : 7h
**Dependances** : Tache 1.1.3 (Docker Compose dev avec Postgres demarre)
**Densite cible** : 80-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache vise a installer 5 extensions PostgreSQL critiques (pgcrypto, pg_trgm, btree_gist, unaccent, citext) et a poser les 6 helpers SQL pivots de la strategie multi-tenant 3 niveaux Skalean InsurTech (Platform / Customer Tenant / Assure). Les helpers SQL sont la **derniere ligne de defense** contre les fuites cross-tenant : meme si un bug applicatif laisse passer une query qui devrait etre filtree par TenantContext, RLS Postgres execute les policies (Sprint 6) qui appellent ces helpers et bloquent silencieusement le retour de donnees du mauvais tenant.

L'apport est triple. Premierement, les extensions debloquent des fonctionnalites essentielles : `pgcrypto` fournit `gen_random_uuid()` pour generer des UUID v4 cryptographiquement aleatoires (utilises comme PK partout dans le schema), `pg_trgm` permet la recherche full-text trigram pour la recherche fuzzy contacts CRM (Sprint 8) et plaques d'immatriculation Repair (Sprint 19), `btree_gist` permet l'index GIST sur tsrange pour la contrainte EXCLUDE anti-overlap des appointments Booking (Sprint 8), `unaccent` permet la recherche insensible aux accents francais et arabe (essentiel pour les noms marocains ecrits avec/sans diacritiques), `citext` permet les colonnes case-insensitive pour les emails et identifiants. Deuxiemement, les 6 helpers SQL (`app_current_tenant()`, `app_is_super_admin()`, `app_assure_user_id()`, `app_current_user_id()`, `app_cross_tenant_authorization_id()`, `app_can_access_tenant()`) sont les fonctions appelees par toutes les RLS policies du Sprint 2+. Sans ces helpers, aucune RLS policy ne peut s'ecrire. Troisiemement, le helper agrege `app_can_access_tenant(target_tenant_id uuid)` evalue en une seule fonction la matrice complete des autorisations cross-tenant : super admin (bypass), same tenant (default), cross-tenant authorization (Sprint 25 exception controlled).

A l'issue de cette tache, `docker exec skalean-postgres psql -U skalean -d skalean_insurtech -c "SELECT extname FROM pg_extension"` liste les 5 extensions, les 6 helpers sont definis (`\df app_*` montre la liste), `SELECT app_current_tenant()` retourne NULL hors session SET LOCAL et l'UUID injectee dans une transaction `BEGIN; SET LOCAL app.current_tenant_id = '...'; SELECT app_current_tenant(); COMMIT;`. La database `skalean_insurtech_test` est creee en parallele de `skalean_insurtech` pour permettre des tests integration paralleles, et le schema `n8n` est cree pour heberger les tables de l'orchestrateur n8n (decouplage du schema applicatif `public`).

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

La strategie multi-tenant Skalean InsurTech v2.2 est specifiee dans `00-pilotage/decisions/002-multi-tenant-3-niveaux.md` : **3 niveaux de tenants** :
- **L1 -- Platform** : Skalean SARL elle-meme, super admins de la plateforme. Bypass RLS via flag explicite.
- **L2 -- Customer Tenant** : un courtier (Wafa Assurance, Atlanta Assurances), un garage (Garage Marrakech Auto Service), un assureur (RMA Watanya). Chaque tenant a son `tenant_id` UUID et ses utilisateurs.
- **L3 -- Assure** : l'assure final (un client du courtier ou du garage). Visibilite restreinte a SES propres polices, sinistres, factures, paiements.

Sans une defense en profondeur RLS, un bug applicatif unique (par exemple un developpeur qui oublie d'ajouter `WHERE tenant_id = $1` a une query) peut leaker les donnees de tous les tenants vers un mauvais utilisateur. C'est inacceptable pour une plateforme assurance soumise a ACAPS, AMC, et CNDP.

L'approche Skalean InsurTech utilise 4 couches de defense :
1. **Application layer** : `TenantContext` AsyncLocalStorage Node.js, propagation automatique du `tenant_id` au TypeORM Subscriber qui ajoute `WHERE tenant_id = $X` automatiquement a toutes les queries (Sprint 6).
2. **API layer** : `TenantGuard` NestJS verifie le header `x-tenant-id` (sauf endpoints `/api/v1/public/*` et `/api/v1/admin/*`).
3. **DB layer (RLS Postgres)** : RLS policies sur chaque table avec `tenant_id` qui appellent `app_can_access_tenant(target_tenant_id)`. Cette tache 1.1.4 livre la fonction.
4. **Audit layer** : log de chaque acces avec `tenant_id`, `user_id`, `request_id`, `action`.

Cette tache (1.1.4) etablit la **couche DB**. Sans elle, les couches 1 et 2 ne suffisent pas (un bug applicatif les bypass).

Le mecanisme RLS Postgres fonctionne via :
- Variable de session Postgres `app.current_tenant_id` settable via `SET LOCAL app.current_tenant_id = '<uuid>'` au debut de chaque transaction.
- Le helper `app_current_tenant()` lit cette variable via `current_setting('app.current_tenant_id', true)` (le 2eme argument `true` retourne NULL au lieu de raise si non set).
- Les RLS policies (Sprint 2) sont definies sur les tables : `CREATE POLICY tenant_isolation ON tableX USING (tenant_id = app_current_tenant())`.
- A l'execution d'une query, Postgres injecte automatiquement le filtre `tenant_id = app_current_tenant()` -- impossible a oublier accidentellement.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| **Pas de RLS, isolation app-only** | Simple, pas de feature DB exotique | Aucune defense en profondeur, un bug = leak total | REJETE -- inacceptable pour assurance |
| **RLS sans helpers SQL (variable directe)** | Plus simple a comprendre | Pas de centralisation logique cross-tenant auth, code RLS duplique sur chaque table | REJETE -- duplication insoutenable a 100+ tables |
| **Schema-per-tenant Postgres** (1 schema par customer) | Isolation forte au niveau DB | Migration complexe (n schemas), perte query cross-tenant pour analytics | REJETE -- ne scale pas au-dela de 100-200 tenants |
| **Database-per-tenant** (1 DB par customer) | Isolation maximale | Operationnel impossible (n DBs a backup, monitor, migrer) | REJETE -- overhead operationnel insoutenable |
| **RLS avec helpers SQL centralises (RETENU)** | Defense en profondeur, code RLS lisible, scale a 10000 tenants | Necessite discipline `SET LOCAL` au debut de chaque connection authentifiee | RETENU -- meilleur compromis securite/operationnel |

### 2.3 Trade-offs explicites

Activer RLS sur une table impose un overhead minimal (~2-5% sur queries simples) car Postgres ajoute une condition WHERE supplementaire. Cet overhead est accepte car la securite gagnee justifie largement.

Le pattern `SET LOCAL app.current_tenant_id = '...'` impose de wrapper TOUTE query authentifiee dans une transaction. Cela ajoute du boilerplate au code applicatif (Sprint 6 implementera un transaction interceptor) mais c'est une contrainte de design assumee.

Le helper `app_can_access_tenant(target_tenant_id uuid)` fait un check OR avec 3 conditions (super admin, same tenant, cross-tenant auth). Chaque appel ajoute ~3 microsecondes de fonction overhead, mais centralise la logique d'autorisation. L'alternative (3 conditions hardcoded dans chaque RLS policy) est plus rapide mais infiniment moins maintenable.

Stocker `super_admin = TRUE` dans la session Postgres via `SET LOCAL app.is_super_admin = 'true'` est une decision controversee : un developpeur pourrait theoretiquement set ce flag depuis psql et bypass RLS. La protection est : (1) le rolepostgres applicatif n'a pas l'attribut SUPERUSER (`role insurtech_app NOSUPERUSER`), (2) l'IP du host Postgres n'accepte que les connections depuis le subnet apps (Sprint 35 prod), (3) audit trail capture chaque `SET LOCAL` (Sprint 33). Le risque residuel est accepte.

L'extension `pgcrypto` fournit `gen_random_uuid()` mais aussi des fonctions de chiffrement symetrique (`pgp_sym_encrypt`, `crypt`). On utilise SEULEMENT `gen_random_uuid()` -- les fonctions de chiffrement ne doivent JAMAIS etre utilisees pour stocker des passwords (decision-002 Argon2id) ou des donnees sensibles (Sprint 12 chiffrement applicatif via Atlas KMS).

L'extension `pg_trgm` ajoute ~100 KB par index GIN trigram cree sur une colonne text. Pour 1M lignes contacts CRM avec un index trigram sur `(first_name, last_name)`, c'est ~200 MB d'index. C'est accepte pour la qualite de recherche fuzzy.

### 2.4 Decisions strategiques referenced

- **decision-002 (Multi-tenant 3 niveaux)** : pertinence directe et totale. Cette tache concretise la couche DB de la strategie 3 niveaux.
- **decision-001 (Monorepo)** : pertinence indirecte. Les init scripts sont dans `infrastructure/docker/postgres/` du monorepo.
- **decision-006 (No-emoji ABSOLU)** : pertinence directe. Aucune emoji dans les SQL ou shell scripts.
- **decision-008 (Data Residency Maroc)** : pertinence indirecte. La meme logique RLS sera deployee sur Atlas Cloud Services Benguerir Postgres managed prod (Sprint 35).
- **decision-005 (Skalean AI Frontier)** : pertinence indirecte. Les helpers RLS s'appliqueront aussi aux MCP tools (Sprint 30) qui devront fournir un contexte tenant valide pour chaque call.

### 2.5 Pieges techniques connus

1. **Piege : `current_setting('app.X')` raise erreur si la variable n'est jamais set, sans le 2eme argument `true`.**
   - Pourquoi : Postgres considere les session vars `app.*` comme custom et raise si `current_setting` est appele sans le flag `missing_ok=true`.
   - Solution : TOUJOURS `current_setting('app.X', true)` (avec `true`). Et `NULLIF(..., '')` pour convertir chaine vide en NULL avant cast UUID.

2. **Piege : `SET LOCAL` ne fonctionne que dans une transaction explicite (`BEGIN; ... COMMIT;`).**
   - Pourquoi : `SET LOCAL` est scope a la transaction courante. Hors transaction, c'est equivalent a `SET` global sur la session, ce qui a des effets de bord.
   - Solution : enforcer dans le code applicatif (Sprint 6 TypeORM transaction interceptor) que toute query authentifiee est dans `BEGIN ... COMMIT`. Pas de query sans transaction.

3. **Piege : `STABLE` vs `IMMUTABLE` vs `VOLATILE` -- mauvais choix peut casser les query plans.**
   - Pourquoi : `IMMUTABLE` permet a Postgres de cacher la valeur entre appels meme dans une query. `STABLE` est cache au sein d'une query mais pas entre queries. `VOLATILE` est re-execute a chaque ligne.
   - Solution : `app_current_tenant()` est `STABLE` (la session var ne change pas pendant une query mais peut changer entre queries). Pas `IMMUTABLE` car la valeur depend de l'etat externe (session).

4. **Piege : `PARALLEL SAFE` doit etre declare pour permettre query parallele.**
   - Pourquoi : Postgres 14+ peut parallelizer les queries, mais SEULEMENT si toutes les fonctions appelees sont `PARALLEL SAFE`. Sans ce marker, query parallele desactivee = perte perf.
   - Solution : tous les helpers app_* sont declarees `STABLE PARALLEL SAFE`.

5. **Piege : Les init scripts `*.sql` dans `/docker-entrypoint-initdb.d/` ne s'executent QUE si le data dir Postgres est vide.**
   - Pourquoi : Postgres ne re-execute pas les init scripts a chaque boot, seulement au premier (data dir vide).
   - Solution : pour re-executer apres modif, `pnpm docker:reset` (efface volume `postgres-data`). Documenter dans README.

6. **Piege : Casing UUID dans `SET LOCAL` -- ne pas mixer majuscules/minuscules.**
   - Pourquoi : Postgres normalise les UUID en lowercase. Si on set `SET LOCAL app.current_tenant_id = 'ABC-DEF'` puis on cherche `WHERE tenant_id = 'abc-def'::uuid`, ca matche. Mais si on cherche `'ABC-DEF'::uuid`, ca NE matche pas car cast strict.
   - Solution : convention = TOUJOURS lowercase dans le code applicatif.

7. **Piege : Helper `app_assure_user_id()` retourne UUID assure mais pas tous les users sont assures (operateurs courtier/garage).**
   - Pourquoi : la confusion entre `user_id` (tout user) et `assure_user_id` (uniquement clients finaux L3) peut induire des bugs de filtrage.
   - Solution : helpers nommes explicitement. `app_current_user_id()` = tout user, `app_assure_user_id()` = SEULEMENT si role = AssureClient. Sinon NULL.

8. **Piege : `unaccent` ne fonctionne pas pour l'arabe.**
   - Pourquoi : la fonction `unaccent` traite uniquement les diacritiques latins (e accents, c cedille, etc.). L'arabe a des caracteres differents (chadda, fatha) non geres par defaut.
   - Solution : pour la recherche arabe (Sprint 9 templates ar/ar-MA), utiliser une normalisation custom Sprint 9 + index GIN trigram pour fuzzy. `unaccent` reste utile pour le francais.

9. **Piege : `citext` est case-insensitive ASCII only.**
   - Pourquoi : `citext` traite les chaines comme bytes lowered en ASCII, ne gere pas Unicode collation correctement.
   - Solution : pour les emails (ASCII garanti par RFC), citext est OK. Pour les noms (Unicode), utiliser `lower(unaccent(...))` ou `LOWER` simple selon contexte.

10. **Piege : Migration TypeORM `CREATE EXTENSION` echoue si l'utilisateur Postgres n'a pas le role superuser.**
    - Pourquoi : `CREATE EXTENSION` necessite SUPERUSER ou une fonction wrapper.
    - Solution : les extensions sont creees dans le init script Postgres (executes par superuser au boot du container), PAS dans les migrations TypeORM. Apres init, le user applicatif peut utiliser les fonctions d'extension sans avoir cree l'extension.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Cette tache 1.1.4 est la quatrieme tache du Sprint 1.

- **Depend de** : Tache 1.1.3 (Docker Compose Postgres demarre, mount `infrastructure/docker/postgres/` -> `/docker-entrypoint-initdb.d/`).
- **Bloque** :
  - Tache 1.1.9 (database TypeORM DataSource) : doit pouvoir tester `SELECT app_current_tenant()` au boot
  - Sprint 2 (entites + migrations + RLS subscribers) : utilise tous les helpers
  - Sprint 6 (multi-tenant runtime) : implemente la propagation `SET LOCAL`
  - Sprint 7 (RBAC) : utilise `app_is_super_admin()` pour les permissions
  - Sprint 25 (cross-tenant framework Repair) : utilise `app_cross_tenant_authorization_id()`
- **Apporte au sprint** : 4 fichiers SQL init + 1 fichier shell + 2 fichiers de tests integration.

### 3.2 Position dans le programme global

Les 6 helpers SQL definis ici sont references par chaque RLS policy creee dans le programme. Au Sprint 2, on creera les premieres entites avec RLS (`users`, `tenants`, `audit_logs`). Au Sprint 8, le module CRM ajoutera `contacts`, `companies`, `deals` avec RLS. Au Sprint 14-15, le module Insure ajoutera `polices`, `quittances`, `avenants` avec RLS. Au final, ~120 tables auront des RLS policies appelant ces helpers.

L'extension `pg_trgm` sera utilisee pour les recherches fuzzy au Sprint 8 (CRM contacts par nom) et Sprint 19 (Repair par plaque d'immatriculation). L'extension `btree_gist` sera utilisee au Sprint 8 (Booking anti-overlap appointments). L'extension `unaccent` sera utilisee partout ou recherche par nom francais. L'extension `citext` sera utilisee sur les colonnes `email` partout.

### 3.3 Diagramme architecture RLS

```
                Application TypeScript (Sprint 6)
                         |
                         | TenantContext (AsyncLocalStorage)
                         v
                  TypeORM DataSource (Tache 1.1.9)
                         |
                         | beforeQuery hook
                         |    SET LOCAL app.current_tenant_id = '<uuid>';
                         |    SET LOCAL app.current_user_id = '<uuid>';
                         v
                Postgres Connection (Tache 1.1.3 + 1.1.4)
                         |
                         | session vars set
                         v
                 +-------+-------+
                 |   RLS Policy   |
                 | (Sprint 2+)    |
                 +-------+-------+
                         |
                         | calls helper
                         v
                +----------------+
                | app_can_access_|
                | tenant(target) |  <-- THIS TASK 1.1.4
                +----------------+
                         |
              +----------+----------+
              |          |          |
              v          v          v
      +--------+  +--------+  +-------------+
      | super  |  | same   |  | cross-tenant|
      | admin  |  | tenant |  | auth (S25) |
      +--------+  +--------+  +-------------+
              |          |          |
              +----------+----------+
                         |
                         v
               return TRUE/FALSE
                         |
                         | RLS allow/deny row
                         v
                 Postgres applies WHERE
                 tenant_id = app_current_tenant()
                         |
                         v
                 Returns rows authorized
```

### 3.4 Helpers SQL relationships

```
app_current_tenant()    --> reads app.current_tenant_id session var
app_current_user_id()   --> reads app.current_user_id session var
app_is_super_admin()    --> reads app.is_super_admin session var (boolean)
app_assure_user_id()    --> reads app.assure_user_id session var (NULL if user not L3)
app_cross_tenant_       --> reads app.cross_tenant_authorization_id session var (Sprint 25)
   authorization_id()      (NULL if no exception in effect)

app_can_access_tenant(target_tenant_id uuid) AGGREGATES :
    super_admin(true)            --> TRUE
    OR app_current_tenant() =     --> TRUE
       target_tenant_id
    OR app_cross_tenant_auth_id  --> TRUE if exception applies to target
       can access target
    ELSE                          --> FALSE
```

---

## 4. Livrables checkables

- [ ] Fichier `repo/infrastructure/docker/postgres/init.sh` enrichi (entry point qui sequence l'execution) (~25 lignes)
- [ ] Fichier `repo/infrastructure/docker/postgres/001-init-extensions.sql` installant 5 extensions (~30 lignes commentees)
- [ ] Fichier `repo/infrastructure/docker/postgres/002-init-tenant-rls-helpers.sql` definissant 6 helpers SQL (~180 lignes commentees)
- [ ] Fichier `repo/infrastructure/docker/postgres/003-init-databases.sql` creant schema n8n + db test (~25 lignes)
- [ ] Fichier `repo/infrastructure/docker/postgres/004-init-roles-grants.sql` creant role applicatif + grants (~50 lignes)
- [ ] Extension `pgcrypto` installee (UUID v4 cryptographique via gen_random_uuid())
- [ ] Extension `pg_trgm` installee (full-text search trigram pour CRM Sprint 8 + Repair Sprint 19)
- [ ] Extension `btree_gist` installee (EXCLUDE constraint Booking anti-overlap Sprint 8)
- [ ] Extension `unaccent` installee (recherche insensible aux accents francais)
- [ ] Extension `citext` installee (colonnes email/identifiants case-insensitive)
- [ ] Helper `app_current_tenant()` defini : retourne UUID tenant ou NULL
- [ ] Helper `app_current_user_id()` defini : retourne UUID user courant ou NULL
- [ ] Helper `app_is_super_admin()` defini : retourne boolean (false par defaut)
- [ ] Helper `app_assure_user_id()` defini : retourne UUID assure L3 ou NULL
- [ ] Helper `app_cross_tenant_authorization_id()` defini : retourne UUID exception cross-tenant ou NULL (Sprint 25)
- [ ] Helper agrege `app_can_access_tenant(target_tenant_id uuid)` defini : retourne boolean
- [ ] Tous les helpers declares `STABLE PARALLEL SAFE`
- [ ] Schema `n8n` cree (utilise par n8n container Tache 1.1.3)
- [ ] Database `skalean_insurtech_test` creee pour tests integration Sprint 1+
- [ ] Role applicatif `insurtech_app` cree (NOSUPERUSER, NOREPLICATION) avec grants sur la DB
- [ ] Role superuser `insurtech_admin` cree pour migrations TypeORM
- [ ] Tests integration psql : extensions presentes
- [ ] Tests integration psql : helpers definis et appellables
- [ ] Tests integration psql : `SET LOCAL` + lecture helpers fonctionne
- [ ] Aucune emoji dans aucun fichier livre

Total : 25 livrables checkables.

---

## 5. Fichiers crees / modifies

```
repo/infrastructure/docker/postgres/init.sh                                (~25 lignes)
repo/infrastructure/docker/postgres/001-init-extensions.sql                (~30 lignes commentees)
repo/infrastructure/docker/postgres/002-init-tenant-rls-helpers.sql        (~180 lignes commentees)
repo/infrastructure/docker/postgres/003-init-databases.sql                 (~25 lignes)
repo/infrastructure/docker/postgres/004-init-roles-grants.sql              (~50 lignes)
repo/infrastructure/scripts/__tests__/postgres-extensions.spec.ts          (~120 lignes)
repo/infrastructure/scripts/__tests__/postgres-rls-helpers.spec.ts         (~200 lignes)
repo/infrastructure/scripts/__tests__/postgres-roles.spec.ts               (~80 lignes)
```

Total : 5 fichiers SQL/shell + 3 fichiers de tests = 8 fichiers crees.

---

## 6. Code patterns COMPLETS

### 6.1 Fichier 1/8 : `repo/infrastructure/docker/postgres/init.sh`

Role : entry point shell pour les init scripts Postgres. Execute dans l'ordre alphabetique par Postgres entrypoint.

```bash
#!/usr/bin/env bash
# Skalean InsurTech v2.2 -- Postgres init entry point
# Reference: 00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md (Tache 1.1.4)
#            decision-002 (multi-tenant 3 niveaux)
#            decision-006 (no-emoji)
#
# Postgres docker-entrypoint-initdb.d execute :
#   - tous les fichiers *.sql ordre alphabetique
#   - tous les fichiers *.sh ordre alphabetique
#   AU PREMIER BOOT UNIQUEMENT (data dir vide).
#
# Pour re-executer apres modification : pnpm docker:reset
# Aucune emoji autorisee.

set -euo pipefail

echo "[postgres-init] Skalean InsurTech v2.2 -- init scripts loading"
echo "[postgres-init] User: ${POSTGRES_USER}, DB: ${POSTGRES_DB}"
echo "[postgres-init] Init scripts order :"
echo "[postgres-init]   001-init-extensions.sql      (5 extensions)"
echo "[postgres-init]   002-init-tenant-rls-helpers.sql (6 helpers SQL)"
echo "[postgres-init]   003-init-databases.sql       (schema n8n + DB test)"
echo "[postgres-init]   004-init-roles-grants.sql    (roles applicatifs + grants)"
echo "[postgres-init] Each *.sql will be executed by postgres entrypoint."
echo "[postgres-init] Setup complete."
```

### 6.2 Fichier 2/8 : `repo/infrastructure/docker/postgres/001-init-extensions.sql`

Role : installer les 5 extensions critiques.

```sql
-- ============================================================================
-- Skalean InsurTech v2.2 -- Init extensions PostgreSQL
-- Reference: 00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md (Tache 1.1.4)
--            decision-002 (multi-tenant) + decision-006 (no-emoji)
-- ============================================================================
-- Extensions installees (5) :
--   pgcrypto    -- gen_random_uuid() UUID v4 cryptographique
--   pg_trgm     -- full-text search trigram (CRM Sprint 8, Repair Sprint 19)
--   btree_gist  -- EXCLUDE constraint avec tsrange (Booking Sprint 8)
--   unaccent    -- recherche insensible aux accents francais (noms MA)
--   citext      -- colonnes case-insensitive (emails, identifiants)
--
-- Aucune emoji autorisee dans ce fichier.
-- ============================================================================

\set ON_ERROR_STOP on

\echo '[001-init-extensions] Installing 5 extensions...'

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
\echo '[001-init-extensions] pgcrypto installed'

CREATE EXTENSION IF NOT EXISTS "pg_trgm";
\echo '[001-init-extensions] pg_trgm installed'

CREATE EXTENSION IF NOT EXISTS "btree_gist";
\echo '[001-init-extensions] btree_gist installed'

CREATE EXTENSION IF NOT EXISTS "unaccent";
\echo '[001-init-extensions] unaccent installed'

CREATE EXTENSION IF NOT EXISTS "citext";
\echo '[001-init-extensions] citext installed'

\echo '[001-init-extensions] Verification (5 extensions expected) :'
SELECT extname, extversion FROM pg_extension WHERE extname IN ('pgcrypto', 'pg_trgm', 'btree_gist', 'unaccent', 'citext') ORDER BY extname;

\echo '[001-init-extensions] DONE.'
```

**Notes importantes** :
- `\set ON_ERROR_STOP on` : si une extension echoue, le script s'arrete (pas de partial state).
- `CREATE EXTENSION IF NOT EXISTS` : idempotent, peut re-executer sans casser.
- `\echo` : log lisible dans `docker logs skalean-postgres`.
- 5 extensions sont les minimum pour Sprint 1+. Aucune extension de Postgres `hstore`, `ltree`, `intarray` necessaire (utilisations rares, ajoutables au sprint specifique si besoin).
- Les versions des extensions sont liees a la version Postgres 16.6 -- pas pinnees explicitement.

### 6.3 Fichier 3/8 : `repo/infrastructure/docker/postgres/002-init-tenant-rls-helpers.sql`

Role : definir les 6 helpers SQL pivots du multi-tenant 3 niveaux. C'est le fichier critique de cette tache.

```sql
-- ============================================================================
-- Skalean InsurTech v2.2 -- Helpers SQL Multi-Tenant 3 niveaux
-- Reference: 00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md (Tache 1.1.4)
--            decision-002 (multi-tenant 3 niveaux : Platform / Tenant / Assure)
--            decision-006 (no-emoji)
--            8-skalean-insurtech-prompt-master.md Section 2 (multi-tenant strict)
-- ============================================================================
-- 6 Helpers SQL definis :
--   1. app_current_tenant()                           -- UUID tenant courant
--   2. app_current_user_id()                          -- UUID user courant
--   3. app_is_super_admin()                           -- bypass RLS
--   4. app_assure_user_id()                           -- UUID assure L3 si applicable
--   5. app_cross_tenant_authorization_id()            -- exception cross-tenant Sprint 25
--   6. app_can_access_tenant(target_tenant_id uuid)   -- evaluation aggregate
--
-- Les helpers sont declares STABLE PARALLEL SAFE pour permettre query parallele.
-- Variables session lues : current_setting('app.X', true) ou true = missing_ok.
--
-- Pattern usage (Sprint 6 implementera le runtime) :
--   BEGIN;
--   SET LOCAL app.current_tenant_id = '<uuid-customer-tenant>';
--   SET LOCAL app.current_user_id   = '<uuid-user-courtier>';
--   SET LOCAL app.is_super_admin    = 'false';
--   -- queries here filtrees automatiquement par RLS policies (Sprint 2+)
--   COMMIT;
--
-- Pour bypass RLS (super admin Skalean) :
--   BEGIN;
--   SET LOCAL app.is_super_admin = 'true';
--   SET LOCAL app.current_user_id = '<uuid-skalean-admin>';
--   -- queries voient TOUS les tenants
--   COMMIT;
--
-- Aucune emoji autorisee.
-- ============================================================================

\set ON_ERROR_STOP on

\echo '[002-init-rls-helpers] Creating 6 SQL helpers...'

-- ============================================================================
-- Helper 1 : app_current_tenant()
-- ============================================================================
-- Retourne l'UUID du customer tenant courant (L2) ou NULL si non set.
-- NULL signifie : pas dans un contexte authentifie tenant.
-- Le 2eme argument 'true' a current_setting permet de retourner NULL au lieu
-- de raise si la variable n'est pas set.
-- NULLIF(..., '') convertit chaine vide en NULL avant cast UUID (sinon cast fail).
CREATE OR REPLACE FUNCTION app_current_tenant()
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
$$;

COMMENT ON FUNCTION app_current_tenant() IS
'Skalean InsurTech v2.2 -- Returns the UUID of the current customer tenant (L2). NULL if no tenant context. Read app.current_tenant_id session var. Used by RLS policies on all tables with tenant_id column. Reference: decision-002.';

-- ============================================================================
-- Helper 2 : app_current_user_id()
-- ============================================================================
-- Retourne l'UUID du user courant (L1 platform admin OR L2 tenant user OR L3 assure).
-- NULL si pas dans contexte authentifie.
CREATE OR REPLACE FUNCTION app_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid
$$;

COMMENT ON FUNCTION app_current_user_id() IS
'Skalean InsurTech v2.2 -- Returns the UUID of the current user (any level). NULL if no auth context. Read app.current_user_id session var. Used by audit logs + RLS policies row-level auth. Reference: decision-002.';

-- ============================================================================
-- Helper 3 : app_is_super_admin()
-- ============================================================================
-- Retourne TRUE si le user courant est super admin Skalean Platform (L1).
-- Default FALSE (security-first).
-- Bypass RLS quand TRUE -- a utiliser avec extreme prudence.
CREATE OR REPLACE FUNCTION app_is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT COALESCE(NULLIF(current_setting('app.is_super_admin', true), ''), 'false')::boolean
$$;

COMMENT ON FUNCTION app_is_super_admin() IS
'Skalean InsurTech v2.2 -- Returns TRUE if current user is super admin Skalean Platform (L1). Default FALSE. Read app.is_super_admin session var. Bypass RLS when TRUE. Use with extreme caution. Reference: decision-002.';

-- ============================================================================
-- Helper 4 : app_assure_user_id()
-- ============================================================================
-- Retourne l'UUID du user courant SI il est un assure (L3), sinon NULL.
-- Utilise pour filtrer plus finement (assure ne voit QUE ses propres polices).
-- Differe de app_current_user_id() qui retourne tout user.
CREATE OR REPLACE FUNCTION app_assure_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(current_setting('app.assure_user_id', true), '')::uuid
$$;

COMMENT ON FUNCTION app_assure_user_id() IS
'Skalean InsurTech v2.2 -- Returns UUID of current user IF they are an assure (L3), else NULL. Read app.assure_user_id session var. Used to scope L3 access to own policies/sinistres/factures. Reference: decision-002.';

-- ============================================================================
-- Helper 5 : app_cross_tenant_authorization_id()
-- ============================================================================
-- Retourne l'UUID d'une autorisation cross-tenant active si applicable.
-- Mecanisme exception pour Sprint 25 (cross-tenant framework Repair) :
-- un utilisateur courtier peut acceder TEMPORAIREMENT au tenant garage
-- pour suivre un sinistre, via une authorization explicitement creee.
-- NULL si aucune exception en cours.
CREATE OR REPLACE FUNCTION app_cross_tenant_authorization_id()
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(current_setting('app.cross_tenant_authorization_id', true), '')::uuid
$$;

COMMENT ON FUNCTION app_cross_tenant_authorization_id() IS
'Skalean InsurTech v2.2 -- Returns UUID of active cross-tenant authorization, NULL if none. Used by Sprint 25 cross-tenant framework Repair (broker accessing garage tenant for sinistre tracking). Read app.cross_tenant_authorization_id session var. Reference: decision-002 + B-25.';

-- ============================================================================
-- Helper 6 : app_can_access_tenant(target_tenant_id uuid)
-- ============================================================================
-- AGGREGATE helper -- evalue si le contexte courant peut acceder a target_tenant_id.
-- Retourne TRUE si l'une des conditions suivantes est verifiee :
--   1. Super admin Skalean Platform (bypass)
--   2. Same tenant : app_current_tenant() = target_tenant_id
--   3. Cross-tenant authorization active autorisant target (Sprint 25)
-- Retourne FALSE sinon.
-- Cette fonction est appelee par les RLS policies sur les tables tenant-scoped.
CREATE OR REPLACE FUNCTION app_can_access_tenant(target_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
  current_tenant uuid;
  cross_auth_id uuid;
  cross_auth_target uuid;
  cross_auth_active boolean;
BEGIN
  -- Condition 0 : null target = invalid call (defensive)
  IF target_tenant_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Condition 1 : super admin bypass
  IF app_is_super_admin() THEN
    RETURN TRUE;
  END IF;

  -- Condition 2 : same tenant
  current_tenant := app_current_tenant();
  IF current_tenant IS NOT NULL AND current_tenant = target_tenant_id THEN
    RETURN TRUE;
  END IF;

  -- Condition 3 : cross-tenant authorization active (Sprint 25)
  -- Note : la table app.cross_tenant_authorizations est creee Sprint 25.
  -- En Sprint 1, cette branche retourne FALSE (table absente).
  -- Le check fait par try/catch pour ne pas casser en l'absence.
  cross_auth_id := app_cross_tenant_authorization_id();
  IF cross_auth_id IS NOT NULL THEN
    BEGIN
      EXECUTE format(
        'SELECT target_tenant_id, expired_at IS NULL OR expired_at > NOW() FROM cross_tenant_authorizations WHERE id = %L',
        cross_auth_id
      ) INTO cross_auth_target, cross_auth_active;
      IF cross_auth_active AND cross_auth_target = target_tenant_id THEN
        RETURN TRUE;
      END IF;
    EXCEPTION WHEN undefined_table THEN
      -- Table cross_tenant_authorizations pas encore creee (avant Sprint 25)
      -- Fallback : pas d'autorisation cross-tenant possible
      RETURN FALSE;
    END;
  END IF;

  -- Aucune condition verifiee : refuser acces
  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION app_can_access_tenant(uuid) IS
'Skalean InsurTech v2.2 -- Evaluate if current context can access target_tenant_id. TRUE if (super admin) OR (same tenant) OR (active cross-tenant authorization Sprint 25). Used by all RLS policies on tenant-scoped tables. Reference: decision-002 + B-25.';

-- ============================================================================
-- Verification : 6 helpers crees
-- ============================================================================
\echo '[002-init-rls-helpers] Verification helpers crees :'

SELECT
  routine_name,
  routine_type,
  data_type AS return_type,
  external_language,
  is_deterministic
FROM information_schema.routines
WHERE routine_name LIKE 'app\_%'
ORDER BY routine_name;

\echo '[002-init-rls-helpers] DONE -- 6 helpers operational.'
```

**Notes importantes** :
- Chaque helper a un `COMMENT ON FUNCTION` documente. Cette documentation est lisible via `\df+ app_*` en psql.
- `STABLE PARALLEL SAFE` permet a Postgres de cacher la valeur dans une query et de paralleliser.
- `app_can_access_tenant` utilise `EXECUTE format(...)` pour la condition 3 car la table `cross_tenant_authorizations` n'existe pas encore en Sprint 1. Le `BEGIN...EXCEPTION...END` capture `undefined_table` et retourne FALSE silencieusement.
- Le COALESCE dans `app_is_super_admin` garantit FALSE par defaut (security-first).
- `app_cross_tenant_authorization_id()` retourne NULL en Sprint 1 (pas de session var set). Activation reelle au Sprint 25.

### 6.4 Fichier 4/8 : `repo/infrastructure/docker/postgres/003-init-databases.sql`

Role : creer la database `skalean_insurtech_test` pour tests integration et le schema `n8n` pour l'orchestrateur n8n.

```sql
-- ============================================================================
-- Skalean InsurTech v2.2 -- Init databases supplementaires + schemas
-- Reference: 00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md (Tache 1.1.4)
-- ============================================================================
-- Cree :
--   - Database skalean_insurtech_test (tests integration paralleles)
--   - Schema n8n (utilise par n8n container Tache 1.1.3)
--
-- Aucune emoji autorisee.
-- ============================================================================

\set ON_ERROR_STOP on

\echo '[003-init-databases] Creating test database and n8n schema...'

-- DB test (paralleliser tests integration)
SELECT 'CREATE DATABASE skalean_insurtech_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'skalean_insurtech_test')\gexec

\c skalean_insurtech_test
\echo '[003-init-databases] Connected to skalean_insurtech_test'

-- Re-installer extensions sur DB test
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "citext";

\echo '[003-init-databases] Test DB extensions installed'

-- Re-back to skalean_insurtech principal
\c skalean_insurtech

-- Schema n8n (n8n container DB_POSTGRESDB_SCHEMA=n8n)
CREATE SCHEMA IF NOT EXISTS n8n;
\echo '[003-init-databases] Schema n8n created'

-- Schema audit (sera utilise Sprint 12 compliance)
CREATE SCHEMA IF NOT EXISTS audit;
\echo '[003-init-databases] Schema audit created (Sprint 12 ready)'

-- Schema reporting (sera utilise Sprint 13 analytics ETL Postgres -> ClickHouse)
CREATE SCHEMA IF NOT EXISTS reporting;
\echo '[003-init-databases] Schema reporting created (Sprint 13 ready)'

\echo '[003-init-databases] DONE.'
```

**Notes importantes** :
- `SELECT '...' WHERE NOT EXISTS (...) \gexec` : pattern psql pour CREATE DATABASE conditionnel (CREATE DATABASE IF NOT EXISTS n'existe pas en SQL standard Postgres).
- `\c db_name` switch connection psql.
- 4 schemas crees : `public` (default applicatif), `n8n` (n8n tables), `audit` (Sprint 12 compliance), `reporting` (Sprint 13 ETL).
- Extensions re-installees sur DB test pour tests integration (extensions sont per-DB, pas per-cluster).

### 6.5 Fichier 5/8 : `repo/infrastructure/docker/postgres/004-init-roles-grants.sql`

Role : creer les roles applicatifs avec privileges minimaux.

```sql
-- ============================================================================
-- Skalean InsurTech v2.2 -- Init roles applicatifs + grants
-- Reference: 00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md (Tache 1.1.4)
--            decision-002 (multi-tenant) + security best practices
-- ============================================================================
-- Roles crees :
--   insurtech_app    -- role applicatif normal (NOSUPERUSER, NOREPLICATION)
--                       Connecte par apps/api, packages/database
--                       Soumis aux RLS policies (Sprint 2+)
--   insurtech_admin  -- role admin pour migrations TypeORM
--                       Bypass RLS via FORCE_RLS_FALSE_FOR_OWNER (Sprint 6)
--                       Utilise UNIQUEMENT pour migrations + maintenance
--   insurtech_ro     -- role read-only pour analytics + reporting
--                       SELECT only sur public, audit, reporting schemas
--
-- Aucune emoji autorisee.
-- ============================================================================

\set ON_ERROR_STOP on

\echo '[004-init-roles-grants] Creating application roles...'

-- Role applicatif principal
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'insurtech_app') THEN
    CREATE ROLE insurtech_app WITH
      LOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      INHERIT
      PASSWORD 'insurtech_app_dev_only_change_in_prod';
    RAISE NOTICE '[004-init-roles-grants] Role insurtech_app created';
  ELSE
    RAISE NOTICE '[004-init-roles-grants] Role insurtech_app already exists, skipping';
  END IF;
END$$;

-- Role admin pour migrations
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'insurtech_admin') THEN
    CREATE ROLE insurtech_admin WITH
      LOGIN
      NOSUPERUSER
      CREATEDB
      NOCREATEROLE
      NOREPLICATION
      INHERIT
      PASSWORD 'insurtech_admin_dev_only_change_in_prod';
    RAISE NOTICE '[004-init-roles-grants] Role insurtech_admin created';
  ELSE
    RAISE NOTICE '[004-init-roles-grants] Role insurtech_admin already exists, skipping';
  END IF;
END$$;

-- Role read-only pour reporting
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'insurtech_ro') THEN
    CREATE ROLE insurtech_ro WITH
      LOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      INHERIT
      PASSWORD 'insurtech_ro_dev_only_change_in_prod';
    RAISE NOTICE '[004-init-roles-grants] Role insurtech_ro created';
  ELSE
    RAISE NOTICE '[004-init-roles-grants] Role insurtech_ro already exists, skipping';
  END IF;
END$$;

-- Grants sur DB principale
GRANT CONNECT ON DATABASE skalean_insurtech TO insurtech_app, insurtech_admin, insurtech_ro;

GRANT USAGE ON SCHEMA public TO insurtech_app, insurtech_admin, insurtech_ro;
GRANT USAGE ON SCHEMA audit TO insurtech_app, insurtech_admin, insurtech_ro;
GRANT USAGE ON SCHEMA reporting TO insurtech_app, insurtech_admin, insurtech_ro;
GRANT USAGE ON SCHEMA n8n TO insurtech_admin;

-- Grants execution helpers RLS (necessaire pour TOUS les roles applicatifs)
GRANT EXECUTE ON FUNCTION app_current_tenant() TO insurtech_app, insurtech_admin, insurtech_ro;
GRANT EXECUTE ON FUNCTION app_current_user_id() TO insurtech_app, insurtech_admin, insurtech_ro;
GRANT EXECUTE ON FUNCTION app_is_super_admin() TO insurtech_app, insurtech_admin, insurtech_ro;
GRANT EXECUTE ON FUNCTION app_assure_user_id() TO insurtech_app, insurtech_admin, insurtech_ro;
GRANT EXECUTE ON FUNCTION app_cross_tenant_authorization_id() TO insurtech_app, insurtech_admin, insurtech_ro;
GRANT EXECUTE ON FUNCTION app_can_access_tenant(uuid) TO insurtech_app, insurtech_admin, insurtech_ro;

-- Default privileges pour futures tables (Sprint 2+)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO insurtech_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO insurtech_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO insurtech_ro;

ALTER DEFAULT PRIVILEGES IN SCHEMA audit GRANT INSERT ON TABLES TO insurtech_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA audit GRANT SELECT ON TABLES TO insurtech_admin, insurtech_ro;

ALTER DEFAULT PRIVILEGES IN SCHEMA reporting GRANT SELECT ON TABLES TO insurtech_app, insurtech_ro;

\echo '[004-init-roles-grants] DONE.'
```

**Notes importantes** :
- `DO $$ ... END$$` : pattern PL/pgSQL pour conditionnel CREATE ROLE (idempotent).
- `insurtech_app` : role normal avec privileges CRUD sur public/audit, soumis aux RLS policies.
- `insurtech_admin` : role pour migrations TypeORM, bypass RLS via `FORCE ROW LEVEL SECURITY` Sprint 6 lorsque RLS activee sur tables.
- `insurtech_ro` : role read-only pour BI/analytics, pas d'INSERT.
- `EXECUTE` sur tous les helpers `app_*` : crucial, sinon RLS policies echouent avec `permission denied for function`.
- `ALTER DEFAULT PRIVILEGES` : applique automatiquement les grants aux futures tables creees (par ex. via migrations TypeORM Sprint 2). Sans cela, chaque migration devrait grant manuellement.

### 6.6 Fichier 6/8 : `repo/infrastructure/scripts/__tests__/postgres-extensions.spec.ts`

Role : tests integration verifiant que les 5 extensions sont installees.

```typescript
/**
 * Tests integration Postgres extensions -- Tache 1.1.4
 *
 * Verifie que les 5 extensions sont installees sur la DB principale et la DB test.
 *
 * Reference : 00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md (Tache 1.1.4)
 *             decision-002 (multi-tenant 3 niveaux)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';

const POSTGRES_URL =
  process.env.DATABASE_URL ??
  'postgresql://skalean:skalean_dev_only_change_in_prod@localhost:5432/skalean_insurtech';
const POSTGRES_TEST_URL =
  process.env.DATABASE_TEST_URL ??
  'postgresql://skalean:skalean_dev_only_change_in_prod@localhost:5432/skalean_insurtech_test';

const SKIP_INTEGRATION = process.env.SKIP_INTEGRATION === 'true';

const REQUIRED_EXTENSIONS = ['pgcrypto', 'pg_trgm', 'btree_gist', 'unaccent', 'citext'];

describe.skipIf(SKIP_INTEGRATION)('Postgres extensions -- Tache 1.1.4', () => {
  describe('Database skalean_insurtech', () => {
    let client: Client;

    beforeAll(async () => {
      client = new Client({ connectionString: POSTGRES_URL });
      await client.connect();
    });

    afterAll(async () => {
      await client.end();
    });

    it.each(REQUIRED_EXTENSIONS)('should have extension %s installed', async (ext) => {
      const result = await client.query(
        'SELECT extname FROM pg_extension WHERE extname = $1',
        [ext]
      );
      expect(result.rowCount).toBe(1);
      expect(result.rows[0].extname).toBe(ext);
    });

    it('should generate UUID v4 via pgcrypto', async () => {
      const result = await client.query('SELECT gen_random_uuid() AS uuid');
      const uuid = result.rows[0].uuid as string;
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('should support trigram similarity via pg_trgm', async () => {
      const result = await client.query(`SELECT similarity('Mohammed', 'Mohamed') AS sim`);
      const sim = result.rows[0].sim as number;
      expect(sim).toBeGreaterThan(0.5);
      expect(sim).toBeLessThan(1.0);
    });

    it('should support EXCLUDE constraint with btree_gist', async () => {
      // Test indirect : verifier que btree_gist permet de creer un index gist sur uuid
      await client.query(`
        CREATE TEMP TABLE test_btree_gist_temp (
          id uuid,
          range tsrange,
          EXCLUDE USING gist (id WITH =, range WITH &&)
        )
      `);
      await client.query(`DROP TABLE test_btree_gist_temp`);
    });

    it('should remove accents via unaccent', async () => {
      const result = await client.query(`SELECT unaccent('etre forcement') AS clean`);
      expect(result.rows[0].clean).toBe('etre forcement');
    });

    it('should be case-insensitive via citext', async () => {
      await client.query(`
        CREATE TEMP TABLE test_citext_temp (email citext);
        INSERT INTO test_citext_temp VALUES ('test@example.com');
      `);
      const result = await client.query(`
        SELECT * FROM test_citext_temp WHERE email = 'TEST@EXAMPLE.COM'
      `);
      expect(result.rowCount).toBe(1);
      await client.query(`DROP TABLE test_citext_temp`);
    });
  });

  describe('Database skalean_insurtech_test (parallel testing)', () => {
    let client: Client;

    beforeAll(async () => {
      client = new Client({ connectionString: POSTGRES_TEST_URL });
      await client.connect();
    });

    afterAll(async () => {
      await client.end();
    });

    it.each(REQUIRED_EXTENSIONS)('test DB should have extension %s', async (ext) => {
      const result = await client.query(
        'SELECT extname FROM pg_extension WHERE extname = $1',
        [ext]
      );
      expect(result.rowCount).toBe(1);
    });
  });

  describe('Database list', () => {
    let client: Client;

    beforeAll(async () => {
      client = new Client({ connectionString: POSTGRES_URL });
      await client.connect();
    });

    afterAll(async () => {
      await client.end();
    });

    it('should have skalean_insurtech database', async () => {
      const result = await client.query(
        `SELECT datname FROM pg_database WHERE datname = 'skalean_insurtech'`
      );
      expect(result.rowCount).toBe(1);
    });

    it('should have skalean_insurtech_test database', async () => {
      const result = await client.query(
        `SELECT datname FROM pg_database WHERE datname = 'skalean_insurtech_test'`
      );
      expect(result.rowCount).toBe(1);
    });

    it('should have schema n8n', async () => {
      const result = await client.query(
        `SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'n8n'`
      );
      expect(result.rowCount).toBe(1);
    });

    it('should have schema audit (Sprint 12 ready)', async () => {
      const result = await client.query(
        `SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'audit'`
      );
      expect(result.rowCount).toBe(1);
    });

    it('should have schema reporting (Sprint 13 ready)', async () => {
      const result = await client.query(
        `SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'reporting'`
      );
      expect(result.rowCount).toBe(1);
    });
  });
});
```

### 6.7 Fichier 7/8 : `repo/infrastructure/scripts/__tests__/postgres-rls-helpers.spec.ts`

Role : tests integration verifiant les 6 helpers SQL multi-tenant.

```typescript
/**
 * Tests integration helpers RLS multi-tenant -- Tache 1.1.4
 *
 * Verifie que les 6 helpers SQL fonctionnent correctement avec session vars.
 *
 * Reference : 00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md (Tache 1.1.4)
 *             decision-002 (multi-tenant 3 niveaux)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';

const POSTGRES_URL =
  process.env.DATABASE_URL ??
  'postgresql://skalean:skalean_dev_only_change_in_prod@localhost:5432/skalean_insurtech';
const SKIP_INTEGRATION = process.env.SKIP_INTEGRATION === 'true';

const SAMPLE_TENANT_UUID = '11111111-1111-4111-8111-111111111111';
const SAMPLE_USER_UUID = '22222222-2222-4222-8222-222222222222';
const SAMPLE_ASSURE_UUID = '33333333-3333-4333-8333-333333333333';
const OTHER_TENANT_UUID = '44444444-4444-4444-8444-444444444444';

describe.skipIf(SKIP_INTEGRATION)('RLS helpers SQL -- Tache 1.1.4', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: POSTGRES_URL });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  describe('Helpers exist (information_schema)', () => {
    const HELPERS = [
      'app_current_tenant',
      'app_current_user_id',
      'app_is_super_admin',
      'app_assure_user_id',
      'app_cross_tenant_authorization_id',
      'app_can_access_tenant',
    ];

    it.each(HELPERS)('helper %s should be defined', async (helperName) => {
      const result = await client.query(
        'SELECT routine_name FROM information_schema.routines WHERE routine_name = $1',
        [helperName]
      );
      expect(result.rowCount).toBeGreaterThanOrEqual(1);
    });

    it('all helpers should be STABLE PARALLEL SAFE', async () => {
      const result = await client.query(`
        SELECT proname, provolatile, proparallel
        FROM pg_proc
        WHERE proname LIKE 'app\\_%'
      `);
      for (const row of result.rows) {
        // 's' = STABLE, 'i' = IMMUTABLE
        expect(['s', 'i']).toContain(row.provolatile);
        // 's' = parallel safe
        expect(row.proparallel).toBe('s');
      }
    });
  });

  describe('app_current_tenant() outside session', () => {
    it('should return NULL outside SET LOCAL', async () => {
      const result = await client.query('SELECT app_current_tenant() AS t');
      expect(result.rows[0].t).toBeNull();
    });
  });

  describe('app_current_tenant() inside transaction', () => {
    it('should return UUID set via SET LOCAL', async () => {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_tenant_id = '${SAMPLE_TENANT_UUID}'`);
      const result = await client.query('SELECT app_current_tenant() AS t');
      expect(result.rows[0].t).toBe(SAMPLE_TENANT_UUID);
      await client.query('COMMIT');
    });

    it('should return NULL if SET LOCAL is empty string', async () => {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_tenant_id = ''`);
      const result = await client.query('SELECT app_current_tenant() AS t');
      expect(result.rows[0].t).toBeNull();
      await client.query('COMMIT');
    });

    it('should isolate transactions (SET LOCAL scope)', async () => {
      // First transaction sets value
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_tenant_id = '${SAMPLE_TENANT_UUID}'`);
      await client.query('COMMIT');

      // Second transaction should not see the value
      const result = await client.query('SELECT app_current_tenant() AS t');
      expect(result.rows[0].t).toBeNull();
    });
  });

  describe('app_is_super_admin()', () => {
    it('should return false by default', async () => {
      const result = await client.query('SELECT app_is_super_admin() AS sa');
      expect(result.rows[0].sa).toBe(false);
    });

    it('should return true when SET LOCAL = true', async () => {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.is_super_admin = 'true'`);
      const result = await client.query('SELECT app_is_super_admin() AS sa');
      expect(result.rows[0].sa).toBe(true);
      await client.query('COMMIT');
    });

    it('should return false when SET LOCAL = false', async () => {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.is_super_admin = 'false'`);
      const result = await client.query('SELECT app_is_super_admin() AS sa');
      expect(result.rows[0].sa).toBe(false);
      await client.query('COMMIT');
    });
  });

  describe('app_current_user_id()', () => {
    it('should return UUID set in session', async () => {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_user_id = '${SAMPLE_USER_UUID}'`);
      const result = await client.query('SELECT app_current_user_id() AS u');
      expect(result.rows[0].u).toBe(SAMPLE_USER_UUID);
      await client.query('COMMIT');
    });

    it('should return NULL outside session', async () => {
      const result = await client.query('SELECT app_current_user_id() AS u');
      expect(result.rows[0].u).toBeNull();
    });
  });

  describe('app_assure_user_id()', () => {
    it('should return NULL by default (user not L3)', async () => {
      const result = await client.query('SELECT app_assure_user_id() AS a');
      expect(result.rows[0].a).toBeNull();
    });

    it('should return UUID when assure context set', async () => {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.assure_user_id = '${SAMPLE_ASSURE_UUID}'`);
      const result = await client.query('SELECT app_assure_user_id() AS a');
      expect(result.rows[0].a).toBe(SAMPLE_ASSURE_UUID);
      await client.query('COMMIT');
    });
  });

  describe('app_cross_tenant_authorization_id()', () => {
    it('should return NULL by default (no exception)', async () => {
      const result = await client.query('SELECT app_cross_tenant_authorization_id() AS x');
      expect(result.rows[0].x).toBeNull();
    });
  });

  describe('app_can_access_tenant() aggregation', () => {
    it('should return TRUE for super admin (any target)', async () => {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.is_super_admin = 'true'`);
      const result = await client.query(
        `SELECT app_can_access_tenant('${OTHER_TENANT_UUID}'::uuid) AS can`
      );
      expect(result.rows[0].can).toBe(true);
      await client.query('COMMIT');
    });

    it('should return TRUE for same tenant', async () => {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_tenant_id = '${SAMPLE_TENANT_UUID}'`);
      await client.query(`SET LOCAL app.is_super_admin = 'false'`);
      const result = await client.query(
        `SELECT app_can_access_tenant('${SAMPLE_TENANT_UUID}'::uuid) AS can`
      );
      expect(result.rows[0].can).toBe(true);
      await client.query('COMMIT');
    });

    it('should return FALSE for different tenant (no auth)', async () => {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_tenant_id = '${SAMPLE_TENANT_UUID}'`);
      await client.query(`SET LOCAL app.is_super_admin = 'false'`);
      const result = await client.query(
        `SELECT app_can_access_tenant('${OTHER_TENANT_UUID}'::uuid) AS can`
      );
      expect(result.rows[0].can).toBe(false);
      await client.query('COMMIT');
    });

    it('should return FALSE for NULL target (defensive)', async () => {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.is_super_admin = 'true'`);
      const result = await client.query('SELECT app_can_access_tenant(NULL) AS can');
      expect(result.rows[0].can).toBe(false);
      await client.query('COMMIT');
    });

    it('should return FALSE if no context set at all', async () => {
      const result = await client.query(
        `SELECT app_can_access_tenant('${SAMPLE_TENANT_UUID}'::uuid) AS can`
      );
      expect(result.rows[0].can).toBe(false);
    });
  });

  describe('Helper documentation (COMMENT ON)', () => {
    const HELPERS = [
      'app_current_tenant',
      'app_current_user_id',
      'app_is_super_admin',
      'app_assure_user_id',
      'app_cross_tenant_authorization_id',
      'app_can_access_tenant',
    ];

    it.each(HELPERS)('helper %s should have COMMENT documentation', async (helperName) => {
      const result = await client.query(`
        SELECT obj_description(p.oid, 'pg_proc') AS description
        FROM pg_proc p
        WHERE p.proname = $1
      `, [helperName]);
      expect(result.rowCount).toBeGreaterThanOrEqual(1);
      expect(result.rows[0].description).toBeTruthy();
      expect(result.rows[0].description).toContain('Skalean InsurTech');
    });
  });
});
```

### 6.8 Fichier 8/8 : `repo/infrastructure/scripts/__tests__/postgres-roles.spec.ts`

```typescript
/**
 * Tests integration roles applicatifs Postgres -- Tache 1.1.4
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';

const POSTGRES_URL =
  process.env.DATABASE_URL ??
  'postgresql://skalean:skalean_dev_only_change_in_prod@localhost:5432/skalean_insurtech';
const SKIP_INTEGRATION = process.env.SKIP_INTEGRATION === 'true';

describe.skipIf(SKIP_INTEGRATION)('Postgres roles applicatifs -- Tache 1.1.4', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: POSTGRES_URL });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  const REQUIRED_ROLES = ['insurtech_app', 'insurtech_admin', 'insurtech_ro'];

  it.each(REQUIRED_ROLES)('role %s should exist', async (rolename) => {
    const result = await client.query(
      'SELECT rolname FROM pg_roles WHERE rolname = $1',
      [rolename]
    );
    expect(result.rowCount).toBe(1);
  });

  it('insurtech_app should be NOSUPERUSER', async () => {
    const result = await client.query(
      `SELECT rolsuper FROM pg_roles WHERE rolname = 'insurtech_app'`
    );
    expect(result.rows[0].rolsuper).toBe(false);
  });

  it('insurtech_app should be NOREPLICATION', async () => {
    const result = await client.query(
      `SELECT rolreplication FROM pg_roles WHERE rolname = 'insurtech_app'`
    );
    expect(result.rows[0].rolreplication).toBe(false);
  });

  it('insurtech_admin should have CREATEDB privilege', async () => {
    const result = await client.query(
      `SELECT rolcreatedb FROM pg_roles WHERE rolname = 'insurtech_admin'`
    );
    expect(result.rows[0].rolcreatedb).toBe(true);
  });

  it('insurtech_app should have EXECUTE on app_current_tenant', async () => {
    const result = await client.query(`
      SELECT has_function_privilege('insurtech_app', 'app_current_tenant()', 'EXECUTE') AS has_priv
    `);
    expect(result.rows[0].has_priv).toBe(true);
  });

  it('insurtech_app should have EXECUTE on app_can_access_tenant', async () => {
    const result = await client.query(`
      SELECT has_function_privilege('insurtech_app', 'app_can_access_tenant(uuid)', 'EXECUTE') AS has_priv
    `);
    expect(result.rows[0].has_priv).toBe(true);
  });

  it('insurtech_ro should have EXECUTE on all helpers', async () => {
    const helpers = [
      'app_current_tenant()',
      'app_current_user_id()',
      'app_is_super_admin()',
      'app_assure_user_id()',
      'app_cross_tenant_authorization_id()',
      'app_can_access_tenant(uuid)',
    ];
    for (const helper of helpers) {
      const result = await client.query(
        `SELECT has_function_privilege('insurtech_ro', '${helper}', 'EXECUTE') AS has_priv`
      );
      expect(result.rows[0].has_priv).toBe(true);
    }
  });
});
```

---

## 7. Tests complets

### 7.1 Tests integration : voir 6.6, 6.7, 6.8 (40+ tests)

### 7.2 Tests unitaires (parsing SQL files)

```typescript
// repo/infrastructure/scripts/__tests__/postgres-init-files.spec.ts
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const REPO_ROOT = resolve(__dirname, '../../..');
const POSTGRES_DIR = join(REPO_ROOT, 'infrastructure/docker/postgres');

describe('Postgres init files structure -- Tache 1.1.4', () => {
  const REQUIRED_FILES = [
    'init.sh',
    '001-init-extensions.sql',
    '002-init-tenant-rls-helpers.sql',
    '003-init-databases.sql',
    '004-init-roles-grants.sql',
  ];

  it.each(REQUIRED_FILES)('should have file %s', (file) => {
    expect(existsSync(join(POSTGRES_DIR, file))).toBe(true);
  });

  it('001-init-extensions.sql should declare 5 extensions', () => {
    const content = readFileSync(join(POSTGRES_DIR, '001-init-extensions.sql'), 'utf-8');
    const extensions = ['pgcrypto', 'pg_trgm', 'btree_gist', 'unaccent', 'citext'];
    for (const ext of extensions) {
      expect(content).toContain(`CREATE EXTENSION IF NOT EXISTS "${ext}"`);
    }
  });

  it('002-init-tenant-rls-helpers.sql should define 6 helpers', () => {
    const content = readFileSync(join(POSTGRES_DIR, '002-init-tenant-rls-helpers.sql'), 'utf-8');
    const helpers = [
      'app_current_tenant',
      'app_current_user_id',
      'app_is_super_admin',
      'app_assure_user_id',
      'app_cross_tenant_authorization_id',
      'app_can_access_tenant',
    ];
    for (const helper of helpers) {
      expect(content).toContain(`FUNCTION ${helper}`);
    }
  });

  it('all helpers should be STABLE PARALLEL SAFE', () => {
    const content = readFileSync(join(POSTGRES_DIR, '002-init-tenant-rls-helpers.sql'), 'utf-8');
    const stableMatches = content.match(/STABLE/g) ?? [];
    const parallelSafeMatches = content.match(/PARALLEL SAFE/g) ?? [];
    expect(stableMatches.length).toBeGreaterThanOrEqual(6);
    expect(parallelSafeMatches.length).toBeGreaterThanOrEqual(6);
  });

  it('all helpers should have COMMENT ON FUNCTION', () => {
    const content = readFileSync(join(POSTGRES_DIR, '002-init-tenant-rls-helpers.sql'), 'utf-8');
    const commentMatches = content.match(/COMMENT ON FUNCTION/g) ?? [];
    expect(commentMatches.length).toBeGreaterThanOrEqual(6);
  });

  it('no emoji in init scripts', () => {
    const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
    for (const file of REQUIRED_FILES) {
      const content = readFileSync(join(POSTGRES_DIR, file), 'utf-8');
      expect(content).not.toMatch(emojiRegex);
    }
  });
});
```

### 7.3 Smoke tests bash

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# Reset stack pour re-executer init scripts
pnpm docker:reset
bash infrastructure/scripts/wait-for-stack-healthy.sh 60

# Test extensions
docker exec skalean-postgres psql -U skalean -d skalean_insurtech \
  -c "SELECT extname FROM pg_extension WHERE extname IN ('pgcrypto','pg_trgm','btree_gist','unaccent','citext') ORDER BY extname"

# Test helpers
docker exec skalean-postgres psql -U skalean -d skalean_insurtech \
  -c "\df app_*"

# Test app_current_tenant retourne NULL hors session
docker exec skalean-postgres psql -U skalean -d skalean_insurtech \
  -c "SELECT app_current_tenant()"

# Test SET LOCAL fonctionne
docker exec skalean-postgres psql -U skalean -d skalean_insurtech -c "
BEGIN;
SET LOCAL app.current_tenant_id = '11111111-1111-4111-8111-111111111111';
SELECT app_current_tenant();
COMMIT;
"

# Test app_can_access_tenant
docker exec skalean-postgres psql -U skalean -d skalean_insurtech -c "
BEGIN;
SET LOCAL app.is_super_admin = 'true';
SELECT app_can_access_tenant('11111111-1111-4111-8111-111111111111');
COMMIT;
"

# Tests vitest integration
pnpm vitest run infrastructure/scripts/__tests__/postgres-extensions.spec.ts
pnpm vitest run infrastructure/scripts/__tests__/postgres-rls-helpers.spec.ts
pnpm vitest run infrastructure/scripts/__tests__/postgres-roles.spec.ts

echo "ALL OK"
```

---

## 8. Variables environnement

```env
# Aucune nouvelle variable env (config via init scripts)
# Les variables Postgres existent deja (Tache 1.1.3) :
DATABASE_URL=postgresql://skalean:skalean_dev_only_change_in_prod@localhost:5432/skalean_insurtech
DATABASE_TEST_URL=postgresql://skalean:skalean_dev_only_change_in_prod@localhost:5432/skalean_insurtech_test

# Roles applicatifs (a utiliser au Sprint 6)
DATABASE_APP_URL=postgresql://insurtech_app:insurtech_app_dev_only_change_in_prod@localhost:5432/skalean_insurtech
DATABASE_ADMIN_URL=postgresql://insurtech_admin:insurtech_admin_dev_only_change_in_prod@localhost:5432/skalean_insurtech
DATABASE_RO_URL=postgresql://insurtech_ro:insurtech_ro_dev_only_change_in_prod@localhost:5432/skalean_insurtech
```

---

## 9. Commandes shell

```bash
cd repo

# 1. Creer fichiers SQL (voir section 6)
# 2. Reset stack pour re-init Postgres
pnpm docker:reset
bash infrastructure/scripts/wait-for-stack-healthy.sh 60

# 3. Verifier extensions
docker exec skalean-postgres psql -U skalean -d skalean_insurtech -c "\dx"

# 4. Verifier helpers
docker exec skalean-postgres psql -U skalean -d skalean_insurtech -c "\df+ app_*"

# 5. Verifier roles
docker exec skalean-postgres psql -U skalean -d skalean_insurtech -c "\du"

# 6. Tests integration
pnpm vitest run infrastructure/scripts/__tests__/postgres-extensions.spec.ts
pnpm vitest run infrastructure/scripts/__tests__/postgres-rls-helpers.spec.ts
pnpm vitest run infrastructure/scripts/__tests__/postgres-roles.spec.ts

# 7. Tests structure
pnpm vitest run infrastructure/scripts/__tests__/postgres-init-files.spec.ts

# 8. Commit
git add -A
git commit -m "feat(sprint-01): postgres 5 extensions + 6 helpers RLS multi-tenant 3 niveaux"
```

---

## 10. Criteres validation V1-V25

### 10.1 Criteres P0 (15 criteres)

- **V1 (P0)** : 5 extensions installees : `pgcrypto, pg_trgm, btree_gist, unaccent, citext` (test pg_extension)
- **V2 (P0)** : 6 helpers SQL definis : `\df app_*` retourne 6 lignes
- **V3 (P0)** : `SELECT app_current_tenant()` retourne NULL hors session
- **V4 (P0)** : `BEGIN; SET LOCAL app.current_tenant_id = '<uuid>'; SELECT app_current_tenant(); COMMIT;` retourne UUID
- **V5 (P0)** : `app_is_super_admin()` retourne false par defaut
- **V6 (P0)** : `app_is_super_admin()` retourne true quand SET LOCAL = 'true'
- **V7 (P0)** : `gen_random_uuid()` retourne UUID v4 valide
- **V8 (P0)** : `similarity('Mohammed', 'Mohamed') > 0.5` (pg_trgm)
- **V9 (P0)** : Schema `n8n` existe : `\dn`
- **V10 (P0)** : Database `skalean_insurtech_test` existe : `\l`
- **V11 (P0)** : Schema `audit` existe (Sprint 12 ready)
- **V12 (P0)** : Schema `reporting` existe (Sprint 13 ready)
- **V13 (P0)** : Role `insurtech_app` cree NOSUPERUSER
- **V14 (P0)** : `app_can_access_tenant(target)` retourne TRUE pour super admin
- **V15 (P0)** : Aucune emoji dans aucun fichier livre

### 10.2 Criteres P1 (8 criteres)

- **V16 (P1)** : Tous helpers declares STABLE PARALLEL SAFE
- **V17 (P1)** : Tous helpers ont COMMENT ON FUNCTION
- **V18 (P1)** : Role `insurtech_admin` a CREATEDB
- **V19 (P1)** : Role `insurtech_ro` cree (read-only)
- **V20 (P1)** : `insurtech_app` a EXECUTE sur tous helpers app_*
- **V21 (P1)** : DEFAULT PRIVILEGES configures (futures tables auto-grant)
- **V22 (P1)** : `app_can_access_tenant(target)` retourne TRUE pour same tenant
- **V23 (P1)** : `app_can_access_tenant(target)` retourne FALSE pour different tenant

### 10.3 Criteres P2 (5 criteres)

- **V24 (P2)** : `shared_preload_libraries=pg_stat_statements` actif (Tache 1.1.3 deja)
- **V25 (P2)** : Logging queries lentes actif : `SHOW log_min_duration_statement` retourne 500
- **V26 (P2)** : `app_can_access_tenant(NULL)` retourne FALSE (defensive)
- **V27 (P2)** : Init scripts sont idempotents (CREATE EXTENSION IF NOT EXISTS)
- **V28 (P2)** : DB test a aussi les 5 extensions installees

---

## 11. Edge cases + troubleshooting

### Edge case 1 : Init scripts ne s'executent pas apres rebuild image
**Solution** : Postgres execute init scripts UNIQUEMENT si data dir vide. `pnpm docker:reset` (efface volume) requis apres modif des SQL.

### Edge case 2 : `SELECT app_current_tenant()` raise erreur "unrecognized configuration parameter"
**Solution** : Postgres < 16 raise sans flag `missing_ok`. Verifier que `current_setting('app.X', true)` est utilise (avec `true`).

### Edge case 3 : Helper retourne mauvaise valeur entre transactions
**Solution** : `SET LOCAL` est scoped a transaction. Si valeur persiste, verifier que c'est `SET LOCAL` (pas `SET` global).

### Edge case 4 : Migration TypeORM tente CREATE EXTENSION et echoue (permission denied)
**Solution** : Extensions creees par init scripts (superuser au boot). Migrations TypeORM utilisent les fonctions sans CREATE EXTENSION.

### Edge case 5 : `app_can_access_tenant` retourne FALSE meme si super admin
**Solution** : Verifier que `SET LOCAL app.is_super_admin = 'true'` (string, pas boolean). Helper cast string -> boolean.

### Edge case 6 : Tests integration echouent en CI (race condition Postgres pas pret)
**Solution** : CI utilise `wait-for-stack-healthy.sh` avant tests. Healthcheck garantit Postgres ready.

### Edge case 7 : `pg_trgm similarity()` retourne 0 sur strings tres differents
**Solution** : Comportement attendu. Pour fuzzy match, threshold 0.3-0.5 typique. `set_limit(0.3)` configurable.

### Edge case 8 : `unaccent` ne fonctionne pas sur arabe (chadda, fatha)
**Solution** : Documente. Pour arabe, normalisation custom Sprint 9 + index GIN trigram.

---

## 12. Conformite Maroc

**Loi 09-08 CNDP (data residency)** : RLS Postgres garantit isolation tenant en couche DB. Defense en profondeur cross-tenant leak.

**Decret AMC code conduite** : audit trail toute action utilisateur. `app_current_user_id()` + `app_current_tenant()` permettent log structure.

**Conformite ACAPS** : multi-tenant strict empeche un courtier de voir donnees d'un autre courtier. Couche DB enforcee.

---

## 13. Conventions absolues skalean-insurtech

(14 conventions identiques.)

Cette tache concretise particulierement :
- **Multi-tenant strict** : 6 helpers SQL implementent la strategie 3 niveaux
- **No-emoji ABSOLU** : aucune emoji dans 5 fichiers SQL/shell + 4 specs
- **Imports strict** : tests utilisent `pg` library standard

---

## 14. Validation pre-commit

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

pnpm docker:reset
bash infrastructure/scripts/wait-for-stack-healthy.sh 60

docker exec skalean-postgres psql -U skalean -d skalean_insurtech \
  -c "SELECT count(*) FROM pg_extension WHERE extname IN ('pgcrypto','pg_trgm','btree_gist','unaccent','citext')" \
  | grep -E "^\s*5\s*$" || { echo "FAIL: 5 extensions"; exit 1; }

pnpm vitest run infrastructure/scripts/__tests__/postgres-extensions.spec.ts
pnpm vitest run infrastructure/scripts/__tests__/postgres-rls-helpers.spec.ts
pnpm vitest run infrastructure/scripts/__tests__/postgres-roles.spec.ts
pnpm vitest run infrastructure/scripts/__tests__/postgres-init-files.spec.ts

for f in infrastructure/docker/postgres/init.sh \
         infrastructure/docker/postgres/001-init-extensions.sql \
         infrastructure/docker/postgres/002-init-tenant-rls-helpers.sql \
         infrastructure/docker/postgres/003-init-databases.sql \
         infrastructure/docker/postgres/004-init-roles-grants.sql; do
  grep -P "[\x{1F300}-\x{1FAFF}]|[\x{2600}-\x{27BF}]" "$f" 2>/dev/null && {
    echo "FAIL: emoji $f"; exit 1
  }
done

echo "ALL OK"
```

---

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-01): postgres 5 extensions + 6 helpers RLS multi-tenant 3 niveaux

Pose la fondation DB de la strategie multi-tenant 3 niveaux (Platform / Customer
Tenant / Assure) -- decision-002.

5 extensions Postgres installees :
- pgcrypto    : gen_random_uuid() UUID v4 cryptographique
- pg_trgm     : full-text search trigram (CRM Sprint 8 + Repair Sprint 19)
- btree_gist  : EXCLUDE constraint anti-overlap (Booking Sprint 8)
- unaccent    : recherche insensible aux accents francais
- citext      : colonnes case-insensitive (emails, identifiants)

6 helpers SQL multi-tenant :
- app_current_tenant()                       UUID tenant courant ou NULL
- app_current_user_id()                      UUID user courant
- app_is_super_admin()                       bypass RLS si TRUE (default FALSE)
- app_assure_user_id()                       UUID assure L3 si applicable
- app_cross_tenant_authorization_id()        exception cross-tenant (Sprint 25)
- app_can_access_tenant(target_tenant_id)    AGGREGATE evaluation (super admin
  OR same tenant OR cross-tenant auth)

Tous les helpers declares STABLE PARALLEL SAFE pour query parallele.
Pattern : current_setting('app.X', true) avec NULLIF('') pour cast UUID safe.

3 schemas additionnels :
- n8n       : utilise par n8n container (Tache 1.1.3)
- audit     : Sprint 12 compliance ready
- reporting : Sprint 13 analytics ETL ready

DB test : skalean_insurtech_test (extensions + helpers cloned).

3 roles applicatifs :
- insurtech_app    NOSUPERUSER, NOREPLICATION (apps/api, soumis RLS)
- insurtech_admin  CREATEDB (migrations TypeORM, FORCE RLS=false owner)
- insurtech_ro     read-only (analytics + reporting)

DEFAULT PRIVILEGES configures pour auto-grant futures tables.

Tests : 40+ tests integration psql (extensions, helpers, roles) + 6 tests
        structure (parsing SQL files)
Validations : V1-V28 documentees

Conformite : decision-002 (multi-tenant 3 niveaux) + decision-006 (no-emoji)
Anchors : Sprint 6 multi-tenant runtime utilise SET LOCAL pattern
          Sprint 7 RBAC utilise app_is_super_admin()
          Sprint 25 cross-tenant framework utilise app_can_access_tenant()

Task: 1.1.4
Sprint: 1 (Phase 1 / Sprint 1)
Phase: 1 -- Bootstrap Infrastructure
Reference: B-01 Tache 1.1.4
Dependances: Tache 1.1.3 (Docker Compose Postgres)
Bloque: Tache 1.1.9 (database TypeORM), Sprint 2 (entites + RLS), Sprint 6 (multi-tenant runtime), Sprint 7 (RBAC), Sprint 25 (cross-tenant)"
```

---

## 16. Workflow next step

- **Tache suivante** : `task-1.1.5-redis-7-6-dbs-strategy.md`
- **Inputs herites** : Postgres ready avec extensions + helpers + roles + DBs
- **Outputs Tache 1.1.5** : Redis client TypeScript factory + 6 DBs constants

---

**Fin du prompt task-1.1.4-postgres-extensions-rls-helpers.md**

Densite atteinte : ~88 ko
Code patterns : 8 fichiers complets (init.sh + 4 SQL + 3 specs)
Tests : 40+ tests integration + 6 tests structure
Criteres validation : V1-V28 (15 P0 + 8 P1 + 5 P2)
Edge cases : 8 documentes
Sections : 16/16 presentes

## 17. Annexes techniques approfondies

### 17.1 RLS mecanisme detaille (Sprint 6 preview)

Sprint 6 implementera les RLS policies sur les tables tenant-scoped. Pattern attendu :

```sql
-- Sprint 2 (entite users) -- ENABLE RLS + policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy SELECT : voir uniquement rows du tenant courant OR si super admin
CREATE POLICY users_select_policy ON users
  FOR SELECT
  USING (app_can_access_tenant(tenant_id));

-- Policy INSERT : ne peut inserer que dans son tenant
CREATE POLICY users_insert_policy ON users
  FOR INSERT
  WITH CHECK (tenant_id = app_current_tenant() OR app_is_super_admin());

-- Policy UPDATE : ne peut updater que dans son tenant
CREATE POLICY users_update_policy ON users
  FOR UPDATE
  USING (app_can_access_tenant(tenant_id))
  WITH CHECK (tenant_id = app_current_tenant() OR app_is_super_admin());

-- Policy DELETE : ne peut delete que dans son tenant
CREATE POLICY users_delete_policy ON users
  FOR DELETE
  USING (app_can_access_tenant(tenant_id));
```

### 17.2 RLS + role insurtech_admin (Sprint 6 preview)

Le role `insurtech_admin` (cree Tache 1.1.4) doit pouvoir bypass RLS pour migrations + maintenance :

```sql
-- Sprint 6 -- pour chaque table avec RLS
ALTER TABLE users FORCE ROW LEVEL SECURITY;  -- meme owner soumis a RLS
ALTER TABLE users OWNER TO insurtech_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO insurtech_app;

-- insurtech_admin a bypass via FORCE = false (par default le owner bypass)
-- Si on veut que admin aussi soit soumis : FORCE ROW LEVEL SECURITY + policies pour admin
```

### 17.3 Approfondissement helper app_can_access_tenant

La fonction `app_can_access_tenant(target_tenant_id uuid)` est la piece centrale. Voici son flow detaille :

```
Input : target_tenant_id uuid
        |
        v
    is target NULL ?  --> YES --> return FALSE (defensive)
        |
        NO
        |
        v
    is super admin ? --> YES --> return TRUE (bypass)
        |
        NO
        |
        v
    current_tenant() = target ? --> YES --> return TRUE (same tenant)
        |
        NO
        |
        v
    cross_tenant_authorization_id() set ?
        |
        NO --> return FALSE
        |
        YES
        |
        v
    BEGIN/EXCEPTION wrapper :
    EXECUTE format('SELECT target_tenant_id, expired_at IS NULL OR expired_at > NOW() FROM cross_tenant_authorizations WHERE id = %L', cross_auth_id) INTO cross_auth_target, cross_auth_active
        |
        v
    IF cross_auth_active AND cross_auth_target = target_tenant_id THEN
      return TRUE
    ELSE
      return FALSE
    END
        |
        v
    EXCEPTION undefined_table : return FALSE (Sprint < 25)
```

### 17.4 Tests fuzz multi-tenant security

Sprint 33 (pentest) ajoutera tests fuzz :
- 1000 requetes randomized avec session vars set differents
- Verifier qu'aucune requete ne leak data cross-tenant
- Statistique : 0% leak attendu

### 17.5 Performance impact RLS

Benchmarks Sprint 33 (estimation) :
- Query simple sur table avec RLS : +2-5% latency vs no RLS
- Query complexe avec joins multiples : +5-10%
- Bulk insert 10k rows : +3% latency

Acceptation : RLS overhead largement justifie par securite.

### 17.6 Strategy index sur tenant_id

Toutes les tables avec `tenant_id` doivent avoir un index sur cette colonne (Sprint 2 systematise) :

```sql
CREATE INDEX idx_users_tenant_id ON users (tenant_id);
CREATE INDEX idx_contacts_tenant_id_email ON contacts (tenant_id, email);
CREATE INDEX idx_polices_tenant_id_status ON polices (tenant_id, status);
```

Les RLS policies ajoutent un filtre `WHERE tenant_id = ...`. Sans index, c'est full scan.

### 17.7 Strategy partitioning per tenant (Sprint 35 preview)

Pour les tres grosses tables (audit_logs, events Kafka archive), Sprint 35 evaluera partitioning :

```sql
-- Sprint 35 -- preview
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  ...
) PARTITION BY HASH (tenant_id);

CREATE TABLE audit_logs_p0 PARTITION OF audit_logs FOR VALUES WITH (modulus 16, remainder 0);
-- ... 16 partitions
```

### 17.8 Strategy purge donnees CNDP

Loi 09-08 CNDP impose purge donnees apres demande utilisateur OR delai legal. Sprint 12 implementera :

```sql
-- Sprint 12 -- procedure purge tenant
CREATE OR REPLACE PROCEDURE purge_tenant_data(p_tenant_id uuid)
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM contacts WHERE tenant_id = p_tenant_id;
  DELETE FROM users WHERE tenant_id = p_tenant_id;
  -- ... toutes les tables
  -- Audit log preserve 10 ans (compliance)
  UPDATE audit_logs SET tenant_id = NULL, payload = '{purged}' WHERE tenant_id = p_tenant_id AND created_at < NOW() - INTERVAL '10 years';
END;
$$;
```

### 17.9 Strategy backup + restore

- Atlas Cloud Services Benguerir managed Postgres = backup quotidien automatique
- Retention 30 jours par defaut
- Test restore mensuel Sprint 35
- Backup chiffre AES-256 at rest

### 17.10 Roles + privileges matrix

| Role | LOGIN | SUPERUSER | CREATEDB | CREATEROLE | REPLICATION | RLS bypass |
|------|-------|-----------|----------|------------|-------------|------------|
| postgres | yes | yes | yes | yes | yes | yes |
| skalean | yes | yes | yes | yes | yes | yes |
| insurtech_admin | yes | no | yes | no | no | yes (FORCE off) |
| insurtech_app | yes | no | no | no | no | no (RLS applies) |
| insurtech_ro | yes | no | no | no | no | no (RLS applies) |

### 17.11 Strategy connection pooling PgBouncer (Sprint 35)

Sprint 35 prod ajoute PgBouncer 1.23.1 entre apps et Postgres :
- Mode `transaction` (idle connections released after each tx)
- Pool size 100 (vs 500 connections Postgres -> 5:1 ratio)
- Round-robin load balancing
- TLS termination Atlas

### 17.12 Edge cases supplementaires

#### Edge case 9 : `STABLE` vs `IMMUTABLE` impact query plan
Postgres optimizer fait differemment selon volatility. `STABLE` permet evaluation 1 fois par query, `IMMUTABLE` permet evaluation 1 fois par plan (cache).

#### Edge case 10 : RLS et auto-vacuum interaction
Auto-vacuum bypass RLS automatiquement (run as table owner). Pas d'impact.

#### Edge case 11 : RLS et triggers
Triggers run with table owner privileges, donc bypass RLS. Si trigger insert dans une autre table, attention au tenant_id.

#### Edge case 12 : RLS et views
Views heritent RLS de tables sous-jacentes. Mais SECURITY DEFINER views bypass RLS. Eviter SECURITY DEFINER.

### 17.13 Patterns d'usage helpers SQL Sprint 2-25

#### 17.13.1 Sprint 2 -- entite users

```typescript
// packages/database/src/entities/user.entity.ts (Sprint 2)
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'tenant_id' })
  tenant_id!: string;

  @Column('citext')
  email!: string;

  @Column('text', { name: 'password_hash' })
  password_hash!: string;
}

// Migration Sprint 2 ajoute RLS
await queryRunner.query(`
  ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  CREATE POLICY users_isolation ON users
    USING (app_can_access_tenant(tenant_id));
`);
```

#### 17.13.2 Sprint 5 -- auth.service.ts (login)

```typescript
// Sprint 5 -- packages/auth/src/auth.service.ts
async login(input: LoginInput): Promise<AuthResult> {
  // Pas de tenant_id encore : besoin de chercher cross-tenant
  // Solution : utiliser super admin context temporaire

  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  try {
    await queryRunner.query(`SET LOCAL app.is_super_admin = 'true'`);

    const user = await queryRunner.manager.findOne(UserEntity, {
      where: { email: input.email },
    });

    if (!user || !await argon2.verify(user.password_hash, input.password + this.pepper)) {
      throw new UnauthorizedException();
    }

    const tokens = await this.generateTokens(user);
    await queryRunner.commitTransaction();
    return { ...tokens, user };
  } catch (e) {
    await queryRunner.rollbackTransaction();
    throw e;
  } finally {
    await queryRunner.release();
  }
}
```

#### 17.13.3 Sprint 6 -- TenantInterceptor NestJS

```typescript
// Sprint 6 -- apps/api/src/interceptors/tenant-context.interceptor.ts
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly dataSource: DataSource) {}

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const tenant_id = req.headers['x-tenant-id'] as string;
    const user_id = req.user?.id;

    if (!tenant_id) {
      throw new BadRequestException('x-tenant-id header required');
    }

    return new Observable((subscriber) => {
      this.dataSource.transaction(async (manager) => {
        await manager.query(`SET LOCAL app.current_tenant_id = $1`, [tenant_id]);
        await manager.query(`SET LOCAL app.current_user_id = $1`, [user_id]);
        await manager.query(`SET LOCAL app.is_super_admin = 'false'`);

        return next.handle().toPromise();
      })
        .then((result) => {
          subscriber.next(result);
          subscriber.complete();
        })
        .catch((err) => subscriber.error(err));
    });
  }
}
```

### 17.14 Sprint 25 cross-tenant framework (preview)

Sprint 25 (cross-tenant Repair) ajoutera la table `cross_tenant_authorizations` :

```sql
-- Sprint 25 -- migration
CREATE TABLE cross_tenant_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_tenant_id uuid NOT NULL,
  target_tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  reason text NOT NULL,
  permission text[] NOT NULL,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  revoked_at timestamptz,
  CHECK (source_tenant_id <> target_tenant_id)
);

CREATE INDEX idx_cta_source ON cross_tenant_authorizations (source_tenant_id, expires_at);
CREATE INDEX idx_cta_target ON cross_tenant_authorizations (target_tenant_id, expires_at);
```

Le helper `app_can_access_tenant` fonctionnera enfin (la branche cross-tenant active).

### 17.15 Tests RLS isolation Sprint 6

Sprint 6 ajoutera 50+ tests integration RLS isolation :

```typescript
// Sprint 6 -- packages/database/src/__tests__/rls-isolation.spec.ts (preview)
describe('RLS isolation -- 50 scenarios', () => {
  it('user A in tenant 1 cannot SELECT user B in tenant 2', async () => {
    // setup users
    // login as user A (tenant 1)
    // SELECT users
    // Assert : retourne 1 row (user A only)
  });

  it('user A cannot INSERT user with tenant_id=2', async () => {
    // setup
    // INSERT INTO users (tenant_id, ...) VALUES ('tenant-2-uuid', ...)
    // Assert : ERROR row level security policy violation
  });

  // ... 48 autres scenarios
});
```

### 17.16 Compatibilite TypeORM 0.3 RLS

TypeORM 0.3 Subscriber pattern (Tache 1.1.9) automatise l'injection `tenant_id` :

```typescript
// Sprint 2 -- packages/database/src/subscribers/tenant-id-injector.subscriber.ts
@EventSubscriber()
export class TenantIdInjectorSubscriber implements EntitySubscriberInterface {
  beforeInsert(event: InsertEvent<any>) {
    const tenantId = TenantContext.getCurrentTenantId();
    if (tenantId && event.entity && 'tenant_id' in event.entity && !event.entity.tenant_id) {
      event.entity.tenant_id = tenantId;
    }
  }
}
```

### 17.17 Audit log subscriber

```typescript
// Sprint 12 -- packages/compliance/src/audit-log-writer.subscriber.ts
@EventSubscriber()
export class AuditLogWriterSubscriber implements EntitySubscriberInterface {
  afterInsert(event: InsertEvent<any>) {
    if (event.metadata.tableName === 'audit_logs') return;  // avoid recursion
    this.auditLog.write({
      tenant_id: TenantContext.getCurrentTenantId(),
      user_id: TenantContext.getCurrentUserId(),
      action: 'INSERT',
      table: event.metadata.tableName,
      entity_id: event.entity.id,
      timestamp: new Date(),
    });
  }
  // ... afterUpdate, afterDelete
}
```

### 17.18 Strategy migration TypeORM (Sprint 2)

Sprint 2 utilisera TypeORM CLI pour migrations :

```bash
# Generer migration depuis entites
pnpm --filter @insurtech/database run migration:generate -- src/migrations/AddUsersTable

# Run migrations
pnpm --filter @insurtech/database run migration:run

# Revert derniere migration
pnpm --filter @insurtech/database run migration:revert
```

Migrations sont VERSIONNEES dans Git, run automatiquement au boot apps/api production.

### 17.19 Conformite legale Maroc renforcee

**Loi 09-08 CNDP article 17** : exige isolation des donnees personnelles. RLS Postgres = couche DB qui garantit cette isolation, defense en profondeur.

**Decret AMC 2024 article 5** : exige audit trail pour acces aux donnees assurance. `app_current_user_id()` permet logged automatiquement.

**ACAPS controle 2024 clause cybersecurite** : exige principe du moindre privilege. Roles `insurtech_app` (NOSUPERUSER) + `insurtech_ro` (read-only) implementent ce principe.

### 17.20 Roadmap Sprint 1-35 Postgres

| Sprint | Action Postgres | Impact RLS |
|--------|-----------------|------------|
| 1 | 5 extensions + 6 helpers + 3 roles + DB test | Foundation |
| 2 | Entites users, tenants, audit_logs + RLS policies | Active RLS |
| 5 | auth.service avec super admin login pattern | Use helpers |
| 6 | TenantInterceptor + Subscribers | Runtime activation |
| 7 | RBAC: rls_role pour fine-grained | + helpers |
| 8 | CRM tables + RLS | Apply pattern |
| 9-13 | Modules horizontaux + RLS sur chaque table | Apply pattern |
| 14-25 | Verticales Insure + Repair + RLS | Apply pattern |
| 25 | Cross-tenant authorizations table | Active branche helpers |
| 33 | Pentest RLS audit | Verify no leak |
| 35 | Migration Atlas Cloud Services Benguerir managed | Migrate helpers |


### 17.21 Pattern Lua-like sql function pour ops atomiques

Postgres ne supporte pas Lua mais PL/pgSQL offre l'equivalent. Pattern utilise Sprint 11+ :

```sql
-- Sprint 11 -- function atomique paiement
CREATE OR REPLACE FUNCTION atomic_payment_register(
  p_tenant_id uuid,
  p_amount numeric,
  p_idempotency_key text
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  existing_payment_id uuid;
  new_payment_id uuid;
BEGIN
  -- Check idempotency
  SELECT id INTO existing_payment_id
  FROM payments
  WHERE tenant_id = p_tenant_id AND idempotency_key = p_idempotency_key;

  IF existing_payment_id IS NOT NULL THEN
    RETURN existing_payment_id;  -- Already processed
  END IF;

  -- Insert atomically
  INSERT INTO payments (tenant_id, amount, idempotency_key)
  VALUES (p_tenant_id, p_amount, p_idempotency_key)
  RETURNING id INTO new_payment_id;

  RETURN new_payment_id;
EXCEPTION
  WHEN unique_violation THEN
    -- Race condition : autre tx a insere meme idempotency_key
    SELECT id INTO existing_payment_id
    FROM payments
    WHERE tenant_id = p_tenant_id AND idempotency_key = p_idempotency_key;
    RETURN existing_payment_id;
END;
$$;
```

### 17.22 Strategy schema evolution sans downtime

Sprint 35 prod utilise pattern blue-green migrations :
1. Step 1 : ADD column nullable (compatible avec ancien code)
2. Step 2 : Backfill column (background job)
3. Step 3 : ALTER column NOT NULL (apres backfill complet)
4. Step 4 : Deploy new code qui use nouvelle column
5. Step 5 : DROP ancienne column (apres validation)

Aucune downtime requise.

### 17.23 PostGIS evaluation Sprint 17/19

Sprint 17 (customer portal) + Sprint 19 (Repair garages) pourraient utiliser PostGIS pour :
- Geolocation garages (latitude/longitude)
- Recherche radius (garages dans 10km)
- Trace itineraire (depannage routier)

Decision : evaluer Sprint 17 si necessaire. Sinon, Mapbox cote frontend (decision-005 Maps).

### 17.24 Materialized views Sprint 13 analytics

Sprint 13 ajoutera materialized views pour aggregations analytics :

```sql
-- Sprint 13 -- preview
CREATE MATERIALIZED VIEW reporting.tenant_dashboard_daily AS
SELECT
  tenant_id,
  DATE(created_at) AS day,
  COUNT(*) FILTER (WHERE status = 'paid') AS paid_count,
  SUM(amount) FILTER (WHERE status = 'paid') AS paid_total,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed_count
FROM payments
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY tenant_id, DATE(created_at);

CREATE UNIQUE INDEX ON reporting.tenant_dashboard_daily (tenant_id, day);

-- Refresh nightly via pg_cron
SELECT cron.schedule('refresh-tenant-dashboard', '0 1 * * *', $$REFRESH MATERIALIZED VIEW CONCURRENTLY reporting.tenant_dashboard_daily$$);
```

### 17.25 Strategy hot-standby read replicas (Sprint 35)

Atlas Cloud Services Benguerir prod : 1 primary + 2 read replicas.
- Read replicas async (lag < 100ms)
- App lit scale via load balancer (round-robin replicas)
- Critical reads forces vers primary (e.g. apres write)

```typescript
// Sprint 35 -- packages/database/src/data-source.ts (preview)
export const PrimaryDataSource = new DataSource({
  // primary writes
});

export const ReadReplicaDataSource = new DataSource({
  // read replicas lecture only
  replication: {
    master: { host: 'pg-primary.atlas-bgr.ma' },
    slaves: [
      { host: 'pg-replica1.atlas-bgr.ma' },
      { host: 'pg-replica2.atlas-bgr.ma' },
    ],
  },
});
```


### 17.26 Tests integration RLS multi-tenant approfondis

```typescript
// Tests Sprint 6 -- packages/database/src/__tests__/rls-detailed.spec.ts (preview)
describe('RLS multi-tenant security tests', () => {
  describe('SELECT isolation', () => {
    it('user A in tenant 1 sees only tenant 1 users', async () => {});
    it('user B in tenant 2 sees only tenant 2 users', async () => {});
    it('super admin sees all users', async () => {});
  });

  describe('INSERT enforcement', () => {
    it('user A cannot insert with tenant_id != tenant 1', async () => {});
    it('insertion auto-set tenant_id from session var', async () => {});
  });

  describe('UPDATE enforcement', () => {
    it('user A cannot update tenant 2 user', async () => {});
    it('user A cannot change tenant_id of own user', async () => {});
  });

  describe('DELETE enforcement', () => {
    it('user A cannot delete tenant 2 user', async () => {});
  });

  describe('Cross-tenant authorization (Sprint 25)', () => {
    it('with active CTA, user A in tenant 1 can SELECT tenant 2 data', async () => {});
    it('expired CTA does not allow access', async () => {});
    it('revoked CTA does not allow access', async () => {});
  });

  describe('JOIN scenarios', () => {
    it('joining users + contacts respects RLS', async () => {});
    it('subqueries respect RLS', async () => {});
  });

  describe('Aggregate queries', () => {
    it('COUNT respects RLS', async () => {});
    it('SUM, AVG respect RLS', async () => {});
  });

  describe('Function calls', () => {
    it('functions called from RLS context filter results', async () => {});
  });

  describe('Race conditions', () => {
    it('concurrent SET LOCAL do not interfere', async () => {});
  });
});
```

### 17.27 Strategy versioning helpers SQL

Lorsque les helpers SQL evoluent (e.g. ajout d'un parametre), strategy migration :
1. Creer nouvelle version : `app_can_access_tenant_v2(target_id uuid, additional text)`
2. Deprecate ancienne : `COMMENT ON FUNCTION app_can_access_tenant IS 'DEPRECATED -- use v2'`
3. Migrate RLS policies tableau par tableau
4. Drop ancienne version apres migration complete

### 17.28 Strategy upgrade Postgres major versions

Postgres 16 -> 17 (probable Sprint 35 ou apres) :
1. Test exhaustif staging environment
2. Verifier compat extensions (pgcrypto, pg_trgm, btree_gist, unaccent, citext)
3. Verifier compat helpers SQL (syntax PL/pgSQL stable)
4. Verifier compat TypeORM 0.3 client driver
5. Migration prod : pg_upgrade ou logical replication

Postgres 17 ajoute :
- Improved JSON support
- Better partition pruning
- Performance improvements bulk inserts

### 17.29 Patterns de seed data Sprint 2+

Sprint 2 ajoutera seeds dev pour tests :

```typescript
// packages/database/src/seeds/dev-tenants.seed.ts (Sprint 2)
export async function seedDevTenants(dataSource: DataSource) {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    await queryRunner.query(`SET LOCAL app.is_super_admin = 'true'`);

    await queryRunner.manager.insert('tenants', [
      { id: '11111111-1111-4111-8111-111111111111', name: 'Wafa Assurance', type: 'broker', country: 'MA' },
      { id: '22222222-2222-4222-8222-222222222222', name: 'Garage Marrakech Auto', type: 'garage', country: 'MA' },
      { id: '33333333-3333-4333-8333-333333333333', name: 'Skalean Platform', type: 'platform', country: 'MA' },
    ]);

    await queryRunner.commitTransaction();
  } catch (e) {
    await queryRunner.rollbackTransaction();
    throw e;
  } finally {
    await queryRunner.release();
  }
}
```

### 17.30 Audit table structure (Sprint 12 preview)

```sql
-- Sprint 12 -- audit.audit_logs
CREATE TABLE audit.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,  -- nullable pour purge CNDP
  user_id uuid,
  action text NOT NULL,  -- INSERT/UPDATE/DELETE/LOGIN/etc.
  table_name text NOT NULL,
  entity_id uuid,
  payload jsonb,
  ip_address inet,
  user_agent text,
  request_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_tenant_created ON audit.audit_logs (tenant_id, created_at);
CREATE INDEX idx_audit_user_created ON audit.audit_logs (user_id, created_at);
CREATE INDEX idx_audit_action ON audit.audit_logs (action);

-- RLS sur audit_logs : tenant peut voir SES propres logs
ALTER TABLE audit.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_isolation ON audit.audit_logs
  FOR SELECT
  USING (app_can_access_tenant(tenant_id) OR app_is_super_admin());

-- Insert : aucune RLS (logs ecrites par background process)
CREATE POLICY audit_insert ON audit.audit_logs
  FOR INSERT
  WITH CHECK (true);
```

### 17.31 Resume densification Tache 1.1.4

Cette tache 1.1.4 est exhaustive sur :
- 5 extensions installees + utilisees Sprint 8/19/8/comm/auth
- 6 helpers SQL avec rationale + signature + COMMENT documentation
- 3 roles applicatifs avec privileges minimaux
- Defense en profondeur multi-tenant via 4 couches
- RLS policies pattern attendu Sprint 2 (preview)
- Tests integration RLS isolation 50+ scenarios Sprint 6 (preview)
- TypeORM Subscriber pattern pour automate tenant_id injection
- Audit table + Subscriber Sprint 12 (preview)
- Materialized views Sprint 13 analytics (preview)
- Read replicas Sprint 35 prod (preview)
- Strategy upgrade Postgres 16 -> 17 (Sprint 35+)
- Conformite legale Maroc (CNDP, AMC, ACAPS) implementee couche DB


### 17.32 References finales

- decision-002 multi-tenant 3 niveaux (foundation)
- decision-008 data residency Maroc (Atlas Cloud Services Benguerir)
- Postgres 16.6 documentation
- TypeORM 0.3 RLS subscriber pattern
- 8-skalean-insurtech-prompt-master.md Section 2 (multi-tenant strict)


### 17.33 Final notes Tache 1.1.4

Cette tache pose les fondations de la securite multi-tenant en couche DB. Toute regression mettrait en risque la conformite Maroc (loi 09-08, ACAPS, AMC). Tests RLS Sprint 6 + audit pentest Sprint 33 obligatoires pour valider integralite securite.


### 17.34 Verification post-deployment finale

Apres deploy de cette tache 1.1.4, verifier dans cet ordre :

1. `pnpm docker:reset` -- regenerer DB avec init scripts
2. `bash infrastructure/scripts/wait-for-stack-healthy.sh` -- attendre healthy
3. `docker exec skalean-postgres psql -U skalean -d skalean_insurtech -c "\dx"` -- 5 extensions listees
4. `docker exec skalean-postgres psql -U skalean -d skalean_insurtech -c "\df app_*"` -- 6 helpers listees
5. `docker exec skalean-postgres psql -U skalean -d skalean_insurtech -c "\du"` -- 3 roles cres
6. `docker exec skalean-postgres psql -U skalean -d skalean_insurtech_test -c "\dx"` -- DB test extensions OK
7. `pnpm vitest run infrastructure/scripts/__tests__/postgres-*` -- tous tests passent
8. Aucune emoji : `grep -P "[\u{1F300}-\u{1FAFF}]" infrastructure/docker/postgres/*.sql` retourne vide
9. Roles testables : connect avec `insurtech_app` puis `SELECT app_can_access_tenant(...)` reussit


### 17.35 Glossaire : termes Postgres relevants

- **RLS (Row Level Security)** : feature Postgres 9.5+ qui permet de filtrer les rows visibles par row au niveau du DB (pas application).
- **STABLE** : function dont le resultat est constant pour les memes inputs au sein d'une query, mais peut changer entre queries.
- **PARALLEL SAFE** : function qui peut etre executee dans un worker parallel sans side-effects.
- **SECURITY DEFINER** : function qui s'execute avec les privileges du definer (creator), pas du caller. EVITE pour functions custom.
- **policy USING** : condition appliquee aux SELECT/UPDATE/DELETE existing rows.
- **policy WITH CHECK** : condition appliquee aux INSERT/UPDATE new rows.
- **FORCE RLS** : impose RLS meme au table owner (par defaut, owner bypass RLS).
- **session var** : variable scoped a la connection Postgres, set via SET.
- **SET LOCAL** : variable scoped a la transaction courante, reset au COMMIT/ROLLBACK.

